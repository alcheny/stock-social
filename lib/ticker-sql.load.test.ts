// Scale check for lib/ticker-sql.ts: one symbol with thousands of closed trades. The page data comes back with the
// trade list capped, aggregates equal to the JS helpers over every row, and well inside a generous time bound.
// Runs in `npm test` whenever DATABASE_URL is set (the fixture is small enough); its symbols and handles are its own.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 120_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
const made: number[] = [];
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  for (let i = 0; i < made.length; i += 100) await sql`delete from users where id in ${sql(made.slice(i, i + 100))}`;
  await sql.end({ timeout: 1 });
});

const DAY = 86_400_000;
const FIX = { traders: 60, perTrader: 50, otherSymbols: 30, otherPerTrader: 20, indexSymbols: 250 };
// Generous: each measured call takes tens of milliseconds locally; the bound only catches a return to per-row work.
const BOUND_MS = 3_000;
const tag = `tl${Math.random().toString(36).slice(2, 8)}`;
const P = `L${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const SYM = `${P}X`;

async function fixture() {
  const { sql } = await import('./db.ts');
  const users = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, ${FIX.traders}) returning id),
         n as (select id, row_number() over (order by id) as k from a)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag} || k, ${tag} || k, now(), id from n returning id`;
  const ids = users.map((u) => u.id as number);
  made.push(...ids);
  const now = Date.now();
  const rows = [];
  for (const [u, id] of ids.entries()) {
    for (let i = 0; i < FIX.perTrader; i++) {
      // Every 7th trade overlaps the one before it (same bet), the rest are separate; returns span losses and gains.
      const closed = now - (i * 9 + u) * DAY - u * 1000;
      const hold = i % 7 === 0 ? 12 : 1 + ((u + i) % 30);
      rows.push({ user_id: id, sell_id: `${tag}-${u}-${i}`, account_id: 'a', symbol: SYM, opened_at: new Date(closed - hold * DAY), closed_at: new Date(closed),
        return_pct: (((u * 31 + i * 17) % 401) - 200) / 1000, holding_days: hold, verified: u % 10 !== 0 });
    }
    for (let i = 0; i < FIX.otherPerTrader; i++) {
      const closed = now - (i + 1) * DAY;
      rows.push({ user_id: id, sell_id: `${tag}-${u}-o${i}`, account_id: 'a', symbol: `${P}O${(u * 3 + i) % FIX.otherSymbols}`, opened_at: new Date(closed - DAY), closed_at: new Date(closed),
        return_pct: 0.01, holding_days: 1, verified: true });
    }
  }
  for (let i = 0; i < FIX.indexSymbols; i++) {
    const closed = now - i * 60_000;
    rows.push({ user_id: ids[i % ids.length], sell_id: `${tag}-i${i}`, account_id: 'a', symbol: `${P}I${i}`, opened_at: new Date(closed - DAY), closed_at: new Date(closed),
      return_pct: -0.02, holding_days: 1, verified: true });
  }
  for (let i = 0; i < rows.length; i += 1000) await sql`insert into closed_trades ${sql(rows.slice(i, i + 1000))}`;
  await sql`analyze closed_trades`;
  return ids;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ v: T; ms: number }> {
  await fn(); // warm the pool and the plan cache
  const s = performance.now();
  const v = await fn();
  return { v, ms: performance.now() - s };
}

dbTest(`one symbol with ${FIX.traders * FIX.perTrader} trades: capped list, exact aggregates, related stocks and the index search all within ${BOUND_MS} ms`, async () => {
  const { sql } = await import('./db.ts');
  const T = await import('./ticker.ts');
  const { pct, rangeText, evidenceLine } = await import('./trades.ts');
  const { tickerPage, tickerHeadline, relatedSymbolsSql, tickerIndexPage } = await import('./ticker-sql.ts');
  await fixture();
  const n = FIX.traders * FIX.perTrader;
  const today = new Date();

  const page = await timed(() => tickerPage(SYM, today, 500));
  console.log(`ticker-sql load: tickerPage ${Math.round(page.ms)} ms for ${n} trades`);
  assert.ok(page.ms < BOUND_MS, `tickerPage took ${page.ms} ms`);
  assert.equal(page.v.rows.length, 500, 'only the display cap is read');
  assert.equal(page.v.summary.n, n);
  assert.equal(page.v.summary.traders, FIX.traders);
  assert.ok(page.v.summary.mixed);
  assert.equal(page.v.verifiedTraders, FIX.traders - FIX.traders / 10);

  // Reference: the pre-SQL page's full read and the JS helpers.
  const all = (await sql`
    select t.id, t.user_id, t.return_pct, t.holding_days, t.opened_at, t.closed_at, t.verified
    from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
    where t.symbol = ${SYM} order by t.closed_at desc, t.id desc`) as unknown as (import('./ticker.ts').TradeRow & { id: number })[];
  const tr = all.map(T.toTicker);
  const ref = T.tickerSummary(tr, today);
  const shown = (s: import('./ticker.ts').TickerSummary) => [s.n, s.wins, s.traders, s.mixed, pct(s.avgReturn!), rangeText(s.conf!), evidenceLine(s.conf!), s.conf!.k];
  assert.deepEqual(shown(page.v.summary), shown(ref));
  assert.ok(Object.is(page.v.summary.avgReturn, ref.avgReturn));
  assert.ok(page.v.summary.conf!.k < n, 'overlapping holds cluster into fewer bets');
  assert.deepEqual(page.v.rows.map((r) => r.id), all.slice(0, 500).map((r) => r.id));
  assert.deepEqual(page.v.spread, T.outcomeSpread(all.map((r) => T.toSpreadPct(r.return_pct)).filter(Number.isFinite)));
  assert.deepEqual(page.v.timeline, T.monthlyTimeline(tr, today));
  const refHolds = T.holdBuckets(tr, today);
  assert.deepEqual(page.v.holds.buckets.map((b) => [b.n, b.shown, b.avgReturn, b.conf && rangeText(b.conf)]), refHolds.buckets.map((b) => [b.n, b.shown, b.avgReturn, b.conf && rangeText(b.conf)]));
  const refC = T.concentration(tr, today);
  assert.equal(page.v.concentration?.kind, refC?.kind);

  const head = await timed(() => tickerHeadline(SYM));
  assert.ok(head.ms < BOUND_MS, `tickerHeadline took ${head.ms} ms`);
  assert.deepEqual(shown(head.v.summary), shown(ref));

  const related = await timed(() => relatedSymbolsSql(SYM));
  console.log(`ticker-sql load: relatedSymbolsSql ${Math.round(related.ms)} ms`);
  assert.ok(related.ms < BOUND_MS, `relatedSymbolsSql took ${related.ms} ms`);
  const overlap = (await sql`
    select o.symbol, o.user_id, o.verified from closed_trades o
    where o.symbol <> ${SYM} and o.user_id in (select distinct user_id from closed_trades where symbol = ${SYM})`) as unknown as { symbol: string; user_id: number; verified: boolean }[];
  const refRelated = T.relatedSymbols(overlap.map((o) => ({ symbol: o.symbol, userId: o.user_id, verified: o.verified })), SYM);
  assert.equal(related.v.length, 8);
  assert.deepEqual(related.v.map((r) => r.symbol).filter((s) => s.startsWith(`${P}O`)), refRelated.map((r) => r.symbol).filter((s) => s.startsWith(`${P}O`)));

  const idx = await timed(() => tickerIndexPage(`${P}I`, 'az', 100));
  console.log(`ticker-sql load: tickerIndexPage ${Math.round(idx.ms)} ms`);
  assert.ok(idx.ms < BOUND_MS, `tickerIndexPage took ${idx.ms} ms`);
  assert.equal(idx.v.kind, 'prefix');
  assert.equal(idx.v.matched, FIX.indexSymbols, 'the count is taken before the cap');
  assert.equal(idx.v.rows.length, 100, 'the cap applies after filtering');
  const sorted = Array.from({ length: FIX.indexSymbols }, (_, i) => `${P}I${i}`).sort();
  assert.deepEqual(idx.v.rows.map((r) => r.symbol), sorted.slice(0, 100));
  const recent = await tickerIndexPage(`${P}I`, 'recent', 10);
  assert.deepEqual(recent.rows.map((r) => r.symbol), Array.from({ length: 10 }, (_, i) => `${P}I${i}`));
});
