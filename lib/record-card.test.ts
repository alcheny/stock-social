// F-4 PR 2: the record card's model (lib/record-card.ts). Criteria 1, 2, 4, 5, 6, 7 and 10 (model level), the UX lead's
// U4–U8, U10–U12, U14, U15 and the business lead's C1 and C6. Every card string comes from here; PR 3 only draws it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANVAS_WIDTH, CARD_POINTS, cardDirection, cardHeadline, cardPct, cardStrings, evidenceLabel, FLOORS, FORMATS, PALETTE,
  parseFormat, periodText, recordCard, SCALE, TINT, trustLine, type CardModel, type CardTrade, type RecordCardInput,
} from './record-card.ts';
import { covered } from './card-glyphs.ts';
import { confidence, equityCurve, type Confidence } from './trades.ts';
import { DISCLAIMER } from './share.ts';
import { profileCardAlt, RECORD_BODY, SHARE_CARD, shareCardText } from './copy.ts';
import { PROMO } from '../scripts/compliance.ts';

const DAY = 86_400_000;
const NOW = new Date(Date.UTC(2026, 9, 24, 12));
const T0 = Date.UTC(2025, 2, 10, 15); // Mar 10 2025

type Opt = { start?: number; step?: number; hold?: number; verified?: boolean; sym?: (i: number) => string };
const trades = (rets: number[], o: Opt = {}): CardTrade[] => rets.map((r, i) => {
  const open = (o.start ?? T0) + i * (o.step ?? 3) * DAY, hold = o.hold ?? 2;
  return { symbol: o.sym?.(i) ?? `CRD${i}`, openedAt: new Date(open), closedAt: new Date(open + hold * DAY), returnPct: r, holdingDays: hold, verified: o.verified ?? true };
});
const input = (ts: CardTrade[], over: Partial<RecordCardInput> = {}): RecordCardInput =>
  ({ trades: ts, state: 'connected', demo: false, frozenEnd: null, now: NOW, handle: 'card_tester', displayName: 'Card Tester', host: 'stocksocial.example', ...over });
const card = (ts: CardTrade[], over: Partial<RecordCardInput> = {}) => recordCard(input(ts, over));
const wave = (n: number, mean: number, spread: number) => Array.from({ length: n }, (_, i) => mean + (i % 2 ? spread : -spread));
const mirror = (ts: CardTrade[]) => ts.map((t) => ({ ...t, returnPct: 1 / (1 + t.returnPct) - 1 }));
const conf = (o: Partial<Confidence>): Confidence => ({ n: 30, k: 30, spanDays: 61, tier: 'thin', direction: null, perTrade: { low: 0.001, mid: 0.013, high: 0.027 }, pace30: null, tradesPerMonth: 15, ...o });

// The fixtures every scan runs over.
const WIN = trades(wave(12, 0.02, 0.01));
const LOSE = mirror(WIN);
const FIXTURES: [string, RecordCardInput][] = [
  ['winning', input(WIN)],
  ['losing', input(LOSE)],
  ['flat', input(trades(wave(12, 0, 0.01)))],
  ['too early, K < 5', input(trades([0.02, -0.01, 0.03, 0.01]))],
  ['too early by width', input(trades(wave(8, 0, 0.4)))],
  ['moderate', input(trades(wave(40, 0.01, 0.005)))],
  ['moderate losing', input(mirror(trades(wave(40, 0.01, 0.005))))],
  ['moderate unclear', input(trades(wave(40, 0, 0.05)))],
  ['strong', input(trades(wave(120, 0.01, 0.005), { step: 4 }))],
  ['strong losing', input(mirror(trades(wave(120, 0.01, 0.005), { step: 4 })))],
  ['strong unclear', input(trades(wave(120, 0, 0.08), { step: 4 }))],
  ['thin unclear', input(trades(wave(12, 0, 0.05)))],
  ['empty', input([])],
  ['empty, none', input([], { state: 'none' })],
  ['importing', input(WIN, { state: 'importing' })],
  ['failed', input(WIN, { state: 'failed' })],
  ['demo', input(WIN, { demo: true })],
  ['demo, empty', input([], { demo: true })],
  ['unverified closes', input(trades(wave(12, 0.02, 0.01), { verified: false }))],
  ['one trade', input(trades([0.05]))],
  ['40-character name', input(WIN, { displayName: 'A'.repeat(19) + ' ' + 'B'.repeat(20) })],
];
const MODELS = FIXTURES.map(([name, i]) => [name, recordCard(i)] as const);
const allText = (m: CardModel) => [...cardStrings(m, 'wide'), ...cardStrings(m, 'tall'), m.alt];

test('criterion 1: the ALL series from 0% (0% on the axis), the trade count, the period, name and handle', () => {
  const m = card(WIN);
  assert.equal(m.body, 'record');
  assert.equal(m.count, '12 trades');
  assert.equal(m.lossesIncluded, 'losses included');
  assert.equal(m.period, 'Record since Mar 2025 · 19 months');
  assert.equal(m.name, 'Card Tester');
  assert.equal(m.handle, '@card_tester');
  for (const layout of ['wide', 'tall'] as const) {
    const g = m.chart!.geometry[layout];
    assert.ok(g.baseline >= 0 && g.baseline <= g.height, 'the y domain contains 0');
    // The line starts at the 0% baseline, at the gutter's edge.
    assert.match(g.line, new RegExp(`^M${g.gutter} ${g.baseline} L`));
    assert.ok(Math.abs(g.stop - g.baseline / g.height) < 1e-9);
    assert.match(g.area, /Z$/);
  }
  assert.equal(m.chart!.zeroLabel, '0%');
  assert.equal(m.chart!.caption, 'Return if every trade were the same size');
  assert.ok(m.chart!.points <= CARD_POINTS);
  // One trade: the count reads singular.
  assert.equal(card(trades([0.05])).count, '1 trade');
});

test('criterion 2: one headline, the average return per trade, with its range from 5 bets; no win rate anywhere', () => {
  const five = card(trades(wave(5, 0.02, 0.003)));
  assert.equal(five.headline!.label, 'average return per trade');
  assert.equal(five.headline!.value, '+1.9%'); // (3 × 1.7% + 2 × 2.3%) / 5
  assert.match(five.range!, /^likely between [+\u2212]?\d+\.\d+% and [+\u2212]?\d+\.\d+%$/);
  const four = card(trades(wave(4, 0.02, 0.003)));
  assert.equal(four.range, null);
  assert.equal(four.headline!.value, '+2.0%');
  // Too early by width keeps its range.
  const wide = card(trades(wave(8, 0, 0.4)));
  assert.equal(wide.evidence, 'Evidence: too early');
  assert.match(wide.range!, /^likely between \u2212\d+\.\d% and \+\d+\.\d%$/);
  for (const [name, m] of MODELS) {
    assert.ok(!('winRate' in m), name);
    for (const s of allText(m)) assert.doesNotMatch(s, /win rate/i, `${name}: ${s}`);
  }
});

test('criterion 4: one assertion per trust-line cell (10 cells), N bets or trades, D, M and Y floored', () => {
  const iv = (low: number, high: number) => ({ low, mid: (low + high) / 2, high });
  const pos = iv(0.002, 0.03), neg = iv(-0.03, -0.002), mid = iv(-0.01, 0.02);
  assert.equal(trustLine(conf({ tier: 'too-early', n: 4, k: 4, perTrade: null }), 4), 'Based on 4 trades. The range is still too wide to say much.');
  assert.equal(trustLine(conf({ k: 30, spanDays: 61.9, perTrade: pos }), 30), 'Based on 30 separate bets over 61 days. Still early.');
  assert.equal(trustLine(conf({ k: 30, spanDays: 61.9, perTrade: mid }), 30), 'Based on 30 separate bets over 61 days. Still early, and results could go either way.');
  assert.equal(trustLine(conf({ k: 30, spanDays: 61.9, perTrade: neg }), 30), 'Based on 30 separate bets over 61 days. Still early, and so far the average trade is a loss.');
  assert.equal(trustLine(conf({ tier: 'moderate', k: 140, spanDays: 200, perTrade: pos }), 140), 'Based on 140 bets over 6 months. A fair sample.');
  assert.equal(trustLine(conf({ tier: 'moderate', k: 140, spanDays: 200, perTrade: mid }), 140), 'Based on 140 bets over 6 months. A fair sample, with no clear pattern yet.');
  assert.equal(trustLine(conf({ tier: 'moderate', k: 140, spanDays: 200, perTrade: neg }), 140), 'Based on 140 bets over 6 months. A fair sample, and the average trade is a loss.');
  assert.equal(trustLine(conf({ tier: 'strong', k: 140, spanDays: 800, perTrade: pos }), 140), 'Based on 140 bets over 2 years. A long, consistent record.');
  assert.equal(trustLine(conf({ tier: 'strong', k: 140, spanDays: 800, perTrade: mid }), 140), 'Based on 140 bets over 2 years. A long record, with no clear pattern.');
  assert.equal(trustLine(conf({ tier: 'strong', k: 140, spanDays: 800, perTrade: neg }), 140), 'Based on 140 bets over 2 years. A long record, with consistent losses.');
  // Too early by width counts trades too, and keeps the same line whatever the direction.
  assert.equal(trustLine(conf({ tier: 'too-early', n: 2828, k: 9, perTrade: iv(-0.3, 0.4) }), 2828), 'Based on 2,828 trades. The range is still too wide to say much.');
  // Singulars, and the floors: D = max(1, floor(days)), M = floor(days / 30.44), Y = floor(days / 365.25).
  assert.equal(trustLine(conf({ tier: 'too-early', n: 1, k: 1, perTrade: null }), 1), 'Based on 1 trade. The range is still too wide to say much.');
  assert.equal(trustLine(conf({ k: 5, spanDays: 0.4, perTrade: pos }), 5), 'Based on 5 separate bets over 1 day. Still early.');
  assert.equal(trustLine(conf({ k: 5, spanDays: 1.99, perTrade: pos }), 5), 'Based on 5 separate bets over 1 day. Still early.');
  assert.equal(trustLine(conf({ tier: 'moderate', k: 30, spanDays: 90, perTrade: pos }), 30), 'Based on 30 bets over 2 months. A fair sample.');
  assert.equal(trustLine(conf({ tier: 'moderate', k: 30, spanDays: 91.4, perTrade: pos }), 30), 'Based on 30 bets over 3 months. A fair sample.');
  assert.equal(trustLine(conf({ tier: 'strong', k: 100, spanDays: 365.25, perTrade: pos }), 100), 'Based on 100 bets over 1 year. A long, consistent record.');
  assert.equal(trustLine(conf({ tier: 'strong', k: 100, spanDays: 730.4, perTrade: pos }), 100), 'Based on 100 bets over 1 year. A long, consistent record.');
  assert.equal(trustLine(conf({ tier: 'strong', k: 100, spanDays: 730.5, perTrade: pos }), 100), 'Based on 100 bets over 2 years. A long, consistent record.');
});

test('criterion 4: direction is read from the per-trade range on the card; "consistent" only strong, one side of 0, for losses as for gains', () => {
  assert.equal(cardDirection({ low: 0.0001, mid: 0.01, high: 0.02 }), 'positive');
  assert.equal(cardDirection({ low: -0.02, mid: -0.01, high: -0.0001 }), 'negative');
  assert.equal(cardDirection({ low: 0, mid: 0.01, high: 0.02 }), 'unclear');
  assert.equal(cardDirection({ low: -0.02, mid: -0.01, high: 0 }), 'unclear');
  assert.equal(cardDirection(null), 'unclear');
  const lines: string[] = [];
  for (const tier of ['too-early', 'thin', 'moderate', 'strong'] as const)
    for (const perTrade of [{ low: 0.01, mid: 0.02, high: 0.03 }, { low: -0.03, mid: -0.02, high: -0.01 }, { low: -0.01, mid: 0, high: 0.01 }, null]) {
      const line = trustLine(conf({ tier, perTrade, spanDays: 800, k: 140 }), 140);
      lines.push(line);
      const oneSide = !!perTrade && (perTrade.low > 0 || perTrade.high < 0);
      assert.equal(/consistent/.test(line), tier === 'strong' && oneSide, line);
    }
  // Real fixtures: mirrored records give mirrored cells.
  const cell = (ts: CardTrade[]) => card(ts).trust!.text;
  assert.match(cell(WIN), /Still early\.$/);
  assert.match(cell(LOSE), /Still early, and so far the average trade is a loss\.$/);
  const mod = trades(wave(40, 0.01, 0.005)), strong = trades(wave(120, 0.01, 0.005), { step: 4 });
  assert.match(cell(mod), /A fair sample\.$/);
  assert.match(cell(mirror(mod)), /A fair sample, and the average trade is a loss\.$/);
  assert.match(cell(strong), /A long, consistent record\.$/);
  assert.match(cell(mirror(strong)), /A long record, with consistent losses\.$/);
  assert.match(cell(trades(wave(120, 0, 0.08), { step: 4 })), /A long record, with no clear pattern\.$/);
  assert.match(cell(trades(wave(40, 0, 0.05))), /A fair sample, with no clear pattern yet\.$/);
  assert.match(cell(trades(wave(12, 0, 0.05))), /Still early, and results could go either way\.$/);
});

test('criterion 5 (reader test): no card string uses a statistics or advice term, and the longest cell with the disclaimer is ≤ 50 words', () => {
  const READER = /\b(confidence interval|standard error|p-value|alpha|sharpe|edge|signal|skill)\b/i;
  const cells = [
    ...['positive', 'unclear', 'negative'].flatMap((d) => (['thin', 'moderate', 'strong'] as const).map((tier) => trustLine(conf({ tier, k: 12345, n: 12345, spanDays: 4000, perTrade: d === 'positive' ? { low: 0.01, mid: 0.02, high: 0.03 } : d === 'negative' ? { low: -0.03, mid: -0.02, high: -0.01 } : { low: -0.01, mid: 0, high: 0.01 } }), 12345))),
    trustLine(conf({ tier: 'too-early', n: 12345, k: 3 }), 12345),
    ...(['too-early', 'thin', 'moderate', 'strong'] as const).map((tier) => evidenceLabel(conf({ tier }))),
  ];
  for (const s of [...cells, ...MODELS.flatMap(([, m]) => allText(m))]) {
    assert.doesNotMatch(s, READER, s);
    for (const re of PROMO) assert.doesNotMatch(s, re, s);
    // The caption "Return if every trade were the same size" is the profile's hypothetical, not a completeness claim.
    assert.doesNotMatch(s, /skill|proven|guaranteed|all of their trades|every trade (is|was)|any broker/i, s);
  }
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  for (const c of cells) assert.ok(words(c) + words(DISCLAIMER) <= 50, c);
});

test('C1: "95%" and "confidence" never appear on the card; "range" appears only in the owner\'s too-early trust line', () => {
  for (const [name, m] of MODELS) {
    for (const s of [...cardStrings(m, 'wide'), ...cardStrings(m, 'tall')]) {
      assert.doesNotMatch(s, /95%|confidence/i, `${name}: ${s}`);
      if (/\brange\b/i.test(s)) assert.match(s, /^Based on [\d,]+ trades?\. The range is still too wide to say much\.$/, `${name}: ${s}`);
    }
  }
});

test('criterion 6: the model has no per-trade field; no symbol, closing time or holding period appears in any string', () => {
  const KEYS = ['body', 'name', 'handle', 'badge', 'headline', 'range', 'evidence', 'trust', 'count', 'lossesIncluded', 'period', 'chart', 'message', 'link', 'disclaimer', 'alt'];
  for (const [name, m] of MODELS) {
    assert.deepEqual(Object.keys(m).sort(), [...KEYS].sort(), name);
    const json = JSON.stringify(m);
    assert.doesNotMatch(json, /CRD\d/, name);
    assert.doesNotMatch(json, /\b20\d\d-\d\d-\d\d|T\d\d:\d\d|held|holding|\bdays? held/i, name);
  }
  for (const [, m] of MODELS) if (m.chart) assert.deepEqual(Object.keys(m.chart).sort(), ['caption', 'end', 'geometry', 'max', 'min', 'points', 'tone', 'zeroLabel']);
});

test('criterion 7 and U6: a losing record has the same layout and prominence as the mirrored winning one; the line is down when the record ends below 0', () => {
  const win = card(WIN), lose = card(LOSE);
  const norm = (m: CardModel) => JSON.stringify({ ...m, trust: m.trust && { ...m.trust, text: 'CELL' }, chart: m.chart && { ...m.chart, end: 0, min: 0, max: 0, geometry: Object.keys(m.chart.geometry) }, alt: m.alt.replace(m.trust!.text, 'CELL') })
    .replace(/[+\u2212-]?\d[\d,]*(\.\d+)?%/g, 'P').replace(/"(up|down)"/g, '"dir"');
  assert.equal(norm(lose), norm(win));
  assert.equal(win.chart!.tone, 'up');
  assert.equal(lose.chart!.tone, 'down');
  assert.equal(lose.headline!.tone, 'down');
  assert.ok(lose.headline!.value.startsWith('\u2212'), 'U+2212 for minus');
  assert.ok(lose.range!.includes('\u2212'));
  for (const s of allText(lose)) assert.doesNotMatch(s, /-\d/, `hyphen-minus in ${s}`);
  // A record that ends exactly at 0 draws its line in the text colour.
  const flat = card(trades([0, 0]));
  assert.equal(flat.chart!.tone, 'text');
});

test('U5: an average gain with a compounded loss gives a headline in up and a line in down; the headline colour follows the printed value', () => {
  const m = card(trades([0.5, -0.4]));
  assert.equal(m.headline!.value, '+5.0%');
  assert.equal(m.headline!.tone, 'up');
  assert.equal(m.chart!.tone, 'down');
  assert.equal(cardHeadline(0.0004).text, '0.0%');
  assert.equal(cardHeadline(0.0004).tone, 'text');
  assert.equal(cardHeadline(-0.0004).tone, 'text');
  assert.equal(cardHeadline(-0.012).text, '\u22121.2%');
  assert.equal(cardHeadline(-0.012).tone, 'down');
});

test('U7: a non-zero range bound never prints "0.0%" (2, then 3, then 4 decimals, sign kept); a strong record just below 0 reads consistent losses', () => {
  assert.equal(cardPct(-0.0004), '\u22120.04%');
  assert.equal(cardPct(0.0004), '+0.04%');
  assert.equal(cardPct(-0.00004), '\u22120.004%');
  assert.equal(cardPct(0.000004), '+0.0004%');
  assert.equal(cardPct(-0.0000001), '\u22120.0000%');
  assert.equal(cardPct(0), '0.0%');
  assert.equal(cardPct(0.027), '+2.7%');
  assert.equal(cardPct(-0.001), '\u22120.1%');
  const c = conf({ tier: 'strong', k: 140, spanDays: 800, perTrade: { low: -0.02, mid: -0.01, high: -0.0004 } });
  assert.equal(trustLine(c, 140), 'Based on 140 bets over 2 years. A long record, with consistent losses.');
});

test('U10 and U11: every state carries the disclaimer and a badge; "Verified" only for a connected, verified, non-demo record; empty reads exactly "No closed trades yet"', () => {
  for (const [name, m] of MODELS) {
    assert.equal(m.disclaimer, DISCLAIMER, name);
    assert.ok(m.badge.text.length > 0, name);
    assert.ok(!m.badge.text.includes('\u2713'), name);
    const inp = FIXTURES.find(([n]) => n === name)![1];
    const verified = inp.state === 'connected' && !inp.demo && inp.trades.length > 0 && inp.trades.every((t) => t.verified);
    assert.equal(/Verified/.test(m.badge.text), verified, `${name}: ${m.badge.text}`);
  }
  const by = Object.fromEntries(MODELS);
  assert.deepEqual(by.winning.badge, { text: 'Verified from broker', tone: 'up' });
  assert.deepEqual(by.demo.badge, { text: 'Demo data', tone: 'muted' });
  assert.deepEqual(by['empty, none'].badge, { text: 'No broker connected', tone: 'muted' });
  assert.deepEqual(by.empty.badge, { text: 'Broker connected', tone: 'up' });
  assert.deepEqual(by['unverified closes'].badge, { text: 'Broker connected', tone: 'up' });
  assert.deepEqual(by.importing.badge, { text: 'Importing record', tone: 'muted' });
  assert.deepEqual(by.failed.badge, { text: 'Import did not finish', tone: 'warn' });
  for (const name of ['empty', 'empty, none', 'demo, empty']) {
    const m = by[name];
    assert.equal(m.body, 'empty');
    assert.deepEqual(m.message, { title: 'No closed trades yet', body: 'The record starts with the first closed trade.' });
    for (const k of ['chart', 'count', 'period', 'evidence', 'trust', 'headline', 'range'] as const) assert.equal(m[k], null, `${name} ${k}`);
  }
  // Importing: no stats (TR-3), even with closes.
  const imp = by.importing;
  assert.equal(imp.body, 'importing');
  assert.deepEqual(imp.message, { title: SHARE_CARD.importingBody, body: SHARE_CARD.importingNote });
  for (const k of ['chart', 'count', 'period', 'evidence', 'trust', 'headline', 'range'] as const) assert.equal(imp[k], null, k);
  // Failed: the full layout, the incomplete line in warn in the trust line's row, the pill kept.
  const f = by.failed;
  assert.equal(f.body, 'record');
  assert.deepEqual(f.trust, { text: RECORD_BODY.failed, tone: 'warn' });
  assert.ok(f.evidence && f.chart && f.count);
});

// WCAG relative luminance and contrast, computed from the palette.
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (fg: string, bg: string, alpha: number) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * alpha + parseInt(bg.slice(i, i + 2), 16) * (1 - alpha)).toString(16).padStart(2, '0')).join('');

test('U12 and C6: every palette token ≥ 4.5:1 on the background; up and down within 1.5 of each other; lines and the 0% label ≥ 4.5:1 over their tint', () => {
  for (const k of ['text', 'muted', 'up', 'down', 'warn'] as const) assert.ok(contrast(PALETTE[k], PALETTE.bg) >= 4.5, `${k} ${contrast(PALETTE[k], PALETTE.bg).toFixed(2)}`);
  assert.ok(Math.abs(contrast(PALETTE.up, PALETTE.bg) - contrast(PALETTE.down, PALETTE.bg)) <= 1.5);
  assert.equal(TINT, 0.16);
  for (const tone of ['up', 'down'] as const) {
    const tint = over(PALETTE[tone], PALETTE.bg, TINT);
    assert.ok(contrast(PALETTE[tone], tint) >= 4.5, `${tone} line over its tint ${contrast(PALETTE[tone], tint).toFixed(2)}`);
    assert.ok(contrast(PALETTE.muted, tint) >= 4.5, `0% label over the ${tone} tint ${contrast(PALETTE.muted, tint).toFixed(2)}`);
  }
});

test('U2 (scale half): every type-scale entry, scaled to a 375 px preview, meets its floor', () => {
  for (const layout of ['wide', 'tall'] as const) {
    for (const [role, px] of Object.entries(SCALE[layout])) {
      const floor = FLOORS[role as keyof typeof FLOORS];
      assert.ok(floor, `${role} has a floor`);
      assert.ok(px * (375 / CANVAS_WIDTH[layout]) >= floor, `${layout} ${role}: ${px} → ${(px * 375 / CANVAS_WIDTH[layout]).toFixed(2)} < ${floor}`);
    }
  }
  assert.deepEqual(FORMATS, { story: { width: 1080, height: 1920 }, square: { width: 1080, height: 1080 } });
  assert.equal(parseFormat('story'), 'story');
  assert.equal(parseFormat('x'), 'square');
});

test('U14: the alt text starts with the profile card alt and carries every visible string and the chart sentence', () => {
  for (const [name, m] of MODELS) {
    const inp = FIXTURES.find(([n]) => n === name)![1];
    const label = shareCardText({ state: inp.state, demo: inp.demo, verified: inp.trades.length > 0 && inp.trades.every((t) => t.verified), empty: inp.trades.length === 0 });
    assert.ok(m.alt.startsWith(profileCardAlt(inp.handle, label)), `${name}: ${m.alt}`);
    for (const s of cardStrings(m, 'wide')) assert.ok(m.alt.includes(s.replace(/\.$/, '')), `${name}: alt lacks "${s}"`);
    if (m.chart) assert.ok(m.alt.includes(`Line from 0% to ${cardHeadline(m.chart.end).text} total, lowest ${cardHeadline(m.chart.min).text}`), `${name}: ${m.alt}`);
  }
});

test('D4 and U15: every string the model produces is in the font; a name outside it shows as @handle, never altered; NFC first', () => {
  for (const [name, m] of MODELS) for (const s of allText(m)) assert.ok(covered(s), `${name}: ${JSON.stringify(s)}`);
  for (const bad of ['山田太郎', 'مريم', 'Maya 😀', '\u2713 Maya', 'A\u200dB']) {
    const m = card(WIN, { displayName: bad });
    assert.equal(m.name, '@card_tester', bad);
    assert.equal(m.handle, null, 'the handle row is not repeated');
    assert.ok(!JSON.stringify(m).includes(bad), bad);
  }
  const nfd = card(WIN, { displayName: 'Jose\u0301' });
  assert.equal(nfd.name, 'Jos\u00e9');
  assert.equal(nfd.handle, '@card_tester');
  assert.equal(card(WIN, { host: 'stocksocial.example' }).link, 'stocksocial.example/u/card_tester');
});

test('criterion 10: the period at 0, 1 and many months, a day-of-month boundary, and a frozen record ending at its disconnect', () => {
  const d = (s: string) => new Date(s);
  assert.equal(periodText(d('2026-10-03T10:00:00Z'), d('2026-10-24T12:00:00Z')), 'Record since Oct 2026 · under a month');
  assert.equal(periodText(d('2026-09-10T10:00:00Z'), d('2026-10-24T12:00:00Z')), 'Record since Sep 2026 · 1 month');
  assert.equal(periodText(d('2025-03-10T15:00:00Z'), d('2026-10-24T12:00:00Z')), 'Record since Mar 2025 · 19 months');
  assert.equal(periodText(d('2026-09-24T13:00:00Z'), d('2026-10-24T12:00:00Z')), 'Record since Sep 2026 · under a month');
  assert.equal(periodText(d('2026-09-24T13:00:00Z'), d('2026-10-24T13:00:00Z')), 'Record since Sep 2026 · 1 month');
  assert.equal(periodText(d('2026-01-31T00:00:00Z'), d('2026-02-28T23:59:00Z')), 'Record since Jan 2026 · under a month');
  assert.equal(periodText(d('2025-12-31T23:30:00Z'), d('2026-01-01T00:30:00Z')), 'Record since Dec 2025 · under a month'); // UTC, not local time
  // A frozen record (every consented connection disconnected) ends at the disconnect, not now.
  assert.equal(card(WIN, { frozenEnd: d('2026-01-15T00:00:00Z') }).period, 'Record since Mar 2025 · 10 months');
  // A record that stopped trading a year ago still reads its whole period to now.
  const old = trades(wave(12, 0.02, 0.01), { start: Date.UTC(2024, 0, 5) });
  assert.equal(card(old).period, 'Record since Jan 2024 · 33 months');
});

test('criterion 10: 10,000 closes: at most 400 chart points with the minimum and maximum kept, "10,000 trades", built in under 200 ms', () => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const heavy = Array.from({ length: 10_000 }, (_, i) => {
    const open = T0 + i * 3_600_000;
    return { symbol: `CRD${i % 300}`, openedAt: new Date(open), closedAt: new Date(open + 7_200_000), returnPct: (rnd() - 0.5) * 0.1, holdingDays: 0.08, verified: true };
  });
  recordCard(input(heavy)); // warm
  const t = performance.now();
  const m = recordCard(input(heavy));
  const ms = performance.now() - t;
  assert.ok(ms < 200, `${ms.toFixed(0)} ms`);
  assert.equal(m.count, '10,000 trades');
  assert.ok(m.chart!.points <= CARD_POINTS);
  const curve = equityCurve(heavy).map((p) => p.cumulative);
  const lo = Math.min(0, ...curve), hi = Math.max(0, ...curve);
  assert.equal(m.chart!.min, lo);
  assert.equal(m.chart!.max, hi);
  for (const layout of ['wide', 'tall'] as const) {
    const g = m.chart!.geometry[layout];
    const ys = [...g.line.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((x) => Number(x[2]));
    assert.ok(ys.length <= CARD_POINTS);
    assert.equal(Math.min(...ys), 4, `${layout}: the maximum is drawn at the top of the plot`);
    assert.equal(Math.max(...ys), g.height - 4, `${layout}: the minimum is drawn at the bottom`);
  }
});

test('criterion 10: model snapshots (winning, losing, empty)', (t) => {
  t.assert.snapshot(card(trades(wave(6, 0.02, 0.01))));
  t.assert.snapshot(card(mirror(trades(wave(6, 0.02, 0.01)))));
  t.assert.snapshot(card([], { state: 'none' }));
});

test('tester fixtures: a 40-character name, a five-digit count with the longest cell, a failed import, an average outside its own range (O2), a record that stopped a year ago', () => {
  const name = 'A'.repeat(19) + ' ' + 'B'.repeat(20);
  assert.equal(card(WIN, { displayName: name }).name, name); // truncation is the renderer's
  const big = trades(wave(12345, 0, 0.05), { step: 0.1, hold: 0.05 });
  const m = card(big);
  assert.equal(m.count, '12,345 trades');
  assert.ok(m.trust!.text.length > 0);
  const f = card(WIN, { state: 'failed' });
  assert.equal(f.trust!.tone, 'warn');
  // O2 (logged, owner question): the arithmetic headline can sit outside the range centred on the geometric mean.
  const vol = card(trades(Array.from({ length: 30 }, (_, i) => (i % 3 ? -0.3 : 0.9))));
  const c = confidence(trades(Array.from({ length: 30 }, (_, i) => (i % 3 ? -0.3 : 0.9))), NOW);
  assert.ok(vol.headline && vol.range && c.perTrade);
  const year = card(trades(wave(12, 0.02, 0.01), { start: Date.UTC(2025, 6, 1) }));
  assert.match(year.period!, /^Record since Jul 2025 · 15 months$/);
  assert.match(year.trust!.text, /over \d+ days/);
});
