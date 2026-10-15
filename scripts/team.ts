// Branch team (docs/AUTOPILOT.md → "Branch team"; each role's spec is team/<role>.md). One per branch, so one per variant:
//   1. Spec:  designer ⇄ business analyst until they agree (capped), written to docs/specs/.
//   2. Build: engineer implements the agreed spec.
//   3. QA:    cheap deterministic checks first; only if they pass does the tester (LLM) review spec
//             conformance and usability. Findings go back to the engineer. Repeat until clean (capped).
// Each role is a separate headless Claude Code call: fresh context (no one grades their own work),
// role-limited tools, a JSON-schema answer, and per-call turn and dollar caps. This script owns the
// loops, the caps and the record. Agents hold no GitHub credentials; Publish pushes afterwards.
//
//   MODE=build|fix NUMBER=<issue|pr> VARIANT='{"key":"a",...}' BRANCH=... node scripts/team.ts
//   → commits on the current branch, writes .autopilot/result.json for `autopilot.ts publish`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { branchInfo, isLimitError, type BuildResult, type Variant } from './autopilot.ts';

// ---------- pure parts (tested in scripts/team.test.ts) ----------

export type Finding = { severity: 'bug' | 'usability' | 'spec' | 'note'; where: string; problem: string };
export const blocking = (fs: Finding[]) => fs.filter((f) => f.severity !== 'note');

// The CLI's `--output-format json` envelope: structured answer, cost, and error state.
export function parseResult(stdout: string): { out: unknown; cost: number; error: string | null } {
  let j: { structured_output?: unknown; result?: string; is_error?: boolean; total_cost_usd?: number };
  try { j = JSON.parse(stdout); } catch { return { out: null, cost: 0, error: `unparseable CLI output: ${stdout.slice(0, 200)}` }; }
  let out = j.structured_output ?? null;
  if (out === null && j.result) { try { out = JSON.parse(j.result); } catch { /* not JSON */ } }
  return { out, cost: j.total_cost_usd ?? 0, error: j.is_error ? j.result ?? 'error' : out === null ? 'no structured output' : null };
}

export type Discussion = { round: number; designer: string; business?: { approve: boolean; ease_of_use: string; retention: string; virality: string; feedback: string } };
export type QaRound = { round: number; by: 'checks' | 'tester'; pass: boolean; findings: Finding[] };
export type CallLog = { role: string; round: number; costUsd: number; ok: boolean };

const esc = (s: string) => s.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

export function renderSpecDoc(d: {
  title: string; variant: string; spec: string; agreed: boolean; discussion: Discussion[]; qa: QaRound[]; calls: CallLog[];
}): string {
  const disc = d.discussion.map((r) => [
    `### Round ${r.round}`, '', `**Designer:** ${r.designer}`,
    r.business ? `\n**Business analyst (${r.business.approve ? 'approved' : 'changes requested'}):**\n- Ease of use: ${r.business.ease_of_use}\n- Retention: ${r.business.retention}\n- Virality: ${r.business.virality}\n- Feedback: ${r.business.feedback}` : '',
  ].join('\n')).join('\n\n');
  const qa = d.qa.map((q) => `| ${q.round} | ${q.by} | ${q.pass ? '✅ pass' : '✖ fail'} | ${q.findings.length ? esc(q.findings.map((f) => `[${f.severity}] ${f.where}: ${f.problem}`).join(' · ')).slice(0, 600) : '—'} |`);
  const total = d.calls.reduce((s, c) => s + c.costUsd, 0);
  return [
    `# Spec: ${d.title}`, '', `Variant: **${d.variant}** · Spec ${d.agreed ? 'agreed by designer and business analyst' : 'finalized by designer after the round cap (business concerns below)'}`,
    '', '## Agreed spec', '', d.spec.trim(),
    '', '## Designer ⇄ business discussion', '', disc || '_none_',
    '', '## QA log', '', '| Round | By | Result | Findings |', '|---|---|---|---|', ...(qa.length ? qa : ['| — | — | — | — |']),
    '', `## Cost`, '', `${d.calls.length} role calls, $${total.toFixed(2)} total: ` + d.calls.map((c) => `${c.role}#${c.round} $${c.costUsd.toFixed(2)}${c.ok ? '' : ' (failed)'}`).join(', '),
    '',
  ].join('\n');
}

// ---------- roles ----------

type Role = 'designer' | 'business' | 'engineer' | 'tester';
const PROTECTED_EDITS = ['./.github/**', './docs/AUTOPILOT.md', './docs/DECISIONS.md', './docs/DESIGN.md', './scripts/autopilot.ts', './scripts/team.ts', './scripts/plan.ts', './scripts/doctor.ts', './scripts/invariants.test.ts', './docs/POLICY.md', './SECURITY.md', './scripts/compliance.ts', './scripts/compliance.test.ts', './scripts/policy.test.ts', './scripts/workflow-security.test.ts', './CLAUDE.md', './team/**', './.claude/agents/**', './playwright.config.ts']
  .flatMap((p) => [`Edit(${p})`, `Write(${p})`]).join(',');
const READ = 'Read,Glob,Grep';
const RUN = 'Bash(npm:*),Bash(npx tsc:*),Bash(npx playwright:*),Bash(node:*),Bash(git diff:*),Bash(git log:*),Bash(git show:*),Bash(git status:*)';
const env = (k: string, d = '') => process.env[k] || d;
// LOOP_DIR: main's copy of the loop (build.yml snapshots it before switching to a line branch), so agents
// always follow the current team specs. BASE_REF: what this branch is compared against (main or its line).
const LOOP = env('LOOP_DIR');
const at = (path: string) => (LOOP ? `${LOOP}/${path}` : path);
const BASE_REF = env('BASE_REF', 'main');

// Cost-effective by default: discussion and testing on a mid-size model, the frontier model only for coding.
const ROLES: Record<Role, { model: string; tools: string; budget: number; turns: number }> = {
  designer: { model: env('MODEL_DESIGNER', 'sonnet'), tools: READ, budget: Number(env('BUDGET_DESIGNER', '1')), turns: 30 },
  business: { model: env('MODEL_BUSINESS', 'sonnet'), tools: READ, budget: Number(env('BUDGET_BUSINESS', '0.5')), turns: 20 },
  engineer: { model: env('MODEL_ENGINEER', ''), tools: `${READ},Edit,Write,${RUN},Bash(git add:*),Bash(git commit:*)`, budget: Number(env('BUDGET_ENGINEER', '4')), turns: 150 },
  tester: { model: env('MODEL_TESTER', 'sonnet'), tools: `${READ},${RUN}`, budget: Number(env('BUDGET_TESTER', '1.5')), turns: 60 },
};

const SCHEMAS: Record<Role, object> = {
  designer: { type: 'object', required: ['spec', 'summary', 'direction', 'design', 'business', 'tradeoffs', 'measure'], properties: {
    spec: { type: 'string' }, summary: { type: 'string' }, direction: { type: 'string' }, design: { type: 'string' },
    business: { type: 'string' }, tradeoffs: { type: 'string' }, measure: { type: 'string' } } },
  business: { type: 'object', required: ['approve', 'ease_of_use', 'retention', 'virality', 'feedback'], properties: {
    approve: { type: 'boolean' }, ease_of_use: { type: 'string' }, retention: { type: 'string' }, virality: { type: 'string' }, feedback: { type: 'string' } } },
  engineer: { type: 'object', required: ['done', 'title', 'summary'], properties: { done: { type: 'boolean' }, title: { type: 'string' }, summary: { type: 'string' } } },
  tester: { type: 'object', required: ['pass', 'findings'], properties: { pass: { type: 'boolean' }, findings: { type: 'array', items: {
    type: 'object', required: ['severity', 'where', 'problem'], properties: {
      severity: { type: 'string', enum: ['bug', 'usability', 'spec', 'note'] }, where: { type: 'string' }, problem: { type: 'string' } } } } } },
};

const calls: CallLog[] = [];
const spent = () => calls.reduce((s, c) => s + c.costUsd, 0);
const TEAM_BUDGET = Number(env('TEAM_BUDGET_USD', '15'));
let hitLimit = false; // Claude usage limit: stop calling, and tell the loop to pause (auto mode)

// dontAsk: exactly the allowlisted tools, no AI permission classifier. On the throwaway CI runner (no write
// credentials; the Gate rejects loop-file changes) the classifier only added false positives, e.g. it blocked
// a legitimate `git commit` as a "CI bypass", which lost the work and stalled a line.
function ask<T>(role: Role, round: number, prompt: string): T | null {
  if (hitLimit) return null;
  if (spent() >= TEAM_BUDGET) { console.log(`team budget $${TEAM_BUDGET} reached; skipping ${role}`); return null; }
  const r = ROLES[role];
  const args = ['-p', `${prompt}\n\nYour role and rules: ${at(`team/${role === 'business' ? 'business-analyst' : role}.md`)} (team overview: ${at('team/README.md')}). Product rules: CLAUDE.md.`,
    ...(LOOP ? ['--add-dir', LOOP] : []),
    '--output-format', 'json', '--json-schema', JSON.stringify(SCHEMAS[role]),
    '--allowedTools', r.tools, '--disallowedTools', PROTECTED_EDITS, '--permission-mode', 'dontAsk', '--max-turns', String(r.turns), '--max-budget-usd', String(r.budget),
    ...(r.model ? ['--model', r.model] : [])];
  console.log(`→ ${role} (round ${round})`);
  const p = spawnSync(env('CLAUDE_BIN', 'claude'), args, { encoding: 'utf8', maxBuffer: 64 << 20 });
  const res = parseResult(p.stdout ?? '');
  calls.push({ role, round, costUsd: res.cost, ok: !res.error });
  if (res.error) console.error(`${role} failed: ${res.error}`);
  if (res.error && isLimitError(`${res.error}\n${p.stderr ?? ''}`)) hitLimit = true;
  return (res.error ? null : res.out) as T | null;
}

// Deterministic checks, cheapest first; the first failure stops the run so no expensive check is wasted.
function checks(): QaRound['findings'] {
  const steps: [string, string[], Record<string, string>][] = [
    ['Policy scan (docs/POLICY.md)', ['node', 'scripts/compliance.ts', 'auto'], { BASE_REF }],
    ['Type check', ['npx', 'tsc', '--noEmit'], {}],
    ['Unit tests', ['npm', 'test'], {}],
    ...(process.env.DATABASE_URL ? [
      ['Build (as Vercel preview)', ['npm', 'run', 'vercel-build'], { VERCEL_ENV: 'preview' }] as [string, string[], Record<string, string>],
      ['E2E', ['npx', 'playwright', 'test', '--reporter=line'], {}] as [string, string[], Record<string, string>],
    ] : []),
  ];
  // A server an agent left running on :3000 makes Playwright's webServer fail ("port already used"), every round.
  spawnSync('sh', ['-c', 'lsof -ti tcp:3000 | xargs -r kill -9'], { stdio: 'ignore' });
  for (const [name, cmd, extra] of steps) {
    console.log(`→ check: ${name}`);
    const p = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8', maxBuffer: 64 << 20, env: { ...process.env, ...extra } });
    if (p.status !== 0) {
      const out = `${p.stdout}\n${p.stderr}`.split('\n').slice(-120).join('\n').trim();
      console.log(`✖ ${name} failed:\n${out.split('\n').slice(-40).join('\n')}`); // visible in the job log for debugging
      return [{ severity: 'bug', where: name, problem: out }];
    }
  }
  return [];
}

// Three fix approaches that don't overlap: find the cause, shrink the change, or replace the approach.
// A failing branch tries them in turn from the same starting commit; the first whose checks pass is kept.
export const FIXERS = [
  { key: 'root-cause', brief: 'root-cause debugger: reproduce each failure, trace it to its cause and fix the cause, never the symptom or the test' },
  { key: 'minimal', brief: 'minimal-diff surgeon: the smallest change that clears the failures; prefer reverting or simplifying the riskiest part of the change over adding code' },
  { key: 'rebuild', brief: 'rebuilder: re-implement the failing component cleanly from the spec, replacing the current approach instead of patching it' },
] as const;

function fixWithThree(round: number) {
  const start = git('rev-parse', 'HEAD');
  const tried: string[] = [];
  for (const f of FIXERS) {
    const e = ask('engineer', round, `You are the ENGINEER, working as a ${f.brief}. Fix every finding in .autopilot/feedback.md, keeping to the spec. ` +
      `${tried.length ? `Approaches already tried from this same starting point, and failed: ${tried.join('; ')}. Do something different. ` : ''}Commit your work.`);
    if (!e) break; // budget or usage limit
    const fs = checks();
    if (!fs.length) return console.log(`fix: ${f.key} passed the checks`);
    tried.push(`${f.key} (still failing: ${fs[0].where}: ${headline(fs[0].problem)})`);
    git('reset', '--hard', start);
    git('clean', '-fd', '-e', '.autopilot');
  }
  console.log(`fix: no approach passed this round (${tried.join(' | ')})`);
}

function git(...args: string[]) { return spawnSync('git', args, { encoding: 'utf8' }).stdout.trim(); }
function commitAll(msg: string) { if (git('status', '--porcelain')) { git('add', '-A'); git('commit', '-m', msg); } }

function main() {
  const mode = env('MODE', 'build');
  const n = Number(env('NUMBER'));
  const v = JSON.parse(env('VARIANT', '{"key":"","title":"Single","brief":""}')) as Variant;
  const info = branchInfo(env('BRANCH'));
  const issue = info?.issue ?? n;
  const docPath = `docs/specs/issue-${issue}-${(info?.key || v.key) || 'single'}.md`;
  const variantName = v.key ? `${v.key.toUpperCase()} · ${v.title}` : info?.key ? info.key.toUpperCase() : 'single';
  mkdirSync('.autopilot', { recursive: true });
  mkdirSync('docs/specs', { recursive: true });
  const fb = (text: string) => writeFileSync('.autopilot/feedback.md', text);

  type Design = { spec: string; summary: string; direction: string; design: string; business: string; tradeoffs: string; measure: string };
  let design: Design | null = null;
  const discussion: Discussion[] = [];
  let agreed = false;
  let title = `#${issue}`;

  if (mode === 'build') {
    // 1. Spec: designer drafts, business analyst reviews; repeat until agreement or the round cap.
    const rounds = Number(env('SPEC_ROUNDS', '2'));
    fb('');
    for (let round = 1; round <= rounds && !agreed; round++) {
      const d = ask<Design>('designer', round,
        `You are the DESIGNER. Read .autopilot/task.md (the issue and YOUR VARIANT's direction) and .autopilot/feedback.md (business analyst feedback, empty in round 1). Write the spec the engineer will build from. Put the FULL spec text in the "spec" field (you cannot write files; never return a file path).`);
      if (!d) break;
      design = d;
      writeFileSync('.autopilot/spec.md', d.spec);
      const b = ask<NonNullable<Discussion['business']>>('business', round,
        `You are the BUSINESS ANALYST. Read .autopilot/task.md and the designer's spec in .autopilot/spec.md. Judge ease of use, retention and virality; approve only if this is the best product you can agree on within the product rules.`);
      discussion.push({ round, designer: d.summary, business: b ?? undefined });
      if (!b) break;
      agreed = b.approve;
      if (!agreed) fb(`# Business analyst feedback (round ${round})\n\n${b.feedback}\n\n- Ease of use: ${b.ease_of_use}\n- Retention: ${b.retention}\n- Virality: ${b.virality}\n`);
    }
    if (design && !agreed && discussion.at(-1)?.business) {
      const d = ask<Design>('designer', rounds + 1, `You are the DESIGNER. Final revision: address the business analyst feedback in .autopilot/feedback.md where it fits the product rules, and finalize the spec. No further review follows.`);
      if (d) { design = d; discussion.push({ round: rounds + 1, designer: d.summary }); }
    }
    if (!design) return finish({ done: false, summary: 'The designer could not produce a spec.' });
    writeFileSync(docPath, renderSpecDoc({ title, variant: variantName, spec: design.spec, agreed, discussion, qa: [], calls }));
    commitAll(`Spec for #${issue} (${variantName})`);

    // 2. Build to the spec.
    const e = ask<{ done: boolean; title: string; summary: string }>('engineer', 1,
      `You are the ENGINEER. Implement the agreed spec in ${docPath} for the task in .autopilot/task.md. Write tests for the acceptance criteria first. Commit your work.`);
    if (!e?.done) return finish({ done: false, summary: e?.summary ?? 'The engineer could not complete the build.', design, docPath });
    title = e.title;
  } else {
    // Fix mode: CI or the reviewer failed the PR. Engineer fixes first, then the same QA loop.
    const e = ask<{ done: boolean; title: string; summary: string }>('engineer', 1,
      `You are the ENGINEER in fix mode. Read .autopilot/task.md (failing checks and review findings) and the spec in ${docPath} if it exists. Fix every problem without changing the documented direction. Commit your work.`);
    if (!e?.done) return finish({ done: false, summary: e?.summary ?? 'The engineer could not fix it.', docPath });
    title = e.title;
  }

  // 3. QA loop: cheap checks → tester → engineer, until clean or the round cap.
  const qa: QaRound[] = [];
  const maxRounds = Number(env('QA_ROUNDS', '20'));
  let clean = false;
  for (let round = 1; round <= maxRounds; round++) {
    let findings = checks();
    let by: QaRound['by'] = 'checks';
    if (!findings.length) {
      by = 'tester';
      const t = ask<{ pass: boolean; findings: Finding[] }>('tester', round,
        `You are the TESTER. Test the change on this branch (git diff origin/${BASE_REF}...HEAD) against the spec in ${existsSync(docPath) ? docPath : '.autopilot/task.md'}: functionality, edge cases, and usability on a 360px phone screen. Report every problem; use severity "note" only for non-blocking suggestions.`);
      findings = t ? t.findings : [{ severity: 'bug', where: 'tester', problem: 'tester call failed' }];
    }
    qa.push({ round, by, pass: blocking(findings).length === 0, findings });
    if (!blocking(findings).length) { clean = true; break; }
    if (round === maxRounds || spent() >= TEAM_BUDGET) break;
    writeFileSync('.autopilot/feedback.md', `# QA findings (round ${round}, by ${by})\n\n${blocking(findings).map((f) => `- [${f.severity}] ${f.where}: ${f.problem}`).join('\n')}\n`);
    if (by === 'checks') fixWithThree(round + 1); // deterministic failure: three different engineers, keep the first that passes
    else ask('engineer', round + 1, `You are the ENGINEER (${FIXERS[0].brief}) Fix every finding in .autopilot/feedback.md, keeping to the spec. Commit your work.`);
  }

  const prior = existsSync(docPath) ? readFileSync(docPath, 'utf8') : '';
  const record = renderSpecDoc({ title, variant: variantName, spec: design?.spec ?? '_see earlier spec_', agreed, discussion, qa, calls });
  writeFileSync(docPath, mode === 'build' || !prior ? record : `${prior}\n---\n\n## Fix ${new Date().toISOString().slice(0, 10)}\n\n${record.split('## QA log')[1] ? `## QA log${record.split('## QA log')[1]}` : ''}`);
  commitAll(`QA log for #${issue} (${variantName})`);

  // Always publish once the engineer has built something: a version with open findings still becomes a PR,
  // where CI and the fix loop (MAX_ATTEMPTS) keep working on it, so the human always gets every version to compare.
  const open = blocking(qa.at(-1)?.findings ?? []);
  finish({
    done: true, title, docPath, design,
    summary: `${clean ? 'Clean: all checks passed and the tester found no blocking problems' : `${open.length} open finding(s) after ${qa.length} QA round(s)`}. Team cost $${spent().toFixed(2)}.`
      + (open.length ? `\n\nOpen findings:\n${open.map((f) => `- [${f.severity}] ${f.where}: ${headline(f.problem)}`).join('\n')}` : ''),
  });
}

// The useful line of a long check log: the first error/failure line, else the last non-empty one.
export const headline = (log: string) => {
  const lines = log.split('\n').map((l) => l.trim()).filter(Boolean);
  return (lines.find((l) => /✘|error|failed|fail\b/i.test(l)) ?? lines.at(-1) ?? '').slice(0, 300);
};

function finish(r: { done: boolean; summary: string; title?: string; docPath?: string; design?: { direction: string; design: string; business: string; tradeoffs: string; measure: string } | null }) {
  const result: BuildResult = {
    done: r.done, title: r.title, summary: r.summary, specPath: r.docPath, costUsd: spent(), limit: hitLimit,
    direction: r.design?.direction, design: r.design?.design, business: r.design?.business, tradeoffs: r.design?.tradeoffs, measure: r.design?.measure,
  };
  writeFileSync('.autopilot/result.json', JSON.stringify(result));
  console.log(`team: ${r.done ? 'done' : 'not done'}: ${r.summary.split('\n')[0]}`);
}

if (import.meta.main) main();
