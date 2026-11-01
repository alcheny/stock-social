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

test('AC15/AC16: the month card: record line the size of the month line, "1 of N months", two 28 px F3 lines, and room for every optional line (a frozen line too)', async () => {
  const { monthCard, monthCardFits, MONTH_CARD } = await import('./month-card.ts');
  const { DISCLAIMER } = await import('./share.ts');
  const base = (o: { state: 'importing' | 'connected' | 'failed' | 'none'; demo: boolean; monthSoFar: boolean; months?: number }) => ({
    handle: 'a-long-handle-name-xx', displayName: 'A rather long display name', demo: o.demo, verified: !o.demo, state: o.state, months: o.months,
    recap: { label: 'September 2026', monthSoFar: o.monthSoFar, count: 12, showHeadline: true, winRate: 0.58, avgReturn: -0.123, best: { symbol: 'ABCDE', returnPct: 1.234 }, worst: { symbol: 'VWXYZ', returnPct: -0.876 } },
    record: { trades: 120, winRate: 0.55, avgReturn: 0.012, evidence: 'Too early to tell (8 of 10 bets)', range: '-3.0% to +5.0%', newRecord: true },
  });
  const FROZEN = 26 * MONTH_CARD.lineHeight;
  for (const state of ['importing', 'connected', 'failed', 'none'] as const) for (const demo of [true, false]) for (const monthSoFar of [true, false]) {
    const c = monthCard(base({ state, demo, monthSoFar, months: 14 }));
    const fit = monthCardFits(c);
    assert.ok(fit.height + FROZEN <= fit.room, `${state} ${demo} ${monthSoFar}: ${fit.height} + ${FROZEN} > ${fit.room}`);
    assert.deepEqual(fit.tooWide, []);
    assert.equal(c.disclaimer.text, DISCLAIMER);
    assert.equal(c.disclaimer.lines?.length, 2);
    assert.equal(c.disclaimer.lines!.join(' '), DISCLAIMER);
    assert.ok(c.disclaimer.size >= 28);
    const month = c.top.find((l) => l.role === 'month')!, record = c.bottom.find((l) => l.role === 'record');
    if (record) assert.equal(record.size, month.size);
    assert.equal(c.top.find((l) => l.role === 'of')?.text, '1 of 14 months on record');
    assert.ok(c.top.find((l) => l.role === 'label')!.size <= 64);
    for (const l of [...c.top, ...c.bottom]) assert.doesNotMatch(l.text, /\bago\b/);
  }
  assert.equal(monthCard(base({ state: 'connected', demo: false, monthSoFar: false, months: 1 })).top.find((l) => l.role === 'of')?.text, 'The only month on record');
  assert.equal(monthCard(base({ state: 'connected', demo: false, monthSoFar: false })).top.some((l) => l.role === 'of'), false);
});
