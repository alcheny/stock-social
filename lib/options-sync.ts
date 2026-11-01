// OPTIONS (docs/features/logs/options/plan.md D1, D4, D7): every write to the option tables, and the reads the rebuild
// needs (the one file besides lib/options-load.ts allowed to read them, lib/options-load.test.ts). lib/sync.ts and
// lib/connections.ts only call these helpers; rebuildTrades and lib/trades.ts are untouched.
import type { TransactionSql } from 'postgres';
import { sql } from './db.ts';
import { FUTURE_GRACE_HOURS, INSERT_CHUNK, rebuildTrades } from './sync.ts';
import { contractKey, matchOptions, zeroCounts, type Counts, type OptionRow } from './options.ts';
import type { OptionPosition, PositionSplit } from './broker.ts';

type Db = TransactionSql | typeof sql;
export const OPTION_PAGE = 1000;
// The database's OCC pattern (lib/options.ts#parseOcc): root, YYMMDD, C or P, 8-digit strike.
export const OCC_SQL_PATTERN = '^[A-Z0-9./ -]{1,6}?[ ]*[0-9]{6}[CP][0-9]{8}$';
const notFuture = (db: Db) => db`(executed_at is null or executed_at <= now() + ${FUTURE_GRACE_HOURS}::float8 * interval '1 hour')`;
const notPaper = (db: Db, userId: number) => db`not exists (select 1 from broker_accounts b where b.account_id = o.account_id and b.user_id = ${userId} and b.is_paper)`;

/** D1: raw option rows, append-only (a re-insert is a no-op). A row without a date gets no contract key (counted). */
export async function insertOptionActivities(userId: number, source: 'snaptrade' | 'demo', rows: (OptionRow & { raw: unknown })[], db: Db = sql) {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK).map((r) => ({
      user_id: userId, source, external_id: r.externalId, account_id: r.accountId, contract_key: r.executedAt ? contractKey(r) : null,
      kind: r.kind, open_close: r.openClose, underlying: r.underlying, underlying_type: r.underlyingType, option_right: r.right, expiry: r.expiry,
      strike_milli: r.strikeMilli, multiplier: r.multiplier, occ_ticker: r.occTicker, contract_units: r.units, share_price: r.price, fee: r.fee, cash_amount: r.amount,
      currency: r.currency, executed_at: r.executedAt, raw: db.json(r.raw as never),
    }));
    await db`insert into option_activities ${db(chunk)} on conflict (source, external_id) do nothing`;
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
// same way. One contract regardless of multiplier (lib/options.ts groups the same way, to count a multiplier mismatch).
const baseOf = (key: string) => key.slice(0, key.lastIndexOf('|'));

/** D1/D4: rebuilds the user's long option closes and both counters from the raw rows. Paper accounts and future-dated
 *  rows are left out. Keyed rows stream in contract order, OPTION_PAGE at a time (keyset on the index); a contract is
 *  matched once all its rows are read. `extraOther` adds the share closes removed by the exercise-day rule. */
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
      })))} on conflict (close_id) do nothing`;
    }
    written += m.trades.length;
  };
  let open: OptionRow[] = [];
  let openBase: string | null = null;
  let after: { account_id: string; contract_key: string; at: string; external_id: string; source: string } | null = null;
  for (;;) {
    const page: Stored[] = await tx<Stored[]>`select ${cols(tx)} from option_activities o where o.user_id = ${userId} and o.contract_key is not null and o.account_id is not null
      and ${notPaper(tx, userId)} and ${notFuture(tx)}
      ${after ? tx`and (o.account_id collate "C", o.contract_key collate "C", o.executed_at, o.external_id collate "C", o.source collate "C")
        > (${after.account_id}::text collate "C", ${after.contract_key}::text collate "C", ${after.at}::timestamptz, ${after.external_id}::text collate "C", ${after.source}::text collate "C")` : tx``}
      order by o.account_id collate "C", o.contract_key collate "C", o.executed_at, o.external_id collate "C", o.source collate "C" limit ${OPTION_PAGE}`;
    for (const r of page) {
      const base = `${r.account_id}#${baseOf(r.contract_key!)}`;
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
    and ${notPaper(tx, userId)} and ${notFuture(tx)}`;
  await flush(loose.map(toRow));
  const short = counts.short;
  const other = Object.values(counts).reduce((a, b) => a + b, 0) - short + extraOther;
  await tx`update users set excluded_options_short = ${short}, excluded_options_other = ${other} where id = ${userId}`;
  return { trades: written, short, other, counts };
}

/** D4 (b): the taint set — (account, underlying, UTC day) of every exercise and assignment row, paper accounts and
 *  future-dated rows left out. */
export async function exerciseDays(tx: Db, userId: number): Promise<{ account_id: string; underlying: string; day: string }[]> {
  return tx`select distinct o.account_id, o.underlying, to_char((o.executed_at at time zone 'UTC')::date, 'YYYY-MM-DD') as day from option_activities o
    where o.user_id = ${userId} and o.kind in ('OPTIONEXERCISE', 'OPTIONASSIGNMENT') and o.account_id is not null and o.underlying is not null
      and o.executed_at is not null and ${notPaper(tx, userId)} and ${notFuture(tx)}` as never;
}

/** D4 (a)–(d), round 3: the whole record rebuild, in one transaction. Callers use this instead of rebuildTrades. */
export async function rebuildRecord(userId: number, tx?: TransactionSql, asOf = new Date()) {
  const run = async (tx: TransactionSql) => {
    const shares = await rebuildTrades(userId, tx); // (a) unchanged
    // (b) + (c): share closes in the same account and stock whose hold spans an exercise or assignment day. Their
    // theses are kept aside (re-attached by sell_id when the taint goes), the closes are removed and counted.
    // This is part of the rebuild that derives closed_trades (re-applied on every rebuild), not a patch of stored rows.
    // ponytail: K8 the exercise-day rule removes every share close in that account and stock whose hold spans the day, so
    // it can remove an unrelated trade, and it keeps delivered buys (their basis leaves out the premium). Shares delivered
    // or removed by an exercise or assignment may also arrive as the corporate-actions importer's transfer-in or
    // adjustment rows (PR #40's lot handling). The exact rule belongs inside the matcher once PR #40 has merged.
    const taint = await exerciseDays(tx, userId);
    let removed = 0;
    if (taint.length) {
      const hit = await tx`select c.sell_id, c.thesis, c.thesis_status from closed_trades c
        join (select * from jsonb_to_recordset(${tx.json(taint as never)}::jsonb) as t(account_id text, underlying text, day date)) t
          on t.account_id = c.account_id and t.underlying = c.symbol
         and (c.opened_at at time zone 'UTC')::date <= t.day and t.day <= (c.closed_at at time zone 'UTC')::date
        where c.user_id = ${userId} group by c.sell_id, c.thesis, c.thesis_status`;
      const kept = hit.filter((h) => h.thesis !== null);
      if (kept.length) {
        await tx`insert into kept_theses ${tx(kept.map((k) => ({ user_id: userId, sell_id: k.sell_id, thesis: k.thesis, thesis_status: k.thesis_status })))}
          on conflict (user_id, sell_id) do update set thesis = excluded.thesis, thesis_status = excluded.thesis_status`;
      }
      if (hit.length) removed = (await tx`delete from closed_trades where user_id = ${userId} and sell_id in ${tx(hit.map((h) => h.sell_id as string))}`).count;
    }
    const options = await rebuildOptionTrades(userId, tx, asOf, removed); // (d)
    return { ...shares, removedForExercise: removed, options };
  };
  return tx ? run(tx) : sql.begin(run);
}

/** D7: long open option positions per account (percent per share), and the short and futures-type counts. `accounts`
 *  null replaces every row of the user and sets the counts; a list replaces only those accounts' rows and adds the
 *  counts (an import step that reads the rest of the accounts' positions, lib/connections.ts). */
export async function replaceOptionPositions(tx: TransactionSql, userId: number, accounts: string[] | null, splits: Map<string, PositionSplit>) {
  const rows: (OptionPosition & { accountId: string })[] = [];
  let short = 0, unsupported = 0;
  for (const [accountId, s] of splits) { for (const o of s.options) rows.push({ ...o, accountId }); short += s.short; unsupported += s.unsupported; }
  if (accounts === null) {
    await tx`delete from open_option_positions where user_id = ${userId}`;
    await tx`update users set open_options_short = ${short}, open_unsupported = ${unsupported} where id = ${userId}`;
  } else {
    if (!accounts.length) return;
    await tx`delete from open_option_positions where user_id = ${userId} and account_id in ${tx(accounts)}`;
    await tx`update users set open_options_short = open_options_short + ${short}, open_unsupported = open_unsupported + ${unsupported} where id = ${userId}`;
  }
  if (rows.length) {
    await tx`insert into open_option_positions ${tx(rows.map((p) => ({ user_id: userId, account_id: p.accountId, position_key: p.positionKey, underlying: p.underlying,
      option_right: p.right, option_expiry: p.expiry, unrealized_pct: p.unrealizedPct })))} on conflict do nothing`;
  }
  await purgeOccPositions(tx, userId);
}

/** D7 (E1): removes open_positions rows whose symbol is an OCC contract (it carries the strike). Runs after each
 *  positions write (one user) and in scripts/db-setup.ts and the privacy purge (everyone, frozen traders included). Not
 *  in schema.sql, which may not delete. Returns how many rows went. */
export async function purgeOccPositions(db: Db = sql, userId?: number): Promise<number> {
  const r = await db`delete from open_positions where upper(symbol) ~ ${OCC_SQL_PATTERN} ${userId === undefined ? db`` : db`and user_id = ${userId}`}`;
  return r.count;
}
