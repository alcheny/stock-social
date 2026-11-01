// FIXES-LABELS QA round 1 (docs/features/logs/fixes-labels/qa-round-1.md): the pure parts of findings 1, 7, 8, 12, 13.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toneView } from './tone-view.ts';
import { pct } from './format.ts';
import { compareEvidenceText, compareTickers, type TickerRow } from './ticker.ts';
import { FIXES_LABELS as FL } from './copy.ts';
import { evidenceLine, type Confidence } from './trades.ts';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('finding 8: the tone and the screen-reader word come from the printed value; a printed 0.0% is Flat, uncoloured', () => {
  const cases: [number, string, '' | 'up' | 'down', string][] = [
    [0, '0.0%', '', 'Flat'], [0.0004, '0.0%', '', 'Flat'], [-0.0004, '0.0%', '', 'Flat'], [0.0005, '+0.1%', 'up', 'Gain'],
    [-0.0005, '-0.1%', 'down', 'Loss'], [0.21, '+21.0%', 'up', 'Gain'], [-0.18, '-18.0%', 'down', 'Loss'],
  ];
  for (const [x, shown, cls, word] of cases) {
    assert.equal(pct(x), shown, String(x));
    assert.equal(toneView(x).cls, cls, String(x));
    assert.equal(toneView(x).word, word, String(x));
  }
  // The pages named in the finding decide tone through it (no inline `> 0 ? 'up' : 'down'` or "Gain " for >= 0 left).
  for (const f of ['app/u/[handle]/trade/[sellId]/page.tsx', 'app/u/[handle]/month/[ym]/page.tsx', 'app/pane.tsx', 'app/ui.tsx', 'app/u/[handle]/page.tsx']) {
    const s = src(f);
    assert.doesNotMatch(s, /(returnPct|return_pct|avgReturn) > 0 \? 'up' : 'down'/, f);
    assert.doesNotMatch(s, /'Loss ' : 'Gain '/, f);
  }
});

test('finding 7: a failed import is a warning (icon and words), not a loss colour; the record-failed hook stays', () => {
  for (const f of ['app/ui.tsx', 'app/pane.tsx', 'app/u/[handle]/page.tsx', 'app/record-strip.tsx']) {
    const s = src(f);
    assert.match(s, /className="warn record-failed"/, f);
    assert.doesNotMatch(s, /"down record-failed"/, f);
  }
  const css = src('app/globals.css');
  assert.match(css, /:root \{ --warn: #fbbf24; \}/);
  assert.match(css, /prefers-color-scheme: light\) \{ :root \{ --warn: #92400e; \} \}/);
  assert.match(css, /\.record-failed::before \{ content: "\\26A0\\FE0E  "; content: "\\26A0\\FE0E  " \/ ""; \}/);
});

test('finding 1: the root description names no trust state; finding 12: Demo footers say Demo, never connected accounts', () => {
  const layout = src('app/layout.tsx');
  const d = layout.match(/description: '([^']+)'/)?.[1] ?? '';
  assert.doesNotMatch(d, /verified/i);
  assert.match(d, /Demo/);
  for (const k of ['paneFoot', 'monthFoot'] as const) {
    assert.doesNotMatch(FL[k].demo, /connected accounts|verified/i);
    assert.match(FL[k].demo, /Demo/);
    assert.match(FL[k].real, /connected accounts/);
  }
  assert.equal(FL.paneFoot.real, "Closed trades from connected accounts are published, losses included. Options and positions with no recorded entry aren't shown.");
});

test('finding 13: /t/compare prints the evidence tier and bets, never "Past results: above zero / below zero / unclear"', () => {
  const DAY = 86_400_000, T0 = Date.UTC(2025, 0, 1);
  const rows = (n: number, r: (i: number) => number): TickerRow[] => Array.from({ length: n }, (_, i) => ({ userId: i % 12, returnPct: r(i), holdingDays: 2, openedAt: new Date(T0 + i * 6 * DAY), closedAt: new Date(T0 + (i * 6 + 2) * DAY), verified: true }));
  const today = new Date(T0 + 700 * DAY);
  const c = compareTickers(rows(120, (i) => 0.03 + (i % 5) / 1000), rows(120, (i) => ((i % 7) - 3) / 100), today);
  let verdicts = 0;
  for (const side of [c.a, c.b]) {
    const conf = side.summary.conf as Confidence;
    if (/^Past results: /.test(evidenceLine(conf))) verdicts++;
    const t = compareEvidenceText(conf);
    assert.doesNotMatch(t, /Past results|above zero|below zero|unclear/, t);
    if (conf.tier !== 'too-early') assert.match(t, /^Evidence: \w+ \(/, t);
  }
  assert.ok(verdicts > 0, 'the fixture reaches the verdict branch');
  assert.match(src('app/t/compare/page.tsx'), /compareEvidenceText\(c\)/);
  assert.doesNotMatch(src('app/t/compare/page.tsx'), /evidenceLine\(/);
});
