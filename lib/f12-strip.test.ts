// F-12: the record strip on the trade and month pages and images, and the stock image's lines
// (docs/features/logs/F-10/plan.md §1, §2, §4, §5, §7 and the round 3 amendments). Pure parts of the loaders and routes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DISCLAIMER } from './share.ts';
import { evidenceRangeText, cardEvidence } from './record-card.ts';
import { headline } from './trades.ts';
import { DISCLAIMER_LINES, layoutBand, lineWidth, recordStrip, SQUARE_CROP, STRIP_BAND, stripImageLines, stripTextAfterCount, type ImageLine } from './record-strip.ts';
import { tradeAlt, tradeDescription, tradeHero, tradeSharePayload, tradeStripInput, type TradeView } from './trade-share.ts';
import { monthAlt, monthDescription, monthRecap, monthStripInput, recordStripInput, wholeRecord, type RecapTrade, type RecapView } from './recap.ts';
import { monthBand, monthCard } from './month-card.ts';
import { disclaimerAtFoot, stockImageLines } from './stock-image.ts';
import type { RecordState } from './copy.ts';

const DAY = 86_400_000;
const NOW = new Date(Date.UTC(2026, 9, 20, 12));
const t0 = Date.UTC(2025, 0, 1);
let seq = 0;
// F-34: the positions' as-of date (openLine prints no undated value).
const OPEN_AS_OF = new Date('2026-09-30T12:00:00Z');
const tr = (open: number, close: number, r: number, symbol = `Q${seq++}`): RecapTrade => ({
  sellId: `s${seq++}`, symbol, openedAt: new Date(t0 + open * DAY), closedAt: new Date(t0 + close * DAY), returnPct: r, holdingDays: close - open,
});
// k one-trade bets that never overlap, ending before October 2026.
const record = (k: number, f: (i: number) => number) => Array.from({ length: k }, (_, i) => tr(i * 3, i * 3 + 2, f(i)));
const wobble = (m: number) => (i: number) => m + (i % 2 ? 0.004 : -0.004);
// A month of trades in September 2026 (days after t0: 2026-09-01 is day 608).
const sept = (k: number, f: (i: number) => number) => Array.from({ length: k }, (_, i) => tr(600 + i, 608 + i, f(i)));

// Comments say why; the source scans read code and copy only (as lib/record-strip.guard.test.ts does).
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
const BANNED = /win rate|full record|whole record|full-record|every trade|Past results/i;

function tradeView(all: RecapTrade[], o: Partial<TradeView> = {}, pick = all[all.length - 1]): TradeView {
  const p = tradeSharePayload({ symbol: pick.symbol, returnPct: pick.returnPct, holdingDays: pick.holdingDays, closedAt: pick.closedAt, thesis: 'A thesis', thesisStatus: 'published', demo: false, allTrades: all }, NOW);
  return { ...p, handle: 'f12_trader', displayName: 'F12', state: 'connected', verified: true, ...o };
}
function recapView(all: RecapTrade[], ym: string, o: Partial<RecapView> = {}): RecapView {
  return { handle: 'f12_trader', displayName: 'F12', demo: false, verified: true, state: 'connected', recap: monthRecap(all, ym, NOW)!, record: wholeRecord(all, NOW), ...o };
}

// ---- loaders' pure parts: the strip's inputs ----
test('trade payload: strip figures from every closed trade of the trader (losses included); existing fields kept', () => {
  const all = [...record(30, wobble(0.02)), tr(200, 201, -0.4)];
  const v = tradeView(all);
  assert.equal(v.strip.avg, headline(all).avgReturn);
  assert.deepEqual(v.strip.evidence.perTrade, cardEvidence(all, NOW).perTrade);
  assert.equal(v.strip.evidence.n, all.length);
  for (const k of ['symbol', 'returnPct', 'holdingDays', 'closedAt', 'thesis', 'demo', 'record', 'newRecord']) assert.ok(k in v, k);
  const s = recordStrip(tradeStripInput(v), 'page');
  assert.ok(s.text.startsWith(`${all.length} closed trades · `), s.text);
  assert.ok(s.text.includes(`${evidenceRangeText(cardEvidence(all, NOW))} · 95% range · losses included`), s.text);
  // The open count only when the loader passed open positions (connected or failed records).
  assert.ok(recordStrip(tradeStripInput({ ...v, open: [0.1, -0.2], openAsOf: OPEN_AS_OF }), 'page').text.endsWith('losses included · Still open: 2 positions · 1\u00a0up, 1\u00a0down · lowest -20.0%\u00a0down, highest +10.0%\u00a0up, unrealized as of Sep 30, 2026'));
  assert.ok(!/open/.test(s.text));
});

test('month recap: month figures over the month only, whole-record figures over every trade; existing fields kept', () => {
  const all = [...record(40, wobble(0.01)), ...sept(6, wobble(-0.05))];
  const r = recapView(all, '2026-09');
  assert.equal(r.recap.count, 6);
  assert.equal(r.recap.figures.avg, headline(all.slice(40)).avgReturn);
  assert.equal(r.recap.figures.evidence.n, 6);
  assert.equal(r.record.strip.evidence.n, 46);
  for (const k of ['ym', 'label', 'monthSoFar', 'count', 'wins', 'losses', 'avgReturn', 'winRate', 'showHeadline', 'best', 'worst', 'trades', 'evidence', 'range']) assert.ok(k in r.recap, k);
  for (const k of ['trades', 'winRate', 'avgReturn', 'evidence', 'range', 'newRecord']) assert.ok(k in r.record, k);
  const whole = recordStrip(recordStripInput(r), 'page');
  assert.ok(whole.text.startsWith('46 closed trades · '));
  const month = recordStrip(monthStripInput(r), 'figures');
  assert.ok(!month.figures.some((p) => p.role === 'count'), 'R3-2: the month figures carry no count');
});

test('F-12 AC6: losing and winning months show the same fields (month figures and whole record)', () => {
  const base = record(40, wobble(0.01));
  const win = recapView([...base, ...sept(8, wobble(0.03))], '2026-09');
  const lose = recapView([...base, ...sept(8, wobble(-0.03))], '2026-09');
  const roles = (r: RecapView) => recordStrip(monthStripInput(r), 'figures').figures.map((p) => p.role);
  assert.deepEqual(roles(win), roles(lose));
  assert.deepEqual(roles(win), ['average', 'range', 'rangeLabel']);
  assert.deepEqual(Object.keys(win.recap), Object.keys(lose.recap));
  const wl = monthBand(win, recordStrip(recordStripInput(win), 'image'), recordStrip(monthStripInput(win), 'figures')).lines.map((l) => l.role);
  const ll = monthBand(lose, recordStrip(recordStripInput(lose), 'image'), recordStrip(monthStripInput(lose), 'figures')).lines.map((l) => l.role);
  assert.deepEqual(wl, ll);
  // A short month: Too early, the same roles for a loss or a gain.
  const shortW = recapView([...base, ...sept(2, () => 0.1)], '2026-09');
  const shortL = recapView([...base, ...sept(2, () => -0.1)], '2026-09');
  assert.deepEqual(roles(shortW), ['early']);
  assert.deepEqual(roles(shortL), ['early']);
});

// ---- alt and metadata ----
const STATES: RecordState[] = ['connected', 'failed', 'importing', 'none'];
test('F-12 AC4: trade and month alt = prefix + strip alt: count, average with range in words, losses included, disclaimer', () => {
  const all = [...record(40, wobble(0.009)), ...sept(6, wobble(0.02))];
  const v = tradeView(all, { open: [0.1, 0.2, 0.3], openAsOf: OPEN_AS_OF });
  const s = recordStrip(tradeStripInput(v), 'image');
  const alt = tradeAlt(v, s);
  assert.ok(alt.startsWith(`Closed trade ${v.symbol} +`), alt);
  assert.ok(alt.endsWith(s.alt));
  const perTrade = cardEvidence(all, NOW).perTrade!;
  assert.match(alt, /46 closed trades, average per trade [+-]\d+\.\d%, 95% range [+-]\d+\.\d% to [+-]\d+\.\d%\./);
  assert.ok(perTrade.low < perTrade.high);
  assert.match(alt, /Losses included\./);
  assert.match(alt, /Still open: 3 positions, 3 up, 0 down, lowest \+10\.0% up, highest \+30\.0% up, unrealized as of Sep 30, 2026\./);
  assert.ok(alt.endsWith(DISCLAIMER), alt);
  assert.ok(!/[·()]/.test(alt), alt);
  const r = recapView(all, '2026-09', { open: [0.1], openAsOf: OPEN_AS_OF });
  const w = recordStrip(recordStripInput(r), 'image'), m = recordStrip(monthStripInput(r), 'figures');
  const malt = monthAlt(r, w, m);
  assert.ok(malt.startsWith('September 2026 closed trades by @f12_trader on Stock Social.'), malt);
  assert.match(malt, /6 closed trades this month/);
  assert.ok(malt.endsWith(w.alt));
  assert.ok(!/[·()]/.test(malt), malt);
  // Too early: said in words, no average.
  const thin = tradeView(record(3, wobble(0.1)));
  const ta = tradeAlt(thin, recordStrip(tradeStripInput(thin), 'image'));
  assert.match(ta, /3 closed trades, too early to tell\./);
  assert.ok(!/average/.test(ta));
});

test('F-12 AC5 / #44: no win rate, verdict or completeness words in alt or metadata, any state, demo or not', () => {
  for (const trades of [record(40, wobble(0.01)), record(3, wobble(-0.2)), [...record(20, wobble(-0.03)), ...sept(1, () => -0.5)]]) {
    const all = [...trades, ...sept(3, wobble(0.01))];
    for (const state of STATES) for (const demo of [false, true]) {
      const v = tradeView(all, { state, demo, verified: !demo, open: [0.1], openAsOf: OPEN_AS_OF });
      const ts = recordStrip(tradeStripInput(v), 'image');
      const r = recapView(all, '2026-09', { state, demo, verified: !demo });
      const w = recordStrip(recordStripInput(r), 'image'), m = recordStrip(monthStripInput(r), 'figures');
      for (const s of [tradeAlt(v, ts), tradeDescription(v, ts), monthAlt(r, w, m), monthDescription(r, w)]) {
        assert.ok(!BANNED.test(s), s);
        if (demo) { assert.match(s, /[Dd]emo/); assert.ok(!/verified/i.test(s), s); }
      }
      if (state === 'importing' && !demo) {
        assert.ok(tradeDescription(v, ts).includes('so far · Import in progress'));
        assert.ok(!/%/.test(tradeDescription(v, ts)));
        assert.ok(!/%/.test(monthDescription(r, w).replace(/^\d+ closed trades? this month · /, '')));
      } else {
        assert.ok(tradeDescription(v, ts).endsWith(DISCLAIMER));
        // The figures after the count, and the count said once (wholeRecordPreview leads with it).
        assert.ok(tradeDescription(v, ts).includes(stripTextAfterCount(ts)));
        assert.equal(tradeDescription(v, ts).match(/\d+ (verified |demo |closed )?trades?\b/g)?.length ?? 0, 1, tradeDescription(v, ts));
      }
    }
  }
  const v = tradeView(record(12, wobble(0.02)), { demo: true, verified: false });
  assert.match(tradeDescription(v, recordStrip(tradeStripInput(v), 'image')), /^\d+ demo trades · /);
});

test('importing trader: no figures, no open count on the strip even if open positions were passed', () => {
  const v = tradeView(record(12, wobble(0.02)), { state: 'importing', verified: false, open: [0.1], openAsOf: OPEN_AS_OF });
  const s = recordStrip(tradeStripInput(v), 'page');
  assert.ok(s.importing);
  assert.deepEqual(s.figures, []);
});

// ---- images ----
const longThesis = 'Earnings beat expectations and the guidance was raised for the next two quarters, so I held through';
function checkBand(lines: ImageLine[], label: string) {
  const laid = layoutBand(lines);
  const { fits, tooWide } = laid;
  const placed = disclaimerAtFoot(laid.lines);
  // The disclaimer sits at the foot of the band, below every other line, without overlapping them.
  const d0 = placed.findIndex((l) => l.role === 'disclaimer0'), d2 = placed.find((l) => l.role === 'disclaimer2')!;
  assert.ok(STRIP_BAND.bottom - (d2.y! + d2.size * STRIP_BAND.lineHeight) < 1, `${label}: disclaimer at the foot`);
  if (d0 > 0) assert.ok(placed[d0].y! >= placed[d0 - 1].y! + placed[d0 - 1].size * STRIP_BAND.lineHeight, `${label}: no overlap`);
  assert.ok(fits, `${label}: fits`);
  assert.deepEqual(tooWide, [], label);
  for (const l of placed) {
    assert.ok(l.y! >= STRIP_BAND.top && l.y! + l.size * STRIP_BAND.lineHeight <= STRIP_BAND.bottom, `${label} ${l.role} y`);
    assert.ok(lineWidth(l) <= STRIP_BAND.width, `${label} ${l.role}: ${l.text}`);
    assert.ok(l.size >= STRIP_BAND.minPx, `${label} ${l.role} ${l.size}`);
    if (l.role !== 'thesis') assert.ok(!l.text.includes('…'), `${label} ${l.role}`);
    assert.ok(!BANNED.test(l.text), l.text);
  }
  assert.ok(STRIP_BAND.x >= SQUARE_CROP.x0 && STRIP_BAND.x + STRIP_BAND.width <= SQUARE_CROP.x1);
  const roles = placed.map((l) => l.role);
  for (const k of [0, 1, 2]) assert.ok(roles.includes(`disclaimer${k}`), `${label} disclaimer${k}`);
  assert.deepEqual(placed.filter((l) => l.role.startsWith('disclaimer')).map((l) => l.text), [...DISCLAIMER_LINES]);
  return placed;
}

test('F-12 AC3 (model): trade image lines fit the band in the worst cases; the thesis is one clipped, optional line', () => {
  const long = 'abcdefghijklmnopqrst';
  for (const state of STATES) for (const demo of [false, true]) for (const [sym, ret, hold] of [['ABCDEFGHIJ', -0.987, 0.2], ['BRK.B', 12.345, 1234], ['X', 0, 1]] as const) {
    const all = [...record(40, wobble(0.009)), tr(700, 700 + hold, ret, sym)];
    const v = { ...tradeView(all, { state, demo, verified: !demo, open: [0.1, 0.2, 0.3], openAsOf: OPEN_AS_OF, handle: long }), thesis: longThesis };
    const s = recordStrip(tradeStripInput(v), 'image');
    const hero = tradeHero(v);
    const thesis = hero.find((l) => l.role === 'thesis')!;
    assert.equal(thesis.optional, true);
    assert.equal(thesis.size, STRIP_BAND.minPx);
    assert.ok(lineWidth(thesis) <= STRIP_BAND.width);
    assert.ok(thesis.text.endsWith('…”'), thesis.text);
    const sym1 = hero.find((l) => l.role === 'symbol')!;
    assert.ok(sym1.size <= 80 && sym1.text.startsWith(sym), sym1.text);
    const placed = checkBand(stripImageLinesFor(s, v, hero), `${state} demo=${demo} ${sym}`);
    if (!s.importing) {
      assert.ok(placed.some((l) => l.text.startsWith('losses included')));
      for (const l of placed) if (['count', 'average', 'early'].includes(l.role)) assert.equal(l.size, STRIP_BAND.recordPx);
    }
  }
  // No thesis: no thesis line; a short thesis is not clipped.
  const v = tradeView(record(12, wobble(0.02)));
  assert.equal(tradeHero({ ...v, thesis: null }).some((l) => l.role === 'thesis'), false);
  assert.equal(tradeHero({ ...v, thesis: 'Short' }).find((l) => l.role === 'thesis')!.text, '“Short”');
  const held = tradeHero({ ...v, holdingDays: 3 }).filter((l) => l.role.startsWith('held'));
  assert.ok(held.every((l) => l.size >= 26 && l.size <= 30));
  assert.match(held.map((l) => l.text).join(' '), /^held 3 days · closed [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
});

const stripImageLinesFor = (s: ReturnType<typeof recordStrip>, v: TradeView, hero: ImageLine[]) => stripImageLines(s, { handle: v.handle, newRecord: true, hero });

test('F-12 AC3 (model): month image lines fit the band in the worst cases; no win rate, no best or worst', () => {
  const long = 'abcdefghijklmnopqrst';
  for (const state of STATES) for (const demo of [false, true]) for (const month of [sept(25, (i) => (i % 2 ? 9.5 : -0.99)), sept(1, () => -0.5), sept(8, wobble(0.01))]) {
    const all = [...record(40, wobble(0.009)), ...month];
    const r = recapView(all, '2026-09', { state, demo, verified: !demo, open: [0.1, 0.2], openAsOf: OPEN_AS_OF, handle: long });
    const w = recordStrip(recordStripInput(r), 'image'), m = recordStrip(monthStripInput(r), 'figures');
    const band = monthBand(r, w, m);
    const placed = checkBand(band.lines, `${state} demo=${demo} n=${month.length}`);
    const label = placed.find((l) => l.role === 'month')!;
    assert.ok(label.size >= 40 && label.size <= 52, String(label.size));
    assert.equal(label.text, 'September 2026');
    const count = placed.find((l) => l.role === 'monthCount')!;
    assert.equal(count.text, `${month.length === 1 ? '1 closed trade' : `${month.length} closed trades`} this month`);
    assert.ok(!placed.some((l) => /Best|Worst|Only trade/.test(l.text)));
    if (!w.importing) assert.ok(placed.some((l) => l.role === 'monthEarly' || l.role === 'monthAverage'));
  }
  // The month so far: September as the current month, with the longest label.
  const nowSept = new Date(Date.UTC(2026, 8, 30, 12));
  const all = [...record(40, wobble(0.009)), ...sept(25, wobble(0.01))];
  const r: RecapView = { ...recapView(all, '2026-09', { state: 'failed', open: [0.1], openAsOf: OPEN_AS_OF, handle: long }), recap: monthRecap(all, '2026-09', nowSept)! };
  const placed = checkBand(monthBand(r, recordStrip(recordStripInput(r), 'image'), recordStrip(monthStripInput(r), 'figures')).lines, 'so far');
  assert.match(placed.find((l) => l.role === 'monthCount')!.text, /this month so far$/);
});

test('monthCard adapter: same shape and roles; the record line is the strip\'s figures text; disclaimer lines added', () => {
  const all = [...record(40, wobble(0.009)), ...sept(6, wobble(0.02))];
  const r = recapView(all, '2026-09');
  const c = monthCard(r);
  const rec = c.bottom.find((l) => l.role === 'record')!;
  assert.equal(rec.text, recordStrip(recordStripInput(r), 'page').text);
  assert.equal(c.disclaimer.text, DISCLAIMER);
  assert.deepEqual(c.disclaimer.lines, [...DISCLAIMER_LINES]);
  for (const l of [...c.top, ...c.bottom]) assert.ok(!BANNED.test(l.text), l.text);
});

test('stock image: status, symbol, closed-trade count, traders with losses included, disclaimer; no pooled figures', () => {
  const cases = [
    { symbol: 'ABCDEFGHIJ', n: 12345, traders: 1234, demoOnly: false, mixed: false, label: 'Verified from broker' },
    { symbol: 'BRK.B', n: 1, traders: 1, demoOnly: false, mixed: true, label: 'Includes sample data' },
    { symbol: 'X', n: 3, traders: 2, demoOnly: true, mixed: false, label: 'Demo data' },
  ];
  for (const c of cases) {
    const placed = checkBand(stockImageLines(c), c.symbol);
    assert.equal(placed[0].text, c.label);
    const sym = placed.find((l) => l.role === 'symbol')!;
    assert.equal(sym.text, c.symbol);
    assert.ok(sym.size <= 120);
    assert.ok(placed.some((l) => l.text === (c.n === 1 ? '1 closed trade' : `${c.n.toLocaleString('en-US')} closed trades`)), JSON.stringify(placed));
    assert.ok(placed.some((l) => /traders? · losses included$/.test(l.text)));
    const all = placed.map((l) => l.text).join(' ');
    assert.ok(!/%|average|range|win rate|Past results/i.test(all), all);
    if (c.demoOnly) assert.ok(!/verified/i.test(all));
  }
});

// ---- F-12 AC7: per-trade cards list closed trades only ----
test('F-12 AC7: trade and month surfaces read closed trades only; open positions only as a count', () => {
  const root = new URL('..', import.meta.url);
  const src = (p: string) => code(readFileSync(new URL(p, root), 'utf8'));
  for (const f of ['lib/trade-share-load.ts', 'lib/recap-load.ts']) {
    const s = src(f);
    // The only open_positions read is the unrealized percent, never a symbol.
    for (const m of s.matchAll(/from open_positions/g)) assert.match(s.slice(Math.max(0, m.index! - 80), m.index), /select unrealized_pct\s*$/, f);
  }
  for (const f of ['app/u/[handle]/trade/[sellId]/page.tsx', 'app/u/[handle]/month/[ym]/page.tsx', 'app/u/[handle]/trade/[sellId]/opengraph-image.tsx', 'app/u/[handle]/month/[ym]/opengraph-image.tsx']) {
    const s = src(f);
    assert.ok(!/open_positions|positions\.map|\.open\b\.map/.test(s), f);
    assert.ok(!BANNED.test(s.replace(/(id|aria-labelledby)="whole-record"/g, '')), `${f}: ${BANNED.exec(s)?.[0]}`);
  }
  // Month trade list: every row is a closed trade of that month.
  const all = [...record(10, wobble(0.01)), ...sept(4, wobble(0.02))];
  const r = recapView(all, '2026-09');
  assert.ok(r.recap.trades.every((t) => t.closedAt.getUTCMonth() === 8 && t.closedAt.getUTCFullYear() === 2026));
});

test('pages and images: no "Past results" or win rate in sources (F-12 AC5, AC6)', () => {
  const root = new URL('..', import.meta.url);
  for (const f of ['app/u/[handle]/trade/[sellId]/page.tsx', 'app/u/[handle]/month/[ym]/page.tsx', 'app/u/[handle]/trade/[sellId]/opengraph-image.tsx', 'app/u/[handle]/month/[ym]/opengraph-image.tsx', 'app/t/[symbol]/opengraph-image.tsx', 'lib/stock-image.ts']) {
    const s = code(readFileSync(new URL(f, root), 'utf8'));
    assert.ok(!/Past results|win rate|winRate|evidenceLine/.test(s), f);
  }
  const stock = readFileSync(new URL('app/t/[symbol]/opengraph-image.tsx', root), 'utf8');
  assert.match(stock, /export const alt = 'Closed trades in one stock on Stock Social'/);
  for (const f of ['app/u/[handle]/trade/[sellId]/opengraph-image.tsx', 'app/u/[handle]/month/[ym]/opengraph-image.tsx']) {
    assert.ok(!/export const alt\b/.test(readFileSync(new URL(f, root), 'utf8')), `${f}: alt comes from generateMetadata`);
  }
});

