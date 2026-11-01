// F-14 sync cadence, the pure rule (lib/sync-cadence.ts#decide; committee docs/features/logs/F-14/committee-2026-11-01.md,
// round 3 "Final rule"). `decide` takes the flags lib/sync-cadence.ts#dueSql computes; `flagsAt` below is this file's
// model of that SQL (the same comparisons, in minutes), so the round-by-round simulations exercise the rule the way the
// sync does: the decision at the transaction's clock, the committed timestamps rolled back with a failed sync, and the
// marks (the last activities attempt and the last 4 positions reads) written after the transaction whatever its outcome.
// lib/sync-cadence.db.test.ts checks this model against the SQL on random states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES_EVERY_MS, ATTEMPT_FLOOR_MS, decide, FUTURE_SLACK_MS, POSITIONS_EVERY_MS, POSITIONS_PER_DAY, type DueFlags } from './sync-cadence.ts';

const H = 60; // minutes
const MIN_MS = 60_000;
const ACT = ACTIVITIES_EVERY_MS / MIN_MS, POS = POSITIONS_EVERY_MS / MIN_MS, FLOOR = ATTEMPT_FLOOR_MS / MIN_MS, SLACK = FUTURE_SLACK_MS / MIN_MS;

// One account's stored state (minutes; null = never).
export type State = { readAt: number | null; attemptedAt: number | null; posReads: number[]; consent: number };
const free = (col: number | null, every: number, t: number, consent: number) => col === null || col <= t - every || col > t + SLACK || col < consent;
// The model of dueSql (same clauses, same order).
export function flagsAt(s: State, t: number): DueFlags {
  const inWindow = s.posReads.filter((r) => r > t - ACT && r <= t + SLACK).length;
  const past = s.posReads.filter((r) => r <= t + SLACK);
  const lastPos = past.length ? Math.max(...past) : null;
  return {
    activities_due: free(s.readAt, ACT, t, s.consent) && free(s.attemptedAt, FLOOR, t, s.consent),
    positions_own: free(lastPos, POS, t, s.consent) && inWindow <= POSITIONS_PER_DAY - 2,
    positions_24h: inWindow,
    consent_new: (s.readAt === null || s.readAt < s.consent) && (s.attemptedAt === null || s.attemptedAt < s.consent || s.attemptedAt > t + SLACK),
  };
}

// How a round's sync ends: 'ok'; 'rebuild' (the rebuild after the activities read throws: positions, read after the
// rebuild, are not read; only a round that read activities rebuilds); 'positions' (the positions call fails: a vendor
// call, never recorded); 'late' (every read returns, then the transaction rolls back).
type Outcome = 'ok' | 'rebuild' | 'positions' | 'late';
type Log = { act: number[]; pos: number[]; posFailed: number[]; deferred: number[]; rollbacks: number[] };
// One round at minute t; the marks land `markLag` minutes later (after the transaction).
function round(s: State, t: number, outcome: Outcome, log: Log, markLag = 1) {
  const d = decide(flagsAt(s, t));
  if (d.deferred) log.deferred.push(t);
  if (!d.activities && !d.positions) return d;
  let actRead = false, posRead = false, failed = false;
  if (d.activities) { log.act.push(t); actRead = true; }
  if (d.activities && outcome === 'rebuild') failed = true;
  else if (d.positions) {
    if (outcome === 'positions') { log.posFailed.push(t); failed = true; } else { log.pos.push(t); posRead = true; }
  }
  if (outcome === 'late') failed = true;
  if (failed) log.rollbacks.push(t);
  else { if (actRead) s.readAt = t; }
  if (actRead) s.attemptedAt = t + markLag;
  if (posRead) s.posReads = [...s.posReads, t + markLag].sort((a, b) => a - b).slice(-POSITIONS_PER_DAY);
  return d;
}
const newLog = (): Log => ({ act: [], pos: [], posFailed: [], deferred: [], rollbacks: [] });
// The most calls in any half-open window [x, x + len) (x at each call).
const maxIn = (times: number[], len: number) => Math.max(0, ...times.map((x) => times.filter((y) => y >= x && y < x + len).length));
const maxGap = (times: number[], from: number, to: number) => { const all = [from, ...times, to]; let g = 0; for (let i = 1; i < all.length; i++) g = Math.max(g, all[i] - all[i - 1]); return g; };
// A reproducible random source.
const rng = (seed: number) => () => { seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31; return seed / 2 ** 31; };

test('constants: activities every 24 h, positions every 6 h and 4 a day, a 6 h attempt floor, 5 min future slack', () => {
  assert.equal(ACTIVITIES_EVERY_MS, 24 * 3_600_000);
  assert.equal(POSITIONS_EVERY_MS, 6 * 3_600_000);
  assert.equal(POSITIONS_PER_DAY, 4);
  assert.equal(ATTEMPT_FLOOR_MS, 6 * 3_600_000);
  assert.equal(FUTURE_SLACK_MS, 5 * 60_000);
});

test('decide: a consent reads both at once, whatever the other flags say (the approved exemption)', () => {
  for (const activities_due of [true, false]) for (const positions_own of [true, false]) for (const positions_24h of [0, 3, 4, 7]) {
    assert.deepEqual(decide({ consent_new: true, activities_due, positions_own, positions_24h }), { activities: true, positions: true, deferred: false });
  }
});

test('decide: activities due read both while fewer than 4 positions reads fall in the trailing 24 h; with 4 or more neither, deferred', () => {
  for (const n of [0, 1, 2, 3]) for (const positions_own of [true, false]) {
    assert.deepEqual(decide({ consent_new: false, activities_due: true, positions_own, positions_24h: n }), { activities: true, positions: true, deferred: false }, `n=${n}`);
  }
  for (const n of [4, 5]) for (const positions_own of [true, false]) {
    assert.deepEqual(decide({ consent_new: false, activities_due: true, positions_own, positions_24h: n }), { activities: false, positions: false, deferred: true }, `n=${n}`);
  }
  // The count can arrive as a string (a driver without the ::int cast): still compared as a number.
  assert.equal(decide({ consent_new: false, activities_due: true, positions_own: false, positions_24h: '4' as unknown as number }).deferred, true);
  assert.equal(decide({ consent_new: false, activities_due: true, positions_own: false, positions_24h: '3' as unknown as number }).activities, true);
});

test('decide: activities not due → positions only on their own clock, never activities, never deferred', () => {
  assert.deepEqual(decide({ consent_new: false, activities_due: false, positions_own: true, positions_24h: 2 }), { activities: false, positions: true, deferred: false });
  assert.deepEqual(decide({ consent_new: false, activities_due: false, positions_own: false, positions_24h: 0 }), { activities: false, positions: false, deferred: false });
});

test('decide: never activities without positions (TR-4: a removal is never apart from the rebuild that publishes the close)', () => {
  for (const consent_new of [true, false]) for (const activities_due of [true, false]) for (const positions_own of [true, false]) for (let n = 0; n <= 6; n++) {
    const d = decide({ consent_new, activities_due, positions_own, positions_24h: n });
    if (d.activities) assert.equal(d.positions, true);
    if (d.deferred) assert.equal(d.activities || d.positions, false);
  }
});

test('model: null, old, future and pre-consent timestamps are free; a fresh one holds the read back (G1)', () => {
  const t = 100 * H;
  const base: State = { readAt: t - 2 * H, attemptedAt: t - 2 * H, posReads: [t - 2 * H], consent: 0 };
  assert.equal(flagsAt(base, t).activities_due, false);
  assert.equal(flagsAt(base, t).positions_own, false);
  assert.equal(flagsAt({ ...base, readAt: null, attemptedAt: null }, t).consent_new, true); // never read: read at once
  // A null committed read with a vendor read attempted 2 h ago (a sync that rolled back): the 6 h floor holds it (G1, G2).
  assert.equal(flagsAt({ ...base, readAt: null }, t).consent_new, false);
  assert.equal(flagsAt({ ...base, readAt: null }, t).activities_due, false);
  assert.equal(flagsAt({ ...base, readAt: null, attemptedAt: t - FLOOR }, t).activities_due, true);
  assert.equal(flagsAt({ ...base, readAt: t - ACT, attemptedAt: t - FLOOR }, t).activities_due, true); // exactly 24 h / 6 h: due
  assert.equal(flagsAt({ ...base, readAt: t - ACT + 1, attemptedAt: t - FLOOR }, t).activities_due, false);
  assert.equal(flagsAt({ ...base, readAt: t + 10 * 24 * H, attemptedAt: t + 10 * 24 * H, posReads: [t + 10 * 24 * H] }, t).activities_due, true); // 10 days ahead
  assert.equal(flagsAt({ ...base, readAt: t + SLACK, attemptedAt: t + SLACK }, t).activities_due, false); // within the slack: held
  assert.equal(flagsAt({ ...base, readAt: t + SLACK + 1, attemptedAt: t + SLACK + 1 }, t).activities_due, true);
  // Future positions reads are outside the window, so they never fill it.
  assert.equal(flagsAt({ ...base, readAt: t - ACT, attemptedAt: null, posReads: [t + 9 * 24 * H, t + 9 * 24 * H, t + 9 * 24 * H, t + 9 * 24 * H] }, t).positions_24h, 0);
  // A consent after the last read: new, read at once.
  assert.equal(flagsAt({ ...base, consent: t - H }, t).consent_new, true);
});

// Positions drift: the own clock admits a read only with at most 2 in the trailing 24 h, so after a forced read the next
// own read can wait 14 h (forced at f, own at f + 7 and f + 14 fill the window; the next forced read comes at f + 24 or 25).
// A few minutes of round jitter put the gap just past 14 h, so it is bounded here by 14 h plus the jitter.
test('steady hourly rounds for 30 days: ≤ 1 activities read and ≤ 4 positions reads in any 24 h; activities every 24–25 h, positions at most 14 h (plus the round jitter) apart', () => {
  for (const lag of [0, 1, 3]) {
    const s: State = { readAt: null, attemptedAt: null, posReads: [], consent: -H };
    const log = newLog();
    const r = rng(7 + lag);
    for (let k = 0; k < 30 * 24; k++) round(s, k * H + Math.floor(r() * 4), 'ok', log, lag); // a few minutes of jitter a round
    assert.equal(maxIn(log.act, ACT), 1, `lag ${lag}`);
    assert.ok(maxIn(log.pos, ACT) <= POSITIONS_PER_DAY, `lag ${lag}`);
    assert.ok(maxGap(log.act, 0, 30 * 24 * H) <= 26 * H, `lag ${lag}: activities gap ${maxGap(log.act, 0, 30 * 24 * H) / H} h`);
    // A mark lag of minutes (a long sync) shifts the own clock by a round: then gaps reach 17 h (traced: forced 540.05 h,
    // own 557.00 h with lag 3). Bounded at 18 h; the 14 h bound holds for lags of a minute or less.
    assert.ok(maxGap(log.pos, 0, 30 * 24 * H) <= (lag <= 1 ? 14 * H + 4 : 18 * H), `lag ${lag}: positions gap ${maxGap(log.pos, 0, 30 * 24 * H) / H} h`);
    assert.deepEqual(log.deferred, []);
    assert.ok(log.act.length >= 28, `lag ${lag}: ${log.act.length} activities reads in 30 days`);
  }
});

test('round 2 counterexample: positions at 0, 6, 12 and 18 then a forced read at 20–22 would be 5; the own clock refuses 18 (3 already in the window)', () => {
  const s: State = { readAt: -5 * H, attemptedAt: -5 * H, posReads: [0, 6 * H, 12 * H], consent: -100 * H };
  const f = flagsAt(s, 18 * H);
  assert.equal(f.positions_24h, 3);
  assert.equal(f.positions_own, false);
  assert.deepEqual(decide(f), { activities: false, positions: false, deferred: false });
  // A forced read at 21 h (activities committed 24 h before) still has a slot: 3 + 1 = 4.
  const s2: State = { ...s, readAt: -3 * H - 1, attemptedAt: -3 * H - 1 };
  const g = flagsAt(s2, 21 * H);
  assert.equal(g.activities_due, true);
  assert.deepEqual(decide(g), { activities: true, positions: true, deferred: false });
});

test('round 3 counterexample (engineer): with rollbacks, forced at 0, 7, 13 and own at 6 → the forced read at 19 has no slot: activities deferred, neither read', () => {
  const s: State = { readAt: -30 * H, attemptedAt: 13 * H, posReads: [0, 6 * H, 7 * H, 13 * H], consent: -100 * H };
  const f = flagsAt(s, 19 * H);
  assert.equal(f.activities_due, true);
  assert.equal(f.positions_24h, 4);
  assert.deepEqual(decide(f), { activities: false, positions: false, deferred: true });
  // Once the read at 0 leaves the window, both are read together.
  assert.deepEqual(decide(flagsAt(s, 24 * H + 1)), { activities: true, positions: true, deferred: false });
});

test('business lead (round 3): a consent read can fill the window; then activities wait with positions, never read alone', () => {
  // Own reads at 0 and 6, a consent read at 8 (outside the cap, recorded), an own read... the window holds 4 at 20.
  const s: State = { readAt: 8 * H, attemptedAt: 8 * H + 1, posReads: [0, 6 * H, 8 * H + 1, 14 * H + 1], consent: 8 * H - 30 };
  // A second reconnect at 19 makes the committed read pre-consent: read at once (exempt), even with a full window.
  assert.deepEqual(decide(flagsAt({ ...s, consent: 19 * H }, 20 * H)), { activities: true, positions: true, deferred: false });
  // Activities due by their clock (a rollback left readAt old) with the window full: neither.
  const rolled: State = { ...s, readAt: -20 * H, attemptedAt: 8 * H + 1 };
  const f = flagsAt(rolled, 20 * H);
  assert.equal(f.activities_due, true);
  assert.equal(f.positions_24h, 4);
  assert.deepEqual(decide(f), { activities: false, positions: false, deferred: true });
});

test('a rebuild that always fails: at most 4 activities reads in any 24 h (the 6 h floor), from a never-read account too', () => {
  for (const readAt of [null, -40 * H]) {
    const s: State = { readAt, attemptedAt: null, posReads: [], consent: -H };
    const log = newLog();
    for (let k = 0; k < 72; k++) round(s, k * H, 'rebuild', log);
    assert.ok(maxIn(log.act, ACT) <= 4, `readAt ${readAt}: ${maxIn(log.act, ACT)} activities reads in 24 h (${log.act.map((x) => x / H)})`);
    assert.ok(log.act.length >= 72 / 7, `readAt ${readAt}: still retried (${log.act.length})`);
    assert.ok(maxIn(log.pos, ACT) <= POSITIONS_PER_DAY);
  }
});

test('a reconnect whose first sync keeps rolling back: read at once, then the 6 h floor (the exemption is one read per consent)', () => {
  const s: State = { readAt: 0, attemptedAt: 1, posReads: [1], consent: -H };
  const log = newLog();
  s.consent = 3 * H;
  for (let k = 3; k < 30; k++) round(s, k * H + 5, 'rebuild', log);
  assert.equal(log.act[0], 3 * H + 5);
  assert.ok(maxIn(log.act, ACT) <= 4, `${log.act.map((x) => x / H)}`);
});

test('random rounds (rollbacks, missed rounds, reconnects, jitter): positions ≤ 4 + consents in any 24 h; activities ≤ 1 in a 24 h window with no rollback or consent, ≤ 4 + consents always; deferrals only after a rollback or consent', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const r = rng(seed);
    const s: State = { readAt: null, attemptedAt: null, posReads: [], consent: -H };
    const log = newLog();
    const consents: number[] = [];
    const hours = 24 * 20;
    for (let k = 0; k < hours; k++) {
      if (r() < 0.04) continue; // a missed round
      const t = k * H + Math.floor(r() * 10);
      if (r() < 0.01) { s.consent = t - 1; consents.push(t - 1); }
      const x = r();
      const outcome: Outcome = x < 0.05 ? 'rebuild' : x < 0.08 ? 'positions' : x < 0.1 ? 'late' : 'ok';
      round(s, t, outcome, log, 1 + Math.floor(r() * 2));
    }
    const inWin = (xs: number[], a: number) => xs.filter((y) => y >= a && y < a + ACT).length;
    for (const a of [...log.act, ...log.pos, ...log.posFailed]) {
      const c = consents.filter((y) => y >= a - SLACK && y < a + ACT).length;
      assert.ok(inWin(log.pos, a) <= POSITIONS_PER_DAY + c, `seed ${seed} at ${a / H} h: ${inWin(log.pos, a)} positions reads`);
      assert.ok(inWin(log.act, a) <= 4 + c, `seed ${seed} at ${a / H} h`);
      if (!inWin(log.rollbacks, a) && !c) assert.ok(inWin(log.act, a) <= 1, `seed ${seed} at ${a / H} h: ${inWin(log.act, a)} activities reads with no rollback`);
    }
    for (const d of log.deferred) {
      const cause = log.rollbacks.some((y) => y > d - ACT && y < d) || consents.some((y) => y > d - ACT && y < d);
      assert.ok(cause, `seed ${seed}: deferred at ${d / H} h with no rollback or consent in the 24 h before`);
    }
    assert.ok(maxGap(log.act, 0, hours * H) <= 50 * H, `seed ${seed}: activities gap ${maxGap(log.act, 0, hours * H) / H} h`);
  }
});
