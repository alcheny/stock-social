// Feature pipeline (docs/FEATURES.md): builds the features the owner decided in design sessions, one at a time,
// until each is accepted. Separate from the autopilot: own switch (FEATURES), workflow (features.yml), label
// (`feature`) and queue (docs/features/*.md). Shares CI, the policy scan, the branch-team engine (team.ts with
// SPEC_FILE: no designer round, the owner's decisions are the spec), the reviewer and the Gate.
//
//   node scripts/features.ts list      status table of every feature (local)
//   node scripts/features.ts next      → mode=build|fix|idle, file, number (fix: PR number), branch
//   node scripts/features.ts prepare   build: branch + .autopilot/task.md from the feature file
//   node scripts/features.ts publish   build: mark the feature built, log it, open the PR, start CI
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { failed, ownChecks } from './autopilot.ts';

export const STATUSES = ['draft', 'ready', 'built', 'accepted', 'rework'] as const;
export type Status = (typeof STATUSES)[number];
export type Feature = { file: string; id: string; title: string; status: Status | null };
const DIR = 'docs/features';
const MARK = '<!-- feature-attempt -->';

// Pure: read a feature file (`# F-003 · Title` and a `Status: ready` line).
export function parseFeature(file: string, text: string): Feature {
  const h = /^#\s+(F-\d+)\s*[·:-]\s*(.+)$/m.exec(text);
  const s = /^Status:\s*([a-z]+)/m.exec(text)?.[1] as Status | undefined;
  return { file, id: h?.[1] ?? file, title: h?.[2]?.trim() ?? file, status: s && (STATUSES as readonly string[]).includes(s) ? s : null };
}

// Pure: the next feature to build: the lowest-numbered one that is ready or sent back for rework.
export function nextFeature(fs: Feature[]): Feature | null {
  return [...fs].filter((f) => f.status === 'ready' || f.status === 'rework').sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))[0] ?? null;
}

export const setStatus = (text: string, s: Status) => text.replace(/^Status:\s*[a-z]+/m, `Status: ${s}`);
export const branchOf = (f: Feature) => `feature/${f.id.toLowerCase()}`;

const env = (k: string, d = '') => process.env[k] || d;
const sh = (cmd: string, a: string[]) => execFileSync(cmd, a, { encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
const gh = (...a: string[]) => sh('gh', a);
const ghJson = <T>(...a: string[]) => JSON.parse(gh(...a) || 'null') as T;
const output = (k: string, v: string | number) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
const authUrl = () => `https://x-access-token:${env('GH_TOKEN')}@github.com/${env('GITHUB_REPOSITORY')}.git`;

export function features(dir = DIR): Feature[] {
  let files: string[] = [];
  try { files = readdirSync(dir).filter((f) => /^F-\d+.*\.md$/.test(f)); } catch { return []; }
  return files.map((f) => parseFeature(`${dir}/${f}`, readFileSync(`${dir}/${f}`, 'utf8')));
}

function list() {
  const fs = features().sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  for (const f of fs) console.log(`${f.id.padEnd(6)} ${String(f.status ?? '?').padEnd(9)} ${f.title}`);
  const n = nextFeature(fs);
  console.log(n ? `\nnext to build: ${n.id}` : '\nnothing queued (no feature is ready or rework)');
}

function next() {
  output('mode', 'idle');
  if (env('FEATURES') !== 'on') return console.log('features: off');
  const open = ghJson<{ number: number; headRefName: string; headRefOid: string; comments: { body: string }[]; labels: { name: string }[] }[]>(
    'pr', 'list', '--label', 'feature', '--state', 'open', '--json', 'number,headRefName,headRefOid,comments,labels');
  // One feature at a time: an open feature PR is fixed when its checks fail, otherwise waited for.
  for (const p of open) {
    if (p.labels.some((l) => l.name === 'needs-human')) return console.log(`features: #${p.number} waits for the owner`);
    if (!ownChecks(p.headRefOid).some(failed)) return console.log(`features: #${p.number} in progress`);
    const tries = p.comments.filter((c) => c.body.includes(MARK)).length;
    if (tries >= Number(env('FEATURE_MAX_ATTEMPTS', '5'))) {
      gh('pr', 'edit', String(p.number), '--add-label', 'needs-human');
      gh('pr', 'comment', String(p.number), '--body', `Stopped after ${tries} fix attempts. Discuss it in a design session; the decisions in the feature file drive the next try.`);
      return;
    }
    gh('pr', 'comment', String(p.number), '--body', `${MARK}\nFix attempt ${tries + 1} started.`);
    output('mode', 'fix'); output('number', p.number); output('branch', p.headRefName);
    output('file', features().find((f) => branchOf(f) === p.headRefName)?.file ?? '');
    return console.log(`features: fixing #${p.number}`);
  }
  const f = nextFeature(features());
  if (!f) return console.log('features: nothing queued');
  output('mode', 'build'); output('file', f.file); output('branch', branchOf(f)); output('number', f.id);
  console.log(`features: building ${f.id} ${f.title}`);
}

function prepare() {
  const file = env('FILE');
  const f = parseFeature(file, readFileSync(file, 'utf8'));
  sh('git', ['checkout', '-B', branchOf(f)]);
  mkdirSync('.autopilot', { recursive: true });
  writeFileSync('.autopilot/task.md', `# Task: build ${f.id} · ${f.title}\n\nThe owner decided this feature in a design session. ` +
    `Build exactly what the decisions and acceptance criteria below say; don't redesign it. Every acceptance criterion needs a test.\n\n${readFileSync(file, 'utf8')}\n`);
  output('branch', branchOf(f));
}

function publish() {
  const file = env('FILE');
  const r = JSON.parse(readFileSync('.autopilot/result.json', 'utf8')) as { done?: boolean; summary?: string; title?: string };
  const text = readFileSync(file, 'utf8');
  const f = parseFeature(file, text);
  const branch = branchOf(f);
  const log = `\n- ${new Date().toISOString().slice(0, 10)}: built on \`${branch}\`${r.done ? '' : ' (unfinished: CI and the fix loop take it from here)'}. ${(r.summary ?? '').split('\n')[0]}`;
  writeFileSync(file, setStatus(text, 'built') + (text.includes('## Build log') ? log : `\n## Build log\n${log}`) + '\n');
  if (sh('git', ['status', '--porcelain'])) { sh('git', ['add', '-A']); sh('git', ['commit', '-m', `${f.id}: ${f.title}`]); }
  sh('git', ['push', '--force', authUrl(), `HEAD:refs/heads/${branch}`]);
  const url = gh('pr', 'create', '--head', branch, '--base', 'main', '--label', 'feature', '--title', `${f.id}: ${f.title}`, '--body',
    `Implements **${f.id} · ${f.title}** as decided in design sessions ([\`${file}\`](../blob/main/${file})). Merges when CI and the reviewer confirm every acceptance criterion; then the owner tries it and marks it accepted or rework in chat.\n\n${r.summary ?? ''}`);
  gh('workflow', 'run', 'ci.yml', '--ref', branch);
  console.log(`published ${url}`);
}

if (import.meta.main) {
  const run: Record<string, () => void> = { list, next, prepare, publish };
  const cmd = process.argv[2];
  if (!run[cmd]) { console.error(`unknown command: ${cmd}`); process.exit(2); }
  run[cmd]();
}
