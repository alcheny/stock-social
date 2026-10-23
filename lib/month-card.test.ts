import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitSize, monthCard, monthCardFits, MONTH_CARD } from './month-card.ts';
import { DISCLAIMER } from './share.ts';
import { RECORD_BODY } from './copy.ts';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const base = (o: { label: string; monthSoFar: boolean; state?: 'importing' | 'connected' | 'failed' | 'none'; demo?: boolean; count?: number }) => ({
  handle: 'a-long-handle-name-xx', displayName: 'A rather long display name', demo: o.demo ?? false, verified: !(o.demo ?? false), state: o.state ?? 'connected',
  recap: { label: o.label, monthSoFar: o.monthSoFar, count: o.count ?? 12, showHeadline: true, winRate: 0.58, avgReturn: -0.123, best: { symbol: 'ABCDE', returnPct: 1.234 }, worst: { symbol: 'VWXYZ', returnPct: -0.876 } },
  record: { trades: 120, winRate: 0.55, avgReturn: 0.012, evidence: 'Too early to tell (8 of 10 bets)', range: '-3.0% to +5.0%', newRecord: true },
});

test('fix round 6 (POLICY F3): the month card keeps the disclaimer in view with the longest month label, in every record state', () => {
  const longest = [...MONTHS].sort((a, b) => b.length - a.length)[0];
  assert.equal(longest, 'September');
  for (const monthSoFar of [true, false]) for (const state of ['importing', 'connected', 'failed', 'none'] as const) for (const demo of [true, false]) {
    const c = monthCard(base({ label: `${longest} 2026`, monthSoFar, state, demo }));
    // The rendered tree's last line is the disclaimer, in full.
    assert.equal(c.disclaimer.text, DISCLAIMER);
    const fit = monthCardFits(c);
    assert.ok(fit.height <= fit.room, `${state} demo=${demo} monthSoFar=${monthSoFar}: ${fit.height} > ${fit.room}`);
    assert.deepEqual(fit.tooWide, [], `${state}: the label stays on one line`);
  }
  // The re-run 5 case: "October 2026 · month so far" no longer wraps (it did at 96 px).
  const oct = monthCard(base({ label: 'October 2026', monthSoFar: true }));
  const label = oct.top.find((l) => l.role === 'label')!;
  assert.ok(label.size < 96 && label.size >= 48, String(label.size));
  assert.equal(fitSize('May 2026'), 96);
  assert.equal(MONTH_CARD.height, 630);
});

test('fix round 6 (TR-3): the month card header and lines follow the record state', () => {
  const card = (state: 'importing' | 'connected' | 'failed' | 'none', demo = false) => monthCard(base({ label: 'March 2026', monthSoFar: false, state, demo }));
  const f = card('failed');
  assert.equal(f.header.label, 'Import did not finish');
  assert.equal(f.header.tone, 'warn');
  assert.ok(f.bottom.some((l) => l.role === 'note' && l.text === RECORD_BODY.failed));
  assert.ok(f.bottom.some((l) => l.role === 'record'));
  const i = card('importing');
  assert.equal(i.bottom.some((l) => l.role === 'record' || l.role === 'new'), false);
  assert.equal(card('connected').header.label, 'Verified from broker');
  assert.equal(card('connected').bottom.some((l) => l.role === 'note'), false);
  assert.equal(card('failed', true).header.label, 'Demo data');
  for (const st of ['importing', 'connected', 'failed', 'none'] as const) for (const demo of [true, false]) {
    const c = card(st, demo);
    for (const l of [...c.top, ...c.bottom, c.disclaimer]) assert.ok(!l.text.includes('✓') && !l.text.includes('$'), l.text);
    assert.ok(!(c.header.label ?? '').includes('✓'));
  }
});
