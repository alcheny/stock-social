import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paneSummary, groupByUser, paneTrust, cardTrust } from './pane.ts';
import { stats } from './trades.ts';

const t = (returnPct: number, day: number, symbol = 'AAA') => ({
  returnPct, holdingDays: day, closedAt: new Date(Date.UTC(2026, 0, day)), symbol,
});
const rows = [t(0.1, 5), t(-0.2, 2, 'BBB'), t(0.05, 9), t(-0.01, 7), t(0.3, 1), t(0.02, 12), t(-0.05, 3)];

test('pane win rate and avg return equal the profile stats (all-time, never windowed)', () => {
  const p = paneSummary(rows);
  const s = stats(rows);
  assert.equal(p.winRate, s.winRate);
  assert.equal(p.avgReturn, s.avgReturn);
  assert.equal(p.count, rows.length);
});

test('summary: first close, worst trade, last 5 newest-first with losses included', () => {
  const p = paneSummary(rows);
  assert.equal(p.since?.toISOString(), new Date(Date.UTC(2026, 0, 1)).toISOString());
  assert.equal(p.worst?.symbol, 'BBB');
  assert.equal(p.worst?.returnPct, -0.2);
  assert.equal(p.recent.length, 5);
  assert.deepEqual(p.recent.map((x) => x.closedAt.getUTCDate()), [12, 9, 7, 5, 3]);
  assert.ok(p.recent.some((x) => x.returnPct < 0));
});

test('empty record has no worst trade or start date', () => {
  const p = paneSummary([]);
  assert.equal(p.count, 0);
  assert.equal(p.worst, null);
  assert.equal(p.since, null);
});

test('groupByUser batches one query result into per-trader lists', () => {
  const g = groupByUser([{ userId: 1, v: 'a' }, { userId: 2, v: 'b' }, { userId: 1, v: 'c' }]);
  assert.deepEqual(g.get(1)?.map((x) => x.v), ['a', 'c']);
  assert.equal(g.get(2)?.length, 1);
});

test('pane trust (fix round 4, TR-3): a failed import stays in the feed with no Verified badge and the incomplete line; a whole record is Verified; demo data keeps Demo', () => {
  const real = [{ verified: true }, { verified: true }], demo = [{ verified: false }];
  assert.deepEqual(paneTrust(real, 'connected'), { badge: 'verified', incomplete: false });
  assert.deepEqual(paneTrust(real, 'failed'), { badge: null, incomplete: true });
  assert.deepEqual(paneTrust(demo, 'none'), { badge: 'demo', incomplete: false });
  assert.deepEqual(paneTrust(demo, 'failed'), { badge: 'demo', incomplete: true });
  assert.deepEqual(paneTrust([], 'connected'), { badge: 'demo', incomplete: false }); // as before: no trades is never Verified
});

test('card trust (fix round 5, TR-3): the feed trade card shows no Verified badge and the incomplete line for a failed record, Verified for a whole one, Demo for demo data', () => {
  assert.deepEqual(cardTrust({ verified: true }, 'failed'), { badge: null, incomplete: true });
  assert.deepEqual(cardTrust({ verified: true }, 'connected'), { badge: 'verified', incomplete: false });
  assert.deepEqual(cardTrust({ verified: true }), { badge: 'verified', incomplete: false }); // no state read: as before
  assert.deepEqual(cardTrust({ verified: false }, 'none'), { badge: 'demo', incomplete: false });
  assert.deepEqual(cardTrust({ verified: false }, 'failed'), { badge: 'demo', incomplete: true });
});
