import type { PendingQuery, Row, TransactionSql } from 'postgres';
import { sql } from './db.ts';
import { recordStates, type RecordStatus } from './connections.ts';
import { statusRowsOrEmpty, withStates } from './record-status-load.ts'; // FIXES-LABELS: status
import type { StatusFacts } from './record-status.ts'; // FIXES-LABELS: status
import { feedReadySql, filerVisibleSql } from './public-gate.ts';
import { groupByUser } from './pane.ts';
import { confidence, evidenceWeight, rankTraders, type ConfidenceInput } from './trades.ts';
import { discounted, mixFeed } from './discovery/explore.ts';
import { CURSOR_MAX_AGE_MS, encodeCursor, pageOf, readCursor, type Cursor } from './discovery/pager.ts';
import { displayFilter, shapeList, splitExclusions } from './discovery/exclusions.ts';
import { exclusionsFor, followingAmong, sectionSkips } from './follows.ts';
import { rejectedAmong } from './likes.ts';
// F-10: the feed card's record strip figures (lib/record-strip.ts), computed per page from the rows already read.
import { feedStrips, type StripFigures } from './record-strip.ts';
import { capped, chooseRows, median, reasonFor, SECTION_AT, SECTION_NEAR, SECTION_SPARES, sectionCandidates, sectionPool, type Reason, type SectionTrader, type TraderFacts } from './discovery/section.ts';
import { optionHeadline, paneView, type PaneOptionsView } from './options-load.ts'; // OPTIONS

// F-2 PR-5: personal ordering (pure) and the loader type; the loader itself is passed in by the page (lib/discovery/personal-load.ts).
import { personalList, personalPool, personalReason, relevanceOf, type PersonalReason, type TraderShape, type Uses } from './discovery/personal.ts';
import type { Personal, PersonalLoader } from './discovery/personal-load.ts';
import { personalSlots } from './discovery/personal-cache.ts';
import { logSafe } from './privacy-log.ts';

// Feed ranking (DESIGN §2.6): size of move × recency. |return| means losses rank as high as equal gains.
// score = ln(1 + |r|·100) · exp(-max(0, min(age_hours / RECENCY_HOURS, MAX_DECAY)))
// F-1 PR-3 fix round 4 (business lead blocker): unclamped, exp(-age/48) underflows past ~35,800 hours (4.08 years) and
// the database raises "value out of range: underflow" for the whole feed. The exponent is clamped at MAX_DECAY:
// e^-600 ≈ 2.7e-261 stays a normal double, and so does its product with the smallest non-zero size term
// (ln(1 + 2.2e-16) ≈ 2.2e-16). Closes younger than MAX_DECAY × RECENCY_HOURS (3.3 years) score exactly as before; older
// ones share the floor and keep their order by size of move. Ties break on (closed_at, id), newest first (a future
// closed_at reads as now, fix round 6).
// F-1 PR-3 fix round 6 (engineer re-sit, Medium): the age is clamped below at 0 as well. A close dated in the future
// (the vendor's trade date is not checked by the database) had a negative age, so exp() grew: a close a day ahead
// outranked every real close and one ~3.9 years ahead overflowed the double ("value out of range: overflow", the whole
// feed failed). Clamped, a future date scores exactly like a close at this instant, never above, and its tie-break
// reads it as this instant too (it never wins a tie by its future date). The rebuild also
// quarantines activities dated more than a day ahead (lib/sync.ts#FUTURE_GRACE_HOURS), so such closes should not exist.
export const RECENCY_HOURS = 48;
export const MAX_DECAY = 600;
// ponytail: a day's list holds at most FEED_LIST_MAX (350) cards: the 200 candidates (at most FEED_PER_TRADER = 6 closes
// of one trader, so ≥ 34 traders) plus EXPLORE_EXTRA (150) picks, one per trader, so with E eligible traders outside the
// 200 each shows on a given day with probability 150 / E (E = 5,000: 3%), and the feed ends after card 350 — whether to
// scale EXPLORE_EXTRA with E (a longer list, a new order) or keep the end card is the owner's product call (open question,
// known-limits sweep 2); nothing here changes until then.
export const FEED_CANDIDATES = 200;
// F-2 PR-1b: eligible traders outside the candidates read for exploration and the section, one card each (their best
// recent close), at most EXPLORE_EXTRA a day in a day-seeded order; the cursor admits offsets up to FEED_LIST_MAX.
export const EXPLORE_EXTRA = 150;
export const FEED_LIST_MAX = FEED_CANDIDATES + EXPLORE_EXTRA;
// F-2 PR-1 fix round 1 (business lead blocker 2): at most this many of one trader's closes among the candidates. Six is
// the most the caps let one trader show on a 30-card page (2 per 10), so nothing a page could show is lost; the other
// closes stay on the profile (TR-1: nothing is hidden there).
export const FEED_PER_TRADER = 6;
// Fix round 1 (load check): the candidates are read from the closes of this window first (an index range on
// closed_at); the full pass runs only when that can't be proven to give the same 200 (see feedCandidates).
export const RECENT_HOURS = 14 * 24;
// The largest size term a finite double allows: ln(1 + |r|·100) ≤ ln(1 + Number.MAX_VALUE) ≈ 709.78.
const SIZE_MAX = Math.log1p(Number.MAX_VALUE);

export type FeedCandidate = {
  id: number; sell_id: string; symbol: string; return_pct: number; holding_days: number; closed_at: Date; verified: boolean;
  thesis: string | null; thesis_status: string | null; handle: string; display_name: string; user_id: number; score: number;
  thesis_written_at?: Date | null; thesis_edited_at?: Date | null; // F-9: the shown card's note dates (UserNote)
  // F-26: set by the page-row statement only on the signed-in viewer's own close with a held note (else false/null).
  own_held?: boolean; own_hold_rule?: string | null;
};

// F-2 PR-1 fix round 2 (tester High A): "this close's sell was imported after asOf". Was `sell_id not in (select
// external_id from late)` over a CTE: a hashed subplan only while the planner expects the late set to fit in work_mem.
// Above that (~120,000 activities imported since a cursor's asOf) Postgres rescanned the whole set for every candidate
// row: 129 s to over 180 s a page. A plain anti-join (`not exists`) is no fix on its own: right after a burst of imports,
// before autovacuum analyzes them, the planner expects 1 late row and runs the anti-join as a nested loop over the late
// scan, rescanned per row, whenever the outer side is small (measured: a short recent window, a few traders). So the
// late filter must not depend on the planner's estimate, nor on a cached plan (a prepared statement's generic plan can
// be built while `activities` is small and kept after it grows, until autovacuum analyzes it):
// - `activities` is read once per candidate statement, in `late` (the late sells as one array, an index range on
//   created_at or one scan), never per row: a per-row probe of its unique index, or a max(created_at) probe, became a
//   scan per row under a stale or cached plan (73 to 75 s a page);
// - every filter is `not in` over that array, unnested. The planner always estimates an unnested non-constant array at
//   10 rows, so it is always a hashed subplan, never rescanned (the 5-close count builds the hash once and keeps it).
//   Memory grows with the late set (~75,000 sells is a few MB). Fix round 3 (tester Medium E): never a bound array
//   either (a constant to a custom plan: above hash_mem, rescanned per row); a weight miss reads lateArray itself.
// Only a sell can be a close's sell_id (closed_trades.sell_id is the closing sell's external_id), so only sells count.
// F-2 PR-1 review (tester Low G): `a` and `o` are two `array(select …)` InitPlans, not one `array_agg … filter` aggregate:
// with fresh statistics Postgres runs that aggregate in parallel and merging the workers' partial arrays cost 2× (600,000
// late sells: 750–940 ms against 400–510 ms for both scans, reviewer's run).
// Known limit removed 2026-11-01 (docs/features/logs/known-limits/committee-2026-11-01.md, item 3): the array above was
// linear in the sells imported since asOf, so a page with no kept list (a crafted `?after=` up to 48 hours old) cost
// ~1 ms per 1,000 of them (600,000: 72 → 641 ms with the weights kept, lib/feed.crafted.load.test.ts). Each close now
// carries its sell's import time (closed_trades.sell_imported_at, set by a trigger on insert, db/schema.sql), so "imported
// after asOf" is a test on the close itself: no statement reads `activities`, and the work is the closes the page ranks
// anyway, whatever was imported since. The same closes are left out as before (the trigger's match is the old filter's:
// the sell's activity by vendor id, any source); null (no sell activity, or imported more than 49 hours before the
// column existed) reads as imported before asOf, as a missing activity did.
// ponytail: the time is read once, when the close is inserted (db/schema.sql closed_trades_sell_imported_at), so a SELL
// with the same vendor id from the other source imported later does not make it late (the old filter did); not
// reachable while demo ids carry their own prefix — if demo ids ever share a namespace with real ones, set
// sell_imported_at in lib/sync.ts#rebuildTrades (the derived table's one writer), never from the import path.
const importedBy = (col: ReturnType<typeof sql>, asOf: Date) => sql`(${col} is null or ${col} <= ${asOf})`;
// ---- F-7 (plan Round 5 item 7): the 30-day feed floor on every feed-side read of closed_trades (candidates, both
// eligibility branches, the weight and its fingerprint, exploration, the section pool), pinned to asOf when there is one
// so a close crossing its floor between two pages never shifts a list; filers pass the switch / hide gate in `elig`.
const ready = (t: string, asOf?: Date) => (asOf ? sql`(${sql(`${t}.feed_after`)} is null or ${sql(`${t}.feed_after`)} <= ${asOf})` : feedReadySql(t));

// `ids` is a test hook (rank only these traders); the feed passes none.
// F-2 PR-1: `asOf` freezes the ranking clock for a feed session (lib/discovery/pager.ts): the score's age, the
// eligibility count and the candidate set read only closes at or before it, so a page built later slices the same list.
// Without it the clock is now() and nothing is filtered (today's behavior). A close dated in the future therefore
// enters a paged feed when its date arrives (the rebuild quarantines anything more than a day ahead).
// Ties break on the close's vendor id (unique, kept across rebuilds), not the row id (which a rebuild renumbers).
// F-2 PR-1 fix round 1 (tester Medium 2): with `asOf`, the list is pinned to what existed at asOf, not only to what was
// dated by then:
// - a close whose sell activity was imported after asOf (the hourly sync's normal case: dated before, imported after)
//   counts nowhere, for the score, the eligibility count or the weights;
// - a trader deleted after asOf, or whose import started after asOf, keeps their place in the list (the page leaves a
//   gap: loadFeedPage); a trader whose import was still running at asOf stays out even once it finishes.
// At most FEED_PER_TRADER closes per trader (fix round 1, business lead blocker 2).
export async function feedCandidates(opts: { ids?: number[]; asOf?: Date } = {}): Promise<FeedCandidate[]> {
  return (await candidatesAt(opts)).map(({ pn: _n, pm: _m, pk: _k, x: _x, ...t }) => t);
}

// Fix round 2: with asOf, each row also carries its trader's weight fingerprint (pn, pm, pk: see weights()), read in
// the same statement, once per list, not once per query.
// F-2 PR-1b: with `day`, the same statement also returns rows with x = true: the best close of each eligible trader
// outside the candidates (at most EXPLORE_EXTRA, in a day-seeded order), for exploration and the section only.
type Candidate = FeedCandidate & { pn?: number; pm?: string; pk?: number; x?: boolean };
type CandOpts = { ids?: number[]; asOf?: Date; day?: string };
async function candidatesAt(opts: CandOpts): Promise<Candidate[]> { return (await candidateRows(opts)).rows; }
// Test hook: the candidate rows (exploration picks and weight fingerprints included) and the window that answered them
// (hours; null = the full pass), or the full pass itself with `force = 'full'`.
export async function candidateRows(opts: CandOpts, force?: 'full'): Promise<{ rows: Candidate[]; window: number | null }> {
  if (force === 'full') return { rows: await candidateQuery(sql, opts, null), window: null };
  // The recent window first. Exact when it fills the 200 and its 200th score S is above anything an older close can
  // score: a close older than the window scores at most SIZE_MAX · e^(−RECENT_HOURS/RECENCY_HOURS) (≈ 0.65), so with
  // S above that, every close scoring ≥ S is in the window and the per-trader ranks of those closes are the same.
  const proven = (rows: Candidate[], win: number) => {
    const top = rows.filter((t) => !t.x);
    return top.length === FEED_CANDIDATES && Number(top[top.length - 1].score) > SIZE_MAX * Math.exp(-win / RECENCY_HOURS);
  };
  // A wider window can only answer differently when it holds more closes, so before each step one index probe reads the
  // newest close at or before the last window's start (any import state, so "none" is exact): none means that window
  // already held every close and its answer is the full pass's (the 14-day statement's picks included: c, elig and r are
  // the full pass's; only the fingerprint prefix differs); a step whose window adds no close is skipped.
  const RR = 'isolation level repeatable read read only';
  const clock = (opts.asOf ?? new Date()).getTime();
  const first = await sql.begin(RR, async (tx) => {
    const recent = await candidateQuery(tx, opts, RECENT_HOURS);
    if (proven(recent, RECENT_HOURS)) return { rows: recent, old: null, top: recent };
    const old = await olderThan(tx, opts, RECENT_HOURS);
    return { rows: old ? null : recent, old, top: recent };
  });
  if (first.rows) return { rows: first.rows, window: RECENT_HOURS };
  let old = first.old, last = first.top;
  // Known limit removed (known-limits sweep 2): on a quiet site (the 200th close must be about 2.6 days old or newer for
  // the 14-day proof) every new list ranked every close in closed_trades. Wider windows are tried first, with the same
  // proof (MAX_DECAY = 600 is above 365 d / 48 h = 182.5, so an older close scores at most SIZE_MAX · e^(−W/48): 6.6e−11
  // at 60 days, ~1e−77 at 365): the 200 and their order are the full pass's. A step reads the 200 alone; only a step
  // that proves them reads its picks (pickQuery, the full pass's rule), in the same snapshot (one repeatable-read
  // transaction), so a failed step costs its window's closes and one probe. Quiet-site fixture (200,500 closes, none in
  // 14 days, lib/feed.window.load.test.ts): candidates 768–1,616 ms (full pass) → 160–300 ms (60-day step).
  for (const win of WIDE_WINDOWS) {
    if (!old) break;
    // A window that adds no close holds the last one's closes, so the same 200: skipped unless they prove at this
    // window's lower bound (code review S5: then the step runs and answers, picks included).
    if (old.getTime() <= clock - win * 3_600_000 && !proven(last, win)) continue;
    const step: { rows: Candidate[] | null; old: Date | null; top: Candidate[] } = await sql.begin(RR, async (tx) => {
      const top = await candidateQuery(tx, { ids: opts.ids, asOf: opts.asOf }, win);
      if (!proven(top, win)) return { rows: null, old: await olderThan(tx, opts, win), top };
      return { rows: opts.day ? [...top, ...await pickQuery(tx, opts, top.map((t) => t.user_id))] : top, old: null, top };
    });
    if (step.rows) return { rows: step.rows, window: win };
    old = step.old; last = step.top;
  }
  // ponytail: when not even 365 days prove the 200 (fewer than 200 capped closes of eligible traders in a year, with
  // closes older than the last window tried), this still ranks every close in closed_trades per (day, asOf) and per
  // server, after the failed steps' window reads — keep a per-trader best-close summary refreshed on sync if a large table
  // ever lands here.
  return { rows: await candidateQuery(sql, opts, null), window: null };
}
// The newest close at or before a window's start (the `ids` hook applied), any import state: one backward probe of
// closed_trades_recent.
async function olderThan(q: Q, { ids, asOf }: CandOpts, win: number): Promise<Date | null> {
  const clock = asOf ? sql`${asOf}::timestamptz` : sql`now()`;
  const [r] = await q`select max(closed_at) as m from closed_trades where closed_at <= ${clock} - ${win} * interval '1 hour'
    ${ids ? sql`and user_id in ${sql(ids.length ? ids : [0])}` : sql``}`;
  return (r?.m as Date | null) ?? null;
}
// The windows tried after RECENT_HOURS (hours).
const WIDE_WINDOWS = [60 * 24, 365 * 24];

type Q = TransactionSql<{}> | typeof sql; // the pool or one transaction
type Frag = PendingQuery<Row[]>;
const scoreAt = (clock: Frag) =>
  sql`ln(1 + abs(t.return_pct) * 100) * exp(-greatest(0::float8, least(date_part('epoch', ${clock} - t.closed_at) / 3600 / ${RECENCY_HOURS}::float8, ${MAX_DECAY}::float8)))`;
const aliveAt = (asOf?: Date) => asOf ? sql`(u.deleted_at is null or u.deleted_at > ${asOf})` : sql`u.deleted_at is null`;
const importingAt = (asOf?: Date) => asOf
  ? sql`k.consent_at <= ${asOf} and (k.state = 'importing' or (k.state = 'connected' and k.connected_at > ${asOf}) or (k.state = 'failed' and k.failed_at > ${asOf}))`
  : sql`k.state = 'importing'`;

async function candidateQuery(q: Q, { ids, asOf, day }: CandOpts, win: number | null): Promise<Candidate[]> {
  const clock = asOf ? sql`${asOf}::timestamptz` : sql`now()`;
  // date_part is double precision (extract() is numeric since PostgreSQL 14: the same value, several times slower per
  // row; F-2 PR-1 load check).
  const score = scoreAt(clock);
  const order = sql`score desc, least(closed_at, ${clock}) desc, sell_id desc`;
  const lo = sql`${clock} - ${win ?? RECENT_HOURS} * interval '1 hour'`;
  const recentOnly = win !== null;
  // The fingerprint names c's window ('c' 14 days, 'w<hours>' a wider step, 'f' the full pass): keys of different windows never meet.
  const prefix = win === null ? 'f' : win === RECENT_HOURS ? 'c' : `w${win}`;
  return (await q`
    with c as materialized (
      -- F-26: a note that is not published is null here (shared by every viewer: no hold field).
      select t.id, t.sell_id, t.symbol, t.return_pct, t.holding_days, t.closed_at, t.verified, case when t.thesis_status = 'published' then t.thesis end as thesis, case when t.thesis_status = 'published' then t.thesis_status end as thesis_status, t.user_id, ${score} as score
      from closed_trades t
      where ${ready('t', asOf)} ${recentOnly ? sql`and t.closed_at > ${lo}` : sql``}
        ${asOf ? sql`and t.closed_at <= ${asOf} and ${importedBy(sql`t.sell_imported_at`, asOf)}` : sql``}
        ${ids ? sql`and t.user_id in ${sql(ids.length ? ids : [0])}` : sql``}
    ), elig as materialized (
      -- ≥ 5 closes at asOf (c's own count first, fix round 3), not deleted (by asOf), no import running (at asOf). F-1 fix
      -- round 3 (TR-3): a record with an import still running is not in the feed until it is whole.
      select d.user_id, d.n from (select user_id, count(*) as n from c group by user_id) d join users u on u.id = d.user_id
      where ${aliveAt(asOf)} and ${filerVisibleSql('u')}
        and (d.n >= 5 or (select count(*) from (select 1 from closed_trades x where x.user_id = d.user_id and ${ready('x', asOf)}
             ${asOf ? sql`and x.closed_at <= ${asOf} and ${importedBy(sql`x.sell_imported_at`, asOf)}` : sql``} limit 5) five) = 5)
        and not exists (select 1 from connections k where k.user_id = d.user_id and k.consent_at is not null and ${importingAt(asOf)})
    ), r as (
      select c.*, row_number() over (partition by c.user_id order by c.score desc, least(c.closed_at, ${clock}) desc, c.sell_id desc) as rk
      from c join elig using (user_id)
    ), top as (
      select * from r where rk <= ${FEED_PER_TRADER} order by ${order} limit ${FEED_CANDIDATES}
    ), src as (
      select top.*, false as x from top${day ? sql` union all (select r.*, true from r where rk = 1 and user_id not in (select user_id from top)
        order by md5(${day} || user_id::text) limit ${EXPLORE_EXTRA})` : sql``}
    )${asOf ? sql`, pr as materialized (
      -- The weight fingerprint (fix round 2; PR-1b fix round 1, tester Medium 1: from c alone, for every listed trader;
      -- counting the 200's whole records was ~45 ms of the statement on the 50-heavy fixture). A rebuild renumbers every
      -- row of a trader and a new close adds one, so the newest id in c changes with either (a listed trader always has a
      -- close in c); pn and pk change when a close enters or leaves c; ol counts the trader's closes older than c's window
      -- whose sells were imported after asOf (sell_imported_at), so a close imported after asOf and dated before the window changes the key once it
      -- counts. Same rows and the same closes counted at asOf: the same weight.
      select c.user_id, count(*)::int as pn, ${prefix} || max(c.id)::text || ':' || coalesce(max(ol.n), 0)::text as pm, max(e.n)::int as pk
      from c join elig e using (user_id) left join (${recentOnly ? sql`select y.user_id, count(*) as n from closed_trades y
        where y.user_id in (select user_id from src) and y.sell_imported_at > ${asOf} and y.closed_at <= ${lo} and ${ready('y', asOf)} group by y.user_id`
        : sql`select 0 as user_id, 0 as n where false`}) ol using (user_id)
      where c.user_id in (select user_id from src) group by c.user_id
    )` : sql``}
    select top.id, top.sell_id, top.symbol, top.return_pct, top.holding_days, top.closed_at, top.verified, top.thesis, top.thesis_status,
           top.user_id, top.score, top.x, u.handle, u.display_name ${asOf ? sql`, pr.pn, pr.pm, pr.pk` : sql``}
    from src top join users u on u.id = top.user_id ${asOf ? sql`left join pr on pr.user_id = top.user_id` : sql``}
    order by top.x, top.score desc, least(top.closed_at, ${clock}) desc, top.sell_id desc`) as unknown as Candidate[];
}

// A wider step's exploration picks (x rows). Not the window's: the 14-day path's picks come from traders with a close in
// its window (e2e "Exploration slots"), the full pass's from every eligible trader, and a wider step stands in for the
// full pass, so its picks follow the full pass's rule exactly: users in the day-seeded order md5(day || id), each probed
// for eligibility at asOf (at most 5 closes read by closed_trades_user; the deletion and import predicates of `elig`),
// the first EXPLORE_EXTRA outside the 200 taken, then each pick's best close in r's order (rk = 1) and, from the same
// read of its record, the full pass's weight fingerprint ('f' || max id || ':0', pn = pk = its closes at asOf). Rows
// come in the full pass's order for x rows. Cost: an md5 sort of the users plus one probe per user walked, and one read
// of each pick's record; never a scan of closed_trades.
// ponytail: the picks walk users in md5 order, so a site with many signed-up users without a record probes each one it
// passes (all of them when fewer than EXPLORE_EXTRA traders are eligible: ~60,000 probes, ~300 ms on the shared test
// database) — keep an eligible-trader list refreshed on sync.
async function pickQuery(q: Q, { ids, asOf, day }: CandOpts, top: number[]): Promise<Candidate[]> {
  const clock = asOf ? sql`${asOf}::timestamptz` : sql`now()`;
  // A close counted at asOf by the full pass: past its F-7 feed floor (ready), dated by asOf and imported by then.
  const counted = (a: string) => asOf
    ? sql`and ${ready(a, asOf)} and ${sql(`${a}.closed_at`)} <= ${asOf} and ${importedBy(sql`${sql(`${a}.sell_imported_at`)}`, asOf)}`
    : sql`and ${ready(a)}`;
  return (await q`
    with pick as materialized (
      -- offset 0 keeps the probes after the md5 sort, so the walk stops at the EXPLORE_EXTRA-th eligible trader.
      select s.id as user_id from (select u.id from users u where ${aliveAt(asOf)} and ${filerVisibleSql('u')} ${ids ? sql`and u.id in ${sql(ids.length ? ids : [0])}` : sql``}
        order by md5(${day!} || u.id::text) offset 0) s
      where s.id <> all(${top}::int[])
        and (select count(*) from (select 1 from closed_trades x where x.user_id = s.id ${counted('x')} limit 5) five) = 5
        and not exists (select 1 from connections k where k.user_id = s.id and k.consent_at is not null and ${importingAt(asOf)})
      limit ${EXPLORE_EXTRA}
    ), xa as (
      select b.* from pick p cross join lateral (
        -- F-26: a note that is not published is null here too (shared by every viewer: no hold field).
        select t.id, t.sell_id, t.symbol, t.return_pct, t.holding_days, t.closed_at, t.verified, case when t.thesis_status = 'published' then t.thesis end as thesis, case when t.thesis_status = 'published' then t.thesis_status end as thesis_status, t.user_id, ${scoreAt(clock)} as score,
               count(*) over () as n, max(t.id) over () as m
        from closed_trades t where t.user_id = p.user_id ${counted('t')}
        order by score desc, least(t.closed_at, ${clock}) desc, t.sell_id desc limit 1) b
    )
    select xa.id, xa.sell_id, xa.symbol, xa.return_pct, xa.holding_days, xa.closed_at, xa.verified, xa.thesis, xa.thesis_status,
           xa.user_id, xa.score, true as x, u.handle, u.display_name ${asOf ? sql`, xa.n::int as pn, ${'f'} || xa.m::text || ':' || 0::text as pm, xa.n::int as pk` : sql``}
    from xa join users u on u.id = xa.user_id
    order by xa.score desc, least(xa.closed_at, ${clock}) desc, xa.sell_id desc`) as unknown as Candidate[];
}

// ---- F-2 PR-1: feed mix and paging ----
// The feed is one list per (UTC day, asOf): candidates at asOf → TR-9 ranking (lower bound, losses weigh like gains)
// → diversity caps and seeded exploration (lib/discovery/explore.ts). Pages are 30-card slices of it. The same list
// for every viewer, signed in or out; nothing here reads a session or a viewer table (lib/feed.signed-out.test.ts).
export type FeedItem = FeedCandidate & { explore: boolean };
export type PaneRow = { userId: number; id: string; symbol: string; returnPct: number; holdingDays: number; closedAt: Date; verified: boolean; thesis: string | null;
  openedAt: Date }; // F-10: the entry time, so the strip's bets (K) are the profile's (lib/record-strip.db.test.ts)

// Every page trader's full current record, for the pane's chart and stats.
// Fix round 1 (load check, tester Medium 3): one JSON text per trader instead of one row per close. A page of heavy
// traders is ~50,000 closes; the database reads them in ~30 ms, but parsing them as rows took ~200 ms in the client.
// Values are exact: a float8's text is its shortest round-trip form, and times travel as epoch milliseconds as before.
// PR-1b fix round 1 (tester Medium 1): read in two halves side by side (two connections): a page with ~20 heavy records
// spent ~70 ms in one aggregate on one core.
export async function records(userIds: number[]): Promise<PaneRow[]> {
  if (userIds.length > 8) return (await Promise.all([0, 1].map((h) => records1(userIds.filter((_, i) => i % 2 === h))))).flat();
  return records1(userIds);
}
// ponytail: a page reads its traders' whole records (~50,000 closes for heavy ones), so its cost grows with record size,
// not with its 30 cards (measured: 30 traders, 12,000 closes, 25–34 ms, lib/feed.window.load.test.ts). It cannot be cut
// to what the pane lists: the pane's stats, every chart range (compounded over every close), its worst trade and the
// card strip read the whole record — keep a downsampled series and those figures per trader, written by
// lib/sync.ts#rebuildTrades (schema), and read those.
async function records1(userIds: number[]): Promise<PaneRow[]> {
  if (!userIds.length) return [];
  const rows = await sql`
    select user_id, '[' || string_agg(concat_ws(',', id, to_json(symbol)::text, return_pct, holding_days, verified::int,
      date_part('epoch', closed_at) * 1000, coalesce(to_json(case when thesis_status = 'published' then thesis end)::text, 'null'),
      date_part('epoch', opened_at) * 1000), ',' order by closed_at desc, id desc) || ']' as j
    from closed_trades where user_id = any(${userIds}) group by user_id`;
  // F-10: opened_at is the 8th field, and the rows come in the profile's list order (closed_at desc, id desc), so the
  // strip's average and range are summed in the profile's order: the same floats, not just the same text.
  // ponytail: every page trader's whole record now also ships opened_at (~15–30 ms more parse on a page of heavy records,
  // docs/features/logs/F-10/load-2026-11-01.md) — fix: send only the strip figures (n, k, avg, range) per trader, cached by
  // (rows, max id) like weightCache, once the pane no longer needs every row.
  const out: PaneRow[] = [];
  for (const r of rows) {
    const a = JSON.parse(r.j as string) as (string | number | null)[];
    for (let k = 0; k < a.length; k += 8) out.push({
      userId: r.user_id as number, id: String(a[k]), symbol: a[k + 1] as string, returnPct: a[k + 2] as number, holdingDays: a[k + 3] as number,
      verified: a[k + 4] === 1, closedAt: new Date(a[k + 5] as number), thesis: a[k + 6] as string | null,
      openedAt: new Date(a[k + 7] as number), // F-10
    });
  }
  return out;
}

// F-2 PR-1 fix round 1 (load check, tester Medium 3): a trader's TR-9 weight at asOf, kept in memory. The key is the
// trader's row count and largest row id (a rebuild renumbers every row; a new close adds one) plus the number of
// those rows counted at asOf. The counted rows are a subset that only grows with asOf, so the same row set and the same
// count are the same rows: the same weight. Only a trader whose record changed reads its record again.
// F-2 PR-3: with the weight, the facts the suggestions section reads at asOf (median holding days, closes counted).
const weightCache = new Map<string, TraderFacts>();
const WEIGHT_CACHE_MAX = 20_000;

// Fix round 2: the fingerprints (n, m, k per trader) come with the candidates, from the same statement (candidateQuery).
type Print = { n: number; m: string; k: number };
async function weights(prints: Map<number, Print>, asOf: Date): Promise<Map<number, TraderFacts>> {
  const out = new Map<number, TraderFacts>();
  const userIds = [...prints.keys()];
  if (!userIds.length) return out;
  const keys = new Map([...prints].map(([id, p]) => [id, `${id}:${p.n}:${p.m}:${p.k}`]));
  const miss: number[] = [];
  for (const id of userIds) {
    const w = weightCache.get(keys.get(id) ?? '');
    if (w === undefined) miss.push(id); else out.set(id, w);
  }
  if (miss.length) {
    // One JSON text per trader, as in records().
    const rows = await sql`
      select user_id, bool_and(verified) as v, '[' || string_agg(concat_ws(',', to_json(symbol)::text, return_pct, holding_days,
        date_part('epoch', opened_at) * 1000, date_part('epoch', closed_at) * 1000), ',') || ']' as j
      from closed_trades where user_id = any(${miss}) and closed_at <= ${asOf} and ${ready('closed_trades', asOf)}
        and ${importedBy(sql`sell_imported_at`, asOf)} group by user_id`;
    const byTrader = new Map<number, ConfidenceInput[]>(miss.map((id) => [id, []]));
    const verified = new Map(rows.map((r) => [r.user_id as number, r.v as boolean]));
    for (const r of rows) {
      const a = JSON.parse(r.j as string) as (string | number)[], ts = byTrader.get(r.user_id as number)!;
      for (let k = 0; k < a.length; k += 5) ts.push({
        symbol: a[k] as string, returnPct: a[k + 1] as number, holdingDays: a[k + 2] as number,
        openedAt: new Date(a[k + 3] as number), closedAt: new Date(a[k + 4] as number),
      });
    }
    for (const [id, ts] of byTrader) {
      const w: TraderFacts = { weight: ts.length ? evidenceWeight(confidence(ts, asOf)) : 0, hold: median(ts.map((t) => t.holdingDays)), n: ts.length, verified: verified.get(id) ?? false };
      out.set(id, w);
      const key = keys.get(id);
      if (!key) continue;
      if (weightCache.size >= WEIGHT_CACHE_MAX) weightCache.delete(weightCache.keys().next().value!);
      weightCache.set(key, w);
    }
  }
  return out;
}

// `ranked`: the list before the mix (F-2 PR-2: a viewer's exclusions are taken out of it, then it is mixed again).
// `pool`: F-2 PR-3, the section's traders, ordered by the TR-9 lower bound (lib/discovery/section.ts#sectionPool).
export async function feedList(opts: { asOf: Date; day: string; ids?: number[] }): Promise<{ list: FeedItem[]; ranked: FeedCandidate[]; pool: SectionTrader[]; extra: FeedCandidate[] }> {
  const all = await candidatesAt({ asOf: opts.asOf, ids: opts.ids, day: opts.day });
  const candidates = all.filter((t) => !t.x), extra = all.filter((t) => t.x);
  const prints = new Map<number, Print>();
  for (const t of candidates) prints.set(t.user_id, { n: t.pn!, m: t.pm!, k: t.pk! });
  // Rank by the pace-interval lower bound (TR-9): small lucky samples can't top the feed. Losses weigh like gains.
  // Read at asOf: a close after it, or imported after it, changes no weight.
  for (const t of extra) prints.set(t.user_id, { n: t.pn!, m: t.pm!, k: t.pk! });
  const weight = await weights(prints, opts.asOf);
  const ranked = discounted(rankTraders(candidates.map((t) => ({ t, score: Number(t.score), weight: weight.get(t.user_id)?.weight ?? 0 })))
    .map(({ t }) => ({ ...t, key: t.sell_id, trader: t.user_id })));
  const list: FeedItem[] = mixFeed(ranked, { day: opts.day, extra: extra.map((t) => ({ ...t, key: t.sell_id, trader: t.user_id })) })
    .map(({ card: { key: _k, trader: _t, pn: _n, pm: _m, pk: _p, x: _x, ...t }, explore }) => ({ ...t, explore }));
  const pool = sectionPool([...candidates, ...extra].map((t) => ({ trader: t.user_id, score: Number(t.score) })), weight);
  return { list, ranked: ranked.map(({ key: _k, trader: _t, pn: _n, pm: _m, pk: _p, x: _x, ...t }) => t), pool,
    // F-2 PR-5: the exploration-only closes, so a personal list mixes from the same pool as everyone's.
    extra: extra.map(({ pn: _n, pm: _m, pk: _p, x: _x, ...t }) => t) };
}

export type FeedPage = {
  cards: FeedItem[]; offset: number; asOf: Date; next: string | null;
  // The list positions this page covers (1-based, for the no-JS page's position heading).
  from: number; to: number;
  byUser: Map<number, PaneRow[]>; records: Map<number, RecordStatus>;
  // F-2 PR-2: signed in only, the viewer's follows among the page's traders. Never anyone else's.
  viewer: { id: number; following: Set<number> } | null;
  // F-2 PR-3: the suggestions section after the page's 5th card, or null (fewer than 3 rows). Its traders' records are in
  // byUser and records, for the pane each row opens.
  section: SectionRow[] | null;
  // F-2 PR-4: signed in, the page's cards this viewer liked (card ids), set by the page and the paging action
  // (lib/likes.ts); never read here, so loadFeedPage reads no like (lib/feed.signed-out.test.ts).
  liked?: Set<string>;
  // F-2 PR-5: signed in with personalization On and at least one choice counted: the order line and the personal
  // section heading show (app/feed-notes.tsx, app/suggest-section.tsx). Never anyone else's data.
  personal?: { signals: number; uses: Uses };
  // F-6: each page trader's open positions (unrealized percents, one per position), for a connected or failed record
  // only (never a record with no consented connection, TR-3 importing never reaches the page). Percent only.
  open?: Map<number, number[]>;
  // F-6: the oldest read of each of those traders' positions ("as of").
  openAsOf?: Map<number, Date>;
  // FIXES-LABELS: status (F-11): each page trader's status-line facts (lib/record-status.ts), with the page's states.
  status?: Map<number, StatusFacts>;
  // OPTIONS (docs/features/logs/options/plan.md AC 24): each page trader's option headline (the pane's label and line),
  // from the one reader, gated per trader.
  options?: Map<number, PaneOptionsView>;
  // F-10: each card trader's record strip figures (average per trade + the profile's evidence), from byUser.
  strips?: Map<number, StripFigures>;
};
// F-2 PR-5: `why`, the personal reason line when one is true (lib/discovery/personal.ts#personalReason).
export type SectionRow = { userId: number; handle: string; name: string; reason: Reason; why?: PersonalReason };

// F-2 PR-1 fix round 1: the list of each (day, asOf) is kept in memory for its cursor's lifetime, so a later page from
// the same server slices exactly the list page 1 showed (a trader removed meanwhile leaves a gap, never a shift). Only
// the order is kept (vendor id, trader, pick); each page reads its cards' current rows. On another server, or after a
// restart, the list is recomputed from the database, pinned to asOf as feedCandidates describes.
// F-2 PR-2: a slot is a mix card (key = the close's vendor id, trader = its user id); the ranked list before the mix is
// kept too, for a viewer whose exclusions shape the list.
type Slot = { key: string; trader: number; symbol: string; explore: boolean; score: number };
type Kept = { asOf: number; mixed: Slot[]; ranked: Slot[]; pool: SectionTrader[]; extra?: Slot[] };
// ponytail: kept lists and weights are per process, so every server (and every restart) builds them again: on the
// 50-heavy fixture a cold page 1 is 597 ms against a 334 ms p95 with weights kept, and a later page whose list this
// server never built re-ranks (page 2: 55–78 ms median with weights kept, 146–175 ms cold, lib/feed.crafted.load.test.ts)
// — keep the built list per (day, asOf, ids) in a shared table (slots jsonb, deleted past CURSOR_MAX_AGE_MS, a
// lib/privacy-retention.ts SCHEMA_MAP entry) once there is more than one server.
const lists = new Map<string, Kept>();
const LIST_CACHE_MAX = 256;
// Tests: forget every kept list and weight (a cold server), or only the lists (fix round 2: a page whose list this
// server never built, such as a crafted `?after=`, on a server whose weights are warm).
export function clearFeedCache(what: 'all' | 'lists' = 'all') { lists.clear(); if (what === 'all') weightCache.clear(); }

async function listFor(c: Cursor, now: number, ids?: number[]): Promise<Kept> {
  const key = `${c.day}|${c.asOf}|${ids ? ids.join(',') : '*'}`;
  const kept = lists.get(key);
  if (kept) return kept;
  const { list, ranked, pool, extra } = await feedList({ asOf: new Date(c.asOf), day: c.day, ids });
  const slot = (t: FeedCandidate, explore: boolean): Slot => ({ key: t.sell_id, trader: t.user_id, symbol: t.symbol, explore, score: Number(t.score) });
  for (const [k, v] of lists) if (v.asOf < now - CURSOR_MAX_AGE_MS || lists.size >= LIST_CACHE_MAX) lists.delete(k);
  const out = { asOf: c.asOf, mixed: list.map((t) => slot(t, t.explore)), ranked: ranked.map((t) => slot(t, false)), pool, extra: extra.map((t) => slot(t, true)) };
  lists.set(key, out);
  return out;
}

// One page of the feed for a `?after=` value (or the paging action's cursor). Anything invalid is page 1.
// F-2 PR-2: `viewer` (lib/viewer.ts, signed in only): that viewer's exclusions shape the list (made by asOf) or filter
// the page in place (made since), lib/discovery/exclusions.ts; never on a profile (TR-1).
// F-2 PR-5: `personal` (signed in only, from lib/discovery/personal-load.ts#personalFor): the viewer's own profile at asOf
// orders the list (lib/discovery/personal.ts); "Personalize my feed" Off gives the order everyone gets minus the viewer's
// own hides; a loader that fails gives the impersonal page. Without it nothing personal is read here.
export async function loadFeedPage(after: unknown, opts: { now?: number; ids?: number[]; viewer?: number; personal?: PersonalLoader } = {}): Promise<FeedPage> {
  const now = opts.now ?? Date.now();
  const c = readCursor(after, now, FEED_LIST_MAX);
  const [kept, mine, skips0, personal] = await Promise.all([listFor(c, now, opts.ids), opts.viewer ? exclusionsFor(opts.viewer, new Date(Math.min(c.asOf, now))) : [],
    opts.viewer ? sectionSkips(opts.viewer) : [],
    // ponytail: the profile is read on every page (settings, then follows, likes, rejects, exclusions and events side by
    // side, then the liked traders' handles: up to 3 round trips, 2.1 ms median and 6.0 ms p95 locally, a viewer with
    // the default settings) even when the kept personal list is reused; it is not unused then: it orders the section's
    // pool (personalPool), writes its reasons (personalReason) and the order line (page.personal) — skipping it pins those to page 1's profile (a behavior change: an unlike would no longer show in
    // the section) and the kept copy must go with forgetViewer, so it belongs in lib/discovery/personal-cache.ts.
    opts.viewer && opts.personal ? opts.personal(new Date(c.asOf)).catch((e: unknown): Personal | null => { console.error('personal ordering failed', logSafe(e)); return null; }) : null]);
  const { shaping, hidden } = splitExclusions(mine, c.asOf, now);
  // F-2 PR-5 (orchestrator review 4): the section leaves out followed traders in every mode (its Follow button reads
  // "not following"); Off changes the order only.
  const skips = skips0;
  const profile = personal?.personalize && personal.profile.signals > 0 ? personal.profile : null;
  const shapes = profile ? traderShapes(kept) : null;
  const rel = profile ? relevanceOf(profile, shapes!) : null;
  // Review fix 1: a shaped list mixes from the same exploration pool as everyone's (`extra`), minus the hidden traders.
  const extra = (kept.extra ?? []).filter((s) => !shaping.has(s.trader));
  const build = () => rel ? personalList(kept.ranked.filter((s) => !shaping.has(s.trader)), rel, c.day, extra).map(({ card, explore }) => ({ ...card, explore }))
    : kept.ranked.some((s) => shaping.has(s.trader)) ? shapeList(kept.ranked, shaping, c.day, extra).map(({ card, explore }) => ({ ...card, explore })) : kept.mixed;
  // Review fix 2: with a personal loader, the list page 1 built is kept per viewer and cursor, whatever the profile says
  // on a later page (an unlike, "Clear my activity" or a switch turned Off never shifts the pages of a running session).
  const slots = opts.viewer && opts.personal ? personalSlots(opts.viewer, `${c.day}|${c.asOf}|${opts.ids ? opts.ids.join(',') : '*'}|${[...shaping].sort().join(',')}`, now, CURSOR_MAX_AGE_MS, build) : build();
  const sliced = pageOf(slots, c);
  const page = { ...sliced, items: displayFilter(sliced.items, hidden) };
  // The page's cards as they are now (a thesis held since page 1 is not shown; a corrected return shows corrected). A
  // card whose trader was deleted since asOf, or whose close is gone, is a gap. The three reads run side by side.
  const traders = [...new Set(page.items.map((s) => s.trader))];
  // F-2 PR-3: the section's candidates (the same for every viewer; signed in, minus the viewer, follows and exclusions).
  // The first 3 records are read with the page's; the spares only when a row turns out importing or deleted.
  // Nothing is read for it when the candidates cannot make 3 rows even before that check (it only removes candidates).
  // Fix round 1: the spares are chosen from every candidate under the bucket cap (tester Medium 1: a fixed slice of 8
  // sharing one holding period made no section), and the 10 cards around it are the displayed ones (tester Low 1).
  const cands = capped(sectionCandidates(rel ? personalPool(kept.pool, rel) : kept.pool, slots, c.offset, new Set(opts.viewer ? [opts.viewer, ...skips] : []), page.items), SECTION_SPARES);
  const candIds = cands.map((t) => t.trader);
  const likely = (chooseRows(cands) ?? []).map((t) => t.trader);
  const withSection = page.items.length >= SECTION_AT && likely.length > 0;
  // F-2 PR-4: signed in, the page's closes this viewer rejected (for good, O3) leave the page as a gap, in place.
  const own = opts.viewer ?? 0; // F-26: the author check for the held line (no user has id 0)
  // FIXES-LABELS: status (F-11): the status facts for the record-state id set, one query, side by side with the reads below.
  // FIXES-LABELS (code review): a failed status read leaves the line out (an empty map), never the feed.
  const statusP = statusRowsOrEmpty(withSection ? [...new Set([...traders, ...candIds])] : traders);
  const [rows, states, panes, following, people, rejected, opens] = await Promise.all([
    page.items.length ? sql`
      select t.id, t.sell_id, t.symbol, t.return_pct, t.holding_days, t.closed_at, t.verified, case when t.thesis_status = 'published' then t.thesis end as thesis, case when t.thesis_status = 'published' then t.thesis_status end as thesis_status, t.user_id, u.handle, u.display_name,
        case when t.thesis_status = 'published' then t.thesis_written_at end as thesis_written_at, case when t.thesis_status = 'published' then t.thesis_edited_at end as thesis_edited_at,
        -- F-26: the hold (flag and rule) only on the signed-in viewer's own closes; one statement text for every viewer
        -- and every note state (0 matches no user when signed out).
        (t.user_id = ${own} and t.thesis_status = 'held' and t.thesis <> '') as own_held,
        case when t.user_id = ${own} and t.thesis_status = 'held' and t.thesis <> '' then t.thesis_hold_rule end as own_hold_rule
      from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null and ${filerVisibleSql('u')}
      where t.sell_id = any(${page.items.map((s) => s.key)})` : [],
    // Fix round 4 (TR-3): a failed import stays in the feed (never hidden) but its card and pane say it may be
    // incomplete. Fix round 1: a trader whose import started after asOf is left out until it is whole (a gap).
    recordStates(withSection ? [...new Set([...traders, ...candIds])] : traders),
    records(withSection ? [...new Set([...traders, ...likely])] : traders),
    opts.viewer ? followingAmong(opts.viewer, traders) : null,
    withSection ? sql`select id, handle, display_name from users where id = any(${candIds}) and deleted_at is null and ${filerVisibleSql('users')}` : [],
    opts.viewer ? rejectedAmong(opts.viewer, page.items.map((s) => s.key)) : null,
    // F-6: the same trader set as the record states (it holds every section trader the page can pick).
    openPositions(withSection ? [...new Set([...traders, ...candIds])] : traders),
  ]);
  const bySell = new Map(rows.map((r) => [r.sell_id as string, r]));
  const cards: FeedItem[] = page.items.flatMap((s) => {
    const r = bySell.get(s.key);
    if (!r || r.user_id !== s.trader || states.get(s.trader)?.state === 'importing' || rejected?.has(s.key)) return [];
    return [{ ...(r as unknown as FeedCandidate), score: s.score, explore: s.explore }];
  });
  const who = new Map(people.map((u) => [u.id as number, u]));
  const near = new Set(cards.slice(0, SECTION_NEAR).map((t) => t.user_id)); // a card dropped as a gap moves the next one in
  const picked = withSection && cards.length >= SECTION_AT ? chooseRows(cands.filter((t) => who.has(t.trader) && !near.has(t.trader) && states.get(t.trader)?.state !== 'importing')) : null;
  const missing = (picked ?? []).map((t) => t.trader).filter((id) => !likely.includes(id) && !traders.includes(id));
  if (missing.length) panes.push(...await records(missing));
  const section = picked && picked.map((t): SectionRow => {
    const u = who.get(t.trader)!;
    const why = profile && personal?.personalize ? personalReason(t.trader, profile, shapes!, personal.handles) : null;
    return { userId: t.trader, handle: u.handle as string, name: u.display_name as string, reason: reasonFor(t), ...(why ? { why } : {}) };
  });
  const onPage = new Set([...cards.map((t) => t.user_id), ...(picked ?? []).map((t) => t.trader)]);
  const byUser = groupByUser(panes.filter((r) => onPage.has(r.userId)));
  const status = withStates(new Map([...(await statusP)].filter(([id]) => onPage.has(id))), states); // FIXES-LABELS: status
  return {
    cards, offset: c.offset, asOf: new Date(c.asOf), next: page.next && encodeCursor(page.next),
    from: c.offset + 1, to: c.offset + sliced.items.length, byUser, records: new Map([...states].filter(([id]) => onPage.has(id))),
    viewer: following && { id: opts.viewer!, following }, section,
    ...(profile ? { personal: { signals: profile.signals, uses: profile.uses } } : {}),
    ...openOf(opens, onPage, states),
    status, // FIXES-LABELS: status
    options: new Map([...await optionHeadline([...onPage])].map(([id, h]) => [id, paneView(h)])), // OPTIONS: flag and line only
    strips: feedStrips(new Map([...byUser].filter(([id]) => cards.some((t) => t.user_id === id))), new Date(now)), // F-10
  };
}

// F-2 PR-5 (engineer demand 2): a viewer's personal list is kept per viewer and cursor in lib/discovery/personal-cache.ts.
export { clearPersonalCache } from './discovery/personal-cache.ts';

// F-2 PR-5: what personal ordering knows of each listed trader: the holding period read at asOf (the section's pool) and
// the symbols of their closes in the list. Read from the kept list only: no query.
// ponytail: a trader's symbols are only those of their closes in the kept list (≤ FEED_PER_TRADER for the 200, 1 for a
// pick), not their whole record — a per-trader symbol summary refreshed on sync would widen the similarity, which
// changes relevanceOf and so the personal order: a product change, not a fix.
function traderShapes(kept: Kept): Map<number, TraderShape> {
  const out = new Map<number, { hold?: number; symbols: Set<string> }>();
  const get = (t: number) => { let s = out.get(t); if (!s) out.set(t, (s = { symbols: new Set() })); return s; };
  for (const s of kept.mixed) get(s.trader).symbols.add(s.symbol);
  for (const s of kept.ranked) get(s.trader).symbols.add(s.symbol);
  for (const t of kept.pool) get(t.trader).hold = t.hold;
  return out;
}

// F-6: open positions (unrealized percent only) per trader, kept for page traders whose record is connected or failed.
type OpenRow = { user_id: number; unrealized_pct: number; fetched_at: Date };
async function openPositions(userIds: number[]): Promise<OpenRow[]> {
  if (!userIds.length) return [];
  return (await sql`select user_id, unrealized_pct, fetched_at from open_positions where user_id = any(${userIds})`) as unknown as OpenRow[];
}
function openOf(rows: OpenRow[], onPage: Set<number>, states: Map<number, RecordStatus>): { open: Map<number, number[]>; openAsOf: Map<number, Date> } {
  const open = new Map<number, number[]>(), openAsOf = new Map<number, Date>();
  for (const r of rows) {
    const state = states.get(r.user_id)?.state;
    if (!onPage.has(r.user_id) || (state !== 'connected' && state !== 'failed')) continue;
    const a = open.get(r.user_id);
    if (a) a.push(r.unrealized_pct); else open.set(r.user_id, [r.unrealized_pct]);
    const d = openAsOf.get(r.user_id);
    if (!d || r.fetched_at < d) openAsOf.set(r.user_id, r.fetched_at);
  }
  return { open, openAsOf };
}
