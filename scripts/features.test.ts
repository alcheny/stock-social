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
