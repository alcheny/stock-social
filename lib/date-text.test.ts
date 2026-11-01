// Fixes-labels plan AC4 (D-05, fix #24): one date text. "Mon D" in the current UTC year, "Mon D, YYYY" otherwise,
// always with the year for images, share text and cached renders; relative times for the status line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateText, relativeText } from './date-text.ts';
import { asOfDay } from './copy.ts';

const NOW = new Date('2026-11-01T12:00:00Z');
const H = 3_600_000, D = 24 * H;

test('dateText: no year in the current UTC year, the year otherwise, and always with year: always', () => {
  assert.equal(dateText(new Date('2026-05-30T10:00:00Z'), NOW), 'May 30');
  assert.equal(dateText(new Date('2020-05-30T10:00:00Z'), NOW), 'May 30, 2020');
  assert.equal(dateText(new Date('2026-05-30T10:00:00Z'), NOW, { year: 'always' }), 'May 30, 2026');
  assert.equal(dateText(new Date('2027-01-02T10:00:00Z'), NOW), 'Jan 2, 2027');
});

test('dateText: UTC at the day and year edges (23:30 and 00:30 UTC)', () => {
  assert.equal(dateText(new Date('2026-05-30T23:30:00Z'), NOW), 'May 30');
  assert.equal(dateText(new Date('2026-05-31T00:30:00Z'), NOW), 'May 31');
  assert.equal(dateText(new Date('2025-12-31T23:30:00Z'), NOW), 'Dec 31, 2025');
  assert.equal(dateText(new Date('2026-01-01T00:30:00Z'), NOW), 'Jan 1');
  // "now" in the first half hour of a UTC year: last year's close carries its year.
  assert.equal(dateText(new Date('2025-12-31T23:30:00Z'), new Date('2026-01-01T00:30:00Z')), 'Dec 31, 2025');
});

test('dateText matches asOfDay (the open positions date) on the same inputs', () => {
  for (const d of ['2026-05-30T23:30:00Z', '2026-01-01T00:30:00Z', '2020-02-29T12:00:00Z', '2025-12-31T23:59:59Z']) {
    assert.equal(dateText(new Date(d), NOW), asOfDay(new Date(d), NOW), d);
  }
});

test('relativeText: hours, yesterday, days, weeks, months; the future reads as under an hour', () => {
  const ago = (ms: number) => relativeText(new Date(NOW.getTime() - ms), NOW);
  assert.equal(ago(0), 'less than an hour ago');
  assert.equal(ago(59 * 60_000), 'less than an hour ago');
  assert.equal(ago(-5 * H), 'less than an hour ago');
  assert.equal(ago(H), '1 hour ago');
  assert.equal(ago(23 * H + 59 * 60_000), '23 hours ago');
  assert.equal(ago(D), 'yesterday');
  assert.equal(ago(2 * D - 1), 'yesterday');
  assert.equal(ago(2 * D), '2 days ago');
  assert.equal(ago(29 * D), '29 days ago');
  assert.equal(ago(30 * D), '4 weeks ago');
  assert.equal(ago(84 * D), '12 weeks ago');
  assert.equal(ago(91 * D), '3 months ago');
  assert.equal(ago(400 * D), '13 months ago');
});
