// F-2 PR-4: the feed card's gesture rules (pure) and the owner's weights for the new signals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOUBLE_TAP_MS, NOT_TAP, cardRejectOutcome, isDoubleTap, isTap } from './gestures.ts';
import { canArm, horizontal } from './reject.ts';
import { TRADE_REJECT_TRADER_DAYS, UNFOLLOW_DAYS, WEIGHTS, traderPreference } from './weights.ts';

test('double tap: 299 ms and 300 ms like, 301 ms does not; within 24 px only; a press that moved 10 px or more is not a tap (a swipe or scroll never likes)', () => {
  const a = { t: 1000, x: 100, y: 100 };
  assert.equal(DOUBLE_TAP_MS, 300);
  assert.equal(isDoubleTap(a, { t: 1299, x: 100, y: 100 }), true);
  assert.equal(isDoubleTap(a, { t: 1300, x: 110, y: 110 }), true);
  assert.equal(isDoubleTap(a, { t: 1301, x: 100, y: 100 }), false);
  assert.equal(isDoubleTap(a, { t: 1100, x: 125, y: 100 }), false);
  assert.equal(isDoubleTap(null, a), false);
  assert.equal(isDoubleTap(a, { t: 900, x: 100, y: 100 }), false);
  assert.equal(isTap(a, { t: 1050, x: 109, y: 100 }), true);
  assert.equal(isTap(a, { t: 1050, x: 110, y: 100 }), false);
  assert.equal(isTap(a, { t: 1050, x: 100, y: 160 }), false);
});

test('a tap on a link, button, menu or the chart is never a like tap', () => {
  for (const s of ['a', 'button', 'summary', 'details', '.chart', 'svg', 'input']) assert.ok(NOT_TAP.split(', ').includes(s), s);
});

test('feed card reject: 49% of the card snaps back, 50% and 51% commit; unarmed never commits; it arms only at rest, with no pane open and not within 400 ms (399 ms) after the row came back; a diagonal over the lock ratio scrolls', () => {
  assert.equal(cardRejectOutcome(true, 49, 100), 'back');
  assert.equal(cardRejectOutcome(true, 50, 100), 'reject');
  assert.equal(cardRejectOutcome(true, 51, 100), 'reject');
  assert.equal(cardRejectOutcome(false, 100, 100), 'back');
  assert.equal(cardRejectOutcome(true, 0, 0), 'back');
  assert.equal(cardRejectOutcome(true, -80, 100), 'back');
  assert.equal(canArm({ atRest: true, paneOpen: false, sinceClose: 399 }), false);
  assert.equal(canArm({ atRest: true, paneOpen: false, sinceClose: 400 }), true);
  assert.equal(canArm({ atRest: false, paneOpen: false, sinceClose: 1e9 }), false);
  assert.equal(canArm({ atRest: true, paneOpen: true, sinceClose: 1e9 }), false);
  assert.equal(horizontal(40, 21), false);
  assert.equal(horizontal(40, 20), true);
});

test('O4: WEIGHTS.unfollow is −1, slighter than "Not interested" −4; like +3; an unfollow ranks the trader below an otherwise identical one for 90 days, then equal; a trade reject\'s trader −4 expires at 90 days', () => {
  assert.equal(WEIGHTS.unfollow, -1);
  assert.ok(WEIGHTS.unfollow > WEIGHTS.notInterested && WEIGHTS.unfollow < 0);
  assert.equal(UNFOLLOW_DAYS, 90); assert.equal(TRADE_REJECT_TRADER_DAYS, 90);
  const day = 86_400_000, t0 = 1_000_000_000_000;
  const s = [{ trader: 1, kind: 'unfollow' as const, at: t0 }, { trader: 3, kind: 'tradeReject' as const, at: t0 }, { trader: 4, kind: 'like' as const, at: t0 }, { trader: 4, kind: 'like' as const, at: t0 }];
  const now = traderPreference(s, t0 + 89 * day);
  assert.ok((now.get(1) ?? 0) < (now.get(2) ?? 0), 'unfollowed trader 1 below identical trader 2');
  assert.equal(now.get(3), -4); assert.equal(now.get(4), 6);
  const later = traderPreference(s, t0 + 90 * day);
  assert.equal(later.get(1) ?? 0, later.get(2) ?? 0);
  assert.equal(later.get(3), undefined); assert.equal(later.get(4), 6);
});
