import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMATS, parseFormat, storyModel } from './story-image.ts';
import { stats } from './trades.ts';

const rets = (xs: number[]) => xs.map((r, i) => ({ returnPct: r, holdingDays: 3, closedAt: new Date(2026, 0, i + 1) }));
const model = (xs: number[], demo = false) => storyModel(stats(rets(xs)), xs.length, null, { worst: xs.length ? Math.min(...xs) : null, demo });

test('uncertainty line: 9 trades yes, 10 no, 0 no', () => {
  assert.equal(model(Array(9).fill(0.02)).uncertaintyLine, 'New record, wide uncertainty');
  assert.equal(model(Array(10).fill(0.02)).uncertaintyLine, null);
  assert.equal(model([]).uncertaintyLine, null);
});

test('worst return is the minimum, shown for losses-only too', () => {
  assert.equal(model([0.05, -0.08, 0.01]).worstReturn, '-8.0%');
  assert.equal(model([-0.03, -0.02]).worstReturn, '-3.0%');
  assert.equal(model([0.02]).worstReturn, '+2.0%');
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
  assert.doesNotMatch(model([0.05], true).badge, /Verified/);
  assert.equal(model([0.05]).badge, 'Imported read-only from the broker');
});

test('0 trades: no throw, empty headline, null stats', () => {
  const m = storyModel(stats([]), 0);
  assert.equal(m.empty, true);
  assert.equal(m.headline, 'No closed trades yet');
  assert.equal(m.winRatePct, null);
  assert.equal(m.avgReturn, null);
  assert.equal(m.worstReturn, null);
});

test('parseFormat', () => {
  assert.equal(parseFormat('story'), 'story');
  assert.equal(parseFormat('square'), 'square');
  for (const v of ['x', '', null, undefined]) assert.equal(parseFormat(v), 'square');
  assert.equal(FORMATS.story.height, 1920);
});
