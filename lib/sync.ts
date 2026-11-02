import { sql } from './db.ts';
import type { TransactionSql } from 'postgres';
import { fetchActivities, fetchActivitiesPage, fetchPositions, fetchShareMoves, listAccounts, PAGE_LIMIT, VENDOR_TIMEOUT_MS } from './broker.ts';
import { AccountClaimedError, claimIn } from './claims.ts';
import { notShared } from './shared-accounts.ts';
import { reattachTheses, type KeptThesis } from './theses.ts';
import { matchTrades, type Activity } from './trades.ts';
import { actionIndex, chainsOf, insertCorporateActions, loadCorporateActions, pairKey } from './corporate-actions.ts';
import { firstByKey, moveUnlistedPositions, replaceListedPositions, settleAccountPositions } from './positions.ts';
import { decide, dueSql, writeMarks, type DueFlags } from './sync-cadence.ts';
import { logSafe } from './privacy-log.ts';
// F-24 late-posted trades (docs/features/F-24-late-sell-reconciliation.md): the pass cursor, the re-issue states and the
// rebuild's hold filter.
import { bringForward, dropUnread, markGenuine, markTwins, notDuplicate, heldRow, pageFailureCounts, passPageLimitOk, plannedConfirm, endConfirm, writeConfirmFailures, plannedPages, recordPage, reissueCounts, restartPeriod, writeReconcileFailures, type PassPlan } from './reconcile.ts';
import { IDLE_DAYS } from './record-status.ts'; // FIXES-LABELS: status
// OPTIONS (docs/features/logs/options/plan.md D1, D4, AC 11): option rows are stored beside the share rows, the record is
// rebuilt by rebuildRecord (rebuildTrades, unchanged, then the option steps) and the re-read window covers both tables.
import { insertOptionActivities, optionTwins, lastOptionActivityAt, markBackfilled, pendingBackfill, moveUnlistedOptionPositions, rebuildRecord, replaceAccountOptionPositions, saveBackfill } from './options-sync.ts';
import type { OptionRow } from './options.ts';
import type { PositionSplit } from './broker.ts';

// Re-read the last week before the newest stored activity, for rows the vendor posts late. Inserts are `on conflict do
// nothing`, so this adds new vendor ids only: a stored row the vendor changes later is never updated (C3-9, owner Q3).
const BACKFILL_MS = 7 * 86_400_000;
// Per-user advisory lock (F-1: a sync is one transaction; a second one for the same user waits or is skipped).
export const USER_LOCK = 1;
type Db = TransactionSql | typeof sql;

// PR-3 (heavy-use defect 1): one statement carries at most 65,534 parameters. An activity row binds 11 and a closed trade
// 11, so a whole history in one insert failed past ~5,950 rows (a 10,000-activity first sync; a record with more than
// ~5,950 closes). Every bulk insert is chunked at this many rows (11,000 parameters).
export const INSERT_CHUNK = 1000;
// PR-3 (heavy-use, memory): the rebuild reads activities a page at a time, never a whole history at once.
export const REBUILD_PAGE = 1000;
// F-1 PR-3 fix round 6 (engineer re-sit, Medium): the vendor's trade date reaches the database unchecked, and a trade
// dated in the future cannot be a closed trade. The raw row is kept (activities are immutable).
// F-35 (amends #62's 24-hour grace): a row is published once its date has passed, `published` = executed_at <= now(),
// the transaction's clock (the one rebuildRecord writes to users.published_through). Until then the rebuild never
// matches it, and it is counted in `users.excluded_future` (shown on the profile: PROFILE.futureWaiting). Every rebuild
// re-checks it, and the matured pass (lib/sync-shard.ts#maturePass) rebuilds the record on the first sync tick after the
// date, with no new activity needed. FUTURE_GRACE_HOURS (a day: time zones and a vendor posting the next session's
// date) now bounds only the re-read window: a row dated further ahead never sets it (a corrected date under the same
// vendor id is never stored: see BACKFILL_MS).
export const FUTURE_GRACE_HOURS = 24;
const notFuture = (db: Db) => db`executed_at <= now() + ${FUTURE_GRACE_HOURS}::float8 * interval '1 hour'`;
export const published = (db: Db) => db`executed_at <= now()`;
// Fixes cycle 3, F3-1: one vendor id stored both as an activity and as an unusable trade row (corporate_actions, reason
// 'trade'), e.g. first read with no price and re-read with one, counts once: the version stored first wins, so a sell is
// never priced and counted, and a published trade never disappears because a later read lost its price. The mirror rule
// is in lib/corporate-actions.ts#loadCorporateActions (ties go to the activity).
const storedFirst = (db: Db) => db`not exists (select 1 from corporate_actions c where c.source = a.source and c.external_id = a.external_id
  and c.kind = 'unpriceable' and c.detail->>'reason' = 'trade' and c.created_at < a.created_at)`;

export async function insertActivities(userId: number, source: 'snaptrade' | 'demo', acts: (Activity & { raw: unknown })[], db: Db = sql) {
  for (let i = 0; i < acts.length; i += INSERT_CHUNK) {
    const rows = acts.slice(i, i + INSERT_CHUNK).map((a) => ({
      user_id: userId, source, external_id: a.externalId, account_id: a.accountId, symbol: a.symbol,
      side: a.side, units: a.units, price: a.price, fee: a.fee, executed_at: a.executedAt, raw: db.json(a.raw as never),
    }));
    const stored = await db`insert into activities ${db(rows)} on conflict (source, external_id) do nothing returning executed_at > now() as ahead`;
    if (stored.some((r) => r.ahead)) await lowerWatermark(db, userId);
  }
}
// F-35 (engineer r1-2, r2-1): a row stored dated ahead lowers the record's watermark to this transaction's clock, so a
// transaction that started before a rebuild committed (an import step waiting on the lock) never stores a row the matured
// pass skips. A null watermark stays null (the deploy catch-up still selects the record).
export async function lowerWatermark(db: Db, userId: number) {
  await db`update users set published_through = now() where id = ${userId} and published_through > now()`;
}

// fix-user-text B (F-9): the thesis columns besides its text and status, copied as they are (never re-dated).
// A closed trade now binds 17 parameters, so INSERT_CHUNK rows stay far under the 65,534 limit.
const thesisMeta = (k: KeptThesis | undefined) => ({
  thesis_written_at: k?.thesis_written_at ?? null, thesis_edited_at: k?.thesis_edited_at ?? null,
  thesis_hold_rule: k?.thesis_hold_rule ?? null, thesis_reviewed_at: k?.thesis_reviewed_at ?? null,
  thesis_reports_from: k?.thesis_reports_from ?? null, thesis_checked_version: k?.thesis_checked_version ?? null, // fix round 5: rules version
});

// Recompute a user's closed trades from raw activities. Theses survive via sell_id. Runs in the caller's transaction
// when given one (an import step, a sync), else in its own.
// Reviewer fix (plan §4/§9): an account the vendor flags as simulated, even on a later sync after a real import, never
// feeds the record. Its raw activities stay (immutable), but the rebuild leaves them out, so its trades leave the
// Verified record while the profile counts the account as a simulated account excluded. A flag cleared again by the
// vendor brings them back on the next rebuild.
// PR-3 (heavy-use): FIFO lots never cross an (account, symbol) pair, so the rebuild streams the activities in that
// order, REBUILD_PAGE rows per query (keyset pages, no raw payload read), matches each pair as soon as it is complete
// and writes its closes in chunks. Memory holds one page plus the pair still open at the page's end, never the whole
// history. The order is total (account, symbol, time, then the vendor's id), so same-instant rows always match the same
// way and repeated rebuilds give byte-identical rows (defect 3: the read had no order at all). Returns what it wrote and
// the most activity rows it held at once.
type PairRow = { account_id: string; symbol: string; executed_at: Date; at: string; external_id: string; side: 'BUY' | 'SELL'; units: number; price: number; fee: number; source: string; held: boolean };
export async function rebuildTrades(userId: number, tx?: TransactionSql): Promise<{ trades: number; excluded: number; future: number; maxHeld: number; excludedCorporate: number }> {
  const run = async (tx: TransactionSql) => {
    // F-7: a public filer's trades come from its filings only (lib/public-trades.ts); this rebuild never touches them.
    if ((await tx`select 1 from users where id = ${userId} and public_filer_id is not null`).length) throw new Error('public filer: not a broker record');
    // Reviewer fix round 2: a rebuild never deletes a thesis. One whose trade is not produced now (its account is flagged
    // simulated, a vendor correction) is kept in kept_theses by sell_id, shown nowhere, and re-attached when the trade
    // returns. Kept rows come first, so a thesis on a current closed_trades row always wins its sell_id; saveThesis
    // removes the kept row when the trader edits or clears that thesis, so a cleared thesis never comes back.
    // fix-user-text B (F-9): the written and edited dates, the hold rule and the release time travel with the thesis.
    const aside = await tx`select sell_id, thesis, thesis_status, thesis_written_at, thesis_edited_at, thesis_hold_rule, thesis_reviewed_at, thesis_reports_from, thesis_checked_version from kept_theses where user_id = ${userId}`;
    // Fix round 1: every closed_trades row of this trader is locked before the theses are read, so a report hold, a
    // release or a thesis save running at the same time either finishes first (and is read here) or waits for this
    // rebuild (and then finds the rebuilt row). Without it a hold committed between this read and the delete below was
    // written back as published. One row comes back, whatever the count (memory stays one page).
    await tx`with l as (select 1 from closed_trades where user_id = ${userId} for update) select count(*) from l`;
    const live = await tx`select sell_id, thesis, thesis_status, thesis_written_at, thesis_edited_at, thesis_hold_rule, thesis_reviewed_at, thesis_reports_from, thesis_checked_version from closed_trades where user_id = ${userId} and thesis is not null`;
    const kept = [...aside, ...live] as unknown as KeptThesis[];
    const attachedIds = new Set<string>();
    await tx`delete from closed_trades where user_id = ${userId}`;
    let written = 0, excluded = 0, maxHeld = 0, excludedHeld = 0;
    // Corporate actions (POLICY F3c): the user's actions, read once. Pairs linked by a symbol change form a chain, skipped
    // by the stream below and matched together afterwards (one query per chain); account-wide actions reach every pair.
    const actions = await loadCorporateActions(tx, userId, published(tx));
    const chainOf = chainsOf(actions);
    const actionsOf = actionIndex(actions);
    let excludedCorporate = 0;
    const flushed = new Set<string>(); // pairs replayed with their actions
    const flush = async (rows: Activity[], keys?: Set<string>) => {
      if (!rows.length) return;
      for (const k of keys ?? [pairKey(rows[0].accountId, rows[0].symbol)]) flushed.add(k);
      const m = matchTrades(rows, actions.length ? actionsOf(keys ?? new Set([pairKey(rows[0].accountId, rows[0].symbol)])) : []);
      excluded += m.excluded;
      excludedHeld += m.excludedHeld ?? 0; // F-24 RT-2
      excludedCorporate += m.excludedCorporate;
      const { attached } = reattachTheses(kept, m.trades);
      for (let i = 0; i < m.trades.length; i += INSERT_CHUNK) {
        await tx`insert into closed_trades ${tx(m.trades.slice(i, i + INSERT_CHUNK).map((t) => {
          const k = attached.get(t.sellId);
          if (k) attachedIds.add(t.sellId);
          return {
            user_id: userId, sell_id: t.sellId, account_id: t.accountId, symbol: t.symbol, opened_at: t.openedAt,
            closed_at: t.closedAt, return_pct: t.returnPct, holding_days: t.holdingDays, verified: t.verified,
            thesis: k?.thesis ?? null, thesis_status: k?.thesis_status ?? null, ...thesisMeta(k),
          };
        }))}`;
      }
      written += m.trades.length;
    };
    let open: Activity[] = []; // the (account, symbol) pair the last page ended in
    // PR-3 fix round 4 (engineer note): the key is the whole unique row key, source included; without it two sources
    // sharing a vendor id at a page boundary lost a row.
    let after: { account_id: string; symbol: string; at: string; external_id: string; source: string } | null = null;
    for (;;) {
      const page: PairRow[] = await tx<PairRow[]>`select account_id, symbol, executed_at, executed_at::text as at, external_id, side, units, price, fee, source, ${heldRow(tx)} as held
        from activities a where a.user_id = ${userId}
        and not exists (select 1 from broker_accounts b where b.account_id = a.account_id and b.user_id = ${userId} and b.is_paper)
        and ${notShared(tx, userId)}
        and ${published(tx)}
        and ${storedFirst(tx)}
        and ${notDuplicate(tx)}
        ${after ? tx`and (a.account_id, a.symbol, a.executed_at, a.external_id, a.source) > (${after.account_id}, ${after.symbol}, ${after.at}::timestamptz, ${after.external_id}, ${after.source})` : tx``}
        order by a.account_id, a.symbol, a.executed_at, a.external_id, a.source limit ${REBUILD_PAGE}`;
      for (const r of page) {
        const a: Activity = {
          externalId: r.external_id, accountId: r.account_id, symbol: r.symbol, side: r.side, units: r.units,
          price: r.price, fee: r.fee, executedAt: r.executed_at, verified: r.source === 'snaptrade', ...(r.held ? { held: true } : {}),
        };
        if (open.length && (open[0].accountId !== a.accountId || open[0].symbol !== a.symbol)) { await flush(open); open = []; }
        if (chainOf.has(pairKey(a.accountId, a.symbol))) continue; // matched with its chain below
        open.push(a);
        maxHeld = Math.max(maxHeld, open.length + page.length);
      }
      if (page.length < REBUILD_PAGE) break;
      const last: PairRow = page[page.length - 1];
      after = { account_id: last.account_id, symbol: last.symbol, at: last.at, external_id: last.external_id, source: last.source };
    }
    await flush(open);
    // Corporate actions: each rename chain's pairs, read and matched together (in the stream's total order).
    const chains = new Map<string, string[]>();
    for (const [k, root] of chainOf) chains.set(root, [...(chains.get(root) ?? []), k]);
    for (const keys of chains.values()) {
      const pairs = keys.map((k) => [k.slice(0, k.lastIndexOf('|')), k.slice(k.lastIndexOf('|') + 1)]);
      const rows = await tx<PairRow[]>`select account_id, symbol, executed_at, executed_at::text as at, external_id, side, units, price, fee, source, ${heldRow(tx)} as held
        from activities a where a.user_id = ${userId} and (a.account_id, a.symbol) in (select * from unnest(${pairs.map((x) => x[0])}::text[], ${pairs.map((x) => x[1])}::text[]))
        and not exists (select 1 from broker_accounts b where b.account_id = a.account_id and b.user_id = ${userId} and b.is_paper)
        and ${notShared(tx, userId)}
        and ${published(tx)}
        and ${storedFirst(tx)}
        and ${notDuplicate(tx)}
        order by a.account_id, a.symbol, a.executed_at, a.external_id, a.source`;
      maxHeld = Math.max(maxHeld, rows.length);
      await flush(rows.map((r) => ({
        externalId: r.external_id, accountId: r.account_id, symbol: r.symbol, side: r.side, units: r.units,
        price: r.price, fee: r.fee, executedAt: r.executed_at, verified: r.source === 'snaptrade', ...(r.held ? { held: true } : {}),
      })), new Set(keys));
    }
    // F3-1: an unusable sell in a pair with no stored activity is never replayed above; it is still counted.
    for (const ca of actions) if (ca.kind === 'unpriceable' && ca.reason === 'trade' && ca.side === 'SELL' && !flushed.has(pairKey(ca.accountId, ca.symbol))) excludedCorporate++;
    const setAside = live.filter((k) => !attachedIds.has(k.sell_id as string));
    if (setAside.length) {
      await tx`insert into kept_theses ${tx(setAside.map((k) => ({ user_id: userId, sell_id: k.sell_id, thesis: k.thesis, thesis_status: k.thesis_status, ...thesisMeta(k as unknown as KeptThesis) })))}
        on conflict (user_id, sell_id) do update set thesis = excluded.thesis, thesis_status = excluded.thesis_status,
          thesis_written_at = excluded.thesis_written_at, thesis_edited_at = excluded.thesis_edited_at,
          thesis_hold_rule = excluded.thesis_hold_rule, thesis_reviewed_at = excluded.thesis_reviewed_at,
          thesis_reports_from = excluded.thesis_reports_from, thesis_checked_version = excluded.thesis_checked_version`;
    }
    const [{ future }] = await tx`select count(*)::int as future from activities a where a.user_id = ${userId} and not (${published(tx)}) and ${storedFirst(tx)} and ${notDuplicate(tx)}
      and not exists (select 1 from broker_accounts b where b.account_id = a.account_id and b.user_id = ${userId} and b.is_paper)
      and ${notShared(tx, userId)}`;
    // F-35 (code review 1): a sell the importer could not price (an unusable trade row, corporate_actions reason 'trade')
    // dated ahead is left out of excluded_corporate until its date, so it waits on the future line instead (exclude and
    // count, F3c): never counted nowhere. The stored-first rule (`storedFirst`'s mirror) keeps one vendor id counted once.
    const [{ unusable }] = await tx`select count(*)::int as unusable from corporate_actions a where a.user_id = ${userId} and not (${published(tx)})
      and a.kind = 'unpriceable' and a.detail->>'reason' = 'trade' and a.detail->>'side' = 'SELL'
      and not exists (select 1 from activities x where x.source = a.source and x.external_id = a.external_id and x.created_at <= a.created_at)
      and not exists (select 1 from broker_accounts b where b.account_id = a.account_id and b.user_id = ${userId} and b.is_paper)
      and ${notShared(tx, userId)}`;
    await tx`update users set excluded_positions = ${excluded}, excluded_future = ${future + (unusable as number)}, last_synced_at = now() where id = ${userId}`;
    // F-24 RT-2: sells counted while a possible re-issue in their pair is held (owner-visible; shown nowhere yet).
    await tx`update users set excluded_held = ${excludedHeld} where id = ${userId}`;
    await tx`update users set excluded_corporate = ${excludedCorporate} where id = ${userId}`; // corporate actions (F3c)
    return { trades: written, excluded, future: (future as number) + (unusable as number), maxHeld, excludedCorporate };
  };
  return tx ? run(tx) : sql.begin(run);
}

type TradeRead = Awaited<ReturnType<typeof fetchActivities>>;
// A test fake may return a bare list of activities (no unusable rows).
const tradeRead = (r: TradeRead | TradeRead['activities']): TradeRead => (Array.isArray(r) ? { activities: r, unusable: [] } : r);
export type Broker = {
  listAccounts: typeof listAccounts; // with the authorization, paper and sync flags
  fetchActivities: (...a: Parameters<typeof fetchActivities>) => Promise<TradeRead | TradeRead['activities']>;
  // PR-3 (heavy-use): a sync with no stored history reads it page by page (one page held at a time) when available.
  fetchActivitiesPage?: typeof fetchActivitiesPage;
  fetchPositions?: typeof fetchPositions;
  fetchShareMoves?: typeof fetchShareMoves; // corporate actions (F3c): each real account's share-moving rows
  pageLimit?: number;
};
export const defaultBroker: Broker = { listAccounts, fetchActivities, fetchActivitiesPage, fetchPositions, fetchShareMoves };

// F3-3: how long a connection's accounts must stay unlisted, over at least two successful lists, before it freezes.
export const FREEZE_CONFIRM_HOURS = 24;
// ponytail: the marks compare the app's clock (`now`), not the database clock the claim rounds use, so instance skew
// shifts the 24 h window by the skew — fix: compare against the database's now() as clockSql does.

export type SyncableUser = { id: number; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null };
// The hourly sync's users (F-1, COMPLIANCE §3 consent at collection): a trader is synced only once a connection is
// `connected`, and never while an import runs (the tick's steps own that row). A pending link, a failed import and a
// profile being deleted are never synced. A frozen connection (`disconnected_at`, TR-5) is never read (F3-3): a trader
// whose every connected connection is frozen is not synced.
export const syncable = () => sql`u.snaptrade_user_id is not null and u.deleted_at is null
    and exists (select 1 from connections c where c.user_id = u.id and c.state = 'connected' and c.disconnected_at is null)
    and not exists (select 1 from connections c where c.user_id = u.id and c.state = 'importing')`;
export async function usersToSync(): Promise<SyncableUser[]> {
  return sql<SyncableUser[]>`select id, snaptrade_user_id, snaptrade_secret_enc from users u where ${syncable()} order by last_synced_at nulls first`;
}

// PR-3 (heavy-use defect 2): the hourly sync tick, safe to run from any number of callers at once (overlapping cron
// calls, retries, several instances). Before, each caller listed every trader and synced them all, so N callers synced
// each trader N times (the per-user lock only skipped calls that overlapped in time).
// Fix round 2 (tester's re-run 1): the claim is keyed on a round read from the database clock, and rounds run from :30
// to :30, half an hour away from the cron's :00. The rule:
//   - one clock: every claim and lease decision uses `now()` inside the claim statement, never the calling instance's
//     clock, so instance skew, a scheduler firing a moment early or late, and leases written by another instance all
//     compare against the same time;
//   - at most once per round: a trader is claimed only if `sync_claimed_at` is before the start of the current round
//     (the latest :30 at or before now, UTC). Any call within ±30 minutes of a :00 cron mark lands in that mark's round;
//   - per claim, not per tick: each claim reads the round when it runs, so a tick that runs across :30 claims under the
//     new round from then on (its earlier claims stay in the old one);
//   - at least once per round while any tick runs in it: every tick claims every trader not yet claimed this round;
//   - never two at once: a claim also takes a short in-flight lease (`sync_lease_until`), released when the sync ends or
//     fails; a leased trader is never claimed (`for update skip locked` keeps concurrent claims apart, and the per-user
//     advisory lock in syncUser still prevents interleaving when a lease lapses mid-sync). A caller that dies leaves its
//     lease to lapse after SYNC_LEASE_MS; that trader is then claimable again in the same round, since its sync never
//     finished;
//   - an import in progress is never claimed (`syncable`).
// A failed sync keeps its round claim, so it is retried next round.
// Fix round 3 (tester's re-run 2, row 14): a sync skipped because another sync still holds the per-user lock (a lease
// that lapsed mid-sync) puts back the claim it replaced, so it never takes the trader's round: when the lapse crosses
// :30, the next round's ticks still claim and read the trader once the holder finishes. The tick that was skipped does
// not claim that trader again (it would only be skipped again). Every vendor request is also bounded far below the lease
// (VENDOR_TIMEOUT_MS in lib/broker.ts), so a hung vendor call no longer holds the lock past it.
export const SYNC_LEASE_MS = 10 * 60_000; // far above one trader's sync (under 1 s for a 10,000-activity record)
export const ROUND_MS = 3_600_000;
export const ROUND_OFFSET_MS = 30 * 60_000; // rounds start at :30, away from the hourly cron's :00
// `prev` is the round claim this claim replaced (database text, microseconds), put back if the sync is skipped.
export type ClaimedUser = SyncableUser & { lease: string; prev: string | null };
// `shiftMs` and `ids` are test hooks: tests run in a past round by shifting the database clock, and claim only their
// own traders. Production calls pass neither (shift 0: the database clock as is; every syncable trader). `except` is
// the tick's own list of traders it was skipped on.
// `maxAccounts` (fix round 6): only traders whose consented real accounts, capped at SYNC_FIT_CAP, are at most this many.
export type ClaimScope = { shiftMs?: number; ids?: number[]; except?: number[]; maxAccounts?: number };
// The database clock (shifted by the test hook) and the start of its round; and the claim rule over them.
export const clockSql = (shiftMs: number) => sql`select now() + ${shiftMs}::float8 * interval '1 millisecond' as t,
        date_trunc('hour', now() + ${shiftMs}::float8 * interval '1 millisecond' - ${ROUND_OFFSET_MS}::float8 * interval '1 millisecond', 'UTC')
          + ${ROUND_OFFSET_MS}::float8 * interval '1 millisecond' as round_start`;
export const claimable = () => sql`(u.sync_lease_until is null or u.sync_lease_until <= clock.t)
        and (u.sync_claimed_at is null or u.sync_claimed_at < clock.round_start or u.sync_lease_until is not null)`;
// A trader's real accounts under its connected connections' snapshots (what a sync reads; paper accounts are not read).
export const accountsOf = () => sql`(select count(*) from connections c, jsonb_array_elements(c.accounts) a
        where c.user_id = u.id and c.state = 'connected' and c.disconnected_at is null and coalesce((a->>'isPaper')::boolean, false) = false)`;
export async function claimNextUser(scope: ClaimScope = {}): Promise<ClaimedUser | null> {
  const { shiftMs = 0, ids, except, maxAccounts } = scope;
  if (ids && !ids.length) return null;
  if (maxAccounts !== undefined && maxAccounts < 0) return null;
  const [u] = await sql<ClaimedUser[]>`with clock as (${clockSql(shiftMs)})
    update users set sync_claimed_at = clock.t, sync_lease_until = clock.t + ${SYNC_LEASE_MS}::float8 * interval '1 millisecond'
    from clock, (
      select u.id, u.sync_claimed_at::text as prev from users u, clock where ${syncable()} ${ids ? sql`and u.id in ${sql(ids)}` : sql``}
        ${except?.length ? sql`and u.id not in ${sql(except)}` : sql``}
        ${maxAccounts !== undefined ? sql`and least(${accountsOf()}, ${SYNC_FIT_CAP}) <= ${maxAccounts}` : sql``}
        and ${claimable()}
      order by u.last_synced_at nulls first, u.id limit 1 for update of u skip locked) pick
    where users.id = pick.id
    returning users.id, users.snaptrade_user_id, users.snaptrade_secret_enc, users.sync_lease_until::text as lease, pick.prev`;
  return u ?? null;
}
// A skipped sync gives the round back: the claim it replaced is restored and its lease ended, only while the lease is
// still this claim's (a newer claim is left alone). The lease is not restored: the sync holding the lock is the one
// running, and once it ends the trader must be claimable by any tick in a round it has not been claimed in.
export async function restoreClaim(u: ClaimedUser) {
  await sql`update users set sync_claimed_at = ${u.prev}::text::timestamptz, sync_lease_until = null
    where id = ${u.id} and sync_lease_until = ${u.lease}::text::timestamptz`;
}
// Ends a claim's in-flight lease (only that claim's: a newer lease taken after this one lapsed is left alone). The lease
// is compared as the database wrote it (microseconds), never through a millisecond Date.
export async function releaseClaim(u: ClaimedUser) {
  // `::text` first: a bare `::timestamptz` parameter goes through a millisecond Date in the driver and never matches.
  await sql`update users set sync_lease_until = null where id = ${u.id} and sync_lease_until = ${u.lease}::text::timestamptz`;
}
// Syncable traders (in scope) no tick has claimed this round yet, and none holds: what is left for later calls.
export async function unclaimedCount(scope: ClaimScope = {}): Promise<number> {
  const { shiftMs = 0, ids } = scope;
  if (ids && !ids.length) return 0;
  const [{ n }] = await sql`with clock as (${clockSql(shiftMs)})
    select count(*)::int as n from users u, clock where ${syncable()} ${ids ? sql`and u.id in ${sql(ids)}` : sql``} and ${claimable()}`;
  return n as number;
}

// F-1 PR-3 fix round 4 (business lead 3): one call must fit one function duration. The cron route declares
// `maxDuration = SYNC_ROUTE_MAX_S` (app/api/sync/route.ts: 300 s, the host's default and its lowest plan's ceiling), and
// the tick stops claiming SYNC_RESERVE_MS (three vendor bounds) before the end, so a sync claimed just before the cut-off
// has 90 s to finish. A sync that still overruns is stopped with the function: its transaction rolls back and its lease
// lapses, so a later call (the cron runs every 5 minutes) syncs it in the same round. Traders left unclaimed when a call
// stops are counted in the log (a number, no personal data) so a round that does not cover everyone is visible.
export const SYNC_ROUTE_MAX_S = 300;
export const SYNC_RESERVE_MS = 3 * VENDOR_TIMEOUT_MS;
export const syncDeadline = (startedAt: number) => startedAt + SYNC_ROUTE_MAX_S * 1000 - SYNC_RESERVE_MS;
// F-1 PR-3 fix round 6 (engineer re-sit, Low): the fixed reserve fit a one-account sync only. A sync of n accounts makes
// up to syncRequests(n) = 1 + 3n vendor requests (the account list, then each account's activities, positions and share
// moves), so the tick sizes the reserve per trader: it claims a trader only if that many vendor bounds fit before the
// route's end (`routeEnd`), and
// leaves the others unclaimed (counted in the log) for the next call, which starts with the whole budget. n is capped at
// SYNC_FIT_CAP, the most a whole call fits, so a trader with more accounts is still claimed, at the start of a call.
// ponytail: past SYNC_FIT_CAP accounts (or an activity or share-move read over one vendor page per account) a sync can still overrun;
// it then rolls back and its lease lapses, as before. Sharded sync (lib/sync-shard.ts) dispatches such a trader only
// at the start of a call, and after two overruns in a row quarantines it (backed off, counted `quarantined` in shard 0's
// coverage line) instead of retrying it first forever. The overrun needs every request near its 30 s bound; a normal
// sync of 5+ accounts takes seconds. Next step: split the sync per account like the import (a change to syncUser's
// one-transaction rule, D4/D5: its own design session).
export const syncRouteEnd = (startedAt: number) => startedAt + SYNC_ROUTE_MAX_S * 1000;
// Sharded sync (coordination with the corporate-actions PR #40): the vendor reads a sync makes per real account, in one
// constant that syncCost, SYNC_FIT_CAP, accountsThatFit and the shard runner's request budget all read: 3 since #40
// (activities, positions, and the corporate actions' share moves).
export const SYNC_REQUESTS_PER_ACCOUNT = 3;
export const syncRequests = (accounts: number) => 1 + SYNC_REQUESTS_PER_ACCOUNT * accounts;
export const syncCost = (accounts: number) => syncRequests(accounts) * VENDOR_TIMEOUT_MS;
export const SYNC_FIT_CAP = Math.floor((SYNC_ROUTE_MAX_S * 1000 / VENDOR_TIMEOUT_MS - 1) / SYNC_REQUESTS_PER_ACCOUNT);
export const accountsThatFit = (remainingMs: number) => Math.floor((remainingMs / VENDOR_TIMEOUT_MS - 1) / SYNC_REQUESTS_PER_ACCOUNT);

// `deadline` (epoch ms on `clock`, the instance's own clock: it measures this call's duration only) stops claiming
// once reached; `report` receives what the end-of-call log line says; `clock`, `release` and the rest are test hooks.
export type TickReport = { ok: number; skipped: number; failed: number; unclaimed: number | null; stoppedAtDeadline: boolean; idle?: number | null };
export async function syncTick<R>(opts: {
  sync?: (u: SyncableUser) => Promise<R>; ids?: number[]; clockShiftMs?: () => number;
  deadline?: number; routeEnd?: number; clock?: () => number; release?: (u: ClaimedUser) => Promise<void>; report?: (r: TickReport) => void;
} = {}) {
  const sync = opts.sync ?? ((u: SyncableUser) => syncUser(u));
  const clock = opts.clock ?? Date.now;
  const deadline = opts.deadline ?? Infinity;
  const release = opts.release ?? releaseClaim;
  const passed: number[] = []; // skipped by this tick: the lock's holder syncs them, so they are not claimed again here
  const routeEnd = opts.routeEnd ?? Infinity;
  let fit = SYNC_FIT_CAP; // the most accounts the last claim allowed
  const claim = () => {
    fit = routeEnd === Infinity ? SYNC_FIT_CAP : Math.min(SYNC_FIT_CAP, accountsThatFit(routeEnd - clock()));
    return claimNextUser({ ids: opts.ids, shiftMs: opts.clockShiftMs?.() ?? 0, except: passed, ...(routeEnd === Infinity ? {} : { maxAccounts: fit }) });
  };
  let ok = 0, skipped = 0, stopped = false;
  const failed: number[] = [];
  for (;;) {
    if (clock() >= deadline) { stopped = true; break; }
    const u = await claim();
    if (!u) break;
    try {
      if ((await sync(u)) === 'skipped') {
        skipped++;
        passed.push(u.id);
        await restoreClaim(u);
      } else ok++;
    } catch (e) {
      failed.push(u.id);
      console.error('sync failed', u.id, logSafe(e));
    } finally {
      // PR-3 fix round 4 (engineer note): a database connection lost here must not abort the tick (the route would
      // answer 500 and the traders after this one would go unsynced by this call). The lease is left to lapse after
      // SYNC_LEASE_MS; a lapsed lease makes the trader claimable again, so at worst it is synced once more that round
      // (a re-sync is idempotent: the last week re-read, the same rows).
      try { await release(u); } catch (e) { console.error('sync lease release failed', u.id, logSafe(e)); }
    }
  }
  let unclaimed: number | null = null;
  try { unclaimed = await unclaimedCount({ ids: opts.ids, shiftMs: opts.clockShiftMs?.() ?? 0 }); } catch (e) { console.error('sync unclaimed count failed', logSafe(e)); }
  // Traders left because they did not fit the time left are a stop at the deadline too.
  if (!stopped && fit < SYNC_FIT_CAP && (unclaimed ?? 0) > 0) stopped = true;
  // FIXES-LABELS: status (F-11): idle records (no successful sync for IDLE_DAYS) counted internally, one number in this
  // counts-only line. Over the whole fleet, so a tick scoped to `ids` (tests, tools) leaves the field out.
  let idle: number | null = null;
  if (!opts.ids) try { idle = await idleCount(); } catch (e) { console.error('sync idle count failed', logSafe(e)); }
  const report: TickReport = { ok, skipped, failed: failed.length, unclaimed, stoppedAtDeadline: stopped, ...(opts.ids ? {} : { idle }) };
  console.log('sync tick', JSON.stringify(report)); // counts only
  opts.report?.(report);
  return { ok, skipped, failed };
}

// Under the per-user advisory lock: a concurrent sync for the same user is skipped. A short first transaction lists the
// accounts and commits the TR-5 freeze marks (F3-3); the sync itself is one transaction, so a failure anywhere in it
// leaves activities, closed_trades, claims and positions exactly as before.
// Only accounts under a consented authorization (one in the snapshot of a `connected` connection) are read or claimed:
// a pending link, a link still in the portal and a failed import's accounts are left exactly as they are (D1, D5).
// Returns the activity count, 'skipped' when another sync holds the lock; throws AccountClaimedError (writing nothing)
// if any account belongs to another profile. Simulated accounts are claimed, excluded and counted; never imported.
// F-14 (opt-in, `cadence`): the shard runner's hourly sync reads each account within the vendor's guidance (lib/sync-cadence.ts):
// activities with share moves at most once per 24 h, positions at most 4 times in any 24 h, the consented import and the
// first sync after a consent never throttled. Timestamps on the database clock (`shiftMs` is the tests' hook), written in
// this transaction (a failed sync never advances them); the successful vendor reads are also recorded after the
// transaction ends, whatever its outcome (sync_read_marks: the 6 h floor and the positions window). Without `cadence`
// (syncTick, tests) every account is read on every call, as before.
export type CadenceReport = { accounts: number; activitiesRead: number; positionsRead: number; deferred: number; rebuilt: boolean };
export type SyncOpts = { cadence?: boolean; shiftMs?: number; report?: (r: CadenceReport) => void };
export async function syncUser(
  user: { id: number; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null },
  broker: Broker = defaultBroker,
  rebuild: (userId: number, tx: TransactionSql) => Promise<unknown> = (id, tx) => rebuildRecord(id, tx), // OPTIONS
  now = new Date(),
  opts: SyncOpts = {},
): Promise<number | 'skipped'> {
  if (!user.snaptrade_user_id || !user.snaptrade_secret_enc) return 0;
  const bu = { snaptradeUserId: user.snaptrade_user_id, secretEnc: user.snaptrade_secret_enc };
  const shiftMs = opts.shiftMs ?? 0;
  // The vendor reads that returned (recorded only after each call returns), for the marks written after the transaction.
  const readActs: string[] = [], readPos: string[] = [];
  // F-24: accounts planned for a pass page this sync, and those whose page step threw an error that counts (after the
  // transaction: reconcile_failures).
  let recPlanned: string[] = [];
  let confirmPlanned: string[] = []; // accounts whose read this sync is the widened confirm read (F-24 committee option C)
  const recFailed = new Set<string>();
  let committed = false;
  const consentedAuths = async (tx: TransactionSql) => new Set((await tx`select a->>'authorizationId' as auth from connections c, jsonb_array_elements(c.accounts) a
      where c.user_id = ${user.id} and c.state = 'connected' and c.disconnected_at is null`).map((r) => r.auth as string));
  const lock = async (tx: TransactionSql) => (await tx`select pg_try_advisory_xact_lock(${USER_LOCK}, ${user.id}) as got`)[0].got as boolean;
  try {
    // TR-5 (F3-3): a connection whose accounts the vendor no longer lists is disconnected; its record stays, frozen. One
    // list is not enough (an empty or short answer can be a vendor fault): absence is confirmed only by a second successful
    // list at least FREEZE_CONFIRM_HOURS after the first that missed them all (`missing_since`), and a list that shows one
    // again clears it. A vendor error throws before the marks and stamps nothing.
    // Orchestrator review B1: the marks are what the list showed, so they commit in their own short transaction as soon as
    // the list succeeded and the claim check passed; a later failure in the sync (activities, positions, rebuild) never
    // rolls back a clear, which would let a later empty list freeze a connection that was listed in between. The claim
    // check runs in a savepoint that is always rolled back, so a conflict still writes nothing; the claims themselves are
    // written with the sync below.
    // Owner question Q1 (cycle 3) is open: nothing clears `disconnected_at`, so a frozen connection stays frozen and unread.
    const listing = await sql.begin(async (tx) => {
      if (!(await lock(tx))) return null;
      const consented = await consentedAuths(tx);
      const accounts = (await broker.listAccounts(bu)).filter((a) => consented.has(a.authorizationId));
      if (accounts.length) {
        const checked = Symbol('claim check only');
        try {
          await tx.savepoint(async (sp) => {
            if (!(await claimIn(sp, user.id, accounts, { confirmed: true, now })).ok) throw new AccountClaimedError();
            throw checked;
          });
        } catch (e) { if (e !== checked) throw e; }
      }
      // ponytail: absence is decided by vendor account id, not authorization, so an account id the vendor re-issues under the
      // same authorization leaves the old snapshot unlisted and freezes that connection after the window — fix: match on
      // the account's institution identity hash (broker_accounts) as the TR-6 claim does.
      const listed = tx(accounts.length ? accounts.map((a) => a.id) : ['']);
      const none = tx`not exists (select 1 from jsonb_array_elements(c.accounts) a where a->>'id' in ${listed})`;
      const live = tx`c.user_id = ${user.id} and c.state = 'connected' and c.disconnected_at is null`;
      const frozen = await tx`update connections c set disconnected_at = ${now} where ${live} and ${none}
        and c.missing_since <= ${now}::timestamptz - ${FREEZE_CONFIRM_HOURS}::float8 * interval '1 hour'`;
      await tx`update connections c set missing_since = ${now} where ${live} and ${none} and c.missing_since is null`;
      await tx`update connections c set missing_since = null where ${live} and not ${none} and c.missing_since is not null`;
      return { accounts, frozen: frozen.count };
    });
    if (!listing) return 'skipped';
    return await sql.begin(async (tx) => {
      // The lock again (another sync may have taken it between the two transactions: this one is then skipped), and the
      // consented set again, so a connection frozen or removed in between is never read.
      if (!(await lock(tx))) return 'skipped';
      const consented = await consentedAuths(tx);
      const accounts = listing.accounts.filter((a) => consented.has(a.authorizationId));
      // F-14 (G4, engineer 4): the claimed account set and paper flags before the claim, so a change still rebuilds.
      const shape = async () => (await tx`select coalesce(string_agg(account_id || ':' || is_paper::text, ',' order by account_id), '') as s
        from broker_accounts where user_id = ${user.id}`)[0].s as string;
      const before = opts.cadence ? await shape() : '';
      // Claim first so no conflicting data is ever read for the wrong user. Zero-activity accounts are claimed too.
      if (accounts.length && !(await claimIn(tx, user.id, accounts, { confirmed: true, now })).ok) throw new AccountClaimedError();
      const real = accounts.filter((a) => !a.isPaper).map((a) => a.id);
      // FIXES-LABELS: status (F-11, TR-5 "Account removed ‹date›"). Only after the vendor's list came back (a fetch error has
      // already thrown) and is not empty (an empty list is the confirmed-freeze path above, F3-3): a confirmed real account
      // the list no longer has, whose connection still lists at least one account, is stamped once (again after a relisting
      // with a trade, QA round 2 N2). PR #85 review (B1): every account the list names again has its stamp cleared first, so
      // a flapping list labels an account row only until the account is listed again; a removal never freezes the record
      // (only disconnected_at does, lib/record-status.ts). Its trades stay listed (TR-1); its last positions move aside with
      // the per-account positions read below (replaceListedPositions, F3-4).
      // F-14: the list is read on every run, cadence or not (only activities and positions wait for their due time), so
      // every run that reaches here fetched it (lib/sync-removed-cadence.test.ts).
      // ponytail: an account removed while the vendor list is empty is recorded as a disconnect, not a removal — vendor per-account removal events
      // ponytail: one short list stamps removed_at (no F3-3 two-list confirmation as for disconnected_at), which labels only that account's row, never the record, until the account is listed again — confirm with a missing_since per account if vendor short lists show up
      if (accounts.length) {
        const listed = accounts.map((a) => a.id);
        await tx`update broker_accounts set removed_at = null where user_id = ${user.id} and removed_at is not null and account_id in ${tx(listed)}`;
        // QA round 2 (N2): stamped again when it was listed again in between (a trade on it executed after the last stamp,
        // which only a later listing imports), so a second removal shows its own date (lib/record-status-load.ts hides a
        // stamp older than such a trade).
        await tx`update broker_accounts b set removed_at = ${now}
          where b.user_id = ${user.id} and b.confirmed_at is not null
            and (b.removed_at is null or exists (select 1 from activities av where av.user_id = b.user_id and av.account_id = b.account_id and av.executed_at > b.removed_at))
            and not b.is_paper and b.account_id not in ${tx(listed)}
            and exists (select 1 from connections c, jsonb_array_elements(c.accounts) a
              where c.user_id = ${user.id} and c.state = 'connected' and c.disconnected_at is null and a->>'id' = b.account_id and coalesce((a->>'isPaper')::boolean, false) = false
                and exists (select 1 from jsonb_array_elements(c.accounts) l where l->>'id' in ${tx(listed)}))`;
      }
      // Nothing consented is listed: no read, no rebuild, no positions (a failed import's pages are never published by a sync).
      if (!accounts.length) return 0;
      // F-14: which accounts are due (every real account without `cadence`).
      // ponytail: the account list (listAccounts, above) is still read every round: it carries the claim and TR-5's
      // disconnect check, and the vendor guidance the council cited does not cover it — whether it may be throttled is a
      // vendor question (MR-1) for the owner.
      // F-35: a row whose date passes publishes on the next tick's matured pass (lib/sync-shard.ts), read or not.
      // ponytail: a date the vendor corrects (a new vendor id) arrives with the account's next activities read (about
      // every 25 h) — the vendor's read cadence (F-14), not the rebuild.
      let actIds = real, posIds = real, deferred = 0;
      const t = tx`now() + ${shiftMs}::float8 * interval '1 millisecond'`;
      if (opts.cadence && real.length) {
        const flags = await tx`select acct_ids.acct as id, d.* from unnest(${real}::text[]) as acct_ids(acct),
          lateral ${dueSql(sql`acct_ids.acct`, sql`${user.id}::int`, t)} d`;
        const plan = new Map(flags.map((f) => [f.id as string, decide(f as unknown as DueFlags)]));
        actIds = real.filter((id) => plan.get(id)?.activities);
        posIds = real.filter((id) => plan.get(id)?.positions);
        deferred = real.filter((id) => plan.get(id)?.deferred).length;
      }
      const changed = opts.cadence ? (await shape()) !== before || listing.frozen > 0 : true;
      // Fix round 6: a quarantined future date never sets the re-read window (it would skip the real last week).
      const [{ last: lastShare }] = await tx`select max(executed_at) as last from activities where user_id = ${user.id} and source = 'snaptrade' and ${notFuture(tx)}`;
      // OPTIONS (AC 11): the newest row across both raw tables sets the window, so an options-only trader re-reads a week.
      const lastOption = await lastOptionActivityAt(tx, user.id);
      const last: Date | null = lastShare && lastOption ? (lastShare > lastOption ? lastShare : lastOption) : (lastShare ?? lastOption);
      const options: (OptionRow & { raw: unknown })[] = [];
      // F-24 (orchestrator review C6): lib/broker.ts#fetchActivities calls the sink once per internal vendor page, so the
      // calls count the pages a read made (rows dropped by toActivities, e.g. with no symbol, still take a page's room).
      let sinkPages = 0;
      const sink = (rows: (OptionRow & { raw: unknown })[]) => { sinkPages++; options.push(...rows); };
      // OPTIONS × F-14: "the whole history was read" holds only when every real account was (a gated account waits).
      const allRead = actIds.length === real.length;
      // Accounts that read a backfill history page this sync in place of their week (their recent sells are not read).
      let pagedIds: string[] = [];
      let read = 0;
      // F-24: the ids each read listed, so a pair it listed both rows of is genuine (a week read: only inside its window).
      const listedBy: string[] = [];
      let weekListed: string[] = [], weekFrom: Date | null = null;
      let passFound = 0; // possible re-issues a pass page found (counted in the log line)
      let cleared = 0; // held rows a read cleared (counted in the log line)
      if (!last && broker.fetchActivitiesPage) {
        // No stored history (a pre-F-1 record): the whole history, one vendor page per insert, never held at once.
        const limit = broker.pageLimit ?? PAGE_LIMIT;
        for (const id of actIds) {
          for (let offset = 0; ; offset += limit) {
            const page = await broker.fetchActivitiesPage(bu, id, offset, limit, sink);
            if (offset === 0) readActs.push(id); // F-14 (code review): marked once its first page returned
            await insertActivities(user.id, 'snaptrade', page.activities, tx);
            await insertCorporateActions(tx, user.id, 'snaptrade', page.unusable ?? []); // F3-1: counted, never dropped
            await insertOptionActivities(user.id, 'snaptrade', options.splice(0), tx); // OPTIONS
            read += page.activities.length;
            // F-24: a pair is genuine only when one vendor response lists both rows, so each page is checked on its own.
            await markTwins(tx, user.id);
            await markGenuine(tx, user.id, page.activities.map((a) => a.externalId));
            if (page.done) break;
          }
        }
        await restartPeriod(tx, user.id, actIds, t); // F-24: a whole-history read; the next pass a period later
        if (allRead) await markBackfilled(tx, user.id); // OPTIONS: the whole history was read with the option types
        // OPTIONS × F-14 (review nit): a gated account waits, but those read in full owe no backfill (cursor -1).
        else if (actIds.length) await saveBackfill(tx, user.id, real, new Map(actIds.map((id) => [id, -1])));
      } else {
        // The hourly case: the last week before the newest stored activity (bounded by a week of trading, not the history).
        const since = last ? new Date(last.getTime() - BACKFILL_MS) : new Date('2000-01-01');
        // OPTIONS (fix round 1, review 4): an account still owed its one-time option backfill reads its next history page
        // instead of the week (the same request count); the others read the week as before. F-14: only due accounts read.
        // ponytail: under F-14 a backfill page is that account's daily activities read, so a history of k pages takes about
        // k days to backfill its options — the vendor's written answer (MR-1) on history pages would let them go hourly.
        const backfill = broker.fetchActivitiesPage ? await pendingBackfill(tx, user.id) : new Map<string, number>();
        // F-24 (plan §3): a due pass page replaces the account's week read (the option backfill's page wins). Only under
        // `cadence` (the shard runner's production path), and only for accounts due today (`actIds` ⊆ real: consented,
        // not frozen, not paper), so the pass stays inside F-14's one activities read per account per 24 h.
        const passes = opts.cadence && broker.fetchActivitiesPage && passPageLimitOk(broker.pageLimit ?? PAGE_LIMIT) ? await plannedPages(tx, user.id, actIds.filter((id) => !backfill.has(id)), t) : new Map<string, PassPlan>();
        recPlanned = [...passes.keys()];
        const paged = actIds.filter((id) => backfill.has(id) || passes.has(id));
        pagedIds = actIds.filter((id) => backfill.has(id));
        const windowed = actIds.filter((id) => !backfill.has(id) && !passes.has(id));
        weekFrom = new Date(since.getTime() + 86_400_000); // a day clear of the window's time-zone boundary
        if (opts.cadence) {
          // F-14 (code review): one call per account, each recorded as it returns, so a failure on a later account
          // still marks the reads already made (G2's floor applies to them).
          for (const id of windowed) {
            // F-24 committee (option C): an account with 'confirm' rows reads from a day before their earliest trade date
            // instead of the week: one call, a superset of the week read (no extra request), that lists both twins if
            // the vendor still has both. Two failed syncs in a row that were to make it give it up: the rows become
            // suspected and the plain week is read.
            // ponytail: the widened read pages internally by 1,000 rows with no overlap (lib/broker.ts#fetchActivities), so
            // a list shift inside the call can leave a genuine row suspected until the next pass — fix: page with overlap
            // (a lib/broker.ts change, owner).
            const from = await plannedConfirm(tx, user.id, id, since);
            const widened = from ? new Date(Math.min(since.getTime(), from.getTime() - 86_400_000)) : since;
            if (from) confirmPlanned.push(id);
            sinkPages = 0;
            const got = tradeRead(await broker.fetchActivities(bu, widened, [id], sink));
            readActs.push(id);
            // Orchestrator re-review L1: fetchActivities pages internally by PAGE_LIMIT rows with no overlap, so a call that
            // returned a full page or more is not one vendor response: it decides nothing (a widened read's rows become
            // suspected; the next pass re-examines them).
            // ponytail: a busy account's week or widened read past PAGE_LIMIT rows never clears a held row — fix: per-page id
            // lists from lib/broker.ts#fetchActivities (owner), so each internal page decides on its own.
            const oneResponse = sinkPages <= 1 && got.activities.length + got.unusable.length + options.length < PAGE_LIMIT;
            await insertActivities(user.id, 'snaptrade', got.activities, tx);
            await insertCorporateActions(tx, user.id, 'snaptrade', got.unusable); // F3-1: counted, never dropped
            await insertOptionActivities(user.id, 'snaptrade', options.splice(0), tx); // OPTIONS
            read += got.activities.length;
            if (from) {
              // The widened read decides: rows it lists with every unheld twin (dated a day inside its window) are genuine,
              // every other 'confirm' row of the account is suspected (the one exception to "a week read never suspects").
              await markTwins(tx, user.id);
              if (oneResponse) cleared += await markGenuine(tx, user.id, got.activities.map((a) => a.externalId), id, new Date(widened.getTime() + 86_400_000));
              await endConfirm(tx, user.id, id, !oneResponse); // a multi-page read decided nothing: those stay held (R1)
            } else if (oneResponse) weekListed.push(...got.activities.map((a) => a.externalId));
          }
        } else {
          sinkPages = 0;
          const got = windowed.length ? tradeRead(await broker.fetchActivities(bu, since, windowed, sink)) : { activities: [], unusable: [] };
          // L1: a call of a full page or more is several vendor responses: it decides nothing (see the cadence branch).
          // One page per account at most (the sink is called once per internal page of each account read).
          if (sinkPages <= windowed.length && got.activities.length + got.unusable.length + options.length < PAGE_LIMIT) weekListed = got.activities.map((a) => a.externalId);
          await insertActivities(user.id, 'snaptrade', got.activities, tx);
          await insertCorporateActions(tx, user.id, 'snaptrade', got.unusable); // F3-1: counted, never dropped
          await insertOptionActivities(user.id, 'snaptrade', options.splice(0), tx); // OPTIONS
          read = got.activities.length;
        }
        const progress = new Map<string, number>();
        for (const id of paged) {
          const limit = broker.pageLimit ?? PAGE_LIMIT;
          const pass = backfill.has(id) ? undefined : passes.get(id);
          const offset = pass ? pass.offset : backfill.get(id)!;
          try {
            const page = await broker.fetchActivitiesPage!(bu, id, offset, limit, sink);
            readActs.push(id);
            await insertActivities(user.id, 'snaptrade', page.activities, tx);
            await insertCorporateActions(tx, user.id, 'snaptrade', page.unusable ?? []); // F3-1: the option backfill page too
            const optionIds = options.map((o) => o.externalId); // F-24: every vendor row of the page counts in the overlap check
            await insertOptionActivities(user.id, 'snaptrade', options.splice(0), tx);
            read += page.activities.length;
            const ids = page.activities.map((a) => a.externalId);
            listedBy.push(...ids);
            if (!pass) {
              progress.set(id, page.done ? -1 : offset + limit);
              if (page.done) await restartPeriod(tx, user.id, [id], t); // F-24: the backfill read the whole history
              continue;
            }
            // F-24: a page of this account's pass. Rows it inserted are checked for twins before the pass end decides.
            passFound += await markTwins(tx, user.id);
            const listed = [...ids, ...(page.unusable ?? []).map((u) => u.externalId)];
            const r = await recordPage(tx, user.id, id, pass, limit, listed, [...listed, ...optionIds], page.done, t);
            // A one-page pass read the whole history in one call, a superset of the week read; any other page is a
            // history page: positions-only rule (TR-4) and "Updated" keeps its value (plan §3).
            // ponytail: "Updated" keeps the trader's value on any page day, so another account's week read that day is not
            // reflected for up to a day — fix: a per-account recent-read stamp (rejected in round 2 as more than it buys).
            if (!r.onePage) pagedIds.push(id);
          } catch (e) {
            if (pass && pageFailureCounts(e)) recFailed.add(id);
            throw e;
          }
        }
        if (progress.size) await saveBackfill(tx, user.id, real, progress);
        if (!last && allRead) await markBackfilled(tx, user.id); // the since-2000 read is the whole history
      }
      // Corporate actions (F3c): every real account's share-moving rows (whole history, idempotent inserts) before the
      // rebuild applies them. Counted: SYNC_REQUESTS_PER_ACCOUNT is 3 (activities, positions, share moves), so syncCost,
      // SYNC_FIT_CAP and the sharded runner's request budget include this read (one page per account; more pages are the
      // ponytail above). F-14 (S1): the same vendor endpoint as activities, so the same daily gate.
      if (broker.fetchShareMoves) {
        for (const id of actIds) {
          const moves = await broker.fetchShareMoves(bu, id);
          await insertActivities(user.id, 'snaptrade', moves.activities, tx);
          await insertCorporateActions(tx, user.id, 'snaptrade', moves.actions);
          read += moves.activities.length;
        }
      }
      // F-24 (D5, plan §2): every row this transaction stored with an older twin is held until a read lists both rows or
      // a complete pass decides it; a pair one read listed both rows of is genuine (a week read: only inside its window).
      const found = passFound + (await markTwins(tx, user.id));
      cleared += (await markGenuine(tx, user.id, listedBy)) + (weekFrom ? await markGenuine(tx, user.id, weekListed, undefined, weekFrom) : 0);
      // A row found by this sync's week read that it could not decide: the next pass comes sooner (never for an account
      // whose pass ran this sync: an ended or given-up pass waits its period).
      if (opts.cadence) await bringForward(tx, user.id, t, recPlanned);
      await dropUnread(tx, user.id, real); // retention: an account no longer read drops its running pass's ids
      const optTwins = await optionTwins(tx, user.id);
      // Re-issue states decided in this transaction (a pass end, or a page that listed both rows), so the line is written
      // whenever any state changed (plan §4).
      const [{ decided }] = await tx`select count(*)::int as decided from activity_reissues where user_id = ${user.id} and decided_at = now()`;
      if (found || cleared || optTwins || decided) {
        const { id } = user; // the internal id and counts only (lib/privacy-logs.test.ts)
        const counts = await reissueCounts(tx, user.id);
        console.log('sync reissues', id, JSON.stringify({ found, cleared, pending: counts.pending, confirm: counts.confirm, suspected: counts.suspected, optionTwins: optTwins }));
      }
      // F-14 (G4): rebuilt when activities were read or the account set changed, so last_synced_at means "activities
      // last read" (the freshness line, the queue order, the coverage age). Always without `cadence`.
      const rebuilt = actIds.length > 0 || changed;
      const [{ prev }] = opts.cadence ? await tx`select last_synced_at as prev from users where id = ${user.id}` : [{ prev: null }];
      if (rebuilt) await rebuild(user.id, tx);
      if (broker.fetchPositions) {
        const splits = new Map<string, PositionSplit>(); // OPTIONS (D7)
        if (!opts.cadence) {
          const positions = [];
          for (const id of real) for (const p of await broker.fetchPositions(bu, id, (s) => { splits.set(id, s); })) positions.push({ accountId: id, symbol: p.symbol, unrealizedPct: p.unrealizedPct });
          await replaceListedPositions(tx, user.id, real, positions); // F3-4: per account read
          // OPTIONS (D7), per account read (F3-4): unlisted accounts' rows move aside, then every listed account is replaced
          // (replaceAccountOptionPositions' user-wide path: the totals are this read's, never added to).
          await moveUnlistedOptionPositions(tx, user.id, real);
          await replaceAccountOptionPositions(tx, user.id, real, real, [], splits);
        } else {
          // Accounts no longer real (disconnected, simulated) leave the public positions on every sync (engineer 3); their
          // rows move aside as F3-4 keeps them (lib/positions.ts#moveUnlistedPositions, rendered nowhere).
          await moveUnlistedPositions(tx, user.id, real);
          // F-14 × OPTIONS (review B2): a backfill page is not this account's recent activities, so its sells may be
          // unread for days: its positions take the positions-only rule (never removed), not the combined one.
          const withActs = new Set(actIds.filter((id) => !pagedIds.includes(id)));
          for (const id of posIds) {
            const rows = (await broker.fetchPositions(bu, id, (s) => { splits.set(id, s); })).map((p) => ({ accountId: id, symbol: p.symbol, unrealizedPct: p.unrealizedPct }));
            readPos.push(id);
            if (withActs.has(id)) {
              // Read with this account's activities (and its rebuild): listed positions are updated and added; one the
              // vendor no longer lists goes once its sell is imported (or after 3 days unlisted), lib/positions.ts.
              await settleAccountPositions(tx, user.id, id, rows);
            } else if (rows.length) {
              // G3 (TR-4): a positions-only read adds and updates, never removes, so a position closed at a loss stays
              // listed until the read that also publishes its closed trade.
              // ponytail: a positions-only read that still lists a position after its close was imported refreshes its
              // read time, so the row then waits for the 3-day rule (its trade and the open row show together; no loss
              // is hidden) — fix: skip the refresh when a closing row was imported since the last listing.
              await tx`insert into open_positions ${tx(firstByKey(rows, (p) => `${p.accountId}\u0000${p.symbol}`).map((p) => ({ user_id: user.id, account_id: p.accountId, symbol: p.symbol, unrealized_pct: p.unrealizedPct })))}
                on conflict (user_id, account_id, symbol) do update set unrealized_pct = excluded.unrealized_pct, fetched_at = now()`;
            }
          }
          // OPTIONS × F-14: option positions follow the share rule (review B1, TR-4). Accounts read with their recent
          // activities are replaced; positions-only reads add and update, never remove; accounts no longer real are
          // dropped; the others (not due) stay as last read, their counts with them (lib/options-sync.ts).
          await moveUnlistedOptionPositions(tx, user.id, real);
          await replaceAccountOptionPositions(tx, user.id, real, posIds.filter((id) => withActs.has(id)), posIds.filter((id) => !withActs.has(id)), splits, { settle: true });
        }
      }
      if (opts.cadence) {
        // Stamped after the vendor calls returned (clock_timestamp, not the transaction's start), so the next read is due
        // a full period after this one's last call (tester: a stamp at the transaction start let two daily calls land
        // seconds under 24 h apart).
        const stamp = tx`clock_timestamp() + ${shiftMs}::float8 * interval '1 millisecond'`;
        if (actIds.length) await tx`update broker_accounts set activities_read_at = ${stamp} where user_id = ${user.id} and account_id in ${tx(actIds)}`;
        if (posIds.length && broker.fetchPositions) await tx`update broker_accounts set positions_read_at = ${stamp} where user_id = ${user.id} and account_id in ${tx(posIds)}`;
        // F-14 (orchestrator review): `last_synced_at` (F-11's "Updated …") is the oldest real account's last activities
        // read, never "now" after a rebuild that only an account-set change or a partial read triggered. While any real
        // account has never been read, the previous value stands.
        // OPTIONS × F-14 (review nit): while any real account is mid-backfill its recent week is unread, so the value
        // stands too.
        // (Review: a sync that read a backfill page, the last one included, did not read the week either.)
        const midBackfill = pagedIds.length > 0 || (broker.fetchActivitiesPage ? [...(await pendingBackfill(tx, user.id)).keys()].some((id) => real.includes(id)) : false);
        if (rebuilt && midBackfill) await tx`update users set last_synced_at = ${prev} where id = ${user.id}`;
        else if (rebuilt) {
          await tx`update users set last_synced_at = coalesce((select case when bool_or(activities_read_at is null) then null else min(activities_read_at) end
              from broker_accounts where user_id = ${user.id} and account_id in ${tx(real.length ? real : [''])}), ${prev})
            where id = ${user.id}`;
        }
        opts.report?.({ accounts: real.length, activitiesRead: actIds.length, positionsRead: broker.fetchPositions ? posIds.length : 0, deferred, rebuilt });
      }
      return read;
    }).then((r) => { committed = r !== 'skipped'; return r; });
  } catch (e) {
    // A cut at the route's end (RouteDeadlineError, lib/sync-shard.ts) is not a failed sync: its reads leave no marks, so
    // the next call reads at once instead of waiting out the 6 h floor (orchestrator review).
    if ((e as { name?: unknown } | null)?.name === 'RouteDeadlineError') { readActs.length = 0; readPos.length = 0; }
    throw e;
  } finally {
    // G2: fire and forget, after the transaction (its connection is back in the pool); never fatal.
    if (opts.cadence && (readActs.length || readPos.length)) {
      const { id } = user; // the internal id only (lib/privacy-logs.test.ts)
      try { await writeMarks(id, readActs, readPos, shiftMs); } catch (e) { console.error('sync marks failed', id, logSafe(e)); }
    }
    // F-24 committee (option C): a sync that was to make the widened confirm read and failed (any cause) counts one.
    if (confirmPlanned.length) {
      const { id } = user;
      try { await writeConfirmFailures(id, confirmPlanned, !committed); } catch (e) { console.error('sync confirm marks failed', id, logSafe(e)); }
    }
    // F-24 (plan item 7): a page step that failed counts toward giving its pass up; a committed sync clears the counts.
    const recIds = committed ? recPlanned : [...recFailed];
    if (recIds.length) {
      const { id } = user;
      try { await writeReconcileFailures(id, recIds, !committed); } catch (e) { console.error('sync reconcile marks failed', id, logSafe(e)); }
    }
  }
}

// Cron loop: one user's failure (incl. AccountClaimedError) never stops the rest. Logs the user id only.
export async function syncAll<U extends { id: number }>(users: U[], sync: (u: U) => Promise<unknown>) {
  let ok = 0;
  const failed: number[] = [];
  for (const u of users) {
    try {
      await sync(u);
      ok++;
    } catch (e) {
      failed.push(u.id);
      console.error('sync failed', u.id, logSafe(e));
    }
  }
  return { ok, failed };
}

// FIXES-LABELS: status (F-11): the number of idle records, the predicate of lib/record-status.ts#idleSince in SQL: a
// record with a live (not disconnected) consented connected connection whose last successful sync, or else its earliest
// live consent, is IDLE_DAYS old or more. A frozen record (every connection disconnected) is not idle. A count only.
// QA round 2 (N5): only records that would show the idle line: at least one close, a broker record (no Demo data, not
// built from public filings), and no consented import running or failed. PR #85 review (B1): a record whose live
// accounts are all removed is not frozen (only disconnected_at freezes), so it shows the idle line and is counted.
// `idRange` is lib/sync-shard.ts's Scope.idRange (the coverage step's scope).
// ponytail: the import/failed test is per consented connection, not lib/connections.ts#aggregateRecord's full rule (a legacy claim, paper-only links) — fix: store the record state per user and read it here
export async function idleCount(ids?: number[], idRange?: [number, number]): Promise<number> {
  if (ids && !ids.length) return 0;
  const [{ n }] = await sql`
    select count(*)::int as n from users u,
      lateral (select min(c.consent_at) as first from connections c where c.user_id = u.id and c.state = 'connected' and c.consent_at is not null and c.disconnected_at is null) l
    where u.deleted_at is null and l.first is not null ${ids ? sql`and u.id in ${sql(ids)}` : sql``}
      ${idRange ? sql`and u.id between ${idRange[0]} and ${idRange[1]}` : sql``}
      and coalesce(u.last_synced_at, l.first) <= now() - make_interval(days => ${IDLE_DAYS})
      and u.public_filer_id is null
      and exists (select 1 from closed_trades t where t.user_id = u.id)
      and not exists (select 1 from activities d where d.user_id = u.id and d.source = 'demo')
      and not exists (select 1 from connections c where c.user_id = u.id and c.consent_at is not null and c.state in ('importing', 'failed'))`;
  return n as number;
}
