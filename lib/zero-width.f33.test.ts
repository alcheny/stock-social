// F-33 AC2 (OD 2.32): no printed range has zero width. A range whose one-decimal printed low and high are equal prints
// "Too early to tell" from the one constant (lib/copy.ts#RECORD_STRIP.early), visible and accessible text alike, and no
// "Past results" verdict goes with it. Every record here is fictional.
//
// Zero-width fixtures (engineer demand 5, listed before coding; each retarget is in docs/features/logs/F-33/build.md):
//   EXACT10  ten closes of exactly +1% (the cycle-5 probe)
//   EXACT40  forty closes of exactly +1%, 1-day holds over 120 days (at the ranking tier: R2)
//   JITTER   ten closes of +1% ± 0.01 point (the red team's probe: not zero unrounded, zero as printed)
//   LOSS10   ten closes of exactly −1% (the mirror)
//   WIDE     the control: a range that prints with width
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { RECORD_STRIP, SHARE_CARD } from './copy.ts';
import { cardAlt, cardDescription, cardEvidence, evidenceRangeText, recordCard, type CardKind } from './record-card.ts';
import { recordStrip, stripFigures } from './record-strip.ts';
import { paneEvidence } from './pane-evidence.ts';
import { confidence, evidenceLine, rangeText, type ConfidenceInput } from './trades.ts';
import { MIN_BETS, trustLine, zeroWidth } from './confidence.ts';
import { optionRangeText, optionsLineText } from './options-view.ts';
import { optionSummary } from './options.ts';
import { rankWeight } from './rank-weight.ts';
import { pct } from './format.ts';
import { baselineLines } from './ticker.ts';

const DAY = 86_400_000;
const now = new Date(Date.UTC(2026, 10, 1, 12));
const record = (rs: readonly number[], spanDays: number): ConfidenceInput[] => {
  const k = rs.length, step = (spanDays - 1) * DAY / Math.max(k - 1, 1), t0 = now.getTime() - (spanDays + 1) * DAY;
  return rs.map((r, i) => ({ symbol: `Z${i}`, openedAt: new Date(t0 + i * step), closedAt: new Date(t0 + i * step + DAY), returnPct: r, holdingDays: 1 }));
};
const EXACT10 = record(Array(10).fill(0.01), 10);
const EXACT40 = record(Array(40).fill(0.01), 120);
const JITTER = record(Array.from({ length: 10 }, (_, i) => 0.01 + (i % 2 ? 1e-4 : -1e-4)), 10);
const LOSS10 = record(Array(10).fill(-0.01), 10);
const WIDE = record(Array.from({ length: 10 }, (_, i) => 0.01 + (i % 2 ? 0.02 : -0.02)), 60);
const ZERO: [string, ConfidenceInput[]][] = [['EXACT10', EXACT10], ['EXACT40', EXACT40], ['JITTER', JITTER], ['LOSS10', LOSS10]];
const early = RECORD_STRIP.early;

test('F-33 AC2: zeroWidth reads the printed one-decimal ends', () => {
  assert.equal(zeroWidth({ low: 0.01, high: 0.01 }), true);
  assert.equal(zeroWidth({ low: 0.00996, high: 0.01004 }), true); // "+1.0% to +1.0%"
  assert.equal(zeroWidth({ low: 0.0094, high: 0.0106 }), false); // "+0.9% to +1.1%"
  assert.equal(zeroWidth({ low: -0.0004, high: 0.0004 }), true); // "0.0% to 0.0%"
  for (const [name, r] of ZERO) assert.ok(zeroWidth(cardEvidence(r, now).perTrade!), name);
  assert.ok(!zeroWidth(cardEvidence(WIDE, now).perTrade!));
});

test('F-33 AC2: a zero-width range prints Too early to tell on every printer (visible = accessible); no verdict', () => {
  for (const [name, r] of ZERO) {
    // Share card, every size: the range slot, the alt text and the link-preview description carry the same words.
    for (const kind of ['unfurl', 'square', 'story'] as CardKind[]) {
      const m = recordCard({ kind, handle: 'zw_test', name: 'ZW', state: 'connected', demo: false, verified: true, now, link: null, trades: r });
      assert.equal(m.range, early, `${name} ${kind}: range slot`);
      assert.ok(cardAlt(m).includes(early), `${name} ${kind}: alt`);
      assert.ok(cardDescription(m)!.includes(early), `${name} ${kind}: description`);
      assert.doesNotMatch(`${m.range} ${cardAlt(m)} ${cardDescription(m)}`, /likely between|Past results|clear pattern|consistent/, `${name} ${kind}`);
      assert.equal(m.evidence, 'Evidence: too early');
      assert.equal(m.trust, `Based on ${r.length} trades. ${early}: ${RECORD_STRIP.alike}.`);
    }
    // The record strip: feed card, pages and images; the alt says the same.
    for (const surface of ['feed', 'page', 'image', 'figures'] as const) {
      const s = recordStrip({ ...stripFigures(r, now), state: 'connected', demo: false, verified: true, handle: 'zw_test' }, surface);
      assert.ok(s.tooEarly, `${name} ${surface}`);
      assert.ok(s.figures.some((p) => p.role === 'early' && p.text === early));
      assert.ok(!s.figures.some((p) => p.role === 'range'));
      assert.ok(s.alt.toLowerCase().includes(early.toLowerCase()), `${name} ${surface}: alt`);
    }
    // Profile (evidenceRangeText → no range in the stat block; the evidence line says it), pane, display log.
    const e = cardEvidence(r, now);
    assert.equal(evidenceRangeText(e), null);
    assert.equal(e.edge, null);
    assert.equal(evidenceLine(e), `${early}: ${RECORD_STRIP.alike} (${r.length} bets)`);
    const p = paneEvidence(r.map((t) => ({ ...t })), now);
    assert.equal(p.range, null);
    assert.equal(p.rangeLine, early);
    // The log-range path (stock pages, tools card, recap): no range text, no verdict, the same evidence line.
    const c = confidence(r, now);
    assert.equal(rangeText(c), null, `${name}: rangeText`);
    assert.equal(c.edge, null);
    assert.doesNotMatch(evidenceLine(c), /Past results/);
    assert.ok(evidenceLine(c).startsWith(early));
    assert.equal(trustLine(c), `Based on ${r.length} trades. ${early}: ${RECORD_STRIP.alike}.`);
    // The stock pages' fallback for a missing range.
    assert.equal(RECORD_STRIP.earlyOf(c.k, MIN_BETS), early);
  }
  // Under 5 bets the count is said, as before.
  assert.equal(RECORD_STRIP.earlyOf(3, MIN_BETS), `${early} (3 of 5 bets)`);
});

test('F-33 AC2: the options range prints Too early to tell when it has no width', () => {
  const opt = (rs: number[]) => optionSummary(rs.map((r, i) => ({ underlying: `O${i}`, openedAt: new Date(i * 3 * DAY), closedAt: new Date((i * 3 + 1) * DAY), returnPct: r })))!;
  const flat = opt(Array(8).fill(0.2));
  assert.ok(flat.range && zeroWidth(flat.range));
  assert.equal(optionRangeText(flat.range), early);
  assert.ok(optionsLineText(flat).endsWith(` avg · ${early}`), 'review R6: a separator before the words');
  assert.doesNotMatch(optionsLineText(flat), /avg Too early/);
  const wide = opt([0.2, -0.3, 0.5, 0.1, -0.2, 0.4, 0, 0.3]);
  assert.equal(optionRangeText(wide.range), `(${pct(wide.range!.low)} to ${pct(wide.range!.high)})`);
  const block = readFileSync(new URL('../app/u/[handle]/options-block.tsx', import.meta.url), 'utf8');
  assert.match(block, /optionRangeText\(s\.range\)/);
});

test('F-33 AC2: a range that prints with width is unchanged (control)', () => {
  const e = cardEvidence(WIDE, now);
  assert.ok(evidenceRangeText(e)!.startsWith('('));
  const m = recordCard({ kind: 'unfurl', handle: 'zw_test', name: 'ZW', state: 'connected', demo: false, verified: true, now, link: null, trades: WIDE });
  assert.equal(m.range, SHARE_CARD.likely(pct(e.perTrade!.low), pct(e.perTrade!.high)));
  assert.notEqual(paneEvidence(WIDE, now).rangeLine, early);
});

// Review R5: the stock page's baseline and the tools card's range row say "Too early to tell", never a silent blank.
test('F-33 review R5: a zero-width side of the stock baseline, and the tools range row, print Too early to tell', () => {
  const zero = confidence(EXACT10, now), wide = confidence(WIDE, now);
  const l = baselineLines('ZWT', { n: 10, traders: 1, conf: zero }, { n: 10, conf: wide });
  assert.equal(l.this, `10 closed trades in ZWT by 1 trader: ${early}.`);
  assert.match(l.others, /^10 closed trades in other stocks recorded here: 95% range of the average per trade \(.+ to .+\)\.$/);
  assert.equal(l.ranged, true);
  const both = baselineLines('ZWT', { n: 10, traders: 1, conf: zero }, { n: 10, conf: zero });
  assert.ok(both.this.endsWith(`: ${early}.`) && both.others.endsWith(`: ${early}.`));
  // Under 5 bets on one side: counts only on both, unchanged.
  assert.equal(baselineLines('ZWT', { n: 3, traders: 1, conf: confidence(EXACT10.slice(0, 3), now) }, { n: 10, conf: wide }).this, '3 closed trades in ZWT by 1 trader.');
  const tools = readFileSync(new URL('./record-tools.ts', import.meta.url), 'utf8');
  assert.match(tools, /range: rangeText\(c\) \?\? \(c\.perTrade \? RECORD_STRIP\.early : null\)/);
  const page = readFileSync(new URL('../app/tools/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /\{c\.figures\.range && <div><dt>\{R\.range\}<\/dt><dd>\{c\.figures\.range\}\{c\.figures\.low && /);
});

// R2 (orchestrator ruling 2): zero width is a printing rule; the weight comes from the floored error term.
test('F-33 R2: 40 closes of exactly +1% over 120 days print Too early to tell and still carry ranking weight', () => {
  const m = recordCard({ kind: 'unfurl', handle: 'zw_test', name: 'ZW', state: 'connected', demo: false, verified: true, now, link: null, trades: EXACT40 });
  assert.equal(m.range, early);
  assert.ok(rankWeight(EXACT40) > 0);
});

// Engineer demand 5 / plan §5: one producer. No .ts/.tsx source in lib/ or app/ (tests excluded, comments stripped)
// writes the words except lib/copy.ts, and copy.ts writes them once.
test('F-33 AC2: only lib/copy.ts holds the literal "Too early to tell", once', () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(new URL(dir, import.meta.url))) {
      const rel = `${dir}${f}`;
      if (statSync(new URL(rel, import.meta.url)).isDirectory()) { if (f !== 'node_modules') walk(`${rel}/`); continue; }
      if (!/\.tsx?$/.test(f) || /\.test\.ts$/.test(f)) continue;
      const code = readFileSync(new URL(rel, import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
      const n = code.match(/Too early to tell/g)?.length ?? 0;
      for (let i = 0; i < n; i++) hits.push(rel);
    }
  };
  walk('./'); walk('../app/');
  assert.deepEqual(hits, ['./copy.ts']);
  // The tools card prints neither the range nor its low end alone for a zero-width record.
  assert.match(readFileSync(new URL('./record-tools.ts', import.meta.url), 'utf8'), /low: c\.perTrade && rangeText\(c\) \?/);
});
