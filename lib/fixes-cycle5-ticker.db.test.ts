// FIXES-CYCLE5 (F5-4, F5-27): the ticker pages read ticker_trader_sums (db/schema.sql, app/t/ticker-sums.ts) instead of
// every closed trade. The statements they replaced are kept below as the oracle and run in the same snapshot as the new
// reads, on a fixture of this file's own (traders sharing symbols, verified and Demo rows, overlapping holds, a deleted
// trader, a public filing row). Plan shape and cost are proven with EXPLAIN rows read and pg_stat_xact_user_tables,
// never with wall-clock bounds. Fixtures use their own random symbols and handles and remove only their own users.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { confidenceFromSums, pct, type Confidence } from './trades.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 600_000 }, fn);
const SCHEMA = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(SCHEMA).simple(); });
const made: number[] = [];
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  if (made.length) await sql`delete from users where id in ${sql(made)}`;
  await sql.end({ timeout: 1 });
});

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 1, 2);
const rand = () => Math.random().toString(36).slice(2, 7).toUpperCase().replace(/^[0-9]/, 'Q');
type Db = postgres.Sql | postgres.TransactionSql;

async function users(n: number): Promise<number[]> {
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `fc5wp3${Math.random().toString(36).slice(2, 8)}`;
  const ids: number[] = [];
  for (let i = 0; i < n; i++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${i}` })).id);
  made.push(...ids);
  return ids;
}

let seq = 0;
type Close = { user: number; symbol: string; open: number; close: number; r: number; verified?: boolean; filing?: boolean; hold?: number };
const row = (c: Close) => ({
  user_id: c.user, sell_id: `fc5wp3-${Date.now()}-${seq++}-${Math.random()}`, account_id: 'fc5wp3', symbol: c.symbol,
  opened_at: new Date(T0 + c.open * DAY), closed_at: new Date(T0 + c.close * DAY), return_pct: c.r,
  holding_days: c.hold ?? c.close - c.open, verified: c.verified ?? true, filing_url: c.filing ? 'https://example.test/filing' : null,
});
async function insert(db: Db, closes: Close[]) { if (closes.length) await db`insert into closed_trades ${db(closes.map(row))}`; }

// ---- The oracle: the statements app/t/ticker-sql.ts ran before F5-4 (a281ff04), verbatim but for their names. ----
async function oldIndex(tx: Db, q: unknown, sort: 'recent' | 'az', cap: number) {
  const { normalizeSymbol } = await import('./ticker.ts');
  const { likePrefix } = await import('../app/t/ticker-sql.ts');
  const vis = tx`select v.id from users v where v.deleted_at is null`;
  const [{ total }] = (await tx`select count(distinct symbol)::int as total from closed_trades where filing_url is null and user_id in (${vis})`) as unknown as { total: number }[];
  let kind = 'all';
  let symbol: string | undefined;
  if (typeof q === 'string' && q.trim()) {
    const s = normalizeSymbol(q);
    if (!s) return { total, kind: 'invalid', matched: 0, rows: [] };
    symbol = s; kind = 'prefix';
  }
  const order = sort === 'az' ? tx`symbol collate "C"` : tx`date_trunc('milliseconds', max(closed_at)) desc, symbol collate "C"`;
  const prefix = symbol ? tx`and symbol like ${likePrefix(symbol)}` : tx``;
  const rows = (await tx`
    select symbol, count(*)::int as trades, count(distinct user_id)::int as traders, max(closed_at) as last_closed_at,
           count(*) filter (where verified)::int as verified_trades, count(*) over ()::int as matched,
           bool_or(symbol = ${symbol ?? ''}) as exact
    from closed_trades where filing_url is null and user_id in (${vis}) ${prefix}
    group by symbol
    order by bool_or(symbol = ${symbol ?? ''}) desc, ${order}
    limit ${cap}`) as unknown as { symbol: string; trades: number; traders: number; last_closed_at: Date; verified_trades: number; matched: number; exact: boolean }[];
  const out = (r: (typeof rows)[number]) => ({ symbol: r.symbol, trades: r.trades, traders: r.traders, lastClosedAt: r.last_closed_at, demoOnly: r.verified_trades === 0 });
  if (symbol) {
    if (rows[0]?.exact) return { total, kind: 'exact', symbol, matched: 1, rows: [out(rows[0])] };
    if (!rows.length) return { total, kind: 'none', matched: 0, rows: [] };
  }
  return { total, kind, ...(symbol ? { symbol } : {}), matched: rows[0]?.matched ?? 0, rows: rows.map(out) };
}

async function oldRelated(tx: Db, symbol: string) {
  const rows = (await tx`
    with o as (
      select t.symbol, t.user_id, t.verified from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
      where t.symbol <> ${symbol} and t.filing_url is null
        and t.user_id in (select distinct user_id from closed_trades where symbol = ${symbol} and filing_url is null))
    select symbol, count(distinct user_id)::int as traders, count(*)::int as trades, not bool_or(verified) as demo_only
    from o where (select count(distinct user_id) from o) >= 2
    group by symbol
    order by traders desc, symbol collate "C"
    limit 8`) as unknown as { symbol: string; traders: number; trades: number; demo_only: boolean }[];
  return rows.map((r) => ({ symbol: r.symbol, traders: r.traders, trades: r.trades, demoOnly: r.demo_only }));
}

async function oldOthers(tx: Db, symbol: string, verified: boolean): Promise<{ n: number; winRate: number | null; conf: Confidence }> {
  const [r] = (await tx`
    with s as (
      select t.id, t.user_id, t.symbol, t.return_pct as rp, ln(greatest(1 + t.return_pct, 1e-9)) as x, greatest(t.holding_days, 1) as dd,
             date_trunc('milliseconds', t.opened_at) as o, date_trunc('milliseconds', t.closed_at) as c
      from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
      where t.symbol <> ${symbol} and t.filing_url is null and t.verified = ${verified}),
    w as (select s.*, max(c) over (partition by user_id, symbol order by o, id rows between unbounded preceding and 1 preceding) as pa from s),
    f as (select w.*, sum(case when pa is null or o > pa then 1 else 0 end) over (partition by user_id, symbol order by o, id rows unbounded preceding) as kb from w),
    b as (select sum(x) as x, sum(dd) as d, count(*)::int as n from f group by user_id, symbol, kb),
    tot as (select coalesce(sum(n), 0)::int as n, count(*)::int as k, coalesce(sum(x), 0) as sx, coalesce(sum(d), 0) as sd from b),
    mr as (select tot.*, sx / nullif(n, 0) as m, sx / nullif(sd, 0) as r from tot)
    select mr.n, mr.k, mr.sx, mr.sd,
           (select sum((b.x - b.n * mr.m) ^ 2) from b) as ss_m,
           (select sum((b.x - mr.r * b.d) ^ 2) from b) as ss_r,
           (select min(o) from s) as first_open, (select max(c) from s) as last_close,
           (select count(*) filter (where rp > 0 and rp <> 'NaN') from s)::int as wins
    from mr`) as unknown as { wins: number; n: number; k: number; sx: number; sd: number; ss_m: number | null; ss_r: number | null; first_open: Date | null; last_close: Date | null }[];
  const spanDays = r.first_open && r.last_close ? (r.last_close.getTime() - r.first_open.getTime()) / DAY : 0;
  return { n: r.n, winRate: r.n ? r.wins / r.n : null, conf: confidenceFromSums({ n: r.n, k: r.k, spanDays, sumX: Number(r.sx), sumD: Number(r.sd), ssM: Number(r.ss_m ?? 0), ssR: Number(r.ss_r ?? 0) }) };
}

// Equal to the printed precision (pct, as the baseline prints its range), and numerically to 1e-9.
function sameConf(got: { n: number; winRate: number | null; conf: Confidence }, want: typeof got, label: string) {
  assert.equal(got.n, want.n, label);
  assert.equal(got.winRate, want.winRate, label);
  for (const k of ['n', 'k', 'tier', 'edge'] as const) assert.equal(got.conf[k], want.conf[k], `${label} ${k}`);
  assert.ok(Math.abs(got.conf.spanDays - want.conf.spanDays) < 1e-9, label);
  for (const key of ['perTrade', 'pace30'] as const) {
    const a = got.conf[key], b = want.conf[key];
    assert.equal(a === null, b === null, `${label} ${key}`);
    if (!a || !b) continue;
    for (const e of ['low', 'mid', 'high'] as const) {
      assert.ok(Math.abs(a[e] - b[e]) < 1e-9, `${label} ${key}.${e}: ${a[e]} vs ${b[e]}`);
      assert.equal(pct(a[e]), pct(b[e]), `${label} ${key}.${e} printed`);
    }
  }
}

// Every summary row of these traders equals a fresh recompute from closed_trades (the view), and no live row is left
// without closes. Floats to 1e-12 relative: the trigger's and the recompute's sums may add rows in another order.
async function assertNoDrift(db: Db, ids: number[], label: string) {
  const stored = (await db`select * from ticker_trader_sums where user_id in ${db(ids)} and n > 0 order by symbol, user_id, verified`) as unknown as Record<string, unknown>[];
  const fresh = (await db`select * from ticker_trader_sums_src where user_id in ${db(ids)} order by symbol, user_id, verified`) as unknown as Record<string, unknown>[];
  assert.equal(stored.length, fresh.length, `${label}: ${stored.length} live rows vs ${fresh.length} recomputed`);
  stored.forEach((s, i) => {
    const f = fresh[i];
    for (const [k, v] of Object.entries(f)) {
      const got = s[k];
      if (typeof v === 'number' && !Number.isInteger(v)) assert.ok(Math.abs((got as number) - v) <= 1e-12 * Math.max(1, Math.abs(v)), `${label} ${s.symbol} ${k}: ${got} vs ${v}`);
      else assert.deepEqual(got, v, `${label} ${s.symbol} ${String(s.user_id)} ${k}`);
    }
  });
  const [{ orphans }] = await db`select count(*)::int as orphans from ticker_trader_sums t where t.user_id in ${db(ids)} and t.n > 0
    and not exists (select 1 from closed_trades c where c.user_id = t.user_id and c.symbol = t.symbol and c.verified = t.verified and c.filing_url is null)`;
  assert.equal(orphans, 0, `${label}: orphan rows`);
}

dbTest('F5-4: /t, related stocks and the other-stocks baseline equal the statements they replaced (printed precision), with Demo rows, a deleted trader and a filing row', async () => {
  const { sql } = await import('./db.ts');
  const { othersConfidence, relatedSymbolsSql, tickerIndexPage } = await import('../app/t/ticker-sql.ts');
  const p = `F${rand().slice(0, 3)}`;
  const [A, B, C, D, gone] = await users(5);
  const S = (x: string) => `${p}${x}`;
  await insert(sql, [
    // Overlapping holds (one bet), a boundary touch (one bet), separate bets, the same window in two stocks.
    { user: A, symbol: S('X'), open: 0, close: 10, r: 0.05 }, { user: A, symbol: S('X'), open: 5, close: 12, r: -0.02 },
    { user: A, symbol: S('X'), open: 12, close: 15, r: 0.01 }, { user: A, symbol: S('Y'), open: 5, close: 12, r: 0.03 },
    { user: A, symbol: S('Y'), open: 20, close: 21, r: -0.04 }, { user: B, symbol: S('X'), open: 0, close: 3, r: -0.06 },
    { user: B, symbol: S('X'), open: 20, close: 22, r: 0.08 }, { user: B, symbol: S('Z'), open: 1, close: 2, r: 0.02 },
    { user: B, symbol: S('Y'), open: 30, close: 31, r: 0 }, { user: C, symbol: S('Y'), open: 2, close: 9, r: 0.07, verified: false },
    { user: C, symbol: S('X'), open: 2, close: 4, r: -0.5, verified: false }, { user: C, symbol: S('W'), open: 40, close: 50, r: 0.04, verified: false },
    // The same trader with verified and Demo rows in one stock (counted once as a trader).
    { user: D, symbol: S('Y'), open: 3, close: 4, r: 0.2 }, { user: D, symbol: S('Y'), open: 3, close: 6, r: -0.1, verified: false },
    { user: D, symbol: S('X'), open: 1, close: 2, r: 0.3, hold: 0.25 },
    // A public filing row (never on stock pages) and a deleted trader's rows.
    { user: D, symbol: S('Q'), open: 1, close: 2, r: 0.9, filing: true }, { user: gone, symbol: S('X'), open: 1, close: 9, r: 0.4 },
    { user: gone, symbol: S('V'), open: 1, close: 9, r: 0.4 },
  ]);
  for (let i = 0; i < 12; i++) await insert(sql, [{ user: [A, B, D][i % 3], symbol: S('X'), open: 60 + i * 3, close: 61 + i * 3, r: ((i * 37) % 11 - 5) / 100 }]);
  await sql`update users set deleted_at = now() where id = ${gone}`;
  await assertNoDrift(sql, [A, B, C, D, gone], 'fixture');

  await sql.begin('isolation level repeatable read', async (tx) => {
    for (const sort of ['recent', 'az'] as const) {
      for (const [q, cap] of [[p, 100], [p, 2], [S('X'), 100], [` ${p.toLowerCase()}y `, 100], [S('Q'), 100], [S('V'), 100], ['a%b', 100], ['', 5], [undefined, 5], [['x'], 5]] as [unknown, number][]) {
        assert.deepEqual(await tickerIndexPage(q, sort, cap, tx as never), await oldIndex(tx, q, sort, cap), `${sort} ${JSON.stringify(q)} ${cap}`);
      }
    }
    const idx = await tickerIndexPage(p, 'az', 100, tx as never);
    assert.deepEqual(idx.rows.map((r) => r.symbol), [S('W'), S('X'), S('Y'), S('Z')]); // no filing-only or deleted-only symbol
    assert.equal(idx.rows.find((r) => r.symbol === S('Y'))!.traders, 4);
    assert.equal(idx.rows.find((r) => r.symbol === S('W'))!.demoOnly, true);
    for (const s of ['X', 'Y', 'Z', 'W', 'Q', 'V', 'NONE'].map(S)) {
      assert.deepEqual(await relatedSymbolsSql(s, tx as never), await oldRelated(tx, s), `related ${s}`);
      for (const v of [true, false]) sameConf(await othersConfidence(s, v, tx as never), await oldOthers(tx, s, v), `others ${s} ${v}`);
    }
  });
});

dbTest('F5-4: drift guard: inserts, updates, deletes, rebuildTrades, the options deletes after it and a trader delete leave every pair equal to a recompute', async () => {
  const { sql } = await import('./db.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const p = `G${rand().slice(0, 3)}`;
  const ids = await users(4);
  const syms = ['A', 'B', 'C'].map((x) => `${p}${x}`);
  let r = 1;
  const rnd = () => ((r = (r * 48271) % 2147483647) / 2147483647);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  for (let round = 0; round < 6; round++) {
    await insert(sql, Array.from({ length: 8 }, () => {
      const o = Math.floor(rnd() * 60);
      return { user: pick(ids), symbol: pick(syms), open: o, close: o + 1 + Math.floor(rnd() * 9), r: Math.round((rnd() - 0.45) * 40) / 100, verified: rnd() > 0.3, filing: rnd() > 0.9 };
    }));
    await sql`update closed_trades set return_pct = return_pct + 0.01 where user_id in ${sql(ids)} and id % 3 = ${round % 3}`;
    await sql`update closed_trades set symbol = ${pick(syms)} where id = (select max(id) from closed_trades where user_id in ${sql(ids)})`;
    await sql`update closed_trades set verified = not verified where id = (select min(id) from closed_trades where user_id in ${sql(ids)})`;
    await sql`update closed_trades set thesis = 'note' where id = (select min(id) from closed_trades where user_id in ${sql(ids)})`; // no summed column: returns early
    await sql`delete from closed_trades where id in (select id from closed_trades where user_id in ${sql(ids)} order by id limit 2)`;
    await assertNoDrift(sql, ids, `round ${round}`);
  }
  // A rebuild from activities (deferred, one recompute at its end), then the options sync's delete in the same
  // transaction: the triggers fire again for it.
  const [u] = ids;
  const acct = `fc5wp3-${rand()}`;
  const acts = [] as Record<string, unknown>[];
  for (let i = 0; i < 6; i++) {
    for (const [side, d, price] of [['BUY', i * 10, 10], ['SELL', i * 10 + 3 + (i % 2) * 9, 10 + i - 2]] as const) {
      acts.push({ user_id: u, source: i % 3 ? 'snaptrade' : 'demo', external_id: `${acct}-${i}-${side}`, account_id: acct, symbol: syms[i % 2], side, units: 1, price, executed_at: new Date(T0 + d * DAY), raw: {} });
    }
  }
  await sql`insert into activities ${sql(acts)}`;
  await sql.begin(async (tx) => {
    await rebuildTrades(u, tx);
    assert.equal((await tx`select current_setting('app.tts_defer', true) as v`)[0].v, 'off');
    await assertNoDrift(tx, ids, 'after rebuild');
    const [one] = await tx`select sell_id from closed_trades where user_id = ${u} and symbol = ${syms[0]} order by closed_at limit 1`;
    await tx`delete from closed_trades where user_id = ${u} and sell_id in ${tx([one.sell_id as string])}`; // as lib/options-sync.ts:146
    await assertNoDrift(tx, ids, 'after the options delete');
  });
  await assertNoDrift(sql, ids, 'committed');
  // A trader delete: the cascade removes their rows, the trigger inserts nothing back.
  await sql`delete from users where id = ${ids[1]}`;
  assert.equal((await sql`select count(*)::int as n from ticker_trader_sums where user_id = ${ids[1]}`)[0].n, 0);
  await assertNoDrift(sql, ids, 'after a trader delete');
});

dbTest('F5-4: applying db/schema.sql twice leaves exactly one trigger per event', async () => {
  const { sql } = await import('./db.ts');
  await sql.unsafe(SCHEMA).simple();
  await sql.unsafe(SCHEMA).simple();
  const rows = await sql`select tgname, count(*)::int as n, min(pg_get_triggerdef(oid)) as def from pg_trigger
    where tgrelid = 'closed_trades'::regclass and tgname like 'ticker_sums_%' and not tgisinternal group by tgname order by tgname`;
  assert.deepEqual(rows.map((r) => [r.tgname, r.n]), [['ticker_sums_delete', 1], ['ticker_sums_insert', 1], ['ticker_sums_update', 1]]);
  for (const r of rows) assert.match(String(r.def), /AFTER (INSERT|UPDATE|DELETE) ON public\.closed_trades REFERENCING .*FOR EACH STATEMENT/);
});

// Rows a plan node read: those it returned plus those it threw away, over all its loops (as lib/likes.test.ts).
type PlanNode = { 'Node Type': string; 'Relation Name'?: string; 'Index Name'?: string; 'Actual Rows': number; 'Actual Loops': number;
  'Rows Removed by Filter'?: number; 'Rows Removed by Index Recheck'?: number; Plans?: PlanNode[] };
const planNodes = (n: PlanNode): PlanNode[] => [n, ...(n.Plans ?? []).flatMap(planNodes)];
const rowsRead = (n: PlanNode) => (n['Actual Rows'] + (n['Rows Removed by Filter'] ?? 0) + (n['Rows Removed by Index Recheck'] ?? 0)) * n['Actual Loops'];
const on = (nodes: PlanNode[], t: string) => nodes.filter((n) => n['Relation Name'] === t || n['Index Name']?.startsWith(`${t}_`));

const xactReads = async (tx: Db) => {
  await tx`select pg_stat_clear_snapshot()`;
  const [r] = await tx`select coalesce(seq_tup_read, 0) + coalesce(idx_tup_fetch, 0) as n from pg_stat_xact_user_tables where relid = 'closed_trades'::regclass`;
  return Number(r?.n ?? 0);
};

dbTest('F5-4: within a rebuild transaction, deferred inserts read 0 closed_trades rows and finishTickerSums reads exactly the trader\'s rows (pg_stat_xact_user_tables and EXPLAIN)', async () => {
  const { sql } = await import('./db.ts');
  const { finishTickerSums, tickerSumsUserSql } = await import('./sync.ts');
  const [u] = await users(1);
  const p = `M${rand().slice(0, 3)}`;
  const N = 600;
  const closes = Array.from({ length: N }, (_, i): Close => ({ user: u, symbol: `${p}${i % 7}`, open: i, close: i + 2 + (i % 5), r: ((i * 13) % 21 - 10) / 100, verified: i % 4 !== 0 }));
  await sql.begin(async (tx) => {
    await tx`select set_config('app.tts_defer', 'on', true)`;
    const s0 = await xactReads(tx);
    for (let i = 0; i < N; i += 200) await insert(tx, closes.slice(i, i + 200));
    const s1 = await xactReads(tx);
    assert.equal(s1 - s0, 0, 'deferred inserts read no closed_trades row');
    assert.equal((await tx`select count(*)::int as n from ticker_trader_sums where user_id = ${u}`)[0].n, 0, 'nothing written while deferred');
    const s2 = await xactReads(tx);
    await finishTickerSums(tx, u, null);
    const s3 = await xactReads(tx);
    console.log(`# F5-4 measure: ${N} deferred inserts read ${s1 - s0} closed_trades rows; finishTickerSums read ${s3 - s2} (trader has ${N})`);
    assert.ok(s3 - s2 >= N && s3 - s2 <= N + 1, `finishTickerSums read ${s3 - s2} rows for ${N}`);
    await assertNoDrift(tx, [u], 'after finish');
    // The same statement on its own, EXPLAIN ANALYZE'd (inside this transaction, rolled back below).
    const text = (await tickerSumsUserSql(sql as never, u).describe()).string;
    await tx`savepoint e`;
    const [r] = await tx.unsafe(`explain (analyze, format json) ${text}`, [u, u]); // the trader id is bound twice
    await tx`rollback to savepoint e`;
    const nodes = on(planNodes((r['QUERY PLAN'] as { Plan: PlanNode }[])[0].Plan), 'closed_trades');
    assert.ok(nodes.length > 0);
    for (const n of nodes) {
      assert.notEqual(n['Node Type'], 'Seq Scan');
      assert.ok(rowsRead(n) <= N + 1, `${n['Node Type']} read ${rowsRead(n)}`);
    }
    assert.ok(nodes.some((n) => rowsRead(n) === N), `a node reads the trader's ${N} rows`);
    console.log(`# F5-4 measure: finishTickerSums EXPLAIN reads ${nodes.map((n) => `${n['Node Type']}${n['Index Name'] ? ` ${n['Index Name']}` : ''}=${rowsRead(n)}`).join(', ')}`);
    throw new Error('rollback');
  }).catch((e) => { if ((e as Error).message !== 'rollback') throw e; });
  const src = readFileSync(new URL('./sync.ts', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export async function rebuildTrades'));
  assert.match(fn, /const run = async \(tx: TransactionSql\) => \{\n\s+await tx`select set_config\('app\.tts_defer', 'on', true\)`/);
  assert.match(fn, /return await finishTickerSums\(tx, userId, \{/);
});

async function closesFor(db: Db, u: number, acct: string, sym: string, n: number) {
  const acts = [] as Record<string, unknown>[];
  for (let i = 0; i < n; i++) {
    acts.push({ user_id: u, source: 'snaptrade', external_id: `${acct}-${i}-b`, account_id: acct, symbol: sym, side: 'BUY', units: 1, price: 10, executed_at: new Date(T0 + i * 2 * DAY), raw: {} });
    acts.push({ user_id: u, source: 'snaptrade', external_id: `${acct}-${i}-s`, account_id: acct, symbol: sym, side: 'SELL', units: 1, price: 10 + (i % 3) - 1, executed_at: new Date(T0 + (i * 2 + 1) * DAY), raw: {} });
  }
  await db`insert into activities ${db(acts)}`;
}

dbTest('F5-4: with trader A\'s rebuild open, trader B\'s rebuild and direct writes on a shared symbol finish under lock_timeout 50ms (no waiting)', async () => {
  const { sql } = await import('./db.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const [A, B] = await users(2);
  const sym = `L${rand().slice(0, 4)}`;
  await closesFor(sql, A, `fc5wp3a-${rand()}`, sym, 5);
  await closesFor(sql, B, `fc5wp3b-${rand()}`, sym, 5);
  await sql.begin(async (ta) => {
    await rebuildTrades(A, ta);
    await insert(ta, [{ user: A, symbol: sym, open: 90, close: 91, r: 0.01 }]); // the trigger path too
    const pidA = (await ta`select pg_backend_pid() as p`)[0].p;
    await sql.begin(async (tb) => {
      await tb`set local lock_timeout = '50ms'`;
      await rebuildTrades(B, tb);
      await insert(tb, [{ user: B, symbol: sym, open: 90, close: 91, r: 0.02 }]);
      await tb`update closed_trades set return_pct = return_pct + 0.01 where user_id = ${B} and symbol = ${sym}`;
      const pidB = (await tb`select pg_backend_pid() as p`)[0].p;
      assert.notEqual(pidA, pidB);
      assert.equal((await tb`select count(*)::int as n from pg_locks where pid = ${pidB} and not granted`)[0].n, 0);
    });
  });
  await assertNoDrift(sql, [A, B], 'both committed');
  assert.equal((await sql`select sum(n)::int as n from ticker_trader_sums where symbol = ${sym}`)[0].n, 12);
});

dbTest('F5-4: totals are built once per bucket for 10 concurrent /t/SYMBOL and 50 concurrent /t loads; a deleted trader leaves them at the next bucket; a public filing is never counted', async () => {
  const { sql } = await import('./db.ts');
  const { tickerIndexPage, tickerPageWithBaseline } = await import('../app/t/ticker-sql.ts');
  const sums = await import('../app/t/ticker-sums.ts');
  const [a, b, c] = await users(3);
  const p = `S${rand().slice(0, 3)}`;
  await insert(sql, [
    { user: a, symbol: `${p}A`, open: 0, close: 2, r: 0.1 }, { user: b, symbol: `${p}A`, open: 0, close: 3, r: -0.1 },
    { user: b, symbol: `${p}B`, open: 1, close: 3, r: 0.2 }, { user: c, symbol: `${p}C`, open: 1, close: 3, r: 0.2, filing: true },
  ]);
  const prev = process.env.VERCEL_ENV;
  const clock = sums.totalsClock.now;
  try {
    process.env.VERCEL_ENV = 'production';
    let now = 1_000 * sums.TOTALS_BUCKET_MS;
    sums.totalsClock.now = () => now;
    sums.clearTotalsCache();
    sums.totalsStats.builds = 0;
    const loads = await Promise.all([
      ...Array.from({ length: 10 }, () => tickerPageWithBaseline(`${p}A`, new Date(), 50)),
      ...Array.from({ length: 50 }, () => tickerIndexPage(p, 'az', 100)),
    ]);
    assert.equal(sums.totalsStats.builds, 1, 'one build for 60 loads in one bucket');
    const idx = loads[10] as Awaited<ReturnType<typeof tickerIndexPage>>;
    assert.deepEqual(idx.rows.map((r) => [r.symbol, r.traders, r.trades]), [[`${p}A`, 2, 2], [`${p}B`, 1, 1]]); // no filing
    await sql`update users set deleted_at = now() where id = ${b}`;
    const same = await tickerIndexPage(p, 'az', 100);
    assert.equal(same.rows.length, 2, 'the bucket still serves its build');
    now += sums.TOTALS_BUCKET_MS;
    const next = await tickerIndexPage(p, 'az', 100);
    assert.equal(sums.totalsStats.builds, 2);
    assert.deepEqual(next.rows.map((r) => [r.symbol, r.traders, r.trades]), [[`${p}A`, 1, 1]]);
    // A caller's own transaction never reads the cache.
    await sql.begin(async (tx) => { assert.equal((await tickerIndexPage(p, 'az', 100, tx as never)).rows.length, 1); });
    assert.equal(sums.totalsStats.builds, 2);
  } finally {
    if (prev === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = prev;
    sums.totalsClock.now = clock;
    sums.clearTotalsCache();
  }
  // Off by default (local runs and e2e read fresh rows).
  assert.equal(sums.totalsCacheOn(), process.env.VERCEL_ENV === 'production');
});

dbTest('F5-4 + F5-27: plan shape at 20,000 closes in 400 symbols: no ticker statement scans closed_trades; each closed_trades node reads at most the symbol\'s rows + 1 through closed_trades_symbol_recent; the totals read only ticker_trader_sums and users (custom and generic plans)', async () => {
  const { sql } = await import('./db.ts');
  const t = await import('../app/t/ticker-sql.ts');
  const ids = await users(20);
  const p = `H${rand().slice(0, 3)}`;
  await sql`
    insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    select (${sql.array(ids, 23)}::int[])[(g / 400) % 20 + 1], ${`fc5wp3h-${rand()}-`}::text || g, 'fc5wp3', ${p}::text || (g % 400),
           ${new Date(T0)}::timestamptz + (g / 400) * interval '3 days', ${new Date(T0)}::timestamptz + (g / 400) * interval '3 days' + interval '5 days',
           ((g * 7919) % 200 - 100) / 1000.0, 5, g % 10 <> 0
    from generate_series(0, 19999) g`;
  await assertNoDrift(sql, ids, 'heavy fixture');
  await sql`analyze closed_trades, ticker_trader_sums, users`;
  const sym = `${p}7`;
  const symRows = 50;
  const [{ sums }] = await sql`select count(*)::int as sums from ticker_trader_sums`;
  const legacy = (await sql`select indexdef from pg_indexes where schemaname = current_schema() and indexname = 'closed_trades_symbol'`)[0]?.indexdef as string | undefined;
  // An upgraded database still holds the old name until the owner drops it (owner item); it is accepted only when it
  // is the same three-column index, so the planner may pick either twin.
  const sameCols = (def?: string) => !!def && /\(symbol, closed_at DESC, id DESC\)$/.test(def);
  const okIndex = new Set(['closed_trades_symbol_recent', 'closed_trades_trade_key', ...(sameCols(legacy) ? ['closed_trades_symbol'] : [])]);

  const captured: { query: string; params: unknown[]; types: number[] }[] = [];
  const dbg = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, max: 1, debug: (_c, query, params, types) => { captured.push({ query, params: params as unknown[], types: (types ?? []) as number[] }); } });
  try {
    const kinds: [string, () => Promise<unknown>][] = [
      ['index az', () => t.tickerIndexPage(p, 'az', 100, dbg as never)],
      ['index recent', () => t.tickerIndexPage(undefined, 'recent', 100, dbg as never)],
      ['page', () => t.tickerPageWithBaseline(sym, new Date(), 500, dbg as never)],
      ['headline', () => t.tickerHeadline(sym, dbg as never)],
      ['related', () => t.relatedSymbolsSql(sym, dbg as never)],
    ];
    const statements: { kind: string; query: string; params: unknown[]; types: number[] }[] = [];
    for (const [kind, run] of kinds) {
      captured.length = 0;
      await run();
      statements.push(...captured.map((c) => ({ kind, ...c })));
    }
    assert.ok(statements.length >= 8, `captured ${statements.length}`);
    const conn = await sql.reserve();
    try {
      let i = 0, symbolIndexReads = 0;
      for (const s of statements) {
        const name = `fc5wp3_${i++}`;
        // The driver's own types for the values it typed (booleans, ...); `unknown` lets the server infer the rest, as it does for the app.
        const types = s.params.length ? (await conn.unsafe(`select case when t = 0 then 'unknown' else t::regtype::text end as t from unnest($1::oid[]) with ordinality u(t, i) order by i`, [s.params.map((_, j) => s.types[j] ?? 0) as never])).map((r) => r.t as string) : [];
        await conn.unsafe(`prepare ${name}${types.length ? `(${types.join(', ')})` : ''} as ${s.query}`).catch((e) => { throw new Error(`${s.kind}: ${(e as Error).message} [${types}] ${s.query}`); });
        try {
          for (const mode of ['force_custom_plan', 'force_generic_plan']) {
            await conn.unsafe(`set plan_cache_mode = ${mode}`);
            // The values the driver sent (already serialized to text), as literals the prepared types take.
            const lit = (v: unknown) => (v === null || v === undefined ? 'null' : `'${String(v instanceof Date ? v.toISOString() : v).replace(/'/g, "''")}'`);
            const args = s.params.length ? `(${s.params.map(lit).join(', ')})` : '';
            const [r] = await conn.unsafe(`explain (analyze, format json) execute ${name}${args}`);
            const nodes = planNodes((r['QUERY PLAN'] as { Plan: PlanNode }[])[0].Plan);
            const at = `${s.kind} (${mode}): ${s.query.replace(/\s+/g, ' ').slice(0, 90)}`;
            const ct = on(nodes, 'closed_trades');
            for (const n of ct) {
              assert.notEqual(n['Node Type'], 'Seq Scan', at);
              assert.ok(rowsRead(n) <= symRows + 1, `${at}: ${n['Node Type']} ${n['Index Name'] ?? ''} read ${rowsRead(n)} (symbol has ${symRows})`);
              if (n['Index Name']) assert.ok(okIndex.has(n['Index Name']), `${at}: index ${n['Index Name']}`);
              if (n['Index Name']?.startsWith('closed_trades_symbol')) symbolIndexReads++;
            }
            if (/ticker_trader_sums/.test(s.query)) {
              assert.equal(ct.length, 0, `${at}: the summary reads never touch closed_trades`);
              const rels = new Set(nodes.map((n) => n['Relation Name']).filter(Boolean));
              for (const rel of rels) assert.ok(rel === 'ticker_trader_sums' || rel === 'users', `${at}: reads ${rel}`);
              for (const n of on(nodes, 'ticker_trader_sums')) assert.ok(rowsRead(n) <= sums + 1, `${at}: ${rowsRead(n)} summary rows of ${sums}`);
            }
          }
        } finally {
          await conn.unsafe(`deallocate ${name}`).catch(() => {});
        }
      }
      assert.ok(symbolIndexReads > 0, 'the one-symbol reads go through the symbol index');
      console.log(`# F5-4 plan shape: ${statements.length} statements, custom and generic, at ${sums} summary rows; legacy twin index ${legacy ? (sameCols(legacy) ? 'present (3 columns)' : 'present (2 columns)') : 'absent'}`);
    } finally {
      await conn.unsafe('reset plan_cache_mode').catch(() => {});
      conn.release();
    }
  } finally {
    await dbg.end({ timeout: 1 });
  }
});

dbTest('F5-27: one definition of the symbol index: closed_trades_symbol_recent on (symbol, closed_at desc, id desc), on a fresh table and on one that already had the old two-column closed_trades_symbol', async () => {
  const { sql } = await import('./db.ts');
  const defs = SCHEMA.split('\n').filter((l) => /schema_add_index\('closed_trades_symbol/.test(l));
  assert.equal(defs.length, 1, defs.join('\n'));
  assert.match(defs[0], /schema_add_index\('closed_trades_symbol_recent', 'create index closed_trades_symbol_recent on closed_trades \(symbol, closed_at desc, id desc\)'\)/);
  const [live] = await sql`select indexdef from pg_indexes where schemaname = current_schema() and indexname = 'closed_trades_symbol_recent'`;
  assert.match(String(live?.indexdef), /ON public\.closed_trades USING btree \(symbol, closed_at DESC, id DESC\)$/);
  // An upgraded database: a scratch schema holding a closed_trades with only the old two-column index under the old name.
  const scratch = `fc5wp3_${rand().toLowerCase()}`;
  await sql.begin(async (tx) => {
    await tx.unsafe(`create schema ${scratch}`);
    await tx.unsafe(`set local search_path = ${scratch}, public`);
    await tx.unsafe('create table closed_trades (id bigint primary key, symbol text not null, closed_at timestamptz not null)');
    await tx.unsafe('create index closed_trades_symbol on closed_trades (symbol, closed_at desc)');
    for (let k = 0; k < 2; k++) await tx.unsafe(defs[0]);
    const got = await tx`select indexname, indexdef from pg_indexes where schemaname = ${scratch} and indexname like 'closed_trades_symbol%' order by indexname`;
    assert.deepEqual(got.map((r) => r.indexname), ['closed_trades_symbol', 'closed_trades_symbol_recent']);
    assert.match(String(got[1].indexdef), /\(symbol, closed_at DESC, id DESC\)$/);
    await tx.unsafe(`drop schema ${scratch} cascade`);
  });
  for (const f of ['lib/sitemaps.ts']) assert.doesNotMatch(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /closed_trades_symbol\b(?!_recent)/, f);
});
