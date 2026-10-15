// Keeps docs/POLICY.md binding: the policy, the scanner and this test stay protected from agents, CI keeps
// running the scanner, and every agent is pointed at the policy. Agents can't edit this file (it's in
// CODEOWNERS, LOOP_PATHS, DOCTOR_FORBIDDEN and team.ts's denied edits), and the guard fails CI if the test
// count drops, so these checks can't be quietly removed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOOP_PATHS, parseCodeowners } from './autopilot.ts';
import { DOCTOR_FORBIDDEN } from './doctor.ts';
import { MARKS, scanText } from './compliance.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const POLICY_FILES = ['/docs/POLICY.md', '/SECURITY.md', '/scripts/compliance.ts', '/scripts/compliance.test.ts', '/scripts/policy.test.ts'];

test('policy: the policy, the scanner and this test are protected everywhere', () => {
  const owners = parseCodeowners(read('.github/CODEOWNERS'));
  const teamTs = read('scripts/team.ts');
  for (const p of POLICY_FILES) {
    assert.ok(owners.includes(p), `CODEOWNERS protects ${p}`);
    assert.ok(LOOP_PATHS.includes(p), `lines may not change ${p}`);
    assert.ok(DOCTOR_FORBIDDEN.includes(p), `the doctor may not change ${p}`);
    assert.ok(teamTs.includes(`'.${p}'`), `branch-team agents may not edit ${p}`);
  }
});

test('policy: CI runs the scanner on every PR and push, as a blocking step', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /node scripts\/compliance\.ts auto/);
  assert.doesNotMatch(ci.split('compliance.ts auto')[0].split('\n').slice(-6).join('\n'), /continue-on-error:\s*true/);
});

test('policy: branch teams run the scanner before the tester', () => {
  assert.match(read('scripts/team.ts'), /scripts\/compliance\.ts/);
});

test('policy: every agent is pointed at the policy', () => {
  assert.match(read('CLAUDE.md'), /docs\/POLICY\.md/); // loaded by every Claude Code agent in this repo
  assert.match(read('team/README.md'), /docs\/POLICY\.md/);
  assert.match(read('team/reviewer.md'), /docs\/POLICY\.md/);
  assert.match(read('team/doctor.md'), /docs\/POLICY\.md/);
  assert.match(read('.github/workflows/review.yml'), /docs\/POLICY\.md/);
});

test('policy: the core blocks still hold', () => {
  for (const m of ['robinhood', 'tiktok', 'tinder', 'instagram', 'etoro', 'elon musk', 'steve jobs']) assert.ok(MARKS.includes(m), m);
  assert.ok(scanText('app/page.tsx', ['Guaranteed', ' returns'].join('')).length);
  assert.ok(scanText('lib/x.ts', ['const t = "gh', 'p_', 'Q'.repeat(36), '";'].join('')).some((v) => v.rule === 'secret'));
});
