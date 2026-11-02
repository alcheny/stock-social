// FIXES-LABELS (code review, C3-4 / F3-2; DESIGN TR-7, TR-9): the swipe pane prints the profile's 95% range and "New
// record" from the same path, so pane and profile say the same thing for the same record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paneEvidence } from './pane-evidence.ts';
import { cardEvidence, evidenceRangeText } from './record-card.ts';
import { isNewRecord } from './trades.ts';
import { recordStrip, stripFigures } from './record-strip.ts';

const DAY = 86_400_000;
const NOW = new Date('2026-11-01T12:00:00Z');
const rec = (n: number, startDaysAgo: number) => Array.from({ length: n }, (_, i) => {
  const closedAt = new Date(NOW.getTime() - (startDaysAgo - i * 7) * DAY);
  return { symbol: `S${i % 5}`, returnPct: ((i * 13) % 17 - 6) / 100, holdingDays: 3, closedAt, openedAt: new Date(closedAt.getTime() - 3 * DAY) };
});

// The profile's own calls (app/u/[handle]/page.tsx), as the reference.
const profile = (ts: ReturnType<typeof rec>) => {
  const range = evidenceRangeText(cardEvidence(ts, NOW));
  return { rangeLine: range ? `${range} · 95% range` : null, newRecord: isNewRecord(ts.map((t) => ({ openedAt: t.openedAt })), ts.length, NOW) };
};

test('pane evidence equals the profile\'s: range line and New record, short and long records', () => {
  for (const [n, ago] of [[3, 20], [12, 100], [40, 400], [9, 300], [15, 20]] as const) {
    const ts = rec(n, ago);
    const p = paneEvidence(ts, NOW);
    assert.deepEqual({ rangeLine: p.rangeLine, newRecord: p.newRecord }, profile(ts), `${n} trades, ${ago} days`);
  }
  const long = paneEvidence(rec(40, 400), NOW);
  assert.match(long.rangeLine!, /^\([+−-]?\d+\.\d% to [+−-]?\d+\.\d%\) · 95% range$/);
  assert.equal(long.newRecord, false);
  assert.equal(paneEvidence(rec(3, 20), NOW).newRecord, true);
  assert.equal(paneEvidence(rec(3, 20), NOW).rangeLine, null, 'under the minimum bets: no range (Too early is said elsewhere)');
  // The record strip quotes the same range for the same record (one evidence path).
  const strip = recordStrip({ ...stripFigures(rec(40, 400), NOW), state: 'connected', demo: false, verified: true, handle: 'x' }, 'page').text;
  assert.ok(strip.includes(long.range!), `${strip} has ${long.range}`);
});

test('a row without its entry time falls back to close minus holding days; an empty record has no range', () => {
  const ts = rec(40, 400);
  const bare = ts.map(({ openedAt: _o, ...t }) => t);
  assert.deepEqual(paneEvidence(bare, NOW), paneEvidence(ts, NOW));
  assert.deepEqual(paneEvidence([], NOW), { range: null, rangeLine: null, newRecord: true });
});

test('the pane renders the range under its average and New record in its header, the pane JSON ships the entry time', () => {
  // F-23: the evidence is computed in the pane model (lib/pane-model.ts) from the stored closes, entry times included,
  // for the feed and the /pane route alike; the pane renders the model and recomputes nothing.
  const src = readFileSync(new URL('../app/pane.tsx', import.meta.url), 'utf8');
  assert.match(readFileSync(new URL('../lib/pane-model.ts', import.meta.url), 'utf8'), /paneEvidence\(trades, now\)/);
  assert.doesNotMatch(src, /paneEvidence\(|paneSummary\(/);
  assert.match(src, /ev\.rangeLine && <small className="range">\{ev\.rangeLine\}<\/small>/);
  assert.match(src, /ev\.newRecord && <span className="badge new">New record<\/span>/);
  const route = readFileSync(new URL('../app/u/[handle]/pane/route.ts', import.meta.url), 'utf8');
  // F-21: the exclusion sum is the call's sixth argument (paneModel zeroes it while importing).
  assert.match(route, /paneModel\(rows, state, now, open, openAsOf, exclusionTotal\(/);
  assert.doesNotMatch(route, /getTime\(\) \/\*|closedAt: r\.closedAt/);
});
