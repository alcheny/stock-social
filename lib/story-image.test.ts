// The Share button's square and story images. F-4: they draw the record card (lib/record-card.ts), so these tests,
// written for the old story model, now check the card at the square / story sizes. Rewritten one for one where F-4
// changed the rule (win rate and the worst trade come off the card; the "New record" chip replaces the old pill).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMATS, parseFormat } from './story-image.ts';
import { recordCard, type CardInput } from './record-card.ts';
import { pct, type ConfidenceInput } from './trades.ts';
import type { RecordState } from './copy.ts';

const DAY = 86_400_000;
const now = new Date(Date.UTC(2026, 9, 26));
// Closes 3 days apart, opened 60+ days ago (so only the count decides "New record").
const rets = (xs: number[]): ConfidenceInput[] => xs.map((r, i) => ({
  symbol: `S${i}`, openedAt: new Date(now.getTime() - (90 - i * 3) * DAY), closedAt: new Date(now.getTime() - (87 - i * 3) * DAY), returnPct: r, holdingDays: 3,
}));
const model = (xs: number[], demo = false, o: Partial<CardInput> = {}) =>
  recordCard({ kind: 'story', handle: 'story_test', name: 'Story Test', trades: rets(xs), state: 'connected', demo, verified: !demo && xs.length > 0, now, link: 'example.test/u/story_test', ...o });

test('New record chip: 9 trades yes, 10 no, 0 no (TR-7; F-4 replaces the old uncertainty pill)', () => {
  assert.equal(model(Array(9).fill(0.02)).newRecord, true);
  assert.equal(model(Array(10).fill(0.02)).newRecord, false);
  assert.equal(model([]).newRecord, false);
});

test('F-4: no worst or best trade on the image (per-trade detail is off the card), for gains and losses alike', () => {
  for (const xs of [[0.05, -0.08, 0.01], [-0.03, -0.02], [0.02]]) {
    const m = model(xs);
    const worst = pct(Math.min(...xs));
    const { chart: _c, ...text } = m;
    for (const v of Object.values(text)) if (typeof v === 'string' && xs.length > 1) assert.ok(!v.includes(worst), `${v} shows ${worst}`);
    assert.ok(!('worstReturn' in m) && !('bestReturn' in m));
  }
});

test('no best-trade, quantity or price fields; no $ in values', () => {
  const m = model([0.05, -0.08]);
  for (const k of Object.keys(m)) {
    assert.doesNotMatch(k, /best|top|max/i);
    assert.doesNotMatch(k, /qty|quantity|price|shares|amount|\$/i);
  }
  for (const v of Object.values(m)) if (typeof v === 'string') assert.ok(!v.includes('$'));
});

test('demo never carries the verified label', () => {
  assert.doesNotMatch(model([0.05], true).label, /Verified|Imported/);
  assert.equal(model([0.05], true).label, 'Demo data, not a real broker record');
  assert.equal(model([0.05]).label, 'Imported read-only from the broker');
});

test('0 trades: no throw, empty headline, null stats', () => {
  const m = model([]);
  assert.equal(m.body, 'No closed trades yet');
  assert.equal(m.headline, null);
  assert.equal(m.range, null);
  assert.equal(m.count, null);
  assert.equal(m.chart, null);
});

test('parseFormat', () => {
  assert.equal(parseFormat('story'), 'story');
  assert.equal(parseFormat('square'), 'square');
  for (const v of ['x', '', null, undefined]) assert.equal(parseFormat(v), 'square');
  assert.equal(FORMATS.story.height, 1920);
});

test('fix round 6 (TR-3): a failed record carries the incomplete line and never the imported-read-only label; a running import shows no stats', () => {
  const run = (state: RecordState, demo = false) => model([0.05, -0.02], demo, { state, kind: 'square' });
  const f = run('failed');
  assert.equal(f.label, 'Import did not finish');
  assert.equal(f.tone, 'warn');
  assert.equal(f.note, 'The import did not finish, so this record may be incomplete.');
  assert.equal(f.headline, '+1.5%');
  const i = run('importing');
  assert.equal(i.body, 'Import in progress');
  assert.equal(i.headline, null);
  assert.equal(i.range, null);
  assert.equal(i.chart, null);
  assert.equal(i.count, null);
  assert.doesNotMatch(i.label, /Imported read-only|Verified/);
  assert.equal(run('connected').label, 'Imported read-only from the broker');
  assert.equal(run('connected').note, null);
  for (const st of ['importing', 'connected', 'failed', 'none'] as const) {
    const d = run(st, true);
    assert.equal(d.label, 'Demo data, not a real broker record');
    assert.equal(d.note, null);
    assert.equal(d.headline, '+1.5%');
  }
});
