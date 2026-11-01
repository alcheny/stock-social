// The token budget governor (scripts/token-budget.ts, spec docs/token-budget.md): running sessions keep a reserve so
// they finish before the cap, queued work is admitted under the one rule, and no input ever makes it throw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, remainingCost, estimateCap, windowSpend, DEFAULT_PRIORS, DEFAULT_CONFIG, type Plan } from './token-budget.ts';

const H = 3_600_000;
const NOW = Date.parse('2026-11-01T08:55:00Z');
const RESET = Date.parse('2026-11-01T15:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
const ago = (hours: number) => iso(NOW - hours * H);
const codes = (p: Plan) => p.issues.map((i) => i.code);
const near = (a: number, b: number, tol = 0.011) => Math.abs(a - b) <= tol;

// A minimal valid snapshot; `over` replaces top-level fields.
function snap(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    now: iso(NOW),
    window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed', isUsingOverage: false },
    config: { capUsd: 1000 },
    sessions: [],
    queue: [],
    history: [],
    ...over,
  };
}
const build = (id: string, costUsd: unknown, hoursAgo: number, extra: Record<string, unknown> = {}) =>
  ({ id, kind: 'build', costUsd, startedAt: ago(hoursAgo), lastActiveAt: ago(0.02), ...extra });

// The 2026-11-01 calibration data, state at about 08:55 UTC (sessions' cost_usd so far).
function nov1(config: Record<string, unknown> = {}): Record<string, unknown> {
  const done = (id: string, kind: string, cost: number, start: string, end: string, phase?: string) =>
    ({ id, kind, phase, costUsd: cost, startedAt: start, lastActiveAt: end, done: true });
  const run = (id: string, kind: string, cost: number, start: string, extra: Record<string, unknown> = {}) =>
    ({ id, kind, costUsd: cost, startedAt: start, lastActiveAt: '2026-11-01T08:54:00Z', done: false, ...extra });
  return {
    now: '2026-11-01T08:55:00Z',
    window: { type: 'seven_day', resetsAt: 1793545200, status: 'allowed', isUsingOverage: false },
    config,
    sessions: [
      done('ci-speed', 'build', 8.70, '2026-10-31T20:00:00Z', '2026-10-31T21:30:00Z', 'small'),
      done('idea-board-council', 'council', 32.77, '2026-10-31T18:00:00Z', '2026-10-31T21:40:00Z'),
      done('f6-build', 'build', 28.00, '2026-10-31T22:00:00Z', '2026-11-01T02:30:00Z'),
      done('privacy-build', 'build', 20.78, '2026-10-31T23:00:00Z', '2026-11-01T03:10:00Z'),
      done('creative-council', 'council', 31.36, '2026-11-01T00:00:00Z', '2026-11-01T03:30:00Z'),
      done('design-council', 'council', 40.90, '2026-11-01T00:30:00Z', '2026-11-01T04:40:00Z'),
      run('f2-build', 'build', 31.05, '2026-11-01T04:40:00Z', { priority: 5 }),
      run('f3-build', 'build', 38.17, '2026-11-01T05:10:00Z', { priority: 5, phase: 'fixing',
        recent: { costUsd: 33.0, at: '2026-11-01T08:24:00Z' } }),
      run('f4-build', 'build', 22.34, '2026-11-01T05:40:00Z', { priority: 5 }),
      run('sharded-sync-build', 'build', 16.09, '2026-11-01T06:00:00Z', { priority: 3 }),
      run('security-build', 'build', 33.11, '2026-11-01T04:10:00Z', { priority: 4 }),
      run('publish-isolation-build', 'build', 14.01, '2026-11-01T06:20:00Z', { priority: 3 }),
      run('splits-build', 'build', 15.78, '2026-11-01T06:10:00Z', { priority: 2 }),
      run('market-council', 'council', 48.31, '2026-11-01T03:40:00Z', { phase: 'fixing', priority: 2 }),
      run('approval-council', 'council', 3.16, '2026-11-01T08:50:00Z', { priority: 1 }),
      run('council-x', 'council', 0.30, '2026-11-01T08:45:00Z'),
      run('council-y', 'council', 0.20, '2026-11-01T08:48:00Z'),
      run('council-z', 'council', 0.05, '2026-11-01T08:54:00Z'),
      run('build-p', 'build', 0.25, '2026-11-01T08:47:00Z'),
      run('build-q', 'build', 0.02, '2026-11-01T08:54:00Z'),
      run('orchestrator', 'orchestrator', 208, '2026-10-25T09:00:00Z', { priority: 10 }),
    ],
    queue: [
      { id: 'f5-build', kind: 'build', priority: 4 },
      { id: 'f7-build', kind: 'build', priority: 4 },
      { id: 'review-f2', kind: 'review', priority: 5, estimateUsd: 4 },
      { id: 'ops-council', kind: 'council', priority: 3 },
      { id: 'f8-build', kind: 'build', priority: 1 },
    ],
    // Window spend readings consistent with the sessions above (each session's cost spread evenly over its active
    // span): about $62/hour over the last hour.
    history: [
      { at: '2026-11-01T06:00:00Z', totalCostUsd: 414.45, status: 'allowed' },
      { at: '2026-11-01T07:55:00Z', totalCostUsd: 524.20, status: 'allowed' },
      { at: '2026-11-01T08:25:00Z', totalCostUsd: 553.56, status: 'allowed' },
    ],
  };
}


// --- 1. Remaining cost (low / point / high) -----------------------------------------------------------------------

const sess = (kind: string, cost: number, startedH: number, activeH = 0, extra: Record<string, unknown> = {}) =>
  ({ kind, costUsd: cost, startedAtMs: NOW - startedH * H, lastActiveAtMs: NOW - activeH * H, ...extra });
const range = (r: { low: number; point: number; high: number }) => [r.low, r.point, r.high].map((x) => Math.round(x * 1e6) / 1e6);

test('remaining cost: prior − spent dominates for a young session; high is widened by safety', () => {
  const r = remainingCost(sess('build', 2, 0.5), NOW, RESET); // burn $4/h × 4.5h = 18
  assert.equal(r.basis, 'prior');
  assert.deepEqual(range(r.remaining), [18, 38, 53 * 1.5]);
  assert.deepEqual(r.priorUsd, { low: 20, point: 40, high: 55 });
});

test('remaining cost: burn × remaining hours dominates when burning fast', () => {
  const r = remainingCost(sess('build', 40, 1), NOW, RESET); // $40/h, 4 typical hours left
  assert.equal(r.basis, 'burn');
  assert.ok(near(r.burnUsdPerHour, 40, 1e-9));
  assert.ok(near(r.remainingHours, 4, 1e-9));
  assert.deepEqual(range(r.remaining), [160, 160, 240]);
});

test('remaining cost: a session over its prior keeps its burn over the tail, never 0', () => {
  const r = remainingCost(sess('build', 60, 6), NOW, RESET); // $10/h, past typical → tail 1h
  assert.equal(r.basis, 'burn');
  assert.ok(near(r.remainingHours, 1, 1e-9));
  assert.deepEqual(range(r.remaining), [10, 10, 15]);
});

test('remaining cost: the floor applies when prior and burn are both small', () => {
  const slow = remainingCost(sess('build', 60, 100), NOW, RESET); // $0.60/h × 1h tail
  assert.equal(slow.basis, 'floor');
  assert.deepEqual(range(slow.remaining), [4, 4, 6]);
  const review = remainingCost(sess('review', 3.9, 2), NOW, RESET);
  assert.equal(review.basis, 'floor');
  assert.deepEqual(range(review.remaining), [1, 1, 1.5]);
});

test('remaining cost: a kind:phase prior overrides the kind, and config priors override both', () => {
  const small = remainingCost(sess('build', 1, 0.1, 0, { phase: 'small' }), NOW, RESET); // 6 minutes old: no burn term yet
  assert.deepEqual(small.priorUsd, { low: 5, point: 9, high: 12 });
  assert.deepEqual(range(small.remaining), [4, 8, 16.5]);
  const p = plan(snap({
    config: { capUsd: 1000, priors: { 'council:fixing': 80, review: { low: 5, point: 6, high: 7 } } },
    sessions: [{ id: 'c', kind: 'council', phase: 'fixing', costUsd: 50, startedAt: ago(10), lastActiveAt: iso(NOW) }],
    queue: [{ id: 'r', kind: 'review' }],
  }));
  const c = p.reserve.sessions[0];
  assert.deepEqual(c.priorUsd, { low: 80, point: 80, high: 80 });
  assert.equal(c.basis, 'prior');
  assert.deepEqual([c.remaining.low, c.remaining.point, c.remaining.high], [30, 30, 45]);
  assert.deepEqual(p.admit[0].estimate, { low: 5, point: 6, high: 7 });
});

test('remaining cost: the orchestrator has no prior and runs until reset', () => {
  const r = remainingCost(sess('orchestrator', 30, 24), NOW, NOW + 10 * H); // $1.25/h
  assert.equal(r.priorUsd, null);
  assert.ok(near(r.remainingHours, 10, 1e-9));
  assert.deepEqual(range(r.remaining), [12.5, 12.5, 18.75]);
  assert.equal(r.basis, 'burn');
  assert.equal(DEFAULT_PRIORS.orchestrator.point, null);
});

test('remaining cost: a recent reading at least 5 minutes old gives the burn; a fresher one is ignored', () => {
  const recent = remainingCost(sess('build', 38, 3.75, 0, { recent: { costUsd: 33, atMs: NOW - 0.5 * H } }), NOW, RESET);
  assert.ok(near(recent.burnUsdPerHour, 10, 1e-9));
  const fresh = remainingCost(sess('build', 38, 4, 0, { recent: { costUsd: 37, atMs: NOW - 2 * 60_000 } }), NOW, RESET);
  assert.ok(near(fresh.burnUsdPerHour, 9.5, 1e-9)); // lifetime: $38 over 4 active hours
  const young = remainingCost(sess('build', 1, 0.05), NOW, RESET); // active 3 minutes: averaged over at least 15
  assert.ok(near(young.burnUsdPerHour, 4, 1e-9));
});

// --- Spend in window --------------------------------------------------------------------------------------------

test('window spend: sessions started in the window count in full; earlier ones pro rata over their active span', () => {
  const start = NOW - 100 * H;
  const s = [
    { costUsd: 10, startedAtMs: start + H, lastActiveAtMs: NOW },
    { costUsd: 100, startedAtMs: start - 10 * H, lastActiveAtMs: start + 10 * H }, // half inside
    { costUsd: 50, startedAtMs: start - 10 * H, lastActiveAtMs: start - H },       // ended before the window
  ];
  assert.ok(near(windowSpend(s, start), 60, 1e-9));
  assert.equal(windowSpend([], start), 0);
});

// --- 2. The one admission rule ----------------------------------------------------------------------------------

const used = (p: Plan) => p.spend.windowUsd + p.reserve.totalUsd + p.admit.reduce((s, a) => s + a.estimate.low, 0);

test('admission: spend + running point reserve + admitted low estimates never exceed cap high', () => {
  const p = plan(snap({
    config: { capUsd: 300 },
    sessions: [build('a', 4, 2), build('b', 2, 1)], // point remaining 36 + 38 = 74
    queue: [1, 2, 3, 4, 5, 6].map((i) => ({ id: `q${i}`, kind: 'build', estimateUsd: 40 })),
  }));
  assert.ok(near(p.reserve.totalUsd, 74));
  assert.ok(near(p.capacity.headroomUsd!, 300 - 6 - 74));
  assert.equal(p.admit.length, 5); // 5 × 40 = 200 ≤ 220
  assert.equal(p.queued[0].id, 'q6');
  assert.ok(used(p) <= 300 + 0.011);
});

test('admission: an uncertain item (fits with its low estimate, not its high one) is admitted', () => {
  const p = plan(snap({ config: { capUsd: 100 }, queue: [{ id: 'q', kind: 'build', estimateLowUsd: 80, estimateUsd: 100, estimateHighUsd: 130 }] }));
  assert.deepEqual(p.admit.map((a) => a.id), ['q']);
  assert.deepEqual(p.admit[0].estimate, { low: 80, point: 100, high: 130 });
  assert.equal(p.projection.overshoot.risk, 'possible');
  assert.equal(p.projection.overshoot.worstCaseSpendUsd, 130);
  assert.equal(p.projection.overshoot.vsCapLowUsd, 30);
});

test('admission: an item over 100% even with its low estimate is queued and the reason says so', () => {
  const p = plan(snap({ config: { capUsd: 100 }, queue: [{ id: 'q', kind: 'build', estimateLowUsd: 110, estimateUsd: 120 }] }));
  assert.equal(p.admit.length, 0);
  assert.match(p.queued[0].reason, /low estimate/);
  assert.match(p.queued[0].reason, /100%/);
  assert.equal(p.queued[0].nextAdmitAt, p.window.resetsAt);
});

test('admission: overshoot risk is none, possible or likely', () => {
  const risk = (est: Record<string, number>) => plan(snap({ config: { capUsd: 100 }, queue: [{ id: 'q', kind: 'build', ...est }] })).projection.overshoot.risk;
  assert.equal(risk({ estimateUsd: 50 }), 'none');
  assert.equal(risk({ estimateLowUsd: 60, estimateUsd: 90, estimateHighUsd: 150 }), 'possible');
  assert.equal(risk({ estimateLowUsd: 60, estimateUsd: 120, estimateHighUsd: 150 }), 'likely');
  assert.equal(plan(snap({ config: {} })).projection.overshoot.risk, 'unknown');
});

test('admission: a single estimate is used for low, point and high; the kind prior range otherwise; safety is not in the check', () => {
  const p = plan(snap({ config: { capUsd: 100, safety: 3 }, queue: [{ id: 'a', kind: 'review', priority: 2, estimateUsd: 70 }, { id: 'b', kind: 'build', priority: 1 }] }));
  assert.deepEqual(p.admit.map((a) => [a.id, a.estimate]), [['a', { low: 70, point: 70, high: 70 }], ['b', { low: 20, point: 40, high: 55 }]]);
});

test('admission: with a known cap it fills to cap high within one item\'s low estimate and never beyond', () => {
  for (const cap of [137, 400, 999.99, 1500]) {
    const p = plan(snap({
      config: { capUsd: cap },
      sessions: [build('a', 12, 3), build('b', 30, 2)],
      queue: Array.from({ length: 300 }, (_, i) => ({ id: `q${String(i).padStart(3, '0')}`, kind: 'review', estimateLowUsd: 5, estimateUsd: 7 })),
    }));
    assert.ok(used(p) <= cap + 0.011, `cap ${cap}: used ${used(p)}`);
    if (p.queued.length) assert.ok(used(p) > cap - 5 - 0.011, `cap ${cap}: stopped early at ${used(p)}`);
  }
});

test('no rate limit: the default config has no rate or concurrency knob, and 500 queued items are admitted', () => {
  assert.doesNotMatch(Object.keys(DEFAULT_CONFIG).join(' '), /rate|hour|concurren|parallel|pace|max|limit/i);
  const queue = Array.from({ length: 500 }, (_, i) => ({ id: `q${i}`, kind: 'build' }));
  const unknown = plan(snap({ config: {}, queue }));
  assert.equal(unknown.cap.high, null);
  assert.equal(unknown.admit.length, 500);
  assert.equal(plan(snap({ config: { capUsd: 10_000 }, queue })).admit.length, 500); // 500 × low $20
  const known = plan(snap({ config: { capUsd: 5_000 }, queue }));
  assert.equal(known.admit.length, 250); // everything that fits
  assert.equal(known.queued.length, 250);
});

// --- 3. Cap ---------------------------------------------------------------------------------------------------

test('cap: config gives low = point = high', () => {
  const p = plan(snap({ config: { capUsd: 1234 } }));
  assert.deepEqual([p.cap.low, p.cap.point, p.cap.high, p.cap.source, p.cap.known], [1234, 1234, 1234, 'config', true]);
});

test('cap: calibrated from the first allowed_warning (high W / warnFraction, low from the allowed reading before it); warning is not a brake', () => {
  const p = plan(snap({
    config: {},
    window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed_warning', isUsingOverage: false },
    sessions: [build('a', 700, 4, { done: true })],
    queue: [{ id: 'q', kind: 'review' }],
    history: [
      { at: ago(3), totalCostUsd: 300, status: 'allowed' },
      { at: ago(2), totalCostUsd: 500, status: 'allowed' },
      { at: ago(1), totalCostUsd: 600, status: 'allowed_warning' },
      { at: ago(0.5), totalCostUsd: 650, status: 'allowed_warning' },
    ],
  }));
  assert.equal(p.cap.source, 'calibrated');
  assert.ok(near(p.cap.high!, 800) && near(p.cap.point!, 733.33) && near(p.cap.low!, 666.67)); // point: the midpoint
  assert.equal(p.cap.calibratedFrom?.spendUsd, 600);
  assert.equal(p.brake, 'none');
  assert.equal(p.warning, true);
  assert.deepEqual(p.admit.map((a) => a.id), ['q']);
});

test('cap: a warning with no allowed reading before it gives low = W; the snapshot itself counts as a reading', () => {
  const r = estimateCap([{ atMs: NOW, totalCostUsd: 450, status: 'allowed_warning', resetsAtMs: RESET }], { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.deepEqual([r.low, r.point, r.high, r.source, r.known], [450, 525, 600, 'calibrated', true]);
});

test('cap: a calibration carries over to the next window after rollover, and spend restarts', () => {
  const week = 7 * 24 * H;
  const p = plan(snap({
    now: iso(RESET + H),
    config: {},
    window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'rejected', isUsingOverage: true },
    sessions: [build('old', 900, 30, { done: true, startedAt: iso(RESET - 30 * H), lastActiveAt: iso(RESET - 20 * H) })],
    queue: [{ id: 'q', kind: 'build' }],
    history: [{ at: iso(RESET - 10 * H), totalCostUsd: 900, status: 'allowed_warning', resetsAt: RESET / 1000 }],
  }));
  assert.equal(p.window.rolledOver, true);
  assert.equal(p.window.resetsAt, iso(RESET + week));
  assert.equal(p.spend.windowUsd, 0);
  assert.deepEqual([p.cap.source, p.cap.low, p.cap.high], ['calibrated', 900, 1200]);
  assert.equal(p.brake, 'none'); // the stale rejected/overage is ignored
  assert.ok(codes(p).includes('stale-status'));
  assert.deepEqual(p.admit.map((a) => a.id), ['q']);
});

test('cap: a rejected reading at spend R lowers low and high to at most R', () => {
  const readings = [
    { atMs: NOW - 4 * H, totalCostUsd: 450, status: 'allowed', resetsAtMs: RESET },
    { atMs: NOW - 3 * H, totalCostUsd: 600, status: 'allowed_warning', resetsAtMs: RESET },
    { atMs: NOW - H, totalCostUsd: 700, status: 'rejected', resetsAtMs: RESET },
  ];
  const r = estimateCap(readings, { warnFraction: 0.75, currentResetsAtMs: RESET }); // 600/0.75 = 800 > 700; low 450/0.75 = 600
  assert.deepEqual([r.low, r.point, r.high, r.source], [600, 650, 700, 'calibrated']);
  const onlyRejected = estimateCap(readings.slice(2), { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.deepEqual([onlyRejected.low, onlyRejected.high, onlyRejected.source], [700, 700, 'calibrated']);
});

test('cap: unknown → null values, lowerBoundUsd is information only, and everything is admitted while allowed', () => {
  const p = plan(snap({
    config: {},
    sessions: [build('a', 300, 4)],
    queue: [{ id: 'big', kind: 'build', estimateUsd: 5000 }, { id: 'small', kind: 'review' }],
    history: [{ at: ago(1), totalCostUsd: 150, status: 'allowed' }],
  }));
  assert.deepEqual([p.cap.low, p.cap.point, p.cap.high, p.cap.source, p.cap.known], [null, null, null, 'unknown', false]);
  assert.ok(near(p.cap.lowerBoundUsd, 400)); // the snapshot itself: allowed at $300 → above 300 / 0.75
  assert.equal(p.capacity.headroomUsd, null);
  assert.deepEqual(p.admit.map((a) => a.id).sort(), ['big', 'small']);
  assert.equal(p.projection.runningFits, null);
  assert.equal(p.projection.timeToCapHours, null);
});

// --- 4. Brakes -------------------------------------------------------------------------------------------------

const braked = (status: unknown, overage = false) => plan(snap({
  window: { type: 'seven_day', resetsAt: RESET / 1000, status, isUsingOverage: overage },
  sessions: [
    build('hi', 10, 2, { priority: 5 }),
    build('lo-far', 40, 3, { priority: 1 }),
    build('lo-near', 5, 1, { priority: 1 }),
    { id: 'orch', kind: 'orchestrator', costUsd: 100, startedAt: ago(48), lastActiveAt: iso(NOW), priority: 0 },
  ],
  queue: [{ id: 'q', kind: 'review' }],
}));

test('brakes: rejected and overage admit nothing, flag stall risk and pause lowest priority, least progress first', () => {
  for (const p of [braked('rejected'), braked('allowed', true)]) {
    assert.equal(p.admit.length, 0);
    assert.equal(p.queued[0].nextAdmitAt, p.window.resetsAt);
    assert.equal(p.pause.stallRisk, true);
    assert.deepEqual(p.pause.recommend, ['lo-near', 'lo-far', 'hi']); // the orchestrator is never recommended
    assert.match(p.summary, /nothing/);
    assert.equal(p.fill.recommendAdmitUsd, 0);
  }
  assert.equal(braked('rejected').brake, 'rejected');
  assert.equal(braked('allowed', true).brake, 'overage');
});

test('brakes: a missing or unrecognised status is a brake; allowed_warning is not', () => {
  for (const s of [undefined, 'junk', 42]) {
    const p = braked(s);
    assert.equal(p.brake, 'unknown-status');
    assert.equal(p.admit.length, 0);
    assert.ok(codes(p).includes('bad-status'));
    assert.match(p.summary, /nothing/);
  }
  const w = braked('allowed_warning');
  assert.equal(w.brake, 'none');
  assert.equal(w.warning, true);
  assert.equal(w.admit.length, 1);
  assert.equal(braked('allowed').pause.stallRisk, false);
});

// --- 5. Queue ---------------------------------------------------------------------------------------------------

test('queue: priority order then id, with a strict stop at the first misfit', () => {
  const p = plan(snap({
    config: { capUsd: 100 },
    queue: [
      { id: 'small-lo', kind: 'review', priority: 1, estimateUsd: 5 },
      { id: 'big', kind: 'build', priority: 3, estimateUsd: 120 },
      { id: 'b-mid', kind: 'build', priority: 2, estimateUsd: 30 },
      { id: 'a-mid', kind: 'build', priority: 2, estimateUsd: 30 },
      { id: 'top', kind: 'review', priority: 9, estimateUsd: 10 },
    ],
  }));
  assert.deepEqual(p.admit.map((a) => a.id), ['top']);
  assert.deepEqual(p.queued.map((q) => q.id), ['big', 'a-mid', 'b-mid', 'small-lo']);
  assert.match(p.queued[0].reason, /low estimate/);
  assert.match(p.queued[1].reason, /big/);
});

test('queue: a finish frees nothing under the point projection, so a misfit waits for resetsAt', () => {
  const p = plan(snap({ config: { capUsd: 100 }, sessions: [build('r', 10, 1)], queue: [{ id: 'q', kind: 'review', estimateUsd: 80 }] }));
  assert.equal(p.admit.length, 0);
  assert.equal(p.queued[0].nextAdmitAt, p.window.resetsAt);
});

test('queue: rollover when now ≥ resetsAt resets spend, ignores the stale status and admits', () => {
  const p = plan(snap({
    now: iso(RESET + 5 * 60_000),
    config: { capUsd: 100 },
    window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'rejected', isUsingOverage: false },
    sessions: [build('old', 95, 5, { done: true, startedAt: iso(RESET - 5 * H), lastActiveAt: iso(RESET - H) })],
    queue: [{ id: 'q', kind: 'build', estimateUsd: 50 }],
  }));
  assert.equal(p.window.rolledOver, true);
  assert.equal(p.spend.windowUsd, 0);
  assert.equal(p.brake, 'none');
  assert.deepEqual(p.admit.map((a) => a.id), ['q']);
  assert.equal(p.historyEntry.status, null);
});

// --- 6. Projection ----------------------------------------------------------------------------------------------

test('projection: burn from the history slope, else the sessions; time to cap and whether running work fits', () => {
  const sessions = [build('a', 100, 2, { lastActiveAt: iso(NOW) })]; // $50/h lifetime, 3 typical hours left → point remaining 150, high 225
  const hist = plan(snap({ config: { capUsd: 300 }, sessions, history: [{ at: ago(1.5), totalCostUsd: 40, status: 'allowed' }, { at: ago(5), totalCostUsd: 0, status: 'allowed' }] }));
  assert.equal(hist.projection.burnSource, 'history');
  assert.ok(near(hist.projection.burnUsdPerHour, 40)); // (100 − 40) / 1.5h; the 5h-old reading is outside the 2 hours
  assert.ok(near(hist.projection.timeToCapHours!, 5));
  assert.equal(hist.projection.capHitAt, iso(NOW + 5 * H));
  assert.equal(hist.projection.capHitBeforeReset, true); // reset in ~6.08h
  const s = plan(snap({ config: { capUsd: 300 }, sessions, history: [{ at: ago(0.1), totalCostUsd: 95, status: 'allowed' }] }));
  assert.equal(s.projection.burnSource, 'sessions'); // the only reading is under 15 minutes old
  assert.ok(near(s.projection.burnUsdPerHour, 50));
  assert.ok(near(s.projection.timeToCapHours!, 4));
  assert.ok(near(s.projection.runningProjectedSpendUsd, 250, 2));
  assert.equal(s.projection.runningFits, true);
  assert.equal(s.projection.runningFitsWithSafety, false); // 100 + 225 > cap low 300
  const tight = plan(snap({ config: { capUsd: 200 }, sessions }));
  assert.equal(tight.projection.runningFits, false);
  assert.equal(tight.pause.stallRisk, true);
  const idle = plan(snap({ config: { capUsd: 300 } }));
  assert.equal(idle.projection.timeToCapHours, null);
  assert.equal(idle.projection.capHitBeforeReset, false);
});

// --- Fill: use the whole budget by reset ---------------------------------------------------------------------------

test('fill: spare budget and an empty queue → reports the unused budget and asks for more work', () => {
  const p = plan(snap({ config: { capUsd: 300 }, sessions: [build('a', 10, 1)] })); // 300 − 10 − 40 = 250 unused
  assert.ok(near(p.fill.expectedUnusedUsd!, 250, 1)); // the session was last active 1 minute ago: burn just over $10/h
  assert.equal(p.fill.recommendAdmitUsd, p.fill.expectedUnusedUsd);
  assert.equal('maxItemHours' in p.fill, false); // window.hoursToReset says it
  assert.deepEqual(p.fill.suggestedKinds, ['build', 'council', 'build:small', 'review']);
  assert.match(p.fill.message, /unused at reset/);
  assert.match(p.fill.message, /queue more work/);
  assert.match(p.summary, /unused/);
});

test('fill: admitted items count at their point estimate', () => {
  const p = plan(snap({ config: { capUsd: 300 }, queue: [{ id: 'q', kind: 'build', estimateLowUsd: 50, estimateUsd: 100 }] }));
  assert.ok(near(p.fill.expectedUnusedUsd!, 200));
});

test('fill: near the reset only short items are suggested', () => {
  const p = plan(snap({ now: iso(RESET - 3 * H), config: { capUsd: 300 } }));
  assert.deepEqual(p.fill.suggestedKinds, ['build:small', 'review']);
  assert.match(p.fill.message, /short/);
  const late = plan(snap({ now: iso(RESET - 0.2 * H), config: { capUsd: 300 } }));
  assert.deepEqual(late.fill.suggestedKinds, []);
  assert.match(late.fill.message, /none fits/);
});

test('fill: no spare budget → 0; cap unknown → null', () => {
  const full = plan(snap({ config: { capUsd: 30 }, sessions: [build('a', 10, 1)] }));
  assert.ok(full.fill.expectedUnusedUsd! <= 0);
  assert.equal(full.fill.recommendAdmitUsd, 0);
  assert.deepEqual(full.fill.suggestedKinds, []);
  const unknown = plan(snap({ config: {} }));
  assert.equal(unknown.fill.expectedUnusedUsd, null);
  assert.equal(unknown.fill.recommendAdmitUsd, 0);
  assert.match(unknown.fill.message, /unknown/);
});

// --- Robust input ----------------------------------------------------------------------------------------------

test('robust: missing fields (no config, queue, history, window; empty sessions) still give a plan', () => {
  const p = plan({ now: iso(NOW) });
  assert.equal(p.brake, 'unknown-status');
  assert.deepEqual([p.admit, p.queued, p.reserve.sessions], [[], [], []]);
  assert.ok(codes(p).includes('no-window'));
  const q = plan(snap({ config: undefined, queue: undefined, history: undefined, sessions: [] }));
  assert.equal(q.brake, 'none');
  assert.equal(q.cap.source, 'unknown');
  assert.equal(q.spend.windowUsd, 0);
});

test('robust: negative, NaN and string costs count as 0 and are reported', () => {
  const p = plan(snap({ sessions: [build('a', -5, 1), build('b', NaN, 1), build('c', '12', 1), build('d', 3, 1)] }));
  assert.equal(p.spend.windowUsd, 3);
  assert.equal(codes(p).filter((c) => c === 'bad-cost').length, 3);
});

test('robust: lastActiveAt in the future is clamped to now; before startedAt is reported; startedAt missing is now', () => {
  const fut = plan(snap({ sessions: [build('a', 10, 1, { lastActiveAt: iso(NOW + 5 * H) })] }));
  assert.ok(codes(fut).includes('future-time'));
  assert.ok(near(fut.reserve.sessions[0].burnUsdPerHour, 10)); // over 1 active hour, not 6
  const back = plan(snap({ sessions: [build('a', 10, 1, { lastActiveAt: ago(3) })] }));
  assert.ok(codes(back).includes('active-before-start'));
  const none = plan(snap({ sessions: [{ id: 'a', kind: 'build', costUsd: 10 }] }));
  assert.ok(codes(none).includes('no-start'));
  assert.equal(none.spend.windowUsd, 10);
});

test('robust: duplicate session ids keep the larger cost; duplicate queue ids keep the first', () => {
  const p = plan(snap({
    sessions: [build('a', 10, 1), build('a', 30, 2), build('a', 20, 1)],
    queue: [{ id: 'q', kind: 'review', estimateUsd: 2 }, { id: 'q', kind: 'build', estimateUsd: 40 }],
  }));
  assert.equal(p.reserve.sessions.length, 1);
  assert.equal(p.reserve.sessions[0].spentUsd, 30);
  assert.equal(p.spend.windowUsd, 30);
  assert.deepEqual(p.admit.map((a) => [a.id, a.estimate.point]), [['q', 2]]);
  assert.ok(codes(p).includes('duplicate-session'));
  assert.ok(codes(p).includes('duplicate-queue'));
});

test('robust: a queue id equal to a running session id is not admitted', () => {
  const p = plan(snap({ config: {}, sessions: [build('x', 10, 1)], queue: [{ id: 'x', kind: 'build' }, { id: 'y', kind: 'build' }] }));
  assert.deepEqual(p.admit.map((a) => a.id), ['y']);
  assert.equal(p.queued[0].id, 'x');
  assert.match(p.queued[0].reason, /running/);
  assert.ok(codes(p).includes('queue-running'));
  const done = plan(snap({ config: {}, sessions: [build('x', 10, 1, { done: true })], queue: [{ id: 'x', kind: 'build' }] }));
  assert.deepEqual(done.admit.map((a) => a.id), ['x']); // a re-run of a finished session is fine
});

test('robust: an unknown kind is treated as build and reported', () => {
  const p = plan(snap({ sessions: [{ ...build('a', 1, 0.5), kind: 'mystery' }], queue: [{ id: 'q', kind: 'weird' }] }));
  assert.equal(p.reserve.sessions[0].kind, 'build');
  assert.equal(p.reserve.sessions[0].priorUsd?.point, 40);
  assert.equal(p.admit[0].kind, 'build');
  assert.equal(p.admit[0].estimate.point, 40);
  assert.equal(codes(p).filter((c) => c === 'unknown-kind').length, 2);
});

test('robust: times as ISO, unix seconds or milliseconds give the same plan', () => {
  const at = (f: (ms: number) => unknown) => plan(snap({
    now: f(NOW), window: { type: 'seven_day', resetsAt: f(RESET), status: 'allowed' },
    sessions: [{ id: 'a', kind: 'build', costUsd: 10, startedAt: f(NOW - 2 * H), lastActiveAt: f(NOW) }],
  }));
  const a = at(iso), b = at((ms) => ms / 1000), c = at((ms) => ms);
  assert.deepEqual(b, a);
  assert.deepEqual(c, a);
  assert.equal(a.now, iso(NOW));
});

test('robust: out-of-range config values fall back to the defaults and are reported', () => {
  for (const config of [{ warnFraction: 1.5 }, { warnFraction: 0 }, { safety: 0.5 }, { safety: 'x' }, { capUsd: -3 }, { priors: { build: -1 } }, { priors: { build: { low: 'x' } } }]) {
    const p = plan(snap({ config, sessions: [build('a', 10, 1)] }));
    assert.ok(codes(p).includes('bad-config'), JSON.stringify(config));
    assert.equal(p.reserve.safety, 1.5);
    assert.deepEqual(p.reserve.sessions[0].priorUsd, { low: 20, point: 40, high: 55 });
  }
});

test('robust: an invalid now is an error issue and admits nothing', () => {
  for (const now of [undefined, 'yesterday', NaN]) {
    const p = plan(snap({ now, queue: [{ id: 'q', kind: 'review' }] }));
    assert.ok(p.issues.some((i) => i.code === 'bad-now' && i.level === 'error'));
    assert.equal(p.admit.length, 0);
  }
});

// --- 7. The 2026-11-01 data and the CLI ---------------------------------------------------------------------------

test('2026-11-01 data, cap $1500: spend about $590, burn about $62/h, admits under the rule and keeps the reserve', () => {
  const p = plan(nov1({ capUsd: 1500 }));
  assert.equal(p.brake, 'none');
  assert.ok(p.spend.windowUsd > 560 && p.spend.windowUsd < 620, `spend ${p.spend.windowUsd}`);
  assert.equal(p.projection.burnSource, 'history');
  assert.ok(p.projection.burnUsdPerHour > 55 && p.projection.burnUsdPerHour < 70, `burn ${p.projection.burnUsdPerHour}`);
  assert.ok(!codes(p).includes('burn-mismatch'));
  assert.equal(p.reserve.sessions.length, 15); // the 6 done sessions reserve nothing
  assert.ok(p.reserve.sessions.every((s) => s.remaining.point > 0));
  assert.equal(p.reserve.sessions.find((s) => s.id === 'orchestrator')?.basis, 'burn');
  assert.equal(p.admit[0].id, 'review-f2'); // highest priority first
  assert.ok(used(p) <= 1500 + 0.011);
  if (p.queued.length) assert.ok(used(p) + p.queued[0].estimate.low > 1500);
  assert.equal(p.projection.runningFits, true);
  assert.equal(p.issues.filter((i) => i.level === 'error').length, 0);
});

test('2026-11-01 data, cap unknown: everything queued is admitted while allowed; the lower bound is information', () => {
  const p = plan(nov1());
  assert.equal(p.cap.source, 'unknown');
  assert.equal(p.cap.high, null);
  assert.ok(near(p.cap.lowerBoundUsd, p.spend.windowUsd / 0.75, 0.02));
  assert.equal(p.admit.length, 5);
  assert.equal(p.queued.length, 0);
  assert.equal(p.brake, 'none');
  assert.equal(p.fill.expectedUnusedUsd, null);
});

const here = dirname(fileURLToPath(import.meta.url));
const cli = (args: string[], input?: string) => execFileSync(process.execPath, [join(here, 'token-budget.ts'), ...args], { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] });

test('CLI: plan <file> and plan - print the plan as JSON and exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'token-budget-'));
  const file = join(dir, 'snapshot.json');
  writeFileSync(file, JSON.stringify(nov1({ capUsd: 1500 })));
  const out = cli(['plan', file]);
  assert.deepEqual(JSON.parse(out), JSON.parse(JSON.stringify(plan(nov1({ capUsd: 1500 })))));
  assert.match(out, /^\{\n {2}"version": 1,/);
  assert.equal(JSON.parse(cli(['plan', '-'], JSON.stringify(nov1()))).cap.source, 'unknown');
});

test('CLI: exit 2 with a JSON error on an unreadable file, bad JSON or an invalid now', () => {
  const dir = mkdtempSync(join(tmpdir(), 'token-budget-'));
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, '{ not json');
  const noNow = join(dir, 'no-now.json');
  writeFileSync(noNow, JSON.stringify({ window: {} }));
  for (const f of [join(dir, 'missing.json'), bad, noNow]) {
    try {
      cli(['plan', f]);
      assert.fail(`exit 0 for ${f}`);
    } catch (e) {
      const err = e as { status: number; stdout: string };
      assert.equal(err.status, 2, f);
      const out = JSON.parse(err.stdout);
      assert.equal(typeof out.error, 'string');
      assert.ok(out.issues.some((i: { level: string }) => i.level === 'error'));
    }
  }
});

// --- 8. Properties over random snapshots --------------------------------------------------------------------------

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomSnapshot(rand: () => number) {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const now = NOW + Math.floor((rand() - 0.5) * 48 * H);
  // Mostly valid times in every format; now and then a nanosecond epoch or a time outside the Date range.
  const time = (ms: number) => (rand() < 0.02 ? pick([ms * 1e6, 1e17, -1e17, 8.64e15 + 1]) : pick([iso(ms), ms / 1000, ms, ms, iso(ms)])) as unknown;
  const resets = rand() < 0.2 ? now - rand() * 20 * 24 * H : now + rand() * 7 * 24 * H; // some already rolled over
  const money = () => pick([rand() * 80, rand() * 80, rand() * 5, 0, -3, NaN, '7', undefined, rand() * 400, 1e308, 1e-7, 2e12]) as unknown;
  const kinds = ['build', 'council', 'review', 'orchestrator', 'build', 'mystery', '__proto__', 'constructor'];
  const ids = [...Array.from({ length: 10 }, (_, i) => `s${i}`), 'constructor', '__proto__'];
  const sessions = Array.from({ length: Math.floor(rand() * 14) }, () => {
    const started = now - rand() * 200 * H;
    return {
      id: pick(ids), kind: pick(kinds), phase: pick([undefined, 'fixing', 'small']), priority: pick([0, 1, 5, -2, 'x', undefined]),
      costUsd: money(), done: rand() < 0.3,
      startedAt: rand() < 0.05 ? undefined : time(started),
      lastActiveAt: rand() < 0.1 ? time(now + rand() * 5 * H) : rand() < 0.1 ? time(started - H) : time(started + rand() * (now - started)),
      recent: rand() < 0.3 ? { costUsd: money(), at: time(now - rand() * 2 * H) } : undefined,
    };
  });
  const queue = Array.from({ length: Math.floor(rand() * 12) }, () => ({
    id: pick([...ids.slice(0, 4), 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'toString', '__proto__']), kind: pick(kinds), priority: pick([0, 1, 3, 9, undefined]),
    estimateUsd: pick([undefined, undefined, rand() * 100, NaN, -1, 4]),
    estimateLowUsd: pick([undefined, undefined, rand() * 50, 'x']),
    estimateHighUsd: pick([undefined, undefined, rand() * 200]),
  }));
  const history = Array.from({ length: rand() < 0.01 ? 3000 : Math.floor(rand() * 6) }, () => ({
    at: time(now - rand() * 20 * 24 * H), totalCostUsd: money(),
    status: pick(['allowed', 'allowed', 'allowed_warning', 'rejected', 'junk', undefined]),
    resetsAt: rand() < 0.3 ? time(resets) : undefined,
  }));
  const config: Record<string, unknown> = {};
  if (rand() < 0.4) config.capUsd = pick([rand() * 2000, 1500, -5, NaN]);
  if (rand() < 0.3) config.warnFraction = pick([0.5, 0.75, 0.9, 2, 0, 1e-320]);
  if (rand() < 0.3) config.safety = pick([1, 1.5, 2, 0.3, NaN, 1e308]);
  if (rand() < 0.2) config.priors = { build: pick([30, 80, -1, { low: 10, point: 5, high: 60 }, { typicalHours: 1e308 }]), 'council:fixing': 60 };
  return {
    now: rand() < 0.02 ? 'garbage' : time(now),
    window: rand() < 0.05 ? undefined : {
      [rand() < 0.2 ? 'rateLimitType' : 'type']: pick(['seven_day', 'seven_day', 'five_hour', 'monthly', 'constructor', '__proto__', 'toString']),
      resetsAt: rand() < 0.03 ? time(now + 30 * 24 * H) : time(resets),
      status: pick(['allowed', 'allowed', 'allowed', 'allowed_warning', 'rejected', 'junk', undefined]), isUsingOverage: rand() < 0.15,
    },
    config: rand() < 0.1 ? undefined : config, sessions, queue, history,
  };
}

test('properties: 1,500 random snapshots keep every invariant', () => {
  const rand = mulberry32(20261101);
  for (let n = 0; n < 1500; n++) {
    const s = randomSnapshot(rand);
    const ctx = `snapshot ${n}: ${JSON.stringify(s)}`;
    let p: Plan;
    assert.doesNotThrow(() => { p = plan(s); }, ctx);
    p = p!;
    assert.deepEqual(plan(structuredClone(s)), p, ctx); // deterministic and does not mutate its input

    if (p.brake !== 'none') assert.equal(p.admit.length, 0, ctx);
    if (p.cap.known) {
      assert.ok(near(p.capacity.headroomUsd!, p.cap.high! - p.spend.windowUsd - p.reserve.totalUsd, 0.02), ctx);
      if (p.admit.length) assert.ok(used(p) <= p.cap.high! + 0.011 * (p.admit.length + 2), ctx);
      assert.ok(p.cap.low! <= p.cap.point! && p.cap.point! <= p.cap.high!, ctx);
    }
    for (const r of p.reserve.sessions) {
      assert.ok(r.remaining.low > 0 && r.remaining.low <= r.remaining.point && r.remaining.point <= r.remaining.high, ctx);
    }
    for (const a of [...p.admit, ...p.queued]) assert.ok(a.estimate.low <= a.estimate.point && a.estimate.point <= a.estimate.high, ctx);
    if (p.brake !== 'none') assert.equal(p.fill.recommendAdmitUsd, 0, ctx);

    // admitted ∪ queued = the deduplicated queue, each once.
    const seen = new Set<string>();
    const deduped = s.queue.filter((q) => !seen.has(q.id) && seen.add(q.id)).map((q) => q.id);
    assert.deepEqual([...p.admit.map((a) => a.id), ...p.queued.map((q) => q.id)].sort(), [...deduped].sort(), ctx);

    // Unknown cap and allowed: everything that is not already running is admitted (no rate or concurrency limit).
    if (!p.cap.known && p.brake === 'none') {
      const running = new Set(p.reserve.sessions.map((r) => r.id));
      assert.deepEqual(p.admit.map((a) => a.id).sort(), deduped.filter((id) => !running.has(id)).sort(), ctx);
    }
  }
});

// --- 9. Adversarial review and mutation-killing tests ----------------------------------------------------------------

const DAY = 24 * H;
const finiteOrNull = (v: unknown, path = ''): string[] => {
  if (typeof v === 'number') return Number.isFinite(v) ? [] : [`${path}=${v}`];
  if (Array.isArray(v)) return v.flatMap((x, i) => finiteOrNull(x, `${path}[${i}]`));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => finiteOrNull(x, `${path}.${k}`));
  return [];
};

test('window: five_hour lasts 5 hours (spend from 5 hours before reset, rollover in 5-hour steps)', () => {
  const p = plan(snap({
    window: { type: 'five_hour', resetsAt: (NOW + 2 * H) / 1000, status: 'allowed' },
    sessions: [build('old', 40, 4, { lastActiveAt: iso(NOW), done: true }), build('new', 10, 2, { done: true })],
  }));
  assert.equal(p.window.startAt, iso(NOW - 3 * H));
  assert.ok(near(p.spend.windowUsd, 40 * 3 / 4 + 10)); // the 4-hour-old session counts pro rata: 3 of its 4 hours
  const rolled = plan(snap({ window: { type: 'five_hour', resetsAt: (NOW - 12 * H) / 1000, status: 'rejected' } }));
  assert.equal(rolled.window.resetsAt, iso(NOW + 3 * H)); // three 5-hour rollovers: −12h → −7h → −2h → +3h
  assert.equal(rolled.window.startAt, iso(NOW - 2 * H));
  assert.equal(rolled.brake, 'none');
});

test('window: resetsAt weeks ago rolls over to the window containing now', () => {
  const week = 7 * DAY;
  const p = plan(snap({ window: { type: 'seven_day', resetsAt: (RESET - 5 * week) / 1000, status: 'allowed' } }));
  assert.equal(p.window.resetsAt, iso(RESET));
  assert.equal(p.window.rolledOver, true);
});

test('cap: calibration takes the most recent window with a warning, and its low only from allowed readings in that window', () => {
  const week = 7 * DAY;
  const readings = [
    { atMs: NOW - 8 * DAY, totalCostUsd: 300, status: 'allowed', resetsAtMs: RESET - week },
    { atMs: NOW - 7.5 * DAY, totalCostUsd: 360, status: 'allowed_warning', resetsAtMs: RESET - week },
    { atMs: NOW - H, totalCostUsd: 600, status: 'allowed_warning', resetsAtMs: RESET },
  ];
  const r = estimateCap(readings, { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.deepEqual([r.low, r.point, r.high], [600, 700, 800]); // no allowed reading in this window → low = W; point the midpoint
  assert.equal(r.calibratedFrom?.resetsAt, iso(RESET));
  assert.equal(r.calibratedFrom?.spendUsd, 600);
});

test('cap: lowerBoundUsd only counts allowed readings of the current window', () => {
  const r = estimateCap([
    { atMs: NOW - 8 * DAY, totalCostUsd: 900, status: 'allowed', resetsAtMs: RESET - 7 * DAY },
    { atMs: NOW - H, totalCostUsd: 300, status: 'allowed', resetsAtMs: RESET },
  ], { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.equal(r.source, 'unknown');
  assert.ok(near(r.lowerBoundUsd, 400));
});

test('cap: config warnFraction sets the calibration (high = W / warnFraction)', () => {
  const p = plan(snap({
    config: { warnFraction: 0.5 },
    window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed_warning' },
    history: [{ at: ago(1), totalCostUsd: 300, status: 'allowed_warning' }],
  }));
  assert.deepEqual([p.cap.low, p.cap.high, p.cap.source], [300, 600, 'calibrated']);
});

test('spend: a history reading of this window above the sessions\' sum is a floor; a future reading is ignored', () => {
  const p = plan(snap({ sessions: [build('a', 10, 1, { done: true })], history: [{ at: ago(1), totalCostUsd: 200, status: 'allowed' }] }));
  assert.equal(p.spend.windowUsd, 200);
  assert.ok(codes(p).includes('history-above-spend'));
  assert.equal(p.historyEntry.totalCostUsd, 200);
  const fut = plan(snap({ sessions: [build('a', 10, 1, { done: true })], history: [{ at: iso(NOW + H), totalCostUsd: 500, status: 'allowed' }] }));
  assert.equal(fut.spend.windowUsd, 10);
  assert.ok(codes(fut).includes('bad-history'));
});

test('overshoot: the worst case is compared with cap LOW, so a worst case between low and high is possible, not none', () => {
  const p = plan(snap({
    config: {},
    window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed_warning' },
    queue: [{ id: 'q', kind: 'review', estimateUsd: 50 }],
    history: [{ at: ago(3), totalCostUsd: 450, status: 'allowed' }, { at: ago(1), totalCostUsd: 600, status: 'allowed_warning' }],
  }));
  assert.deepEqual([p.cap.low, p.cap.high], [600, 800]);
  assert.deepEqual(p.admit.map((a) => a.id), ['q']);
  assert.equal(p.projection.overshoot.worstCaseSpendUsd, 650); // ≤ cap high, > cap low
  assert.equal(p.projection.overshoot.vsCapLowUsd, 50);
  assert.equal(p.projection.overshoot.risk, 'possible');
});

test('projection: the history slope runs from the EARLIEST reading of the last 2 hours', () => {
  const p = plan(snap({
    config: { capUsd: 300 },
    sessions: [build('a', 100, 2, { lastActiveAt: iso(NOW) })],
    history: [{ at: ago(0.5), totalCostUsd: 90, status: 'allowed' }, { at: ago(1.5), totalCostUsd: 40, status: 'allowed' }],
  }));
  assert.equal(p.projection.burnSource, 'history');
  assert.ok(near(p.projection.burnUsdPerHour, 40)); // (100 − 40) / 1.5h, not (100 − 90) / 0.5h
});

test('fill: only kinds whose point prior fits in the unused budget are suggested', () => {
  const p = plan(snap({ config: { capUsd: 10 } }));
  assert.ok(near(p.fill.expectedUnusedUsd!, 10));
  assert.deepEqual(p.fill.suggestedKinds, ['build:small', 'review']); // build and council ($40) do not fit in $10
});

test('reserve: config safety widens only the high figure', () => {
  const p = plan(snap({ config: { capUsd: 1000, safety: 3 }, sessions: [build('a', 2, 0.5)] }));
  assert.equal(p.reserve.safety, 3);
  const r = p.reserve.sessions[0].remaining;
  assert.deepEqual([r.low, r.point, r.high], [18.75, 38, 159]); // low: burn $4.17/h × 4.5h; high: (55 − 2) × 3
});

test('robust: prototype keys as ids, kinds, phases, priors keys and config keys neither throw nor leak', () => {
  const s = JSON.parse(JSON.stringify(snap({
    config: { capUsd: 1000 },
    sessions: [{ id: '__proto__', kind: 'constructor', phase: '__proto__', costUsd: 1, startedAt: ago(1), lastActiveAt: iso(NOW) }],
    queue: [{ id: '__proto__' }, { id: 'constructor', kind: 'toString', phase: 'constructor' }, { id: 'hasOwnProperty', kind: '__proto__' }],
  })).replace('"capUsd":1000', '"capUsd":1000,"__proto__":{"capUsd":1},"priors":{"__proto__":{"low":1},"constructor":5,"build:__proto__":7}'));
  const p = plan(s);
  assert.equal(p.cap.high, 1000);
  assert.equal(p.reserve.sessions[0].kind, 'build');
  assert.deepEqual(p.reserve.sessions[0].priorUsd, { low: 7, point: 7, high: 7 }); // the own key build:__proto__, not Object.prototype
  assert.deepEqual(p.admit.map((a) => a.id), ['constructor', 'hasOwnProperty']);
  assert.equal(p.queued[0].reason, 'already running');
  assert.ok(codes(p).includes('bad-config') && codes(p).includes('unknown-config'));
});

test('robust: null, arrays and scalars where objects go give a plan with issues', () => {
  for (const s of [null, [], 5, 'x', { now: iso(NOW), window: null, config: null, sessions: null, queue: null, history: null },
    { now: iso(NOW), window: [], config: [], sessions: {}, queue: {}, history: {} },
    snap({ sessions: [[], null, 5, 'x'], queue: [[], null, 5, { id: 5 }], history: [[], null, 5, { at: [], totalCostUsd: 1 }] })]) {
    const p = plan(s);
    assert.ok(p.issues.length > 0, JSON.stringify(s));
    assert.deepEqual(finiteOrNull(p), [], JSON.stringify(s));
    assert.deepEqual(p.admit, []);
  }
});

test('robust: strings where numbers go are reported and never used as numbers', () => {
  const p = plan(snap({
    config: { capUsd: '1000', warnFraction: '0.5', safety: '2' },
    sessions: [{ id: 'a', kind: 'build', costUsd: '5', priority: '9', startedAt: 'x', lastActiveAt: {}, recent: { costUsd: '1', at: 'y' } }],
    queue: [{ id: 'q', kind: 'review', priority: '5', estimateUsd: '7', estimateLowUsd: [], estimateHighUsd: {} }],
  }));
  for (const c of ['bad-config', 'bad-cost', 'no-start', 'no-last-active', 'bad-recent', 'bad-priority', 'bad-estimate']) assert.ok(codes(p).includes(c), c);
  assert.equal(p.cap.source, 'unknown');
  assert.equal(p.spend.windowUsd, 0);
  assert.equal(p.admit[0].priority, 0);
  assert.deepEqual(p.admit[0].estimate, { low: 1, point: 3, high: 4 }); // the review prior
});

test('performance: 10,000 queued items, sessions and history readings plan in well under a second', () => {
  const n = 10_000;
  const s = snap({
    config: {},
    queue: Array.from({ length: n }, (_, i) => ({ id: `q${i}`, kind: 'review', priority: i % 7, estimateUsd: 1 + (i % 5) })),
    sessions: Array.from({ length: n }, (_, i) => build(`s${i}`, i % 30, i % 50)),
    history: Array.from({ length: n }, (_, i) => ({ at: iso(NOW - (i + 1) * 60_000), totalCostUsd: Math.max(0, 500 - i / 20), status: i % 3 ? 'allowed' : 'allowed_warning' })),
  });
  const t = performance.now();
  const p = plan(s);
  assert.ok(performance.now() - t < 1000, `${performance.now() - t} ms`);
  assert.equal(p.admit.length + p.queued.length, n);
  const known = plan({ ...s, config: { capUsd: 1e9 } });
  assert.equal(known.admit.length, n);
});

test('properties: every number in the plan is finite (JSON.stringify would silently turn NaN/Infinity into null)', () => {
  const rand = mulberry32(424242);
  for (let n = 0; n < 500; n++) {
    const s = randomSnapshot(rand);
    assert.deepEqual(finiteOrNull(plan(s)), [], JSON.stringify(s));
  }
});

// --- 10. Review round 1: bug repros and the fixes -----------------------------------------------------------------

test('B1 window.type inherited key (constructor/__proto__/toString) does not throw', () => {
  for (const type of ['constructor', '__proto__', 'toString']) {
    const p = plan(snap({ window: { type, resetsAt: RESET / 1000, status: 'allowed' } }));
    assert.equal(p.window.type, 'seven_day', type);
    assert.ok(codes(p).includes('unknown-window-type'), type);
  }
});

test('B2 timestamps outside the Date range (ns epoch, 1e17, -1e17) are invalid, never a throw', () => {
  const nsNow = plan(snap({ now: NOW * 1e6 }));
  assert.ok(codes(nsNow).includes('bad-now'));
  const nsReset = plan(snap({ window: { type: 'seven_day', resetsAt: RESET * 1e6, status: 'allowed' } }));
  assert.ok(codes(nsReset).includes('no-resets-at'));
  assert.equal(nsReset.brake, 'unknown-status');
  const nsStart = plan(snap({ sessions: [{ id: 'a', kind: 'build', costUsd: 1, startedAt: NOW * 1e6, lastActiveAt: iso(NOW) }] }));
  assert.ok(codes(nsStart).includes('no-start'));
  assert.doesNotThrow(() => plan(snap({ config: {}, history: [{ at: -NOW * 1e6, totalCostUsd: 5, status: 'allowed_warning' }] })));
  const edge = plan(snap({ now: 8.64e15, window: { type: 'seven_day', resetsAt: 8.64e15 - 1, status: 'allowed' } }));
  assert.deepEqual(finiteOrNull(edge), []);
});

test('B3 a tiny positive burn gives a null capHitAt, not a throw', () => {
  const p = plan(snap({ sessions: [{ id: 'a', kind: 'build', costUsd: 1e-6, startedAt: iso(NOW - 1000 * H), lastActiveAt: iso(NOW) }] }));
  assert.equal(p.projection.capHitAt, null);
  assert.equal(p.projection.capHitBeforeReset, false);
});

test('B4 a history of 150,000 readings does not overflow the stack', () => {
  const history = Array.from({ length: 150_000 }, (_, i) => ({ at: iso(NOW - (i + 1) * 1000), totalCostUsd: 1, status: 'allowed' }));
  assert.doesNotThrow(() => plan(snap({ history })));
});

test('B5 huge but finite inputs are bounded and reported, so every output number stays finite', () => {
  const cases = [
    snap({ sessions: [1, 2].map((i) => ({ id: `s${i}`, kind: 'build', costUsd: 1e308, startedAt: iso(NOW - H), lastActiveAt: iso(NOW) })) }),
    snap({ config: {}, queue: [{ id: 'a', estimateUsd: 1e308 }, { id: 'b', estimateUsd: 1e308 }] }),
    snap({ config: { capUsd: 1000, safety: 1e308 }, sessions: [{ id: 'a', kind: 'build', costUsd: 10, startedAt: iso(NOW - H), lastActiveAt: iso(NOW) }] }),
    snap({ config: { capUsd: 1000, priors: { build: { typicalHours: 1e308 } } }, sessions: [{ id: 'a', kind: 'build', costUsd: 10, startedAt: iso(NOW - H), lastActiveAt: iso(NOW) }] }),
    snap({ config: { warnFraction: 1e-320 }, window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed_warning' }, sessions: [{ id: 'a', kind: 'build', costUsd: 10, startedAt: iso(NOW - H), lastActiveAt: iso(NOW), done: true }] }),
  ];
  for (const s of cases) {
    const p = plan(s);
    assert.deepEqual(finiteOrNull(p), [], JSON.stringify(s).slice(0, 200));
    assert.ok(codes(p).some((c) => ['bad-cost', 'bad-estimate', 'bad-config'].includes(c)), JSON.stringify(s).slice(0, 200));
  }
  assert.equal(plan(snap({ config: { capUsd: 2e12 } })).cap.source, 'unknown'); // money is bounded at $1e12
  assert.equal(plan(snap({ config: { capUsd: 1000, safety: 101 } })).reserve.safety, 1.5);
  assert.equal(plan(snap({ config: { capUsd: 1000, safety: 100 } })).reserve.safety, 100);
});

test('B6 resetsAt more than one window ahead of now is an error and a brake, with every session counted in full', () => {
  const p = plan(snap({ window: { type: 'five_hour', resetsAt: (NOW + 30 * H) / 1000, status: 'allowed' }, config: { capUsd: 100 },
    sessions: [{ id: 'a', kind: 'build', costUsd: 90, startedAt: iso(NOW - H), lastActiveAt: iso(NOW), done: true }], queue: [{ id: 'q', kind: 'build', estimateUsd: 50 }] }));
  assert.ok(p.issues.some((i) => i.code === 'window-ahead' && i.level === 'error'));
  assert.equal(p.brake, 'unknown-status');
  assert.deepEqual(p.admit, []);
  assert.equal(p.spend.windowUsd, 90);
  assert.deepEqual([p.historyEntry.status, p.historyEntry.resetsAt], [null, null]);
});

test('B7 after a rollover a missing status is not reported as a brake', () => {
  const p = plan(snap({ window: { type: 'seven_day', resetsAt: (NOW - H) / 1000 } }));
  assert.equal(p.brake, 'none');
  assert.ok(!p.issues.some((i) => /treated as a brake/.test(i.detail)), JSON.stringify(p.issues));
});

test('cap: a rejected reading from an older window does not cap a newer warning calibration', () => {
  const week = 7 * DAY;
  const readings = [
    { atMs: NOW - 8 * DAY, totalCostUsd: 300, status: 'rejected', resetsAtMs: RESET - week },
    { atMs: NOW - 2 * H, totalCostUsd: 525, status: 'allowed', resetsAtMs: RESET },
    { atMs: NOW - H, totalCostUsd: 600, status: 'allowed_warning', resetsAtMs: RESET },
  ];
  const r = estimateCap(readings, { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.deepEqual([r.low, r.point, r.high], [700, 750, 800]);
  assert.equal(r.calibratedFrom?.warning?.spendUsd, 600);
  assert.equal(r.calibratedFrom?.allowedLow?.spendUsd, 525);
  assert.equal(r.calibratedFrom?.rejected, undefined);
  // The same rejected reading in the warning's own window does lower it, and calibratedFrom names it.
  const same = estimateCap([...readings.slice(1), { atMs: NOW - 0.5 * H, totalCostUsd: 650, status: 'rejected', resetsAtMs: RESET }], { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.deepEqual([same.low, same.high], [650, 650]);
  assert.equal(same.calibratedFrom?.rejected?.spendUsd, 650);
  assert.equal(same.calibratedFrom?.spendUsd, 650); // the reading that set the high end
});

test('cap: a rejected reading alone calibrates: high = R, low from the last allowed reading before it', () => {
  const r = estimateCap([
    { atMs: NOW - 2 * H, totalCostUsd: 450, status: 'allowed', resetsAtMs: RESET },
    { atMs: NOW - H, totalCostUsd: 700, status: 'rejected', resetsAtMs: RESET },
  ], { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.deepEqual([r.low, r.point, r.high, r.source], [600, 650, 700, 'calibrated']);
  assert.equal(r.calibratedFrom?.allowedLow?.spendUsd, 450);
});

test('cap: current-window allowed readings raise a cap carried over from an older window', () => {
  const week = 7 * DAY;
  const p = plan(snap({
    config: {},
    sessions: [build('a', 900, 5, { done: true })],
    history: [{ at: iso(NOW - 8 * DAY), totalCostUsd: 450, status: 'allowed_warning', resetsAt: (RESET - week) / 1000 }],
  }));
  // Old window: low 450, high 600. This window: allowed at $900 → the cap is above 1200.
  assert.deepEqual([p.cap.low, p.cap.point, p.cap.high], [1200, 1200, 1200]);
  assert.ok(codes(p).includes('cap-raised'));
});

test('cap: lowerBoundUsd never exceeds a cap set by a rejected reading in this window', () => {
  const p = plan(snap({
    config: {},
    window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'rejected' },
    sessions: [build('a', 700, 5, { done: true })],
    history: [{ at: ago(2), totalCostUsd: 600, status: 'allowed' }],
  }));
  assert.equal(p.cap.high, 700);
  assert.equal(p.cap.lowerBoundUsd, 700); // 600 / 0.75 = 800 clamped
  assert.ok(codes(p).includes('lower-bound-clamped'));
});

test('cap: a calibrated point is the midpoint, and a wide bracket is reported', () => {
  const p = plan(snap({ config: {}, window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed_warning' }, sessions: [build('a', 600, 3, { done: true })] }));
  assert.deepEqual([p.cap.low, p.cap.point, p.cap.high], [600, 700, 800]);
  assert.ok(codes(p).includes('cap-bracket-wide')); // 800 / 600 > 1.25
  const narrow = estimateCap([
    { atMs: NOW - 2 * H, totalCostUsd: 560, status: 'allowed', resetsAtMs: RESET },
    { atMs: NOW - H, totalCostUsd: 600, status: 'allowed_warning', resetsAtMs: RESET },
  ], { warnFraction: 0.75, currentResetsAtMs: RESET }, () => assert.fail('no issue for a narrow bracket'));
  assert.ok(near(narrow.low!, 746.67));
});

test('window: without a usable resetsAt the plan says so instead of inventing a reset time', () => {
  for (const s of [snap({ window: undefined }), snap({ window: { type: 'seven_day', status: 'allowed' } })]) {
    const p = plan({ ...s, queue: [{ id: 'q', kind: 'review' }] });
    assert.equal(p.window.resetsAt, null);
    assert.equal(p.window.startAt, null);
    assert.equal(p.window.hoursToReset, null);
    assert.equal(p.window.assumed, true);
    assert.equal(p.brake, 'unknown-status');
    assert.equal(p.queued[0].nextAdmitAt, null);
    assert.deepEqual([p.historyEntry.status, p.historyEntry.resetsAt], [null, null]);
    assert.doesNotMatch(p.summary, /\d{4}-\d\d-\d\dT/);
  }
  assert.equal(plan(snap()).window.assumed, false);
});

test('window: rateLimitType is accepted as window.type; neither is reported', () => {
  const p = plan(snap({ window: { rateLimitType: 'five_hour', resetsAt: (NOW + 2 * H) / 1000, status: 'allowed' } }));
  assert.equal(p.window.type, 'five_hour');
  assert.equal(p.window.startAt, iso(NOW - 3 * H));
  const none = plan(snap({ window: { resetsAt: RESET / 1000, status: 'allowed' } }));
  assert.equal(none.window.type, 'seven_day');
  assert.ok(codes(none).includes('no-window-type'));
});

test('projection: a history slope far from the sessions\' burn is reported, and the summary names the cap-hit time', () => {
  const s = nov1({ capUsd: 1500 });
  s.history = [
    { at: '2026-11-01T07:55:00Z', totalCostUsd: 290, status: 'allowed' },
    { at: '2026-11-01T08:25:00Z', totalCostUsd: 440, status: 'allowed' },
  ];
  const p = plan(s);
  assert.ok(p.projection.burnUsdPerHour > 280);
  const issue = p.issues.find((i) => i.code === 'burn-mismatch');
  assert.ok(issue, JSON.stringify(p.issues));
  assert.match(issue.detail, /history/);
  assert.equal(p.projection.capHitBeforeReset, true);
  assert.match(p.summary, /cap hit ~\d\d:\d\dZ at current burn/);
  assert.doesNotMatch(plan(nov1({ capUsd: 1500 })).summary, /cap hit/);
});

test('remaining cost: a session under 30 minutes old has no burn term yet (a $3.16 council at 5 minutes)', () => {
  const r = remainingCost(sess('council', 3.16, 5 / 60), NOW, RESET);
  assert.ok(near(r.remaining.point, 40 - 3.16, 1e-9));
  assert.equal(r.basis, 'prior');
  assert.ok(near(r.burnUsdPerHour, 3.16 / 0.25, 1e-9)); // still reported
  const over = remainingCost(sess('council', 35, 5 / 60), NOW, RESET); // spent past its low prior: the burn counts
  assert.equal(over.basis, 'burn');
  assert.equal(DEFAULT_PRIORS.council.high, 60);
});

test('duplicates: done wins, then the larger cost, then the later lastActiveAt; id-less sessions never collide', () => {
  const p = plan(snap({ sessions: [build('a', 30, 2), build('a', 20, 1, { done: true }), build('b', 5, 1, { lastActiveAt: ago(0.5) }), build('b', 5, 1, { lastActiveAt: ago(0.1), priority: 7 })] }));
  assert.deepEqual(p.reserve.sessions.map((s) => [s.id, s.priority]), [['b', 7]]); // a is done
  assert.equal(p.spend.windowUsd, 25);
  const ids = plan(snap({ sessions: [{ kind: 'build', costUsd: 1, startedAt: ago(1) }, { kind: 'build', costUsd: 2, startedAt: ago(1) }, build('(missing id #0)', 4, 1)] }));
  assert.equal(ids.reserve.sessions.length, 3);
  assert.equal(ids.spend.windowUsd, 7);
  assert.ok(!codes(ids).includes('duplicate-session'));
});

test('admission: money is compared with an epsilon (0.1 + 0.2 fits under 0.3)', () => {
  const p = plan(snap({ config: { capUsd: 0.3 }, queue: [{ id: 'a', kind: 'review', priority: 2, estimateUsd: 0.1 }, { id: 'b', kind: 'review', priority: 1, estimateUsd: 0.2 }] }));
  assert.deepEqual(p.admit.map((a) => a.id), ['a', 'b']);
});

test('pause: the rule is stated, the summary lists the first three and a count, and stall risk has a reason', () => {
  const p = plan(snap({
    window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'rejected' },
    sessions: ['a', 'b', 'c', 'd', 'e'].map((id, i) => build(id, 5 + i, 1, { priority: i })),
  }));
  assert.match(p.pause.rule, /until status is allowed again/);
  assert.match(p.pause.rule, /orchestrator is never paused/);
  assert.match(p.summary, /pause a, b, c \+2 more/);
  assert.match(p.pause.reason!, /rejected/);
  const tight = plan(snap({ config: { capUsd: 20 }, sessions: [build('a', 10, 1)] }));
  assert.equal(tight.pause.stallRisk, true);
  assert.deepEqual(tight.pause.recommend, []);
  assert.match(tight.pause.reason!, /informational/);
  assert.equal(plan(snap()).pause.reason, null);
});

test('fill: under a brake the message names the brake, even when the cap is unknown', () => {
  const p = plan(snap({ config: {}, window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed', isUsingOverage: true } }));
  assert.match(p.fill.message, /overage/);
  assert.doesNotMatch(p.fill.message, /admitted/);
  assert.equal(p.fill.expectedUnusedUsd, null);
});

test('output: ISO times are rounded to whole seconds', () => {
  const p = plan(snap({ now: NOW + 499 }));
  assert.equal(p.now, iso(NOW));
  assert.equal(plan(snap({ now: NOW + 500 })).now, iso(NOW + 1000));
});

test('robust: a recent reading above the cost is reported; done accepts "true"/"false" strings with an issue', () => {
  const p = plan(snap({ sessions: [build('a', 10, 1, { recent: { costUsd: 20, at: ago(0.5) } })] }));
  assert.ok(codes(p).includes('recent-above-cost'));
  assert.ok(near(p.reserve.sessions[0].burnUsdPerHour, 10.2, 0.05)); // the lifetime burn
  const d = plan(snap({ sessions: [build('a', 10, 1, { done: 'true' }), build('b', 10, 1, { done: 'false' }), build('c', 10, 1, { done: 1 })] }));
  assert.deepEqual(d.reserve.sessions.map((s) => s.id), ['b', 'c']);
  assert.equal(codes(d).filter((c) => c === 'bad-done').length, 3);
});

test('cap: running work over a known cap is reported with the shortfall', () => {
  const p = plan(snap({ config: { capUsd: 30 }, sessions: [build('a', 10, 1)] })); // 10 + ~40 > 30
  const issue = p.issues.find((i) => i.code === 'running-over-cap');
  assert.ok(issue);
  assert.match(issue.detail, /\$\d+\.\d\d/);
  assert.ok(!codes(plan(snap({ config: { capUsd: 300 }, sessions: [build('a', 10, 1)] }))).includes('running-over-cap'));
});

test('CLI: a usage error is JSON on stderr with exit 2', () => {
  try {
    cli(['nope']);
    assert.fail('exit 0');
  } catch (e) {
    const err = e as { status: number; stderr: string };
    assert.equal(err.status, 2);
    assert.match(JSON.parse(err.stderr).error, /usage/);
  }
});

test('robust: an invalid now brakes even when the window would be usable at the fallback time', () => {
  const p = plan({ now: 'garbage', window: { type: 'seven_day', resetsAt: 3600, status: 'allowed' }, config: {}, queue: [{ id: 'q', kind: 'review' }] });
  assert.ok(codes(p).includes('bad-now'));
  assert.ok(!codes(p).includes('window-ahead')); // the fallback clock (0) lies inside this window
  assert.equal(p.brake, 'unknown-status');
  assert.deepEqual(p.admit, []);
});
