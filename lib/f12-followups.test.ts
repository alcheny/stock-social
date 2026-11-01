// Cycle-2 fixes #9 and #20 (docs/ideas/approval-2026-11-01-cycle2.md) and the F-10/F-12 review items: the trade image's
// band always fits (tradeBand), its symbol row never cuts its own return, and the trade and month images 404 for a
// missing record. Pure, plus source scans of the image routes (as lib/record-strip.guard.test.ts does).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pct } from './trades.ts';
import { DISCLAIMER_LINES, layoutBand, lineWidth, recordStrip, STRIP_BAND, stripImageLines, type ImageLine } from './record-strip.ts';
import { HERO_GLYPH, tradeBand, tradeHero, tradeSharePayload, tradeStripInput, type TradeView } from './trade-share.ts';
import { disclaimerAtFoot } from './stock-image.ts';
import type { RecapTrade } from './recap.ts';
import type { RecordState } from './copy.ts';

const DAY = 86_400_000;
const NOW = new Date(Date.UTC(2026, 9, 20, 12));
const t0 = Date.UTC(2025, 0, 1);
let seq = 0;
const tr = (openAt: number, closeAt: number, r: number, symbol = `Q${seq++}`): RecapTrade => ({
  sellId: `s${seq++}`, symbol, openedAt: new Date(openAt), closedAt: new Date(closeAt), returnPct: r, holdingDays: (closeAt - openAt) / DAY,
});
// k one-trade bets that never overlap, ending in 2025.
const record = (k: number) => Array.from({ length: k }, (_, i) => tr(t0 + i * 3 * DAY, t0 + (i * 3 + 2) * DAY, 0.009 + (i % 2 ? 0.004 : -0.004)));
const LONG_HANDLE = 'abcdefghijklmnopqrst';
const THESIS = 'Earnings beat expectations and the guidance was raised for the next two quarters, so I held through';

type Case = { symbol: string; ret: number; heldDays: number; closeDay: number; state: RecordState; demo: boolean };
function view(c: Case): TradeView {
  const closedAt = Date.UTC(2026, 8, c.closeDay, 15); // September 2026
  const pick = tr(closedAt - c.heldDays * DAY, closedAt, c.ret, c.symbol);
  const all = [...record(40), pick];
  const p = tradeSharePayload({ symbol: pick.symbol, returnPct: pick.returnPct, holdingDays: pick.holdingDays, closedAt: pick.closedAt, thesis: THESIS, thesisStatus: 'published', demo: c.demo, allTrades: all }, NOW);
  const real = !c.demo && (c.state === 'connected' || c.state === 'failed');
  return { ...p, handle: LONG_HANDLE, displayName: 'F12', state: c.state, verified: !c.demo, open: real ? [0.1, -0.2, 0.3] : undefined };
}

// Every placed line inside the band at the floor or above, no line wider than the band, the disclaimer whole at the foot.
function assertBand(laid: ReturnType<typeof layoutBand>, label: string): ImageLine[] {
  assert.ok(laid.fits, `${label}: fits`);
  assert.deepEqual(laid.tooWide, [], `${label}: tooWide`);
  const placed = disclaimerAtFoot(laid.lines);
  for (const l of placed) {
    assert.ok(l.y! >= STRIP_BAND.top && l.y! + l.size * STRIP_BAND.lineHeight <= STRIP_BAND.bottom + 1e-9, `${label} ${l.role} y=${l.y} size=${l.size}`);
    assert.ok(lineWidth(l) <= STRIP_BAND.width, `${label} ${l.role}: ${l.text}`);
    assert.ok(l.size >= STRIP_BAND.minPx, `${label} ${l.role} ${l.size}`);
  }
  assert.deepEqual(placed.filter((l) => l.role.startsWith('disclaimer')).map((l) => l.text), [...DISCLAIMER_LINES], label);
  return placed;
}

// The symbol row (800-weight) at the hero's wider glyph estimate: never past the band, and the return printed whole.
function assertSymbolRow(hero: ImageLine[], c: Pick<Case, 'symbol' | 'ret'>, label: string) {
  const rows = hero.filter((l) => l.role === 'symbol' || l.role === 'return');
  for (const l of rows) assert.ok(l.text.length * l.size * HERO_GLYPH <= STRIP_BAND.width, `${label} ${l.role} "${l.text}" at ${l.size}px`);
  const ret = pct(c.ret);
  assert.ok(rows.some((l) => l.text === `${c.symbol} ${ret}` || l.text === ret), `${label}: the return ${ret} is whole`);
  assert.ok(rows[0].text.startsWith(c.symbol), `${label}: symbol first`);
}

test('cycle-2 #9: failed import, short symbol, held under a day, closed Sep 30 — the old hero overflowed; tradeBand fits', () => {
  const c: Case = { symbol: 'X', ret: 0.01, heldDays: 0.2, closeDay: 30, state: 'failed', demo: false };
  const v = view(c);
  const strip = recordStrip(tradeStripInput(v), 'image');
  // The reproduced case: "held under a day · closed Sep 30, 2026" is too long for one line at 26 px, so it splits.
  const full = tradeHero(v);
  assert.deepEqual(full.filter((l) => l.role.startsWith('held')).map((l) => l.text), ['held under a day', 'closed Sep 30, 2026']);
  // At the largest sizes (80 px symbol row, 30 px held lines) the band overflows: that is the bug the route had.
  const old = layoutBand(stripImageLines(strip, { handle: v.handle, newRecord: v.newRecord, hero: full }));
  assert.equal(old.fits, false, 'the reproduced case overflows at the largest sizes');
  const placed = assertBand(tradeBand(v, strip), 'failed two-digit day');
  // The failed-import note and the strip are all there.
  for (const role of ['label', 'symbol', 'held0', 'held1', 'handle', 'count', 'losses', 'note0', 'disclaimer2']) assert.ok(placed.some((l) => l.role === role), role);
  assertSymbolRow(placed, c, 'failed two-digit day');
  // Shrinks only as far as needed: the symbol row stays the biggest line.
  const sym = placed.find((l) => l.role === 'symbol')!;
  assert.ok(placed.every((l) => l.size <= sym.size), `symbol ${sym.size}px`);
});

test('cycle-2 #9: symbols × returns × states × held × close days — every trade image band fits, nothing too wide', () => {
  const symbols = ['A', 'AB', 'ABC', 'ABCD', 'WWWWW', 'BRK.B', 'ABCDEFGHIJKLMNOPQRSTUVWXYZA']; // 1–5 letters, a class share, 27 chars
  const returns = [-0.999, 12.345, 123.456, -0.99999];
  const states: { state: RecordState; demo: boolean }[] = [{ state: 'connected', demo: false }, { state: 'failed', demo: false }, { state: 'connected', demo: true }];
  let n = 0;
  for (const symbol of symbols) for (const ret of returns) for (const s of states) for (const heldDays of [0.2, 365]) for (const closeDay of [1, 30]) {
    const c: Case = { symbol, ret, heldDays, closeDay, ...s };
    const label = `${symbol} ${pct(ret)} ${s.state}${s.demo ? ' demo' : ''} held ${heldDays} day ${closeDay}`;
    const v = view(c);
    const placed = assertBand(tradeBand(v, recordStrip(tradeStripInput(v), 'image')), label);
    assertSymbolRow(placed, c, label);
    n++;
  }
  assert.equal(n, symbols.length * returns.length * states.length * 2 * 2);
});

test('cycle-2 #9: the symbol row is sized from its text; it splits rather than cut the return', () => {
  for (const [symbol, ret] of [['ABCDE', 123.456], ['WWWWW', -0.99999], ['ABCDE', 1234.5], ['ABCDEFGHIJKLMNOPQRSTUVWXYZA', 123.456]] as const) {
    for (const symbolPx of [80, 40]) {
      const hero = tradeHero({ symbol, returnPct: ret, holdingDays: 365, closedAt: new Date(Date.UTC(2026, 8, 30)).toISOString(), thesis: null }, { symbolPx });
      assertSymbolRow(hero, { symbol, ret }, `${symbol} ${pct(ret)} max ${symbolPx}`);
      for (const l of hero) assert.ok(l.size <= Math.max(symbolPx, 30) && l.size >= STRIP_BAND.minPx, `${l.role} ${l.size}`);
    }
  }
  // A 27-character symbol with a five-digit return cannot share one line at the floor: two lines, the return whole.
  const long = tradeHero({ symbol: 'ABCDEFGHIJKLMNOPQRSTUVWXYZA', returnPct: 123.456, holdingDays: 1, closedAt: new Date(Date.UTC(2026, 8, 1)).toISOString(), thesis: null });
  assert.deepEqual(long.slice(0, 2).map((l) => l.role), ['symbol', 'return']);
  assert.equal(long[1].text, pct(123.456));
  // A short one stays on one line at the largest size.
  const short = tradeHero({ symbol: 'X', returnPct: 0.01, holdingDays: 1, closedAt: new Date(Date.UTC(2026, 8, 1)).toISOString(), thesis: null });
  assert.equal(short[0].text, `X ${pct(0.01)}`);
  assert.equal(short[0].size, 80);
  assert.ok(!short.some((l) => l.role === 'return'));
});

// ---- cycle-2 #20 (image part): a missing record is a 404, as the profile card is ----
const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('cycle-2 #20: the trade and month images call notFound() for a missing record and draw no "not found" picture', () => {
  for (const [f, loader] of [['app/u/[handle]/trade/[sellId]/opengraph-image.tsx', 'loadTradeShare'], ['app/u/[handle]/month/[ym]/opengraph-image.tsx', 'loadRecap']] as const) {
    const s = code(read(f));
    assert.match(s, /import \{ notFound \} from 'next\/navigation'/, f);
    assert.match(s, /if \(!\w+\) notFound\(\);/, f);
    assert.ok(s.includes(loader), f);
    assert.ok(!/not found/i.test(s), `${f} still draws a "not found" picture`);
    // A loader error is not turned into a missing record (a database outage is a 500, not a 404).
    assert.ok(!/\.catch\(/.test(s), f);
  }
  // The trade image lays out through tradeBand, so the retry is the one under test above.
  assert.match(code(read('app/u/[handle]/trade/[sellId]/opengraph-image.tsx')), /\btradeBand\(/);
});

test('review: the stock image counts closed trades of live traders only (the shared visible-user predicate, the page rule)', () => {
  const s = code(read('app/t/[symbol]/opengraph-image.tsx'));
  const q = s.slice(s.indexOf('from closed_trades'), s.indexOf('as unknown as'));
  // Cycle 2 fix #4: the rule is lib/visible-users.ts (deleted_at is null, extended by F-16), read through visibleUser('u').
  assert.match(q, /join users u on u\.id = t\.user_id and \$\{visibleUser\('u'\)\}/);
  assert.match(code(read('lib/visible-users.ts')), /deleted_at is null/); // code only: a comment can't keep it passing
});
