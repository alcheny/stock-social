// The hand-off between the agents' job and Publish (docs/AUTOPILOT.md → Security; docs/FEATURES.md → "Permissions and
// the failure budget"). Agents run with every tool and root on their runner, so that job holds no write token and its
// output is treated as hostile: a git bundle of the branch plus .autopilot/result.json, handoff.md and plan.json.
// Publish runs on a fresh runner from main's copy of the loop and checks the hand-off here before anything is pushed.
//
//   node scripts/handoff.ts prep     prepare job (no agents): write .autopilot/prep.json {branch, base, baseRef, planned}
//                                    and fail if a token was left anywhere in .git before the workspace is uploaded
//   node scripts/handoff.ts verify   Publish job, cwd = a fresh clone of main: fetch the trusted refs from GitHub, check
//                                    the artifact (ARTIFACT_DIR) against prep.json (PREP_FILE), then check the branch out
//                                    with fresh .autopilot/ files for the publish scripts; any finding stops the publish
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOOP_PATHS, branchFor, isProtected, type Variant } from './autopilot.ts';
import { COMMITTEE_PATH } from './features.ts';
import { isProtectedPath } from './team.ts';

// The only files an agent artifact may hold, with their size caps (bytes).
export const ARTIFACT_FILES: Record<string, number> = { 'branch.bundle': 50 << 20, 'result.json': 256 << 10, 'handoff.md': 64 << 10, 'plan.json': 1 << 20 };
export const MAX_PATHS = 3000;
// The team's own records (QA log, committee record) live under the owner's protected docs/features/: allowed.
const TEAM_RECORDS = 'docs/features/logs/';
// Files git or GitHub give meaning beyond their content: never from an agent.
// So are the files that instruct agents (a later agent or the doctor would follow them).
const SPECIAL = /(^|\/)(\.gitmodules|\.gitattributes|\.lfsconfig|CODEOWNERS|CLAUDE(\.local)?\.md|AGENTS\.md|\.mcp\.json)$|(^|\/)\.claude\//;
const REF = /^(?!.*\.\.)(?!-)(?!.*\/\/)[A-Za-z0-9._\/-]{1,200}(?<![./])$/;

export type Prep = { branch: string; base: string; baseRef: string; planned: boolean };
export type Change = { path: string; mode: string }; // mode on the branch tip; 000000 = deleted
export type HandoffInput = {
  files: { name: string; size: number; kind: 'file' | 'dir' | 'symlink' | 'other' }[];
  heads: string[] | null; // the bundle's refs; null = no bundle (the agents made no commits)
  ancestor: boolean; // the base is an ancestor of the bundle's tip
  baseTrusted: boolean; // the base is on a ref just fetched from GitHub
  changes: Change[]; // the agents' changes: paths that differ from the base and from main's and the base ref's copy
  line: boolean; // a line branch (lines mode): the loop's paths are off limits too
};

// Pure: everything wrong with a hand-off. Empty = Publish may push it.
export function handoffFindings(h: HandoffInput): string[] {
  const out: string[] = [];
  for (const f of h.files) {
    if (!(f.name in ARTIFACT_FILES)) out.push(`unexpected file in the artifact: ${f.name}`);
    else if (f.kind !== 'file') out.push(`${f.name} is not a plain file (${f.kind})`);
    else if (f.size > ARTIFACT_FILES[f.name]) out.push(`${f.name} is ${f.size} bytes, over its ${ARTIFACT_FILES[f.name]}-byte cap`);
  }
  const hasBundle = h.files.some((f) => f.name === 'branch.bundle');
  if (hasBundle !== (h.heads !== null)) out.push('bundle and its heads disagree');
  if (!h.baseTrusted) out.push('the base commit is not on any branch fetched from GitHub');
  if (h.heads !== null) {
    if (h.heads.length !== 1 || h.heads[0] !== 'HEAD') out.push(`the bundle must hold exactly one head, HEAD (found: ${h.heads.join(', ') || 'none'})`);
    if (!h.ancestor) out.push('the branch is not built on the base commit (history rewritten or foreign)');
  }
  if (h.changes.length > MAX_PATHS) out.push(`${h.changes.length} changed paths, over the ${MAX_PATHS} cap`);
  for (const c of h.changes.slice(0, MAX_PATHS)) {
    const p = c.path;
    if (c.mode === '120000') out.push(`symlink: ${p}`);
    else if (c.mode === '160000') out.push(`submodule: ${p}`);
    if (p === '.autopilot' || p.startsWith('.autopilot/')) out.push(`scratch path committed: ${p}`);
    if (SPECIAL.test(p)) out.push(`special git/GitHub file: ${p}`);
    if (isProtectedPath(p) && !p.startsWith(TEAM_RECORDS)) out.push(`protected path (the owner changes it): ${p}`);
    else if (h.line && isProtected(p, LOOP_PATHS) && !p.startsWith(TEAM_RECORDS)) out.push(`the loop's path, which a line never changes: ${p}`);
  }
  return out;
}

// Agent text the bot will post (PR title and body, comments, hand-off notes): an HTML comment is how the loop marks its
// own state (approvals, attempts, costs, limits), so none may come from an agent.
export const defang = (s: string) => s.replace(/<!--/g, '&lt;!--').replace(/--!?>/g, '--&gt;');

// Pure: result.json as the publish scripts may read it. Fields they use as text must be strings; committeePath, which
// publishBlocked reads from the worktree and commits, survives only as a committee record path.
export function sanitizeResult(text: string): { result: Record<string, unknown>; findings: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { result: {}, findings: ['result.json is not JSON'] }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { result: {}, findings: ['result.json is not an object'] };
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (['done', 'limit'].includes(k)) { if (typeof v === 'boolean') r[k] = v; }
    else if (k === 'costUsd') { if (typeof v === 'number' && Number.isFinite(v) && v >= 0) r[k] = v; }
    else if (k === 'committeePath') { if (typeof v === 'string' && COMMITTEE_PATH.test(v)) r[k] = v; }
    else if (['title', 'summary', 'direction', 'design', 'business', 'tradeoffs', 'measure', 'specPath', 'blocked'].includes(k)) { if (typeof v === 'string') r[k] = defang(v); }
  }
  return { result: r, findings: [] };
}

// Pure: prep.json, validated before anything trusts it.
export function parsePrep(text: string): Prep {
  const p = JSON.parse(text) as Partial<Prep>;
  const ref = (x: unknown) => typeof x === 'string' && REF.test(x);
  if (!ref(p.branch) || !ref(p.baseRef) || typeof p.base !== 'string' || !/^[0-9a-f]{40}$/.test(p.base)) throw new Error(`invalid prep.json: ${text.slice(0, 300)}`);
  return { branch: p.branch!, base: p.base, baseRef: p.baseRef!, planned: p.planned === true };
}

// ---------- side effects ----------

const env = (k: string, d = '') => process.env[k] || d;
// No hooks, no fsmonitor, no global or system config, and every received object checked.
const GIT_SAFE = ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'transfer.fsckObjects=true', '-c', 'fetch.fsckObjects=true', '-c', 'protocol.file.allow=always'];
const gitEnv = () => ({ ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' });
const run = (cwd: string, args: string[]) => spawnSync('git', [...GIT_SAFE, ...args], { cwd, encoding: 'utf8', maxBuffer: 256 << 20, env: gitEnv() });
const git = (cwd: string, ...args: string[]) => {
  const r = run(cwd, args);
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.stderr || '').split('\n')[0]}`);
  return r.stdout.trim();
};
const ok = (cwd: string, ...args: string[]) => run(cwd, args).status === 0;

// Raw diff without renames, NUL-separated: [{path, mode on the second tree}].
function rawDiff(cwd: string, a: string, b: string): Change[] {
  const parts = git(cwd, 'diff', '--raw', '-z', '--no-renames', '--no-abbrev', a, b).split('\0').filter((x, i, all) => x !== '' || i < all.length - 1);
  const out: Change[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) out.push({ path: parts[i + 1], mode: parts[i].split(' ')[1] });
  return out;
}

const kindOf = (p: string): HandoffInput['files'][number]['kind'] => {
  const s = lstatSync(p);
  return s.isSymbolicLink() ? 'symlink' : s.isDirectory() ? 'dir' : s.isFile() ? 'file' : 'other';
};

// What Publish may trust, all from the pick job and GitHub, never from an artifact: the branch to push, the branch it
// merges into, and the commit the branch must contain (main at pick for a build; the branch's head on GitHub for a fix).
export type Target = { branch: string; baseRef: string; base: string };

// The check itself, on a repository whose refs/remotes/origin/* were just fetched from GitHub (verify does that; the
// tests use a local origin). On a pass the branch is checked out and .autopilot/ holds only the artifact's files,
// sanitized.
export function verifyIn(o: { cwd: string; artifactDir: string; target: Target }): { findings: string[]; tip: string } {
  const { cwd, artifactDir, target } = o;
  const files = readdirSync(artifactDir).map((name) => ({ name, size: lstatSync(join(artifactDir, name)).size, kind: kindOf(join(artifactDir, name)) }));
  const hasBundle = files.some((f) => f.name === 'branch.bundle');
  const early = handoffFindings({ files, heads: hasBundle ? ['HEAD'] : null, ancestor: true, baseTrusted: true, changes: [], line: false });
  if (!REF.test(target.branch) || target.branch === 'main' || /^line\//.test(target.branch)) early.push(`refusing to publish to ${target.branch}`);
  if (early.length) return { findings: early, tip: '' };
  const baseTrusted = /^[0-9a-f]{40}$/.test(target.base) && ok(cwd, 'cat-file', '-e', `${target.base}^{commit}`) &&
    git(cwd, 'for-each-ref', '--contains', target.base, '--format=%(refname)', 'refs/remotes/origin/') !== '';
  let heads: string[] | null = null;
  let tip = target.base;
  let ancestor = true;
  const bundle = join(artifactDir, 'branch.bundle');
  if (hasBundle) {
    if (!baseTrusted) return { findings: handoffFindings({ files, heads: ['HEAD'], ancestor: false, baseTrusted, changes: [], line: false }), tip: '' };
    const listed = run(cwd, ['bundle', 'list-heads', bundle]);
    if (listed.status !== 0) return { findings: ['the bundle is unreadable'], tip: '' };
    heads = listed.stdout.trim().split('\n').filter(Boolean).map((l) => l.split(' ')[1] ?? '');
    if (heads.length !== 1 || heads[0] !== 'HEAD') return { findings: handoffFindings({ files, heads, ancestor: true, baseTrusted, changes: [], line: false }), tip: '' };
    const fetched = run(cwd, ['fetch', '--no-tags', '--no-write-fetch-head', bundle, '+HEAD:refs/agent/tip']);
    if (fetched.status !== 0) return { findings: [`the bundle does not apply here (missing base, or objects fsck refused): ${(fetched.stderr || '').split('\n').find((l) => l.trim()) ?? ''}`], tip: '' };
    tip = git(cwd, 'rev-parse', 'refs/agent/tip^{commit}');
    ancestor = ok(cwd, 'merge-base', '--is-ancestor', target.base, tip);
  }
  // The agents' changes: paths whose tip copy differs from the trusted base AND from the owner's copy on main AND on the
  // base ref (a merge of main brings in the owner's version: not the agents' change). Only trusted commits are compared
  // against, and a later main only makes this stricter (more paths differ), never looser.
  let changes: Change[] = [];
  if (baseTrusted && ancestor) {
    changes = rawDiff(cwd, target.base, tip);
    for (const ref of [...new Set(['main', target.baseRef])].map((r) => `refs/remotes/origin/${r}`)) {
      if (!ok(cwd, 'rev-parse', '-q', '--verify', `${ref}^{commit}`)) continue;
      const differs = new Set(rawDiff(cwd, ref, tip).map((c) => c.path));
      changes = changes.filter((c) => differs.has(c.path));
    }
  }
  const findings = handoffFindings({ files, heads, ancestor, baseTrusted, changes, line: /^line\/[a-c]$/.test(target.baseRef) });
  let result = { result: {} as Record<string, unknown>, findings: [] as string[] };
  if (files.some((f) => f.name === 'result.json')) result = sanitizeResult(readFileSync(join(artifactDir, 'result.json'), 'utf8'));
  findings.push(...result.findings);
  if (findings.length) return { findings, tip };
  git(cwd, 'checkout', '-q', '-f', '-B', target.branch, tip);
  git(cwd, 'clean', '-fdxq');
  const dir = join(cwd, '.autopilot');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  writeFileSync(join(dir, 'result.json'), JSON.stringify(result.result));
  if (files.some((x) => x.name === 'handoff.md')) writeFileSync(join(dir, 'handoff.md'), defang(readFileSync(join(artifactDir, 'handoff.md'), 'utf8')));
  if (files.some((x) => x.name === 'plan.json')) {
    let discussion = '';
    try { const p = JSON.parse(readFileSync(join(artifactDir, 'plan.json'), 'utf8')) as { discussion?: unknown }; if (typeof p?.discussion === 'string') discussion = p.discussion; } catch { /* dropped */ }
    writeFileSync(join(dir, 'plan.json'), JSON.stringify({ discussion: defang(discussion) }));
  }
  // The publish scripts commit with `git add -A`: the tree they start from must be exactly the verified tip, so a tip
  // that un-ignores .autopilot/ (or anything else left here) is refused before it can ride along.
  if (git(cwd, 'status', '--porcelain', '--untracked-files=all')) {
    git(cwd, 'checkout', '-q', '--detach'); rmSync(dir, { recursive: true, force: true });
    return { findings: ['the verified tree is not clean once the hand-off files are in place (.gitignore changed?)'], tip };
  }
  return { findings: [], tip };
}

// Trusted target from the environment the workflow sets from pick's outputs; a fix of an existing PR (PR_NUMBER) reads
// its head and base branch from GitHub, and must build on the head GitHub has now.
function target(): Target {
  const pr = env('PR_NUMBER');
  if (pr) {
    const p = JSON.parse(execFileSync('gh', ['pr', 'view', pr, '--json', 'headRefName,baseRefName,headRefOid'], { encoding: 'utf8' })) as { headRefName: string; baseRefName: string; headRefOid: string };
    return { branch: p.headRefName, baseRef: p.baseRefName, base: p.headRefOid };
  }
  if (env('BRANCH')) return { branch: env('BRANCH'), baseRef: env('BASE_REF', 'main'), base: env('BASE_SHA') };
  // An autopilot build: the branch follows from the issue and the variant (a line builds on the line's head).
  const v = JSON.parse(env('VARIANT', '{"key":"","title":"Single","brief":""}')) as Variant;
  return v.base ? { branch: branchFor(Number(env('NUMBER')), ''), baseRef: v.base, base: '' } : { branch: branchFor(Number(env('NUMBER')), v.key), baseRef: 'main', base: env('BASE_SHA') };
}

function verify() {
  const t = target();
  if (!REF.test(t.branch) || !REF.test(t.baseRef)) throw new Error(`invalid target ${t.branch} → ${t.baseRef}`);
  const url = `https://x-access-token:${env('GH_TOKEN')}@github.com/${env('GITHUB_REPOSITORY')}.git`;
  // Full history of every ref the check compares against, straight from GitHub (a new branch doesn't exist yet).
  for (const r of [...new Set(['main', t.baseRef, t.branch])]) run('.', ['fetch', '--no-tags', '--no-write-fetch-head', url, `+refs/heads/${r}:refs/remotes/origin/${r}`]);
  if (!ok('.', 'rev-parse', '-q', '--verify', 'refs/remotes/origin/main')) throw new Error('could not fetch main');
  // A line's build starts from the line's head on GitHub (prepare may have synced the loop onto it after pick).
  if (!t.base && !/^line\/[a-c]$/.test(t.baseRef)) throw new Error('no trusted base commit for this build');
  if (!t.base) t.base = git('.', 'rev-parse', `refs/remotes/origin/${t.baseRef}^{commit}`);
  const r = verifyIn({ cwd: '.', artifactDir: env('ARTIFACT_DIR'), target: t });
  if (r.findings.length) {
    console.error(`handoff: refused, nothing is pushed:\n${r.findings.slice(0, 50).map((f) => `- ${f}`).join('\n')}`);
    process.exit(1);
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `branch=${t.branch}\n`);
  console.log(`handoff: ${t.branch} at ${r.tip.slice(0, 12)} verified (base ${t.base.slice(0, 12)}, into ${t.baseRef})`);
}

// Prepare job: record what the branch starts from (a commit GitHub has: main, the line, or the PR head before any local
// merge) and refuse to upload a workspace that kept a token.
function prep() {
  const p = parsePrep(JSON.stringify({ branch: env('BRANCH'), base: env('BASE_SHA'), baseRef: env('BASE_REF', 'main'), planned: env('PLANNED') === 'true' }));
  const leak = spawnSync('grep', ['-rlI', '-e', 'x-access-token', '-e', 'ghs_', '-e', 'AUTHORIZATION', '.git'], { encoding: 'utf8' });
  if (leak.stdout.trim()) { console.error(`handoff: a credential was left in .git (${leak.stdout.trim().split('\n').join(', ')}); not uploading`); process.exit(1); }
  mkdirSync('.autopilot', { recursive: true });
  writeFileSync('.autopilot/prep.json', JSON.stringify(p));
  console.log(`handoff: prepared ${p.branch} from ${p.base.slice(0, 12)} (${p.baseRef})`);
}

if (import.meta.main) {
  const cmds: Record<string, () => void> = { verify, prep };
  const cmd = process.argv[2];
  if (!cmds[cmd]) { console.error(`unknown command: ${cmd}`); process.exit(2); }
  cmds[cmd]();
}
