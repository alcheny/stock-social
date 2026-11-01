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
import { DB_WIDE, TRANSPORT_CODES } from './sync-limits.ts';
import { optionActivityCount } from './options-sync.ts';

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
// ponytail: a k-page history takes about 2k days per pass (≈ 20 days at 10 pages), so a late row deep in a long history
// waits up to that plus the period — fix: the vendor's written answer on history pages (MR-1) would let pages run apart
// from the daily activities read.
// Each later page starts this many rows back and must list the previous page's last ids again (a vendor list that
// shifted between pages, days apart, would otherwise skip a row and make it look absent).
export const RECONCILE_OVERLAP = 50;
// A pass needs pages longer than the overlap (each page must move the cursor forward): lib/sync.ts plans none otherwise.
export const passPageLimitOk = (limit: number) => limit > RECONCILE_OVERLAP;
// Failed syncs in a row that were to read a page: then the pass is given up and the week read instead.
export const RECONCILE_MAX_FAILURES = 2;
// Rows the activities read lists (share moves such as REI come from another read and are never in its listing).
export const LISTABLE_TYPES = ['BUY', 'SELL'];

const ms = (n: number) => sql`${n}::float8 * interval '1 millisecond'`;

// Two activity rows are twins: same user, source, account, symbol, side, time, units and price; another vendor id; both
// from the activities read. `x` and `y` are row aliases.
const twin = (db: Db, x: string, y: string) => db.unsafe(`${y}.user_id = ${x}.user_id and ${y}.source = ${x}.source and ${y}.account_id = ${x}.account_id
  and ${y}.symbol = ${x}.symbol and ${y}.side = ${x}.side and ${y}.executed_at = ${x}.executed_at and ${y}.units = ${x}.units and ${y}.price = ${x}.price
  and ${y}.external_id <> ${x}.external_id and ${y}.raw->>'type' in ('BUY', 'SELL')`);
// A row held as a possible re-issue (not genuine) never counts as another row's original.
const held = (db: Db, alias: string) => db.unsafe(`exists (select 1 from activity_reissues h where h.source = ${alias}.source and h.external_id = ${alias}.external_id and h.state <> 'genuine')`);

/** The rebuild's filter (rows aliased `a`): a possible re-issue that no read has shown to be genuine is held. */
export const notReissued = (db: Db) => db`not exists (select 1 from activity_reissues r where r.source = a.source and r.external_id = a.external_id and r.state <> 'genuine')`;

export type PassPlan = { offset: number; start: boolean };
type Cursor = { account_id: string; reconcile_offset: number | null; reconcile_started_at: Date | null; consent: Date | null; claimed_at: Date;
  failures: number; gap_ok: boolean; due: boolean };

// The account's own weekday (0-6 from a hash of its id; `%` keeps the sign in Postgres, hence the + 7).
const weekday = (accountId: Frag) => sql`((hashtext(${accountId}) % 7) + 7) % 7`;
/** The first due date of an account that has none: the next occurrence of its weekday (on the database clock), never
 *  before a period after its claim (a just-connected account has just read its whole history). */
// Days count from the epoch in UTC, so the weekday and the day start agree whatever the session's time zone.
const firstDue = (t: Frag) => {
  const from = sql`greatest(b.claimed_at + ${ms(RECONCILE_EVERY_MS)}, ${t})`;
  // The first day start at or after `from` (ceiling: a floor could land up to a day before the claim's period ended).
  const day = sql`ceil(extract(epoch from ${from}) / 86400)::bigint`;
  return sql`to_timestamp(${day} * 86400) + mod(${weekday(sql`b.account_id`)} - mod(${day}, 7) + 7, 7) * interval '1 day'`;
};

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
    // A first page that keeps failing rolls its own start back (the offset stays null), so a due account counts too.
    if ((running || r.due) && Number(r.failures) >= RECONCILE_MAX_FAILURES) {
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
export async function recordPage(tx: TransactionSql, userId: number, accountId: string, plan: PassPlan, limit: number, listed: string[], all: string[], done: boolean, t: Frag): Promise<PageResult> {
  const stamp = sql`clock_timestamp() + (${t} - now())`; // after the vendor call, on the (shifted) database clock
  if (plan.start) {
    // The page bound's base: every stored row the read can return (share rows, unusable trade rows and option rows).
    const [{ n: shares }] = await tx`select (select count(*) from activities where user_id = ${userId} and account_id = ${accountId} and source = 'snaptrade'
        and raw->>'type' in ${tx(LISTABLE_TYPES)}) + (select count(*) from corporate_actions where user_id = ${userId} and account_id = ${accountId}
        and source = 'snaptrade' and kind = 'unpriceable' and detail->>'reason' = 'trade')::int as n`;
    const n = Number(shares) + await optionActivityCount(tx, userId, accountId);
    // The pass's start is the transaction's start: rows this page just inserted are not "stored before the pass".
    await tx`update broker_accounts set reconcile_offset = 0, reconcile_started_at = now(), reconcile_pages = 0, reconcile_expect = ${n},
      reconcile_tail = null, reconcile_seen = null, reconcile_valid = true where user_id = ${userId} and account_id = ${accountId}`;
  }
  const [p] = await tx<PassRow[]>`select reconcile_tail, reconcile_seen, reconcile_pages, reconcile_expect, reconcile_valid, reconcile_missing, reconcile_started_at
    from broker_accounts where user_id = ${userId} and account_id = ${accountId}`;
  let valid = p.reconcile_valid;
  if (!plan.start && p.reconcile_tail) {
    // The page starts RECONCILE_OVERLAP vendor rows before the previous one ended, so exactly that many of its ids were on
    // the previous page; more or fewer means the list shifted under the offsets (a row inserted or removed before the
    // cursor) and a row may have been skipped. Every vendor row counts here (share, unusable and option rows): the order
    // across the three lists is not kept, so the check is on the count, not the positions. A row with no id makes the
    // count short: invalid, the safe side.
    // ponytail: a vendor row with an id but no symbol is dropped by lib/broker.ts#toActivities and is in no list, so in
    // the overlap it makes every multi-page pass of that account end 'shifted' (its held rows stay held, counted by
    // reconcile_invalid) — fix: count the page's raw vendor ids, which needs fetchActivitiesPage (lib/broker.ts, owner).
    const prevIds = new Set(p.reconcile_tail);
    const overlap = new Set(all.filter((id) => prevIds.has(id))).size;
    if (overlap !== RECONCILE_OVERLAP) valid = false;
  }
  const pages = p.reconcile_pages + 1;
  const step = Math.max(1, limit - RECONCILE_OVERLAP);
  const bound = Math.ceil(p.reconcile_expect / step) + 2;
  const seen = plan.start ? [...new Set(listed)] : [...new Set([...(p.reconcile_seen ?? []), ...listed])];
  // A pair is genuine only when ONE vendor response lists both rows: this page alone, never the pass's union of pages
  // (pages are days apart, so the union can hold an original from before its re-issue and the re-issue from after;
  // orchestrator review of #84). Twins sorted by trade date are neighbours, and the 50-row overlap puts any two
  // neighbours on one page, so genuine twins are still found; twins further apart stay held (the safe side). `seen`
  // serves only the completeness check below.
  const early = await markGenuine(tx, userId, listed, accountId);
  if (!done && pages > bound) {
    await giveUp(tx, userId, accountId, t, 'bound');
    return { complete: false, onePage: false, decided: null };
  }
  if (!done) {
    await tx`update broker_accounts set reconcile_offset = ${plan.offset + step}, reconcile_page_at = ${stamp}, reconcile_pages = ${pages},
      reconcile_tail = ${[...new Set(all)]}, reconcile_seen = ${seen}, reconcile_valid = ${valid}
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
      and not ${held(tx, 'a')}
      and not exists (select 1 from activity_reissues r join activities n on n.source = r.source and n.external_id = r.external_id
        where r.user_id = ${userId} and r.state <> 'genuine' and ${twin(tx, 'n', 'a')})
    order by a.external_id`).map((r) => r.external_id as string);
  const prev = new Set(p.reconcile_missing ?? []);
  const decides = valid && (missing.length === 0 || missing.every((id) => prev.has(id)));
  await tx`update broker_accounts set reconcile_missing = ${valid && missing.length ? missing : null}, reconcile_page_at = ${stamp}
    where user_id = ${userId} and account_id = ${accountId}`;
  if (!decides) {
    await giveUp(tx, userId, accountId, t, valid ? 'missing' : 'shifted');
    return { complete: true, onePage: plan.start, decided: null };
  }
  const decided = await decidePass(tx, userId, accountId);
  decided.genuine += early;
  await endPass(tx, userId, accountId, t);
  await tx`update broker_accounts set reconcile_invalid = 0 where user_id = ${userId} and account_id = ${accountId}`;
  return { complete: true, onePage: plan.start, decided };
}

/** A complete pass decides the account's held rows: those its pages did not clear (markGenuine, one page at a time) are
 *  suspected. */
async function decidePass(tx: TransactionSql, userId: number, accountId: string) {
  // What a complete pass leaves pending is suspected: no single page listed it with every unheld twin (a twin missing,
  // listed only on another page, or the held row itself no longer listed; QA D2: never left pending forever).
  const s = await tx`update activity_reissues set state = 'suspected', decided_at = now()
    where user_id = ${userId} and account_id = ${accountId} and state = 'pending'`;
  return { genuine: 0, suspected: s.count };
}

/** A held row is genuine when one read listed it and every other row of its twin group that is not itself held: the
 *  vendor shows as many fills as are kept (QA D1: with two genuine identical fills stored, a re-issue of one of them is
 *  not cleared by the other being listed). `minAt`: only rows dated on or after it (a week read decides only inside its
 *  window, a day clear of its time-zone boundary). */
// ponytail: genuine is final, so an original the vendor later stops listing (a cancel or correction) keeps both rows
// published — fix: the owner's answer on vendor corrections (C3-9b, cycle-3 Q3).
export async function markGenuine(tx: TransactionSql, userId: number, listed: string[], accountId?: string, minAt?: Date): Promise<number> {
  if (!listed.length) return 0;
  const r = await tx`update activity_reissues r set state = 'genuine', decided_at = now()
    from activities n
    where r.user_id = ${userId} and r.state <> 'genuine' ${accountId ? tx`and r.account_id = ${accountId}` : tx``}
      and n.source = r.source and n.external_id = r.external_id and r.external_id = any(${listed}::text[])
      ${minAt ? tx`and n.executed_at >= ${minAt}` : tx``}
      and not exists (select 1 from activities e where e.user_id = ${userId} and ${twin(tx, 'n', 'e')} and not ${held(tx, 'e')}
        and not (e.external_id = any(${listed}::text[])))`;
  return r.count;
}

/** After this transaction's inserts: every newly stored activity row with a twin stored before this transaction (same
 *  account, symbol, side, time, units and price; another vendor id) is a possible re-issue, held `pending` until a read
 *  lists both or a complete pass decides it. Rows that arrive together were listed by the same read, so they are never
 *  each other's re-issue (two genuine identical fills are never held). Returns how many were found. */
// ponytail: twins stored before F-24 are never swept (both stay published as they were) — fix: a one-off owner-run check
// over stored twin groups, deciding each with a complete pass.
export async function markTwins(tx: TransactionSql, userId: number): Promise<number> {
  // The new rows are read first (materialized), so each twin lookup goes through activities_user_pair whatever the
  // table's statistics (QA D5: before an analyze the planner chose a scan over every pair of rows).
  const rows = await tx`with n as materialized (select * from activities where user_id = ${userId} and source = 'snaptrade' and created_at = now()
      and raw->>'type' in ${tx(LISTABLE_TYPES)})
    insert into activity_reissues (user_id, source, external_id, account_id, original_id, state, decided_at)
    select distinct on (n.source, n.external_id) n.user_id, n.source, n.external_id, n.account_id, e.external_id, 'pending', null
    from n join lateral (select e.external_id, e.id from activities e where e.user_id = n.user_id and e.account_id = n.account_id and e.symbol = n.symbol
        and e.executed_at = n.executed_at and ${twin(tx, 'n', 'e')} and e.created_at < now() and not ${held(tx, 'e')}
      order by e.id limit 1) e on true
    order by n.source, n.external_id, e.id
    on conflict (source, external_id) do nothing
    returning 1`;
  return rows.length;
}

/** A pending row found by this transaction's (week) read brings its account's next pass forward, unless a pass is
 *  running or ran this sync (`except`): an ended or given-up pass waits its period. */
export async function bringForward(tx: TransactionSql, userId: number, t: Frag, except: string[] = []) {
  await tx`update broker_accounts b set reconcile_due_at = ${t} where b.user_id = ${userId} and b.reconcile_offset is null
    and (b.reconcile_due_at is null or b.reconcile_due_at > ${t}) ${except.length ? tx`and b.account_id not in ${tx(except)}` : tx``}
    and exists (select 1 from activity_reissues r where r.user_id = ${userId} and r.account_id = b.account_id and r.state = 'pending' and r.found_at = now())`;
}

/** Retention: an account no longer read (frozen, simulated, unconsented) drops its running pass's listed ids. */
// ponytail: a trader whose every connection is frozen is never synced (lib/sync.ts#syncable), so a pass left running there
// keeps its listed ids (vendor ids `activities` already holds) — fix: clear them in the freeze step (F3-3).
export async function dropUnread(tx: TransactionSql, userId: number, real: string[]) {
  await tx`update broker_accounts set reconcile_offset = null, reconcile_tail = null, reconcile_seen = null, reconcile_missing = null, reconcile_pages = 0, reconcile_valid = true
    where user_id = ${userId} and (reconcile_offset is not null or reconcile_seen is not null or reconcile_tail is not null or reconcile_missing is not null)
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
  // The transport and database-wide codes lib/sync-limits.ts#classify treats as outages, plus the database's
  // serialization, deadlock and connection-state codes and the driver's own connection errors.
  if (typeof x?.code === 'string' && (TRANSPORT_CODES.has(x.code) || DB_WIDE.test(x.code) || /^(40001|40P01)$|^CONNECT(ION)?_|^UND_ERR_|^ERR_(NETWORK|SOCKET)/.test(x.code))) return false;
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
