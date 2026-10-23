// F-1 broker connection: the consent state machine, zero-depth link validation, provisional claims, the chunked
// import (one vendor page per step, one transaction per step under the per-user advisory lock), expiry and staleness
// clocks, and vendor cleanup. docs/features/F-1-broker-connection.md decisions; docs/features/logs/F-1/plan.md §1, §8.
import { sql } from './db.ts';
import type { TransactionSql } from 'postgres';
import * as vendor from './broker.ts';
import type { BrokerUser, VendorAccount } from './broker.ts';
import { AccountClaimedError, claimIn } from './claims.ts';
import { recordFunnel } from './funnel.ts';
import { completeAttempt, createUserForAttempt } from './auth/attempts.ts';
import { insertActivities, rebuildTrades, USER_LOCK } from './sync.ts';
import { replacePositions } from './positions.ts';
import { ownsAttempt } from './auth/links.ts';
import { unsignToken } from './auth/sessions.ts';

// Brokerage-first: the signed attempt id, bound to the browser at S1 (startSignIn) until the user row exists.
export const CONNECT_COOKIE = 'connect_attempt';
export const ATTEMPT_HOURS = 24;
export const CONNECT_COOKIE_SECONDS = ATTEMPT_HOURS * 3_600; // the cookie never outlives its attempt

// Committee fix (High): the ONLY way a signed-out request finds its attempt. The HMAC-signed cookie written when the
// attempt was created, for an attested brokerage attempt with no user that is not completed. A query-string id is never
// read: ids are sequential, and an attempt handed to whoever asks is a takeover.
// Committee fix (Low, round 6): a bound attempt lives ATTEMPT_HOURS from its creation, as its cookie does. Older, it is
// refused like an unbound one and counted once (`reason: 'expired'`, an id and a reason only), so nothing a portal
// started can complete after cleanupAttempts (same age, same database clock) has removed its vendor user.
export async function boundAttempt(cookie: string | undefined | null, secret: string, now?: Date): Promise<number | null> {
  const id = Number(unsignToken(cookie, secret));
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [a] = await sql`select id, created_at + ${ATTEMPT_HOURS} * interval '1 hour' > ${now ?? sql`now()`} as live from signup_attempts
    where id = ${id} and method = 'brokerage' and user_id is null and completed_at is null`;
  if (!a) return null;
  if (a.live) return id;
  const [seen] = await sql`select 1 from funnel_events where attempt_id = ${id} and name = 'failed' and meta->>'reason' = 'expired' limit 1`;
  if (!seen) await recordFunnel(id, 'failed', { reason: 'expired' });
  return null;
}
// A request that presents an attempt id its cookie does not match: refused, and counted on that attempt (an id and a
// reason; nothing personal). An unknown or malformed id writes nothing.
export async function refuseUnbound(raw: unknown): Promise<void> {
  if (typeof raw !== 'string' || !/^[1-9]\d{0,17}$/.test(raw)) return;
  const id = Number(raw);
  const [a] = await sql`select id from signup_attempts where id = ${id}`;
  if (a) await recordFunnel(id, 'failed', { reason: 'unbound' });
}

export const STATES = ['pending', 'importing', 'connected', 'declined', 'expired', 'failed'] as const;
export type State = (typeof STATES)[number];
export const TRANSITIONS: Record<State, readonly State[]> = {
  pending: ['importing', 'declined', 'expired'], importing: ['connected', 'failed'], connected: [], declined: [], expired: [], failed: [],
};
export class IllegalTransitionError extends Error { constructor(from: string, to: string) { super(`connection cannot go from ${from} to ${to}`); } }
export function assertTransition(from: State, to: State): void {
  if (!TRANSITIONS[from]?.includes(to)) throw new IllegalTransitionError(from, to);
}

// A connection id from a query string or a form: digits only, no NaN, nothing a bigint column would reject (D3).
export function parseConnectionId(raw: unknown): number | null {
  return typeof raw === 'string' && /^[1-9]\d{0,17}$/.test(raw) ? Number(raw) : null;
}

export const PENDING_HOURS = 24; // "import pending" never persists beyond this (the feature's consent decision)
export const STALE_HOURS = 24; // importing with no progress for this long → failed (plan §8 item 2)
export const WAIT_RECHECK_MS = 30_000; // while the vendor's own initial sync runs, re-check its flag at most this often
export const MAX_STEPS_PER_TICK = 200;
const H = 3_600_000;

export type ClockRow = { state: State; pending_at: Date; importing_at: Date | null; last_progress_at: Date | null };
// What the clocks say a row should be now, or null when nothing changes. Pure, so it is tested without a database.
export function clockState(c: ClockRow, now: Date): 'expired' | 'failed' | null {
  if (c.state === 'pending' && now.getTime() >= c.pending_at.getTime() + PENDING_HOURS * H) return 'expired';
  const since = c.last_progress_at ?? c.importing_at;
  if (c.state === 'importing' && since && now.getTime() >= since.getTime() + STALE_HOURS * H) return 'failed';
  return null;
}

// Import cursor: account index and page offset of the current pass. A pass re-reads every account; a second pass runs
// when the vendor's initial sync was still filling during the first one, so the record ends complete (TR-3).
export type Cursor = { i: number; offset: number; pass: number; rebuilt?: boolean; checkedAt?: number; retries?: number; retryAt?: number };
export const startCursor = (): Cursor => ({ i: 0, offset: 0, pass: 1 });
// A vendor 429, 5xx or transport error defers the next step: 30 s doubling per consecutive failure, capped at one hour.
// Progress is not recorded while waiting, so the 24 h stale clock still ends an import the vendor never resumes.
export const RETRY_BASE_MS = 30_000;
export const RETRY_MAX_MS = 3_600_000;
export const retryDelayMs = (retries: number): number => Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, retries - 1));
// The vendor refused or no longer has the link: the import cannot continue and is failed (reason `vendor`).
export const REFUSED_STATUSES = new Set([401, 403, 404]);
export function advanceCursor(c: Cursor, pageDone: boolean, limit: number): Cursor {
  return pageDone ? { i: c.i + 1, offset: 0, pass: c.pass } : { i: c.i, offset: c.offset + limit, pass: c.pass };
}

export type SnapAccount = { id: string; authorizationId: string; institution: string; isPaper: boolean; initialSyncCompleted: boolean };
export type Connection = {
  id: number; attempt_id: number; user_id: number | null; vendor_authorization_id: string | null; institution: string | null; state: State;
  pending_at: Date; importing_at: Date | null; connected_at: Date | null; consent_at: Date | null; last_progress_at: Date | null;
  import_cursor: Cursor; imported_count: number; accounts: SnapAccount[]; cleanup_done_at: Date | null; failure_reason: string | null;
  disconnected_at: Date | null;
};
export type Deps = Pick<typeof vendor, 'registerUser' | 'connectUrl' | 'listAccounts' | 'fetchActivitiesPage' | 'fetchPositions' | 'deleteConnection' | 'deleteUser'> & { pageLimit?: number };
export const realDeps: Deps = vendor;

const norm = (c: Record<string, unknown>): Connection => ({ ...(c as Connection), id: Number(c.id), attempt_id: Number(c.attempt_id) });
export async function getConnection(id: number, db: TransactionSql | typeof sql = sql): Promise<Connection | null> {
  const [c] = await db`select * from connections where id = ${id}`;
  return c ? norm(c) : null;
}
export async function latestConnection(userId: number): Promise<Connection | null> {
  const [c] = await sql`select * from connections where user_id = ${userId} order by id desc limit 1`;
  return c ? norm(c) : null;
}
// What may be public about a trader's connections (fix round 2, COMPLIANCE §3 consent at collection). Only a consented
// connection (consent_at set: importing, connected, or failed after consent) and claims confirmed at consent or by a
// completed sync contribute; a pending, declined or expired link, its provisional claims and its account snapshot never
// do. A pre-F-1 claim (confirmed, no connection) counts as connected. The state never derives from "has a vendor id".
// Fix round 3: the state is over ALL consented connections, never the newest one (TR-3): a trader can hold several,
// and a newer finished one must not present a still-running import as a whole record.
export type PublicState = 'importing' | 'connected' | 'failed' | 'none';
export type AggregateRow = Pick<Connection, 'id' | 'state' | 'consent_at' | 'imported_count' | 'accounts'>;
export type RecordStatus = { state: PublicState; imported: number; importing: number[] };
// Pure. importing while any consented connection imports; else failed while a consented import failed and no later
// live (importing or connected) connection re-imports every one of its real accounts (a retry clears it); else
// connected when every remaining consented connection is connected; else the pre-F-1 claim, else none.
export function aggregateRecord(rows: AggregateRow[], legacy = false): RecordStatus {
  const consented = rows.filter((r) => r.consent_at !== null && (r.state === 'importing' || r.state === 'connected' || r.state === 'failed'));
  const live = consented.filter((r) => r.state !== 'failed');
  const superseded = (f: AggregateRow) => {
    const later = new Set(live.filter((r) => r.id > f.id).flatMap((r) => r.accounts.map((a) => a.id)));
    const real = f.accounts.filter((a) => !a.isPaper);
    return real.length > 0 && real.every((a) => later.has(a.id));
  };
  const counted = consented.filter((r) => r.state !== 'failed' || !superseded(r));
  const importing = counted.filter((r) => r.state === 'importing').map((r) => r.id);
  const state: PublicState = importing.length ? 'importing'
    : counted.some((r) => r.state === 'failed') ? 'failed'
    : counted.length ? 'connected'
    : legacy ? 'connected' : 'none';
  return { state, imported: counted.reduce((n, r) => n + r.imported_count, 0), importing };
}
const legacyClaim = (userId: number) => sql`exists (select 1 from broker_accounts where user_id = ${userId} and confirmed_at is not null and connection_id is null)`;
export async function recordStatus(userId: number): Promise<RecordStatus> {
  return (await recordStates([userId])).get(userId)!;
}
// Fix round 4 (TR-3): the same aggregate for many traders in two queries (the feed reads every visible trader once).
export async function recordStates(userIds: number[]): Promise<Map<number, RecordStatus>> {
  const ids = [...new Set(userIds)];
  const out = new Map<number, RecordStatus>();
  if (!ids.length) return out;
  const rows = await sql`select user_id, id, state, consent_at, imported_count, accounts from connections where user_id = any(${ids}) and consent_at is not null order by id`;
  const legacy = new Set((await sql`select distinct user_id from broker_accounts where user_id = any(${ids}) and confirmed_at is not null and connection_id is null`).map((r) => Number(r.user_id)));
  for (const id of ids) {
    const mine = rows.filter((r) => Number(r.user_id) === id).map((r) => ({ ...(r as unknown as AggregateRow), id: Number(r.id) }));
    out.set(id, aggregateRecord(mine, legacy.has(id)));
  }
  return out;
}
export async function publicRecord(userId: number): Promise<{ state: PublicState; paper: number }> {
  return (await publicRecordDetail(userId)).public;
}
// The profile's read: the public state and simulated count, plus the summed import count for the banner.
export async function publicRecordDetail(userId: number): Promise<{ public: { state: PublicState; paper: number }; imported: number }> {
  const status = await recordStatus(userId);
  const [r] = await sql`select
    exists (select 1 from connections where user_id = ${userId} and consent_at is not null) as consented,
    ${legacyClaim(userId)} as legacy,
    (select count(*)::int from broker_accounts where user_id = ${userId} and is_paper and removed_at is null and confirmed_at is not null) as paper`;
  return { public: { state: status.state, paper: r.consented || r.legacy ? (r.paper as number) : 0 }, imported: status.imported };
}
// PR-2b (S5): the banner's imported count: distinct activity rows stored from the broker (a second pass re-reads pages,
// so the per-connection imported_count can count a row twice; the table cannot).
export async function importedRows(userId: number): Promise<number> {
  const [r] = await sql`select count(*)::int as n from activities where user_id = ${userId} and source = 'snaptrade'`;
  return r.n as number;
}
// PR-2b: the institutions the vendor returned for real accounts of consented connections, in link order, for the
// profile's "Connected:" line. A pending, declined or expired link is never named (COMPLIANCE §3, as publicRecord).
export async function recordInstitutions(userId: number): Promise<string[]> {
  const rows = await sql`select a->>'institution' as inst, min(c.id) as first from connections c, jsonb_array_elements(c.accounts) a
    where c.user_id = ${userId} and c.consent_at is not null and c.state in ('importing', 'connected', 'failed')
      and coalesce((a->>'isPaper')::boolean, false) = false and coalesce(btrim(a->>'institution'), '') <> ''
    group by 1 order by 2, 1`;
  return rows.map((r) => r.inst as string);
}
// A connection belongs to its user, or, before a user row exists, to the browser holding the signed attempt cookie.
export function ownsConnection(c: Pick<Connection, 'user_id' | 'attempt_id'>, meId: number | null, cookie: string | undefined, secret: string): boolean {
  return c.user_id !== null ? meId === c.user_id : ownsAttempt(cookie, c.attempt_id, secret);
}

const realOf = (c: Connection) => c.accounts.filter((a) => !a.isPaper);
const paperOf = (c: Connection) => c.accounts.filter((a) => a.isPaper);
export const accountCounts = (c: Connection) => ({ total: c.accounts.length, paper: paperOf(c).length });

// The vendor user: on the users row, or on the attempt for a brokerage-first sign-up that has no user yet.
async function brokerUserFor(c: { user_id: number | null; attempt_id: number }, db: TransactionSql | typeof sql = sql): Promise<BrokerUser | null> {
  const [r] = c.user_id !== null
    ? await db`select snaptrade_user_id as u, snaptrade_secret_enc as s from users where id = ${c.user_id}`
    : await db`select snaptrade_user_id as u, snaptrade_secret_enc as s from signup_attempts where id = ${c.attempt_id}`;
  return r?.u && r?.s ? { snaptradeUserId: r.u as string, secretEnc: r.s as string } : null;
}

// S2 → portal: makes sure a vendor user exists (on the user, else on the attempt) and returns the portal URL.
// PR-2b: `mode` is how it opens: 'embedded' (S3 modal, POST /connect/portal) or 'redirect' (GET /connect/start: the
// fallback, the persistent link, S7a's "Continue in a new page", in-app browsers). Either way the URL is minted here,
// server side, for this user or bound attempt only; nothing a browser sends is ever used as a portal URL.
export type PortalMode = 'embedded' | 'redirect';
export async function startConnection(who: { userId: number | null; attemptId: number }, returnTo: string, deps: Deps = realDeps, mode: PortalMode = 'redirect'): Promise<string> {
  let bu = await brokerUserFor({ user_id: who.userId, attempt_id: who.attemptId });
  if (!bu) {
    bu = await deps.registerUser(who.userId ?? `attempt-${who.attemptId}`);
    if (who.userId !== null) await sql`update users set snaptrade_user_id = ${bu.snaptradeUserId}, snaptrade_secret_enc = ${bu.secretEnc} where id = ${who.userId}`;
    else await sql`update signup_attempts set snaptrade_user_id = ${bu.snaptradeUserId}, snaptrade_secret_enc = ${bu.secretEnc} where id = ${who.attemptId}`;
  }
  await recordFunnel(who.attemptId, 'portal_opened', { mode });
  return deps.connectUrl(bu, returnTo);
}

export type LinkOutcome =
  | { kind: 'consent'; id: number } // S4
  | { kind: 'none'; id: number } // S6c: no real account; nothing kept
  | { kind: 'refused'; id: number } // claimed by another profile (TR-6); the link is dropped
  | { kind: 'signin'; id: number; userId: number; handle: string } // mechanic (a): all accounts are this existing trader's
  | { kind: 'nothing' }; // the portal returned without a new link

// Back from the portal: zero-depth validation. Lists accounts, records the link and the provisional claims, imports nothing.
export async function completeLink(who: { userId: number | null; attemptId: number }, deps: Deps = realDeps, now = new Date(), mode: PortalMode = 'redirect'): Promise<LinkOutcome> {
  const bu = await brokerUserFor({ user_id: who.userId, attempt_id: who.attemptId });
  if (!bu) return abandoned(who.attemptId);
  const all = await deps.listAccounts(bu);
  const known = who.userId === null ? [] : await sql`select vendor_authorization_id as a from connections where user_id = ${who.userId} and state in ('pending', 'importing', 'connected')`;
  const knownIds = new Set(known.map((k) => k.a as string));
  const fresh = all.filter((a) => !knownIds.has(a.authorizationId));
  if (!fresh.length) return abandoned(who.attemptId);
  const snapshot: SnapAccount[] = fresh.map((a: VendorAccount) => ({ id: a.id, authorizationId: a.authorizationId, institution: a.institution, isPaper: a.isPaper, initialSyncCompleted: a.initialSyncCompleted }));
  const [row] = await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, institution, state, pending_at, portal_mode, accounts)
    values (${who.attemptId}, ${who.userId}, ${fresh[0].authorizationId}, ${fresh[0].institution}, 'pending', ${now}, ${mode}, ${sql.json(snapshot as never)}) returning id`;
  const id = Number(row.id);
  const real = snapshot.filter((a) => !a.isPaper);
  if (!real.length) {
    await setState(id, 'pending', 'declined', now);
    await recordFunnel(who.attemptId, 'no_real_account');
    await cleanupQuietly(id, deps);
    return { kind: 'none', id };
  }
  const owners = await sql`select account_id, user_id, confirmed_at from broker_accounts where account_id in ${sql(real.map((a) => a.id))}`;
  if (who.userId === null) {
    const confirmedBy = new Set(owners.filter((o) => o.confirmed_at).map((o) => o.user_id as number));
    if (owners.length && confirmedBy.size === 1 && owners.every((o) => o.confirmed_at) && owners.length === real.length) {
      const userId = [...confirmedBy][0];
      const [u] = await sql`select handle from users where id = ${userId} and deleted_at is null`;
      if (u) {
        await completeAttempt(who.attemptId, userId);
        await setState(id, 'pending', 'declined', now);
        await cleanupQuietly(id, deps);
        return { kind: 'signin', id, userId, handle: u.handle as string };
      }
    }
    if (owners.length) return refuse(id, who.attemptId, deps, now);
  } else {
    if (owners.some((o) => o.user_id !== who.userId)) return refuse(id, who.attemptId, deps, now);
    const r = await sql.begin((tx) => claimIn(tx, who.userId!, snapshot.map((a) => ({ id: a.id, isPaper: a.isPaper })), { connectionId: id, confirmed: false, now }));
    if (!r.ok) return refuse(id, who.attemptId, deps, now);
  }
  await recordFunnel(who.attemptId, 'link_succeeded', { accounts: snapshot.length, paper: snapshot.length - real.length });
  return { kind: 'consent', id };
}

// Fix round 1 (tester defect 2, plan §5): the portal came back without a new link (the embedded dialog closed, a
// CLOSED / ABANDONED message, or the redirect flow returning empty): S7a, counted as `abandoned`.
async function abandoned(attemptId: number): Promise<LinkOutcome> {
  await recordFunnel(attemptId, 'abandoned');
  return { kind: 'nothing' };
}

async function refuse(id: number, attemptId: number, deps: Deps, now: Date): Promise<LinkOutcome> {
  await setState(id, 'pending', 'declined', now);
  await recordFunnel(attemptId, 'failed', { reason: 'claimed' });
  await cleanupQuietly(id, deps);
  return { kind: 'refused', id };
}

async function setState(id: number, from: State, to: State, now: Date, extra: Record<string, unknown> = {}, db: TransactionSql | typeof sql = sql): Promise<boolean> {
  assertTransition(from, to);
  const rows = await db`update connections set ${db({ state: to, [`${to}_at`]: now, ...extra })} where id = ${id} and state = ${from} returning id`;
  return rows.length === 1;
}

export class NotPendingError extends Error { constructor() { super('the connection is no longer awaiting consent'); } }

// S4 "Import my record": the tap is consent_at. Creates the users row for a brokerage-first attempt (the attestation on
// the attempt precedes it), confirms the claims, and starts the import. The first page is read by the next step.
export async function consent(id: number, now = new Date(), deps: Deps = realDeps): Promise<{ userId: number; handle: string }> {
  await applyClocks(now, { id });
  const c = await getConnection(id);
  if (!c || c.state !== 'pending') throw new NotPendingError();
  let user: { id: number; handle: string };
  const createdHere = c.user_id === null;
  if (createdHere) {
    // Committee fix (Low): one tap wins. The attempt is reserved atomically before any users row exists, so a double
    // tap finds nothing to reserve and creates no second user.
    const [r] = await sql`update signup_attempts set completed_at = ${now} where id = ${c.attempt_id} and user_id is null and completed_at is null returning id`;
    if (!r) throw new NotPendingError();
    try { user = await createUserForAttempt(c.attempt_id); } catch (e) { await releaseAttempt(c.attempt_id); throw e; }
  } else {
    const [u] = await sql`select id, handle from users where id = ${c.user_id}`;
    user = { id: u.id as number, handle: u.handle as string };
  }
  try {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${USER_LOCK}, ${user.id})`;
      const r = await claimIn(tx, user.id, c.accounts.map((a) => ({ id: a.id, isPaper: a.isPaper })), { connectionId: id, confirmed: true, now });
      if (!r.ok) throw new AccountClaimedError();
      const ok = await setState(id, 'pending', 'importing', now, { consent_at: now, user_id: user.id, last_progress_at: now, import_cursor: tx.json(startCursor() as never) }, tx);
      if (!ok) throw new NotPendingError();
      if (createdHere) {
        // The vendor user registered on the attempt moves to the user it now belongs to, in this transaction: a failure
        // leaves it on the attempt (for the refusal's cleanup), and nothing is ever copied back.
        await tx`update users u set snaptrade_user_id = a.snaptrade_user_id, snaptrade_secret_enc = a.snaptrade_secret_enc
          from signup_attempts a where a.id = ${c.attempt_id} and u.id = ${user.id}`;
        await tx`update signup_attempts set snaptrade_user_id = null, snaptrade_secret_enc = null where id = ${c.attempt_id}`;
      }
    });
  } catch (e) {
    // A brokerage-first consent that failed leaves no ghost user: the users row goes and the attempt is open again.
    if (createdHere) {
      await sql`delete from users where id = ${user.id}`;
      await releaseAttempt(c.attempt_id);
    }
    // Lost the claim race: the refusal's cleanup removes the link and the vendor user still on the attempt.
    if (e instanceof AccountClaimedError) await refuse(id, c.attempt_id, deps, now);
    throw e;
  }
  await recordFunnel(c.attempt_id, 'consented');
  return { userId: user.id, handle: user.handle };
}
const releaseAttempt = (attemptId: number) => sql`update signup_attempts set user_id = null, completed_at = null where id = ${attemptId}`;

// S4 "Don't import": declined, the link removed at the vendor, provisional claims released.
// Only a pending row can be declined; anything else (a replay, a consented connection) is a no-op (D2).
export async function decline(id: number, deps: Deps = realDeps, now = new Date()): Promise<void> {
  const c = await getConnection(id);
  if (!c || c.state !== 'pending' || !(await setState(id, 'pending', 'declined', now))) return;
  await recordFunnel(c.attempt_id, 'declined');
  await cleanupQuietly(id, deps);
}

// The clocks, applied lazily on every read (marking only; the vendor cleanup runs from the tick) and by the tick.
export async function applyClocks(now = new Date(), scope: { id?: number; userId?: number } = {}): Promise<{ expired: number[]; failed: number[] }> {
  if ((scope.id !== undefined && !Number.isSafeInteger(scope.id)) || (scope.userId !== undefined && !Number.isSafeInteger(scope.userId))) return { expired: [], failed: [] };
  const where = scope.id !== undefined ? sql`and id = ${scope.id}` : scope.userId !== undefined ? sql`and user_id = ${scope.userId}` : sql``;
  const expired = await sql`update connections set state = 'expired', expired_at = ${now} where state = 'pending' and pending_at + ${PENDING_HOURS} * interval '1 hour' <= ${now} ${where} returning id, attempt_id`;
  const failed = await sql`update connections set state = 'failed', failed_at = ${now}, failure_reason = 'stale'
    where state = 'importing' and coalesce(last_progress_at, importing_at) + ${STALE_HOURS} * interval '1 hour' <= ${now} ${where} returning id, attempt_id`;
  for (const r of expired) await recordFunnel(Number(r.attempt_id), 'expired');
  for (const r of failed) await recordFunnel(Number(r.attempt_id), 'failed', { reason: 'stale' });
  return { expired: expired.map((r) => Number(r.id)), failed: failed.map((r) => Number(r.id)) };
}

// Decline, expiry, no real account, refusal: the link goes at the vendor (and the vendor user with it when no users row
// exists), provisional claims are released, confirmed claims never. Retried by the tick until cleanup_done_at is set.
// Only a declined or expired row is ever cleaned, and an authorization that a live (pending, importing or connected)
// connection of the same user or attempt holds is never deleted: an expired link re-bundled into a new consent, or a
// replayed decline, must not cut the consented link (D2).
export async function cleanup(id: number, deps: Deps = realDeps, now = new Date()): Promise<void> {
  const c = await getConnection(id);
  if (!c || c.cleanup_done_at || (c.state !== 'declined' && c.state !== 'expired')) return;
  const live = await sql`select a->>'authorizationId' as auth from connections c, jsonb_array_elements(c.accounts) a
    where c.id <> ${id} and c.state in ('pending', 'importing', 'connected') and (c.attempt_id = ${c.attempt_id} ${c.user_id === null ? sql`` : sql`or c.user_id = ${c.user_id}`})`;
  const held = new Set(live.map((r) => r.auth as string));
  const bu = await brokerUserFor(c);
  if (bu) {
    for (const auth of new Set(c.accounts.map((a) => a.authorizationId))) if (!held.has(auth)) await ignoreGone(deps.deleteConnection(bu, auth));
    if (c.user_id === null && held.size === 0) {
      await ignoreGone(deps.deleteUser(bu));
      await sql`update signup_attempts set snaptrade_user_id = null, snaptrade_secret_enc = null where id = ${c.attempt_id}`;
    }
  }
  await sql`delete from broker_accounts where connection_id = ${id} and confirmed_at is null`;
  // Committee fix (Medium, §3): the account snapshot and institution have no use once the link is gone; ids, states and
  // timestamps stay for the funnel.
  await sql`update connections set cleanup_done_at = ${now}, accounts = '[]'::jsonb, institution = null where id = ${id}`;
}

// Committee fix (Medium, §3): a brokerage-first attempt whose portal was opened but never finished holds a vendor user
// with no use. After 24 h (the longest a portal or consent can stay open), with no live or uncleaned connection and no
// users row holding the same vendor user, it is deleted at the vendor and blanked on the attempt. Retried by the tick.
// Age is read from the database clock (not the tick's `now`), so a simulated clock never sweeps a fresh attempt.
// `now` exists for tests; the tick passes none. Swept exactly when boundAttempt stops accepting the attempt.
export async function cleanupAttempts(deps: Deps = realDeps, now?: Date): Promise<number> {
  const rows = await sql`select id, snaptrade_user_id as u, snaptrade_secret_enc as s from signup_attempts a
    where snaptrade_user_id is not null and created_at + ${ATTEMPT_HOURS} * interval '1 hour' <= ${now ?? sql`now()`}
      and not exists (select 1 from connections c where c.attempt_id = a.id and (c.state in ('pending', 'importing', 'connected') or c.cleanup_done_at is null))
      and not exists (select 1 from users x where x.snaptrade_user_id = a.snaptrade_user_id)
    order by id`;
  let n = 0;
  for (const r of rows) {
    try {
      if (r.s) await ignoreGone(deps.deleteUser({ snaptradeUserId: r.u as string, secretEnc: r.s as string }));
      await sql`update signup_attempts set snaptrade_user_id = null, snaptrade_secret_enc = null where id = ${r.id} and snaptrade_user_id = ${r.u}`;
      n++;
    } catch (e) { console.error('attempt cleanup failed', r.id, errStatus(e)); }
  }
  return n;
}
async function cleanupQuietly(id: number, deps: Deps) {
  try { await cleanup(id, deps); } catch (e) { console.error('connection cleanup failed', id, errStatus(e)); }
}
// The SDK's error carries `status`; a raw transport error carries `response.status`. Only the status is ever logged.
const errStatus = (e: unknown) => { const x = e as { status?: number; response?: { status?: number } }; return x?.status ?? x?.response?.status ?? (e instanceof Error ? e.name : 'error'); };
// A link or user already gone at the vendor counts as removed.
async function ignoreGone(p: Promise<unknown>) { try { await p; } catch (e) { if (errStatus(e) !== 404) throw e; } }

export type StepResult = { state: State; imported: number; progressed: boolean; retryAt?: number };

// One import step: one vendor page in one transaction under the per-user advisory lock, so a step and an hourly sync
// never interleave and a failure leaves the record exactly as before. Resumable from import_cursor by any caller.
export async function importStep(id: number, deps: Deps = realDeps, now = new Date()): Promise<StepResult> {
  const head = await getConnection(id);
  if (!head || head.state !== 'importing' || head.user_id === null) return { state: head?.state ?? 'failed', imported: head?.imported_count ?? 0, progressed: false };
  const retryAt = head.import_cursor?.retryAt;
  if (retryAt && now.getTime() < retryAt) return { state: 'importing', imported: head.imported_count, progressed: false, retryAt };
  try {
    return await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${USER_LOCK}, ${head.user_id})`;
      const [row] = await tx`select * from connections where id = ${id} for update`;
      const c = norm(row);
      if (c.state !== 'importing') return { state: c.state, imported: c.imported_count, progressed: false };
      const bu = (await brokerUserFor(c, tx))!;
      const real = realOf(c);
      const { retries: _retries, retryAt: _retryAt, ...cur }: Cursor = { ...startCursor(), ...c.import_cursor }; // a page read clears the backoff
      const save = async (cursor: Cursor, progressed: boolean, imported = c.imported_count) => {
        await tx`update connections set import_cursor = ${tx.json(cursor as never)}, imported_count = ${imported}, last_progress_at = ${progressed ? now : c.last_progress_at} where id = ${id}`;
        return { state: 'importing' as State, imported, progressed };
      };
      if (cur.i < real.length) {
        const limit = deps.pageLimit ?? vendor.PAGE_LIMIT;
        const page = await deps.fetchActivitiesPage(bu, real[cur.i].id, cur.offset, limit);
        await insertActivities(c.user_id!, 'snaptrade', page.activities, tx);
        return save(advanceCursor(cur, page.done, limit), true, c.imported_count + page.activities.length);
      }
      if (!cur.rebuilt) {
        await rebuildTrades(c.user_id!, tx);
        const positions = [];
        for (const a of real) for (const p of await deps.fetchPositions(bu, a.id)) positions.push({ accountId: a.id, symbol: p.symbol, unrealizedPct: p.unrealizedPct });
        await replacePositions(tx, c.user_id!, positions);
        return save({ ...cur, rebuilt: true }, true);
      }
      if (cur.checkedAt && now.getTime() - cur.checkedAt < WAIT_RECHECK_MS) return { state: 'importing', imported: c.imported_count, progressed: false };
      const live = new Map((await deps.listAccounts(bu)).map((a) => [a.id, a]));
      const done = real.every((a) => (live.get(a.id)?.initialSyncCompleted ?? true));
      if (!done) return save({ ...cur, checkedAt: now.getTime() }, false);
      // Complete at link time, or re-read once after the vendor finished: the record is whole (TR-3).
      if (cur.pass >= 2 || real.every((a) => a.initialSyncCompleted)) {
        await setState(id, 'importing', 'connected', now, { last_progress_at: now }, tx);
        const [{ n }] = await tx`select count(*)::int as n from closed_trades where user_id = ${c.user_id}`;
        await recordFunnel(c.attempt_id, 'import_finished', { trades: n as number, seconds: Math.round((now.getTime() - (c.consent_at ?? now).getTime()) / 1000) });
        return { state: 'connected', imported: c.imported_count, progressed: true };
      }
      return save({ i: 0, offset: 0, pass: cur.pass + 1 }, true);
    });
  } catch (e) {
    const status = errStatus(e);
    if (typeof status !== 'number') throw e; // not the vendor's answer (a database error): the caller sees it
    // The vendor refused or lost the link: failed, visible to the trader, retried by connecting again.
    if (REFUSED_STATUSES.has(status)) {
      if (await setState(id, 'importing', 'failed', now, { failure_reason: 'vendor' })) await recordFunnel(head.attempt_id, 'failed', { reason: 'vendor' });
      return { state: 'failed', imported: head.imported_count, progressed: false };
    }
    // Rate limited, a vendor outage or any other answer: the step rolled back; the next one waits out the backoff (D4).
    const retries = (head.import_cursor?.retries ?? 0) + 1;
    const next = now.getTime() + retryDelayMs(retries);
    await sql`update connections set import_cursor = import_cursor || ${sql.json({ retries, retryAt: next })} where id = ${id} and state = 'importing'`;
    console.error('import step deferred', id, status);
    return { state: 'importing', imported: head.imported_count, progressed: false, retryAt: next };
  }
}

// The owner's poll (POST /api/import/step): applies the clocks, runs one step for every importing connection of the
// user (fix round 3: not the newest row; a newer pending or finished link never hides a running import), then answers
// the aggregate over all consented connections: the state, the summed import count and the closes.
export async function ownerPoll(userId: number, deps: Deps = realDeps, now = new Date()): Promise<{ state: PublicState; imported: number; closes: number }> {
  await applyClocks(now, { userId });
  for (const id of (await recordStatus(userId)).importing) await importStep(id, deps, now);
  const r = await recordStatus(userId);
  const [{ n }] = await sql`select count(*)::int as n from closed_trades where user_id = ${userId}`;
  return { state: r.state, imported: r.imported, closes: n as number };
}

// Runs steps for one row until it stops progressing, finishes, or hits the per-tick bound.
export async function drive(id: number, deps: Deps = realDeps, now = new Date(), max = MAX_STEPS_PER_TICK): Promise<StepResult> {
  let r: StepResult = { state: 'importing', imported: 0, progressed: true };
  for (let n = 0; n < max && r.state === 'importing' && r.progressed; n++) r = await importStep(id, deps, now);
  return r;
}

// The hourly tick's connection work: clocks, every importing row advanced (a closed tab never stalls an import), cleanups retried.
export async function tick(deps: Deps = realDeps, now = new Date()): Promise<{ expired: number; failed: number; advanced: number; cleaned: number; errors: number[] }> {
  const clocks = await applyClocks(now);
  const errors: number[] = [];
  let advanced = 0, cleaned = 0;
  for (const r of await sql`select id from connections where state = 'importing' order by id`) {
    try { await drive(Number(r.id), deps, now); advanced++; } catch (e) { errors.push(Number(r.id)); console.error('import step failed', r.id, errStatus(e)); }
  }
  for (const r of await sql`select id from connections where cleanup_done_at is null and state in ('declined', 'expired') order by id`) {
    try { await cleanup(Number(r.id), deps, now); cleaned++; } catch (e) { errors.push(Number(r.id)); console.error('connection cleanup failed', r.id, errStatus(e)); }
  }
  await cleanupAttempts(deps);
  return { expired: clocks.expired.length, failed: clocks.failed.length, advanced, cleaned, errors };
}
