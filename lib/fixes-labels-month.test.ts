// Fixes-labels plan AC15 (D-24): a month shows numbers and a range only, never a verdict; "1 of N months on record".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthRangeText, monthRecap, monthsOnRecord, type RecapTrade } from './recap.ts';
import { MIN_BETS } from './confidence.ts';

const NOW = new Date(Date.UTC(2026, 10, 1));
const DAY = 86_400_000;
const mk = (id: string, closed: string, r = 0.02, hold = 2): RecapTrade => {
  const c = new Date(closed);
  return { sellId: id, symbol: `S${id}`, openedAt: new Date(c.getTime() - hold * DAY), closedAt: c, returnPct: r, holdingDays: hold };
};
const sept = (n: number) => Array.from({ length: n }, (_, i) => mk(`t${i}`, new Date(Date.UTC(2026, 8, 1 + i * 2)).toISOString(), i % 3 ? 0.03 : -0.02));

test('AC15: monthRecap carries the bets behind the month; the month line is a range or "No range yet: k of the min separate bets needed", never a verdict', () => {
  const few = monthRecap(sept(3), '2026-09', NOW)!;
  assert.equal(few.bets, 3);
  assert.equal(monthRangeText(few), `No range yet: 3 of the ${MIN_BETS} separate bets needed`);
  const many = monthRecap(sept(8), '2026-09', NOW)!;
  assert.equal(many.bets, 8);
  assert.match(monthRangeText(many)!, /^95% range \([+−-]?\d+\.\d% to [+−-]?\d+\.\d%\)$/);
  for (const m of [few, many]) assert.doesNotMatch(monthRangeText(m) ?? '', /Past results|above zero|below zero|unclear|Evidence|Too early/);
});

test('AC15: monthsOnRecord counts distinct UTC months; edges at UTC midnight', () => {
  assert.equal(monthsOnRecord([]), 0);
  assert.equal(monthsOnRecord(sept(5)), 1);
  assert.equal(monthsOnRecord([mk('a', '2026-08-31T23:59:59Z'), mk('b', '2026-09-01T00:00:00Z'), mk('c', '2026-09-30T12:00:00Z'), mk('d', '2025-09-10T00:00:00Z')]), 3);
});
