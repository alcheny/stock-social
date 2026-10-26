// F-4: the share card's model (lib/record-card.ts). One test per acceptance criterion of
// docs/features/F-4-share-card.md (AC1..AC10, in the feature file's order).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD_CHART_POINTS, CARD_LAYOUT, cardSeries, periodText, readableAt, recordCard, UNFURL_COLUMN_GAP, type CardInput, type CardKind } from './record-card.ts';
import { DISCLAIMER } from './share.ts';
import { FORMATS } from './story-image.ts';
import { equityCurve, type ConfidenceInput } from './trades.ts';
import type { RecordState } from './copy.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);
const now = new Date(Date.UTC(2026, 9, 26, 12));
const tr = (symbol: string, open: number, close: number, r: number): ConfidenceInput => ({
  symbol, openedAt: new Date(t0 + open * DAY), closedAt: new Date(t0 + close * DAY), returnPct: r, holdingDays: close - open,
});
// 12 independent bets 10 days apart, +4% and +2% alternating; the losing record is its exact mirror in log terms.
const SYMBOLS = ['QZXA', 'QZXB', 'QZXC', 'QZXD', 'QZXE', 'QZXF', 'QZXG', 'QZXH', 'QZXI', 'QZXJ', 'QZXK', 'QZXL'];
const winning = SYMBOLS.map((s, i) => tr(s, i * 10, i * 10 + 5, i % 2 ? 0.02 : 0.04));
const losing = SYMBOLS.map((s, i) => tr(s, i * 10, i * 10 + 5, 1 / (i % 2 ? 1.02 : 1.04) - 1));
const base = { handle: 'card_test', name: 'Test Trader', state: 'connected' as RecordState, demo: false, verified: true, now, link: null };
const card = (trades: ConfidenceInput[], o: Partial<CardInput> = {}) =>
  recordCard({ ...base, kind: 'unfurl', trades, verified: trades.length > 0, ...o });
const { chart: _w, ...winText } = card(winning);

test('F-4 AC1: chart, total closed trades, period, name and handle', () => {
  const m = card(winning);
  assert.equal(m.name, 'Test Trader');
  assert.equal(m.handle, 'card_test');
  assert.equal(m.count, '12 closed trades · losses included');
  assert.equal(m.period, 'Record since Jan 2026 · 9 months');
  const c = m.chart!;
  assert.match(c.d, /^M[\d. -]+l[\d. -]+$/); // one path: a move, then one run of line segments (a single line)
  assert.ok(c.zeroY >= 0 && c.zeroY <= c.h, '0% is on the axis, inside the chart box');
  assert.equal(c.points, 13); // the 0% start and one point per close
  assert.equal(m.caption, 'If every trade were the same size'); // CH-1: the label says what is plotted
  assert.equal(card(winning, { name: null }).name, '@card_test');
});

test('F-4 AC2: one headline figure, the average per trade, with its range in words from 5 bets; no win rate', () => {
  const m = card(winning);
  assert.equal(m.headline, '+3.0%');
  assert.equal(m.headlineLabel, 'average per trade');
  assert.equal(m.range, 'likely between +2.3% and +3.7%'); // t(11) = 2.201, hand-checked in the build log
  assert.equal(card(winning.slice(0, 5)).range !== null, true); // K = 5: shown
  assert.equal(card(winning.slice(0, 4)).range, null); // K = 4: no range
  const all = JSON.stringify(m).toLowerCase();
  assert.ok(!all.includes('win rate') && !('winRate' in m));
});

test('F-4 AC3: "too early" follows the model, not a count', () => {
  assert.equal(card(winning.slice(0, 4)).evidence, 'Evidence: too early');
  assert.equal(card(winning.slice(0, 5)).evidence, 'Evidence: thin');
  // The same 12 bets with a wide spread: too early, the range still shown (it widens, it is not hidden).
  const wide = card(SYMBOLS.map((s, i) => tr(s, i * 10, i * 10 + 5, i % 2 ? -0.22 : 0.28)));
  assert.equal(wide.evidence, 'Evidence: too early');
  assert.match(wide.range!, /^likely between -\d+\.\d% and \+\d+\.\d%$/);
  assert.equal(wide.trust, 'Based on 12 trades. The range is still too wide to say much.');
});

test('F-4 AC4: the evidence label and one plain-language trust line from the fixed table', () => {
  const w = card(winning), l = card(losing);
  assert.equal(w.evidence, 'Evidence: thin');
  assert.equal(w.trust, 'Based on 12 separate bets over 115 days. Still early.');
  assert.equal(l.trust, 'Based on 12 separate bets over 115 days. Still early, and results could go either way.');
  assert.equal(card(winning.slice(0, 3)).trust, 'Based on 3 trades. The range is still too wide to say much.');
});

test('F-4 AC5: nothing the card says uses a banned term', () => {
  const banned = /\b(confidence intervals?|standard errors?|p[- ]?values?|alpha|sharpe|edges?|signals?|skills?)\b/i;
  for (const trades of [winning, losing, [], winning.slice(0, 3)])
    for (const kind of ['unfurl', 'square', 'story'] as const) {
      const { chart: _c, ...text } = card(trades, { kind });
      for (const v of Object.values(text)) if (typeof v === 'string') assert.doesNotMatch(v, banned, v);
    }
});

test('F-4 AC6: no per-trade rows, closing times or holding periods', () => {
  const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => [k, ...(v && typeof v === 'object' ? keys(v) : [])]);
  for (const m of [card(winning), card(losing, { kind: 'square' }), card([], { kind: 'story' })]) {
    for (const k of keys(m)) assert.doesNotMatch(k, /symbol|closed|opened|hold|held|worst|best|winrate|rows|list|trades?$/i, k);
    const { chart: _c, ...text } = m;
    for (const v of Object.values(text)) if (typeof v === 'string') {
      for (const s of SYMBOLS) assert.ok(!v.includes(s), `${v} names a symbol`);
      assert.doesNotMatch(v, /\bheld\b|holding|closed (on|at)|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b/, v);
    }
  }
});

test('F-4 AC7: a losing record has the same layout and prominence; the line is in the down color', () => {
  const w = card(winning), l = card(losing);
  assert.deepEqual(Object.keys(w), Object.keys(l));
  for (const k of ['label', 'tone', 'count', 'period', 'evidence', 'newRecord', 'headlineLabel', 'disclaimer'] as const) assert.equal(w[k], l[k], k);
  assert.equal(w.headlineTone, 'up');
  assert.equal(l.headlineTone, 'down');
  assert.equal(l.headline, '-2.9%');
  assert.equal(l.range, 'likely between -3.5% and -2.3%');
  assert.equal(w.chart!.down, false);
  assert.equal(l.chart!.down, true);
  assert.equal(w.chart!.w, l.chart!.w);
  assert.equal(w.chart!.h, l.chart!.h);
  // Mirrored: the losing line sits under the 0% baseline as far as the winning one sits over it.
  assert.ok(l.chart!.zeroY < l.chart!.h / 2 && w.chart!.zeroY > w.chart!.h / 2);
});

test('F-4 AC8: the disclaimer and the Verified or Demo state on every rendering, the empty record included', () => {
  for (const kind of ['unfurl', 'square', 'story'] as CardKind[])
    for (const state of ['connected', 'none', 'importing', 'failed'] as RecordState[])
      for (const demo of [false, true])
        for (const trades of [[], winning]) {
          const m = card(trades, { kind, state, demo, verified: trades.length > 0 && !demo });
          const tag = `${kind} ${state} demo=${demo} n=${trades.length}`;
          assert.equal(m.disclaimer, DISCLAIMER, tag);
          assert.ok(typeof m.label === 'string' && m.label.length > 0, tag);
          if (demo) assert.match(m.label, /^Demo data/, tag);
          else assert.doesNotMatch(m.label, /Demo/, tag);
          if (!demo && state === 'importing') assert.equal(m.body, 'Import in progress', tag);
          else if (trades.length === 0) assert.equal(m.body, 'No closed trades yet', tag);
          else assert.equal(m.body, null, tag);
        }
  // "Verified" only for a whole broker-sourced record (POLICY F3a): a record with an unverified trade is not.
  assert.equal(card(winning, { state: 'none', verified: false }).label, 'Not verified');
  assert.equal(card([], { state: 'none', verified: false }).label, 'No broker connected');
  assert.equal(card(winning).label, 'Verified from broker');
  assert.equal(card(winning, { state: 'failed' }).label, 'Import did not finish');
});

test('F-4 AC9: the share-image sizes, readable at a 375 px-wide preview', () => {
  assert.deepEqual([CARD_LAYOUT.unfurl.width, CARD_LAYOUT.unfurl.height], [1200, 630]); // the link unfurl image
  assert.deepEqual([CARD_LAYOUT.square.width, CARD_LAYOUT.square.height], [FORMATS.square.width, FORMATS.square.height]); // the Share button's image
  assert.deepEqual([CARD_LAYOUT.story.width, CARD_LAYOUT.story.height], [FORMATS.story.width, FORMATS.story.height]);
  for (const kind of ['unfurl', 'square', 'story'] as CardKind[]) {
    const r = readableAt(kind, 375);
    assert.ok(r.smallest >= 9.5, `${kind}: smallest text ${r.smallest.toFixed(1)} CSS px at 375`);
    assert.ok(r.headline >= 28, `${kind}: headline ${r.headline.toFixed(1)} CSS px at 375`);
    const L = CARD_LAYOUT[kind];
    assert.ok(L.chart.w <= L.width - 2 * L.padX && L.chart.h >= 120, `${kind}: chart fits`);
  }
  // The unfurl's text column and chart sit side by side inside the padding (the first render overflowed on the right).
  const U = CARD_LAYOUT.unfurl;
  assert.ok(U.left + UNFURL_COLUMN_GAP + U.chart.w <= U.width - 2 * U.padX);
});

test('F-4 AC10: snapshots of the three states (winning, losing, empty)', () => {
  assert.deepEqual(winText, {
    kind: 'unfurl', name: 'Test Trader', handle: 'card_test', label: 'Verified from broker', tone: 'ok', note: null, body: null,
    headline: '+3.0%', headlineTone: 'up', headlineLabel: 'average per trade', range: 'likely between +2.3% and +3.7%',
    count: '12 closed trades · losses included', period: 'Record since Jan 2026 · 9 months', evidence: 'Evidence: thin', newRecord: false,
    trust: 'Based on 12 separate bets over 115 days. Still early.', caption: 'If every trade were the same size', link: null, disclaimer: DISCLAIMER,
  });
  const { chart: _l, ...loseText } = card(losing);
  assert.deepEqual(loseText, {
    ...winText, headline: '-2.9%', headlineTone: 'down', range: 'likely between -3.5% and -2.3%',
    trust: 'Based on 12 separate bets over 115 days. Still early, and results could go either way.',
  });
  assert.deepEqual(card([]), {
    kind: 'unfurl', name: 'Test Trader', handle: 'card_test', label: 'Broker connected', tone: 'ok', note: null, body: 'No closed trades yet',
    headline: null, headlineTone: null, headlineLabel: null, range: null, count: null, period: null, evidence: null, newRecord: false,
    trust: null, caption: null, link: null, disclaimer: DISCLAIMER, chart: null,
  });
});

test('F-4 AC10: the period text at 0, 1 and many months', () => {
  const at = (iso: string) => new Date(`${iso}T09:00:00Z`);
  assert.equal(periodText(at('2026-10-03'), now), 'Record since Oct 2026 · under 1 month');
  assert.equal(periodText(at('2026-09-27'), now), 'Record since Sep 2026 · under 1 month');
  assert.equal(periodText(at('2026-09-26'), now), 'Record since Sep 2026 · 1 month');
  assert.equal(periodText(at('2024-03-15'), now), 'Record since Mar 2024 · 31 months');
  assert.equal(periodText(at('2014-01-01'), now), 'Record since Jan 2014 · 153 months');
  assert.equal(periodText(null, now), null);
});

test('F-4 AC10: thousands of trades: the chart is downsampled (low and high kept), the count is formatted', () => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const many = Array.from({ length: 5000 }, (_, i) => tr(`S${i % 40}`, i * 0.2, i * 0.2 + 0.1, (rnd() - 0.49) * 0.1));
  const started = performance.now();
  const m = card(many);
  assert.ok(performance.now() - started < 1000);
  assert.equal(m.count, '5,000 closed trades · losses included');
  const kept = cardSeries(many);
  assert.ok(kept.length <= CARD_CHART_POINTS, `${kept.length} points`);
  const all = [0, ...equityCurve(many).map((p) => p.cumulative)];
  const values = kept.map((p) => p.value);
  assert.equal(Math.min(...values), Math.min(...all));
  assert.equal(Math.max(...values), Math.max(...all));
  assert.equal(values.at(-1), all.at(-1));
  assert.ok(m.chart!.d.length < CARD_CHART_POINTS * 16, `${m.chart!.d.length} path characters`);
  // One trade still draws a line from 0%.
  assert.equal(cardSeries(winning.slice(0, 1)).length, 2);
});
