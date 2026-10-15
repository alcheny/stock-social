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
