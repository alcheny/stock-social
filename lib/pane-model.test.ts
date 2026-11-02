// F-23 · the pane model (lib/pane-model.ts): every figure the pane prints, computed from stored values, rounded to what
// it prints. AC 2 (unrealized_pct, openAsOf), AC 3 (pane headline = profile headline on a rounding edge), AC 10 (the
// average and headline sent to the client are rounded).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paneModel, type PaneModelTrade } from './pane-model.ts';
import { paneEvidence } from './pane-evidence.ts';
import { pct, stats } from './trades.ts';
import { tone } from './format.ts';
import { wirePct } from './public-wire.ts';
import { PAYLOAD_V } from './chart-series.ts';

const DAY = 86_400_000;
const now = new Date('2026-10-31T09:00:00Z');
const t = (i: number, r: number, at: string): PaneModelTrade => ({ id: String(i), symbol: `S${i}`, returnPct: r, holdingDays: 2.345678, closedAt: new Date(at), thesis: null, verified: true, openedAt: new Date(Date.parse(at) - 2.345678 * DAY) });
// Stored average 0.024493...: prints "+2.4%". The same closes at the printed precision (0.032, 0.017, 0.0246) average
// "+2.5%": a client averaging rounded closes would print another headline.
const EDGE = [t(1, 0.03246, '2026-10-14T14:31:07.123Z'), t(2, 0.01652, '2026-10-14T16:02:41Z'), t(3, 0.0245, '2026-10-20T10:00:00Z')];

test('AC 3: the pane headline equals the profile headline on a rounding edge (a client average of rounded closes would not)', () => {
  const s = stats(EDGE);
  const m = paneModel(EDGE, 'connected', now);
  assert.equal(pct(s.avgReturn), '+2.4%');
  assert.equal(pct(EDGE.map((x) => wirePct(x.returnPct)).reduce((a, b) => a + b, 0) / 3), '+2.5%'); // the trap
  assert.equal(pct(m.avgReturn), pct(s.avgReturn));
  assert.equal(tone(m.avgReturn), tone(s.avgReturn));
  assert.equal(`${(m.winRate * 100).toFixed(0)}%`, `${(s.winRate * 100).toFixed(0)}%`);
  // A JSON round trip (the /pane route) changes nothing.
  assert.deepEqual(JSON.parse(JSON.stringify(m)), m);
});

test('AC 10: the average, worst, rows, open and combined figures go out at the printed precision; dates as UTC days', () => {
  const trades = [...EDGE, t(4, 0.123456789, '2026-10-21T14:31:07Z'), t(5, -0.0504999, '2026-10-22T08:00:00Z'), t(6, 0.0000049, '2026-10-23T08:00:00Z')];
  const open = [0.087654321, -0.0123456];
  const m = paneModel(trades, 'connected', now, open, new Date('2026-10-30T09:12:45.678Z'));
  for (const v of [m.avgReturn, m.worst!.returnPct, ...m.recent.map((r) => r.returnPct), m.open!.avg, m.both!.avg]) assert.equal(wirePct(v), v);
  assert.equal(m.winRate, 0.83); // 5 of 6 (0.0000049 counts as a win, as on the profile): 83%
  assert.deepEqual(m.worst, { symbol: 'S5', returnPct: -0.05 });
  assert.equal(m.since, '2026-10-14');
  const d = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY;
  assert.deepEqual(m.recent.map((r) => [r.id, r.day]), [['6', d('2026-10-23')], ['5', d('2026-10-22')], ['4', d('2026-10-21')], ['3', d('2026-10-20')], ['2', d('2026-10-14')]]);
  // AC 2: unrealized_pct and openAsOf.
  assert.deepEqual(m.open, { n: 2, up: 1, down: 1, flat: 0, avg: 0.038 });
  assert.equal(m.openAsOf, '2026-10-30');
  const json = JSON.stringify(m);
  assert.doesNotMatch(json, /1234|0876|8765|5049|0504|0000049|09:12|14:31|\b1\d{12}\b/);
  // The evidence is the stored records' (the profile's path), entry times included.
  const ev = paneEvidence(trades, now);
  assert.equal(m.rangeLine, ev.rangeLine);
  assert.equal(m.newRecord, ev.newRecord);
});

test('no open positions: no open block and no as-of date; an empty record has no since or worst', () => {
  const m = paneModel(EDGE, 'connected', now, [], new Date());
  assert.equal(m.open, null);
  assert.equal(m.openAsOf, null);
  assert.equal(m.both, null);
  const e = paneModel([], 'connected', now);
  assert.equal(e.since, null);
  assert.equal(e.worst, null);
  assert.equal(e.badge, 'demo');
});

test('AC 7: the /pane route and the lazy pane use the versioned URL, and the route serves nothing else', () => {
  const route = readFileSync(new URL('../app/u/[handle]/pane/route.ts', import.meta.url), 'utf8');
  const chartRoute = readFileSync(new URL('../app/u/[handle]/pane-chart/route.ts', import.meta.url), 'utf8');
  const lazy = readFileSync(new URL('../app/lazy-pane.tsx', import.meta.url), 'utf8');
  for (const src of [route, chartRoute]) assert.match(src, /searchParams\.get\('v'\) !== String\(PAYLOAD_V\)\) return NextResponse\.json\(\{ error: 'not found' \}, \{ status: 404/);
  assert.match(route, /NextResponse\.json\(\{ v: PAYLOAD_V, state, model, chart, status,/);
  assert.match(lazy, /\/pane\?v=\$\{PAYLOAD_V\}/);
  assert.match(lazy, /d\.v !== PAYLOAD_V\) throw/);
  assert.equal(PAYLOAD_V, 2);
});
