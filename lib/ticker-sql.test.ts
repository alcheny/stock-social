// lib/ticker-sql.ts: the ticker pages' SQL aggregates equal the in-memory helpers in lib/ticker.ts on the same rows.
// The reference side reads rows exactly as the pages did before (every row, newest first) and runs the JS helpers.
// Fixtures use their own random symbols and handles and remove only their own users.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
const made: number[] = [];
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  if (made.length) await sql`delete from users where id in ${sql(made)}`;
  await sql.end({ timeout: 1 });
});

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 3, 1);
const rand = () => Math.random().toString(36).slice(2, 7).toUpperCase().replace(/^[0-9]/, 'Q');

async function users(n: number) {
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `ts${Math.random().toString(36).slice(2, 8)}`;
  const ids: number[] = [];
  for (let i = 0; i < n; i++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${i}` })).id);
  made.push(...ids);
  return ids;
}

type Ins = { user: number; symbol: string; opened: Date | string; closed: Date | string; r: number | string; hold: number | string; verified?: boolean };
let seq = 0;
const iso = (d: Date | string) => (typeof d === 'string' ? d : d.toISOString());
async function insert(rows: Ins[]) {
  const { sql } = await import('./db.ts');
  for (const x of rows) {
    // Sent as text so a fixture can use sub-millisecond times and NaN, which a JS Date or a JSON number can't carry.
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${x.user}, ${`tsql-${Date.now()}-${seq++}-${Math.random()}`}, 'a', ${x.symbol}, ${iso(x.opened)}::text::timestamptz, ${iso(x.closed)}::text::timestamptz,
              ${String(x.r)}::text::float8, ${String(x.hold)}::text::float8, ${x.verified ?? true})`;
  }
}

// The pre-SQL page: every row, newest first, live users only, then the JS helpers.
async function reference(symbol: string, today: Date) {
  const { sql } = await import('./db.ts');
  const T = await import('./ticker.ts');
  const rows = (await sql`
    select t.id, t.user_id, u.handle, u.display_name, t.symbol, t.return_pct, t.holding_days, t.opened_at, t.closed_at, t.verified
    from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
    where t.symbol = ${symbol} order by t.closed_at desc, t.id desc`) as unknown as (import('./ticker.ts').TradeRow & { id: number })[];
  const tr = rows.map(T.toTicker);
  const returns = rows.map((r) => T.toSpreadPct(r.return_pct)).filter(Number.isFinite);
  const verified = rows.filter((r) => r.verified);
  return {
    rows, summary: T.tickerSummary(tr, today), spread: T.outcomeSpread(returns), returns,
    timeline: T.monthlyTimeline(tr, today), holds: T.holdBuckets(tr, today), concentration: T.concentration(tr, today),
    verifiedTrades: verified.length, verifiedTraders: new Set(verified.map((r) => r.user_id)).size,
  };
}

// Exact everywhere except the confidence intervals' floats (ln and bet order may differ in the last bit).
function close(a: unknown, b: unknown, path = ''): void {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isFinite(a) && Number.isFinite(b)) assert.ok(Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b)), `${path}: ${a} vs ${b}`);
    else assert.ok(Object.is(a, b), `${path}: ${a} vs ${b}`);
    return;
  }
  if (a instanceof Date || b instanceof Date) return assert.equal((a as Date).getTime(), (b as Date).getTime(), path);
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), path);
    for (const k of Object.keys(a)) close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
    return;
  }
  assert.ok(Object.is(a, b), `${path}: ${String(a)} vs ${String(b)}`);
}

// What a reader sees: the formatted numbers, identical strings.
async function shown(s: import('./ticker.ts').TickerSummary) {
  const { pct, rangeText, evidenceLine } = await import('./trades.ts');
  return s.n ? [s.n, s.traders, s.demoOnly, s.mixed, (s.winRate! * 100).toFixed(0), pct(s.avgReturn!), rangeText(s.conf!), evidenceLine(s.conf!), s.conf!.tier, s.conf!.k] : [0];
}

async function assertSame(symbol: string, today: Date) {
  const { tickerPage, tickerHeadline } = await import('./ticker-sql.ts');
  const ref = await reference(symbol, today);
  const got = await tickerPage(symbol, today, 4);
  const head = await tickerHeadline(symbol);
  close(got.summary, ref.summary, 'summary');
  close(head.summary, ref.summary, 'headline');
  assert.deepEqual(await shown(got.summary), await shown(ref.summary));
  assert.deepEqual(await shown(head.summary), await shown(ref.summary));
  // Headline averages are ordered sums in the page's row order: bit-identical, not merely close.
  assert.ok(Object.is(got.summary.avgReturn, ref.summary.avgReturn), 'avgReturn exact');
  assert.ok(Object.is(got.summary.winRate, ref.summary.winRate), 'winRate exact');
  assert.equal(head.verifiedTrades, ref.verifiedTrades);
  assert.equal(head.verifiedTraders, ref.verifiedTraders);
  assert.deepEqual(got.spread, ref.spread, 'spread is exact');
  assert.deepEqual(got.returns, ref.spread.n < 10 ? ref.returns : []);
  assert.deepEqual(got.timeline, ref.timeline, 'timeline is exact');
  close(got.holds, ref.holds, 'holds');
  for (const [i, b] of got.holds.buckets.entries()) if (b.shown) assert.ok(Object.is(b.avgReturn, ref.holds.buckets[i].avgReturn), `hold ${i} avg exact`);
  close(got.concentration, ref.concentration, 'concentration');
  if (got.concentration?.kind === 'compare' && ref.concentration?.kind === 'compare') {
    assert.deepEqual(await shown(got.concentration.rest), await shown(ref.concentration.rest));
    assert.ok(Object.is(got.concentration.rest.avgReturn, ref.concentration.rest.avgReturn), 'rest avg exact');
  }
  assert.deepEqual(got.rows.map((r) => r.id), ref.rows.slice(0, 4).map((r) => r.id), 'capped list is the newest rows, in order');
  return { got, ref };
}

dbTest('tickerPage and tickerHeadline equal tickerSummary, outcomeSpread, monthlyTimeline, holdBuckets and concentration on a mixed fixture', async () => {
  const { sql } = await import('./db.ts');
  const sym = `S${rand()}`;
  const [a, b, c, d, gone] = await users(5);
  const today = new Date(T0 + 400 * DAY);
  const at = (days: number, ms = 0) => new Date(T0 + days * DAY + ms);
  const rows: Ins[] = [];
  // a: 12 trades, the most active; overlapping holds (one bet), a boundary-instant overlap, entry ties, bin edges.
  const rs = [0.1, -0.1, 0, 0.5, -0.5, 0.3, -0.6, 0.123456789, 2, -0.999999, 0.0999999995, -0.05];
  rs.forEach((r, i) => rows.push({ user: a, symbol: sym, opened: at(i < 3 ? 0 : i * 20), closed: at(i < 3 ? 5 + i : i * 20 + (i % 4) * 9), r, hold: i < 3 ? 5 + i : (i % 4) * 9 + 0.5 }));
  rows.push({ user: a, symbol: sym, opened: at(300), closed: at(310), r: 0.07, hold: 10 }, { user: a, symbol: sym, opened: at(310), closed: at(312), r: 0.02, hold: 2 });
  // b and c: demo rows make the record mixed; c has same-millisecond times that differ in microseconds.
  for (let i = 0; i < 6; i++) rows.push({ user: b, symbol: sym, opened: at(i * 30), closed: at(i * 30 + 0.2), r: (i - 2) / 10, hold: 0.2, verified: i % 2 === 0 });
  rows.push({ user: c, symbol: sym, opened: '2026-06-01T00:00:00.000900Z', closed: '2026-06-02T00:00:00.000100Z', r: 0.04, hold: 1 });
  rows.push({ user: c, symbol: sym, opened: '2026-06-02T00:00:00.000500Z', closed: '2026-06-03T00:00:00.000700Z', r: -0.03, hold: 1 });
  rows.push({ user: c, symbol: sym, opened: '2026-06-02T00:00:00.000200Z', closed: '2026-06-02T00:00:00.000300Z', r: 0.01, hold: 0 });
  // d: long holds, an entry in the far past ('earlier') and one in the future (clamps into the last month).
  for (let i = 0; i < 6; i++) rows.push({ user: d, symbol: sym, opened: at(-900 + i * 40), closed: at(-900 + i * 40 + 30), r: 0.2 - i / 20, hold: 30 });
  rows.push({ user: d, symbol: sym, opened: at(420), closed: at(460), r: 0.01, hold: 40 });
  // Exact halves after the x1e8 scaling (2.5, -2.5): Math.round rounds them up, unlike Postgres round().
  rows.push({ user: d, symbol: sym, opened: at(500), closed: at(530), r: 2.5e-8, hold: 30 }, { user: d, symbol: sym, opened: at(540), closed: at(570), r: -2.5e-8, hold: 30 });
  // A deleted user's trades are on no page.
  rows.push({ user: gone, symbol: sym, opened: at(1), closed: at(2), r: 9, hold: 1 });
  await insert(rows);
  await sql`update users set deleted_at = now() where id = ${gone}`;
  const { got, ref } = await assertSame(sym, today);
  assert.equal(ref.summary.n, 32);
  assert.equal(got.concentration?.kind, 'compare');
  assert.ok(got.summary.mixed);
  assert.ok(got.summary.conf!.k < got.summary.n, 'overlapping holds are fewer bets than trades');
  assert.ok(got.holds.buckets.filter((h) => h.shown).length >= 2);
});

dbTest('every concentration kind, an empty symbol, a tiny record (dots) and a NaN return match the JS helpers', async () => {
  const today = new Date(T0 + 100 * DAY);
  const [a, b, c] = await users(3);
  const mk = (user: number, symbol: string, i: number, r: number | string = (i % 5 - 2) / 10, verified = true): Ins =>
    ({ user, symbol, opened: new Date(T0 + i * 3 * DAY), closed: new Date(T0 + (i * 3 + 1) * DAY), r, hold: 1, verified });
  const single = `S${rand()}`, tie = `S${rand()}`, few = `S${rand()}`, one = `S${rand()}`, nan = `S${rand()}`, demo = `S${rand()}`, half = `S${rand()}`;
  await insert([
    ...Array.from({ length: 3 }, (_, i) => mk(a, single, i)),
    ...Array.from({ length: 4 }, (_, i) => mk(i % 2 ? a : b, tie, i)),
    ...Array.from({ length: 7 }, (_, i) => mk(i < 4 ? a : i < 6 ? b : c, few, i)),
    mk(a, one, 0, 0.25),
    ...Array.from({ length: 6 }, (_, i) => mk(i % 2 ? a : b, nan, i, i === 3 ? 'NaN' : 0.1)),
    ...Array.from({ length: 6 }, (_, i) => mk(i % 3 ? a : b, demo, i, 0.05 * i, false)),
    // Dots record with exact halves after scaling: toSpreadPct's Math.round, not round-half-even.
    mk(a, half, 0, 2.5e-8), mk(b, half, 1, -2.5e-8), mk(c, half, 2, 1.25e-7),
  ]);
  const kinds: Record<string, string | undefined> = {};
  for (const s of [single, tie, few, one, nan, demo, half, `S${rand()}`]) kinds[s] = (await assertSame(s, today)).got.concentration?.kind;
  assert.equal(kinds[single], 'single');
  assert.equal(kinds[tie], 'tie');
  assert.equal(kinds[few], 'too-few');
  assert.equal(kinds[one], undefined);
});

dbTest('relatedSymbolsSql equals relatedSymbols on the pre-SQL overlap rows: counts, demo flag, tie order and the cap of 8', async () => {
  const { sql } = await import('./db.ts');
  const { relatedSymbols } = await import('./ticker.ts');
  const { relatedSymbolsSql } = await import('./ticker-sql.ts');
  const p = rand().slice(0, 4);
  const main = `R${p}`;
  const [a, b, c, solo] = await users(4);
  const at = new Date(T0);
  const t = (user: number, symbol: string, verified = true): Ins => ({ user, symbol, opened: at, closed: at, r: 0.01, hold: 1, verified });
  // Ten other symbols (ties broken by code point: '-' < '.' < digits < letters), one demo-only, one closed by all three.
  const others = ['A', 'B', 'B.X', 'B-X', 'C', 'D', 'E', 'F', 'G', '9'].map((s) => `R${p}${s}`);
  await insert([
    t(a, main), t(b, main), t(c, main, false),
    ...others.flatMap((s, i) => [t(a, s), ...(i % 2 ? [t(b, s), t(b, s)] : []), ...(i === 4 ? [t(c, s, false)] : [])]),
    t(c, `R${p}Z`, false), t(b, `R${p}Y`, false), t(c, `R${p}Y`, false), t(solo, `R${p}A`),
  ]);
  const ref = async (symbol: string) => {
    const overlap = (await sql`
      select o.symbol, o.user_id, o.verified from closed_trades o
      where o.symbol <> ${symbol} and o.user_id in (select distinct user_id from closed_trades where symbol = ${symbol})`) as unknown as { symbol: string; user_id: number; verified: boolean }[];
    return relatedSymbols(overlap.map((o) => ({ symbol: o.symbol, userId: o.user_id, verified: o.verified })), symbol);
  };
  const got = await relatedSymbolsSql(main);
  assert.deepEqual(got, await ref(main));
  assert.equal(got.length, 8);
  assert.equal(got.find((r) => r.symbol === `R${p}Y`)?.demoOnly, true);
  assert.equal(got.find((r) => r.symbol === `R${p}C`)?.demoOnly, false, 'one verified trade makes it not demo-only');
  // Under 2 traders with other symbols: nothing, as in relatedSymbols.
  const lone = `R${p}9`;
  assert.deepEqual(await relatedSymbolsSql(`R${p}Z`), await ref(`R${p}Z`));
  assert.deepEqual(await relatedSymbolsSql(`R${p}Z`), []);
  assert.deepEqual(await relatedSymbolsSql(lone), await ref(lone));
});

dbTest('tickerIndexPage equals tickerIndex + filterTickerIndex + slice in one snapshot: both sorts, prefix, exact, none, invalid, and the cap after filtering', async () => {
  const { sql } = await import('./db.ts');
  const { filterTickerIndex, tickerIndex } = await import('./ticker.ts');
  const { tickerIndexPage } = await import('./ticker-sql.ts');
  const p = `X${rand().slice(0, 4)}`;
  const [a, b] = await users(2);
  const same = '2026-05-01T00:00:00.000';
  const t = (symbol: string, closed: string, user = a, verified = true): Ins => ({ user, symbol, opened: '2026-04-01T00:00:00Z', closed, r: 0.01, hold: 1, verified });
  await insert([
    // Same millisecond, different microseconds: the JS sort sees a tie and orders by symbol.
    t(`${p}B`, `${same}400Z`), t(`${p}A`, `${same}100Z`, b), t(`${p}A`, `${same}100Z`),
    t(`${p}.X`, '2026-05-02T00:00:00Z'), t(`${p}-X`, '2026-04-20T00:00:00Z', a, false), t(`${p}AB`, '2026-04-30T00:00:00Z'),
    t(`${p}0`, '2026-04-29T00:00:00Z'),
  ]);
  await sql.begin('isolation level repeatable read', async (tx) => {
    const aggs = (await tx`
      select symbol, count(*)::int as trades, count(distinct user_id)::int as traders,
             max(closed_at) as last_closed_at, count(*) filter (where verified)::int as verified_trades
      from closed_trades group by symbol`) as unknown as { symbol: string; trades: number; traders: number; last_closed_at: Date; verified_trades: number }[];
    for (const sort of ['recent', 'az'] as const) {
      const all = tickerIndex(aggs.map((x) => ({ symbol: x.symbol, trades: x.trades, traders: x.traders, lastClosedAt: x.last_closed_at, verifiedTrades: x.verified_trades })), sort);
      for (const [q, cap] of [[p, 100], [p, 3], [`${p}A`, 100], [` ${p.toLowerCase()}a `, 100], [`${p}Z`, 100], ['a%b', 100], ['_', 100], ['', 5], [undefined, 5], [['x'], 5]] as [unknown, number][]) {
        const f = filterTickerIndex(all, q);
        const got = await tickerIndexPage(q, sort, cap, tx);
        const label = `${sort} ${JSON.stringify(q)} cap ${cap}`;
        assert.equal(got.total, all.length, label);
        assert.equal(got.kind, f.kind, label);
        assert.equal(got.symbol, f.symbol, label);
        if (f.kind !== 'exact') assert.equal(got.matched, f.rows.length, label);
        assert.deepEqual(got.rows, f.kind === 'exact' ? f.rows : f.rows.slice(0, cap), label);
      }
    }
    const recent = await tickerIndexPage(p, 'recent', 100, tx);
    assert.deepEqual(recent.rows.map((r) => r.symbol), [`${p}.X`, `${p}A`, `${p}B`, `${p}AB`, `${p}0`, `${p}-X`]);
    const az = await tickerIndexPage(p, 'az', 100, tx);
    assert.deepEqual(az.rows.map((r) => r.symbol), [`${p}-X`, `${p}.X`, `${p}0`, `${p}A`, `${p}AB`, `${p}B`]);
    assert.equal(az.rows[0].demoOnly, true);
  });
});

test('likePrefix escapes LIKE wildcards and the escape character; the pages hold no ponytail note for what moved to SQL', async () => {
  const { likePrefix } = await import('./ticker-sql.ts');
  assert.equal(likePrefix('BRK.B'), 'BRK.B%');
  assert.equal(likePrefix('a%_\\'), 'a\\%\\_\\\\%');
  const page = readFileSync(new URL('../app/t/[symbol]/page.tsx', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../app/t/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page + index, /ponytail/);
  // The symbol page no longer reads every closed trade or groups the overlap in JS.
  assert.doesNotMatch(page, /relatedSymbols\(|tickerSummary\(|order by t\.closed_at desc, t\.id desc`\)/);
  assert.doesNotMatch(readFileSync(new URL('../app/t/[symbol]/opengraph-image.tsx', import.meta.url), 'utf8'), /from closed_trades/);
});
