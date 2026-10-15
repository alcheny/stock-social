import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeModel, renderBadgeSvg, formatAsOf, VALID_HANDLE } from './badge.ts';
import { confidence, isNewRecord, rangeText, type ConfidenceInput } from './trades.ts';

const today = new Date('2026-10-15T12:00:00Z');
const DAY = 86400000;
// n trades, the oldest opened `ageDays` ago, one closed per day ending 14 Oct; returns alternate around `base`.
function fixture(n: number, ageDays: number, base = 0.04): ConfidenceInput[] {
  return Array.from({ length: n }, (_, i) => {
    const closedAt = new Date(Date.UTC(2026, 9, 14) - (n - 1 - i) * DAY);
    const openedAt = new Date(i === 0 ? today.getTime() - ageDays * DAY : closedAt.getTime() - 2 * DAY);
    return { symbol: `S${i % 12}`, openedAt, closedAt, returnPct: base + (i % 2 ? 0.03 : -0.02), holdingDays: 2 };
  });
}
const user = { handle: 'alice', demo: false };
const texts = (svg: string) => (svg.match(/<text/g) ?? []).length;

test('positive record shows sign, green, range and as-of', () => {
  const m = badgeModel(user, fixture(40, 90), today);
  assert.equal(m.state, 'record');
  const svg = renderBadgeSvg(m);
  assert.match(svg, /\+\d/);
  assert.match(svg, /#22c55e/i);
  assert.match(svg, /95% range/);
  assert.match(svg, /as of 14 Oct 2026/);
  assert.match(svg, /Stock Social · broker data/);
  assert.match(svg, /width="240" height="56"/);
});

test('negative record uses U+2212, red, same structure', () => {
  const pos = renderBadgeSvg(badgeModel(user, fixture(40, 90), today));
  const neg = renderBadgeSvg(badgeModel(user, fixture(40, 90, -0.08), today));
  assert.match(neg, /−/);
  assert.match(neg, /#f43f5e/i);
  assert.equal(texts(neg), texts(pos));
});

test('new record: fewer than 10 trades, old', () => {
  const m = badgeModel(user, fixture(6, 90), today);
  assert.equal(m.state, 'new');
  const svg = renderBadgeSvg(m);
  assert.match(svg, /New record, 6 trades/);
  assert.doesNotMatch(svg, /\d%/);
  assert.doesNotMatch(svg, /95% range/);
  assert.match(svg, /Short record/);
  assert.ok([...svg.matchAll(/data-line="3">([^<]*)</g)][0][1].length <= 44);
});

test('new record: 10+ trades but young', () => {
  assert.equal(badgeModel(user, fixture(12, 10), today).state, 'new');
});

test('tooEarly render path: no return shown', () => {
  const svg = renderBadgeSvg({ state: 'record', handle: 'alice', demo: false, trades: 12, avgReturn: 0.05, winRate: 0.62, range: null, tooEarly: true, asOf: '2026-10-14' });
  assert.match(svg, /Too early to tell/);
  assert.doesNotMatch(svg, /avg/);
  assert.doesNotMatch(svg, /\+5/);
  assert.match(svg, /win 62%</);
  assert.match(svg, /12 trades/);
});

test('tooEarly flag follows a null range from the model', () => {
  const t = fixture(12, 90).map((x) => ({ ...x, symbol: 'AAA' }));
  const m = badgeModel(user, t, today);
  assert.equal(m.state, 'record');
  if (m.state === 'record') assert.equal(m.tooEarly, rangeText(confidence(t, today)) === null);
});

test('range parity with the profile', () => {
  const t = fixture(40, 90);
  const expected = rangeText(confidence(t, today));
  assert.ok(expected);
  const m = badgeModel(user, t, today);
  assert.ok(m.state === 'record');
  assert.equal(m.range, expected.replace(/^\(|\)$/g, ''));
  assert.equal(m.tooEarly, false);
});

test('state parity with profile classification', () => {
  for (const [n, age] of [[0, 0], [5, 10], [12, 10], [12, 90], [5, 90]] as const) {
    const t = fixture(n, age);
    const isNew = isNewRecord(t.map((x) => ({ openedAt: x.openedAt })), t.length, today);
    const profile = t.length === 0 ? 'empty' : isNew ? 'new' : 'record';
    assert.equal(badgeModel(user, t, today).state, profile, `n=${n} age=${age}`);
  }
});

test('demo says Demo and never Verified', () => {
  for (const [n, age] of [[40, 90], [6, 90], [0, 0]] as const) {
    const svg = renderBadgeSvg(badgeModel({ handle: 'maya', demo: true }, fixture(n, age), today));
    assert.match(svg, /Demo/);
    assert.doesNotMatch(svg, /verified/i);
  }
});

test('empty shows No record yet and no "verified" anywhere', () => {
  const svg = renderBadgeSvg(badgeModel(user, [], today));
  assert.match(svg, /No record yet/);
  assert.match(svg, /Percentages only/);
  assert.doesNotMatch(svg, /verified/i);
  assert.doesNotMatch(svg, /as of/);
});

test('escaping and handle truncation', () => {
  const svg = renderBadgeSvg({ state: 'empty', handle: `<script>&"'`, demo: false });
  assert.doesNotMatch(svg, /<script/);
  assert.match(svg, /&lt;script&gt;&amp;&quot;&#39;/);
  const long = renderBadgeSvg({ state: 'empty', handle: 'a'.repeat(40), demo: false });
  const visible = [...long.matchAll(/<text[^>]*>([^<]*)</g)].map((x) => x[1]).join(' ');
  assert.doesNotMatch(visible, /a{25}/);
  assert.match(long, /…/);
});

test('longest line 3 stays within budget', () => {
  const svg = renderBadgeSvg({ state: 'record', handle: 'alice', demo: false, trades: 99, avgReturn: -0.123, winRate: 0.5, range: '-10.0% to -12.1%', tooEarly: false, asOf: '2026-09-30' });
  const line3 = [...svg.matchAll(/data-line="3">([^<]*)</g)][0][1];
  assert.ok(line3.length <= 44, line3);
});

test('line 1 stays within its width budget, with and without the DEMO pill', () => {
  for (const demo of [false, true]) {
    const svg = renderBadgeSvg({ state: 'new', handle: 'a'.repeat(30), demo, trades: 3, asOf: '2026-09-30' });
    const line1 = [...svg.matchAll(/<text x="10" y="16"[^>]*>([^<]*)</g)][0][1];
    assert.ok(line1.length <= (demo ? 32 : 38), line1);
  }
});

test('zero average return is neutral, not red or green', () => {
  const svg = renderBadgeSvg({ state: 'record', handle: 'alice', demo: false, trades: 30, avgReturn: 0, winRate: 0.5, range: '-1.0% to 1.0%', tooEarly: false, asOf: '2026-09-30' });
  assert.doesNotMatch(svg, /#f43f5e|#22c55e/);
});

test('too-early line 2 stays short and trade count moves to line 3', () => {
  const svg = renderBadgeSvg({ state: 'record', handle: 'alice', demo: false, trades: 24, avgReturn: 0.02, winRate: 0.62, range: null, tooEarly: true, asOf: '2026-09-30' });
  assert.match(svg, /win 62%</);
  assert.match(svg, /data-line="3">24 trades · as of/);
});

test('date formatting is deterministic', () => {
  assert.equal(formatAsOf('2026-10-14'), '14 Oct 2026');
  assert.equal(formatAsOf('2026-01-02'), '2 Jan 2026');
});

test('handle validation', () => {
  assert.ok(VALID_HANDLE.test('momentum_maya'));
  assert.ok(!VALID_HANDLE.test('Bad Handle'));
  assert.ok(!VALID_HANDLE.test(''));
});
