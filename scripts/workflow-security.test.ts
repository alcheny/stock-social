// Deterministic hardening checks for the GitHub Actions workflows (public-repo safety). Runs under
// `node --test`, so CI's `npm test` enforces these on every PR and the test-count guard keeps them in place.
// These encode the rules in docs/AUTOPILOT.md → Security so a future agent (or the doctor) can't silently
// un-pin an action or reintroduce a pwn-request without failing CI.
//
// NOTE: the doctor may edit files under scripts/ except its own forbidden list, so to make these rules
// un-weakenable the owner can move the assertions into scripts/invariants.test.ts (DOCTOR_FORBIDDEN).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../.github/workflows/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

test('workflows exist to check', () => assert.ok(files.length >= 8, `found ${files.length} workflow files`));

test('every third-party action is pinned to a full commit SHA (supply chain)', () => {
  const sha = /^[0-9a-f]{40}$/;
  for (const f of files) {
    const text = readFileSync(new URL(f, dir), 'utf8');
    for (const line of text.split('\n')) {
      // Match only a step's `uses:` key (optionally after "- "), never `statuses:`/`permissions:`.
      const m = /^\s*(?:-\s*)?uses:\s*(\S+)/.exec(line);
      if (!m) continue;
      const ref = m[1];
      if (ref.startsWith('./') || ref.startsWith('docker://')) continue; // local or docker: not a tag-pinnable action
      const at = ref.lastIndexOf('@');
      assert.ok(at > 0, `${f}: action "${ref}" is not pinned (no @ref)`);
      assert.ok(sha.test(ref.slice(at + 1)), `${f}: action "${ref}" must be pinned to a 40-char commit SHA, not a tag/branch`);
    }
  }
});

test('no pull_request_target workflow checks out PR head (no pwn request)', () => {
  // pull_request_target runs in the base repo with its token/secrets; checking out PR head would run
  // attacker code with that privilege. Our only such workflow (queue.yml) checks out `main`.
  for (const f of files) {
    const text = readFileSync(new URL(f, dir), 'utf8');
    if (!text.includes('pull_request_target')) continue;
    assert.ok(!/github\.event\.pull_request\.head/.test(text),
      `${f}: triggers on pull_request_target and references github.event.pull_request.head — do not check out PR head in that context`);
  }
});

test('no ${{ github.event.* }} is interpolated into a run: script (script injection)', () => {
  // Attacker-controlled event text (titles, bodies, comments, branch names) must reach a run: script only
  // through env: vars referenced as "$VAR", never inlined into the shell. Scans the lines of each run: block.
  const re = /\$\{\{\s*github\.event\./;
  for (const f of files) {
    const lines = readFileSync(new URL(f, dir), 'utf8').split('\n');
    let inRun = false;
    let runIndent = 0;
    for (const line of lines) {
      const indent = line.length - line.trimStart().length;
      const startsRun = /^\s*(?:-\s*)?run:\s/.test(line) || /^\s*(?:-\s*)?run:\s*\|/.test(line) || /^\s*run:\s*$/.test(line);
      if (startsRun) { inRun = true; runIndent = indent; if (re.test(line)) assert.fail(`${f}: run: inlines github.event.* — pass it via env and use "$VAR":\n${line.trim()}`); continue; }
      if (inRun) {
        // A run block ends when a line at or below the run key's indentation starts a new key/step.
        if (line.trim() !== '' && indent <= runIndent) { inRun = false; }
        else { assert.ok(!re.test(line), `${f}: run: block inlines github.event.* — pass it via env and use "$VAR":\n${line.trim()}`); continue; }
      }
    }
  }
});

// The same rule for every other expression whose value a run: script must not trust as shell text: job and step
// outputs (often a branch name or PR text read from GitHub), dispatch inputs and the PR head branch (owner patch O4).
export const RUN_INLINE = /\$\{\{[^}]*\b(?:needs|steps|inputs)\.|\$\{\{[^}]*\bgithub\.head_ref\b/;
export function runLines(text: string): string[] {
  const out: string[] = [];
  let inRun = false;
  let runIndent = 0;
  for (const line of text.split('\n')) {
    const indent = line.length - line.trimStart().length;
    if (/^\s*(?:-\s*)?run:/.test(line)) { inRun = true; runIndent = indent; out.push(line); continue; }
    if (inRun && line.trim() !== '' && indent <= runIndent) inRun = false;
    if (inRun) out.push(line);
  }
  return out;
}
test('no ${{ needs.* / steps.* / inputs.* / github.head_ref }} is interpolated into a run: script (script injection)', () => {
  for (const f of files) {
    for (const line of runLines(readFileSync(new URL(f, dir), 'utf8'))) {
      assert.doesNotMatch(line, RUN_INLINE, `${f}: run: inlines an expression — pass it via env and use "$VAR":\n${line.trim()}`);
    }
  }
  const sample = '      - run: gh workflow run gate.yml -f branch="${{ needs.review.outputs.branch }}"\n      - name: next';
  assert.equal(runLines(sample).filter((l) => RUN_INLINE.test(l)).length, 1, 'the detector works');
  assert.equal(runLines('      - env:\n          B: ${{ steps.pr.outputs.branch }}\n        run: echo "$B"').filter((l) => RUN_INLINE.test(l)).length, 0, 'env: values are allowed');
});

// An installer piped into a shell runs whatever the server sends that day; each one names the exact version it
// installs (POLICY R3, owner patch O6).
export const UNPINNED_PIPE = /\|\s*(?:ba|z)?sh\b(?!\s+-s\s+\d+\.\d+\.\d+\b)/;
test('every installer piped into a shell is pinned to an exact version (supply chain)', () => {
  let found = 0;
  for (const f of files) {
    for (const line of runLines(readFileSync(new URL(f, dir), 'utf8')).filter((l) => /\b(curl|wget)\b/.test(l))) {
      if (/\|\s*(?:ba|z)?sh\b/.test(line)) found++;
      assert.doesNotMatch(line, UNPINNED_PIPE, `${f}: an installer piped into a shell must name its exact version (| bash -s <x.y.z>):\n${line.trim()}`);
    }
  }
  assert.ok(found >= 4, `found ${found} piped installers (plan, build, features, doctor)`);
  assert.match('curl -fsSL https://example.test/install.sh | bash', UNPINNED_PIPE, 'the detector works');
  assert.doesNotMatch('curl -fsSL https://example.test/install.sh | bash -s 2.1.316', UNPINNED_PIPE, 'a pinned installer passes');
});

// The review and judge agents run in a job that also holds a GitHub token, so their checkouts keep none in
// .git/config (owner patch O5). The judge hands git the token only in the step after its agent.
test('review and judge checkouts keep no token; the judge gives git one only after its agent ran', () => {
  for (const f of ['review.yml', 'judge.yml']) {
    const checkouts = jobsOf(f).flatMap((j) => stepsOf(j)).filter((st) => st.includes('actions/checkout@'));
    assert.ok(checkouts.length >= 1, `${f}: has a checkout`);
    for (const co of checkouts) assert.match(co, /persist-credentials:\s*false/, `${f}: the checkout must not keep the token`);
  }
  const steps = jobsOf('judge.yml').flatMap((j) => stepsOf(j));
  const agent = steps.findIndex((st) => /anthropics\/claude-code-action@/.test(st));
  const auth = steps.findIndex((st) => /http\.https:\/\/github\.com\/\.extraheader/.test(st));
  const post = steps.findIndex((st) => /autopilot\.ts judge-post/.test(st));
  assert.ok(agent >= 0 && auth > agent && post >= auth, `judge.yml: agent (${agent}) → token handed to git (${auth}) → judge-post (${post})`);
});

// Logs of a public repo are public: no workflow (or agent call) may turn on verbose output that could dump
// agent transcripts, environments or secrets into them (docs/POLICY.md S2).
export const VERBOSE = [/show_full_output:\s*true/, /ACTIONS_(STEP|RUNNER)_DEBUG/, /^\s*set -[a-z]*x/m, /\bprintenv\b/, /^\s*env\s*$/m, /cat\s+\.env\b/,
  /claude[^\n]*\s--(verbose|debug)\b/];
test('no workflow or agent call turns on verbose logging (public logs)', () => {
  for (const f of files) {
    const text = readFileSync(new URL(f, dir), 'utf8');
    for (const re of VERBOSE) assert.doesNotMatch(text, re, `${f}: ${re}`);
  }
  for (const s of ['team.ts', 'plan.ts', 'doctor.ts']) {
    const text = readFileSync(new URL(`../scripts/${s}`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /'--(verbose|debug)'/, s);
  }
  assert.ok(VERBOSE.some((re) => re.test('        show_full_output: true')), 'the detector works');
});

// Agents get every tool (docs/FEATURES.md → "Permissions and the failure budget"), so the one thing that keeps them
// inside the design's boundary on GitHub is that the job running them never hands them a GitHub credential.
test('the agent step (scripts/team.ts) never gets a GitHub token, and its job\'s checkouts keep none', () => {
  let found = 0;
  for (const f of files) {
    const jobs = readFileSync(new URL(f, dir), 'utf8').split(/\n(?=  [\w-]+:\s*\n)/); // top-level jobs (two-space keys)
    for (const job of jobs) {
      if (!/node [^\n]*scripts\/team\.ts/.test(job)) continue;
      const steps = job.split(/\n(?=\s*- (?:name|uses|id|run|if):)/);
      for (const step of steps.filter((st) => /node [^\n]*scripts\/team\.ts/.test(st))) {
        found++;
        assert.doesNotMatch(step, /GH_TOKEN|GITHUB_TOKEN|github\.token|secrets\.(?!CLAUDE_CODE_OAUTH_TOKEN\b)\w+/, `${f}: the agent step must not get a GitHub token or other secret:\n${step.trim()}`);
      }
      for (const co of steps.filter((st) => st.includes('actions/checkout@'))) {
        assert.match(co, /persist-credentials:\s*false/, `${f}: a checkout in a job that runs agents must not keep the token in .git/config`);
      }
    }
  }
  assert.ok(found >= 2, `found ${found} agent steps (features.yml and build.yml run scripts/team.ts)`);
});

// An agent with a shell could plant a git hook or config (core.hooksPath, url.*.insteadOf, include, credential,
// fsmonitor) that runs or redirects during Publish, where GITHUB_TOKEN is in the environment and in the push URL.
// Publish now runs in its own job on a fresh runner (below); every Publish step still drops them first, and the
// scripts it runs ignore hooks on every git call.
test('Publish after an agent step neutralizes planted git hooks and config before it commits or pushes', () => {
  let found = 0;
  for (const f of files) {
    for (const job of jobsOf(f)) {
      for (const step of stepsOf(job).filter((st) => /- name: Publish\b/.test(st))) {
        found++;
        assert.doesNotMatch(job, AGENT, `${f}: Publish never runs in the agents' job`);
        assert.match(step, /GIT_CONFIG_GLOBAL: \/dev\/null/, `${f}: Publish must ignore global git config`);
        assert.match(step, /GIT_CONFIG_NOSYSTEM: '1'/, `${f}: Publish must ignore system git config`);
        assert.match(step, /git config --local --unset-all core\.hooksPath \|\| true/, `${f}: Publish must drop core.hooksPath`);
        assert.match(step, /git config --local --name-only --list/, `${f}: Publish must drop every config key the checkout did not set`);
        assert.match(step, /rm -rf \.git\/hooks/, `${f}: Publish must remove planted hooks`);
        assert.ok(step.indexOf('rm -rf .git/hooks') < step.indexOf('node '), `${f}: the scrub runs before the publish script`);
      }
    }
  }
  assert.ok(found >= 2, `found ${found} Publish steps (features.yml and build.yml)`);
  for (const s of ['features.ts', 'autopilot.ts', 'team.ts', 'handoff.ts']) {
    const text = readFileSync(new URL(`../scripts/${s}`, import.meta.url), 'utf8');
    assert.match(text, /'-c', 'core\.hooksPath=\/dev\/null'/, `${s}: every git call runs with hooks off`);
  }
});

// ---------- the split: prepare (no agents) → agents (no write token) → Publish (fresh runner, main's loop) ----------
// docs/AUTOPILOT.md → Security. A root agent can read any token its job holds, edit $LOOP_DIR, ~/.local/bin,
// GITHUB_ENV and GITHUB_PATH; so the job that runs agents holds no write token, and Publish trusts nothing from it but
// the artifact, which scripts/handoff.ts verifies before anything is pushed.
const AGENT = /node [^\n]*scripts\/(team|plan)\.ts/;
const PUBLISH = /scripts\/(features|autopilot)\.ts"? publish\b/;
const PIPELINES = ['features.yml', 'build.yml'];
function jobsOf(f: string): string[] {
  const text = readFileSync(new URL(f, dir), 'utf8');
  const at = text.indexOf('\njobs:\n');
  return at < 0 ? [] : text.slice(at).split(/\n(?=  [\w-]+:\s*\n)/).slice(1);
}
const stepsOf = (job: string) => job.split(/\n(?=\s*- (?:name|uses|id|run|if|env|with|working-directory|continue-on-error):)/);
const permissionsOf = (job: string) => /\n    permissions:\n((?: {6}\S.*\n?)+)/.exec(job)?.[1].split('\n').map((l) => l.trim()).filter(Boolean) ?? null;
const nodeCalls = (job: string) => [...job.matchAll(/(?:^|[\s;&|(])node (?!-e )[^\n]*/g)].map((m) => m[0].trim());

test('the agents\' job holds no write token: `permissions: contents: read` only, and no GitHub token in any step', () => {
  let found = 0;
  for (const f of PIPELINES) {
    for (const job of jobsOf(f).filter((j) => AGENT.test(j))) {
      found++;
      assert.deepEqual(permissionsOf(job), ['contents: read'], `${f}: the agents' job must set job-level permissions to contents: read and nothing else`);
      assert.doesNotMatch(job, /GH_TOKEN|GITHUB_TOKEN|github\.token|secrets\.(?!CLAUDE_CODE_OAUTH_TOKEN\b)\w+/, `${f}: no GitHub token or other secret anywhere in the agents' job`);
      assert.doesNotMatch(job, PUBLISH, `${f}: the agents' job never publishes`);
      assert.doesNotMatch(job, /git push|\bgh (pr|issue|api|workflow|release)\b/, `${f}: the agents' job never pushes or calls GitHub`);
      assert.match(job, /actions\/upload-artifact@[0-9a-f]{40}[^\n]*\n(?:.*\n){0,2}\s*name: \$\{\{ steps\.handoff\.outputs\.name \}\}/, `${f}: the agents' job hands its work over under the name its hand-off step drew`);
      // A random name drawn after the agents ran: another leg can't upload it first and knock this leg out.
      assert.match(job, /echo "name=agent-\$KEY-\$\(openssl rand -hex 16\)" >> "\$GITHUB_OUTPUT"/, `${f}: the hand-off's artifact name ends in 32 random hex`);
      assert.match(job, /\n    name: \S+ \$\{\{/, `${f}: each agents' leg has its own job name, which Publish looks its artifact up by`);
      assert.match(job, /node "\$LOOP_DIR\/scripts\/team\.ts"/, `${f}: the agents run main's team.ts, not the branch's copy`);
    }
  }
  assert.ok(found >= 2, `found ${found} agent jobs (features.yml and build.yml)`);
});

test('Publish jobs never run scripts from the agents\' checkout or $LOOP_DIR: only main\'s loop/, freshly checked out', () => {
  let found = 0;
  for (const f of PIPELINES) {
    for (const job of jobsOf(f).filter((j) => PUBLISH.test(j))) {
      found++;
      assert.doesNotMatch(job, AGENT, `${f}: Publish runs no agents`);
      assert.doesNotMatch(job, /LOOP_DIR|\bnpm |\bnpx |cache:|actions\/cache@/, `${f}: Publish installs nothing, restores no cache and never uses $LOOP_DIR`);
      const checkouts = stepsOf(job).filter((st) => st.includes('actions/checkout@'));
      assert.equal(checkouts.length, 1, `${f}: Publish checks out exactly one tree, main's loop`);
      for (const co of checkouts) {
        assert.match(co, /ref: main\b/, `${f}: Publish's loop is main's copy`);
        assert.match(co, /path: loop\b/, `${f}: Publish's loop is checked out to loop/`);
        assert.match(co, /persist-credentials:\s*false/, `${f}: no token kept in .git/config`);
      }
      const calls = nodeCalls(job);
      assert.ok(calls.length >= 2, `${f}: Publish runs the verify and publish scripts`);
      for (const c of calls) assert.match(c, /^node "\$GITHUB_WORKSPACE\/loop\/scripts\/[\w-]+\.ts"/, `${f}: every script Publish runs is main's (loop/scripts/): ${c}`);
      assert.match(permissionsOf(job)?.join('\n') ?? '', /contents: write/, `${f}: Publish sets its own (write) permissions`);
    }
  }
  assert.ok(found >= 2, `found ${found} Publish jobs (features.yml and build.yml)`);
});

test('Publish verifies the downloaded hand-off before any step pushes', () => {
  for (const f of PIPELINES) {
    for (const job of jobsOf(f).filter((j) => PUBLISH.test(j))) {
      const steps = stepsOf(job);
      const lookup = steps.findIndex((st) => /loop\/scripts\/handoff\.ts" artifact/.test(st));
      const download = steps.findIndex((st) => /actions\/download-artifact@[0-9a-f]{40}/.test(st));
      // Bound to its leg: the download takes the artifact ID found in that leg's own job log, never a bare name.
      assert.ok(lookup >= 0 && download > lookup, `${f}: the leg's artifact is looked up (${lookup}) before the download (${download})`);
      assert.match(steps[download], /artifact-ids: \$\{\{ steps\.artifact\.outputs\.id \}\}/, `${f}: the download is by the looked-up ID`);
      assert.doesNotMatch(steps[download], /\n\s+name: agent-/, `${f}: never download a hand-off by name alone`);
      const agentName = /\n    name: (.+)/.exec(jobsOf(f).find((j) => AGENT.test(j)) ?? '')?.[1]?.split(' #')[0].trim();
      assert.ok(agentName && steps[lookup].includes(`JOB_NAME: ${agentName}`), `${f}: the lookup names the agents' leg job exactly (${agentName})`);
      assert.match(steps[lookup], /ARTIFACT_PREFIX: agent-.+-\n/, `${f}: the lookup takes only this leg's agent-<key>-<random> uploads`);
      const verify = steps.findIndex((st) => /loop\/scripts\/handoff\.ts" verify/.test(st));
      const publish = steps.findIndex((st) => PUBLISH.test(st));
      assert.ok(download >= 0 && verify > download && publish > verify, `${f}: download (${download}) → verify (${verify}) → publish (${publish})`);
      assert.match(steps[verify], /if: steps\.download\.outcome == 'success'/, `${f}: verify runs on the downloaded artifact`);
      assert.match(steps[verify], /id: verify/, `${f}: the verify step has the id the publish step checks`);
      assert.match(steps[publish], /if: steps\.verify\.outcome == 'success'/, `${f}: publish runs only after verify passed`);
      // Before the hand-off is verified, only the lookup (main's script, reading GitHub's job list and log) holds a token.
      for (const st of steps.slice(0, verify).filter((x) => x !== steps[lookup])) assert.doesNotMatch(st, /GH_TOKEN|github\.token/, `${f}: no token before the hand-off is verified`);
      assert.match(job, /\n    needs: \[[^\]]*\b(build|variant)\b/, `${f}: Publish waits for the agents' job`);
    }
  }
});

test('prepare jobs run no agents and only main\'s scripts (they hold GitHub tokens)', () => {
  let found = 0;
  for (const f of PIPELINES) {
    for (const job of jobsOf(f).filter((j) => /handoff\.ts" prep\b/.test(j))) {
      found++;
      assert.doesNotMatch(job, AGENT, `${f}: prepare runs no agents`);
      assert.doesNotMatch(job, /CLAUDE_CODE_OAUTH_TOKEN|LOOP_DIR|\bnpm |\bnpx |cache:/, `${f}: prepare installs nothing and holds no Claude token`);
      for (const c of nodeCalls(job)) assert.match(c, /^node "\$GITHUB_WORKSPACE\/loop\/scripts\/[\w-]+\.ts"/, `${f}: every script prepare runs is main's: ${c}`);
      for (const co of stepsOf(job).filter((st) => st.includes('actions/checkout@'))) assert.match(co, /persist-credentials:\s*false/, `${f}: no token kept in .git/config`);
    }
  }
  assert.ok(found >= 2, `found ${found} prepare jobs`);
  // The line's own scanner is agent-written: prepare runs main's copy, beside autopilot.ts.
  assert.match(readFileSync(new URL('../scripts/autopilot.ts', import.meta.url), 'utf8'), /new URL\('\.\/compliance\.ts', import\.meta\.url\)/);
});

// Agents' jobs run on main's ref, so with the runtime token a root agent can write cache entries every later run on
// main (or a PR into it) may restore. Jobs that hold a write token restore none. (The agents' own jobs keep npm's
// cache: npm checks every package against package-lock.json's integrity hashes, and those jobs are untrusted anyway.)
test('no job that holds a write token restores a cache', () => {
  for (const f of files) {
    const text = readFileSync(new URL(f, dir), 'utf8');
    const top = /^permissions:\n((?: {2}\S.*\n?)+)/m.exec(text)?.[1] ?? '';
    for (const job of jobsOf(f)) {
      const perms = permissionsOf(job)?.join('\n') ?? top;
      if (!/:\s*write\b/.test(perms)) continue;
      assert.doesNotMatch(job, /^\s*cache:\s*\S|actions\/cache@/m, `${f}: a job with a write token restores a cache:\n${job.split('\n')[0]}`);
    }
  }
});

test('autopilot fixes and rebuilds carry their attempt number to the team (failure budget)', () => {
  const build = readFileSync(new URL('build.yml', dir), 'utf8');
  assert.match(build, /attempt: \$\{\{ steps\.next\.outputs\.attempt \}\}/, 'pick exposes the attempt');
  assert.match(build, /ATTEMPT: \$\{\{ needs\.pick\.outputs\.attempt \|\| '1' \}\}/, 'the branch team gets it');
});
