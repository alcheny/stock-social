import { test } from 'node:test';
import assert from 'node:assert/strict';
import { count, counted } from './format.ts';

test('count groups thousands and never shows a bare 4-digit count', () => {
  assert.equal(count(0), '0');
  assert.equal(count(999), '999');
  assert.equal(count(1000), '1,000');
  assert.equal(count(2828), '2,828');
  assert.equal(count(10000), '10,000');
  assert.equal(count(1234567), '1,234,567');
  assert.equal(count(-4731), '-4,731');
  assert.equal(count(2828.4), '2,828'); // whole numbers
});

test('counted: singular only for exactly one', () => {
  assert.equal(counted(1, 'closed trade'), '1 closed trade');
  assert.equal(counted(0, 'closed trade'), '0 closed trades');
  assert.equal(counted(2828, 'closed trade'), '2,828 closed trades');
  assert.equal(counted(10000, 'activity', 'activities'), '10,000 activities');
});
