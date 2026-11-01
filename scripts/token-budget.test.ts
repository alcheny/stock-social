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
    // Window spend readings an hour and half an hour earlier: an aggregate burn of about $296/hour.
    history: [
      { at: '2026-11-01T06:00:00Z', totalCostUsd: 120, status: 'allowed' },
      { at: '2026-11-01T07:55:00Z', totalCostUsd: 290, status: 'allowed' },
      { at: '2026-11-01T08:25:00Z', totalCostUsd: 440, status: 'allowed' },
    ],
  };
}

