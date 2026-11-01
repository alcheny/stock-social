// Fixes-labels plan (docs/features/logs/fixes-labels/plan.md) AC1, AC2, AC6, AC12: Demo is never "verified" (D-03), the
// baseline states facts with one measure on both sides (D-07), and every new string passes the claims lists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKS, PROMO } from '../scripts/compliance.ts';
import { FIXES_LABELS as FL } from './copy.ts';
import { baselineLines, compareDescription, compareKind, compareOverlapText, compareTickers, tickerDescription, tickerSummary, trustKind, type TickerRow } from './ticker.ts';
import { MIN_BETS } from './confidence.ts';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 5);
// k separate bets (no overlap), one trader each, `verified` flag per row.
const rows = (k: number, verified: boolean | ((i: number) => boolean), r = (i: number) => (i % 3 === 0 ? -0.04 : 0.03)): TickerRow[] =>
  Array.from({ length: k }, (_, i) => ({
    userId: i + 1, returnPct: r(i), holdingDays: 2, openedAt: new Date(T0 + i * 5 * DAY), closedAt: new Date(T0 + i * 5 * DAY + 2 * DAY),
    verified: typeof verified === 'function' ? verified(i) : verified,
  }));
const today = new Date(Date.UTC(2026, 10, 1));
const VERIFIED = /verified/i;

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') {
    // Every builder with representative arguments: zero, one and many.
    for (const args of [['NVDA', 'AMD', 'x'], [0, 'NVDA', 'AMD'], [1, 'NVDA', 'AMD'], [3, 'NVDA', 'AMD'], ['1', '5'], ['7', '5', '2 traders', '(-1.0% to +2.0%)']]) {
      const r = (v as (...a: unknown[]) => unknown)(...args);
      if (typeof r === 'string') out.push(r);
    }
  } else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

test('trustKind: demo-only rows are Demo, some demo rows are mixed, the rest verified', () => {
  assert.equal(trustKind(tickerSummary(rows(6, false), today)), 'demo');
  assert.equal(trustKind(tickerSummary(rows(6, (i) => i > 0), today)), 'mixed');
  assert.equal(trustKind(tickerSummary(rows(6, true), today)), 'verified');
});

test('AC1: the Demo and mixed stock-page strings (title, description, explainer, notes, image subtitle and corner, alt) never say verified; verified keeps "verified trades"', () => {
  for (const kind of ['demo', 'mixed'] as const) {
    const s = tickerSummary(rows(6, kind === 'demo' ? false : (i) => i > 0), today);
    const texts = [FL.tickerTitle[kind]('NVDA'), tickerDescription('NVDA', s), FL.tickerExplainer[kind], FL.demoNote, FL.mixedNote, FL.demoPage, FL.indexTitle, FL.indexDescription, FL.indexIntro, FL.indexAria];
    for (const t of texts) assert.doesNotMatch(t, VERIFIED, t);
    assert.match(FL.tickerTitle[kind]('NVDA'), /Demo/);
    assert.match(tickerDescription('NVDA', s), /Demo/);
    assert.doesNotMatch(tickerDescription('NVDA', s), /Sample data/);
  }
  assert.match(FL.tickerTitle.verified('NVDA'), /verified trades/);
  assert.match(tickerDescription('NVDA', tickerSummary(rows(6, true), today)), /^6 verified closed trades in NVDA · \d+% win rate · [+-−]?\d/);
});

test('AC2: compare with a Demo side: title, description, explainer and overlap never say verified; the all-Demo description has no "sample data" (DS-20)', () => {
  const demoA = rows(6, false), demoB = rows(4, false), real = rows(6, true);
  const both = compareTickers(demoA, demoB, today);
  assert.equal(compareKind(both), 'demo');
  const one = compareTickers(demoA, real, today);
  assert.equal(compareKind(one), 'mixed');
  assert.equal(compareKind(compareTickers(real, real, today)), 'verified');
  for (const c of [both]) {
    const k = compareKind(c);
    for (const t of [FL.compareTitle[k]('NVDA', 'AVGO'), compareDescription('NVDA', 'AVGO', c), FL.compareExplainer[k], compareOverlapText(k, 0, 'NVDA', 'AVGO'), compareOverlapText(k, 2, 'NVDA', 'AVGO')]) {
      assert.doesNotMatch(t, VERIFIED, t);
    }
    assert.doesNotMatch(compareDescription('NVDA', 'AVGO', c), /sample data/i);
    assert.match(compareDescription('NVDA', 'AVGO', c), /Demo/);
  }
  // Mixed: the title, explainer and description name Demo and never say verified; the overlap counts verified rows
  // only (compareTickers), so it keeps saying so.
  for (const t of [FL.compareTitle.mixed('NVDA', 'AMD'), FL.compareExplainer.mixed, compareDescription('NVDA', 'AMD', one)]) assert.doesNotMatch(t, VERIFIED, t);
  assert.match(compareDescription('NVDA', 'AMD', one), /Includes Demo trades\. Sample data/);
  assert.equal(compareOverlapText('verified', 1, 'A', 'B'), '1 trader closed verified trades in both A and B.');
  // QA round 1 (finding 2): a mixed pair counts verified traders and says the Demo trades are left out of the count.
  assert.equal(compareOverlapText(compareKind(one), 0, 'NVDA', 'AMD'), 'No trader has closed verified trades in both NVDA and AMD yet. Demo trades are not counted here.');
  assert.equal(compareOverlapText('mixed', 2, 'NVDA', 'AMD'), '2 traders closed verified trades in both NVDA and AMD. Demo trades are not counted here.');
  assert.equal(compareOverlapText('verified', 0, 'A', 'B'), 'No trader has closed verified trades in both yet.');
  assert.equal(FL.compareExplainer.verified, 'Verified closed trades in each stock, side by side. Percentages only. Few trades means a wide range, and that is expected.');
});

test('AC6: baseline lines state counts and one measure on both sides, never a verdict; a range on both lines or on neither', () => {
  const banned = /\b(above|below|difference|sits|geometric|all)\b/i;
  const many = tickerSummary(rows(8, true), today);
  const few = tickerSummary(rows(MIN_BETS - 1, true), today);
  const othersMany = { n: 40, conf: tickerSummary(rows(12, true), today).conf! };
  const othersFew = { n: 3, conf: tickerSummary(rows(3, true), today).conf! };
  const cases = [[many, othersMany], [many, othersFew], [few, othersMany], [few, othersFew]] as const;
  for (const [s, o] of cases) {
    const l = baselineLines('NVDA', s, o);
    for (const t of [l.this, l.others, l.note, FL.baselineHeading, FL.baselineThisTile, FL.baselineOthersTile]) assert.doesNotMatch(t, banned, t);
    const ranges = [l.this, l.others].filter((t) => /average per trade, 95% range/.test(t)).length;
    assert.ok(ranges === 0 || ranges === 2, `${l.this} | ${l.others}`);
    assert.equal(l.ranged, ranges === 2);
  }
  const l = baselineLines('NVDA', many, othersMany);
  assert.ok(l.ranged);
  assert.match(l.this, /^8 closed trades in NVDA by 8 traders: average per trade, 95% range \(.+ to .+\)\.$/);
  assert.match(l.others, /^40 closed trades in other stocks recorded here: average per trade, 95% range \(.+ to .+\)\.$/);
  // Either side under MIN_BETS bets: both lines print the count only.
  assert.equal(baselineLines('NVDA', many, othersFew).others, '3 closed trades in other stocks recorded here.');
  assert.equal(baselineLines('NVDA', few, othersMany).this, `${MIN_BETS - 1} closed trades in NVDA by ${MIN_BETS - 1} traders.`);
  assert.equal(baselineLines('NVDA', tickerSummary(rows(1, true), today), othersFew).this, '1 closed trade in NVDA by 1 trader.');
  assert.equal(l.note, 'Side by side for context only. Different traders, sizes and timing. Not a rating of any stock.');
});

test('AC12 + D-24: every FIXES_LABELS string passes PROMO, the banned claims and the marks list, and never claims completeness', () => {
  const MARK_RE = new RegExp(`\\b(${MARKS.map((m) => m.replace(/ /g, '[\\s-]?')).join('|')})\\b`, 'i');
  const BANNED = [/\bendorse[sd]?\b/i, /\brecommend(ed|s|ation)?\b/i, /\bguarantee[sd]?\b/i, /\bsecure\b/i, /\bsafe\b/i];
  const all = strings(FL);
  assert.ok(all.length > 40, String(all.length));
  for (const s of all) {
    for (const re of [...PROMO, ...BANNED]) assert.doesNotMatch(s, re, s);
    assert.doesNotMatch(s, MARK_RE, s);
    assert.doesNotMatch(s, /\b(every|complete|whole record|full record)\b/i, s);
    assert.doesNotMatch(s, /\ball (trades|stocks|others)\b/i, s);
    assert.doesNotMatch(s, /\b(signal|edge|skill|beat|outperform|winner)\b/i, s);
  }
  assert.equal(FL.monthOf('1'), 'The only month on record');
  assert.equal(FL.monthOf('14'), 'One of 14 months on record');
  assert.equal(FL.monthOf('2'), 'One of 2 months on record');
  assert.equal(FL.monthOf('1,204'), 'One of 1,204 months on record');
});
