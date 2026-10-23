// F-1 PR-2b, S5 (docs/features/logs/F-1/plan.md §2, §8 item 2): the live import banner as a pure state machine. Poll
// every 2 s; the status line is announced at most once per 5 s; after 60 s with no new rows the owner sees that the
// import continues without them; "Import finished." is one static line; a failed import hands over to the profile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANNOUNCE_MS, initBanner, onPoll, onServer, onTick, onVisibility, polls, POLL_MS, SLOW_MS } from './import-banner.ts';
import { RECORD_BODY } from './copy.ts';

const T = 1_000_000;

test('timings are the plan\'s: poll 2 s, announce at most every 5 s, the leave-line after 60 s', () => {
  assert.equal(POLL_MS, 2_000);
  assert.equal(ANNOUNCE_MS, 5_000);
  assert.equal(SLOW_MS, 60_000);
});

test('only an importing record shows the banner; the server text is the first text and nothing is pending', () => {
  for (const state of ['connected', 'failed', 'none'] as const) assert.equal(initBanner({ state, closes: 3, read: 6, owner: true }, T).phase, 'hidden', state);
  const b = initBanner({ state: 'importing', closes: 0, read: 0, owner: true }, T);
  assert.equal(b.phase, 'importing');
  assert.equal(b.text, RECORD_BODY.banner(0));
  assert.equal(b.read, 0);
  assert.equal(b.slow, false);
  assert.equal(b.refreshes, 0);
});

test('counts update after each step: the imported count at once, the status line throttled to one announcement per 5 s', () => {
  let b = initBanner({ state: 'importing', closes: 0, read: 0, owner: true }, T);
  b = onPoll(b, { state: 'importing', closes: 0, read: 4 }, T + 2_000);
  assert.equal(b.read, 4); // the imported line is not a live region: it follows every step
  assert.equal(b.text, RECORD_BODY.banner(0)); // nothing to announce yet
  b = onPoll(b, { state: 'importing', closes: 2, read: 8 }, T + 4_000);
  assert.equal(b.text, RECORD_BODY.banner(2)); // the first change goes out at once
  assert.equal(b.refreshes, 1); // and the list under it is refreshed to match
  b = onPoll(b, { state: 'importing', closes: 4, read: 12 }, T + 6_000);
  assert.equal(b.read, 12);
  assert.equal(b.text, RECORD_BODY.banner(2)); // 2 s after the last announcement: held
  b = onPoll(b, { state: 'importing', closes: 5, read: 14 }, T + 8_000);
  assert.equal(b.text, RECORD_BODY.banner(2)); // 4 s: still held, the latest value replaces the pending one
  b = onTick(b, T + 8_999);
  assert.equal(b.text, RECORD_BODY.banner(2));
  b = onTick(b, T + 9_000); // 5 s after the last announcement: the latest count, once
  assert.equal(b.text, RECORD_BODY.banner(5));
  assert.equal(b.refreshes, 2);
  b = onTick(b, T + 15_000);
  assert.equal(b.refreshes, 2); // nothing new, nothing announced
});

test('"Import finished." replaces the line as one static line (throttled like any announcement); polling stops', () => {
  let b = initBanner({ state: 'importing', closes: 0, read: 0, owner: true }, T);
  b = onPoll(b, { state: 'importing', closes: 3, read: 6 }, T + 2_000);
  b = onPoll(b, { state: 'connected', closes: 3, read: 6 }, T + 4_000);
  assert.equal(b.phase, 'finished');
  assert.equal(b.text, RECORD_BODY.banner(3)); // 2 s after the last announcement
  b = onTick(b, T + 7_000);
  assert.equal(b.text, RECORD_BODY.finished);
  assert.equal(b.slow, false);
  // The refresh that follows brings the server's connected state; the finished line stays until the next navigation.
  const after = onServer(b, { state: 'connected', closes: 3, read: 6 }, T + 7_500);
  assert.equal(after.phase, 'finished');
  assert.equal(after.text, RECORD_BODY.finished);
  // A late poll result cannot bring the importing line back.
  assert.equal(onPoll(after, { state: 'importing', closes: 3, read: 6 }, T + 20_000).text, RECORD_BODY.finished);
});

test('a record with no closes at the end still finishes; the server can report the end first', () => {
  let b = initBanner({ state: 'importing', closes: 0, read: 0, owner: false }, T);
  b = onServer(b, { state: 'connected', closes: 0, read: 2 }, T + 1_000);
  assert.equal(b.phase, 'finished');
  assert.equal(b.text, RECORD_BODY.finished);
});

test('a failed import hides the banner at once and refreshes, so the profile\'s own failed line shows', () => {
  let b = initBanner({ state: 'importing', closes: 0, read: 0, owner: true }, T);
  b = onPoll(b, { state: 'importing', closes: 0, read: 3 }, T + 2_000);
  b = onPoll(b, { state: 'failed', closes: 0, read: 3 }, T + 4_000);
  assert.equal(b.phase, 'hidden');
  assert.equal(b.refreshes, 1);
});

test('after 60 s with no new rows the owner sees "You can leave; the import continues."; a new row clears it', () => {
  assert.equal(RECORD_BODY.stillSending, 'Your broker is still sending history. You can leave; the import continues.');
  let b = initBanner({ state: 'importing', closes: 0, read: 0, owner: true }, T);
  b = onPoll(b, { state: 'importing', closes: 0, read: 5 }, T + 2_000);
  for (let t = 4_000; t < 62_000; t += 2_000) b = onPoll(b, { state: 'importing', closes: 0, read: 5 }, T + t);
  assert.equal(b.slow, false); // 58 s since the last new row
  b = onTick(b, T + 62_000);
  assert.equal(b.slow, true);
  b = onPoll(b, { state: 'importing', closes: 0, read: 6 }, T + 64_000);
  assert.equal(b.slow, false);
  // Visitors never see it: the line speaks to the trader who can leave.
  let v = initBanner({ state: 'importing', closes: 0, read: 0, owner: false }, T);
  v = onTick(v, T + 120_000);
  assert.equal(v.slow, false);
});

test('fix round 1: a hidden tab does not poll (each poll advances the import) and resumes on return; the 60 s line restarts from the return; visitors never poll', () => {
  let b = initBanner({ state: 'importing', closes: 0, read: 0, owner: true }, T);
  assert.equal(b.visible, true);
  assert.equal(polls(b), true);
  b = onPoll(b, { state: 'importing', closes: 0, read: 4 }, T + 2_000);
  b = onVisibility(b, false, T + 3_000);
  assert.equal(polls(b), false);
  assert.equal(onVisibility(b, false, T + 4_000), b); // no change, same state
  b = onTick(b, T + 200_000); // away for minutes: nothing polled, nothing new
  b = onVisibility(b, true, T + 200_000);
  assert.equal(polls(b), true);
  assert.equal(b.slow, false); // back: the leave-line is not shown just because the trader was away
  b = onTick(b, T + 259_000);
  assert.equal(b.slow, false);
  b = onTick(b, T + 260_000); // 60 s after the return with no new rows
  assert.equal(b.slow, true);
  // A tab that starts hidden does not poll until shown.
  const hidden = initBanner({ state: 'importing', closes: 0, read: 0, owner: true, visible: false }, T);
  assert.equal(polls(hidden), false);
  assert.equal(polls(onVisibility(hidden, true, T + 1)), true);
  // Visitors and finished or failed banners never poll, shown or not.
  assert.equal(polls(initBanner({ state: 'importing', closes: 0, read: 0, owner: false }, T)), false);
  assert.equal(polls(onPoll(initBanner({ state: 'importing', closes: 0, read: 0, owner: true }, T), { state: 'connected', closes: 0, read: 0 }, T + 2_000)), false);
  assert.equal(polls(onPoll(initBanner({ state: 'importing', closes: 0, read: 0, owner: true }, T), { state: 'failed', closes: 0, read: 0 }, T + 2_000)), false);
});
