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

// The 2026-11-01 calibration data, state at about 08:55 UTC: each session's real start time and cost_usd so far
// (done sessions with their finish time). Σ $385.35 between 07:25:36 and 08:54 (88 minutes); the orchestrator measured about
// $294/hour over 07:25-08:44.
function nov1(config: Record<string, unknown> = {}): Record<string, unknown> {
  const done = (id: string, kind: string, cost: number, start: string, end: string, phase?: string) =>
    ({ id, kind, phase, costUsd: cost, startedAt: `2026-11-01T${start}Z`, lastActiveAt: `2026-11-01T${end}Z`, done: true });
  const run = (id: string, kind: string, cost: number, start: string, extra: Record<string, unknown> = {}) =>
    ({ id, kind, costUsd: cost, startedAt: start.includes('T') ? start : `2026-11-01T${start}Z`, lastActiveAt: '2026-11-01T08:54:00Z', done: false, ...extra });
  return {
    now: '2026-11-01T08:55:00Z',
    window: { type: 'seven_day', resetsAt: 1793545200, status: 'allowed', isUsingOverage: false },
    config,
    sessions: [
      done('f6-build', 'build', 28.00, '07:27:01', '08:24:00'),
      done('privacy-build', 'build', 20.78, '07:27:02', '08:40:00'),
      done('idea-board-council', 'council', 32.77, '07:33:57', '08:10:00'),
      done('ci-speed', 'build', 8.70, '07:33:58', '08:05:00', 'small'),
      done('creative-council', 'council', 31.36, '07:36:31', '08:40:00'),
      done('design-council', 'council', 40.90, '07:36:31', '08:40:00'),
      run('f2-build', 'build', 31.05, '07:25:36', { priority: 5 }),
      run('f3-build', 'build', 38.17, '07:26:59', { priority: 5 }),
      run('f4-build', 'build', 22.34, '07:27:00', { priority: 5 }),
      run('sharded-sync-build', 'build', 16.09, '07:30:52', { priority: 3 }),
      run('splits-build', 'build', 15.78, '07:30:53', { priority: 2 }),
      run('security-build', 'build', 33.11, '07:33:59', { priority: 4 }),
      run('market-council', 'council', 48.31, '07:36:30', { phase: 'fixing', priority: 2 }),
      run('publish-isolation-build', 'build', 14.01, '07:54:37', { priority: 3 }),
      run('approval-council', 'council', 3.16, '08:39:54', { priority: 1 }),
      run('council-x', 'council', 0.30, '08:45:00'),
      run('council-y', 'council', 0.20, '08:48:00'),
      run('council-z', 'council', 0.05, '08:52:00'),
      run('build-p', 'build', 0.25, '08:47:00'),
      run('build-q', 'build', 0.02, '08:54:00'),
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
    // span): about $258/hour over the last 1.5 hours.
    history: [
      { at: '2026-11-01T07:25:00Z', totalCostUsd: 198.73, status: 'allowed' },
      { at: '2026-11-01T07:55:00Z', totalCostUsd: 326.51, status: 'allowed' },
      { at: '2026-11-01T08:25:00Z', totalCostUsd: 481.60, status: 'allowed' },
      { at: '2026-11-01T08:40:00Z', totalCostUsd: 543.83, status: 'allowed' },
    ],
  };
}

// --- 1. Remaining cost (low / point / high) -----------------------------------------------------------------------

const sess = (kind: string, cost: number, startedH: number, activeH = 0, extra: Record<string, unknown> = {}) =>
  ({ kind, costUsd: cost, startedAtMs: NOW - startedH * H, lastActiveAtMs: NOW - activeH * H, ...extra });
const range = (r: { low: number; point: number; high: number }) => [r.low, r.point, r.high].map((x) => Math.round(x * 1e6) / 1e6);

test('remaining cost: prior − spent dominates for a young session; high is widened by safety', () => {
  const r = remainingCost(sess('build', 2, 0.5), NOW, RESET); // burn $4/h × 1.25h left = 5
  assert.equal(r.basis, 'prior');
  assert.deepEqual(range(r.remaining), [18, 38, 68 * 1.5]);
  assert.deepEqual(r.priorUsd, { low: 20, point: 40, high: 70 });
});

test('remaining cost: burn × remaining hours dominates when burning fast', () => {
  const r = remainingCost(sess('build', 40, 0.5), NOW, RESET); // $80/h, 1.25 typical hours left
  assert.equal(r.basis, 'burn');
  assert.ok(near(r.burnUsdPerHour, 80, 1e-9));
  assert.ok(near(r.remainingHours, 1.25, 1e-9));
  assert.deepEqual(range(r.remaining), [100, 100, 150]);
});

test('remaining cost: a session over its prior keeps its burn over the tail, never 0', () => {
  const r = remainingCost(sess('build', 80, 2), NOW, RESET); // $40/h, past typical → tail 0.25h
  assert.equal(r.basis, 'burn');
  assert.ok(near(r.remainingHours, 0.25, 1e-9));
  assert.deepEqual(range(r.remaining), [10, 10, 15]);
});

test('remaining cost: the floor applies when prior and burn are both small', () => {
  const slow = remainingCost(sess('build', 80, 2, 0, { recent: { costUsd: 79.95, atMs: NOW - 0.5 * H } }), NOW, RESET); // $0.10/h recently
  assert.equal(slow.basis, 'floor');
  assert.deepEqual(range(slow.remaining), [4, 4, 6]);
  const review = remainingCost(sess('review', 5.5, 2, 0, { recent: { costUsd: 5.49, atMs: NOW - 0.5 * H } }), NOW, RESET);
  assert.equal(review.basis, 'floor');
  assert.deepEqual(range(review.remaining), [1, 1, 1.5]);
});

test('remaining cost: a kind:phase prior overrides the kind, and config priors override both', () => {
  const small = remainingCost(sess('build', 1, 0.1, 0, { phase: 'small' }), NOW, RESET); // 6 minutes old: no burn term yet
  assert.deepEqual(small.priorUsd, { low: 5, point: 9, high: 15 });
  assert.deepEqual(range(small.remaining), [4, 8, 21]);
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

// What the admission rule charges: spend + running in-window point + admitted items' in-window low estimates.
const used = (p: Plan) => p.spend.windowUsd + p.reserve.totalUsd + p.admit.reduce((s, a) => s + a.inWindow.low, 0);

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
  assert.equal(p.projection.overshoot.worstCaseSpendUsd, 195); // the item's high × safety 1.5
  assert.equal(p.projection.overshoot.vsCapLowUsd, 95);
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
  assert.deepEqual(p.admit.map((a) => [a.id, a.estimate]), [['a', { low: 70, point: 70, high: 70 }], ['b', { low: 20, point: 40, high: 70 }]]);
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
  // high 600 / 0.75; low 500 / 0.75 = 666.67, raised to the $700 this window has spent without a rejection; point the midpoint
  assert.ok(near(p.cap.high!, 800) && near(p.cap.point!, 750) && near(p.cap.low!, 700));
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

test('projection: burn is the running sessions\' burn; the history slope is reported; time to cap and whether running work fits', () => {
  const sessions = [build('a', 100, 2, { lastActiveAt: iso(NOW) })]; // $50/h lifetime, past typical → point remaining 50 × 0.25h = 12.5, high 18.75
  const hist = plan(snap({ config: { capUsd: 115 }, sessions, history: [{ at: ago(1.5), totalCostUsd: 40, status: 'allowed' }, { at: ago(5), totalCostUsd: 0, status: 'allowed' }] }));
  assert.equal(hist.projection.burnSource, 'sessions');
  assert.ok(near(hist.projection.burnUsdPerHour, 50));
  assert.ok(near(hist.projection.historyBurnUsdPerHour!, 40)); // (100 − 40) / 1.5h; the 5h-old reading is outside the 2 hours
  assert.ok(near(hist.projection.timeToCapHours!, 0.3)); // (115 − 100) / 50
  assert.equal(hist.projection.capHitAt, iso(NOW + 0.3 * H));
  assert.equal(hist.projection.capHitBeforeReset, true);
  assert.ok(near(hist.projection.runningProjectedSpendUsd, 112.5));
  assert.equal(hist.projection.runningFits, true);
  assert.equal(hist.projection.runningFitsWithSafety, false); // 100 + 18.75 > cap low 115
  const fresh = plan(snap({ config: { capUsd: 115 }, sessions, history: [{ at: ago(0.1), totalCostUsd: 95, status: 'allowed' }] }));
  assert.equal(fresh.projection.historyBurnUsdPerHour, null); // the only reading is under 15 minutes old
  const tight = plan(snap({ config: { capUsd: 110 }, sessions }));
  assert.equal(tight.projection.runningFits, false);
  assert.equal(tight.pause.stallRisk, true);
  const idle = plan(snap({ config: { capUsd: 300 } }));
  assert.equal(idle.projection.timeToCapHours, null);
  assert.equal(idle.projection.capHitBeforeReset, false);
});

// --- Fill: use the whole budget by reset ---------------------------------------------------------------------------

test('fill: spare budget and an empty queue → reports the unused budget and asks for more work', () => {
  const p = plan(snap({ config: { capUsd: 300 }, sessions: [build('a', 10, 1)] })); // 300 − 10 − 30 = 260 unused
  assert.ok(near(p.fill.expectedUnusedUsd!, 260));
  assert.equal(p.fill.recommendAdmitUsd, p.fill.expectedUnusedUsd);
  assert.equal('maxItemHours' in p.fill, false); // window.hoursToReset says it
  assert.deepEqual(p.fill.suggestedKinds, ['council', 'build', 'build:small', 'review']); // point 45, 40, 9, 3
  assert.match(p.fill.message, /unused at reset/);
  assert.match(p.fill.message, /queue more work/);
  assert.match(p.summary, /unused/);
});

test('fill: admitted items count at their point estimate', () => {
  const p = plan(snap({ config: { capUsd: 300 }, queue: [{ id: 'q', kind: 'build', estimateLowUsd: 50, estimateUsd: 100 }] }));
  assert.ok(near(p.fill.expectedUnusedUsd!, 200));
});

test('fill: near the reset suggestions rank kinds by what they would spend before the reset', () => {
  const p = plan(snap({ now: iso(RESET - 1 * H), config: { capUsd: 300 } }));
  // in-window per item: council 45 × 1/1.25 = 36, build 40 × 1/1.75 = 22.86, build:small 9, review 3
  assert.deepEqual(p.fill.suggestedKinds, ['council', 'build', 'build:small', 'review']);
  assert.match(p.fill.message, /short/);
  const late = plan(snap({ now: iso(RESET - 0.2 * H), config: { capUsd: 300 } }));
  assert.deepEqual(late.fill.suggestedKinds, ['council', 'build', 'build:small', 'review']); // 7.2, 4.57, 3.6, 2.4
  assert.doesNotMatch(late.fill.message, /none fits/);
});

test('fill: no spare budget → 0; cap unknown → null', () => {
  const full = plan(snap({ config: { capUsd: 30 }, sessions: [build('a', 10, 1)] }));
  assert.ok(full.fill.expectedUnusedUsd! <= 0);
  assert.equal(full.fill.recommendAdmitUsd, 0);
  assert.deepEqual(full.fill.suggestedKinds, []);
  const unknown = plan(snap({ config: {} }));
  assert.equal(unknown.fill.expectedUnusedUsd, null);
  assert.equal(unknown.fill.recommendAdmitUsd, null);
  assert.match(unknown.fill.message, /unknown/);
});

// --- Robust input ----------------------------------------------------------------------------------------------

test('robust: missing fields (no config, queue, history, window; empty sessions) still give a plan', () => {
  const p = plan({ now: iso(NOW) });
  assert.equal(p.brake, 'bad-window');
  assert.deepEqual([p.admit, p.queued, p.reserve.sessions], [[], [], []]);
  assert.ok(codes(p).includes('no-window'));
  const q = plan(snap({ config: undefined, queue: undefined, history: undefined, sessions: [] }));
  assert.equal(q.brake, 'none');
  assert.equal(q.cap.source, 'unknown');
  assert.equal(q.spend.windowUsd, 0);
});

test('robust: negative and NaN costs count as 0 (error issues); a numeric string is accepted with an issue', () => {
  const p = plan(snap({ sessions: [build('a', -5, 1), build('b', NaN, 1), build('c', '12', 1), build('d', 3, 1)] }));
  assert.equal(p.spend.windowUsd, 15);
  assert.equal(p.issues.filter((i) => i.code === 'bad-cost' && i.level === 'error').length, 2);
  assert.ok(codes(p).includes('string-number'));
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
    assert.deepEqual(p.reserve.sessions[0].priorUsd, { low: 20, point: 40, high: 70 });
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

test('2026-11-01 data, cap $1500: spend about $586, history slope about $258/h, admits under the rule and keeps the reserve', () => {
  const p = plan(nov1({ capUsd: 1500 }));
  assert.equal(p.brake, 'none');
  assert.ok(p.spend.windowUsd > 560 && p.spend.windowUsd < 620, `spend ${p.spend.windowUsd}`);
  assert.equal(p.projection.burnSource, 'sessions');
  // the sessions' burns, with the five under 10 minutes of active age (council-x is 9 minutes active by its 08:54 reading)
  // at their prior's average rate: about the real $294/h
  assert.ok(p.projection.burnUsdPerHour > 250 && p.projection.burnUsdPerHour < 340, `burn ${p.projection.burnUsdPerHour}`);
  assert.ok(p.projection.historyBurnUsdPerHour! > 240 && p.projection.historyBurnUsdPerHour! < 300, `history ${p.projection.historyBurnUsdPerHour}`);
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

    if (p.brake !== 'none') assert.equal(p.admit.length, codes(p).includes('bootstrap') ? 1 : 0, ctx);
    if (p.cap.known) {
      assert.ok(near(p.capacity.headroomUsd!, p.cap.high! - p.spend.windowUsd - p.reserve.totalUsd, 0.02), ctx);
      if (p.admit.length) assert.ok(used(p) <= p.cap.high! + 0.011 * (p.admit.length + 2), ctx);
      // … and what running and admitted work carries into the next window fits under it too.
      // (Only items that carry something are bound by the next-window test.)
      const carrying = p.admit.filter((x) => x.estimate.low - x.inWindow.low > 0.005);
      const carry = p.reserve.sessions.reduce((t, r) => t + r.carriesOverUsd, 0) + carrying.reduce((t, x) => t + x.estimate.low - x.inWindow.low, 0);
      if (carrying.length) assert.ok(carry <= p.cap.high! + 0.011 * (p.admit.length + p.reserve.sessions.length + 2), ctx);
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
  // 4 weeks (under the 30-day plausibility limit; 5 weeks is now resets-at-implausible, tested in round 6)
  const p = plan(snap({ window: { type: 'seven_day', resetsAt: (RESET - 4 * week) / 1000, status: 'allowed' } }));
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
  assert.equal(p.projection.overshoot.worstCaseSpendUsd, 675); // 600 + 50 × safety 1.5: ≤ cap high, > cap low
  assert.equal(p.projection.overshoot.vsCapLowUsd, 75);
  assert.equal(p.projection.overshoot.risk, 'possible');
});

test('projection: the history slope runs from the EARLIEST reading of the last 2 hours', () => {
  const p = plan(snap({
    config: { capUsd: 300 },
    sessions: [build('a', 100, 2, { lastActiveAt: iso(NOW) })],
    history: [{ at: ago(0.5), totalCostUsd: 90, status: 'allowed' }, { at: ago(1.5), totalCostUsd: 40, status: 'allowed' }],
  }));
  assert.ok(near(p.projection.historyBurnUsdPerHour!, 40)); // (100 − 40) / 1.5h, not (100 − 90) / 0.5h
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
  assert.deepEqual([r.low, r.point, r.high], [18, 38, 204]); // low: 20 − 2 (burn $4.17/h × 1.25h is less); high: (70 − 2) × 3
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
  for (const c of ['bad-config', 'string-number', 'no-start', 'no-last-active', 'bad-recent', 'bad-priority', 'bad-estimate']) assert.ok(codes(p).includes(c), c);
  assert.equal(p.cap.source, 'config'); // money given as a numeric string is accepted (with an issue); other numbers are not
  assert.equal(p.spend.windowUsd, 5);
  assert.equal(p.admit[0].priority, 0);
  assert.deepEqual(p.admit[0].estimate, { low: 7, point: 7, high: 7 });
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
  assert.equal(nsReset.brake, 'bad-window');
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
  assert.equal(p.brake, 'bad-window');
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

test('cap: a carried-over cap that this window disproves is dropped; one it only narrows has its low end raised', () => {
  const week = 7 * DAY;
  const p = plan(snap({
    config: {},
    sessions: [build('a', 900, 5, { done: true })],
    queue: [{ id: 'q', kind: 'build', estimateUsd: 5000 }],
    history: [{ at: iso(NOW - 8 * DAY), totalCostUsd: 450, status: 'allowed_warning', resetsAt: (RESET - week) / 1000 }],
  }));
  // Old window: low 450, high 600. This window: allowed at $900 → the cap is above 1200, so the old one is stale.
  assert.deepEqual([p.cap.source, p.cap.high], ['unknown', null]);
  assert.ok(codes(p).includes('cap-stale'));
  assert.deepEqual(p.admit.map((a) => a.id), ['q']);
  const narrowed = plan(snap({
    config: {},
    sessions: [build('a', 525, 5, { done: true })],
    history: [
      { at: iso(NOW - 8.1 * DAY), totalCostUsd: 450, status: 'allowed', resetsAt: (RESET - week) / 1000 },
      { at: iso(NOW - 8 * DAY), totalCostUsd: 600, status: 'allowed_warning', resetsAt: (RESET - week) / 1000 },
    ],
  }));
  // Old window: low 600, high 800. This window: allowed at $525 → above 700: low raised, high kept.
  assert.deepEqual([narrowed.cap.low, narrowed.cap.high], [700, 800]);
  assert.ok(codes(narrowed).includes('cap-raised'));
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
    const p = plan({ ...s, sessions: [build('x', 1, 0.5)], queue: [{ id: 'q', kind: 'review' }] }); // running work: no bootstrap
    assert.equal(p.window.resetsAt, null);
    assert.equal(p.window.startAt, null);
    assert.equal(p.window.hoursToReset, null);
    assert.equal(p.window.assumed, true);
    assert.equal(p.brake, 'bad-window');
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

test('projection: a history slope far from the sessions\' burn is reported for information, and the summary names the cap-hit time', () => {
  // (nov1 itself has sessions started in the last 15 minutes, which suppresses the issue: a quiet snapshot instead)
  const s = snap({ config: { capUsd: 300 }, sessions: [build('a', 100, 2, { lastActiveAt: iso(NOW) })], history: [{ at: ago(0.5), totalCostUsd: 0, status: 'allowed' }] });
  const p = plan(s);
  assert.ok(p.projection.historyBurnUsdPerHour! > 150); // $100 in 30 minutes = $200/h
  assert.equal(p.projection.burnSource, 'sessions'); // the burn used is still the sessions'
  assert.ok(near(p.projection.burnUsdPerHour, 50));
  const issue = p.issues.find((i) => i.code === 'burn-mismatch');
  assert.ok(issue, JSON.stringify(p.issues));
  assert.equal(issue.level, 'warn');
  assert.match(issue.detail, /history/);
  assert.equal(p.projection.capHitBeforeReset, true); // (300 − 100) / $50/h = 4h < 6.08h
  assert.match(p.summary, /cap hit ~\d\d:\d\dZ at current burn/);
  assert.match(p.summary, /queue more work \(cap hit .* information only\)/);
});

test('remaining cost: a session under 10 minutes old has no lifetime-burn term yet (a $3.16 council at 5 minutes)', () => {
  const r = remainingCost(sess('council', 3.16, 5 / 60), NOW, RESET);
  assert.ok(near(r.remaining.point, 45 - 3.16, 1e-9));
  assert.equal(r.basis, 'prior');
  assert.ok(near(r.burnUsdPerHour, 3.16 / 0.25, 1e-9)); // still reported
  const over = remainingCost(sess('council', 35, 5 / 60), NOW, RESET); // spent past its low prior: the burn counts
  assert.equal(over.basis, 'burn');
  assert.equal(DEFAULT_PRIORS.council.high, 65);
  assert.deepEqual([DEFAULT_PRIORS.build.point, DEFAULT_PRIORS.build.typicalHours], [40, 1.75]);
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
  assert.match(p.pause.rule, /one per tick, until the brake is none \(status allowed or allowed_warning\)/);
  assert.match(p.pause.rule, /orchestrator is never paused/);
  assert.match(p.summary, /pause a now \(then b, c \+2 more\)/);
  assert.equal(p.pause.next, 'a');
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
  const p = plan(snap({ config: { capUsd: 30 }, sessions: [build('a', 10, 1)] })); // 10 + 30 > 30
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

// --- 11. Review round 2 -----------------------------------------------------------------------------------------------

test('history: an entry written without a usable window is ignored on the next tick (two-tick sequence)', () => {
  const sessions = [
    { id: 'old', kind: 'build', costUsd: 900, startedAt: '2026-10-20T00:00:00Z', lastActiveAt: '2026-10-25T00:00:00Z', done: true },
    { id: 'new', kind: 'build', costUsd: 10, startedAt: '2026-11-01T07:00:00Z', lastActiveAt: '2026-11-01T07:50:00Z' },
  ];
  const oldWarn = { at: '2026-10-24T00:00:00Z', totalCostUsd: 450, status: 'allowed_warning', resetsAt: '2026-10-29T00:00:00Z' };
  const t1 = plan({ now: '2026-11-01T08:00:00Z', window: { type: 'seven_day', status: 'allowed' }, sessions, history: [oldWarn] });
  assert.deepEqual([t1.historyEntry.windowKnown, t1.historyEntry.type, t1.historyEntry.resetsAt, t1.historyEntry.totalCostUsd], [false, 'seven_day', null, 910]);
  const base = { now: '2026-11-01T09:00:00Z', window: { type: 'seven_day', status: 'allowed', resetsAt: '2026-11-05T00:00:00Z' }, sessions, queue: [{ id: 'q', kind: 'build' }] };
  const t2 = plan({ ...base, history: [oldWarn, t1.historyEntry] });
  const clean = plan({ ...base, history: [oldWarn] });
  assert.equal(t2.spend.windowUsd, 10);
  assert.deepEqual([t2.cap.low, t2.cap.high], [clean.cap.low, clean.cap.high]);
  assert.ok(t2.issues.some((i) => i.code === 'history-no-window' && /1 /.test(i.detail)));
  assert.equal(t2.historyEntry.windowKnown, true);
  assert.equal(t2.historyEntry.type, 'seven_day');
});

test('history: entries of another window type are ignored; a consistent own resetsAt is used as is', () => {
  const h7 = { at: '2026-11-01T08:00:00Z', totalCostUsd: 900, status: 'allowed_warning', resetsAt: '2026-11-05T09:00:00Z' };
  const p5 = plan({ now: '2026-11-01T08:30:00Z', window: { type: 'five_hour', status: 'allowed', resetsAt: '2026-11-01T10:00:00Z' },
    sessions: [{ id: 's', kind: 'review', costUsd: 2, startedAt: '2026-11-01T08:10:00Z', lastActiveAt: '2026-11-01T08:29:00Z' }], queue: [{ id: 'q', kind: 'review' }], history: [h7] });
  assert.equal(p5.spend.windowUsd, 2); // not the seven-day window's $900
  assert.equal(p5.cap.source, 'unknown');
  assert.ok(p5.issues.some((i) => i.code === 'history-other-type'));
  const typed = plan({ now: '2026-11-01T08:30:00Z', window: { type: 'five_hour', status: 'allowed', resetsAt: '2026-11-01T10:00:00Z' },
    history: [{ at: '2026-11-01T08:00:00Z', totalCostUsd: 50, status: 'allowed_warning', type: 'seven_day', resetsAt: '2026-11-01T10:00:00Z' }] });
  assert.equal(typed.cap.source, 'unknown');
  assert.ok(typed.issues.some((i) => i.code === 'history-other-type'));
  // An older window that reset at an odd minute (not overlapping this one): its own resetsAt is kept, not snapped.
  const own = RESET - 7 * DAY - 30 * 60_000;
  const p = plan(snap({ config: {}, history: [{ at: iso(own - DAY), totalCostUsd: 600, status: 'allowed_warning', resetsAt: own / 1000 }] }));
  assert.equal(p.cap.calibratedFrom?.resetsAt, iso(own));
});

test('pause: the rule depends on the brake; paused sessions are not recommended, keep their reserve and are resumed first', () => {
  const sessions = [
    build('a', 5, 1, { priority: 1 }), build('b', 30, 1, { priority: 1, paused: true }), build('c', 10, 1, { priority: 3, paused: true }),
    build('d', 40, 1, { priority: 1, paused: true }),
  ];
  const over = plan(snap({ window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed', isUsingOverage: true }, sessions }));
  assert.match(over.pause.rule, /one per tick, until the brake is none \(isUsingOverage false\)/);
  assert.deepEqual(over.pause.recommend, ['a']);
  assert.equal(over.pause.needed, true);
  assert.deepEqual(over.resume.ids, []);
  assert.equal(over.reserve.sessions.length, 4);
  const ok = plan(snap({ sessions, queue: [{ id: 'q', kind: 'review' }] }));
  assert.deepEqual(ok.resume.ids, ['c', 'd', 'b']); // priority first, then the most progress (nearly done work finishes)
  assert.equal(ok.resume.next, 'c');
  assert.match(ok.resume.rule, /one per tick/);
  assert.equal(ok.pause.needed, false);
  assert.match(ok.summary, /resume c, d, b now/); // all three fit together under $1000 (resume.all)
  assert.equal(ok.spend.windowUsd, 85);
  // paused sessions keep their reserve: a 40 − 5; b and d burn ($30, $40 over 0.98h) × 0.77h (active age 0.98h); c 40 − 10
  assert.ok(near(ok.reserve.totalUsd, 35 + (30 / 0.98) * 0.77 + 30 + (40 / 0.98) * 0.77, 0.02));
  const bad = plan(snap({ sessions: [build('x', 5, 1, { paused: 'yes' })] }));
  assert.ok(codes(bad).includes('bad-paused'));
});

test('cap: a rejection in a newer window than the warning calibrates alone; the clamp message names its reading', () => {
  const R0 = '2026-10-29T00:00:00Z', R1 = '2026-11-05T00:00:00Z';
  const history = [
    { at: '2026-10-27T00:00:00Z', totalCostUsd: 600, status: 'allowed', resetsAt: R0 },
    { at: '2026-10-27T01:00:00Z', totalCostUsd: 750, status: 'allowed_warning', resetsAt: R0 },
    { at: '2026-11-01T06:00:00Z', totalCostUsd: 850, status: 'allowed', resetsAt: R1 },
    { at: '2026-11-01T07:00:00Z', totalCostUsd: 1150, status: 'rejected', resetsAt: R1 },
  ];
  const p = plan({ now: '2026-11-01T08:00:00Z', window: { type: 'seven_day', status: 'rejected', resetsAt: R1 }, queue: [{ id: 'q', estimateUsd: 1 }], history });
  assert.ok(near(p.cap.low!, 1133.33) && near(p.cap.high!, 1150), JSON.stringify(p.cap));
  assert.equal(p.cap.calibratedFrom?.warning, undefined);
  assert.equal(p.cap.calibratedFrom?.rejected?.spendUsd, 1150);
  const clamp = plan(snap({ config: {}, window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'rejected' }, sessions: [build('a', 700, 5, { done: true })], history: [{ at: ago(2), totalCostUsd: 600, status: 'allowed' }] }));
  const issue = clamp.issues.find((i) => i.code === 'lower-bound-clamped');
  assert.match(issue!.detail, /rejected reading at \$700\.00/);
  assert.match(issue!.detail, new RegExp(iso(NOW).slice(0, 16)));
});

test('cap: a non-rejected reading in this window above the calibrated high disproves it: the cap is unknown again', () => {
  const p = plan(snap({
    config: {},
    window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed_warning' },
    sessions: [build('a', 900, 5, { done: true })],
    history: [{ at: ago(2), totalCostUsd: 600, status: 'allowed_warning' }],
  }));
  assert.deepEqual([p.cap.source, p.cap.high], ['unknown', null]); // 600 / 0.75 = 800, but $900 spent without a rejection
  assert.ok(codes(p).includes('cap-disproved'));
  assert.equal(p.cap.lowerBoundUsd, 900);
});

test('summary: fill decides "queue more work"; the cap-hit time is information only', () => {
  const p = plan(snap({ config: { capUsd: 500 }, sessions: [build('a', 300, 6, { lastActiveAt: iso(NOW) })] })); // $50/h: cap hit in 4h
  assert.equal(p.projection.capHitBeforeReset, true);
  assert.ok(p.fill.recommendAdmitUsd! > 0);
  assert.match(p.summary, /cap hit ~12:55Z/);
  assert.match(p.summary, /unused: queue more work \(cap hit ~12:55Z at current burn, information only\)/);
  const tomorrow = plan(snap({ now: iso(NOW - 10 * H), window: { type: 'seven_day', resetsAt: (NOW + 30 * H) / 1000, status: 'allowed' }, config: { capUsd: 1000 },
    sessions: [build('b', 50, 11, { startedAt: iso(NOW - 11 * H), lastActiveAt: iso(NOW - 10 * H) })] }));
  // $50 over 1h = $50/h; (1000 − 50) / 50 = 19h after 22:55Z → 2026-11-01T17:55Z, the next calendar day
  assert.match(tomorrow.summary, /cap hit ~2026-11-01 17:55Z/);
});

test('reserve: work that runs past the reset is charged to this window only up to the reset', () => {
  const now = RESET - 0.5 * H;
  const s = (over: Record<string, unknown>) => snap({ now: iso(now), sessions: [{ id: 'a', kind: 'build', costUsd: 10, startedAt: iso(now - 0.5 * H), lastActiveAt: iso(now) }], ...over });
  const p = plan(s({ config: { capUsd: 100 } }));
  const r = p.reserve.sessions[0];
  assert.deepEqual([r.remaining.low, r.remaining.point, r.remaining.high], [25, 30, 90]); // 1.25h left, $20/h burn
  assert.deepEqual([r.inWindow.low, r.inWindow.point, r.inWindow.high], [10, 12, 36]); // 0.5 of its 1.25h before the reset
  assert.equal(r.carriesOverUsd, 18);
  assert.equal(p.reserve.totalUsd, 12);
  // fill: in-window per item at 0.5h: council 18, build 11.43, build:small 9, review 3; unused 100 − 10 − 12 = 78.
  // Counts are limited by this window (78 / in-window) and by the next (100 − 18 carried, / each item's carry-over).
  assert.ok(near(p.fill.expectedUnusedUsd!, 78));
  assert.deepEqual(p.fill.suggestions.map((x) => [x.kind, x.phase, x.inWindowUsd, x.count]),
    [['council', null, 18, 3], ['build', null, 11.43, 2], ['build', 'small', 9, 8], ['review', null, 3, 26]]);
  // A new build's low $20 does not fit in the $18 left, but its in-window part ($20 × 0.5/1.75) does.
  const q = plan(s({ config: { capUsd: 40 }, queue: [{ id: 'q', kind: 'build' }] }));
  assert.deepEqual(q.admit.map((a) => a.id), ['q']);
  assert.ok(near(q.admit[0].inWindow.low, 5.71));
  // Without a usable reset time nothing is clipped.
  const none = plan({ ...s({}), window: { type: 'seven_day', status: 'allowed' } });
  assert.deepEqual(none.reserve.sessions[0].inWindow, none.reserve.sessions[0].remaining);
});

test('remaining cost: lifetime burn counts from 10 minutes, a recent reading from 5, or once spent ≥ the low prior', () => {
  const at8 = remainingCost(sess('build', 15, 8 / 60), NOW, RESET);
  assert.equal(at8.basis, 'prior'); // 8 minutes old, $15 < low $20, no recent reading
  const recent = remainingCost(sess('build', 15, 8 / 60, 0, { recent: { costUsd: 11, atMs: NOW - 6 * 60_000 } }), NOW, RESET);
  assert.equal(recent.basis, 'burn'); // $4 in 6 minutes = $40/h × 1.37h
  const at12 = remainingCost(sess('build', 15, 12 / 60), NOW, RESET);
  assert.equal(at12.basis, 'burn'); // $15 over 15 minutes = $60/h × 1.3h = $78
});

test('epsilon: running work exactly at the cap fits, with no running-over-cap issue; warning only for a usable window', () => {
  const p = plan({ now: '2026-11-01T08:30:00Z', window: { type: 'seven_day', status: 'allowed', resetsAt: '2026-11-05T00:00:00Z' },
    config: { capUsd: 0.3, priors: { review: { low: 0.2, point: 0.2, high: 0.2, floorUsd: 0.2 } } },
    sessions: [{ id: 'd', kind: 'build', costUsd: 0.1, startedAt: '2026-11-01T08:00:00Z', lastActiveAt: '2026-11-01T08:10:00Z', done: true },
      { id: 'r', kind: 'review', costUsd: 0, startedAt: '2026-11-01T08:29:00Z', lastActiveAt: '2026-11-01T08:29:00Z' }] });
  assert.equal(p.projection.runningFits, true);
  assert.ok(!codes(p).includes('running-over-cap'));
  assert.equal(p.projection.overshoot.risk, 'possible'); // high 0.2 × 1.5 is over the low end
  const ahead = plan({ now: '2026-11-01T08:30:00Z', window: { type: 'five_hour', status: 'allowed_warning', resetsAt: '2026-11-03T10:00:00Z' } });
  assert.equal(ahead.warning, false);
});

test('brakes: a bad window is its own brake; unknown-status and bad-window give no nextAdmitAt (re-plan every tick)', () => {
  const q = [{ id: 'q', kind: 'review' }];
  const status = plan(snap({ window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'junk' }, queue: q }));
  assert.equal(status.brake, 'unknown-status');
  assert.equal(status.queued[0].nextAdmitAt, null);
  assert.equal(status.queued[0].reasonCode, 'brake');
  const ahead = plan(snap({ window: { type: 'five_hour', resetsAt: (NOW + 30 * H) / 1000, status: 'allowed' }, queue: q }));
  assert.equal(ahead.brake, 'bad-window');
  assert.equal(ahead.queued[0].nextAdmitAt, null);
  const rejected = plan(snap({ window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'rejected' }, queue: q }));
  assert.equal(rejected.queued[0].nextAdmitAt, rejected.window.resetsAt);
});

test('window: after a rollover the status is null and statusAssumed says allowed', () => {
  const p = plan(snap({ window: { type: 'seven_day', resetsAt: (NOW - H) / 1000, status: 'rejected' } }));
  assert.deepEqual([p.window.status, p.window.statusAssumed, p.brake], [null, 'allowed', 'none']);
  assert.equal(plan(snap()).window.statusAssumed, null);
});

test('window: isUsingOverage accepts booleans and "true"/"false"; anything else is an error and brakes', () => {
  const o = (v: unknown) => plan(snap({ window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed', isUsingOverage: v } }));
  assert.equal(o(true).brake, 'overage');
  assert.equal(o(undefined).brake, 'none');
  assert.equal(o('true').brake, 'overage');
  assert.ok(codes(o('true')).includes('bad-overage'));
  assert.equal(o('false').brake, 'none');
  const junk = o('yes');
  assert.equal(junk.brake, 'overage');
  assert.ok(junk.issues.some((i) => i.code === 'bad-overage' && i.level === 'error'));
});

test('robust: money above $1e12 or not a number is an error-level issue (counted as 0)', () => {
  const p = plan(snap({ sessions: [build('a', 2e12, 1), build('b', 'lots', 1)] }));
  assert.equal(p.issues.filter((i) => i.code === 'bad-cost' && i.level === 'error').length, 2);
  assert.equal(p.spend.windowUsd, 0);
});

test('kind: "build:small" is accepted as kind build, phase small, in sessions and the queue', () => {
  const p = plan(snap({ sessions: [{ ...build('s', 1, 0.05), kind: 'build:small' }], queue: [{ id: 'q', kind: 'build:small' }] }));
  assert.deepEqual([p.reserve.sessions[0].kind, p.reserve.sessions[0].phase], ['build', 'small']);
  assert.deepEqual([p.admit[0].kind, p.admit[0].phase], ['build', 'small']);
  assert.deepEqual(p.admit[0].estimate, { low: 5, point: 9, high: 15 });
  assert.ok(!codes(p).includes('unknown-kind'));
});

test('queued: reasonCode for each case, and an over-cap reason with the real shortfall when the reserve already exceeds the cap', () => {
  const p = plan(snap({ config: { capUsd: 100 }, sessions: [build('x', 10, 1)],
    queue: [{ id: 'x', kind: 'build' }, { id: 'big', kind: 'build', priority: 2, estimateUsd: 500 }, { id: 'small', kind: 'review', priority: 1 }] }));
  assert.deepEqual(p.queued.map((q) => [q.id, q.reasonCode]), [['big', 'over-cap'], ['small', 'behind'], ['x', 'already-running']]);
  const over = plan(snap({ config: { capUsd: 30 }, sessions: [build('a', 10, 1)], queue: [{ id: 'q', kind: 'review' }] })); // 10 + 30 > 30
  assert.match(over.queued[0].reason, /already exceeds the cap's high end by \$10\.00/);
});

test('config: admitAt "point" admits at point estimates; at low a deep queue can be reported likely over', () => {
  const s = (admitAt?: string) => plan(snap({ config: { capUsd: 100, admitAt }, queue: [1, 2, 3, 4].map((i) => ({ id: `q${i}`, kind: 'build' })) }));
  const low = s();
  assert.equal(low.admit.length, 4); // 4 × low $20 = $80 ≤ $100
  assert.equal(low.projection.overshoot.risk, 'likely'); // 4 × point $45 = $180
  assert.match(low.projection.overshoot.note!, /admitAt/);
  const point = s('point');
  assert.equal(point.admit.length, 2); // 2 × $45 = $90
  assert.ok(codes(s('high')).includes('bad-config'));
});

test('cap: the allowed reading for the low end comes from the warning\'s own window only', () => {
  const r = estimateCap([
    { atMs: NOW - 8 * DAY, totalCostUsd: 500, status: 'allowed', resetsAtMs: RESET - 7 * DAY },
    { atMs: NOW - H, totalCostUsd: 600, status: 'allowed_warning', resetsAtMs: RESET },
  ], { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.deepEqual([r.low, r.high], [600, 800]); // not 500 / 0.75 from the older window
});

test('projection: paused sessions keep their reserve but add nothing to the burn', () => {
  const p = plan(snap({ sessions: [build('a', 10, 1, { lastActiveAt: iso(NOW) }), build('b', 30, 1, { lastActiveAt: iso(NOW), paused: true })] }));
  assert.ok(near(p.projection.burnUsdPerHour, 10));
  assert.equal(p.reserve.sessions.length, 2);
});

test('epsilon: running high figures exactly at the cap\'s low end fit with safety', () => {
  const p = plan({ now: '2026-11-01T08:30:00Z', window: { type: 'seven_day', status: 'allowed', resetsAt: '2026-11-05T00:00:00Z' },
    config: { capUsd: 0.3, safety: 1, priors: { review: { low: 0.2, point: 0.2, high: 0.2, floorUsd: 0.2 } } },
    sessions: [{ id: 'd', kind: 'build', costUsd: 0.1, startedAt: '2026-11-01T08:00:00Z', lastActiveAt: '2026-11-01T08:10:00Z', done: true },
      { id: 'r', kind: 'review', costUsd: 0, startedAt: '2026-11-01T08:29:00Z', lastActiveAt: '2026-11-01T08:29:00Z' }] });
  assert.equal(p.projection.runningFitsWithSafety, true); // 0.1 + 0.2 = 0.30000000000000004
});

// --- 12. Review round 3 -----------------------------------------------------------------------------------------------

test('carry-over: near the reset, admission also keeps what new work carries into the next window under the cap', () => {
  const s = (config: Record<string, unknown>) => snap({ now: iso(RESET - 0.3 * H), config,
    queue: Array.from({ length: 40 }, (_, i) => ({ id: `b${String(i).padStart(2, '0')}`, kind: 'build' })) });
  const p = plan(s({ capUsd: 300 }));
  // each build: in-window low 20 × 0.3/1.75 = $3.43 (this window has room for all 40), carry-over $16.57: 18 fit next window
  assert.equal(p.admit.length, 18);
  assert.equal(p.queued[0].reasonCode, 'over-next-window');
  assert.match(p.queued[0].reason, /next window/);
  assert.ok(p.projection.overshoot.nextWindowCarryUsd > 0);
  assert.ok(near(p.capacity.nextWindowHeadroomUsd!, 300));
  assert.equal(plan(s({})).admit.length, 40); // cap unknown: no test
});

test('orchestrator: its remaining hours look ahead at most 24h (config.orchestratorLookaheadHours)', () => {
  const s = (config: Record<string, unknown>) => ({ now: '2026-11-01T16:00:00Z', window: { rateLimitType: 'seven_day', resetsAt: '2026-11-08T15:00:00Z', status: 'allowed' }, config,
    sessions: [{ id: 'orch', kind: 'orchestrator', costUsd: 100, startedAt: '2026-10-30T09:00:00Z', lastActiveAt: '2026-11-01T15:59:00Z', recent: { costUsd: 98, at: '2026-11-01T15:50:00Z' } }],
    queue: [{ id: 'f5-build', kind: 'build', priority: 4 }, { id: 'rev1', kind: 'review' }] });
  const p = plan(s({ capUsd: 1200 }));
  const o = p.reserve.sessions[0];
  assert.equal(o.remainingHours, 24);
  assert.ok(near(o.remaining.point, 12 * 24)); // $2 in 10 minutes
  assert.deepEqual(p.admit.map((a) => a.id), ['f5-build', 'rev1']);
  assert.equal(plan(s({ capUsd: 1200, orchestratorLookaheadHours: 48 })).reserve.sessions[0].remainingHours, 48);
  assert.ok(codes(plan(s({ capUsd: 1200, orchestratorLookaheadHours: -1 }))).includes('bad-config'));
});

test('fill: while the queue is blocked by strict priority it recommends nothing and names the blocker', () => {
  const p = plan(snap({ config: { capUsd: 300 }, queue: [{ id: 'huge', kind: 'build', priority: 9, estimateUsd: 500 }, { id: 'rev', kind: 'review' }] }));
  assert.deepEqual(p.queued.map((q) => q.reasonCode), ['over-cap', 'behind']);
  assert.ok(near(p.fill.expectedUnusedUsd!, 300));
  assert.equal(p.fill.recommendAdmitUsd, 0);
  assert.equal(p.fill.blockedBy, 'huge');
  assert.match(p.fill.message, /blocked behind huge/);
  assert.match(p.fill.message, /above its priority|splitting|lowering/);
  assert.match(p.summary, /blocked behind huge/);
  assert.doesNotMatch(p.summary, /queue more work/);
});

test('brakes: a real rejected or overage status is not hidden by a bad window', () => {
  const sessions = [build('a', 10, 1), build('b', 20, 1)];
  const q = [{ id: 'q', kind: 'review' }];
  const rej = plan(snap({ window: { type: 'seven_day', status: 'rejected' }, sessions, queue: q }));
  assert.equal(rej.brake, 'rejected');
  assert.equal(rej.pause.stallRisk, true);
  assert.deepEqual(rej.pause.recommend, ['a', 'b']);
  assert.equal(rej.queued[0].nextAdmitAt, null); // the window is unknown, so there is no reset to wait for
  assert.equal(plan(snap({ window: { type: 'seven_day', status: 'allowed', isUsingOverage: true }, sessions })).brake, 'overage');
  assert.equal(plan(snap({ window: { type: 'five_hour', status: 'rejected', resetsAt: (NOW + 30 * H) / 1000 }, sessions })).brake, 'rejected');
  assert.equal(plan(snap({ window: { type: 'seven_day', status: 'allowed' }, sessions })).brake, 'bad-window');
});

test('history: an entry of a newer or overlapping window of the same type is ignored', () => {
  const now = '2026-11-01T08:00:00Z';
  const p = plan({ now, config: {}, window: { type: 'seven_day', status: 'allowed', resetsAt: '2026-11-02T00:00:00Z' },
    history: [{ at: '2026-11-01T07:00:00Z', totalCostUsd: 5, status: 'rejected', type: 'seven_day', resetsAt: '2026-11-06T00:00:00Z' }] });
  assert.equal(p.cap.source, 'unknown');
  assert.ok(codes(p).includes('history-other-window'));
});

test('robust: recent.costUsd follows the money rules; windowKnown "false"; unparseable history resetsAt; overage null and after rollover', () => {
  const W = { type: 'seven_day', status: 'allowed', resetsAt: '2026-11-05T00:00:00Z' };
  const s = { id: 'a', kind: 'build', costUsd: 10, startedAt: '2026-11-01T07:00:00Z', lastActiveAt: '2026-11-01T07:59:00Z' };
  const lv = (p: Plan, code: string) => p.issues.filter((i) => i.code === code).map((i) => i.level);
  const str = plan({ now: '2026-11-01T08:00:00Z', window: W, sessions: [{ ...s, recent: { costUsd: '5', at: '2026-11-01T07:30:00Z' } }] });
  assert.ok(codes(str).includes('string-number'));
  assert.ok(near(str.reserve.sessions[0].burnUsdPerHour, 10)); // $5 in 30 minutes
  assert.deepEqual(lv(plan({ now: '2026-11-01T08:00:00Z', window: W, sessions: [{ ...s, recent: { costUsd: 'lots', at: '2026-11-01T07:30:00Z' } }] }), 'bad-recent'), ['error']);
  const wk = plan({ now: '2026-11-01T08:00:00Z', config: {}, window: W, history: [{ at: '2026-11-01T07:00:00Z', totalCostUsd: 300, status: 'allowed_warning', windowKnown: 'false', type: 'seven_day' }] });
  assert.equal(wk.cap.source, 'unknown');
  assert.ok(codes(wk).includes('history-no-window'));
  const br = plan({ now: '2026-11-01T08:00:00Z', config: {}, window: W, history: [{ at: '2026-11-01T07:00:00Z', totalCostUsd: 8, status: 'allowed_warning', type: 'seven_day', resetsAt: 'garbage' }] });
  assert.equal(br.cap.source, 'unknown');
  assert.ok(codes(br).includes('bad-history'));
  const on = plan({ now: '2026-11-01T08:00:00Z', window: { ...W, isUsingOverage: null } });
  assert.equal(on.brake, 'none');
  assert.ok(!codes(on).includes('bad-overage'));
  const ro = plan({ now: '2026-11-01T08:00:00Z', window: { ...W, resetsAt: '2026-11-01T07:00:00Z', isUsingOverage: 'yes' } });
  assert.equal(ro.brake, 'none');
  assert.deepEqual(lv(ro, 'bad-overage'), ['warn']);
  const rt = plan({ now: '2026-11-01T08:00:00Z', window: { type: 'seven_day', resetsAt: '2026-11-01T07:00:00Z', isUsingOverage: 'true' } });
  assert.ok(codes(rt).includes('stale-status'));
});

test('robust: BigInt and circular values in the snapshot never throw', () => {
  const circular: Record<string, unknown> = { a: 1 };
  circular.o = circular;
  for (const v of [{ now: 1n }, { now: iso(NOW), sessions: [{ id: 'a', costUsd: 5n, kind: 1n }] }, { now: circular }, snap({ queue: [{ id: 'q', kind: circular, priority: 2n }] })]) {
    assert.doesNotThrow(() => plan(v));
  }
});

test('projection: a session too young for its burn to count projects at least its prior\'s average rate', () => {
  const p = plan(snap({ sessions: [{ id: 'c', kind: 'council', costUsd: 1, startedAt: ago(5 / 60), lastActiveAt: iso(NOW) }] }));
  assert.ok(near(p.projection.burnUsdPerHour, 36)); // max($4/h, 45 / 1.25h)
  assert.ok(near(p.reserve.sessions[0].projectedBurnUsdPerHour, 36));
  const nov = plan(nov1({ capUsd: 1500 }));
  assert.match(nov.summary, /unused: queue more work/);
  assert.match(nov.summary, /cap hit ~\d\d:\d\dZ at current burn, information only/);
});

test('remaining cost: an overrun session keeps half its overrun as remaining hours; past the reset it carries over', () => {
  const r = remainingCost(sess('council', 60, 4.25), NOW, NOW + 10 * H); // 3h over its 1.25h
  assert.ok(near(r.remainingHours, 1.5, 1e-9));
  assert.ok(near(remainingCost(sess('council', 60, 4.25), NOW, NOW + H).remainingHours, 1.5, 1e-9));
  const p = plan(snap({ now: iso(RESET - H), sessions: [{ id: 'c', kind: 'council', costUsd: 60, startedAt: iso(RESET - 5.25 * H), lastActiveAt: iso(RESET - H) }] }));
  const c = p.reserve.sessions[0];
  assert.ok(near(c.inWindow.point, c.remaining.point / 1.5, 0.02)); // 1 of its 1.5 hours before the reset
  assert.ok(c.carriesOverUsd > 0);
  assert.ok(near(remainingCost(sess('council', 60, 1.3), NOW, RESET).remainingHours, 0.25, 1e-9)); // tail
});

test('resume: only while running work fits; summary names the next one', () => {
  const sessions = [build('p', 10, 1, { paused: true }), build('a', 10, 1)];
  const ok = plan(snap({ config: { capUsd: 1000 }, sessions }));
  assert.equal(ok.resume.next, 'p');
  assert.match(ok.summary, /resume p now/);
  const tight = plan(snap({ config: { capUsd: 50 }, sessions })); // 20 + 30 + 30 > 50
  assert.equal(tight.projection.runningFits, false);
  assert.deepEqual(tight.resume.ids, ['p']);
  assert.equal(tight.resume.next, null);
  assert.doesNotMatch(tight.summary, /resume p now/);
  assert.equal(plan(snap()).pause.next, null);
});

test('fill: suggestions are "any one of" the kinds', () => {
  const p = plan(snap({ config: { capUsd: 300 } }));
  assert.match(p.fill.message, /any one of: /);
});

test('summary: running work over the cap, cap reached, brake reset times and the admitted ids', () => {
  const over = plan(snap({ config: { capUsd: 30 }, sessions: [build('a', 10, 1)] }));
  assert.match(over.summary, /running work over cap by \$10\.00/);
  const reached = plan(snap({ config: { capUsd: 30 }, sessions: [build('a', 30, 1, { done: true })] }));
  assert.match(reached.summary, /cap reached/);
  const rej = plan(snap({ window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'rejected' } }));
  assert.match(rej.summary, /~15:00Z/);
  const many = plan(snap({ queue: ['a', 'b', 'c', 'd'].map((id) => ({ id, kind: 'review' })) }));
  assert.match(many.summary, /Admit 4 of 4 queued \(a, b, c \+1 more\)/);
});

test('issues: clamp names the reading that set the high end; bad-status is an error; status case; burn-mismatch mentions paused; now missing', () => {
  const raised = plan(snap({ config: {}, window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'rejected' },
    sessions: [build('a', 900, 5, { done: true })],
    history: [{ at: ago(3), totalCostUsd: 600, status: 'allowed_warning' }, { at: ago(2), totalCostUsd: 900, status: 'allowed' }, { at: ago(1), totalCostUsd: 950, status: 'rejected' }] }));
  // $900 spent, over 10% above the warning's 800 high, then rejected at $950: the rejection sets the cap (round 5;
  // input moved from $880 in round 8, where up to 10% raises high and a rejection only lowers it)
  assert.equal(raised.cap.high, 950);
  const clamp = raised.issues.find((i) => i.code === 'lower-bound-clamped');
  assert.ok(clamp, JSON.stringify(raised.issues));
  assert.match(clamp.detail, /rejected reading at \$950\.00/);
  const bad = plan(snap({ window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'junk' } }));
  assert.deepEqual(bad.issues.filter((i) => i.code === 'bad-status').map((i) => i.level), ['error']);
  const upper = plan(snap({ window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'ALLOWED' } }));
  assert.equal(upper.brake, 'none');
  assert.ok(codes(upper).includes('status-case'));
  const s = snap({ sessions: [build('a', 100, 2, { lastActiveAt: iso(NOW) })], history: [{ at: ago(0.5), totalCostUsd: 0, status: 'allowed' }] });
  assert.match(plan(s).issues.find((i) => i.code === 'burn-mismatch')!.detail, /paused/);
  assert.match(plan({ window: {} }).issues.find((i) => i.code === 'bad-now')!.detail, /now is missing/);
});

test('2026-11-01 data 0.3h before reset with 40 queued builds: carry-over at low fits, the point case is flagged, and only short work is suggested', () => {
  const s = nov1({ capUsd: 1500 });
  s.window = { type: 'seven_day', resetsAt: Date.parse('2026-11-01T08:55:00Z') / 1000 + 0.3 * 3600, status: 'allowed', isUsingOverage: false };
  s.queue = Array.from({ length: 40 }, (_, i) => ({ id: `b${String(i).padStart(2, '0')}`, kind: 'build', priority: 1 }));
  const p = plan(s);
  const carry = p.reserve.sessions.reduce((t, r) => t + r.carriesOverUsd, 0) + p.admit.reduce((t, a) => t + a.estimate.low - a.inWindow.low, 0);
  assert.ok(carry <= 1500 + 0.5, `carry ${carry}`);
  assert.equal(p.projection.overshoot.nextWindowFits, false); // at point estimates the next window starts over the cap
  assert.match(p.projection.overshoot.note!, /next window/);
  assert.deepEqual(p.fill.suggestedKinds, ['review']); // only work that finishes before the reset still fits
});

test('fill: unused budget that no kind fits recommends nothing', () => {
  const p = plan(snap({ config: { capUsd: 2 } })); // $2 left; the cheapest kind (review) costs $3
  assert.ok(near(p.fill.expectedUnusedUsd!, 2));
  assert.equal(p.fill.recommendAdmitUsd, 0);
  assert.match(p.fill.message, /none fits/);
  assert.doesNotMatch(p.summary, /queue more work/);
});

test('remaining cost: a session within its typical hours but closer to the end than its tail keeps the tail', () => {
  assert.ok(near(remainingCost(sess('build', 30, 1.7), NOW, RESET).remainingHours, 0.25, 1e-9)); // 0.05h left of 1.75h
});

test('carry-over: running work\'s carry-over counts against the next window, and a later item waits behind the first misfit', () => {
  const now = RESET - 0.5 * H;
  const running = [{ id: 'a', kind: 'build', costUsd: 10, startedAt: iso(now - 0.5 * H), lastActiveAt: iso(now) }]; // carries $18
  const p = plan(snap({ now: iso(now), config: { capUsd: 40 }, sessions: running,
    queue: [{ id: 'q1', kind: 'build', priority: 2 }, { id: 'q2', kind: 'build', priority: 2 }, { id: 'r', kind: 'review', priority: 1 }] }));
  // next window: 40 − 18 = 22 left; each build carries $14.29 at its low estimate, so only one fits
  assert.ok(near(p.capacity.nextWindowHeadroomUsd!, 22));
  assert.deepEqual(p.admit.map((a) => a.id), ['q1']);
  assert.deepEqual(p.queued.map((q) => [q.id, q.reasonCode]), [['q2', 'over-next-window'], ['r', 'behind']]); // r carries nothing but waits
});

// --- 13. Review round 4 -----------------------------------------------------------------------------------------------

test('carry-over: an item that carries nothing past the reset is not bound by the next-window test', () => {
  const now = RESET - 0.5 * H;
  const running = ['a', 'b'].map((id) => ({ id, kind: 'build', costUsd: 2, startedAt: iso(now - 0.5 * H), lastActiveAt: iso(now) })); // carry $22.80 each
  const p = plan(snap({ now: iso(now), config: { capUsd: 45 }, sessions: running, queue: [{ id: 'r', kind: 'review' }, { id: 's', kind: 'build:small', priority: -1 }] }));
  assert.ok(p.capacity.nextWindowHeadroomUsd! < 0);
  assert.deepEqual(p.admit.map((a) => a.id), ['r', 's']); // both finish before the reset
});

test('cap: spend above a calibrated high disproves it; a rejection followed by allowed spend at or above it is cleared', () => {
  const now = Date.parse('2026-11-01T12:00:00Z'), reset = Date.parse('2026-11-05T15:00:00Z');
  const p = plan({ now: iso(now), window: { type: 'seven_day', status: 'allowed_warning', resetsAt: iso(reset) }, config: {},
    sessions: [{ id: 'a', kind: 'build', costUsd: 450, startedAt: iso(now - 5 * H), lastActiveAt: iso(now), done: true }], // over 10% above high (round 7 tolerance)
    history: [{ at: iso(now - 3 * H), totalCostUsd: 280, status: 'allowed', type: 'seven_day', resetsAt: iso(reset) },
      { at: iso(now - 2 * H), totalCostUsd: 300, status: 'allowed_warning', type: 'seven_day', resetsAt: iso(reset) }],
    queue: [{ id: 'q', kind: 'review' }] });
  assert.equal(p.cap.source, 'unknown'); // high 300 / 0.75 = 400; the $450 spent without a rejection is over 10% above it
  assert.ok(codes(p).includes('cap-disproved'));
  assert.equal(p.cap.lowerBoundUsd, 450);
  assert.deepEqual(p.admit.map((a) => a.id), ['q']);
  const cleared = plan(snap({ config: {}, sessions: [build('a', 650, 5, { done: true })],
    history: [{ at: ago(3), totalCostUsd: 500, status: 'allowed' }, { at: ago(2), totalCostUsd: 600, status: 'rejected' }, { at: ago(1), totalCostUsd: 650, status: 'allowed' }] }));
  assert.equal(cleared.cap.source, 'unknown');
  assert.ok(codes(cleared).includes('rejection-cleared'));
});

test('resume: the next paused session is the first that fits with the work actually running; with nothing running, the first', () => {
  const sessions = [build('a', 10, 1), build('p', 10, 1, { paused: true }), { id: 'r', kind: 'review', costUsd: 0.5, startedAt: ago(0.1), lastActiveAt: iso(NOW), paused: true }];
  // spend 20.5; running a: 30; p would add 30 (80.5 > 55), r would add 2.5 (53 ≤ 55)
  const p = plan(snap({ config: { capUsd: 55 }, sessions }));
  assert.deepEqual(p.resume.ids, ['p', 'r']);
  assert.equal(p.resume.next, 'r');
  assert.match(p.summary, /resume r now/);
  const none = plan(snap({ config: { capUsd: 40 }, sessions }));
  assert.equal(none.resume.next, null);
  assert.match(none.summary, /holding 2 paused/);
  // Everything but the orchestrator is paused: always resume the first, whatever the cap.
  const all = plan(snap({ config: { capUsd: 10 }, sessions: [build('p', 10, 1, { paused: true }),
    { id: 'orch', kind: 'orchestrator', costUsd: 50, startedAt: ago(40), lastActiveAt: iso(NOW), paused: true }] }));
  assert.equal(all.resume.next, 'p');
  assert.deepEqual(all.resume.ids, ['p']); // a paused orchestrator is never listed
  assert.equal(plan(snap({ config: {}, sessions })).resume.next, 'p'); // cap unknown: the first
});

test('orchestrator: what it will spend after the reset, up to its lookahead, counts against the next window', () => {
  const s = snap({ now: iso(RESET - 2 * H), config: { capUsd: 500 },
    sessions: [{ id: 'orch', kind: 'orchestrator', costUsd: 100, startedAt: iso(RESET - 50 * H), lastActiveAt: iso(RESET - 2 * H), recent: { costUsd: 98, at: iso(RESET - 2 * H - 10 * 60_000) } }] });
  const p = plan(s);
  const o = p.reserve.sessions[0];
  assert.ok(near(o.inWindow.point, 24)); // $12/h × 2h to the reset
  assert.ok(near(o.carriesOverUsd, 12 * 22)); // and 22 more hours of its 24h lookahead
  assert.ok(near(p.capacity.nextWindowHeadroomUsd!, 500 - 264));
});

test('projection: a prior-basis session projects at its observed burn, not its reserve\'s rate', () => {
  const p = plan(snap({ sessions: [build('a', 10, 1, { lastActiveAt: iso(NOW) })] }));
  assert.ok(near(p.reserve.sessions[0].projectedBurnUsdPerHour, 10)); // not $30 over its 0.75h
  assert.ok(near(p.reserve.sessions[0].burnUsdPerHour, 10));
});

test('history: resetsAt values within 60 seconds name the same window', () => {
  const p = plan(snap({ config: {}, window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed_warning' },
    history: [{ at: ago(1), totalCostUsd: 300, status: 'allowed_warning', type: 'seven_day', resetsAt: (RESET + 30_000) / 1000 }] }));
  assert.equal(p.cap.source, 'calibrated');
  assert.equal(p.cap.calibratedFrom?.resetsAt, iso(RESET));
  assert.equal(p.spend.windowUsd, 300); // the floor from this window's reading
  assert.ok(!codes(p).includes('history-other-window'));
});

test('summary and texts: over-cap amount matches the issue; no split advice when running work alone is over; rejected+overage rule', () => {
  // unrounded: 10.004 + 30 − 30.006 = 9.998 → $10.00 (from rounded figures it would read 40.00 − 30.01 = $9.99)
  const over = plan(snap({ config: { capUsd: 30.006 }, sessions: [build('a', 10, 1), build('d', 0.004, 1, { done: true })], queue: [{ id: 'q', kind: 'review' }] }));
  const issue = over.issues.find((i) => i.code === 'running-over-cap')!;
  const amount = /\$(\d+\.\d\d) over/.exec(issue.detail)![1];
  assert.match(over.summary, new RegExp(`running work over cap by \\$${amount.replace('.', '\\.')}`));
  assert.match(over.fill.message, /running work alone/);
  assert.doesNotMatch(over.fill.message, /splitting/);
  const both = plan(snap({ window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'rejected', isUsingOverage: true }, sessions: [build('a', 10, 1)] }));
  assert.match(both.pause.rule, /status allowed or allowed_warning and isUsingOverage false/);
});

test('summary: a cap hit before reset is shown on its own when fill asks for nothing', () => {
  const p = plan(snap({ config: { capUsd: 113 }, sessions: [build('a', 100, 2, { lastActiveAt: iso(NOW) })] })); // $0.50 unused: nothing fits
  assert.equal(p.fill.recommendAdmitUsd, 0);
  assert.match(p.summary, /cap hit ~\d\d:\d\dZ at current burn/);
  assert.doesNotMatch(p.summary, /information only/);
});

test('cap: a rejection is cleared only by a later non-rejected reading at or above it; the readings passed in are not changed', () => {
  const r = (atH: number, usd: number, status: string) => ({ atMs: NOW - atH * H, totalCostUsd: usd, status, resetsAtMs: RESET });
  const opts = { warnFraction: 0.75, currentResetsAtMs: RESET };
  const below = estimateCap([r(3, 500, 'allowed'), r(2, 600, 'rejected'), r(1, 550, 'allowed')], opts);
  assert.deepEqual([below.source, below.high], ['calibrated', 600]); // $550 after it does not clear $600
  const earlier = estimateCap([r(3, 600, 'allowed'), r(1, 600, 'rejected')], opts);
  assert.deepEqual([earlier.source, earlier.high], ['calibrated', 600]); // a reading before the rejection does not clear it
  const readings = [r(4, 500, 'allowed_warning'), r(2, 600, 'rejected'), r(1, 610, 'allowed')];
  const cleared = estimateCap(readings, opts);
  assert.equal(cleared.source, 'calibrated'); // the warning's 500 / 0.75 stands once the rejection has cleared
  assert.ok(near(cleared.high!, 666.67));
  assert.equal(readings[1].status, 'rejected');
});

test('resume: a paused session that fits this window but carries too much into the next stays paused', () => {
  const now = RESET - 0.5 * H;
  const b = (id: string, paused = false) => ({ id, kind: 'build', costUsd: 2, startedAt: iso(now - 0.5 * H), lastActiveAt: iso(now), paused });
  const p = plan(snap({ now: iso(now), config: { capUsd: 45 }, sessions: [b('a'), b('p', true)] }));
  // this window: 4 + 15.2 + 15.2 ≤ 45; next window: 22.8 + 22.8 > 45
  assert.equal(p.resume.next, null);
});

test('orchestrator: in a five-hour window its next-window carry is limited to the window length', () => {
  const now = NOW;
  const p = plan(snap({ window: { type: 'five_hour', resetsAt: (now + 2 * H) / 1000, status: 'allowed' }, config: { capUsd: 500 },
    sessions: [{ id: 'orch', kind: 'orchestrator', costUsd: 100, startedAt: iso(now - 4 * H), lastActiveAt: iso(now), recent: { costUsd: 98, at: iso(now - 10 * 60_000) } }] }));
  assert.ok(near(p.reserve.sessions[0].carriesOverUsd, 12 * 3)); // $12/h × (5h − 2h), not × (24h − 2h)
});

test('projection: a session that runs past the reset still projects at its observed burn', () => {
  const now = RESET - 0.5 * H;
  const p = plan(snap({ now: iso(now), sessions: [{ id: 'a', kind: 'build', costUsd: 10, startedAt: iso(now - 0.5 * H), lastActiveAt: iso(now) }] }));
  assert.ok(near(p.reserve.sessions[0].projectedBurnUsdPerHour, 20)); // $10 over 0.5h, not its in-window reserve's $24/h
});

// --- 14. Review round 5 -----------------------------------------------------------------------------------------------

test('cap: a calibration disproved in its own window stays dropped in later windows, unless a later rejection there caps it', () => {
  const now = Date.parse('2026-11-08T12:00:00Z'), cur = now + 100 * H, prev = cur - 168 * H;
  const h = (dt: number, c: number, st: string) => ({ at: iso(now - dt * H), totalCostUsd: c, status: st, resetsAt: iso(prev), type: 'seven_day' });
  const s = (history: unknown[]) => ({ now: iso(now), window: { type: 'seven_day', resetsAt: iso(cur), status: 'allowed' }, sessions: [], queue: [{ id: 'q', kind: 'build' }], history });
  const a = plan(s([h(80, 300, 'allowed'), h(79, 450, 'allowed_warning'), h(72, 700, 'allowed_warning')])); // 700 > 450 / 0.75
  assert.equal(a.cap.source, 'unknown');
  assert.ok(codes(a).includes('cap-disproved'));
  const b = plan(s([h(80, 300, 'allowed'), h(79, 450, 'allowed_warning'), h(75, 700, 'allowed_warning'), h(72, 900, 'rejected')]));
  assert.deepEqual([b.cap.source, b.cap.low, b.cap.high], ['calibrated', 700, 900]);
  // In the current window too: a rejection after the spend that passed the warning's high sets the cap.
  const r = (atH: number, usd: number, status: string) => ({ atMs: NOW - atH * H, totalCostUsd: usd, status, resetsAtMs: RESET });
  const c = estimateCap([r(3, 300, 'allowed_warning'), r(2, 450, 'allowed'), r(1, 500, 'rejected')], { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.deepEqual([c.source, c.low, c.high], ['calibrated', 500, 500]); // low: 450 / 0.75 = 600, but at most the rejection's 500
});

test('active age: paused and idle time does not age a session; pausedHours is subtracted', () => {
  const p = (extra: Record<string, unknown>) => plan(snap({ config: { capUsd: 1000 },
    sessions: [{ id: 'b', kind: 'build', costUsd: 37.5, startedAt: ago(10), lastActiveAt: iso(NOW), recent: { costUsd: 30, at: ago(1 / 3) }, ...extra }] })).reserve.sessions[0];
  // 1h of work: 0.75h left at $22.50/h. The reading was taken after the resume: recent.pausedHours 9 (round 8: without
  // it, all pauses are taken out of the recent interval)
  const resumed = p({ pausedHours: 9, recent: { costUsd: 30, at: ago(1 / 3), pausedHours: 9 } });
  assert.ok(near(resumed.remainingHours, 0.75));
  assert.ok(resumed.remaining.point > 15 && resumed.remaining.point < 20, String(resumed.remaining.point));
  assert.ok(p({}).remaining.point > 90); // counted as 10h old: a 4.1h overrun at $22.50/h
  assert.ok(codes(plan(snap({ sessions: [build('x', 1, 1, { pausedHours: 'x' })] }))).includes('bad-paused-hours'));
  const held = (h: number) => plan(snap({ config: { capUsd: 300 }, sessions: [{ id: 'p', kind: 'build', costUsd: 30, startedAt: ago(1 + h), lastActiveAt: ago(h), paused: true }] })).reserve.sessions[0];
  assert.deepEqual(held(30).remaining, held(0).remaining); // no recent reading: the reserve does not grow while paused
});

test('history: readings of a whole number of windows ago within 60 seconds snap to the grid', () => {
  const now = Date.parse('2026-11-08T12:00:00Z'), cur = now + 100 * H, prev = cur - 168 * H;
  const hist = [{ at: iso(now - 80 * H), totalCostUsd: 300, status: 'allowed', resetsAt: iso(prev), type: 'seven_day' },
    { at: iso(now - 79 * H), totalCostUsd: 450, status: 'allowed_warning', resetsAt: iso(prev), type: 'seven_day' }];
  for (const j of [0, 30, -30, -1]) {
    const p = plan({ now: iso(now), window: { type: 'seven_day', resetsAt: (cur + j * 1000) / 1000, status: 'allowed' }, sessions: [], queue: [], history: hist });
    assert.deepEqual([p.cap.source, p.cap.high], ['calibrated', 600], String(j));
  }
});

test('resume: fitting lists every paused session that fits now', () => {
  const sessions = [build('a', 10, 1), build('p', 10, 1, { paused: true }), { id: 'r', kind: 'review', costUsd: 0.5, startedAt: ago(0.1), lastActiveAt: iso(NOW), paused: true }];
  assert.deepEqual(plan(snap({ config: { capUsd: 55 }, sessions })).resume.fitting, ['r']);
  assert.deepEqual(plan(snap({ config: { capUsd: 1000 }, sessions })).resume.fitting, ['p', 'r']);
  assert.deepEqual(plan(snap({ config: {}, sessions })).resume.fitting, ['p', 'r']);
  assert.match(plan(snap({ config: { capUsd: 55 }, sessions })).resume.rule, /changes nothing/);
});

test('fill: with the cap unknown the message says work is admitted while status is allowed or allowed_warning', () => {
  assert.match(plan(snap({ config: {} })).fill.message, /allowed or allowed_warning/);
});

test('bootstrap: with no window, nothing running and no history, the top queued item is admitted to get a reading', () => {
  const p = plan(snap({ window: undefined, queue: [{ id: 'a', kind: 'review', priority: 1 }, { id: 'b', kind: 'review', priority: 2 }] }));
  assert.equal(p.brake, 'bad-window');
  assert.deepEqual(p.admit.map((x) => x.id), ['b']);
  assert.ok(codes(p).includes('bootstrap'));
  assert.deepEqual(plan(snap({ window: undefined, sessions: [build('x', 1, 0.5)], queue: [{ id: 'a', kind: 'review' }] })).admit, []);
  assert.deepEqual(plan(snap({ window: undefined, history: [{ at: ago(1), totalCostUsd: 5, status: 'allowed' }], queue: [{ id: 'a', kind: 'review' }] })).admit, []);
});

test('burn-mismatch: reported above 3x, and not right after a session started or finished', () => {
  const s = (slopeFrom: number, extra: unknown[] = []) => plan(snap({ sessions: [build('a', 100, 2, { lastActiveAt: iso(NOW) }), ...extra],
    history: [{ at: ago(0.5), totalCostUsd: slopeFrom, status: 'allowed' }] }));
  assert.ok(!codes(s(40)).includes('burn-mismatch')); // $120/h vs $50/h: 2.4x
  assert.ok(codes(s(0)).includes('burn-mismatch')); // $200/h vs $50/h: 4x
  assert.ok(!codes(s(0, [build('n', 1, 0.1)])).includes('burn-mismatch')); // a session started 6 minutes ago
  assert.ok(!codes(s(0, [build('d', 5, 1, { done: true, lastActiveAt: ago(0.1) })])).includes('burn-mismatch')); // one finished 6 minutes ago
});

test('fill: suggestions show what each item carries past the reset', () => {
  const now = RESET - 0.5 * H;
  const p = plan(snap({ now: iso(now), config: { capUsd: 100 }, sessions: [{ id: 'a', kind: 'build', costUsd: 10, startedAt: iso(now - 0.5 * H), lastActiveAt: iso(now) }] }));
  const council = p.fill.suggestions.find((x) => x.kind === 'council')!;
  assert.equal(council.carriesOverUsd, 27); // 45 − 18 in window
  assert.match(p.fill.message, /each carries ~\$27\.00 past reset/);
  assert.equal(p.fill.suggestions.find((x) => x.kind === 'review')!.carriesOverUsd, 0);
});

test('cap: an allowed reading proving the cap above the calibrated high is reported (lower-bound-above-cap)', () => {
  const r = (atH: number, usd: number, status: string) => ({ atMs: NOW - atH * H, totalCostUsd: usd, status, resetsAtMs: RESET });
  const seen: string[] = [];
  const c = estimateCap([r(3, 300, 'allowed_warning'), r(1, 350, 'allowed')], { warnFraction: 0.75, currentResetsAtMs: RESET }, (code) => seen.push(code));
  assert.equal(c.high, 400);
  assert.ok(c.lowerBoundUsd > 400); // 350 / 0.75, not clamped
  assert.ok(seen.includes('lower-bound-above-cap'));
});

test('history: readings at the same time give the same plan in any input order', () => {
  const hist = [{ at: ago(1), totalCostUsd: 300, status: 'allowed' }, { at: ago(1), totalCostUsd: 300, status: 'allowed_warning' }, { at: ago(1), totalCostUsd: 310, status: 'allowed' }];
  const s = (history: unknown[]) => plan(snap({ config: {}, history }));
  assert.deepEqual(s([...hist].reverse()), s(hist));
  assert.deepEqual(s([hist[1], hist[0], hist[2]]), s(hist));
});

test('cap: spend seen in the calibration\'s own older window raises its low end', () => {
  const now = Date.parse('2026-11-08T12:00:00Z'), cur = now + 100 * H, prev = cur - 168 * H;
  const h = (dt: number, c: number, st: string) => ({ at: iso(now - dt * H), totalCostUsd: c, status: st, resetsAt: iso(prev), type: 'seven_day' });
  const p = plan({ now: iso(now), window: { type: 'seven_day', resetsAt: iso(cur), status: 'allowed' }, sessions: [], queue: [],
    history: [h(80, 300, 'allowed_warning'), h(78, 380, 'allowed_warning')] });
  assert.deepEqual([p.cap.low, p.cap.high], [380, 400]); // W = 300 → high 400, low W = 300 raised to the 380 seen
});

test('cap: a rejection before the spend that passed the high does not rescue the calibration', () => {
  const r = (atH: number, usd: number, status: string) => ({ atMs: NOW - atH * H, totalCostUsd: usd, status, resetsAtMs: RESET });
  const c = estimateCap([r(5, 450, 'allowed_warning'), r(4, 800, 'rejected'), r(3, 700, 'allowed_warning')], { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.equal(c.source, 'unknown'); // 700 > min(600, 800) and no rejection after it
});

test('cap: two warnings at the same time calibrate from the lower spend in any input order', () => {
  const r = (usd: number) => ({ atMs: NOW - H, totalCostUsd: usd, status: 'allowed_warning', resetsAtMs: RESET });
  const opts = { warnFraction: 0.75, currentResetsAtMs: RESET };
  assert.equal(estimateCap([r(300), r(330)], opts).high, 400);
  assert.equal(estimateCap([r(330), r(300)], opts).high, 400);
});

test('cap: an allowed reading above the warning spend cannot raise low above high', () => {
  // allowed $500 then warning at $450: high = 450/0.75 = 600, and 500/0.75 = 666.67 must be clamped to 600
  const r = (atH: number, usd: number, status: string) => ({ atMs: NOW - atH * H, totalCostUsd: usd, status, resetsAtMs: RESET });
  const c = estimateCap([r(2, 500, 'allowed'), r(1, 450, 'allowed_warning')] as any, { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.deepEqual([Math.round(c.low! * 100) / 100, Math.round(c.high! * 100) / 100], [600, 600]);
  assert.ok(c.low! <= c.high!);
});

// --- 15. Review round 6

test('active age while paused: the pause so far is not subtracted from the work before it', () => {
  // worked 1h for $30, paused for the last hour: active age 1h, burn $30/h, 0.75h left → $22.50
  const p = plan(snap({ config: { capUsd: 200 }, sessions: [build('p', 30, 2, { lastActiveAt: ago(1), paused: true, pausedHours: 1 })] }));
  const r = p.reserve.sessions[0];
  assert.ok(near(r.burnUsdPerHour, 30), String(r.burnUsdPerHour));
  assert.ok(near(r.remaining.point, 22.5) && near(r.inWindow.point, 22.5), JSON.stringify(r.remaining));
  assert.ok(near(p.reserve.totalUsd, 22.5));
});

test('active age: a session paused 9 hours after 1 hour of work keeps its 1-hour burn and resumes', () => {
  const sessions = [build('p', 20, 10, { lastActiveAt: ago(9), paused: true, pausedHours: 9 }), build('a', 10, 1)];
  const p = plan(snap({ config: { capUsd: 100 }, sessions }));
  const r = p.reserve.sessions.find((s) => s.id === 'p')!;
  assert.ok(near(r.burnUsdPerHour, 20), String(r.burnUsdPerHour));
  assert.ok(near(r.remaining.point, 20)); // max(40 − 20, $20/h × 0.75h, floor)
  assert.equal(p.resume.next, 'p'); // 30 spent + 30 running + 20 ≤ 100
});

test('active age: just resumed with no new event yet, the completed pause is not counted twice', () => {
  const p = plan(snap({ config: { capUsd: 200 }, sessions: [build('p', 30, 3, { lastActiveAt: ago(2), pausedHours: 2 })] }));
  assert.ok(near(p.reserve.sessions[0].burnUsdPerHour, 30), String(p.reserve.sessions[0].burnUsdPerHour));
  assert.ok(!codes(p).includes('paused-hours-above-span'));
});

test('active age: pausedHours above the time since start is clamped and reported', () => {
  const p = plan(snap({ config: { capUsd: 200 }, sessions: [build('p', 30, 3, { lastActiveAt: ago(2), pausedHours: 5 })] }));
  assert.ok(codes(p).includes('paused-hours-above-span'));
  assert.ok(near(p.reserve.sessions[0].burnUsdPerHour, 120)); // no active time left: averaged over the 15-minute minimum
  const s = { costUsd: 30, startedAtMs: NOW - 3 * H, lastActiveAtMs: NOW - 2 * H, kind: 'build', pausedHours: 2 };
  assert.ok(near(remainingCost(s, NOW, RESET).burnUsdPerHour, 30)); // min(1h span, 3h − 2h paused)
  assert.ok(near(remainingCost({ ...s, pausedHours: 2.5 }, NOW, RESET).burnUsdPerHour, 60)); // min(1h, 0.5h)
});

test('cap: a calibration disproved in a later window held in history stays dropped two windows on', () => {
  const W = 168 * H;
  const r = (at: number, usd: number, status: string, reset: number) => ({ atMs: at, totalCostUsd: usd, status, resetsAtMs: reset });
  const readings = [r(RESET - 2 * W - 10 * H, 600, 'allowed', RESET - 2 * W), r(RESET - 2 * W - 9 * H, 750, 'allowed_warning', RESET - 2 * W),
    r(RESET - W - 5 * H, 1400, 'allowed', RESET - W), r(NOW - H, 100, 'allowed', RESET)];
  const seen: string[] = [];
  const c = estimateCap(readings, { warnFraction: 0.75, currentResetsAtMs: RESET }, (code) => seen.push(code));
  assert.equal(c.known, false);
  assert.ok(seen.includes('cap-stale'), seen.join());
  // without the middle window's reading the old calibration still carries over
  assert.equal(estimateCap([readings[0], readings[1], readings[3]], { warnFraction: 0.75, currentResetsAtMs: RESET }).high, 1000);
});

test('cap: a disproved calibration reports a lower bound of at least the disproving spend', () => {
  const W = 168 * H, PREV = RESET - W;
  const r = (at: number, usd: number, status: string, reset: number) => ({ atMs: at, totalCostUsd: usd, status, resetsAtMs: reset });
  // 1150: over 10% above the high 1000 (up to 10% now raises high instead, round 7)
  const c = estimateCap([r(PREV - 10 * H, 600, 'allowed', PREV), r(PREV - 9 * H, 750, 'allowed_warning', PREV), r(PREV - 5 * H, 1150, 'allowed', PREV),
    r(NOW - H, 200, 'allowed', RESET)], { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.equal(c.known, false);
  assert.equal(c.lowerBoundUsd, 1150);
});

test('cap: a rejection at the same instant as the disproving warning rescues the calibration', () => {
  const W = 168 * H, PREV = RESET - W, t = PREV - 10 * H;
  const r = (at: number, usd: number, status: string) => ({ atMs: at, totalCostUsd: usd, status, resetsAtMs: PREV });
  const c = estimateCap([r(PREV - 50 * H, 550, 'allowed'), r(PREV - 40 * H, 600, 'allowed_warning'), r(t, 850, 'allowed_warning'), r(t, 850, 'rejected')],
    { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.deepEqual([c.known, c.high], [true, 850]);
});

test('cap: the snapshot reading ranks after a history reading at the same second', () => {
  const p = plan(snap({ config: {}, sessions: [build('x', 150, 1)], history: [{ at: iso(NOW), totalCostUsd: 100, status: 'rejected', resetsAt: RESET / 1000 }] }));
  assert.ok(codes(p).includes('rejection-cleared'), codes(p).join());
  assert.ok(!codes(p).includes('cap-disproved'));
});

test('bootstrap: the orchestrator, done sessions and history written without a window do not block it', () => {
  const orch = { id: 'orch', kind: 'orchestrator', costUsd: 1, startedAt: ago(0.1), lastActiveAt: iso(NOW) };
  const blind = { at: ago(0.2), totalCostUsd: 0, status: null, resetsAt: null, type: 'seven_day', windowKnown: false };
  const p = plan(snap({ window: undefined, sessions: [orch, build('d', 5, 1, { done: true })], history: [blind, { ...blind, windowKnown: true }],
    queue: [{ id: 'a', kind: 'review', priority: 2 }, { id: 'b', kind: 'review' }] }));
  assert.deepEqual(p.admit.map((x) => x.id), ['a']);
  assert.ok(codes(p).includes('bootstrap'));
  const texts = [p.summary, p.fill.message, ...p.queued.map((q) => q.reason), ...p.issues.map((i) => i.detail)];
  assert.ok(texts.every((t) => !/nothing is admitted/.test(t)), texts.join(' | '));
  assert.match(p.queued[0].reason, /bootstrap: one item admitted to obtain a reading/);
  assert.match(p.fill.message, /bootstrap: one item admitted to obtain a reading/);
});

test('window spend: windowStartCostUsd gives the exact split; without it, pro rata over active hours', () => {
  const now = NOW, start = now - H; // five-hour window from an hour ago
  const s = { id: 'b', kind: 'build', costUsd: 40, startedAt: iso(now - (35 / 6) * H), lastActiveAt: iso(now), pausedHours: 2.5, recent: { costUsd: 30, at: iso(now - 0.25 * H) } };
  const p = (extra: Record<string, unknown>) => plan(snap({ window: { type: 'five_hour', resetsAt: (start + 5 * H) / 1000, status: 'allowed' }, config: { capUsd: 300 }, sessions: [{ ...s, ...extra }] }));
  assert.ok(near(p({}).spend.windowUsd, 12), String(p({}).spend.windowUsd)); // 40 × 1h / (5.83h − 2.5h paused)
  assert.equal(p({ windowStartCostUsd: 20 }).spend.windowUsd, 20);
  const above = p({ windowStartCostUsd: 50 });
  assert.equal(above.spend.windowUsd, 0);
  assert.ok(codes(above).includes('window-start-above-cost'));
  assert.ok(codes(p({ windowStartCostUsd: 'x' })).includes('bad-window-start-cost'));
  const ss = { costUsd: 40, startedAtMs: now - (35 / 6) * H, lastActiveAtMs: now, pausedHours: 2.5 };
  assert.ok(near(windowSpend([ss], start, now), 12, 1e-6));
  assert.ok(near(windowSpend([{ ...ss, pausedHours: 0 }], start, now), 40 / (35 / 6), 1e-6)); // unchanged without pauses
  assert.equal(windowSpend([{ ...ss, windowStartCostUsd: 25 }], start, now), 15);
  assert.equal(windowSpend([{ ...ss, startedAtMs: start + 1, windowStartCostUsd: 25 }], start, now), 40); // started inside: in full
});

test('burn-mismatch: a missing startedAt or lastActiveAt does not count as a session that just started or finished', () => {
  const s = (extra: unknown[]) => plan(snap({ sessions: [build('a', 100, 2, { lastActiveAt: iso(NOW) }), ...extra],
    history: [{ at: ago(0.5), totalCostUsd: 0, status: 'allowed' }] }));
  assert.ok(codes(s([{ id: 'm', kind: 'review', costUsd: 0, lastActiveAt: ago(1) }])).includes('burn-mismatch'));
  assert.ok(codes(s([{ id: 'd', kind: 'review', costUsd: 0, startedAt: ago(2), done: true }])).includes('burn-mismatch'));
});

test('resume: resume.all lists the paused sessions that fit together; the summary names them', () => {
  const sessions = [build('a', 10, 1), build('p', 10, 1, { paused: true }), { id: 'r', kind: 'review', costUsd: 0.5, startedAt: ago(0.1), lastActiveAt: iso(NOW), paused: true }];
  const big = plan(snap({ config: { capUsd: 1000 }, sessions }));
  assert.deepEqual(big.resume.all, ['p', 'r']);
  assert.match(big.summary, /resume p, r now/);
  assert.match(big.resume.rule, /resume\.all now \(or next one per tick if you prefer\)/);
  // 20.5 spent + 30 running: p alone (80.5) and r alone (53) fit under 81, both together (83) do not
  const tight = plan(snap({ config: { capUsd: 81 }, sessions }));
  assert.deepEqual([tight.resume.fitting, tight.resume.all, tight.resume.next], [['p', 'r'], ['p'], 'p']);
  assert.match(tight.summary, /resume p now/);
  assert.deepEqual(plan(snap({ config: { capUsd: 40 }, sessions })).resume.all, []);
  assert.deepEqual(plan(snap({ config: {}, sessions })).resume.all, ['p', 'r']);
  // nothing else running: the first always, the rest while they fit with it
  const alone = plan(snap({ config: { capUsd: 30 }, sessions: sessions.slice(1) }));
  assert.deepEqual(alone.resume.all, ['p']);
});

test('summary: says when the next window is over the cap', () => {
  const now = RESET - 0.1 * H;
  const p = plan(snap({ now: iso(now), config: { capUsd: 30 }, sessions: [{ id: 'c', kind: 'council', costUsd: 10, startedAt: iso(now - 0.1 * H), lastActiveAt: iso(now) }] }));
  assert.equal(p.projection.overshoot.nextWindowFits, false);
  assert.match(p.summary, /next window over cap/);
  assert.doesNotMatch(plan(snap()).summary, /next window over cap/);
});

test('history: history-no-window is reported only for entries within the last window length', () => {
  const blind = (h: number) => ({ at: ago(h), totalCostUsd: 0, status: null, resetsAt: null, type: 'seven_day', windowKnown: false });
  assert.ok(codes(plan(snap({ history: [blind(1)] }))).includes('history-no-window'));
  assert.ok(!codes(plan(snap({ history: [blind(200)] }))).includes('history-no-window'));
});

test('window: a resetsAt at or before 0, or more than 30 days old, is implausible: bad window, no invented grid', () => {
  for (const resetsAt of [0, -5, (NOW - 31 * 24 * H) / 1000]) {
    const p = plan(snap({ window: { type: 'seven_day', resetsAt, status: 'allowed' }, sessions: [build('x', 1, 0.5)], queue: [{ id: 'q', kind: 'review' }] }));
    assert.equal(p.brake, 'bad-window', String(resetsAt));
    assert.ok(codes(p).includes('resets-at-implausible'));
    assert.deepEqual([p.window.resetsAt, p.window.assumed, p.historyEntry.windowKnown], [null, true, false]);
  }
  const ok = plan(snap({ window: { type: 'seven_day', resetsAt: (NOW - 29 * 24 * H) / 1000, status: 'allowed' } }));
  assert.equal(ok.brake, 'none');
  assert.ok(!codes(ok).includes('resets-at-implausible'));
});

test('cap evidence: a session spanning the window start with paused hours does not overstate the reading', () => {
  // Spend for admission puts its 2.5 paused hours before the window start ($12); the reading and historyEntry put them
  // inside it ($0), so an older calibration (high $15) is not disproved by the $12 / 0.75 = $16 that admission assumes.
  const start = NOW - H;
  const s = { id: 'b', kind: 'build', costUsd: 40, startedAt: iso(NOW - (35 / 6) * H), lastActiveAt: iso(NOW), pausedHours: 2.5 };
  const warnPrev = { at: iso(start - H), totalCostUsd: 11.25, status: 'allowed_warning', resetsAt: iso(start), type: 'five_hour' };
  const p = plan(snap({ window: { type: 'five_hour', resetsAt: (start + 5 * H) / 1000, status: 'allowed' }, config: {}, sessions: [s], history: [warnPrev] }));
  assert.ok(near(p.spend.windowUsd, 12));
  assert.equal(p.historyEntry.totalCostUsd, 0);
  assert.deepEqual([p.cap.known, p.cap.high], [true, 15]);
  assert.ok(!codes(p).includes('cap-stale'));
  const ss = { costUsd: 40, startedAtMs: NOW - (35 / 6) * H, lastActiveAtMs: NOW, pausedHours: 1 };
  assert.ok(near(windowSpend([ss], start, NOW, 'after'), 0)); // 1h inside the window − 1h paused
  assert.ok(near(windowSpend([{ ...ss, pausedHours: 0.5 }], start, NOW, 'after'), 40 * 0.5 / (35 / 6 - 0.5), 1e-6));
});

// Round 6 mutation survivors
test('resume.all: a session that does not fit with those before it is skipped, not the end of the list', () => {
  const sessions = [build('a', 10, 1), build('p', 10, 1, { paused: true, priority: 3 }), build('q', 10, 1, { paused: true, priority: 2 }),
    { id: 'r', kind: 'review', costUsd: 0.5, startedAt: ago(0.1), lastActiveAt: iso(NOW), paused: true, priority: 1 }];
  const p = plan(snap({ config: { capUsd: 95 }, sessions })); // 60.5 + p 30 = 90.5; + q 30 > 95; + r 2.5 = 93
  assert.deepEqual([p.resume.fitting, p.resume.all], [['p', 'q', 'r'], ['p', 'r']]);
});

test('resume.all: the next window binds too', () => {
  const now = RESET - 0.2 * H;
  const c = (id: string, extra: Record<string, unknown> = {}) => ({ id, kind: 'council', costUsd: 5, startedAt: iso(now - 0.3 * H), lastActiveAt: iso(now), ...extra });
  // each carries ~$31.58 past the reset: a + p fit under $70 in the next window, a + p + q do not
  const p = plan(snap({ now: iso(now), config: { capUsd: 70 }, sessions: [c('a'), c('p', { paused: true }), c('q', { paused: true })] }));
  assert.deepEqual([p.resume.fitting, p.resume.all], [['p', 'q'], ['p']]);
});

test('window spend: a session last active before the window start counts nothing, even with all its time paused', () => {
  const ws = NOW - H;
  assert.equal(windowSpend([{ costUsd: 10, startedAtMs: ws - 3 * H, lastActiveAtMs: ws - 2 * H, pausedHours: 4 }], ws, NOW), 0);
  // no active time at all: everything in window for admission, nothing for cap evidence
  const all = { costUsd: 10, startedAtMs: ws - H, lastActiveAtMs: NOW, pausedHours: 2 };
  assert.deepEqual([windowSpend([all], ws, NOW), windowSpend([all], ws, NOW, 'after')], [10, 0]);
});

test('window spend: a pause still running lies after lastActiveAt, so it does not shrink the active hours', () => {
  const ws = NOW - H; // five-hour window from an hour ago
  // started 2h before the window, worked to 30 minutes into it ($25), paused since: 2.5h active, 0.5h of it in the window
  const s = { id: 'b', kind: 'build', costUsd: 25, startedAt: iso(ws - 2 * H), lastActiveAt: iso(ws + 0.5 * H), paused: true, pausedHours: 0.5 };
  const p = plan(snap({ window: { type: 'five_hour', resetsAt: (ws + 5 * H) / 1000, status: 'allowed' }, sessions: [s] }));
  assert.ok(near(p.spend.windowUsd, 5), String(p.spend.windowUsd));
});

test('window spend: windowStartCostUsd is ignored after a rollover (it names the old window)', () => {
  const s = { id: 'b', kind: 'build', costUsd: 20, startedAt: ago(2), lastActiveAt: iso(NOW), windowStartCostUsd: 5 };
  const p = plan(snap({ window: { type: 'five_hour', resetsAt: (NOW - 0.5 * H) / 1000, status: 'allowed' }, sessions: [s] }));
  assert.equal(p.window.rolledOver, true);
  assert.ok(near(p.spend.windowUsd, 5)); // pro rata: 20 × 0.5h / 2h, not 20 − 5
});

test('burn-mismatch: future or defaulted times do not count as a session that just started or finished', () => {
  const s = (extra: unknown[]) => plan(snap({ sessions: [build('a', 100, 2, { lastActiveAt: iso(NOW) }), ...extra],
    history: [{ at: ago(0.5), totalCostUsd: 0, status: 'allowed' }] }));
  const later = iso(NOW + H);
  assert.ok(codes(s([{ id: 'f', kind: 'review', costUsd: 0, startedAt: ago(2), lastActiveAt: later, done: true }])).includes('burn-mismatch'));
  assert.ok(codes(s([{ id: 'g', kind: 'review', costUsd: 0, startedAt: later, lastActiveAt: later }])).includes('burn-mismatch'));
  // no startedAt (now used) and an earlier lastActiveAt (raised to that start): neither time is known
  assert.ok(codes(s([{ id: 'h', kind: 'review', costUsd: 0, lastActiveAt: ago(1), done: true }])).includes('burn-mismatch'));
});

test('bootstrap: history without windowKnown, a status or a resetsAt is no reading, each on its own', () => {
  const q = [{ id: 'a', kind: 'review' }];
  const entry = { at: ago(0.2), totalCostUsd: 0, status: 'allowed', resetsAt: RESET / 1000, type: 'seven_day', windowKnown: true };
  for (const blind of [{ ...entry, windowKnown: false }, { ...entry, status: null }, { ...entry, resetsAt: null }]) {
    assert.deepEqual(plan(snap({ window: undefined, history: [blind], queue: q })).admit.map((x) => x.id), ['a'], JSON.stringify(blind));
  }
  assert.deepEqual(plan(snap({ window: undefined, history: [entry], queue: q })).admit, []);
});

test('window: an implausible resetsAt is reported once, as resets-at-implausible', () => {
  const p = plan(snap({ window: { type: 'seven_day', resetsAt: 0, status: 'allowed' } }));
  assert.ok(codes(p).includes('resets-at-implausible'));
  assert.ok(!codes(p).includes('no-resets-at'));
});

// --- 16. Review round 7

test('active age: an ended pause stays excluded while the session is idle afterwards', () => {
  // worked 09:00-09:06, paused 2.4h (ended), worked 11:30-11:54, idle since; now 12:24: 0.5h active
  const p = plan({ now: '2026-11-08T12:24:00Z', window: { type: 'seven_day', resetsAt: '2026-11-10T12:00:00Z', status: 'allowed' }, config: { capUsd: 70 },
    sessions: [{ id: 's', kind: 'build', costUsd: 20, startedAt: '2026-11-08T09:00:00Z', lastActiveAt: '2026-11-08T11:54:00Z', pausedHours: 2.4 }], queue: [] });
  const r = p.reserve.sessions[0];
  assert.ok(near(r.burnUsdPerHour, 40), String(r.burnUsdPerHour));
  assert.ok(near(r.remainingHours, 1.25), String(r.remainingHours));
});

test('active age: an in-window pause followed by idle time does not overstate spend or disprove the cap', () => {
  const p = plan({ now: '2026-11-08T14:00:00Z', window: { type: 'five_hour', resetsAt: '2026-11-08T16:00:00Z', status: 'allowed' },
    sessions: [{ id: 's', kind: 'build', costUsd: 60, startedAt: '2026-11-08T10:00:00Z', lastActiveAt: '2026-11-08T13:30:00Z', pausedHours: 0.5 },
      { id: 'o', kind: 'review', costUsd: 33, startedAt: '2026-11-08T11:30:00Z', lastActiveAt: '2026-11-08T13:00:00Z', done: true }],
    queue: [], history: [{ at: '2026-11-08T08:00:00Z', totalCostUsd: 60, status: 'allowed', resetsAt: '2026-11-08T11:00:00Z', type: 'five_hour' },
      { at: '2026-11-08T09:00:00Z', totalCostUsd: 75, status: 'allowed_warning', resetsAt: '2026-11-08T11:00:00Z', type: 'five_hour' }] });
  assert.equal(p.cap.known, true, codes(p).join());
  assert.ok(!codes(p).includes('cap-stale'));
  assert.ok(near(p.historyEntry.totalCostUsd, 73)); // 60 × 2h / 3h active + 33
});

test('active age: just resumed with no new event, a pause longer than the span lies after lastActiveAt; a shorter one is assumed inside it', () => {
  const s = { costUsd: 30, startedAtMs: NOW - 3 * H, lastActiveAtMs: NOW - 2 * H, kind: 'build' };
  assert.ok(near(remainingCost({ ...s, pausedHours: 2 }, NOW, RESET).burnUsdPerHour, 30)); // 1h of work
  // 1h of work, 0.5h paused, resumed: assumed inside the span until the next event (the safe side: higher burn)
  const short = { costUsd: 30, startedAtMs: NOW - 1.5 * H, lastActiveAtMs: NOW - 0.5 * H, kind: 'build', pausedHours: 0.5 };
  assert.ok(near(remainingCost(short, NOW, RESET).burnUsdPerHour, 60));
  assert.ok(near(remainingCost({ ...short, paused: true }, NOW, RESET).burnUsdPerHour, 30)); // still paused: the pause lies after
});

test('recent burn: a paused session ends its recent interval at lastActiveAt', () => {
  // worked 1h, a reading 15 minutes before it paused: $10 in 0.25h = $40/h, as at the moment it paused
  const base = { id: 'p', kind: 'build', costUsd: 30, startedAt: ago(1.5), lastActiveAt: ago(0.5), recent: { costUsd: 20, at: ago(0.75) } };
  const p = plan(snap({ config: { capUsd: 500 }, sessions: [{ ...base, paused: true, pausedHours: 0.5 }] }));
  const r = p.reserve.sessions[0];
  assert.ok(near(r.burnUsdPerHour, 40), String(r.burnUsdPerHour));
  const atPause = remainingCost({ kind: 'build', costUsd: 30, startedAtMs: NOW - 1.5 * H, lastActiveAtMs: NOW - 0.5 * H, recent: { costUsd: 20, atMs: NOW - 0.75 * H } }, NOW - 0.5 * H, RESET);
  assert.ok(near(r.remaining.point, atPause.remaining.point), `${r.remaining.point} vs ${atPause.remaining.point}`);
});

test('recent burn: recent.pausedHours removes the pause from the interval; under 5 active minutes the reading is ignored', () => {
  const now = Date.parse('2026-11-02T12:00:00Z');
  const s = { id: 's', kind: 'build', costUsd: 58.67, startedAt: '2026-11-02T07:00:00Z', lastActiveAt: iso(now), pausedHours: 2.05 };
  const p = (recent: unknown) => plan({ now: iso(now), window: { type: 'seven_day', resetsAt: '2026-11-05T00:00:00Z', status: 'allowed' }, sessions: [{ ...s, recent }] });
  const lifetime = p(undefined).reserve.sessions[0].burnUsdPerHour;
  // a pre-pause reading: 2 active minutes since it, too few, so the lifetime burn is used
  assert.equal(p({ costUsd: 58, at: '2026-11-02T09:55:00Z', pausedHours: 0 }).reserve.sessions[0].burnUsdPerHour, lifetime);
  // a reading 8 minutes ago after the resume: $2.67 in 8 minutes
  assert.ok(near(p({ costUsd: 56, at: '2026-11-02T11:52:00Z', pausedHours: 2.05 }).reserve.sessions[0].burnUsdPerHour, 20.03, 0.02));
  const bad = p({ costUsd: 56, at: '2026-11-02T11:52:00Z', pausedHours: 3 });
  assert.ok(codes(bad).includes('bad-recent'));
});

test('history: jittered resetsAt values of an off-grid older window are one window', () => {
  const T = (m: number) => new Date(Date.parse('2026-11-02T00:00:00Z') + m * 60000).toISOString();
  const hist = (jitter: boolean) => {
    const h = [];
    for (let m = 11 * 60 + 5; m <= 15 * 60 + 55; m += 5) {
      const spend = Math.min(502, (m - 660) * 1.75);
      const status = spend >= 502 ? 'rejected' : spend >= 375 ? 'allowed_warning' : 'allowed';
      const j = jitter ? ((m * 7919) % 41) - 20 : 0;
      h.push({ at: T(m), totalCostUsd: spend, status, resetsAt: new Date(Date.parse(T(16 * 60)) + j * 1000).toISOString(), type: 'five_hour', windowKnown: true });
    }
    return h;
  };
  const cur = 22 * 60; // an off-grid current window 17:00-22:00
  const p = (jitter: boolean) => plan({ now: T(cur - 290), window: { type: 'five_hour', status: 'allowed', resetsAt: Date.parse(T(cur)) / 1000 + 7 }, sessions: [], queue: [], history: hist(jitter) });
  const [a, b] = [p(false), p(true)];
  assert.deepEqual([b.cap.low, b.cap.high, !!b.cap.calibratedFrom?.rejected], [a.cap.low, a.cap.high, true]);
});

test('historyEntry: resetsAt repeats the earliest value history already holds for this window (within 60 s)', () => {
  const held = { at: ago(1), totalCostUsd: 5, status: 'allowed', resetsAt: iso(RESET - 20_000), type: 'seven_day' };
  const p = plan(snap({ window: { type: 'seven_day', resetsAt: (RESET + 15_000) / 1000, status: 'allowed' }, history: [held] }));
  assert.equal(p.historyEntry.resetsAt, iso(RESET - 20_000));
  assert.equal(plan(snap({ history: [] })).historyEntry.resetsAt, iso(RESET));
});

test('cap: later-window evidence up to 10% above high raises high (cap-raised-high); beyond it drops the cap', () => {
  const W = 168 * H;
  const r = (at: number, usd: number, status: string, reset: number) => ({ atMs: at, totalCostUsd: usd, status, resetsAtMs: reset });
  const old = [r(RESET - 2 * W - 10 * H, 600, 'allowed', RESET - 2 * W), r(RESET - 2 * W - 9 * H, 750, 'allowed_warning', RESET - 2 * W)];
  const run = (rs: ReturnType<typeof r>[]) => { const seen: string[] = []; return { c: estimateCap(rs, { warnFraction: 0.75, currentResetsAtMs: RESET }, (code) => seen.push(code)), seen }; };
  const near10 = run([...old, r(RESET - W - 5 * H, 780, 'allowed', RESET - W)]); // 780 / 0.75 = 1040 ≤ 1100
  assert.deepEqual([near10.c.known, near10.c.high, near10.c.low], [true, 1040, 800]); // round 8: low is not pinned to an in-band bound
  assert.ok(near10.seen.includes('cap-raised-high'), near10.seen.join());
  const far = run([...old, r(RESET - W - 5 * H, 840, 'allowed', RESET - W)]); // 1120 > 1100
  assert.deepEqual([far.c.known, far.seen.includes('cap-stale')], [false, true]);
  // spend seen in the calibration's own window: 1050 ≤ 1100 raises, 1150 disproves
  const src = (usd: number) => run([...old, r(RESET - 2 * W - 5 * H, usd, 'allowed', RESET - 2 * W)]);
  assert.deepEqual([src(1050).c.known, src(1050).c.high, src(1050).seen.includes('cap-raised-high')], [true, 1050, true]);
  assert.deepEqual([src(1150).c.known, src(1150).seen.includes('cap-disproved')], [false, true]);
});

test('cap: low is raised from allowed readings in every later window held, not only this one', () => {
  const W = 168 * H;
  const r = (at: number, usd: number, status: string, reset: number) => ({ atMs: at, totalCostUsd: usd, status, resetsAtMs: reset });
  const seen: string[] = [];
  const c = estimateCap([r(RESET - 2 * W - 10 * H, 600, 'allowed', RESET - 2 * W), r(RESET - 2 * W - 9 * H, 750, 'allowed_warning', RESET - 2 * W),
    r(RESET - W - 5 * H, 690, 'allowed', RESET - W), r(NOW - H, 100, 'allowed', RESET)], { warnFraction: 0.75, currentResetsAtMs: RESET }, (code) => seen.push(code));
  assert.deepEqual([c.low, c.high], [920, 1000]);
  assert.ok(seen.includes('cap-raised'));
});

test('history slope: measured from the proven spend', () => {
  const start = NOW - H;
  const s = { id: 'b', kind: 'build', costUsd: 40, startedAt: iso(NOW - (35 / 6) * H), lastActiveAt: iso(NOW), pausedHours: 2.5 };
  const p = plan(snap({ window: { type: 'five_hour', resetsAt: (start + 5 * H) / 1000, status: 'allowed' }, config: { capUsd: 300 }, sessions: [s],
    history: [{ at: ago(0.5), totalCostUsd: 0, status: 'allowed', resetsAt: (start + 5 * H) / 1000, type: 'five_hour' }] }));
  assert.ok(near(p.spend.windowUsd, 12));
  assert.equal(p.projection.historyBurnUsdPerHour, 0); // proven $0 since the reading, not $12 / 0.5h
});

test('window spend: a session last active before the window start counts nothing, whatever its windowStartCostUsd', () => {
  const ws = NOW - H;
  assert.equal(windowSpend([{ costUsd: 60, startedAtMs: ws - 2 * H, lastActiveAtMs: ws - 0.5 * H, windowStartCostUsd: 5 }], ws, NOW), 0);
});

test('sessions: fully tied duplicate ids resolve the same whatever their order', () => {
  const a = { id: 's', kind: 'build', costUsd: 10, startedAt: ago(1), lastActiveAt: ago(0.2), priority: 0 };
  const b = { ...a, priority: 9, paused: true };
  const c = { ...a, priority: 9, phase: 'small' };
  const pick = (ss: unknown[]) => plan(snap({ sessions: ss })).reserve.sessions[0];
  assert.deepEqual([pick([a, b]).paused, pick([b, a]).paused], [true, true]);
  assert.deepEqual([pick([a, c]).priority, pick([c, a]).priority], [9, 9]);
  assert.equal(pick([c, { ...c, phase: 'other' }]).phase, pick([{ ...c, phase: 'other' }, c]).phase);
});

test('cap: a same-instant rejection rescues a calibration disproved by more than 10%', () => {
  const W = 168 * H, PREV = RESET - W, t = PREV - 10 * H;
  const r = (at: number, usd: number, status: string) => ({ atMs: at, totalCostUsd: usd, status, resetsAtMs: PREV });
  // high 600 / 0.75 = 800; 900 is over 10% above it, so only the rejection at the same instant keeps the cap
  const c = estimateCap([r(PREV - 50 * H, 550, 'allowed'), r(PREV - 40 * H, 600, 'allowed_warning'), r(t, 900, 'allowed_warning'), r(t, 900, 'rejected')],
    { warnFraction: 0.75, currentResetsAtMs: RESET });
  assert.deepEqual([c.known, c.high], [true, 900]);
});

test('sessions: duplicate ids prefer the later activity, then paused, then the higher priority', () => {
  const a = { id: 's', kind: 'build', costUsd: 10, startedAt: ago(1), lastActiveAt: ago(0.5), priority: 0 };
  const pick = (ss: unknown[]) => plan(snap({ sessions: ss })).reserve.sessions[0];
  const later = { ...a, lastActiveAt: ago(0.1) };
  assert.deepEqual([pick([a, later]).remainingHours, pick([later, a]).remainingHours], [pick([later]).remainingHours, pick([later]).remainingHours]);
  const paused = { ...a, paused: true }, important = { ...a, priority: 9 };
  assert.deepEqual([pick([paused, important]).paused, pick([important, paused]).paused], [true, true]); // paused beats priority
  const p1 = { ...a, priority: 1 }, p5 = { ...a, priority: 5 };
  assert.deepEqual([pick([p1, p5]).priority, pick([p5, p1]).priority], [5, 5]);
});

test('historyEntry: the earliest of several held values for this window, ignoring other windows', () => {
  const e = (resetsAtMs: number, at = ago(1)) => ({ at, totalCostUsd: 5, status: 'allowed', resetsAt: iso(resetsAtMs), type: 'seven_day' });
  const p = plan(snap({ window: { type: 'seven_day', resetsAt: (RESET + 15_000) / 1000, status: 'allowed' },
    history: [e(RESET - 20_000), e(RESET + 30_000), e(RESET - 7 * DAY, iso(RESET - 7.5 * DAY))] })); // the earliest is not the last listed
  assert.equal(p.historyEntry.resetsAt, iso(RESET - 20_000));
});

// --- 17. Review round 8

test('cap: the 10% band is measured from the calibrated high, so later windows give the same result in any order', () => {
  const R5 = Date.parse('2026-11-08T16:00:00Z'), D5 = 5 * H;
  const mk = (a1: number, a2: number) => plan({ now: iso(R5 - 2 * H), window: { type: 'five_hour', resetsAt: iso(R5), status: 'allowed' }, sessions: [], queue: [],
    history: [{ at: iso(R5 - 3 * D5 + H), totalCostUsd: 60, status: 'allowed', resetsAt: iso(R5 - 2 * D5), type: 'five_hour' },
      { at: iso(R5 - 3 * D5 + 2 * H), totalCostUsd: 75, status: 'allowed_warning', resetsAt: iso(R5 - 2 * D5), type: 'five_hour' },
      { at: iso(R5 - 2 * D5 + H), totalCostUsd: a1 * 0.75, status: 'allowed', resetsAt: iso(R5 - D5), type: 'five_hour' },
      { at: iso(R5 - D5 + H), totalCostUsd: a2 * 0.75, status: 'allowed', resetsAt: iso(R5), type: 'five_hour' }] });
  const out = (p: Plan) => [p.cap.source, p.cap.low, p.cap.high];
  for (const pair of [[109, 119], [119, 109], [50, 119]]) assert.deepEqual(out(mk(pair[0], pair[1])), ['unknown', null, null], String(pair)); // 119 > 1.1 × 100
  // inside the band, high goes to the largest bound, low stays (A 60 / 0.75 = 80), point is the midpoint
  for (const pair of [[105, 108], [108, 105]]) assert.deepEqual(out(mk(pair[0], pair[1])), ['calibrated', 80, 108], String(pair));
  assert.equal(mk(105, 108).cap.point, 94);
  // a bound inside the bracket still raises low
  assert.deepEqual(out(mk(90, 50)), ['calibrated', 90, 100]);
});

test('cap: spend within 10% of the high raises it; a later rejection only lowers it, never rescues it upwards', () => {
  const R5 = Date.parse('2026-11-08T16:00:00Z'), D5 = 5 * H;
  const old = (extra: unknown[]) => [{ at: iso(R5 - 2 * D5 + H), totalCostUsd: 60, status: 'allowed', resetsAt: iso(R5 - D5), type: 'five_hour' },
    { at: iso(R5 - 2 * D5 + 2 * H), totalCostUsd: 75, status: 'allowed_warning', resetsAt: iso(R5 - D5), type: 'five_hour' },
    { at: iso(R5 - 2 * D5 + 3 * H), totalCostUsd: 105, status: 'allowed_warning', resetsAt: iso(R5 - D5), type: 'five_hour' }, ...extra];
  const mk = (extra: unknown[]) => plan({ now: iso(R5 - 4 * H), window: { type: 'five_hour', resetsAt: iso(R5), status: 'allowed' }, sessions: [], queue: [], history: old(extra) });
  assert.equal(mk([]).cap.high, 105);
  const rej = mk([{ at: iso(R5 - 2 * D5 + 4 * H), totalCostUsd: 200, status: 'rejected', resetsAt: iso(R5 - D5), type: 'five_hour' }]);
  assert.equal(rej.cap.high, 105); // not 200
  const lower = mk([{ at: iso(R5 - 2 * D5 + 4 * H), totalCostUsd: 102, status: 'rejected', resetsAt: iso(R5 - D5), type: 'five_hour' }]);
  assert.ok(lower.cap.high! <= 102, String(lower.cap.high));
});

test('bootstrap: with an empty queue, fill asks for one item to obtain a reading', () => {
  const p = plan(snap({ window: undefined, sessions: [{ id: 'orch', kind: 'orchestrator', costUsd: 1, startedAt: ago(0.1), lastActiveAt: iso(NOW) }], queue: [] }));
  assert.equal(p.brake, 'bad-window');
  assert.equal(p.fill.recommendAdmitUsd, null);
  assert.match(p.fill.message, /queue one item to obtain a rate-limit reading/);
  assert.deepEqual(p.fill.suggestions.map((s) => [s.kind, s.count]), [['review', 1]]);
  assert.match(p.summary, /queue one item to obtain a rate-limit reading/);
  // not a cold start: nothing asked
  assert.equal(plan(snap({ window: undefined, sessions: [build('x', 1, 0.5)] })).fill.recommendAdmitUsd, 0);
});

test('window.at: a stale status reading is paired with the spend when it was read', () => {
  const W = 168 * H;
  const prevWarn = { at: iso(RESET - W - 50 * H), totalCostUsd: 75, status: 'allowed_warning', resetsAt: iso(RESET - W), type: 'seven_day' }; // high 100
  const then = { at: ago(0.5), totalCostUsd: 70, status: 'allowed', resetsAt: iso(RESET), type: 'seven_day' };
  const s = (window: Record<string, unknown>) => plan(snap({ config: {}, window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed', ...window }, sessions: [build('x', 90, 1)], history: [prevWarn, then] }));
  const stale = s({ at: ago(0.5) });
  assert.deepEqual([stale.cap.known, stale.cap.high], [true, 100]); // allowed at $70, not at today's $90 ($120 > $110 would drop it)
  assert.equal(s({}).cap.known, false); // read now: $90 allowed disproves the $100 high
  assert.ok(codes(s({ at: 'garbage' })).includes('bad-window-at'));
});

test('window id tolerance: min(15 min, window length / 20), single linkage, also for the grid snap', () => {
  const now = Date.parse('2026-11-08T12:00:00Z'), cur = now + 100 * H, prev = cur - 168 * H;
  // older window values spread over 24 minutes in steps under 15 minutes: one window
  const hist = [0, 8, 16, 24].map((m, i) => ({ at: iso(prev - 80 * H + i * H), totalCostUsd: 300 + 50 * i, status: i === 1 ? 'allowed_warning' : 'allowed', resetsAt: iso(prev - 44 * 60_000 + m * 60_000), type: 'seven_day' })); // 20-44 minutes before the grid: not snapped
  const p = plan({ now: iso(now), window: { type: 'seven_day', resetsAt: cur / 1000, status: 'allowed' }, sessions: [], queue: [], history: hist });
  assert.deepEqual([p.cap.source, p.cap.high], ['calibrated', 466.67]); // the warning at $350 decides; later allowed $400/$450 in its own window raise nothing above 10%
  // 14 minutes off the current grid snaps to it
  const snapped = plan({ now: iso(now), window: { type: 'seven_day', resetsAt: cur / 1000, status: 'allowed' }, sessions: [], queue: [],
    history: [{ at: iso(prev - 79 * H), totalCostUsd: 450, status: 'allowed_warning', resetsAt: iso(prev + 14 * 60_000), type: 'seven_day' }] });
  assert.equal(snapped.cap.calibratedFrom?.resetsAt, iso(prev));
});

test('historyEntry: written in the last seconds before a jittered reset it stays usable next window', () => {
  const T = Date.parse('2026-11-08T16:00:00Z');
  const sess = (cost: number) => [{ id: 'b', kind: 'build', costUsd: cost, startedAt: iso(T - 3 * H), lastActiveAt: iso(T - 60e3), recent: { costUsd: cost - 5, at: iso(T - 0.3 * H) } }];
  const history = [{ at: iso(T - 2 * H), totalCostUsd: 40, status: 'allowed', resetsAt: iso(T), type: 'five_hour', windowKnown: true }];
  const p1 = plan({ now: iso(T + 10e3), window: { type: 'five_hour', resetsAt: iso(T + 30e3), status: 'allowed_warning' }, sessions: sess(75), queue: [], history });
  const p2 = plan({ now: iso(T + 120e3), window: { type: 'five_hour', resetsAt: iso(T + 5 * H + 30e3), status: 'allowed' }, sessions: [], queue: [], history: [...history, p1.historyEntry] });
  assert.deepEqual([p2.cap.source, p2.cap.high], ['calibrated', 100], codes(p2).join());
});

test('recent: without recent.pausedHours on a session with pauses, all pauses are taken out (and reported)', () => {
  const now = Date.parse('2026-11-02T12:00:00Z');
  const s = { id: 's', kind: 'build', costUsd: 58.67, startedAt: '2026-11-02T07:00:00Z', lastActiveAt: iso(now), pausedHours: 2.05 };
  const p = (recent: unknown) => plan({ now: iso(now), window: { type: 'seven_day', resetsAt: '2026-11-05T00:00:00Z', status: 'allowed' }, sessions: [{ ...s, recent }] });
  const pre = p({ costUsd: 58, at: '2026-11-02T09:55:00Z' });
  // 2 active minutes after taking every pause out: too short, so (round 9) the plain interval since 09:55 is used,
  // not the lifetime burn: $0.67 in 2.08h
  assert.ok(near(pre.reserve.sessions[0].burnUsdPerHour, 0.67 / (125 / 60), 0.011), String(pre.reserve.sessions[0].burnUsdPerHour));
  assert.ok(codes(pre).includes('recent-no-paused-hours'));
  assert.ok(!codes(plan({ now: iso(now), window: { type: 'seven_day', resetsAt: '2026-11-05T00:00:00Z', status: 'allowed' }, sessions: [{ ...s, pausedHours: 0, recent: { costUsd: 58, at: '2026-11-02T11:00:00Z' } }] })).includes('recent-no-paused-hours'));
});

test('window id tolerance: adjacent windows of one type stay apart, even jittered by up to 14 minutes', () => {
  const R5 = Date.parse('2026-11-08T16:00:00Z'), D5 = 5 * H, j = 14 * 60_000;
  const e = (reset: number, at: number, usd: number, status: string) => ({ at: iso(at), totalCostUsd: usd, status, resetsAt: iso(reset), type: 'five_hour' });
  const hist = [e(R5 - 2 * D5 + j, R5 - 3 * D5 + 2 * H, 75, 'allowed_warning'), e(R5 - 2 * D5 - j, R5 - 3 * D5 + 3 * H, 80, 'allowed'),
    e(R5 - D5 - j, R5 - 2 * D5 + 2 * H, 150, 'allowed_warning'), e(R5 - D5 + j, R5 - 2 * D5 + 3 * H, 160, 'allowed')];
  const p = plan({ now: iso(R5 - 4 * H), window: { type: 'five_hour', resetsAt: iso(R5), status: 'allowed' }, sessions: [], queue: [], history: hist });
  // the newer window's warning (150 / 0.75 = 200), its $160 raising low; the older window's $75 warning stays apart
  assert.deepEqual([p.cap.source, p.cap.low, p.cap.high, p.cap.calibratedFrom?.spendUsd], ['calibrated', 160, 200, 150]);
});

// Round 8 mutation survivors
test('window.at: under 60 seconds old is fresh; the latest held entry at or before it, none after, is used', () => {
  const W = 168 * H;
  const prevWarn = { at: iso(RESET - W - 50 * H), totalCostUsd: 75, status: 'allowed_warning', resetsAt: iso(RESET - W), type: 'seven_day' }; // high 100
  const e = (h: number, usd: number) => ({ at: ago(h), totalCostUsd: usd, status: 'allowed', resetsAt: iso(RESET), type: 'seven_day' });
  const s = (at: string, hist: unknown[]) => plan(snap({ config: {}, window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed', at }, sessions: [build('x', 90, 1)], history: [prevWarn, ...hist] }));
  assert.equal(s(iso(NOW - 30_000), [e(0.2, 70)]).cap.known, false); // 30 s old: paired with today's $90, which disproves $100
  // a stale first warning sets the high end at the spend it was read at: the latest entry at or before it ($70),
  // not an earlier one ($10) nor one after it ($88)
  const warn = plan(snap({ config: {}, window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed_warning', at: ago(0.5) }, sessions: [build('x', 90, 1)],
    history: [e(2, 10), e(0.6, 70), e(0.1, 88)] }));
  assert.ok(near(warn.cap.high!, 93.33), JSON.stringify(warn.cap));
  assert.ok(codes(s(iso(NOW + H), [])).includes('bad-window-at'));
  assert.ok(codes(s(iso(RESET - W - H), [])).includes('bad-window-at')); // before this window starts
});

test('window.at: the stale reading keeps its own time, so it does not clear a later rejection', () => {
  const p = plan(snap({ config: {}, window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed', at: ago(0.5) }, sessions: [build('x', 72, 1)],
    history: [{ at: ago(0.6), totalCostUsd: 72, status: 'allowed', resetsAt: iso(RESET), type: 'seven_day' },
      { at: ago(1 / 6), totalCostUsd: 70, status: 'rejected', resetsAt: iso(RESET), type: 'seven_day' }] }));
  assert.deepEqual([p.cap.known, p.cap.high], [true, 70]);
});

test('history: an entry written a few seconds past its own resetsAt (within the tolerance) is kept', () => {
  const T = Date.parse('2026-11-08T16:00:00Z');
  const history = [{ at: iso(T - 2 * H), totalCostUsd: 40, status: 'allowed', resetsAt: iso(T), type: 'five_hour' },
    { at: iso(T + 10e3), totalCostUsd: 75, status: 'allowed_warning', resetsAt: iso(T), type: 'five_hour' }];
  const p = plan({ now: iso(T + 120e3), window: { type: 'five_hour', resetsAt: iso(T + 5 * H + 30e3), status: 'allowed' }, sessions: [], queue: [], history });
  assert.deepEqual([p.cap.source, p.cap.high], ['calibrated', 100]);
});

test('historyEntry: a held value already past now is not reused (the entry stays self-consistent)', () => {
  const T = Date.parse('2026-11-08T16:00:00Z');
  const p = plan({ now: iso(T + 5e3), window: { type: 'five_hour', resetsAt: iso(T + 30e3), status: 'allowed' }, sessions: [], queue: [],
    history: [{ at: iso(T - H), totalCostUsd: 40, status: 'allowed', resetsAt: iso(T - 10e3), type: 'five_hour' }] });
  assert.equal(p.historyEntry.resetsAt, iso(T + 30e3));
  assert.ok(Date.parse(p.historyEntry.at) < Date.parse(p.historyEntry.resetsAt!));
});

test('recent: a paused session without pausedHours ends its recent interval at lastActiveAt', () => {
  const p = plan(snap({ config: { capUsd: 500 }, sessions: [{ id: 'p', kind: 'build', costUsd: 30, startedAt: ago(1.5), lastActiveAt: ago(0.5), paused: true, recent: { costUsd: 20, at: ago(0.75) } }] }));
  assert.ok(near(p.reserve.sessions[0].burnUsdPerHour, 40), String(p.reserve.sessions[0].burnUsdPerHour));
});

test('cap: a calibration from a rejection alone is still dropped by later-window evidence beyond 10%', () => {
  const R5 = Date.parse('2026-11-08T16:00:00Z'), D5 = 5 * H;
  const p = plan({ now: iso(R5 - 2 * H), window: { type: 'five_hour', resetsAt: iso(R5), status: 'allowed' }, sessions: [], queue: [],
    history: [{ at: iso(R5 - 2 * D5 + H), totalCostUsd: 60, status: 'allowed', resetsAt: iso(R5 - D5), type: 'five_hour' },
      { at: iso(R5 - 2 * D5 + 2 * H), totalCostUsd: 100, status: 'rejected', resetsAt: iso(R5 - D5), type: 'five_hour' },
      { at: iso(R5 - D5 + H), totalCostUsd: 150, status: 'allowed', resetsAt: iso(R5), type: 'five_hour' }] });
  assert.equal(p.cap.known, false);
  assert.ok(codes(p).includes('cap-stale'));
});

test('cap: of several rejections in the calibration window, the lowest sets the high end', () => {
  const R5 = Date.parse('2026-11-08T16:00:00Z'), D5 = 5 * H;
  const e = (h: number, usd: number, status: string) => ({ at: iso(R5 - 2 * D5 + h * H), totalCostUsd: usd, status, resetsAt: iso(R5 - D5), type: 'five_hour' });
  const p = plan({ now: iso(R5 - 4 * H), window: { type: 'five_hour', resetsAt: iso(R5), status: 'allowed' }, sessions: [], queue: [],
    history: [e(1, 60, 'allowed'), e(2, 75, 'allowed_warning'), e(3, 98, 'rejected'), e(4, 95, 'rejected')] });
  assert.equal(p.cap.high, 95);
});

test('window: a resetsAt up to the tolerance beyond one window ahead is not window-ahead', () => {
  const ok = plan(snap({ window: { type: 'five_hour', resetsAt: (NOW + 5 * H + 10 * 60_000) / 1000, status: 'allowed' } }));
  assert.ok(!codes(ok).includes('window-ahead'));
  assert.ok(codes(plan(snap({ window: { type: 'five_hour', resetsAt: (NOW + 5 * H + 20 * 60_000) / 1000, status: 'allowed' } }))).includes('window-ahead'));
});

// --- 18. Review round 9

test('window.at: a stale status is written to historyEntry at its own time and paired spend, so replanning keeps the cap', () => {
  const prevReset = '2026-11-01T10:00:00Z', reset = '2026-11-01T15:00:00Z';
  const history: unknown[] = [{ at: '2026-11-01T07:00:00Z', totalCostUsd: 600, status: 'allowed', resetsAt: prevReset, type: 'five_hour' },
    { at: '2026-11-01T08:00:00Z', totalCostUsd: 750, status: 'allowed_warning', resetsAt: prevReset, type: 'five_hour' },
    { at: '2026-11-01T10:30:00Z', totalCostUsd: 100, status: 'allowed', resetsAt: reset, type: 'five_hour' }];
  const s = (now: string, cost: number, hist: unknown[]) => ({ now, window: { type: 'five_hour', resetsAt: reset, status: 'allowed', at: '2026-11-01T10:30:00Z' },
    sessions: [{ id: 'b', kind: 'build', costUsd: cost, startedAt: '2026-11-01T10:20:00Z', lastActiveAt: now }], queue: [], history: hist });
  const p1 = plan(s('2026-11-01T12:00:00Z', 900, history));
  // history already holds the 10:30 reading: this tick records the current spend only (status null), not the stale
  // status at today's $900
  assert.deepEqual([p1.historyEntry.at, p1.historyEntry.totalCostUsd, p1.historyEntry.status], ['2026-11-01T12:00:00.000Z', 900, null]);
  const fresh = plan(s('2026-11-01T12:00:00Z', 900, history.slice(0, 2)));
  assert.deepEqual([fresh.historyEntry.at, fresh.historyEntry.status], ['2026-11-01T10:30:00.000Z', 'allowed']); // not held yet: written at its own time
  const p2 = plan(s('2026-11-01T12:01:00Z', 901, [...history, p1.historyEntry]));
  assert.deepEqual([p2.cap.known, p2.cap.low, p2.cap.high], [p1.cap.known, p1.cap.low, p1.cap.high]);
  assert.ok(!codes(p2).includes('cap-stale'));
});

test('window.at: a stale warning is written once; later ticks record the current spend; identical entries count once', () => {
  const e = (at: string, usd: number, status: string) => ({ at: `2026-11-01T${at}:00Z`, totalCostUsd: usd, status, resetsAt: '2026-11-01T15:00:00Z', type: 'seven_day' });
  let history: unknown[] = [e('08:25', 400, 'allowed'), e('08:26', 400, 'allowed_warning')];
  const caps: unknown[] = [];
  for (const now of ['09:00', '09:05', '09:10']) {
    const p = plan({ now: `2026-11-01T${now}:00Z`, window: { type: 'seven_day', resetsAt: '2026-11-01T15:00:00Z', status: 'allowed_warning', at: '2026-11-01T08:26:00Z' },
      sessions: [{ id: 's1', kind: 'build', costUsd: 550, startedAt: '2026-11-01T07:00:00Z', lastActiveAt: `2026-11-01T${now}:00Z` }], queue: [], history });
    caps.push([p.cap.low, p.cap.high]);
    // the warning is already held: each tick records the current spend instead (status null), so later stale
    // readings pair with a recent spend
    assert.deepEqual([p.historyEntry.at, p.historyEntry.totalCostUsd, p.historyEntry.status], [`2026-11-01T${now}:00.000Z`, 550, null]);
    history = [...history, p.historyEntry];
  }
  assert.deepEqual(caps, [caps[0], caps[0], caps[0]]);
  // without the warning in history, the first tick writes it at its own time and paired spend
  const first = plan({ now: '2026-11-01T09:00:00Z', window: { type: 'seven_day', resetsAt: '2026-11-01T15:00:00Z', status: 'allowed_warning', at: '2026-11-01T08:26:00Z' },
    sessions: [{ id: 's1', kind: 'build', costUsd: 550, startedAt: '2026-11-01T07:00:00Z', lastActiveAt: '2026-11-01T09:00:00Z' }], queue: [], history: [e('08:25', 400, 'allowed')] });
  assert.deepEqual([first.historyEntry.at, first.historyEntry.totalCostUsd, first.historyEntry.status], ['2026-11-01T08:26:00.000Z', 400, 'allowed_warning']);
  // identical entries count once
  const dup = (h: unknown[]) => plan({ now: '2026-11-01T09:00:00Z', window: { type: 'seven_day', resetsAt: '2026-11-01T15:00:00Z', status: 'allowed' }, sessions: [], queue: [], history: h }).cap;
  assert.deepEqual(dup([e('08:25', 400, 'allowed'), e('08:26', 400, 'allowed_warning'), e('08:26', 400, 'allowed_warning')]), dup([e('08:25', 400, 'allowed'), e('08:26', 400, 'allowed_warning')]));
  assert.deepEqual(caps[0], [533.33, 533.33]); // warning at $400 → high 533.33; the allowed $400 before it → low 533.33
});

test('recent without recent.pausedHours: an interval too short after taking out every pause falls back to now − at, not the lifetime burn', () => {
  const run = (recent: unknown) => plan({ now: '2026-11-01T12:00:00Z', window: { type: 'five_hour', resetsAt: '2026-11-01T15:00:00Z', status: 'allowed' }, config: { capUsd: 232.5 },
    sessions: [{ id: 's', kind: 'build', costUsd: 60, startedAt: '2026-11-01T07:00:00Z', lastActiveAt: '2026-11-01T12:00:00Z', pausedHours: 2, recent }] });
  const r = run({ costUsd: 30, at: '2026-11-01T11:30:00Z' });
  assert.ok(near(r.reserve.sessions[0].burnUsdPerHour, 60), String(r.reserve.sessions[0].burnUsdPerHour)); // $30 in 30 minutes
  assert.ok(codes(r).includes('recent-no-paused-hours'));
  // long enough after taking every pause out: the shortened interval is used ($30 in 3h − 2h = 1h)
  const long = run({ costUsd: 30, at: '2026-11-01T09:00:00Z' });
  assert.ok(near(long.reserve.sessions[0].burnUsdPerHour, 30), String(long.reserve.sessions[0].burnUsdPerHour));
});

test('window.at: held entries at the same time pair with the lower spend, whatever their order', () => {
  const reset = '2026-11-01T15:00:00Z';
  const a = { at: '2026-11-01T11:00:00Z', totalCostUsd: 600, status: 'allowed', resetsAt: reset, type: 'five_hour' };
  const b = { ...a, totalCostUsd: 700 };
  const p = (h: unknown[]) => plan({ now: '2026-11-01T11:30:00Z', window: { type: 'five_hour', resetsAt: reset, status: 'allowed_warning', at: '2026-11-01T11:10:00Z' },
    sessions: [{ id: 's', kind: 'build', costUsd: 800, startedAt: '2026-11-01T10:05:00Z', lastActiveAt: '2026-11-01T11:30:00Z' }], queue: [], history: h }).cap;
  assert.deepEqual(p([a, b]), p([b, a]));
  assert.equal(p([a, b]).calibratedFrom?.spendUsd, 600);
});

test('history: raw resetsAt values are grouped first, then the group is snapped to the grid', () => {
  const W5 = Date.parse('2026-11-01T15:00:00Z'), M = 60e3;
  const history = [{ at: '2026-11-01T10:30:00Z', totalCostUsd: 100, status: 'allowed', resetsAt: iso(W5 + 14 * M), type: 'five_hour' },
    { at: '2026-11-01T11:00:00Z', totalCostUsd: 300, status: 'allowed', resetsAt: iso(W5 + 20 * M), type: 'five_hour' },
    { at: '2026-11-01T11:30:00Z', totalCostUsd: 450, status: 'allowed_warning', resetsAt: iso(W5 + 20 * M), type: 'five_hour' }];
  const p = plan({ now: '2026-11-01T12:00:00Z', window: { type: 'five_hour', resetsAt: iso(W5), status: 'allowed_warning' },
    sessions: [{ id: 's', kind: 'build', costUsd: 500, startedAt: '2026-11-01T10:05:00Z', lastActiveAt: '2026-11-01T12:00:00Z' }], queue: [], history });
  assert.ok(!codes(p).includes('history-other-window'), codes(p).join());
  assert.equal(p.cap.calibratedFrom?.spendUsd, 450); // the first warning, in the same window
});

test('window.at: up to the tolerance before the window start is accepted', () => {
  const start = RESET - 168 * H;
  const at = (ms: number) => plan(snap({ window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed', at: iso(ms) } }));
  assert.ok(!codes(at(start - 10 * 60_000)).includes('bad-window-at'));
  assert.ok(codes(at(start - 20 * 60_000)).includes('bad-window-at'));
});

test('window spend: counted from the earliest of the held and reported resetsAt; a start just after now counts from start − tolerance', () => {
  const R5 = Date.parse('2026-11-01T15:00:00Z'), M = 60e3;
  const sess = { id: 's', kind: 'build', costUsd: 50, startedAt: iso(R5 - 5 * H - 5 * M), lastActiveAt: iso(R5 - 3 * H) };
  const held = { at: iso(R5 - 4 * H), totalCostUsd: 1, status: 'allowed', resetsAt: iso(R5 - 10 * M), type: 'five_hour' };
  const p = plan({ now: iso(R5 - 3 * H), window: { type: 'five_hour', resetsAt: iso(R5), status: 'allowed' }, config: { capUsd: 500 }, sessions: [sess], queue: [], history: [held] });
  assert.equal(p.spend.windowUsd, 50); // started after the canonical start (14:50 − 5h): in full
  const ahead = plan({ now: '2026-11-01T12:00:00Z', window: { type: 'five_hour', resetsAt: '2026-11-01T17:10:00Z', status: 'allowed' }, config: { capUsd: 100 },
    sessions: [{ id: 's', kind: 'build', costUsd: 50, startedAt: '2026-11-01T11:50:00Z', lastActiveAt: '2026-11-01T12:00:00Z' }] });
  assert.ok(near(ahead.spend.windowUsd, 25), String(ahead.spend.windowUsd)); // counted from 11:55 (12:10 start − 15 min): 5 of its 10 minutes
});

test('cap: cap-raised-high is not reported when a rejection then puts high below the bound', () => {
  const R5 = Date.parse('2026-11-08T16:00:00Z'), D5 = 5 * H;
  const e = (h: number, usd: number, status: string) => ({ at: iso(R5 - 2 * D5 + h * H), totalCostUsd: usd, status, resetsAt: iso(R5 - D5), type: 'five_hour' });
  const p = plan({ now: iso(R5 - 4 * H), window: { type: 'five_hour', resetsAt: iso(R5), status: 'allowed' }, sessions: [], queue: [],
    history: [e(1, 60, 'allowed'), e(2, 75, 'allowed_warning'), e(3, 105, 'allowed_warning'), e(4, 102, 'rejected')] });
  assert.equal(p.cap.high, 102);
  assert.ok(!codes(p).includes('cap-raised-high'), codes(p).join());
});

test('window.at: with no history entry before a stale reading, sessions started after it are dropped and costs pro-rated to it', () => {
  const at = NOW - H;
  const p = plan(snap({ config: {}, window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed_warning', at: iso(at) },
    sessions: [{ id: 'a', kind: 'build', costUsd: 60, startedAt: iso(at - H), lastActiveAt: iso(NOW) }, { id: 'b', kind: 'build', costUsd: 50, startedAt: iso(at + 0.5 * H), lastActiveAt: iso(NOW) }] }));
  assert.ok(near(p.cap.high!, 40), JSON.stringify(p.cap)); // $30 of a's $60 by then, b not started: 30 / 0.75
  assert.equal(p.historyEntry.totalCostUsd, 30);
});

test('cap: a rejection well below the warning-implied high flags warnFraction (warn-fraction-suspect)', () => {
  const R5 = Date.parse('2026-11-08T16:00:00Z'), D5 = 5 * H;
  const e = (h: number, usd: number, status: string) => ({ at: iso(R5 - 2 * D5 + h * H), totalCostUsd: usd, status, resetsAt: iso(R5 - D5), type: 'five_hour' });
  const p = (R: number) => plan({ now: iso(R5 - 4 * H), window: { type: 'five_hour', resetsAt: iso(R5), status: 'allowed' }, sessions: [], queue: [],
    history: [e(1, 60, 'allowed'), e(2, 75, 'allowed_warning'), e(3, R, 'rejected')] });
  const sus = p(80).issues.find((i) => i.code === 'warn-fraction-suspect');
  assert.ok(sus, codes(p(80)).join());
  assert.match(sus.detail, /0\.94/); // 75 / 80
  assert.ok(!codes(p(95)).includes('warn-fraction-suspect'));
});

test('config.admitCapEnd: admission compares against the chosen end of the cap', () => {
  // warning at $450 (high 600) after allowed $300; the $450 seen raises low to 450: point 525; $450 spent; items of $30
  const mk = (end?: unknown) => plan(snap({ config: end === undefined ? {} : { admitCapEnd: end }, window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed_warning' },
    sessions: [build('d', 450, 3, { done: true })], history: [{ at: ago(2), totalCostUsd: 300, status: 'allowed' }],
    queue: Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, kind: 'review', estimateUsd: 30 })) }));
  assert.equal(mk().admit.length, 5); // 600 − 450 = 150
  assert.equal(mk('high').admit.length, 5);
  assert.equal(mk('point').admit.length, 2); // 525 − 450 = 75
  assert.equal(mk('low').admit.length, 0); // 450 − 450 = 0
  assert.equal(mk('point').capacity.admitCapEnd, 'point');
  assert.match(mk('point').queued[0].reason, /point/);
  const bad = mk('middle');
  assert.ok(codes(bad).includes('bad-config'));
  assert.equal(bad.admit.length, 5);
});

test('historyEntry: a stale reading up to the tolerance before the window start is written at the window start', () => {
  const start = RESET - 168 * H;
  const p = plan(snap({ window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed', at: iso(start - 10 * 60_000) } }));
  assert.equal(p.historyEntry.at, iso(start));
  assert.ok(Date.parse(p.historyEntry.at) < Date.parse(p.historyEntry.resetsAt!));
});

// Round 9 mutation survivors
test('config.admitCapEnd: resume and the fill next-window limit use the chosen end too', () => {
  const now = RESET - 0.1 * H;
  const fill = (end: string) => plan({ now: iso(now), window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed_warning' }, config: { admitCapEnd: end },
    sessions: [{ id: 'd', kind: 'build', costUsd: 300, startedAt: iso(now - 3 * H), lastActiveAt: iso(now - 0.5 * H), done: true }],
    history: [{ at: iso(now - 2 * H), totalCostUsd: 200, status: 'allowed' }], queue: [] }).fill.suggestions.find((s) => s.kind === 'council')!.count;
  assert.deepEqual([fill('high'), fill('point')], [9, 8]); // cap 300..400: the next window has 400 or 350 left for carry-over
  // a paused session fits under the high end (600) but not the point (525): resumed only with 'high'
  const resume = (end: string) => plan(snap({ config: { admitCapEnd: end }, window: { type: 'seven_day', resetsAt: RESET / 1000, status: 'allowed_warning' },
    sessions: [build('d', 450, 3, { done: true }), build('a', 1, 0.5), build('p', 40, 2, { paused: true })], history: [{ at: ago(2), totalCostUsd: 300, status: 'allowed' }] })).resume;
  assert.ok(resume('high').fitting.includes('p'), JSON.stringify(resume('high')));
  assert.ok(!resume('low').fitting.includes('p'));
});

test('window.at: the held check needs the same status and allows for the window-start clamp', () => {
  const e = (at: string, usd: number, status: string) => ({ at: `2026-11-01T${at}:00Z`, totalCostUsd: usd, status, resetsAt: '2026-11-01T15:00:00Z', type: 'seven_day' });
  const s = (hist: unknown[], at = '2026-11-01T08:26:00Z') => plan({ now: '2026-11-01T09:00:00Z', window: { type: 'seven_day', resetsAt: '2026-11-01T15:00:00Z', status: 'allowed_warning', at },
    sessions: [{ id: 's1', kind: 'build', costUsd: 550, startedAt: '2026-11-01T07:00:00Z', lastActiveAt: '2026-11-01T09:00:00Z' }], queue: [], history: hist }).historyEntry;
  // an allowed entry at that time is not the warning: the warning is still written
  assert.equal(s([e('08:25', 400, 'allowed'), e('08:26', 400, 'allowed')]).status, 'allowed_warning');
  // a reading before the window start was held at the start: the next tick writes spend only
  const start = '2026-10-25T15:00:00Z', before = '2026-10-25T14:55:00Z';
  const first = s([], before);
  assert.equal(first.at, '2026-10-25T15:00:00.000Z');
  assert.equal(s([first], before).status, null);
});

test('history: an off-grid group of jittered values is named by its earliest member', () => {
  const now = Date.parse('2026-11-08T12:00:00Z'), cur = now + 100 * H, prev = cur - 168 * H;
  const hist = [0, 8, 16].map((m, i) => ({ at: iso(prev - 80 * H + i * H), totalCostUsd: 300 + 50 * i, status: i === 1 ? 'allowed_warning' : 'allowed', resetsAt: iso(prev - 44 * 60_000 + m * 60_000), type: 'seven_day' }));
  const p = plan({ now: iso(now), window: { type: 'seven_day', resetsAt: cur / 1000, status: 'allowed' }, sessions: [], queue: [], history: hist });
  assert.equal(p.cap.calibratedFrom?.resetsAt, iso(prev - 44 * 60_000));
});

test('window spend: a held resetsAt later than the reported one does not move the window start later', () => {
  const R5 = Date.parse('2026-11-01T15:00:00Z'), M = 60e3;
  const held = { at: iso(R5 - 4 * H), totalCostUsd: 1, status: 'allowed', resetsAt: iso(R5 + 10 * M), type: 'five_hour' };
  const p = plan({ now: iso(R5 - 3 * H), window: { type: 'five_hour', resetsAt: iso(R5), status: 'allowed' }, config: { capUsd: 500 },
    sessions: [{ id: 's', kind: 'build', costUsd: 50, startedAt: iso(R5 - 5 * H + 5 * M), lastActiveAt: iso(R5 - 3 * H) }], queue: [], history: [held] });
  assert.equal(p.spend.windowUsd, 50); // started after 10:00 (15:00 − 5h): in full, not pro rata from 10:10
});
