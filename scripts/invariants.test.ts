// Safety rules the doctor may not weaken. The doctor can't edit this file (DOCTOR_FORBIDDEN), CI runs it on
// every PR, and the guard fails CI if the test count drops. A doctor fix that loosens any rule below fails CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gateDecision, guardFindings, parseCodeowners, type GateInput } from './autopilot.ts';
import { DOCTOR_FORBIDDEN, doctorViolations } from './doctor.ts';

const patterns = parseCodeowners(readFileSync(new URL('../.github/CODEOWNERS', import.meta.url), 'utf8'));
const green = (o: Partial<GateInput>): GateInput => ({
  enabled: true, automerge: true, variant: false, files: ['app/page.tsx'], patterns, ci: 'success', review: 'success', diffLines: 50, maxDiff: 800, ...o,
});

test('invariant: the kill switch stops every merge', () => {
  for (const o of [{}, { line: true }, { doctor: true, files: ['scripts/autopilot.ts'] }, { approved: true }]) {
    assert.equal(gateDecision(green({ ...o, enabled: false })).action, 'off');
  }
});

test('invariant: nothing merges without green CI and review', () => {
  for (const o of [{}, { line: true }, { doctor: true, files: ['scripts/autopilot.ts'] }]) {
    assert.notEqual(gateDecision(green({ ...o, ci: 'failure' })).action, 'merge');
    assert.notEqual(gateDecision(green({ ...o, review: 'failure' })).action, 'merge');
    assert.notEqual(gateDecision(green({ ...o, ci: 'pending' })).action, 'merge');
  }
});

test('invariant: a main PR touching protected paths never auto-merges, approved or not', () => {
  for (const f of ['.github/workflows/build.yml', 'lib/broker.ts', 'package.json', 'scripts/autopilot.ts']) {
    assert.notEqual(gateDecision(green({ files: [f] })).action, 'merge');
    assert.notEqual(gateDecision(green({ files: [f], approved: true })).action, 'merge');
  }
});

test('invariant: a line never merges changes to the loop', () => {
  for (const f of ['.github/workflows/ci.yml', 'scripts/autopilot.ts', 'scripts/doctor.ts', 'scripts/invariants.test.ts', 'team/engineer.md', 'CLAUDE.md']) {
    assert.notEqual(gateDecision(green({ line: true, files: [f] })).action, 'merge');
    assert.notEqual(gateDecision(green({ line: true, files: [f], approved: true })).action, 'merge');
  }
});

test('invariant: the doctor never merges its own constraints, CI, the gate, dependencies or product code', () => {
  for (const f of ['.github/CODEOWNERS', '.github/workflows/ci.yml', '.github/workflows/gate.yml', '.github/workflows/doctor.yml',
    'scripts/doctor.ts', 'scripts/invariants.test.ts', 'team/doctor.md', 'package.json', 'package-lock.json', 'lib/broker.ts', 'app/page.tsx', 'db/schema.sql']) {
    assert.notEqual(gateDecision(green({ doctor: true, files: ['scripts/autopilot.ts', f] })).action, 'merge', f);
  }
  for (const f of ['scripts/doctor.ts', 'scripts/invariants.test.ts', '.github/CODEOWNERS', '.github/workflows/ci.yml', '.github/workflows/gate.yml', 'team/doctor.md']) {
    assert.ok(doctorViolations([f]).length, f);
  }
  assert.ok(DOCTOR_FORBIDDEN.includes('/scripts/invariants.test.ts'));
});

test('invariant: the guard fails fewer tests and destructive schema changes', () => {
  assert.ok(guardFindings(10, 9, '').length);
  for (const sql of ['+drop table users;', '+truncate activities;', '+delete from closed_trades;']) assert.ok(guardFindings(1, 1, sql).length, sql);
});

test('invariant: the protected-path list still covers the loop, auth, the broker and dependencies', () => {
  for (const p of ['/.github/', '/scripts/autopilot.ts', '/scripts/doctor.ts', '/scripts/invariants.test.ts', '/team/', '/lib/session.ts', '/lib/broker.ts', '/package.json']) {
    assert.ok(patterns.includes(p), p);
  }
});

// Owner decision 2026-11-01, item 2.44 (F-20, 2026-11-01): the contrast floors live where the change that breaks a pair
// cannot also lower them. Cycle 2's values: 4.5:1 text, 3:1 large text, UI parts and the focus ring, ΔE00 ≥ 9 under
// protan, deutan and tritan. lib/a11y-contrast.test.ts holds FLOORS and checks every pair against it; this pins FLOORS.
const CONTRAST_FLOORS = { text: 4.5, large: 3, ui: 3, focus: 3, cvd: 9 } as const;
test('invariant: the contrast floors in lib/a11y-contrast.test.ts never drop below cycle 2 (owner decision, item 2.44)', () => {
  const src = readFileSync(new URL('../lib/a11y-contrast.test.ts', import.meta.url), 'utf8');
  const m = /^export const FLOORS = \{([^}]*)\} as const;$/m.exec(src);
  assert.ok(m, 'lib/a11y-contrast.test.ts declares `export const FLOORS = { … } as const;` on one line');
  // Each entry must be exactly `name: number` (no expression such as `4.5 / 2` can pass on its leading number).
  const parts = m[1].split(',').map((p) => p.trim()).filter(Boolean);
  for (const p of parts) assert.match(p, /^\w+:\s*\d+(?:\.\d+)?$/, `FLOORS entry "${p}" is a plain number`);
  const floors = Object.fromEntries(parts.map((p) => p.split(':')).map(([k, v]) => [k.trim(), Number(v)]));
  assert.deepEqual(Object.keys(floors).sort(), Object.keys(CONTRAST_FLOORS).sort(), 'the same five floors');
  for (const [k, v] of Object.entries(CONTRAST_FLOORS)) assert.ok(floors[k] >= v, `FLOORS.${k} ${floors[k]} < cycle-2 ${v}`);
  // The pairs are really checked against FLOORS: the ΔE00 checks and the per-pair floor lookups stay.
  assert.ok((src.match(/>= FLOORS\.cvd/g) ?? []).length >= 3, 'the ΔE00 checks compare with FLOORS.cvd');
  assert.match(src, /F-20 AC12 \(QA M2\): every ratio or ΔE00 comparison is on FLOORS/, 'the inline-floor audit stays');
});
