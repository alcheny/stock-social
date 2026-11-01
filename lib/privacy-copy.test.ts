// Privacy work (2026-11-01): owner copy verbatim (committee D16) and the launch gate's closed states (D6–D8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allCopy, LAUNCH, LIKES } from './copy.ts';

test('the likes line is the owner\'s text', () => {
  assert.equal(LIKES.private, 'Only you can see your likes. Traders are never told and no one sees a count. Likes help order your own feed.');
});

test('closed-state copy: plain, no date, no promise, no waitlist', () => {
  assert.deepEqual(LAUNCH, {
    closed: "Sign-up isn't open yet. Existing accounts can still sign in.",
    closedAfter: "Sign-up isn't open yet. That sign-in isn't linked to an account.",
    connectClosed: "Connecting a brokerage isn't open yet.",
  });
  for (const t of Object.values(LAUNCH)) assert.doesNotMatch(t, /\d|soon|waitlist|wait list|launch|notify|guarantee/i, t);
  assert.ok(allCopy().includes(LAUNCH.closed), 'walked by the copy compliance checks');
});
