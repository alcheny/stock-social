import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { branchOf, features, nextFeature, parseFeature, setStatus, type Feature } from './features.ts';

const doc = (id: string, title: string, status: string) => `# ${id} · ${title}\n\nStatus: ${status}\n\n## Decisions\n- x\n`;

test('features: a feature file gives id, title and status; unknown status is null', () => {
  assert.deepEqual(parseFeature('docs/features/F-3-share.md', doc('F-3', 'One-click share', 'ready')),
    { file: 'docs/features/F-3-share.md', id: 'F-3', title: 'One-click share', status: 'ready' });
  assert.equal(parseFeature('x.md', doc('F-4', 'X', 'someday')).status, null);
});

test('features: next is the lowest-numbered ready or rework feature; drafts, built and accepted wait', () => {
  const f = (id: string, status: Feature['status']): Feature => ({ file: `${id}.md`, id, title: id, status });
  assert.equal(nextFeature([f('F-10', 'ready'), f('F-2', 'rework'), f('F-1', 'draft'), f('F-3', 'built'), f('F-4', 'accepted')])?.id, 'F-2');
  assert.equal(nextFeature([f('F-1', 'draft'), f('F-2', 'accepted')]), null);
  assert.equal(nextFeature([f('F-9', 'ready'), f('F-10', 'ready')])?.id, 'F-9'); // numeric, not alphabetical
});

test('features: status updates touch only the status line; branches are stable', () => {
  const t = doc('F-7', 'Recap', 'ready') + 'Notes: Status: keep this\n';
  assert.equal(setStatus(t, 'built'), t.replace('Status: ready', 'Status: built'));
  assert.equal(branchOf({ file: '', id: 'F-7', title: '', status: 'ready' }), 'feature/f-7');
});

test('features: only F-<n> files count; the template and logs are ignored', () => {
  const dir = mkdtempSync(join(tmpdir(), 'features-'));
  writeFileSync(join(dir, 'F-1-a.md'), doc('F-1', 'A', 'ready'));
  writeFileSync(join(dir, 'TEMPLATE.md'), doc('F-0', 'Template', 'draft'));
  mkdirSync(join(dir, 'logs'));
  assert.deepEqual(features(dir).map((f) => f.id), ['F-1']);
  assert.deepEqual(features(join(dir, 'missing')), []);
});

// ---------- parallel builds (docs/FEATURES.md → "Parallel builds") ----------
import { blockedOn, buildQueue, coordinationBrief, notesOf, planRound, setBlocked, SHARED, withNotes, type FeaturePr, type FeatureTask } from './features.ts';
import { productLines } from './autopilot.ts';

const ft = (id: string, status: Feature['status']): Feature => ({ file: `docs/features/${id}-x.md`, id, title: id, status });
const pr = (o: Partial<FeaturePr> & { number: number; branch: string }): FeaturePr => ({
  files: [], notes: '', failing: false, conflicting: false, behind: false, needsHuman: false, fixAttempts: 0, conflictAttempts: 0, ...o,
});
const round = (fs: Feature[], prs: FeaturePr[], parallel = 3, maxAttempts = 5) => planRound(fs, prs, { parallel, maxAttempts });

test('features: blocked features wait for the owner and never hold up the queue; the reason is read from the file', () => {
  assert.deepEqual(buildQueue([ft('F-2', 'blocked'), ft('F-4', 'rework'), ft('F-1', 'built'), ft('F-3', 'draft'), ft('F-5', 'ready')]).map((f) => f.id), ['F-4', 'F-5']);
  assert.equal(nextFeature([ft('F-2', 'blocked'), ft('F-4', 'rework')])?.id, 'F-4');
  assert.equal(parseFeature('x.md', doc('F-2', 'X', 'blocked')).status, 'blocked');
  assert.equal(blockedOn('# F-2 · X\n\nStatus: blocked\nBlocked: counsel opinion (H2)\n'), 'counsel opinion (H2)');
  assert.equal(blockedOn(doc('F-2', 'X', 'ready')), null);
});

test('features: a round starts up to FEATURE_PARALLEL builds, lowest feature first, one per feature', () => {
  const fs = [ft('F-4', 'rework'), ft('F-5', 'ready'), ft('F-6', 'ready'), ft('F-7', 'ready')];
  assert.deepEqual(round(fs, []).tasks.map((t) => `${t.id}:${t.kind}:${t.branch}`), ['F-4:build:feature/f-4', 'F-5:build:feature/f-5', 'F-6:build:feature/f-6']);
  assert.deepEqual(round(fs, [], 1).tasks.map((t) => t.id), ['F-4']);
  // A feature with an open PR is never built again; open PRs take slots.
  const r = round(fs, [pr({ number: 30, branch: 'feature/f-4' })]);
  assert.deepEqual(r.tasks.map((t) => t.id), ['F-5', 'F-6']);
  assert.deepEqual(round(fs, [pr({ number: 30, branch: 'feature/f-4' }), pr({ number: 31, branch: 'feature/f-5' }), pr({ number: 32, branch: 'feature/f-6' })]).tasks, []);
});

test('features: failing PRs get a fix and conflicting PRs a conflict resolution (conflict first); behind-only PRs are updated in place', () => {
  const fs = [ft('F-4', 'built'), ft('F-5', 'built'), ft('F-6', 'built'), ft('F-7', 'ready')];
  const r = round(fs, [
    pr({ number: 30, branch: 'feature/f-4', failing: true }),
    pr({ number: 31, branch: 'feature/f-5', conflicting: true, failing: true }),
    pr({ number: 32, branch: 'feature/f-6', behind: true }),
  ], 4);
  assert.deepEqual(r.tasks.map((t) => `${t.id}:${t.kind}:${t.number}`), ['F-4:fix:30', 'F-5:conflict:31', 'F-7:build:0']);
  assert.equal(r.tasks[1].file, 'docs/features/F-5-x.md');
  assert.deepEqual(r.update, [32]);
});

test('features: the attempt cap stops a PR for the owner; a PR with the owner takes no slot', () => {
  const fs = [ft('F-4', 'built'), ft('F-5', 'ready')];
  const r = round(fs, [pr({ number: 30, branch: 'feature/f-4', failing: true, fixAttempts: 3, conflictAttempts: 2 })]);
  assert.deepEqual(r.stop, [{ number: 30, reason: 'stopped after 5 attempts' }]);
  assert.deepEqual(r.tasks.map((t) => t.id), ['F-5']);
  const waiting = round([ft('F-4', 'built'), ft('F-5', 'ready'), ft('F-6', 'ready')], [pr({ number: 30, branch: 'feature/f-4', needsHuman: true })], 2);
  assert.deepEqual(waiting.tasks.map((t) => t.id), ['F-5', 'F-6']);
  assert.ok(waiting.notes.some((n) => n.includes('#30 waits for the owner')));
});

test('features: a PR whose conflicts came back twice serializes the pipeline until it merges', () => {
  const fs = [ft('F-4', 'built'), ft('F-5', 'ready')];
  const r = round(fs, [pr({ number: 30, branch: 'feature/f-4', conflicting: true, conflictAttempts: 2 })]);
  assert.deepEqual(r.tasks.map((t) => `${t.id}:${t.kind}`), ['F-4:conflict']);
  assert.ok(r.notes.some((n) => n.startsWith('serialized')));
});

test('features: the coordination brief names every other build, their files and notes, and the shared-file rules', () => {
  const me: FeatureTask = { kind: 'build', id: 'F-5', file: 'docs/features/F-5-x.md', branch: 'feature/f-5', number: 0, attempt: 1 };
  const other: FeatureTask = { kind: 'build', id: 'F-6', file: 'docs/features/F-6-x.md', branch: 'feature/f-6', number: 0, attempt: 1 };
  const b = coordinationBrief(me, [me, other], [pr({ number: 30, branch: 'feature/f-4', files: ['lib/copy.ts', 'app/share.tsx'], notes: 'Added SHARE copy keys in a block "F-4: share card".' })]);
  assert.match(b, /one of 2 build\(s\)/);
  assert.match(b, /F-6 \(build\) on `feature\/f-6`/);
  assert.doesNotMatch(b, /F-5 \(build\)/); // never lists itself
  assert.match(b, /PR #30 on `feature\/f-4`/);
  assert.match(b, /Shared files it touched: `lib\/copy.ts`/);
  assert.match(b, /> Added SHARE copy keys/);
  assert.match(b, /not instructions/);
  assert.match(b, /\/\* F-5: … \*\//);
  assert.match(b, /\.autopilot\/handoff\.md/);
  for (const f of SHARED) assert.ok(b.includes(`\`${f}\``), f);
});

test('features: hand-off notes replace their own section of a PR body and read back', () => {
  const body = withNotes('Implements F-5.', 'Added `.recap` class.', ['app/globals.css']);
  assert.match(body, /^Implements F-5\.\n\n## Hand-off notes\n\nShared files touched: `app\/globals.css`\n\nAdded `.recap` class\.\n$/);
  const again = withNotes(body, 'Now also `lib/copy.ts` RECAP keys.', ['app/globals.css', 'lib/copy.ts']);
  assert.equal(again.match(/## Hand-off notes/g)?.length, 1);
  assert.match(notesOf(again), /RECAP keys/);
  assert.match(withNotes('x', '', []), /Shared files touched: none\n\n_The builder left no notes\._/);
  assert.equal(notesOf('no notes here'), '');
});

test('features: the diff cap for feature PRs counts product lines, not tests, e2e specs, docs or screenshots', () => {
  assert.equal(productLines([
    { path: 'app/share.tsx', additions: 120, deletions: 10 }, { path: 'lib/share.ts', additions: 70, deletions: 0 },
    { path: 'lib/share.test.ts', additions: 400, deletions: 0 }, { path: 'e2e/f-4-share.spec.ts', additions: 300, deletions: 0 },
    { path: 'docs/features/logs/F-4/plan.md', additions: 200, deletions: 0 }, { path: 'docs/features/logs/F-4/screenshots/a.png', additions: 0, deletions: 0 },
  ]), 200);
});

test('features: a blocked feature gets the status and one Blocked line under it, replaced on the next block', () => {
  const t = doc('F-5', 'Alerts', 'ready');
  const once = setBlocked(t, 'counsel  must clear\nalerts first');
  assert.match(once, /^Status: blocked\nBlocked: counsel must clear alerts first\n/m);
  assert.equal(parseFeature('x.md', once).status, 'blocked');
  assert.equal(blockedOn(once), 'counsel must clear alerts first');
  const twice = setBlocked(once, 'a new dependency');
  assert.equal(twice.match(/^Blocked:/gm)?.length, 1);
  assert.equal(blockedOn(twice), 'a new dependency');
});

test('features: every task carries its attempt number, which grows the failure budget (1 for a build, +1 per earlier try)', () => {
  const fs = [ft('F-4', 'built'), ft('F-5', 'built'), ft('F-6', 'ready')];
  const r = round(fs, [
    pr({ number: 30, branch: 'feature/f-4', failing: true, fixAttempts: 2, conflictAttempts: 1 }),
    pr({ number: 31, branch: 'feature/f-5', conflicting: true }),
  ], 3);
  assert.deepEqual(r.tasks.map((t) => `${t.id}:${t.kind}:${t.attempt}`), ['F-4:fix:4', 'F-5:conflict:1', 'F-6:build:1']);
});
