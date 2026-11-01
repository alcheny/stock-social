// F-24 late-posted trades (docs/features/F-24-late-sell-reconciliation.md; plan and committee record in
// docs/features/logs/F-24/). The week re-read (lib/sync.ts BACKFILL_MS) never sees a row the vendor posts with a trade
// date older than the week before the newest stored one. A periodic full-history read per account (a "pass") finds them:
// one vendor page per due daily activities read, in place of that day's week read (F-14's budget is unchanged), resumed
// from a cursor on broker_accounts. Inserts stay `on conflict (source, external_id) do nothing`: no raw row is ever
// updated or removed, and results reach closed_trades only through the rebuild.
//
// Every write here runs in the sync's transaction (a rollback leaves the cursor and the re-issue states as they were),
// except writeReconcileFailures (after the transaction, like F-14's marks).
import type { TransactionSql } from 'postgres';
import { sql } from './db.ts';

type Db = TransactionSql | typeof sql;
// A query fragment (postgres.js), interpolated into a larger statement.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Frag = any;

const DAY_MS = 86_400_000;
// A pass starts at most once per this period per account (the week re-read's own span: a late row lands within about a
// week, plus the days a longer history takes).
export const RECONCILE_EVERY_MS = 7 * DAY_MS;
// Pacing: a later page of a pass waits at least this long after the previous one, so the account's daily reads go
// page, week, page, week (its recent trades wait at most one extra day). 47 h, not 48: hourly rounds jitter.
export const RECONCILE_PAGE_GAP_MS = 47 * 3_600_000;
// Each later page starts this many rows back and must list the previous page's last ids again (a vendor list that
// shifted between pages, days apart, would otherwise skip a row and make it look absent).
export const RECONCILE_OVERLAP = 50;
// Failed syncs in a row that were to read a page: then the pass is given up and the week read instead.
export const RECONCILE_MAX_FAILURES = 2;
// Rows the activities read lists (share moves such as REI come from another read and are never in its listing).
export const LISTABLE_TYPES = ['BUY', 'SELL'];

const ms = (n: number) => sql`${n}::float8 * interval '1 millisecond'`;

/** The rebuild's filter (rows aliased `a`): a possible re-issue that no read has shown to be genuine is held. */
export const notReissued = (db: Db) => db`not exists (select 1 from activity_reissues r where r.source = a.source and r.external_id = a.external_id and r.state <> 'genuine')`;

export type PassPlan = { offset: number; start: boolean };
type Cursor = { account_id: string; reconcile_offset: number | null; reconcile_started_at: Date | null; consent: Date | null; claimed_at: Date;
  failures: number; gap_ok: boolean; due: boolean };

// The account's own weekday (0-6 from a hash of its id; `%` keeps the sign in Postgres, hence the + 7).
const weekday = (accountId: Frag) => sql`((hashtext(${accountId}) % 7) + 7) % 7`;
/** The first due date of an account that has none: the next occurrence of its weekday (on the database clock), never
 *  before a period after its claim (a just-connected account has just read its whole history). */
const firstDue = (t: Frag) => sql`greatest(b.claimed_at + ${ms(RECONCILE_EVERY_MS)},
  date_trunc('day', ${t}) + mod(${weekday(sql`b.account_id`)} - mod(floor(extract(epoch from ${t}) / 86400)::bigint, 7) + 7, 7) * interval '1 day')`;

/** Which of `ids` (accounts whose daily activities read is due under F-14 and that owe no option backfill) read a pass
 *  page this sync, and at which offset. A null due date is written first (the stagger). A pass is given up after
 *  RECONCILE_MAX_FAILURES failed page steps in a row; one started before the account's latest consent or claim
 *  restarts at 0; a later page waits RECONCILE_PAGE_GAP_MS after the previous one. */
export async function plannedPages(tx: TransactionSql, userId: number, ids: string[], t: Frag): Promise<Map<string, PassPlan>> {
  const out = new Map<string, PassPlan>();
  if (!ids.length) return out;
  await tx`update broker_accounts b set reconcile_due_at = ${firstDue(t)} where b.user_id = ${userId} and b.account_id in ${tx(ids)} and b.reconcile_due_at is null`;
  const rows = await tx<Cursor[]>`select b.account_id, b.reconcile_offset, b.reconcile_started_at, b.claimed_at,
      (select max(c.connected_at) from connections c, jsonb_array_elements(c.accounts) ca where c.user_id = ${userId} and c.state = 'connected' and ca->>'id' = b.account_id) as consent,
      coalesce(m.reconcile_failures, 0) as failures,
      (b.reconcile_page_at is null or b.reconcile_page_at <= ${t} - ${ms(RECONCILE_PAGE_GAP_MS)} or b.reconcile_page_at > ${t} + interval '5 minutes') as gap_ok,
      b.reconcile_due_at <= ${t} as due
    from broker_accounts b left join sync_read_marks m on m.user_id = b.user_id and m.account_id = b.account_id
    where b.user_id = ${userId} and b.account_id in ${tx(ids)}`;
  for (const r of rows) {
    const running = r.reconcile_offset !== null;
    const started = r.reconcile_started_at;
    if (running && Number(r.failures) >= RECONCILE_MAX_FAILURES) {
      await giveUp(tx, userId, r.account_id, t, 'failures');
      await tx`update sync_read_marks set reconcile_failures = 0 where user_id = ${userId} and account_id = ${r.account_id}`;
      continue; // the week is read instead
    }
    const restart = running && started !== null && ((r.consent !== null && r.consent > started) || r.claimed_at > started);
    if (restart) out.set(r.account_id, { offset: 0, start: true });
    else if (running) { if (r.gap_ok) out.set(r.account_id, { offset: r.reconcile_offset!, start: false }); }
    else if (r.due) out.set(r.account_id, { offset: 0, start: true });
  }
  return out;
}

/** Ends a pass: the next one is due a period later; the listed ids are dropped. */
async function endPass(tx: TransactionSql, userId: number, accountId: string, t: Frag) {
  await tx`update broker_accounts set reconcile_offset = null, reconcile_due_at = ${t} + ${ms(RECONCILE_EVERY_MS)}, reconcile_tail = null,
    reconcile_seen = null, reconcile_pages = 0, reconcile_valid = true where user_id = ${userId} and account_id = ${accountId}`;
}
/** A pass that ends without deciding (or is abandoned): counted per account and logged (internal id and reason only). */
async function giveUp(tx: TransactionSql, userId: number, accountId: string, t: Frag, reason: 'shifted' | 'missing' | 'bound' | 'failures') {
  await endPass(tx, userId, accountId, t);
  await tx`update broker_accounts set reconcile_invalid = reconcile_invalid + 1 where user_id = ${userId} and account_id = ${accountId}`;
  const id = userId;
  console.log('sync reconcile invalid', id, JSON.stringify({ reason }));
}

/** A whole-history read made another way (a first sync with nothing stored, the option backfill's last page) restarts
 *  the period, so a pass does not follow it within days. */
export async function restartPeriod(tx: TransactionSql, userId: number, ids: string[], t: Frag) {
  if (!ids.length) return;
  await tx`update broker_accounts set reconcile_due_at = ${t} + ${ms(RECONCILE_EVERY_MS)} where user_id = ${userId} and account_id in ${tx(ids)} and reconcile_offset is null`;
}

export type PageResult = { complete: boolean; onePage: boolean; decided: { genuine: number; suspected: number } | null };
type PassRow = { reconcile_tail: string[] | null; reconcile_seen: string[] | null; reconcile_pages: number; reconcile_expect: number;
  reconcile_valid: boolean; reconcile_missing: string[] | null; reconcile_started_at: Date };

/** Records one page of a pass (after its rows were inserted). `listed` are the page's vendor ids (activities and unusable
 *  trade rows). Returns whether the pass ended with this page and whether it was a one-page pass (page 0 `done`: the
 *  whole history in one call, a superset of the week read). */
export async function recordPage(tx: TransactionSql, userId: number, accountId: string, plan: PassPlan, limit: number, listed: string[], done: boolean, t: Frag): Promise<PageResult> {
  const stamp = sql`clock_timestamp() + (${t} - now())`; // after the vendor call, on the (shifted) database clock
  if (plan.start) {
    const [{ n }] = await tx`select count(*)::int as n from activities where user_id = ${userId} and account_id = ${accountId} and source = 'snaptrade'
      and raw->>'type' in ${tx(LISTABLE_TYPES)}`;
    // The pass's start is the transaction's start: rows this page just inserted are not "stored before the pass".
    await tx`update broker_accounts set reconcile_offset = 0, reconcile_started_at = now(), reconcile_pages = 0, reconcile_expect = ${n},
      reconcile_tail = null, reconcile_seen = null, reconcile_valid = true where user_id = ${userId} and account_id = ${accountId}`;
  }
  const [p] = await tx<PassRow[]>`select reconcile_tail, reconcile_seen, reconcile_pages, reconcile_expect, reconcile_valid, reconcile_missing, reconcile_started_at
    from broker_accounts where user_id = ${userId} and account_id = ${accountId}`;
  let valid = p.reconcile_valid;
  if (!plan.start && p.reconcile_tail?.length) {
    const here = new Set(listed);
    if (!p.reconcile_tail.every((id) => here.has(id))) valid = false; // the list shifted under the offsets
  }
  const pages = p.reconcile_pages + 1;
  const step = Math.max(1, limit - RECONCILE_OVERLAP);
  const bound = Math.ceil(p.reconcile_expect / step) + 2;
  const seen = plan.start ? [...new Set(listed)] : [...new Set([...(p.reconcile_seen ?? []), ...listed])];
  // Any read that lists both rows of a pair shows the pair is genuine (whatever the pass's validity).
  const early = await markGenuine(tx, userId, seen, accountId);
  if (!done && pages > bound) {
    await giveUp(tx, userId, accountId, t, 'bound');
    return { complete: false, onePage: false, decided: null };
  }
  if (!done) {
    await tx`update broker_accounts set reconcile_offset = ${plan.offset + step}, reconcile_page_at = ${stamp}, reconcile_pages = ${pages},
      reconcile_tail = ${listed.slice(-RECONCILE_OVERLAP)}, reconcile_seen = ${seen}, reconcile_valid = ${valid}
      where user_id = ${userId} and account_id = ${accountId}`;
    return { complete: false, onePage: false, decided: null };
  }
  // The pass ended. Complete: no overlap break, and every listable row stored before the pass began was listed, except
  // the originals of held rows (what is being tested). A shortfall made only of ids the previous pass also missed (a
  // stored row the vendor no longer lists: a cancel or correction, owner Q3) decides too, so an account is never
  // undecided forever because of one cancel.
  const missing = (await tx`select a.external_id from activities a where a.user_id = ${userId} and a.account_id = ${accountId} and a.source = 'snaptrade'
      and a.raw->>'type' in ${tx(LISTABLE_TYPES)} and a.created_at < ${p.reconcile_started_at}
      and not (a.external_id = any(${seen}::text[]))
      and not exists (select 1 from activity_reissues r where r.user_id = ${userId} and r.original_id = a.external_id and r.state <> 'genuine')
    order by a.external_id`).map((r) => r.external_id as string);
  const prev = new Set(p.reconcile_missing ?? []);
  const decides = valid && (missing.length === 0 || missing.every((id) => prev.has(id)));
  await tx`update broker_accounts set reconcile_missing = ${valid && missing.length ? missing : null}, reconcile_page_at = ${stamp}
    where user_id = ${userId} and account_id = ${accountId}`;
  if (!decides) {
    await giveUp(tx, userId, accountId, t, valid ? 'missing' : 'shifted');
    return { complete: true, onePage: plan.start, decided: null };
  }
  const decided = await decidePass(tx, userId, accountId, seen);
  decided.genuine += early;
  await endPass(tx, userId, accountId, t);
  await tx`update broker_accounts set reconcile_invalid = 0 where user_id = ${userId} and account_id = ${accountId}`;
  return { complete: true, onePage: plan.start, decided };
}

/** A complete pass decides the account's held rows: original listed → genuine, else suspected. */
async function decidePass(tx: TransactionSql, userId: number, accountId: string, seen: string[]) {
  const genuine = await markGenuine(tx, userId, seen, accountId);
  const s = await tx`update activity_reissues set state = 'suspected', decided_at = now()
    where user_id = ${userId} and account_id = ${accountId} and state = 'pending' and not (original_id = any(${seen}::text[]))`;
  return { genuine, suspected: s.count };
}

/** Rows of a pair both listed by one read are genuine. `minAt`: only rows dated on or after it (a week read decides only
 *  inside its window, a day clear of its time-zone boundary). */
export async function markGenuine(tx: TransactionSql, userId: number, listed: string[], accountId?: string, minAt?: Date): Promise<number> {
  if (!listed.length) return 0;
  const r = await tx`update activity_reissues r set state = 'genuine', decided_at = now()
    where r.user_id = ${userId} and r.state <> 'genuine' ${accountId ? tx`and r.account_id = ${accountId}` : tx``}
      and r.external_id = any(${listed}::text[]) and r.original_id = any(${listed}::text[])
      ${minAt ? tx`and exists (select 1 from activities a where a.source = r.source and a.external_id = r.external_id and a.executed_at >= ${minAt})` : tx``}`;
  return r.count;
}

/** After this transaction's inserts: every newly stored activity row with a twin stored before this transaction (same
 *  account, symbol, side, time, units and price; another vendor id) is a possible re-issue, held `pending` until a read
 *  lists both or a complete pass decides it. Rows that arrive together were listed by the same read, so they are never
 *  each other's re-issue (two genuine identical fills are never held). Returns how many were found. */
export async function markTwins(tx: TransactionSql, userId: number): Promise<number> {
  const rows = await tx`insert into activity_reissues (user_id, source, external_id, account_id, original_id, state, decided_at)
    select distinct on (n.source, n.external_id) n.user_id, n.source, n.external_id, n.account_id, e.external_id,
      'pending', null
    from activities n join activities e on e.user_id = n.user_id and e.source = n.source and e.account_id = n.account_id and e.symbol = n.symbol
      and e.side = n.side and e.executed_at = n.executed_at and e.units = n.units and e.price = n.price and e.created_at < now()
    where n.user_id = ${userId} and n.source = 'snaptrade' and n.created_at = now()
      and n.raw->>'type' in ${tx(LISTABLE_TYPES)} and e.raw->>'type' in ${tx(LISTABLE_TYPES)}
    order by n.source, n.external_id, e.id
    on conflict (source, external_id) do nothing
    returning 1`;
  return rows.length;
}

/** A pending row a week read could not decide brings its account's next pass forward (unless one is running). */
export async function bringForward(tx: TransactionSql, userId: number, t: Frag) {
  await tx`update broker_accounts b set reconcile_due_at = ${t} where b.user_id = ${userId} and b.reconcile_offset is null
    and (b.reconcile_due_at is null or b.reconcile_due_at > ${t})
    and exists (select 1 from activity_reissues r where r.user_id = ${userId} and r.account_id = b.account_id and r.state = 'pending')`;
}

/** Retention: an account no longer read (frozen, simulated, unconsented) drops its running pass's listed ids. */
export async function dropUnread(tx: TransactionSql, userId: number, real: string[]) {
  await tx`update broker_accounts set reconcile_offset = null, reconcile_tail = null, reconcile_seen = null, reconcile_pages = 0, reconcile_valid = true
    where user_id = ${userId} and (reconcile_offset is not null or reconcile_seen is not null or reconcile_tail is not null)
      and account_id not in ${tx(real.length ? real : [''])}`;
}

/** Owner counts for the per-sync log line. */
export async function reissueCounts(tx: TransactionSql, userId: number): Promise<{ pending: number; suspected: number }> {
  const [r] = await tx`select count(*) filter (where state = 'pending')::int as pending, count(*) filter (where state = 'suspected')::int as suspected
    from activity_reissues where user_id = ${userId}`;
  return { pending: r.pending as number, suspected: r.suspected as number };
}

/** A failure of a pass page step that counts toward giving the pass up: not a vendor outage, rate limit, timeout or a
 *  cut at the route's end (those say nothing about the page); a refusal, a bad answer or a row that throws does. */
export function pageFailureCounts(e: unknown): boolean {
  const x = e as { name?: unknown; status?: unknown; response?: { status?: unknown }; code?: unknown } | null;
  const status = Number(x?.status ?? x?.response?.status);
  if (status === 429 || status >= 500) return false;
  if (x?.name === 'RouteDeadlineError' || x?.name === 'VendorTimeoutError' || x?.name === 'AxiosError') return false;
  if (typeof x?.code === 'string' && /^(E[A-Z]+|57P0\d|08\d{3}|53\d{3})$/.test(x.code)) return false; // transport and database-wide
  return true;
}

/** After the transaction, like F-14's marks: a page step that failed (pageFailureCounts) counts one failure for its
 *  account; a sync that committed clears the planned accounts' counts. Never fatal (the caller catches). */
export async function writeReconcileFailures(userId: number, ids: string[], failed: boolean) {
  if (!ids.length) return;
  for (const id of ids) {
    await sql`insert into sync_read_marks (user_id, account_id, reconcile_failures) values (${userId}, ${id}, ${failed ? 1 : 0})
      on conflict (user_id, account_id) do update set reconcile_failures = ${failed ? sql`sync_read_marks.reconcile_failures + 1` : 0}`;
  }
}
