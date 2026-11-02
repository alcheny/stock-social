// OPTIONS (docs/features/logs/options/plan.md D1, D4, D7): every write to the option tables, and the reads the rebuild
// needs (the one file besides lib/options-load.ts allowed to read them, lib/options-load.test.ts). lib/sync.ts and
// lib/connections.ts only call these helpers; rebuildTrades and lib/trades.ts are untouched.
import type { TransactionSql } from 'postgres';
import { sql } from './db.ts';
import { FUTURE_GRACE_HOURS, INSERT_CHUNK, lowerWatermark, rebuildTrades, USER_LOCK } from './sync.ts';
import { chainsOf, loadCorporateActions, pairKey } from './corporate-actions.ts';
import { firstByKey, SETTLE_STALE_MS } from './positions.ts';
import { contractKey, matchOptions, parseOcc, zeroCounts, type Counts, type OptionRow } from './options.ts';
import type { OptionPosition, PositionSplit } from './broker.ts';

type Db = TransactionSql | typeof sql;
export const OPTION_PAGE = 1000;
// The database's OCC pattern (lib/options.ts#parseOcc): root, YYMMDD, C or P, 8-digit strike.
// Fix round 6: matched against upper(btrim(symbol)), with any whitespace between root and date, as parseOcc does.
export const OCC_SQL_PATTERN = '^[A-Z0-9./ -]{1,6}?\\s*[0-9]{6}[CP][0-9]{8}$';
// F-35: an option row (or a corporate action) reaches the rebuild once its date has passed, on the transaction's clock
// (the clock rebuildRecord writes to users.published_through). Undated option rows pass, as before. The 24 h grace
// (FUTURE_GRACE_HOURS) bounds the re-read window only (lastOptionActivityAt).
const published = (db: Db) => db`(executed_at is null or executed_at <= now())`;
const notPaper = (db: Db, userId: number) => db`not exists (select 1 from broker_accounts b where b.account_id = o.account_id and b.user_id = ${userId} and b.is_paper)`;
// Fix round 7 (minor): an account marked as another profile's (lib/shared-accounts.ts#notShared, which rebuildTrades
// applies to activities `a`) is left out of every option query too, for rows aliased `o`.
const notSharedO = (db: Db, userId: number) => db`not exists (select 1 from shared_account_marks m where m.user_id = ${userId} and m.account_id = o.account_id)`;
type Fragment = ReturnType<Db>;
/** Fix round 7: the SQL side of lib/options.ts#hasOptionType, for a raw jsonb column: a non-empty option_type after
 *  trimming. Every option_type check in SQL goes through it. */
// btrim() trims spaces only, so a tab-only value would read as set; "has a non-whitespace character" is trim() !== ''.
export const optionTypeSet = (db: Db, raw: Fragment) => db`(coalesce(${raw}->>'option_type', '') ~ '[^[:space:]]')`;

/** D1: raw option rows, append-only (a re-insert is a no-op). A row without a date gets no contract key (counted). */
export async function insertOptionActivities(userId: number, source: 'snaptrade' | 'demo', rows: (OptionRow & { raw: unknown })[], db: Db = sql) {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK).map((r) => ({
      user_id: userId, source, external_id: r.externalId, account_id: r.accountId, contract_key: r.executedAt ? contractKey(r) : null,
      kind: r.kind, open_close: r.openClose, underlying: r.underlying, underlying_type: r.underlyingType, option_right: r.right, expiry: r.expiry,
      strike_milli: r.strikeMilli, multiplier: r.multiplier, occ_ticker: r.occTicker, contract_units: r.units, share_price: r.price, fee: r.fee, cash_amount: r.amount,
      currency: r.currency, executed_at: r.executedAt, raw: db.json(r.raw as never),
    }));
    const stored = await db`insert into option_activities ${db(chunk)} on conflict (source, external_id) do nothing returning coalesce(executed_at > now(), false) as ahead`;
    if (stored.some((r) => r.ahead)) await lowerWatermark(db, userId); // F-35: see lib/sync.ts#lowerWatermark
  }
}

/** AC 11 (E5): the newest stored broker option row (not future-dated), so an options-only trader's hourly sync re-reads
 *  only the last week. lib/sync.ts takes the later of this and the share rows' newest. */
export async function lastOptionActivityAt(tx: Db, userId: number): Promise<Date | null> {
  const [{ last }] = await tx`select max(executed_at) as last from option_activities o where user_id = ${userId} and source = 'snaptrade'
    and executed_at is not null and executed_at <= now() + ${FUTURE_GRACE_HOURS}::float8 * interval '1 hour'`;
  return (last as Date | null) ?? null;
}

type Stored = { external_id: string; account_id: string | null; kind: string | null; open_close: string | null; underlying: string | null; underlying_type: string | null;
  option_right: string | null; expiry: string | null; strike_milli: string | number | null; multiplier: number | null; occ_ticker: string | null; contract_units: number | null;
  share_price: number | null; fee: number | null; cash_amount: number | null; currency: string | null; executed_at: Date | null; source: string; contract_key: string | null; at: string | null };
const toRow = (r: Stored): OptionRow => ({
  externalId: r.external_id, accountId: r.account_id, kind: r.kind, openClose: r.open_close, underlying: r.underlying, underlyingType: r.underlying_type,
  right: r.option_right, expiry: r.expiry, strikeMilli: r.strike_milli === null ? null : Number(r.strike_milli), multiplier: r.multiplier, occTicker: r.occ_ticker,
  units: r.contract_units, price: r.share_price, fee: r.fee, amount: r.cash_amount, currency: r.currency, executedAt: r.executed_at, verified: r.source === 'snaptrade',
});
const cols = (db: Db) => db`external_id, account_id, kind, open_close, underlying, underlying_type, option_right, to_char(expiry, 'YYYY-MM-DD') as expiry, strike_milli,
  multiplier, occ_ticker, contract_units, share_price, fee, cash_amount, currency, executed_at, executed_at::text as at, source, contract_key`;
// Byte order (collate "C") keeps one contract's keys adjacent whatever the database's collation; the keyset compares the
// same way. One contract per key (the multiplier is part of it, fix round 1) (lib/options.ts groups the same way, to count a multiplier mismatch).

/** D1/D4: rebuilds the user's long option closes and both counters from the raw rows. Paper accounts and future-dated
 *  rows are left out. Keyed rows stream in contract order, OPTION_PAGE at a time (keyset on the index); a contract is
 *  matched once all its rows are read. Share closes removed by the exercise-day rule have their own counter
 *  (users.excluded_exercise_shares, set by rebuildRecord; fix round 1, QA 8). */
export async function rebuildOptionTrades(userId: number, tx: TransactionSql, asOf = new Date(), extraOther = 0): Promise<{ trades: number; short: number; other: number; counts: Counts }> {
  const counts = zeroCounts();
  let written = 0;
  await tx`delete from option_trades where user_id = ${userId}`;
  const flush = async (rows: OptionRow[]) => {
    if (!rows.length) return;
    const m = matchOptions(rows, asOf);
    for (const [k, n] of Object.entries(m.counts)) counts[k as keyof Counts] += n;
    for (let i = 0; i < m.trades.length; i += INSERT_CHUNK) {
      await tx`insert into option_trades ${tx(m.trades.slice(i, i + INSERT_CHUNK).map((t) => ({
        user_id: userId, close_id: t.closeId, account_id: t.accountId, verified: t.verified, underlying: t.underlying, option_right: t.right,
        option_expiry: t.expiry, opened_at: t.openedAt, closed_at: t.closedAt, return_pct: t.returnPct, holding_days: t.holdingDays,
      })))} on conflict do nothing returning close_id`.then((rows) => {
        // Fix round 1 (QA 12): a close whose id another trader's close holds is counted, never silently dropped.
        const dropped = Math.min(INSERT_CHUNK, m.trades.length - i) - rows.length;
        counts.duplicate += dropped;
        written += rows.length;
      });
    }
  };
  let open: OptionRow[] = [];
  let openBase: string | null = null;
  let after: { account_id: string; contract_key: string; at: string; external_id: string; source: string } | null = null;
  for (;;) {
    const page: Stored[] = await tx<Stored[]>`select ${cols(tx)} from option_activities o where o.user_id = ${userId} and o.contract_key is not null and o.account_id is not null
      and ${notPaper(tx, userId)} and ${notSharedO(tx, userId)} and ${published(tx)}
      ${after ? tx`and (o.account_id collate "C", o.contract_key collate "C", o.executed_at, o.external_id collate "C", o.source collate "C")
        > (${after.account_id}::text collate "C", ${after.contract_key}::text collate "C", ${after.at}::timestamptz, ${after.external_id}::text collate "C", ${after.source}::text collate "C")` : tx``}
      order by o.account_id collate "C", o.contract_key collate "C", o.executed_at, o.external_id collate "C", o.source collate "C" limit ${OPTION_PAGE}`;
    for (const r of page) {
      const base = `${r.account_id}#${r.contract_key}`;
      if (openBase !== null && base !== openBase) { await flush(open); open = []; }
      openBase = base;
      open.push(toRow(r));
    }
    if (page.length < OPTION_PAGE) break;
    const last: Stored = page[page.length - 1];
    after = { account_id: last.account_id!, contract_key: last.contract_key!, at: last.at!, external_id: last.external_id, source: last.source };
  }
  await flush(open);
  // Rows with no contract key (an event without its contract, a malformed row): counted, never matched.
  const loose = await tx<Stored[]>`select ${cols(tx)} from option_activities o where o.user_id = ${userId} and (o.contract_key is null or o.account_id is null)
    and ${notPaper(tx, userId)} and ${notSharedO(tx, userId)} and ${published(tx)}`;
  await flush(loose.map(toRow));
  const short = counts.short;
  // `extraOther`: option rows that reached the share path as an OCC symbol (rebuildRecord removes them from closed_trades).
  const other = Object.values(counts).reduce((a, b) => a + b, 0) - short + extraOther;
  await tx`update users set excluded_options_short = ${short}, excluded_options_other = ${other} where id = ${userId}`;
  // F-35: option rows dated after now() wait (never matched), counted on the profile's future line with the share rows.
  const [{ future }] = await tx`select count(*)::int as future from option_activities o where o.user_id = ${userId} and not (${published(tx)})
    and ${notPaper(tx, userId)} and ${notSharedO(tx, userId)}`;
  await tx`update users set excluded_future_options = ${future} where id = ${userId}`;
  return { trades: written, short, other, counts };
}

/** D4 (b): the taint set — (account, underlying, UTC day) of every exercise and assignment row, paper accounts and
 *  future-dated rows left out. */
export async function exerciseDays(tx: Db, userId: number): Promise<{ account_id: string; underlying: string; day: string }[]> {
  // Fix round 1 (review nit): a row without option_symbol taints through the activity's own symbol. Fix round 6: that
  // symbol may be the OCC contract string; its root is the underlying (parseOcc), and a symbol that is neither is used as is.
  const rows = await tx`select distinct o.account_id, coalesce(o.underlying, o.raw->'symbol'->>'symbol') as underlying,
      to_char((o.executed_at at time zone 'UTC')::date, 'YYYY-MM-DD') as day from option_activities o
    where o.user_id = ${userId} and o.kind in ('OPTIONEXERCISE', 'OPTIONASSIGNMENT') and o.account_id is not null
      and coalesce(o.underlying, o.raw->'symbol'->>'symbol') is not null
      and o.executed_at is not null and ${notPaper(tx, userId)} and ${notSharedO(tx, userId)} and ${published(tx)}`;
  const out = new Map<string, { account_id: string; underlying: string; day: string }>();
  for (const r of rows) {
    const underlying = parseOcc(r.underlying)?.root ?? (r.underlying as string);
    out.set(`${r.account_id}|${underlying}|${r.day}`, { account_id: r.account_id as string, underlying, day: r.day as string });
  }
  return [...out.values()];
}

// The option pairs among the rows the rebuild reads (paper accounts and future-dated rows left out), their closes removed.
async function removeOptionPairs(tx: TransactionSql, userId: number): Promise<number> {
  const pairs = await tx`select o.account_id, o.symbol, count(*) filter (where o.side = 'SELL')::int as sells from activities o
    where o.user_id = ${userId} and (upper(btrim(o.symbol)) ~ ${OCC_SQL_PATTERN} or ${optionTypeSet(tx, tx`o.raw`)})
      and ${notPaper(tx, userId)} and ${notSharedO(tx, userId)} and ${published(tx)} group by o.account_id, o.symbol`;
  if (!pairs.length) return 0;
  const hit = await tx`select c.sell_id, c.thesis, c.thesis_status from closed_trades c
    join (select * from jsonb_to_recordset(${tx.json(pairs.map((p) => ({ account_id: p.account_id, symbol: p.symbol })) as never)}::jsonb) as t(account_id text, symbol text)) t
      on t.account_id = c.account_id and t.symbol = c.symbol
    where c.user_id = ${userId}`;
  await keepTheses(tx, userId, hit.filter((h) => h.thesis !== null));
  if (hit.length) await tx`delete from closed_trades where user_id = ${userId} and sell_id in ${tx(hit.map((h) => h.sell_id as string))}`;
  const sells = pairs.reduce((a, p) => a + (p.sells as number), 0);
  const orphans = Math.max(0, sells - hit.length);
  if (orphans) await tx`update users set excluded_positions = greatest(0, excluded_positions - ${orphans}) where id = ${userId}`;
  return sells;
}

/** Fix round 6 (orchestrator review blocking 1): records rebuilt before this PR (frozen ones never sync again) may still
 *  hold a close from an option pair. Rebuilds each such record with rebuildRecord under the trader's lock. Idempotent:
 *  a repaired record holds no such close, so the next call finds nothing. Run by scripts/db-setup.ts. `ids` is a test hook. */
export async function repairOptionShareCloses(ids?: number[]): Promise<number> {
  const users = await sql`select distinct c.user_id from closed_trades c
    where ${ids ? sql`c.user_id in ${sql(ids.length ? ids : [0])} and` : sql``}
      (upper(btrim(c.symbol)) ~ ${OCC_SQL_PATTERN} or exists (select 1 from activities a where a.user_id = c.user_id and a.account_id = c.account_id
        and a.symbol = c.symbol and (upper(btrim(a.symbol)) ~ ${OCC_SQL_PATTERN} or ${optionTypeSet(sql, sql`a.raw`)})))`;
  for (const u of users) {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${USER_LOCK}, ${u.user_id as number})`;
      await rebuildRecord(u.user_id as number, tx);
    });
  }
  return users.length;
}

// Theses of closes the rebuild removes go to kept_theses (re-attached by sell_id if the close returns), with the same
// `on conflict` as rebuildTrades.
async function keepTheses(tx: TransactionSql, userId: number, rows: readonly Record<string, unknown>[]) {
  if (!rows.length) return;
  await tx`insert into kept_theses ${tx(rows.map((k) => ({ user_id: userId, sell_id: k.sell_id as string, thesis: k.thesis as string, thesis_status: k.thesis_status as string })))}
    on conflict (user_id, sell_id) do update set thesis = excluded.thesis, thesis_status = excluded.thesis_status`;
}

// Each taint row widened to every symbol of its rename chain in the same account (lib/corporate-actions.ts#chainsOf,
// the user's actions as rebuildTrades reads them: paper accounts and future-dated rows left out).
export async function withRenames(tx: TransactionSql, userId: number, taint: { account_id: string; underlying: string; day: string }[]) {
  if (!taint.length) return taint;
  const chainOf = chainsOf(await loadCorporateActions(tx, userId, published(tx)));
  if (!chainOf.size) return taint;
  const members = new Map<string, string[]>(); // chain id → its pair keys
  for (const [k, id] of chainOf) { const g = members.get(id); if (g) g.push(k); else members.set(id, [k]); }
  const out = new Map<string, { account_id: string; underlying: string; day: string }>();
  for (const t of taint) {
    const id = chainOf.get(pairKey(t.account_id, t.underlying));
    for (const k of id ? members.get(id)! : [pairKey(t.account_id, t.underlying)]) {
      const symbol = k.slice(k.lastIndexOf('|') + 1);
      out.set(`${t.account_id}|${symbol}|${t.day}`, { account_id: t.account_id, underlying: symbol, day: t.day });
    }
  }
  return [...out.values()];
}

/** D4 (a)–(d), round 3: the whole record rebuild, in one transaction. Callers use this instead of rebuildTrades. */
export async function rebuildRecord(userId: number, tx?: TransactionSql, asOf = new Date()) {
  // F-24 (D4): every rebuild that changes or removes a close already shown (share or option) is counted and logged
  // (lib/reconcile.ts#logRewrites: the internal user id and counts only). Theses are not part of the comparison.
  // ponytail: the snapshot reads every close's hash twice per rebuild, even when nothing new was stored — fix: take it
  // only when the transaction stored a raw row, changed a re-issue state or the account set (reliability r1-8).
  const run = async (tx: TransactionSql) => {
    const before = await snapshotCloses(tx, userId);
    const out = await rebuildAll(tx);
    await logRewrites(tx, userId, before);
    return out;
  };
  const rebuildAll = async (tx: TransactionSql) => {
    const shares = await rebuildTrades(userId, tx); // (a) unchanged
    // (b) + (c): share closes in the same account and stock whose hold spans an exercise or assignment day. Their
    // theses are kept aside (re-attached by sell_id when the taint goes), the closes are removed and counted.
    // This is part of the rebuild that derives closed_trades (re-applied on every rebuild), not a patch of stored rows.
    // ponytail: K8 the exercise-day rule removes every share close in that account and stock whose hold spans the day (it
    // can remove an unrelated trade, and it keeps delivered buys, whose basis leaves out the premium); shares delivered or
    // removed by an exercise or assignment may also arrive as PR #40's transfer-in or adjustment rows (its lot handling;
    // renames are followed, fix round 2) — the exact rule, per delivered or removed lot, belongs inside the share matcher.
    // Fix round 1 (review 5, QA 3), round 6 (orchestrator review blocking 1): an option row stored on the share path before
    // the importer routed it never becomes a public close. Every (account, symbol) with a row whose symbol is an OCC
    // contract or whose raw row carries option_type is an option pair: its closes are removed on every rebuild (theses
    // kept aside, round 2) and each of its sells — a close or a sell with no entry — is counted once, under options; a
    // sell with no entry leaves users.excluded_positions so it is not counted twice.
    const occRemoved = await removeOptionPairs(tx, userId);
    // Fix round 2 (re-review A): a rename (PR #40's chain matching) gives the close the new symbol, so each taint row
    // covers every symbol in its rename chain, in the same account, as rebuildTrades matches them.
    const taint = await withRenames(tx, userId, await exerciseDays(tx, userId));
    let removed = 0;
    if (taint.length) {
      const hit = await tx`select c.sell_id, c.thesis, c.thesis_status from closed_trades c
        join (select * from jsonb_to_recordset(${tx.json(taint as never)}::jsonb) as t(account_id text, underlying text, day date)) t
          on t.account_id = c.account_id and t.underlying = c.symbol
         and (c.opened_at at time zone 'UTC')::date <= t.day and t.day <= (c.closed_at at time zone 'UTC')::date
        where c.user_id = ${userId} group by c.sell_id, c.thesis, c.thesis_status`;
      await keepTheses(tx, userId, hit.filter((h) => h.thesis !== null));
      if (hit.length) removed = (await tx`delete from closed_trades where user_id = ${userId} and sell_id in ${tx(hit.map((h) => h.sell_id as string))}`).count;
    }
    await tx`update users set excluded_exercise_shares = ${removed} where id = ${userId}`;
    const options = await rebuildOptionTrades(userId, tx, asOf, occRemoved); // (d)
    // F-35: the watermark is this rebuild's own publish clock (the transaction's now(), never greatest()): every share,
    // option and corporate-action row dated at or before it was in the published set above. Same transaction, so it
    // advances only when the rebuild commits.
    await tx`update users set published_through = now() where id = ${userId}`;
    return { ...shares, removedForExercise: removed, occRemoved, options };
  };
  return tx ? run(tx) : sql.begin(run);
}

/** F-35: a rebuild with no vendor read (the matured pass): rebuildRecord, then `last_synced_at` ("Updated", the claim
 *  order) put back, since rebuildTrades stamps it and nothing was read from the vendor. */
export async function rebuildWithoutRead(userId: number, tx: TransactionSql) {
  const [{ prev }] = await tx`select last_synced_at::text as prev from users where id = ${userId}`;
  const out = await rebuildRecord(userId, tx);
  await tx`update users set last_synced_at = ${prev}::text::timestamptz where id = ${userId}`;
  return out;
}

/** D7: long open option positions per account (percent per share), and the short and futures-type counts. `accounts`
 *  null replaces every row of the user and sets the counts; a list replaces only those accounts' rows and adds the
 *  counts (an import step that reads the rest of the accounts' positions, lib/connections.ts). */
export async function replaceOptionPositions(tx: TransactionSql, userId: number, accounts: string[] | null, splits: Map<string, PositionSplit>) {
  const rows: (OptionPosition & { accountId: string })[] = [];
  let short = 0, unsupported = 0;
  let other = 0;
  for (const [accountId, s] of splits) { for (const o of s.options) rows.push({ ...o, accountId }); short += s.short; unsupported += s.unsupported; other += s.optionOther ?? 0; }
  // F-14: the same counts per account (users.open_options_by_account), so the cadence sync can replace one account's.
  const byAccount = tx.json(splitCounts(splits) as never);
  if (accounts === null) {
    await tx`delete from open_option_positions where user_id = ${userId}`;
    await tx`update users set open_options_short = ${short}, open_unsupported = ${unsupported}, open_options_other = ${other},
      open_options_by_account = ${byAccount} where id = ${userId}`;
  } else {
    if (!accounts.length) return;
    await tx`delete from open_option_positions where user_id = ${userId} and account_id in ${tx(accounts)}`;
    await tx`update users set open_options_short = open_options_short + ${short}, open_unsupported = open_unsupported + ${unsupported},
      open_options_other = open_options_other + ${other},
      open_options_by_account = case when open_options_by_account is null then null else open_options_by_account || ${byAccount} end where id = ${userId}`;
  }
  if (rows.length) {
    await tx`insert into open_option_positions ${tx(rows.map((p) => ({ user_id: userId, account_id: p.accountId, position_key: p.positionKey, underlying: p.underlying,
      option_right: p.right, option_expiry: p.expiry, unrealized_pct: p.unrealizedPct })))} on conflict do nothing`;
  }
  await purgeOccPositions(tx, userId);
}

// Fixes cycle 3, F3-4 (merge with options): positions are replaced per account read, never per user. A sync reads every
// account the vendor lists; the option rows of the trader's other accounts (one no longer listed, frozen or simulated)
// move here first, kept with their read time and rendered nowhere until the owner decides OD-9 (Q2), like
// lib/positions.ts#replaceListedPositions. A relisted account's private rows go (its fresh ones replace them).
export async function moveUnlistedOptionPositions(tx: TransactionSql, userId: number, listed: string[]) {
  const ids = tx(listed.length ? listed : ['']);
  await tx`with moved as (delete from open_option_positions where user_id = ${userId} and account_id not in ${ids}
      returning user_id, account_id, position_key, underlying, option_right, option_expiry, unrealized_pct, fetched_at)
    insert into unlisted_option_positions (user_id, account_id, position_key, underlying, option_right, option_expiry, unrealized_pct, fetched_at)
    select * from moved
    on conflict (user_id, account_id, position_key) do update set underlying = excluded.underlying, option_right = excluded.option_right,
      option_expiry = excluded.option_expiry, unrealized_pct = excluded.unrealized_pct, fetched_at = excluded.fetched_at, unlisted_at = now()`;
  if (listed.length) await tx`delete from unlisted_option_positions where user_id = ${userId} and account_id in ${ids}`;
}

// F3-4: an import step's option positions. Only the accounts it read are replaced, so an earlier connection's positions
// and counts stay. `accounts` are this connection's real accounts; the trader's other known accounts (held rows and
// per-account counts) are passed to replaceAccountOptionPositions as still real, so none of them is dropped. A record
// with nothing stored yet starts its per-account counts here.
// ponytail: a record with option positions or counts from before users.open_options_by_account keeps them as they are,
// and a second connection's import writes none of its own, until a sync reads every account — fix: backfill the
// per-account counts once from a full positions read.
export async function replaceImportedOptionPositions(tx: TransactionSql, userId: number, accounts: string[], read: string[], splits: Map<string, PositionSplit>) {
  await tx`update users u set open_options_by_account = '{}'::jsonb where u.id = ${userId} and u.open_options_by_account is null
    and u.open_options_short = 0 and u.open_unsupported = 0 and u.open_options_other = 0
    and not exists (select 1 from open_option_positions p where p.user_id = u.id)`;
  const [u] = await tx`select open_options_by_account as m from users where id = ${userId}`;
  const held = (await tx`select distinct account_id from open_option_positions where user_id = ${userId}`).map((r) => r.account_id as string);
  const known = [...new Set([...accounts, ...held, ...Object.keys((u?.m ?? {}) as Record<string, unknown>)])];
  // Every account an import step read comes with its whole history (its closes are imported): the replace rule.
  await replaceAccountOptionPositions(tx, userId, known, read, [], splits);
}

/** D7 (E1): removes open_positions rows whose symbol is an OCC contract (it carries the strike). Runs after each
 *  positions write (one user) and in scripts/db-setup.ts and the privacy purge (everyone, frozen traders included). Not
 *  in schema.sql, which may not delete. Returns how many rows went. */
// ponytail: an option on a future stored in open_positions before this PR (a frozen trader's) also carries a strike, but
// futures option symbols have no one safe pattern across venues, so they are not purged here — the positions endpoint now
// counts every future_option as unsupported (never stored); purge them by instrument id if the vendor's ids are kept.
export async function purgeOccPositions(db: Db = sql, userId?: number): Promise<number> {
  const r = await db`delete from open_positions where upper(btrim(symbol)) ~ ${OCC_SQL_PATTERN} ${userId === undefined ? db`` : db`and user_id = ${userId}`}`;
  return r.count;
}

// ---- Fix round 1 (review 4): the one-time per-connection option backfill. Connections consented before options were
// imported read only the last week on each sync, so older option rows (and closes whose opens predate the window)
// would never arrive. Until `options_backfilled_at` is set, each sync reads one more page of each such account's whole
// history (with the option types) instead of its one 7-day request, so a sync makes the same number of vendor requests
// (lib/sync.ts#syncCost holds). Rows are idempotent; the cursor keeps each account's next offset; the column is stamped
// once every listed account is read to its end. An import (whole history) and a first sync with no stored rows stamp it.
// ponytail: a history longer than one vendor page takes one sync per page, and that account's last-week read waits
// until its backfill ends (a few hours for most records) — read both when the per-sync request budget grows.
export async function pendingBackfill(tx: Db, userId: number): Promise<Map<string, number>> {
  const rows = await tx`select accounts, options_backfill_cursor as cursor from connections
    where user_id = ${userId} and state = 'connected' and options_backfilled_at is null`;
  const out = new Map<string, number>();
  for (const c of rows) {
    const cursor = (c.cursor ?? {}) as Record<string, number>;
    for (const a of c.accounts as { id: string; isPaper?: boolean }[]) {
      if (a.isPaper || cursor[a.id] === -1) continue;
      out.set(a.id, cursor[a.id] ?? 0);
    }
  }
  return out;
}
/** Saves each account's progress (next offset, or -1 when read to the end) and stamps every connection whose listed
 *  real accounts are all read. */
export async function saveBackfill(tx: Db, userId: number, listed: string[], progress: Map<string, number>) {
  const rows = await tx`select id, accounts, options_backfill_cursor as cursor from connections
    where user_id = ${userId} and state = 'connected' and options_backfilled_at is null`;
  for (const c of rows) {
    const cursor = { ...((c.cursor ?? {}) as Record<string, number>) };
    const mine = (c.accounts as { id: string; isPaper?: boolean }[]).filter((a) => !a.isPaper);
    for (const a of mine) if (progress.has(a.id)) cursor[a.id] = progress.get(a.id)!;
    // Fix round 4 (N4): a connection with no listed account read is never stamped (an empty set is not "all read").
    const read = mine.filter((a) => listed.includes(a.id));
    const done = read.length > 0 && read.every((a) => cursor[a.id] === -1);
    await tx`update connections set options_backfill_cursor = ${tx.json(cursor as never)}, options_backfilled_at = ${done ? tx`now()` : null}
      where id = ${c.id as number}`;
  }
}
/** A whole-history read (an import, or a first sync with nothing stored) covers options too. */
export async function markBackfilled(tx: Db, userId: number) {
  await tx`update connections set options_backfilled_at = now() where user_id = ${userId} and consent_at is not null and options_backfilled_at is null`;
}

// F-14 sync cadence (lib/sync.ts, `cadence`): positions are read per account on their own clock, so one sync may read
// some accounts and not others. Each read account's option positions and counts are replaced, those of accounts no
// longer real are dropped, and the others stay as last read; the user's totals are the sum of the per-account counts.
type SplitCount = { short: number; unsupported: number; other: number };
function splitCounts(splits: Map<string, PositionSplit>): Record<string, SplitCount> {
  const out: Record<string, SplitCount> = {};
  for (const [accountId, s] of splits) out[accountId] = { short: s.short, unsupported: s.unsupported, other: s.optionOther ?? 0 };
  return out;
}
export async function replaceAccountOptionPositions(tx: TransactionSql, userId: number, real: string[], replace: string[], upsert: string[], splits: Map<string, PositionSplit>,
  opts: { settle?: boolean } = {}) {
  const [u] = await tx`select open_options_by_account as m from users where id = ${userId}`;
  const prev = (u?.m ?? null) as Record<string, SplitCount> | null;
  const readNow = [...new Set([...replace, ...upsert])];
  // The per-account counts start at the first sync that reads every real account (its first cadence sync: no account
  // has a positions read yet), whichever rule each account's read takes.
  // ponytail: a record whose per-account counts were never started keeps its totals and option positions until all its
  // accounts are read in one sync — unreachable in practice, since its first cadence sync reads every account.
  if (prev === null && !real.every((id) => readNow.includes(id))) return;
  const held = (await tx`select distinct account_id from open_option_positions where user_id = ${userId}`).map((r) => r.account_id as string);
  const gone = [...new Set([...held, ...Object.keys(prev ?? {})])].filter((id) => !real.includes(id));
  if (!readNow.length && !gone.length) return;
  // Counts are open-position tallies (never shown as returns): every account read sets its own; gone accounts drop.
  const next: Record<string, SplitCount> = {};
  for (const [id, c] of Object.entries(prev ?? {})) if (!readNow.includes(id) && !gone.includes(id)) next[id] = c;
  const counts = splitCounts(splits);
  for (const id of readNow) next[id] = counts[id] ?? { short: 0, unsupported: 0, other: 0 };
  const sum = (k: keyof SplitCount) => Object.values(next).reduce((n, c) => n + c[k], 0);
  // Rows: gone accounts' rows go. `replace` accounts: without `settle` (an import, the sync without cadence, which read
  // every account) their rows are replaced; with `settle` (the cadence sync, TR-4, the share rule of
  // lib/positions.ts#settleAccountPositions) a row the vendor no longer lists goes once a closing row of its contract was
  // imported since it was last listed (a close, an expiry, an assignment or an exercise: its trade, or its counted
  // exclusion, is published in this transaction), or after SETTLE_STALE_MS unlisted. `upsert` accounts (a positions-only
  // read) never lose a row (review B1).
  if (gone.length) await tx`delete from open_option_positions where user_id = ${userId} and account_id in ${tx(gone)}`;
  if (!opts.settle && replace.length) await tx`delete from open_option_positions where user_id = ${userId} and account_id in ${tx(replace)}`;
  // ponytail: a closing option row with no contract key (a malformed vendor row, counted) cannot be matched, so its
  // position falls back to the 3-day rule — fix: match on the OCC ticker when the parsed key is missing.
  for (const id of opts.settle ? replace : []) {
    const listed = (splits.get(id)?.options ?? []).map((o) => o.positionKey);
    await tx`delete from open_option_positions p where p.user_id = ${userId} and p.account_id = ${id}
      ${listed.length ? tx`and p.position_key not in ${tx(listed)}` : tx``}
      and (exists (select 1 from option_activities a where a.user_id = p.user_id and a.contract_key = p.account_id || '|' || p.position_key
            and a.created_at >= p.fetched_at
            and (a.open_close in ('SELL_TO_CLOSE', 'BUY_TO_CLOSE') or a.kind in ('OPTIONEXPIRATION', 'OPTIONASSIGNMENT', 'OPTIONEXERCISE')))
        or p.fetched_at < now() - ${SETTLE_STALE_MS}::float8 * interval '1 millisecond')`;
  }
  await tx`update users set open_options_short = ${sum('short')}, open_unsupported = ${sum('unsupported')}, open_options_other = ${sum('other')},
    open_options_by_account = ${tx.json(next as never)} where id = ${userId}`;
  const listedRows: (OptionPosition & { accountId: string })[] = [];
  for (const id of readNow) for (const o of splits.get(id)?.options ?? []) listedRows.push({ ...o, accountId: id });
  const rows = firstByKey(listedRows, (p) => `${p.accountId}\u0000${p.positionKey}`); // two lots of one contract: the first
  if (rows.length) {
    await tx`insert into open_option_positions ${tx(rows.map((p) => ({ user_id: userId, account_id: p.accountId, position_key: p.positionKey, underlying: p.underlying,
      option_right: p.right, option_expiry: p.expiry, unrealized_pct: p.unrealizedPct })))}
      on conflict (user_id, account_id, position_key) do update set unrealized_pct = excluded.unrealized_pct, underlying = excluded.underlying,
        option_right = excluded.option_right, option_expiry = excluded.option_expiry, fetched_at = now()`;
  }
  await purgeOccPositions(tx, userId);
}

// F-24 (docs/features/F-24-late-sell-reconciliation.md): the option side of the late-postings work, here because this file
// is the one allowed to read the option tables (lib/options-load.test.ts AC23).
/** Option rows with an older twin stored in this transaction (counted, not held: plan item 10, owner item). */
// ponytail: option twins are counted, not held, so a re-issued option close can show twice until the owner decides —
// fix: the same hold (an option_activities filter in rebuildOptionTrades) and decisions as share rows.
export async function optionTwins(tx: TransactionSql, userId: number): Promise<number> {
  const [{ n }] = await tx`select count(distinct n.external_id)::int as n from option_activities n join option_activities e on e.user_id = n.user_id and e.source = n.source
      and e.account_id is not distinct from n.account_id and e.contract_key is not distinct from n.contract_key and e.kind is not distinct from n.kind
      and e.open_close is not distinct from n.open_close and e.executed_at = n.executed_at and e.contract_units is not distinct from n.contract_units
      and e.share_price is not distinct from n.share_price and e.external_id <> n.external_id and e.xmin <> pg_current_xact_id()::xid
    where n.user_id = ${userId} and n.source = 'snaptrade' and n.xmin = pg_current_xact_id()::xid`; // stored by this transaction
  return n as number;
}

// ---- D4: the close-change log ----
type Snapshot = { ids: string[]; hashes: string[] };
const closes = (db: Db, userId: number) => db`select 's:' || sell_id as id, md5((account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)::text) as h
    from closed_trades where user_id = ${userId}
  union all select 'o:' || close_id, md5((account_id, underlying, option_right, option_expiry, opened_at, closed_at, return_pct, holding_days, verified)::text)
    from option_trades where user_id = ${userId}`;
/** The user's shown closes (share and option), as ids and row hashes (theses left out: a thesis edit is the trader's). */
export async function snapshotCloses(tx: TransactionSql, userId: number): Promise<Snapshot> {
  const [r] = await tx`select coalesce(array_agg(id), '{}') as ids, coalesce(array_agg(h), '{}') as hashes from (${closes(tx, userId)}) c`;
  return { ids: r.ids as string[], hashes: r.hashes as string[] };
}
/** Compares the closes now with a snapshot. Changed or removed closes that were already shown are added to
 *  users.closes_rewritten and logged (the internal user id and counts only). */
export async function logRewrites(tx: TransactionSql, userId: number, before: Snapshot) {
  const [r] = await tx`with b as (select * from unnest(${before.ids}::text[], ${before.hashes}::text[]) b(id, h)), a as (${closes(tx, userId)})
    select count(*) filter (where a.id is not null and b.id is not null and a.h is distinct from b.h)::int as changed,
      count(*) filter (where a.id is null)::int as removed, count(*) filter (where b.id is null)::int as added
    from b full join a on a.id = b.id`;
  const changed = r.changed as number, removed = r.removed as number, added = r.added as number;
  if (changed + removed > 0) {
    await tx`update users set closes_rewritten = closes_rewritten + ${changed + removed} where id = ${userId}`;
    const id = userId;
    console.log('sync closes rewritten', id, JSON.stringify({ changed, removed, added }));
  }
  return { changed, removed, added };
}

/** F-24: the account's stored broker option rows (a pass's page bound counts every row the activities read returns). */
export async function optionActivityCount(tx: Db, userId: number, accountId: string): Promise<number> {
  const [{ n }] = await tx`select count(*)::int as n from option_activities where user_id = ${userId} and account_id = ${accountId} and source = 'snaptrade'`;
  return n as number;
}

/** F-24 (lib/sync-cadence.ts#dueRequestsSql): a fragment counting the user's stored broker option rows of an account
 *  dated on or after `since` (the widened confirm read's vendor pages). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const optionRowsSince = (userId: any, accountId: any, since: any) => sql`(select count(*) from option_activities req_o
  where req_o.user_id = ${userId} and req_o.account_id = ${accountId} and req_o.source = 'snaptrade' and req_o.executed_at >= ${since})`;

