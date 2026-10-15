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
