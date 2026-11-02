// FIXES-LABELS (code review) on the stock page:
// - item 2 (POLICY F3b): the baseline's data-kind is never a verdict (baselineKind: empty, demo_only, too_few_trades, shown).
// - item 3: on a mixed stock, this stock's baseline side is its verified rows only, the same population as the other side.
// - item 6: relatedSymbolsSql leaves out deleted users' trades, as tradesOf does.
// - item 8: the baseline is read in the page's own snapshot (tickerPageWithBaseline).
// Fixtures use their own random symbols and handles and remove only their own users.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { baselineKind, baselineLines, baselineVerdict, tickerSummary, type TickerRow } from './ticker.ts';
import { FIXES_LABELS as FL } from './copy.ts';
import { confidence } from './trades.ts';

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
const T0 = Date.UTC(2026, 1, 1);
const today = new Date(T0 + 300 * DAY);
const rand = () => Math.random().toString(36).slice(2, 7).toUpperCase().replace(/^[0-9]/, 'Q');
const VERDICT = /^(clearly_lower|clearly_higher|no_clear_difference)$/;

const rows = (n: number, verified: (i: number) => boolean, user = (i: number) => i % 4): TickerRow[] => Array.from({ length: n }, (_, i) => ({
  userId: user(i), returnPct: ((i * 37) % 23 - 9) / 100, holdingDays: 2, openedAt: new Date(T0 + i * 5 * DAY), closedAt: new Date(T0 + (i * 5 + 2) * DAY), verified: verified(i),
}));

test('item 2: baselineKind never names a verdict; the three render states keep the names the e2e branches on', () => {
  const seen = new Set<string>();
  const many = tickerSummary(rows(30, () => true), today), few = tickerSummary(rows(3, () => true), today);
  const demo = tickerSummary(rows(30, () => false), today), mixed = tickerSummary(rows(30, (i) => i % 3 > 0), today);
  for (const s of [many, few, demo, mixed]) for (const n of [0, 1, 500]) {
    const k = baselineKind(s, { n });
    seen.add(k);
    assert.doesNotMatch(k, VERDICT);
    // Wherever the old verdict said clearly_* or no_clear_difference, the attribute is the neutral 'shown'.
    for (const perTrade of [-0.5, 0, 0.02, 0.9]) {
      const v = baselineVerdict(s, { n, winRate: 0.5, perTrade: n ? perTrade : null, demoOnly: s.demoOnly }).kind;
      if (VERDICT.test(v)) assert.equal(k, 'shown', `${v} → shown`);
      else assert.equal(k, v, `${v} stays`);
    }
  }
  assert.deepEqual([...seen].sort(), ['demo_only', 'empty', 'shown', 'too_few_trades']);
  const src = readFileSync(new URL('../app/t/[symbol]/Baseline.tsx', import.meta.url), 'utf8');
  assert.match(src, /data-kind=\{kind\}/);
  assert.match(src, /const kind = baselineKind\(/);
  assert.doesNotMatch(src + readFileSync(new URL('../app/t/[symbol]/page.tsx', import.meta.url), 'utf8'), /baselineVerdict/);
});

test('item 3: a mixed stock\'s line says verified closed trades and its own verified count; the note says both sides are verified', () => {
  const r = rows(30, (i) => i % 3 > 0);
  const verified = r.filter((x) => x.verified);
  const vs = tickerSummary(verified, today);
  const others = { n: 40, conf: confidence(rows(40, () => true).map((x) => ({ symbol: String(x.userId), openedAt: x.openedAt, closedAt: x.closedAt, returnPct: x.returnPct, holdingDays: x.holdingDays })), today) };
  const l = baselineLines('NVDA', { n: vs.n, traders: vs.traders, conf: vs.conf, verifiedOnly: true }, others);
  assert.match(l.this, new RegExp(`^${verified.length} verified closed trades in NVDA by ${vs.traders} traders`));
  // Unchanged for a stock without Demo rows.
  assert.match(baselineLines('NVDA', tickerSummary(rows(30, () => true), today), others).this, /^30 closed trades in NVDA/);
  assert.match(FL.baselineMixedNote, /verified trades only/);
  assert.match(FL.baselineMixedNote, /Demo/);
  assert.doesNotMatch(FL.baselineMixedNote, /\b(every|all|complete|better|worse|beat)\b/i);
});

async function users(n: number) {
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `tr${Math.random().toString(36).slice(2, 8)}`;
  const ids: number[] = [];
  for (let i = 0; i < n; i++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${i}` })).id);
  made.push(...ids);
  return ids;
}
let seq = 0;
async function insert(xs: { user: number; symbol: string; day: number; r: number; verified?: boolean }[]) {
  const { sql } = await import('./db.ts');
  await sql`insert into closed_trades ${sql(xs.map((x) => ({ user_id: x.user, sell_id: `trv-${Date.now()}-${seq++}-${Math.random()}`, account_id: 'a', symbol: x.symbol,
    opened_at: new Date(T0 + x.day * DAY), closed_at: new Date(T0 + (x.day + 2) * DAY), return_pct: x.r, holding_days: 2, verified: x.verified ?? true })))}`;
}

dbTest('item 3 + 8: tickerPageWithBaseline: a mixed stock\'s own side is its verified rows (count, traders, win rate, range); a verified stock has none; one snapshot', async () => {
  const { sql } = await import('./db.ts');
  const { tickerPageWithBaseline, othersConfidence, tickerPage } = await import('../app/t/ticker-sql.ts');
  const sym = `M${rand()}`, pure = `P${rand()}`;
  const [a, b, c] = await users(3);
  const xs: { user: number; symbol: string; day: number; r: number; verified?: boolean }[] = [];
  for (let i = 0; i < 12; i++) xs.push({ user: [a, b, c][i % 3], symbol: sym, day: i * 6, r: ((i * 7) % 11 - 4) / 100, verified: i % 4 !== 0 });
  for (let i = 0; i < 6; i++) xs.push({ user: [a, b][i % 2], symbol: pure, day: i * 6, r: 0.01 * (i - 2) });
  await insert(xs);
  const page = await tickerPageWithBaseline(sym, today, 50);
  assert.ok(page.summary.mixed);
  assert.ok(page.baseline?.self, 'a mixed stock has its own verified side');
  const v = xs.filter((x) => x.symbol === sym && x.verified !== false);
  assert.equal(page.baseline!.self!.n, v.length);
  assert.equal(page.baseline!.self!.traders, new Set(v.map((x) => x.user)).size);
  assert.equal(page.baseline!.self!.winRate, v.filter((x) => x.r > 0).length / v.length);
  const ref = tickerSummary(v.map((x) => ({ userId: x.user, returnPct: x.r, holdingDays: 2, openedAt: new Date(T0 + x.day * DAY), closedAt: new Date(T0 + (x.day + 2) * DAY), verified: true })), today);
  assert.equal(page.baseline!.self!.conf.k, ref.conf!.k);
  assert.equal(page.baseline!.self!.conf.perTrade === null, ref.conf!.perTrade === null);
  if (ref.conf!.perTrade) assert.ok(Math.abs(page.baseline!.self!.conf.perTrade!.mid - ref.conf!.perTrade.mid) < 1e-9);
  // The page part is tickerPage's; the other side is othersConfidence's (same reads, one snapshot here).
  await sql.begin('isolation level repeatable read read only', async (tx) => {
    const inTx = await tickerPageWithBaseline(sym, today, 50, tx as never);
    const plain = await tickerPage(sym, today, 50, tx as never);
    assert.deepEqual(inTx.summary, plain.summary);
    assert.deepEqual(inTx.baseline!.others, await othersConfidence(sym, true, tx as never));
  });
  const p = await tickerPageWithBaseline(pure, today, 50);
  assert.equal(p.summary.mixed, false);
  assert.equal(p.baseline?.self, null);
  // An unknown symbol: no baseline read at all.
  assert.equal((await tickerPageWithBaseline(`Z${rand()}`, today, 50)).baseline, null);
});

dbTest('item 8: the page and its baseline run in one transaction (the baseline is no longer a separate read)', async () => {
  const src = readFileSync(new URL('../app/t/ticker-sql.ts', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export async function tickerPageWithBaseline'));
  assert.match(fn, /return snapshot\(sql, async \(tx\) =>/);
  assert.match(fn, /sideConfidence\(q, symbol, 'others'/);
  assert.match(src.slice(0, src.indexOf('export async function othersConfidence')), /FIXES-CYCLE5: other symbols from ticker_trader_sums/); // F5-4: the resolved ponytail's fix marker (plan-round2 §4)
  const page = readFileSync(new URL('../app/t/[symbol]/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /othersConfidence\(|from closed_trades\s+where symbol <>/);
});

dbTest('item 6: relatedSymbolsSql leaves out a deleted user\'s trades (counts and the two-trader floor)', async () => {
  const { sql } = await import('./db.ts');
  const { relatedSymbolsSql } = await import('../app/t/ticker-sql.ts');
  const p = rand().slice(0, 4);
  const main = `D${p}`, other = `D${p}O`, only = `D${p}G`;
  const [a, b, gone] = await users(3);
  await insert([
    { user: a, symbol: main, day: 1, r: 0.01 }, { user: b, symbol: main, day: 1, r: 0.01 }, { user: gone, symbol: main, day: 1, r: 0.01 },
    { user: a, symbol: other, day: 3, r: 0.02 }, { user: b, symbol: other, day: 3, r: 0.02 }, { user: gone, symbol: other, day: 3, r: 0.02 }, { user: gone, symbol: other, day: 4, r: 0.02 },
    { user: gone, symbol: only, day: 5, r: 0.02 },
  ]);
  const before = await relatedSymbolsSql(main);
  assert.deepEqual(before.map((r) => [r.symbol, r.traders, r.trades]), [[other, 3, 4], [only, 1, 1]]);
  await sql`update users set deleted_at = now() where id = ${gone}`;
  const got = await relatedSymbolsSql(main);
  assert.deepEqual(got.map((r) => [r.symbol, r.traders, r.trades, r.demoOnly]), [[other, 2, 2, false]]);
  // With the deleted user gone, a symbol only one live trader shares falls under the two-trader floor.
  await sql`update users set deleted_at = now() where id = ${b}`;
  assert.deepEqual(await relatedSymbolsSql(main), []);
});
