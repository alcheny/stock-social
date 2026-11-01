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

// ---------- review fixes: renames and quoted names, uncommitted work, planted git state, the time cap ----------

import { chmodSync, lstatSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { spawnSync as run } from 'node:child_process';
import { checkEnv, gitSnapshot, keepEngineerWork, restoreGit } from './team.ts';

const scratch = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const g = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'main'); g('config', 'user.email', 't@example.com'); g('config', 'user.name', 't');
  return { dir, g };
};
const inDir = <T>(dir: string, f: () => T): T => { const cwd = process.cwd(); try { process.chdir(dir); return f(); } finally { process.chdir(cwd); } };

test('permissions: a renamed protected file and a non-ASCII new protected path are put back too', () => {
  const { dir, g } = scratch('design-rename-');
  mkdirs(join(dir, 'scripts')); mkdirs(join(dir, 'docs/features'), { recursive: true });
  write(join(dir, 'scripts/team.ts'), 'original\n'); write(join(dir, 'scripts/plan.ts'), 'plan\n'); g('add', '-A'); g('commit', '-qm', 'base');
  const before = g('rev-parse', 'HEAD');
  // Rename detection would list only the new path; core.quotePath would quote the non-ASCII one.
  g('mv', 'scripts/team.ts', 'scripts/team2.ts'); g('commit', '-qm', 'rename');
  g('mv', 'scripts/plan.ts', 'scripts/plan-old.ts'); // staged, not committed
  write(join(dir, 'docs/features/F-9-café.md'), 'Status: ready\n');
  assert.deepEqual(inDir(dir, () => restoreProtected(before)).sort(), ['docs/features/F-9-café.md', 'scripts/plan.ts', 'scripts/team.ts']);
  assert.equal(read(join(dir, 'scripts/team.ts'), 'utf8'), 'original\n');
  assert.equal(read(join(dir, 'scripts/plan.ts'), 'utf8'), 'plan\n');
  assert.ok(!exists(join(dir, 'docs/features/F-9-café.md')));
});

test('engineer: work left uncommitted at the end of a call is committed, so a later reviewer reset cannot wipe it', () => {
  const { dir, g } = scratch('engineer-left-');
  mkdirs(join(dir, 'lib')); write(join(dir, 'lib/a.ts'), 'a1\n'); g('add', '-A'); g('commit', '-qm', 'base');
  const before = g('rev-parse', 'HEAD');
  write(join(dir, 'lib/a.ts'), 'a2\n'); write(join(dir, 'lib/b.ts'), 'b\n'); write(join(dir, 'CLAUDE.md'), 'planted\n');
  assert.deepEqual(inDir(dir, () => keepEngineerWork(before, '')), ['CLAUDE.md']);
  assert.equal(g('status', '--porcelain'), '');
  assert.equal(g('diff', '--name-only', before), 'lib/a.ts\nlib/b.ts');
  write(join(dir, 'lib/c.ts'), 'c\n'); // no protected path this time: the work gets its own commit
  inDir(dir, () => keepEngineerWork(g('rev-parse', 'HEAD'), ''));
  assert.match(g('log', '-1', '--format=%s'), /left uncommitted/);
  assert.equal(g('status', '--porcelain'), '');
});

const conflicted = (prefix: string) => {
  const s = scratch(prefix);
  mkdirs(join(s.dir, 'lib')); write(join(s.dir, 'lib/a.ts'), 'a\n'); write(join(s.dir, 'lib/c.ts'), 'c\n'); s.g('add', '-A'); s.g('commit', '-qm', 'base');
  s.g('checkout', '-qb', 'feature/f-1'); write(join(s.dir, 'lib/a.ts'), 'feature\n'); write(join(s.dir, 'lib/c.ts'), 'feature c\n'); s.g('commit', '-qam', 'feature');
  s.g('checkout', '-q', 'main'); write(join(s.dir, 'lib/a.ts'), 'main\n'); write(join(s.dir, 'lib/c.ts'), 'main c\n'); s.g('commit', '-qam', 'main');
  s.g('checkout', '-q', 'feature/f-1');
  try { s.g('merge', 'main'); } catch { /* the conflicts are the task */ }
  return { ...s, before: s.g('rev-parse', 'HEAD'), merging: s.g('rev-parse', 'MERGE_HEAD') };
};

test('engineer: a resolved but uncommitted merge is completed; unresolved conflicts are left for features.ts resolved to fail', () => {
  const done = conflicted('merge-done-');
  write(join(done.dir, 'lib/a.ts'), 'both\n'); write(join(done.dir, 'lib/c.ts'), 'both c\n'); done.g('add', 'lib/a.ts', 'lib/c.ts');
  inDir(done.dir, () => keepEngineerWork(done.before, done.merging));
  assert.equal(done.g('log', '-1', '--format=%P').split(' ').length, 2, 'a merge commit');
  assert.equal(done.g('status', '--porcelain'), '');
  assert.equal(read(join(done.dir, 'lib/c.ts'), 'utf8'), 'both c\n');

  const half = conflicted('merge-half-');
  write(join(half.dir, 'lib/a.ts'), 'both\n'); half.g('add', 'lib/a.ts'); // c.ts still conflicted
  inDir(half.dir, () => keepEngineerWork(half.before, half.merging));
  assert.equal(half.g('rev-parse', 'HEAD'), half.before, 'nothing committed');
  assert.equal(half.g('rev-parse', 'MERGE_HEAD'), half.merging, 'the merge is still pending');
  assert.equal(half.g('diff', '--name-only', '--diff-filter=U'), 'lib/c.ts');
});

test('git state: hooks and config an agent plants never run, and are removed after the call', () => {
  const { dir, g } = scratch('git-state-');
  write(join(dir, 'a.txt'), 'a\n'); g('add', '-A'); g('commit', '-qm', 'base');
  const snap = inDir(dir, () => gitSnapshot());
  const config = read(join(dir, '.git/config'), 'utf8');
  const before = g('rev-parse', 'HEAD');
  // The "agent": a hook in .git/hooks, a hooksPath of its own, a URL rewrite, an include and a worktree config.
  const marker = join(dir, 'hook-ran');
  const hook = `#!/bin/sh\necho ran > '${marker}'\n`;
  write(join(dir, '.git/hooks/pre-commit'), hook); chmodSync(join(dir, '.git/hooks/pre-commit'), 0o755);
  mkdirs(join(dir, '.evil')); write(join(dir, '.evil/pre-commit'), hook); chmodSync(join(dir, '.evil/pre-commit'), 0o755);
  g('config', 'core.hooksPath', '.evil'); g('config', 'url.https://evil.example/.insteadOf', 'https://github.com/'); g('config', 'include.path', '/tmp/x');
  write(join(dir, '.git/config.worktree'), '[core]\n\tfsmonitor = true\n');
  write(join(dir, 'b.txt'), 'b\n');
  inDir(dir, () => keepEngineerWork(before, '')); // commits b.txt with the planted hooks still in place
  assert.ok(!exists(marker), 'no hook ran during the commit');
  assert.notEqual(g('rev-parse', 'HEAD'), before);
  inDir(dir, () => restoreGit(snap));
  assert.equal(read(join(dir, '.git/config'), 'utf8'), config);
  assert.ok(!exists(join(dir, '.git/config.worktree')));
  assert.deepEqual(readdirSync(join(dir, '.git/hooks')).filter((f) => !f.endsWith('.sample')), []);
  // Symlinks planted in .git are dropped, never followed: hooks pointing into the product code, config pointing out.
  mkdirs(join(dir, 'lib')); write(join(dir, 'lib/keep.ts'), 'k\n'); write(join(dir, 'outside.txt'), 'o\n');
  rmSync(join(dir, '.git/hooks'), { recursive: true }); symlinkSync(join(dir, 'lib'), join(dir, '.git/hooks'));
  rmSync(join(dir, '.git/config')); symlinkSync(join(dir, 'outside.txt'), join(dir, '.git/config'));
  inDir(dir, () => restoreGit(snap));
  assert.equal(read(join(dir, 'lib/keep.ts'), 'utf8'), 'k\n');
  assert.equal(read(join(dir, 'outside.txt'), 'utf8'), 'o\n');
  assert.equal(read(join(dir, '.git/config'), 'utf8'), config);
  assert.ok(!lstatSync(join(dir, '.git/hooks')).isSymbolicLink());
});

test('checks: the agent-written code they run never sees the Claude token', () => {
  const saved = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'sk-ant-oat01-secret';
  try { assert.ok(!('CLAUDE_CODE_OAUTH_TOKEN' in checkEnv({ VERCEL_ENV: 'preview' }))); assert.equal(checkEnv({ VERCEL_ENV: 'preview' }).VERCEL_ENV, 'preview'); }
  finally { if (saved === undefined) delete process.env.CLAUDE_CODE_OAUTH_TOKEN; else process.env.CLAUDE_CODE_OAUTH_TOKEN = saved; }
});

test('time cap: after TEAM_MINUTES a running call is stopped and the QA loop runs no more checks', () => {
  const { dir, g } = scratch('time-cap-');
  write(join(dir, 'a.txt'), 'a\n'); g('add', '-A'); g('commit', '-qm', 'base');
  // A fake CLI: the first call (the fix-mode engineer) answers at once and leaves its work uncommitted; every later
  // call hangs. PATH holds only node and git, so the checks fail fast and the port-3000 cleanup finds nothing to kill.
  const bin = mkdtempSync(join(tmpdir(), 'time-cap-bin-'));
  symlinkSync(process.execPath, join(bin, 'node'));
  symlinkSync(execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim(), join(bin, 'git'));
  write(join(bin, 'claude'), `#!/usr/bin/env node
const fs = require('fs'); const f = ${JSON.stringify(join(bin, 'calls'))};
const n = fs.existsSync(f) ? Number(fs.readFileSync(f, 'utf8')) + 1 : 1; fs.writeFileSync(f, String(n));
if (n > 1) setTimeout(() => {}, 60000);
else { fs.writeFileSync('work.txt', 'engineer\\n'); console.log(JSON.stringify({ structured_output: { done: true, title: 't', summary: 's' }, total_cost_usd: 0 })); }
`);
  chmodSync(join(bin, 'claude'), 0o755);
  const t0 = Date.now();
  const p = run(process.execPath, [new URL('./team.ts', import.meta.url).pathname], { cwd: dir, encoding: 'utf8', timeout: 50_000,
    env: { NODE_ENV: 'test', PATH: bin, HOME: dir, MODE: 'fix', NUMBER: '1', CLAUDE_BIN: join(bin, 'claude'), TEAM_MINUTES: '0.1', QA_ROUNDS: '40' } });
  assert.equal(p.status, 0, p.stderr);
  assert.ok(Date.now() - t0 < 30_000, 'the hanging call was stopped at TEAM_MINUTES');
  assert.equal((p.stdout.match(/→ check: /g) ?? []).length, 1, p.stdout);
  assert.match(read(join(dir, '.autopilot/result.json'), 'utf8'), /after 1 QA round/);
  assert.match(g('log', '--format=%s'), /left uncommitted/);
  assert.equal(g('show', 'HEAD:work.txt'), 'engineer');
});
