// F-12 AC8: the F-4 record card's output is byte-identical before and after F-10/F-12. The snapshot
// (lib/snapshots/f4-record-card.json) was written from main's F-4 code (6dde868) before any strip change. Regenerate it
// only for a deliberate F-4 change: UPDATE_SNAPSHOT=1 node --test lib/record-card.snapshot.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cardAlt, cardDescription, recordCard, type CardKind } from './record-card.ts';
import type { ConfidenceInput } from './trades.ts';
import type { RecordState } from './copy.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2025, 0, 1);
const now = new Date(Date.UTC(2026, 10, 1, 12));
const tr = (symbol: string, open: number, close: number, r: number): ConfidenceInput => ({
  symbol, openedAt: new Date(t0 + open * DAY), closedAt: new Date(t0 + close * DAY), returnPct: r, holdingDays: close - open,
});
const record = (k: number, spanDays: number, f: (i: number) => number) =>
  Array.from({ length: k }, (_, i) => tr(`Q${i}`, (i / Math.max(k - 1, 1)) * (spanDays - 1), (i / Math.max(k - 1, 1)) * (spanDays - 1) + 1, f(i)));
const wobble = (m: number) => (i: number) => m + (i % 2 ? 0.004 : -0.004);
const RECORDS: Record<string, ConfidenceInput[]> = {
  empty: [],
  one: [tr('ONE', 0, 3, 0.48)],
  under5: record(4, 30, wobble(0.02)),
  winning: record(12, 115, wobble(0.03)),
  losing: record(12, 115, wobble(-0.03)),
  wide: record(12, 120, (i) => (i % 2 ? -0.22 : 0.28)),
  overlapping: [tr('A', 0, 10, 0.05), tr('A', 5, 12, 0.02), tr('A', 10, 20, -0.01), tr('B', 1, 2, 0.1), tr('C', 3, 4, -0.2), tr('D', 5, 6, 0.03), tr('E', 7, 8, 0.01)],
  modUp: record(45, 200, wobble(0.01)),
  strongDown: record(140, 800, wobble(-0.01)),
};
const KINDS: CardKind[] = ['unfurl', 'square', 'story'];
const STATES: RecordState[] = ['connected', 'importing', 'failed', 'none'];
const OPEN = [null, [0.121, 0.034, -0.08]];

function snapshot() {
  const out: Record<string, unknown> = {};
  for (const [name, trades] of Object.entries(RECORDS)) for (const kind of KINDS) for (const state of STATES) for (const demo of [false, true]) for (const open of OPEN) {
    const m = recordCard({ handle: 'snap_test', name: 'Snap Trader', state, demo, verified: !demo && trades.length > 0, now, link: null, kind, trades,
      ...(open ? { open } : {}) });
    // One sha256 per case of the exact JSON text (model, alt, description): byte-exact, and a failure names the case.
    out[`${name}|${kind}|${state}|${demo ? 'demo' : 'real'}|${open ? 'open' : 'closed'}`] = createHash('sha256').update(JSON.stringify({ model: m, alt: cardAlt(m), description: cardDescription(m) })).digest('hex');
  }
  return JSON.stringify(out, null, 1) + '\n';
}

const FILE = new URL('./snapshots/f4-record-card.json', import.meta.url);

test('F-12 AC8: the F-4 record card (model, alt, description) is byte-identical to the pre-F-12 snapshot', () => {
  const got = snapshot();
  if (process.env.UPDATE_SNAPSHOT === '1') writeFileSync(FILE, got);
  assert.deepEqual(JSON.parse(got), JSON.parse(readFileSync(FILE, 'utf8')));
  assert.ok(Object.keys(JSON.parse(got)).length >= 400);
});
