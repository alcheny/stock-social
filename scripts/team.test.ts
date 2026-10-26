import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocking, cliEnv, cliErr, parseResult, renderSpecDoc, type Finding, headline } from './team.ts';

test('parseResult: structured output, cost, and errors from the CLI envelope', () => {
  const ok = parseResult(JSON.stringify({ structured_output: { pass: true }, total_cost_usd: 0.12, is_error: false }));
  assert.deepEqual(ok, { out: { pass: true }, cost: 0.12, error: null });
  const fromResult = parseResult(JSON.stringify({ result: '{"pass":false}', total_cost_usd: 0 }));
  assert.deepEqual(fromResult.out, { pass: false });
  const authFail = parseResult(JSON.stringify({ is_error: true, result: 'Not logged in · Please run /login', total_cost_usd: 0 }));
  assert.equal(authFail.error, 'Not logged in · Please run /login');
  assert.match(parseResult('not json').error!, /unparseable/);
  assert.equal(parseResult(JSON.stringify({ result: 'plain text' })).error, 'no structured output');
});

test('blocking: notes never block, everything else does', () => {
  const fs: Finding[] = [
    { severity: 'note', where: 'a', problem: 'nit' }, { severity: 'usability', where: 'b', problem: 'tap target 20px' },
    { severity: 'bug', where: 'c', problem: 'crash' }, { severity: 'spec', where: 'd', problem: 'missing label' },
  ];
  assert.deepEqual(blocking(fs).map((f) => f.where), ['b', 'c', 'd']);
  assert.deepEqual(blocking([{ severity: 'note', where: 'x', problem: 'y' }]), []);
});

test('renderSpecDoc records the spec, the discussion, every QA round and the cost', () => {
  const md = renderSpecDoc({
    title: 'Swipe to trade', variant: 'B · Sheet', spec: '## Goal\nOpen trades by swiping.', agreed: true,
    discussion: [
      { round: 1, designer: 'Draft 1', business: { approve: false, ease_of_use: 'ok', retention: 'weak', virality: 'none', feedback: 'add share' } },
      { round: 2, designer: 'Draft 2', business: { approve: true, ease_of_use: 'good', retention: 'good', virality: 'share button', feedback: 'ship it' } },
    ],
    qa: [
      { round: 1, by: 'checks', pass: false, findings: [{ severity: 'bug', where: 'Unit tests', problem: 'expected 2 | got 3' }] },
      { round: 2, by: 'tester', pass: true, findings: [] },
    ],
    calls: [{ role: 'designer', round: 1, costUsd: 0.2, ok: true }, { role: 'engineer', round: 1, costUsd: 1.3, ok: true }],
  });
  assert.match(md, /agreed by designer and business analyst/);
  assert.match(md, /Round 1[\s\S]*changes requested[\s\S]*Round 2[\s\S]*approved/);
  assert.match(md, /\| 1 \| checks \| ✖ fail \| \[bug\] Unit tests: expected 2 \/ got 3 \|/); // pipes escaped in tables
  assert.match(md, /\| 2 \| tester \| ✅ pass \| — \|/);
  assert.match(md, /2 role calls, \$1\.50 total/);
});

test('headline picks the failing line from a check log', () => {
  assert.equal(headline('\n\n  ✘ 3 e2e/app.spec.ts:10 › feed (5s)\nmore\n  1 failed\n'), '✘ 3 e2e/app.spec.ts:10 › feed (5s)');
  assert.equal(headline('all good\nlast line\n\n'), 'last line');
  assert.equal(headline(''), '');
});

test('cli: token is trimmed for the CLI and masked in error output; empty output is a clear error', () => {
  const prev = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  try {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = ['\n ', 'tok', 'en-abcdefgh12345', '\n'].join('');
    assert.equal(cliEnv().CLAUDE_CODE_OAUTH_TOKEN, 'token-abcdefgh12345');
    assert.equal(cliErr(['boom with token-abcdefgh12345 inside', '⚠ Permission mode forced to default'].join('\n')), 'boom with *** inside');
    assert.match(parseResult('').error ?? '', /no output from the CLI/);
    assert.equal(parseResult('⚠ note\n{"structured_output":{"a":1},"total_cost_usd":0.1}').error, null);
  } finally { if (prev === undefined) delete process.env.CLAUDE_CODE_OAUTH_TOKEN; else process.env.CLAUDE_CODE_OAUTH_TOKEN = prev; }
});

// ---------- committee (feature pipeline builds; docs/IMPLEMENTATION.md "The cycle") ----------
import { committeePassed, demandsOf, renderCommitteeDoc, type CommitteeRound, type Verdict } from './team.ts';

const verdict = (member: Verdict['member'], o: Partial<Verdict> = {}): Verdict => ({
  member, compliance_pass: true, compliance_failures: [], usability_pass: true, demands: [], summary: `${member} summary`,
  user_test: [{ as: 'first-time trader', problems: [] }, { as: 'first-time viewer from a shared link', problems: ['the share button is below the fold'] }], ...o,
});

test('committee: passes only when both members pass compliance and usability', () => {
  assert.equal(committeePassed([verdict('business lead'), verdict('UX lead')]), true);
  assert.equal(committeePassed([verdict('business lead'), verdict('UX lead', { usability_pass: false, demands: ['x'] })]), false);
  assert.equal(committeePassed([verdict('business lead', { compliance_pass: false, compliance_failures: ['F3 disclaimer missing'] }), verdict('UX lead')]), false);
  assert.equal(committeePassed([verdict('business lead')]), false); // a member who could not answer is not a pass
  assert.equal(committeePassed([]), false);
});

test('committee: demands put compliance failures first, each tagged with its member', () => {
  const d = demandsOf([verdict('business lead', { demands: ['Lead with the chart'] }), verdict('UX lead', { compliance_pass: false, compliance_failures: ['F3 disclaimer missing on the card'] })]);
  assert.deepEqual(d.split('\n'), ['- [compliance, UX lead] F3 disclaimer missing on the card', '- [business lead] Lead with the chart']);
  assert.equal(demandsOf([verdict('business lead'), verdict('UX lead')]), '');
});

test('committee: the record logs every plan round with both sign-offs, each user test and verdict, and the outcome', () => {
  const rounds: CommitteeRound[] = [
    { round: 1, signed: true, plan: [{ round: 1, plan: 'Card leads with the chart.', lead: { approve: true, feedback: 'ok' }, engineer: { approve: true, feedback: 'fits | in one PR' } }],
      verdicts: [verdict('business lead', { usability_pass: false, demands: ['Bigger count'] }), verdict('UX lead')] },
    { round: 2, signed: false, plan: [{ round: 1, plan: 'Count at 48px.', lead: { approve: false, feedback: 'still small' }, engineer: null }],
      verdicts: [verdict('business lead'), verdict('UX lead')] },
  ];
  const doc = renderCommitteeDoc({ title: 'F-4 · Share card', date: '2026-10-26', rounds, calls: [{ role: 'ux', round: 11, costUsd: 0.5, ok: true }] });
  assert.match(doc, /^# Committee record: F-4 · Share card\n\n2026-10-26 · 2 round\(s\) · \*\*passed\*\*/);
  assert.match(doc, /### Plan \(signed by the business lead and the engineer\)/);
  assert.match(doc, /### Plan \(finalized after the round cap, unsigned\)/);
  assert.match(doc, /\*\*Engineer:\*\* signed\. fits \/ in one PR/); // table-safe text
  assert.match(doc, /\*\*Engineer:\*\* no answer/);
  assert.match(doc, /#### business lead: compliance pass, usability demands/);
  assert.match(doc, /- As first-time viewer from a shared link: the share button is below the fold/);
  assert.match(doc, /\*\*Demands:\*\*\n- Bigger count/);
  assert.match(doc, /1 role calls, \$0\.50 total/);
  assert.match(renderCommitteeDoc({ title: 'F-5', date: '2026-10-26', rounds: [], blocked: 'needs counsel', calls: [] }), /\*\*blocked\*\*: needs counsel/);
});

import { ALL_TOOLS, PROTECTED, budgetScale, isProtectedPath, protectedChanges } from './team.ts';

test('permissions: every role gets every tool; the design limits what is kept, not what is tried', () => {
  for (const t of ['Bash', 'Read', 'Edit', 'Write', 'WebSearch', 'WebFetch']) assert.ok(ALL_TOOLS.split(',').includes(t), t);
  assert.ok(!/Bash\(/.test(ALL_TOOLS), 'Bash is not narrowed to a command list');
});

test('permissions: the design boundary covers the loop, the policy, the owner\'s decisions and agent settings', () => {
  for (const f of ['.github/workflows/features.yml', 'scripts/team.ts', 'scripts/features.ts', 'scripts/autopilot.ts', 'scripts/invariants.test.ts',
    'docs/POLICY.md', 'docs/features/F-4-share-card.md', 'docs/FEATURES.md', 'CLAUDE.md', 'team/engineer.md', '.claude/settings.json', '.claude/agents/business-lead.md']) {
    assert.ok(isProtectedPath(f), f);
  }
  for (const f of ['app/page.tsx', 'lib/trades.ts', 'e2e/app.spec.ts', 'docs/specs/issue-1-a.md', 'scripts/team.test.ts.bak', 'docs/features-notes.md']) {
    assert.ok(!isProtectedPath(f), f);
  }
  assert.ok(PROTECTED.includes('./docs/POLICY.md'));
});

test('permissions: protectedChanges picks the protected paths out of a changed-file list, once each', () => {
  assert.deepEqual(protectedChanges(['app/page.tsx', ' scripts/team.ts', '', 'docs/features/F-2-x.md', 'scripts/team.ts']), ['scripts/team.ts', 'docs/features/F-2-x.md']);
  assert.deepEqual(protectedChanges(['lib/a.ts']), []);
});

test('failure budget: attempt 1 runs at the base caps; each later attempt gets half again, up to 4x', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 7, 15].map(budgetScale), [1, 1, 1.5, 2, 3, 4, 4]);
});

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync as mkdirs, readFileSync as read, writeFileSync as write, existsSync as exists } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restoreProtected } from './team.ts';

test('permissions: after an engineer call, protected paths go back (committed, uncommitted or new) and the rest of the work stays', () => {
  const dir = mkdtempSync(join(tmpdir(), 'design-'));
  const g = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  g('init', '-q'); g('config', 'user.email', 't@example.com'); g('config', 'user.name', 't');
  mkdirs(join(dir, 'scripts')); mkdirs(join(dir, 'lib')); mkdirs(join(dir, 'docs/features'), { recursive: true });
  write(join(dir, 'scripts/team.ts'), 'original\n'); write(join(dir, 'lib/a.ts'), 'a1\n'); write(join(dir, 'CLAUDE.md'), 'rules\n');
  g('add', '-A'); g('commit', '-qm', 'base');
  const before = g('rev-parse', 'HEAD');
  // The "agent": a committed change to a protected file and to product code, an uncommitted one, a new protected file.
  write(join(dir, 'scripts/team.ts'), 'loosened\n'); write(join(dir, 'lib/a.ts'), 'a2\n'); g('commit', '-qam', 'agent work');
  write(join(dir, 'CLAUDE.md'), 'edited\n'); write(join(dir, 'docs/features/F-9-new.md'), 'Status: ready\n');
  const cwd = process.cwd();
  try { process.chdir(dir); assert.deepEqual(restoreProtected(before).sort(), ['CLAUDE.md', 'docs/features/F-9-new.md', 'scripts/team.ts']); }
  finally { process.chdir(cwd); }
  assert.equal(read(join(dir, 'scripts/team.ts'), 'utf8'), 'original\n');
  assert.equal(read(join(dir, 'CLAUDE.md'), 'utf8'), 'rules\n');
  assert.ok(!exists(join(dir, 'docs/features/F-9-new.md')));
  assert.equal(read(join(dir, 'lib/a.ts'), 'utf8'), 'a2\n');
  assert.equal(g('status', '--porcelain'), '');
  assert.equal(g('diff', '--name-only', before), 'lib/a.ts');
});

test('permissions: in a conflict task, main\'s changes to protected paths are kept; the agent\'s own are put back to main\'s copy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'design-merge-'));
  const g = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'main'); g('config', 'user.email', 't@example.com'); g('config', 'user.name', 't');
  mkdirs(join(dir, 'docs/features'), { recursive: true }); mkdirs(join(dir, 'lib'));
  write(join(dir, 'docs/features/F-1-a.md'), 'Status: ready\n'); write(join(dir, 'CLAUDE.md'), 'rules\n'); write(join(dir, 'lib/a.ts'), 'a\n');
  g('add', '-A'); g('commit', '-qm', 'base');
  g('checkout', '-qb', 'feature/f-1'); write(join(dir, 'lib/a.ts'), 'feature\n'); g('commit', '-qam', 'feature');
  g('checkout', '-q', 'main'); write(join(dir, 'docs/features/F-1-a.md'), 'Status: rework\n'); write(join(dir, 'CLAUDE.md'), 'rules v2\n');
  write(join(dir, 'lib/a.ts'), 'main\n'); g('commit', '-qam', 'owner decisions');
  g('checkout', '-q', 'feature/f-1');
  try { g('merge', 'main'); } catch { /* the conflict in lib/a.ts is the task */ }
  const before = g('rev-parse', 'HEAD');
  const merging = g('rev-parse', 'MERGE_HEAD');
  // The "agent" resolves the product conflict, but also edits CLAUDE.md from the shell, then commits the merge.
  write(join(dir, 'lib/a.ts'), 'feature+main\n'); write(join(dir, 'CLAUDE.md'), 'loosened\n'); g('add', '-A'); g('commit', '-qm', 'merge main');
  const cwd = process.cwd();
  try { process.chdir(dir); assert.deepEqual(restoreProtected(before, merging), ['CLAUDE.md']); }
  finally { process.chdir(cwd); }
  assert.equal(read(join(dir, 'CLAUDE.md'), 'utf8'), 'rules v2\n');
  assert.equal(read(join(dir, 'docs/features/F-1-a.md'), 'utf8'), 'Status: rework\n');
  assert.equal(read(join(dir, 'lib/a.ts'), 'utf8'), 'feature+main\n');
  assert.equal(g('status', '--porcelain'), '');
});
