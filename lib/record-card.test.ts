// F-4: the share card's model (lib/record-card.ts). One test per acceptance criterion of
// docs/features/F-4-share-card.md (AC1..AC10, in the feature file's order), then committee round 1's demands (R1..R10,
// docs/features/logs/F-4/committee-round-1.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_CHART_POINTS, CARD_LAYOUT, cardAlt, cardChart, cardLink, cardSeries, chartArea, disclaimerLines, noOrphan, periodText, readableAt, recordCard,
  UNFURL_COLUMN_GAP, zeroGutter, type CardInput, type CardKind, type CardModel,
} from './record-card.ts';
import { DISCLAIMER } from './share.ts';
import { FORMATS } from './story-image.ts';
import { equityCurve, type ConfidenceInput } from './trades.ts';
import { winRateText, type RecordState } from './copy.ts';

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
const KINDS: CardKind[] = ['unfurl', 'square', 'story'];
const STATES: RecordState[] = ['connected', 'none', 'importing', 'failed'];
// The text the image draws (not the enum fields that pick colors and layout).
const strings = (m: CardModel) => Object.entries(m).filter(([k, v]) => !['chart', 'kind', 'tone', 'headlineTone'].includes(k) && typeof v === 'string').map(([, v]) => v as string);

test('F-4 AC1: chart, total closed trades, period, name and handle', () => {
  const m = card(winning);
  assert.equal(m.name, 'Test Trader');
  assert.equal(m.handle, 'card_test');
  assert.equal(m.count, '12 closed trades · losses included');
  assert.equal(m.period, 'Record since Jan 2026 · 298 days'); // R1: the trust line's unit (thin: days), one span
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
  assert.equal(w.trust, 'Based on 12 separate bets over 298 days. Still early.');
  assert.equal(l.trust, 'Based on 12 separate bets over 298 days. Still early, and results could go either way.');
  assert.equal(card(winning.slice(0, 3)).trust, 'Based on 3 trades. The range is still too wide to say much.');
});

test('F-4 AC5: nothing the card says uses a banned term', () => {
  const banned = /\b(confidence intervals?|standard errors?|p[- ]?values?|alpha|sharpe|edges?|signals?|skills?)\b/i;
  for (const trades of [winning, losing, [], winning.slice(0, 3)])
    for (const kind of KINDS) {
      const m = card(trades, { kind });
      for (const v of [...strings(m), cardAlt(m)]) assert.doesNotMatch(v, banned, v);
    }
});

test('F-4 AC6: no per-trade rows, closing times or holding periods', () => {
  const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => [k, ...(v && typeof v === 'object' ? keys(v) : [])]);
  for (const m of [card(winning), card(losing, { kind: 'square' }), card([], { kind: 'story' })]) {
    for (const k of keys(m)) assert.doesNotMatch(k, /symbol|closed|opened|hold|held|worst|best|winrate|rows|list|trades?$/i, k);
    for (const v of [...strings(m), cardAlt(m)]) {
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
  for (const kind of KINDS)
    for (const state of STATES)
      for (const demo of [false, true])
        for (const trades of [[], winning]) {
          const m = card(trades, { kind, state, demo, verified: trades.length > 0 && !demo });
          const tag = `${kind} ${state} demo=${demo} n=${trades.length}`;
          assert.equal(m.disclaimer, DISCLAIMER, tag);
          assert.ok(typeof m.label === 'string' && m.label.length > 0, tag);
          if (demo) assert.equal(m.label, 'Demo data, not a real broker record', tag);
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
  for (const kind of KINDS) {
    const r = readableAt(kind, 375);
    assert.ok(r.smallest >= 10, `${kind}: smallest text ${r.smallest.toFixed(1)} CSS px at 375`);
    assert.ok(r.headline >= 28, `${kind}: headline ${r.headline.toFixed(1)} CSS px at 375`);
    const L = CARD_LAYOUT[kind];
    assert.ok(L.chart.w <= L.width && L.chart.h >= 120, `${kind}: chart fits`);
  }
  // The unfurl's text column and chart sit side by side inside the padding (the first render overflowed on the right).
  const U = CARD_LAYOUT.unfurl;
  assert.ok(U.left + UNFURL_COLUMN_GAP + U.chart.w <= U.width - 2 * U.padX);
});

test('F-4 AC10: snapshots of the three states (winning, losing, empty)', () => {
  assert.deepEqual(winText, {
    kind: 'unfurl', name: 'Test Trader', handle: 'card_test', label: 'Verified from broker', tone: 'ok', note: null, body: null,
    headline: '+3.0%', headlineTone: 'up', headlineLabel: 'average per trade', range: 'likely between +2.3% and +3.7%',
    count: '12 closed trades · losses included', countValue: '12 closed trades', countNote: 'losses included',
    period: 'Record since Jan 2026 · 298 days', periodSince: 'Record since Jan 2026', periodLength: '298 days',
    evidence: 'Evidence: thin', newRecord: false,
    trust: 'Based on 12 separate bets over 298 days. Still early.', caption: 'If every trade were the same size', link: null, disclaimer: DISCLAIMER,
  });
  const { chart: _l, ...loseText } = card(losing);
  assert.deepEqual(loseText, {
    ...winText, headline: '-2.9%', headlineTone: 'down', range: 'likely between -3.5% and -2.3%',
    trust: 'Based on 12 separate bets over 298 days. Still early, and results could go either way.',
  });
  assert.deepEqual(card([]), {
    kind: 'unfurl', name: 'Test Trader', handle: 'card_test', label: 'Broker connected', tone: 'ok', note: null, body: 'No closed trades yet',
    headline: null, headlineTone: null, headlineLabel: null, range: null, count: null, countValue: null, countNote: null,
    period: null, periodSince: null, periodLength: null, evidence: null, newRecord: false,
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

// ---- Committee round 1 (docs/features/logs/F-4/committee-round-1.md) ----

// A record whose first entry is `days` before now and whose last close is now: K independent bets (tight, gains).
const spanRecord = (days: number, k: number, r = 0.02) => {
  const start = now.getTime() - days * DAY;
  return Array.from({ length: k }, (_, i) => {
    const open = start + (i / (k - 1)) * (days - 0.5) * DAY;
    return { symbol: `R${i}`, openedAt: new Date(open), closedAt: new Date(open + 0.5 * DAY), returnPct: r + (i % 2 ? 0.001 : -0.001), holdingDays: 0.5 };
  });
};
const durationOf = (trust: string | null) => trust?.match(/ over (.+?)\. /)?.[1] ?? null;

test('R1: one duration per card: the period and the trust line give the same span, same end, same rounding', () => {
  // ~60 days of demo-like trading: 30 trades in 5 symbols, a close every 2 days (thin: under 90 days).
  const demoLike = Array.from({ length: 30 }, (_, i) => {
    const open = now.getTime() - (60 - i * 2) * DAY;
    return { symbol: ['A', 'B', 'C', 'D', 'E'][i % 5], openedAt: new Date(open), closedAt: new Date(open + 4 * DAY), returnPct: i % 3 ? 0.012 : -0.01, holdingDays: 4 };
  });
  const records: [string, ConfidenceInput[]][] = [
    ['winning', winning], ['losing', losing], ['heavy', spanRecord(1100, 600, 0.004)], ['demo-like', demoLike],
    ...[29, 30, 31, 364, 365, 400, 800].map((d) => [`${d} days`, spanRecord(d, d >= 364 ? (d >= 365 ? 120 : 40) : 8)] as [string, ConfidenceInput[]]),
  ];
  let compared = 0;
  for (const [name, trades] of records) {
    const m = card(trades);
    const d = durationOf(m.trust);
    if (!d) continue; // the too-early row has no duration
    assert.equal(m.periodLength, d, `${name}: period "${m.period}" vs trust "${m.trust}"`);
    assert.ok(m.period!.endsWith(` · ${d}`), name);
    compared++;
  }
  assert.ok(compared >= 9, `${compared} records compared`);
  assert.equal(card(demoLike).periodLength, '60 days'); // never "1 month" beside "60 days"
  assert.equal(card(spanRecord(29, 8)).periodLength, '29 days');
  assert.equal(card(spanRecord(364, 40)).periodLength, '11 months');
  assert.equal(card(spanRecord(365, 120)).periodLength, '1 year');
  assert.equal(card(spanRecord(400, 40)).periodLength, '13 months');
  assert.equal(card(winning.slice(0, 3)).periodLength, '9 months'); // too early: months (no duration in the trust line)
});

test('R2: every text is at least 10 CSS px at 343 px wide (the 0% label and body text included)', () => {
  for (const kind of KINDS) {
    const L = CARD_LAYOUT[kind];
    for (const [role, size] of Object.entries(L.font)) assert.ok((size * 343) / L.width >= 10, `${kind} ${role}: ${((size * 343) / L.width).toFixed(2)} CSS px`);
    assert.ok(readableAt(kind, 343).smallest >= 10);
    assert.ok(readableAt(kind, 343).headline >= 28);
  }
});

test('R3: hierarchy: the chart leads (square ≥ 360 px, story ≥ 560 px, ≥ 30% of the card), count and period at 1.5× body, one big number', () => {
  for (const kind of KINDS) {
    const L = CARD_LAYOUT[kind];
    assert.ok(L.font.line >= 1.5 * L.font.body, `${kind}: count/period ${L.font.line} vs body ${L.font.body}`);
    assert.ok(L.font.newRecord >= L.font.line, `${kind}: New record at least the count line's size`);
    assert.ok(L.font.headline > L.font.line && Object.values(L.font).every((s) => s <= L.font.headline), `${kind}: the average is the one big number`);
  }
  assert.ok(CARD_LAYOUT.square.chart.h >= 360);
  assert.ok(CARD_LAYOUT.story.chart.h >= 560);
  assert.ok(chartArea('square') >= 0.30, `square ${chartArea('square').toFixed(3)}`);
  assert.ok(chartArea('story') >= 0.30, `story ${chartArea('story').toFixed(3)}`);
  // Not met on the unfurl (see the round-2 log): what fits at 10 CSS px with every required element.
  assert.ok(chartArea('unfurl') >= 0.22, `unfurl ${chartArea('unfurl').toFixed(3)}`);
});

test('R4: the same trust label at every size, in every state; Demo is a toned badge, never grey', () => {
  for (const state of STATES)
    for (const demo of [false, true])
      for (const verified of [false, true])
        for (const trades of [[], winning]) {
          const ms = KINDS.map((kind) => card(trades, { kind, state, demo, verified: verified && trades.length > 0 }));
          assert.ok(ms.every((m) => m.label === ms[0].label && m.tone === ms[0].tone), `${state} demo=${demo} verified=${verified} n=${trades.length}: ${ms.map((m) => m.label)}`);
          if (demo) assert.equal(ms[0].tone, 'demo');
        }
  for (const kind of KINDS) assert.equal(card(winning, { kind }).label, 'Verified from broker');
});

test('R5: "New record" is a flag the card draws as a badge (no grey suffix on the evidence label)', () => {
  const young = card(winning.slice(0, 9)); // 9 closed trades: TR-7
  assert.equal(young.newRecord, true);
  assert.equal(young.evidence, 'Evidence: thin');
  assert.ok(strings(young).every((s) => !/New record/.test(s)));
  assert.equal(card(winning).newRecord, false);
  // A 3-digit month count and "under 1 month" stay one short string each.
  assert.equal(card(spanRecord(3400, 40)).periodLength, '111 months');
  assert.equal(card(spanRecord(10, 3)).periodLength, 'under 1 month');
});

test('R6: the 0% label sits in a gutter the line never enters', () => {
  for (const kind of KINDS) {
    for (const trades of [winning, losing, winning.slice(0, 1)]) {
      const c = cardChart(trades, CARD_LAYOUT[kind].chart, zeroGutter(kind))!;
      const x0 = Number(c.d.slice(1).split(' ')[0]); // the path's first (leftmost: x grows with time) point
      assert.ok(x0 >= c.gutter, `${kind}: path starts at ${x0}, gutter ${c.gutter}`);
      assert.ok(c.gutter >= c.labelW + 8, `${kind}: gutter holds the label and a gap`);
    }
  }
});

test('R7: no orphans: the disclaimer breaks after "advice."; the trust line never ends on one word', () => {
  assert.deepEqual(disclaimerLines(DISCLAIMER), ['Not investment advice.', 'Past performance does not guarantee future results.']);
  assert.equal(disclaimerLines(DISCLAIMER).join(' '), DISCLAIMER);
  const t = noOrphan('Based on 48 bets over 14 months. A fair sample, with no clear pattern yet.');
  assert.ok(t.endsWith('pattern yet.'));
  assert.equal(t.replace(/ /g, ' '), 'Based on 48 bets over 14 months. A fair sample, with no clear pattern yet.');
  assert.equal(noOrphan('one'), 'one');
  // A one- or two-letter word never ends a line apart from the next word (the render broke "... 14 months. A / fair").
  const s = noOrphan('Evidence: moderate · Based on 48 bets over 14 months. A fair sample.');
  assert.ok(s.includes('A fair') && s.includes('on 48 bets') && s.endsWith('fair sample.'), JSON.stringify(s));
});

test('R8: the printed profile link comes from the configured origin, never the request', () => {
  assert.equal(cardLink({ NEXT_PUBLIC_SITE_URL: 'https://records.example.com/' }, 'maya'), 'records.example.com/u/maya');
  assert.equal(cardLink({}, 'maya'), 'localhost:3000/u/maya');
  assert.equal(cardLink({ VERCEL_PROJECT_PRODUCTION_URL: 'app.example.org' }, 'a_b'), 'app.example.org/u/a_b');
});

test('R9: the alt text is the card in words: every string the image draws, "verified" only when the label says it', () => {
  const cases: [string, CardModel][] = [
    ['winning', card(winning)], ['losing', card(losing)], ['empty', card([])], ['demo', card(winning, { demo: true, verified: false })],
    ['not verified', card(winning, { state: 'none', verified: false })], ['no broker', card([], { state: 'none', verified: false })],
    ['failed', card(winning, { state: 'failed' })], ['new', card(winning.slice(0, 3))],
  ];
  for (const [name, m] of cases) {
    const alt = cardAlt(m);
    for (const s of strings(m)) assert.ok(alt.includes(s), `${name}: alt lacks "${s}": ${alt}`);
    if (m.newRecord) assert.match(alt, /New record/);
    if (m.headlineTone === 'up') assert.match(alt, /a gain/);
    if (m.headlineTone === 'down') assert.match(alt, /a loss/);
    assert.equal(/verified/i.test(alt), /verified/i.test(m.label), `${name}: ${alt}`);
  }
  assert.match(cardAlt(card(losing)), /-2\.9%, a loss/);
});

test('R10: the unfurl text says "0% win rate" when there are no wins (was "% win rate")', () => {
  assert.equal(winRateText(0), '0% win rate');
  assert.equal(winRateText(0.5), '50% win rate');
  assert.equal(winRateText(1), '100% win rate');
});
