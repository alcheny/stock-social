// Branch team (docs/AUTOPILOT.md → "Branch team"; each role's spec is team/<role>.md). One per branch, so one per variant:
//   1. Spec:  designer ⇄ business analyst until they agree (capped), written to docs/specs/.
//   2. Build: engineer implements the agreed spec.
//   3. QA:    cheap deterministic checks first; only if they pass does the tester (LLM) review spec
//             conformance and usability. Findings go back to the engineer. Repeat until clean (capped).
// Each role is a separate headless Claude Code call: fresh context (no one grades their own work),
// role-limited tools, a JSON-schema answer, and per-call turn and dollar caps. This script owns the
// loops, the caps and the record. Agents hold no GitHub credentials; Publish pushes afterwards.
//
// Feature pipeline builds (SPEC_FILE, docs/FEATURES.md; docs/IMPLEMENTATION.md "The cycle") add a committee: the UX
// lead drafts the implementation plan and the business lead and the engineer sign it (debate rounds, capped); the
// engineer builds it tests first; the QA loop runs; then the business lead and the UX lead each user-test the
// running app (first-time trader, first-time viewer) and return a compliance and a usability verdict. A failed
// verdict's demands become the next round's plan (COMMITTEE_ROUNDS, default 3). Reviewers have every tool, but
// whatever they change is discarded: no member grades their own work. A hard stop or a disagreement with the
// owner's decisions ends the build as `blocked` (features.ts publish records it). COMMITTEE=off skips it.
//
//   MODE=build|fix NUMBER=<issue|pr> VARIANT='{"key":"a",...}' BRANCH=... node scripts/team.ts
//   → commits on the current branch, writes .autopilot/result.json for `autopilot.ts publish`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { branchInfo, isLimitError, type BuildResult, type Variant } from './autopilot.ts';

// ---------- pure parts (tested in scripts/team.test.ts) ----------

export type Finding = { severity: 'bug' | 'usability' | 'spec' | 'note'; where: string; problem: string };
export const blocking = (fs: Finding[]) => fs.filter((f) => f.severity !== 'note');

// The CLI's environment: the OAuth token trimmed. A pasted secret with a stray space or line break made the
// CLI exit at once with no output, failing every round silently (lines, first run on the public repo).
export const cliEnv = (): NodeJS.ProcessEnv => {
  const t = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  return t ? { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: t.trim() } : { ...process.env };
};
// The tail of the CLI's stderr for the job log when a call fails, with the token masked (public logs).
export function cliErr(stderr: string | null | undefined): string {
  const t = process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim();
  const s = (stderr ?? '').split('\n').filter((l) => l.trim() && !l.includes('Permission mode forced')).slice(-5).join(' | ');
  return t && t.length > 8 ? s.split(t).join('***') : s;
}

// The CLI's `--output-format json` envelope: structured answer, cost, and error state.
export function parseResult(stdout: string): { out: unknown; cost: number; error: string | null } {
  let j: { structured_output?: unknown; result?: string; is_error?: boolean; total_cost_usd?: number };
  if (!stdout.trim()) return { out: null, cost: 0, error: 'no output from the CLI (see its stderr below)' };
  try { j = JSON.parse(stdout.slice(Math.max(0, stdout.indexOf('{')))); } catch { return { out: null, cost: 0, error: `unparseable CLI output: ${stdout.slice(0, 200)}` }; }
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

export type PlanRound = { round: number; plan: string; lead: { approve: boolean; feedback: string } | null; engineer: { approve: boolean; feedback: string } | null };
export type Verdict = { member: 'business lead' | 'UX lead'; compliance_pass: boolean; compliance_failures: string[]; usability_pass: boolean; demands: string[];
  user_test: { as: string; problems: string[] }[]; summary: string };
export type CommitteeRound = { round: number; plan: PlanRound[]; signed: boolean; verdicts: Verdict[] };
export const committeePassed = (vs: Verdict[]) => vs.length === 2 && vs.every((v) => v.compliance_pass && v.usability_pass);

// The committee record (docs/IMPLEMENTATION.md: every plan round, user test and verdict is logged), beside the
// QA record in docs/features/logs/<F-n>/.
export function renderCommitteeDoc(d: { title: string; date: string; rounds: CommitteeRound[]; blocked?: string; calls: CallLog[] }): string {
  const out = [`# Committee record: ${d.title}`, '', `${d.date} · ${d.rounds.length} round(s)` +
    (d.blocked ? ` · **blocked**: ${d.blocked}` : d.rounds.length && committeePassed(d.rounds.at(-1)!.verdicts) ? ' · **passed**' : ' · not passed'), ''];
  for (const r of d.rounds) {
    out.push(`## Round ${r.round}`, '', `### Plan (${r.signed ? 'signed by the business lead and the engineer' : 'finalized after the round cap, unsigned'})`, '');
    for (const p of r.plan) {
      out.push(`#### Plan round ${p.round}`, '', p.plan.trim(), '',
        `- **Business lead:** ${p.lead ? `${p.lead.approve ? 'signed' : 'changes requested'}. ${esc(p.lead.feedback)}` : 'no answer'}`,
        `- **Engineer:** ${p.engineer ? `${p.engineer.approve ? 'signed' : 'changes requested'}. ${esc(p.engineer.feedback)}` : 'no answer'}`, '');
    }
    if (r.verdicts.length) out.push('### User tests and verdicts', '');
    for (const v of r.verdicts) {
      out.push(`#### ${v.member}: compliance ${v.compliance_pass ? 'pass' : 'FAIL'}, usability ${v.usability_pass ? 'pass' : 'demands'}`, '', esc(v.summary), '');
      for (const u of v.user_test) out.push(`- As ${esc(u.as)}: ${u.problems.length ? u.problems.map(esc).join('; ') : 'nothing stopped or confused them'}`);
      if (v.compliance_failures.length) out.push('', '**Compliance failures:**', ...v.compliance_failures.map((f) => `- ${esc(f)}`));
      if (v.demands.length) out.push('', '**Demands:**', ...v.demands.map((f) => `- ${esc(f)}`));
      out.push('');
    }
  }
  const total = d.calls.reduce((s, c) => s + c.costUsd, 0);
  out.push('## Cost', '', `${d.calls.length} role calls, $${total.toFixed(2)} total.`, '');
  return out.join('\n');
}

// ---------- roles ----------

type Role = 'designer' | 'business' | 'engineer' | 'tester' | 'lead' | 'ux';
const PROTECTED_EDITS = ['./.github/**', './docs/AUTOPILOT.md', './docs/DECISIONS.md', './docs/DESIGN.md', './scripts/autopilot.ts', './scripts/team.ts', './scripts/plan.ts', './scripts/doctor.ts', './scripts/invariants.test.ts', './docs/POLICY.md', './SECURITY.md', './scripts/compliance.ts', './scripts/compliance.test.ts', './scripts/policy.test.ts', './scripts/workflow-security.test.ts', './scripts/features.ts', './docs/FEATURES.md', './docs/features/**', './CLAUDE.md', './team/**', './.claude/agents/**', './playwright.config.ts']
  .flatMap((p) => [`Edit(${p})`, `Write(${p})`]).join(',');
const READ = 'Read,Glob,Grep';
const RUN = 'Bash(npm:*),Bash(npx tsc:*),Bash(npx playwright:*),Bash(node:*),Bash(git diff:*),Bash(git log:*),Bash(git show:*),Bash(git status:*)';
// Committee members (owner's rule, docs/IMPLEMENTATION.md): every tool an agent here can use. Their edits are
// discarded after each call (discardEdits), so a member can try things but never changes the build it judges.
const FULL = `${READ},Edit,Write,${RUN},Bash(curl:*),Bash(sleep:*),WebSearch,WebFetch`;
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
  lead: { model: env('MODEL_LEAD', 'sonnet'), tools: FULL, budget: Number(env('BUDGET_LEAD', '2')), turns: 80 },
  ux: { model: env('MODEL_UX', 'sonnet'), tools: FULL, budget: Number(env('BUDGET_UX', '2')), turns: 80 },
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
  lead: { type: 'object', required: ['approve', 'feedback', 'disagreement'], properties: { approve: { type: 'boolean' }, feedback: { type: 'string' }, disagreement: { type: 'string' } } },
  ux: { type: 'object', required: ['plan', 'summary', 'compliance', 'preauth', 'disagreement'], properties: {
    plan: { type: 'string' }, summary: { type: 'string' }, compliance: { type: 'string' }, preauth: { type: 'array', items: { type: 'string' } }, disagreement: { type: 'string' } } },
};
// Plan review (business lead, engineer) and the committee verdict (business lead, UX lead).
const REVIEW_SCHEMA = SCHEMAS.lead;
const VERDICT_SCHEMA = { type: 'object', required: ['compliance_pass', 'compliance_failures', 'usability_pass', 'demands', 'user_test', 'summary'], properties: {
  compliance_pass: { type: 'boolean' }, compliance_failures: { type: 'array', items: { type: 'string' } }, usability_pass: { type: 'boolean' },
  demands: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' },
  user_test: { type: 'array', items: { type: 'object', required: ['as', 'problems'], properties: { as: { type: 'string' }, problems: { type: 'array', items: { type: 'string' } } } } } } };

const calls: CallLog[] = [];
const spent = () => calls.reduce((s, c) => s + c.costUsd, 0);
const TEAM_BUDGET = Number(env('TEAM_BUDGET_USD', '15'));
let hitLimit = false; // Claude usage limit: stop calling, and tell the loop to pause (auto mode)

// dontAsk: exactly the allowlisted tools, no AI permission classifier. On the throwaway CI runner (no write
// credentials; the Gate rejects loop-file changes) the classifier only added false positives, e.g. it blocked
// a legitimate `git commit` as a "CI bypass", which lost the work and stalled a line.
function ask<T>(role: Role, round: number, prompt: string, schema?: object): T | null {
  if (hitLimit) return null;
  if (spent() >= TEAM_BUDGET) { console.log(`team budget $${TEAM_BUDGET} reached; skipping ${role}`); return null; }
  const r = ROLES[role];
  const spec = role === 'business' ? 'business-analyst' : role === 'lead' ? 'business-lead' : role === 'ux' ? 'ux-lead' : role;
  const args = ['-p', `${prompt}\n\nYour role and rules: ${at(`team/${spec}.md`)} (team overview: ${at('team/README.md')}). Product rules: CLAUDE.md.`,
    ...(LOOP ? ['--add-dir', LOOP] : []),
    '--output-format', 'json', '--json-schema', JSON.stringify(schema ?? SCHEMAS[role]),
    '--allowedTools', r.tools, '--disallowedTools', PROTECTED_EDITS, '--permission-mode', 'dontAsk', '--max-turns', String(r.turns), '--max-budget-usd', String(r.budget),
    ...(r.model ? ['--model', r.model] : [])];
  console.log(`→ ${role} (round ${round})`);
  const p = spawnSync(env('CLAUDE_BIN', 'claude'), args, { encoding: 'utf8', maxBuffer: 64 << 20, env: cliEnv() });
  const res = parseResult(p.stdout ?? '');
  calls.push({ role, round, costUsd: res.cost, ok: !res.error });
  if (res.error) console.error(`${role} failed: ${res.error}${cliErr(p.stderr) ? ` | CLI: ${cliErr(p.stderr)}` : ''}`);
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

// QA loop: cheap checks → tester → engineer, until clean or the round cap. Rounds continue across calls (the
// committee sends a build back through it).
function qaLoop(qa: QaRound[], docPath: string): boolean {
  const maxRounds = qa.length + Number(env('QA_ROUNDS', '20'));
  for (let round = qa.length + 1; round <= maxRounds; round++) {
    let findings = checks();
    let by: QaRound['by'] = 'checks';
    if (!findings.length) {
      by = 'tester';
      const t = ask<{ pass: boolean; findings: Finding[] }>('tester', round,
        `You are the TESTER. Test the change on this branch (git diff origin/${BASE_REF}...HEAD) against the spec in ${existsSync(docPath) ? docPath : '.autopilot/task.md'}: functionality, edge cases, and usability on a 360px phone screen. Report every problem; use severity "note" only for non-blocking suggestions.`);
      findings = t ? t.findings : [{ severity: 'bug', where: 'tester', problem: 'tester call failed' }];
    }
    qa.push({ round, by, pass: blocking(findings).length === 0, findings });
    if (!blocking(findings).length) return true;
    if (round === maxRounds || spent() >= TEAM_BUDGET) return false;
    writeFileSync('.autopilot/feedback.md', `# QA findings (round ${round}, by ${by})\n\n${blocking(findings).map((f) => `- [${f.severity}] ${f.where}: ${f.problem}`).join('\n')}\n`);
    if (by === 'checks') fixWithThree(round + 1); // deterministic failure: three different engineers, keep the first that passes
    else ask('engineer', round + 1, `You are the ENGINEER (${FIXERS[0].brief}) Fix every finding in .autopilot/feedback.md, keeping to the spec. Commit your work.`);
  }
  return false;
}

function git(...args: string[]) { return spawnSync('git', args, { encoding: 'utf8' }).stdout.trim(); }
// A committee member may edit to try things; none of it reaches the build it judges.
function discardEdits() {
  spawnSync('sh', ['-c', 'lsof -ti tcp:3000 | xargs -r kill -9'], { stdio: 'ignore' });
  git('reset', '--hard', 'HEAD');
  git('clean', '-fd', '-e', '.autopilot');
}

// ---------- committee (feature pipeline builds; docs/IMPLEMENTATION.md "The cycle") ----------

const PLAN_ROUNDS = Number(env('PLAN_ROUNDS', '3'));
const COMMITTEE_ROUNDS = Number(env('COMMITTEE_ROUNDS', '3'));
type Review = { approve: boolean; feedback: string; disagreement: string };
type Plan = { plan: string; summary: string; compliance: string; preauth: string[]; disagreement: string };

// The UX lead drafts the plan; the business lead and the engineer sign it or send it back, until both sign or the
// cap. A disagreement with the owner's decisions, or a hard stop the build can't pass, ends it as blocked.
function planDebate(round: number, demands: string): { rounds: PlanRound[]; signed: boolean; blocked?: string } {
  const rounds: PlanRound[] = [];
  let feedback = demands ? `# Committee demands from the last review (compliance first)\n\n${demands}\n` : '';
  for (let r = 1; r <= PLAN_ROUNDS; r++) {
    writeFileSync('.autopilot/feedback.md', feedback);
    const u = ask<Plan>('ux', round * 10 + r,
      `You are the UX LEAD on this feature's committee (committee round ${round}, plan round ${r}). Read .autopilot/task.md (the owner's decided feature and the coordination brief) and .autopilot/feedback.md (` +
      `${demands ? 'the committee demands to answer, then ' : ''}the business lead's and engineer's feedback; empty at first). Write the implementation plan in "plan": screen flow and every state, components, data model, copy, rollout, ` +
      `and the test for every acceptance criterion. It decides how, never what: a decision in the feature file is never changed. Answer the per-change checklist (docs/COMPLIANCE.md Section 1) in "compliance". ` +
      `List in "preauth" what only the owner can clear (protected paths, secrets, new dependencies or vendors, external approvals, counsel). Put in "disagreement" (empty otherwise) a disagreement with a decision in the feature file, ` +
      `or a hard stop that means the feature must not be built yet (counsel's opinion, a secret or a new dependency or vendor not authorized in docs/IMPLEMENTATION.md); a protected path alone is not one, the owner merges those.`);
    if (!u) break;
    if (u.disagreement.trim()) { rounds.push({ round: r, plan: u.plan, lead: null, engineer: null }); return { rounds, signed: false, blocked: u.disagreement.trim() }; }
    writeFileSync('.autopilot/plan.md', `${u.plan}\n\n## Compliance checklist\n\n${u.compliance}\n${u.preauth.length ? `\n## Owner-only items\n\n${u.preauth.map((x) => `- ${x}`).join('\n')}\n` : ''}`);
    const review = (role: Role, who: string, focus: string) => ask<Review>(role, round * 10 + r,
      `You are the ${who} on this feature's committee. Read .autopilot/task.md and the UX lead's plan in .autopilot/plan.md. ${focus} ` +
      `Sign it ("approve") only if you would build exactly this; otherwise say in "feedback" what must change. Put in "disagreement" (empty otherwise) a disagreement with a decision in the feature file, or a hard stop the plan misses that means it must not be built yet.`,
      REVIEW_SCHEMA);
    const lead = review('lead', 'BUSINESS LEAD', 'Judge usability, ease of adoption and the quality bar within the decided design, and every rule in docs/POLICY.md.');
    const eng = review('engineer', 'ENGINEER (planning only: change no files)', 'Judge feasibility, size, risk, performance under heavy use, and whether the test plan covers every acceptance criterion.');
    discardEdits();
    rounds.push({ round: r, plan: u.plan, lead: lead && { approve: lead.approve, feedback: lead.feedback }, engineer: eng && { approve: eng.approve, feedback: eng.feedback } });
    const block = [lead?.disagreement, eng?.disagreement].map((x) => x?.trim()).find(Boolean);
    if (block) return { rounds, signed: false, blocked: block };
    if (lead?.approve && eng?.approve) return { rounds, signed: true };
    if (!lead || !eng) break;
    feedback = `${demands ? `# Committee demands from the last review (compliance first)\n\n${demands}\n\n` : ''}# Plan feedback (round ${r})\n\n## Business lead\n\n${lead.feedback}\n\n## Engineer\n\n${eng.feedback}\n`;
  }
  return { rounds, signed: false };
}

// Each committee member user-tests the running app, then judges compliance and usability.
function committeeReview(round: number): Verdict[] {
  const vs: Verdict[] = [];
  const members: [Role, Verdict['member'], string][] = [
    ['lead', 'business lead', 'judge usability, adoption and whether it is built completely and cleanly to the highest bar'],
    ['ux', 'UX lead', 'judge the interface: every state, readability, tap targets, gestures, keyboard and screen-reader use at 360px'],
  ];
  for (const [role, member, lens] of members) {
    const v = ask<Omit<Verdict, 'member'>>(role, 100 + round,
      `You are the ${member.toUpperCase()} on this feature's committee, reviewing the engineer's build on this branch (git diff origin/${BASE_REF}...HEAD) against the owner's feature in .autopilot/task.md and the signed plan in .autopilot/plan.md. ` +
      `First user-test it on the running app: build and start it (npm run build, then npm run start in the background; the database is up), and with Playwright at 360px use it as a first-time trader (sign in through /login/dev) ` +
      `and as a first-time viewer arriving signed out from a shared profile link. In "user_test", one entry per persona, write in plain words what confused or stopped you. ` +
      `Then judge compliance against docs/POLICY.md and the docs/COMPLIANCE.md sections that apply ("compliance_pass", "compliance_failures"), and ${lens} ("usability_pass", "demands": concrete, testable changes). ` +
      `Pass only what you would put in front of real users. Anything you change in the files is discarded.`, VERDICT_SCHEMA);
    discardEdits();
    if (v) vs.push({ member, ...v });
  }
  return vs;
}
export const demandsOf = (vs: Verdict[]) => [
  ...vs.flatMap((v) => v.compliance_failures.map((f) => `- [compliance, ${v.member}] ${f}`)),
  ...vs.flatMap((v) => v.demands.map((d) => `- [${v.member}] ${d}`)),
].join('\n');
function commitAll(msg: string) { if (git('status', '--porcelain')) { git('add', '-A'); git('commit', '-m', msg); } }

function main() {
  const mode = env('MODE', 'build');
  const n = Number(env('NUMBER'));
  const v = JSON.parse(env('VARIANT', '{"key":"","title":"Single","brief":""}')) as Variant;
  const info = branchInfo(env('BRANCH'));
  const issue = info?.issue ?? n;
  // SPEC_FILE (feature pipeline, docs/FEATURES.md): the owner's decided feature file is the spec; its build and QA
  // record goes beside it in docs/features/logs/, never into the owner's file.
  const specFile = env('SPEC_FILE');
  const docPath = specFile ? `docs/features/logs/${specFile.split('/').at(-1)}` : `docs/specs/issue-${issue}-${(info?.key || v.key) || 'single'}.md`;
  const variantName = v.key ? `${v.key.toUpperCase()} · ${v.title}` : info?.key ? info.key.toUpperCase() : 'single';
  mkdirSync('.autopilot', { recursive: true });
  mkdirSync(docPath.slice(0, docPath.lastIndexOf('/')), { recursive: true });
  const fb = (text: string) => writeFileSync('.autopilot/feedback.md', text);

  type Design = { spec: string; summary: string; direction: string; design: string; business: string; tradeoffs: string; measure: string };
  let design: Design | null = null;
  const discussion: Discussion[] = [];
  let agreed = false;
  let title = `#${issue}`;

  const committeeOn = mode === 'build' && !!specFile && env('COMMITTEE', 'on') !== 'off';
  const committee: CommitteeRound[] = [];
  const featureId = specFile ? /^#\s+(F-\d+)/m.exec(readFileSync(specFile, 'utf8'))?.[1] ?? 'feature' : '';
  const committeePath = `docs/features/logs/${featureId}/committee-${new Date().toISOString().slice(0, 10)}.md`;
  const writeCommittee = (blocked?: string) => {
    mkdirSync(committeePath.slice(0, committeePath.lastIndexOf('/')), { recursive: true });
    writeFileSync(committeePath, renderCommitteeDoc({ title, date: new Date().toISOString().slice(0, 10), rounds: committee, blocked, calls }));
    commitAll(`Committee record for ${title}`);
  };
  if (mode === 'build' && specFile) {
    // Decided in a design session: no designer or analyst round. The owner's file is the spec; the committee plans how.
    const spec = readFileSync(specFile, 'utf8');
    title = /^#\s+(.+)$/m.exec(spec)?.[1] ?? title;
    agreed = true;
    writeFileSync(docPath, renderSpecDoc({ title, variant: 'feature (decided by the owner)', spec, agreed, discussion, qa: [], calls }));
    commitAll(`Spec for ${title}`);
    if (committeeOn) {
      const p = planDebate(1, '');
      committee.push({ round: 1, plan: p.rounds, signed: p.signed, verdicts: [] });
      if (p.blocked || !existsSync('.autopilot/plan.md')) {
        writeCommittee(p.blocked ?? 'the plan round produced no plan');
        return finish({ done: false, blocked: p.blocked ?? 'the plan round produced no plan', summary: `Blocked before the build: ${p.blocked ?? 'no plan'}`, docPath, committeePath });
      }
    }
  }
  if (mode === 'build' && !specFile) {
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
  }
  if (mode === 'build') {
    // 2. Build to the spec.
    const e = ask<{ done: boolean; title: string; summary: string }>('engineer', 1, committeeOn
      ? `You are the ENGINEER. Implement the committee's signed plan in .autopilot/plan.md for the owner's feature in .autopilot/task.md (follow its coordination brief). Write the test for every acceptance criterion first, then the code. Commit your work.`
      : `You are the ENGINEER. Implement the agreed spec in ${docPath} for the task in .autopilot/task.md. Write tests for the acceptance criteria first. Commit your work.`);
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
  let clean = qaLoop(qa, docPath);

  // 4–5. Committee: user tests and verdicts; failed → the demands become the next round's plan, build and QA.
  let blocked: string | undefined;
  if (committeeOn) {
    for (let c = 1; ; c++) {
      const vs = committeeReview(c);
      committee.at(-1)!.verdicts = vs;
      if (committeePassed(vs) || c >= COMMITTEE_ROUNDS || hitLimit || spent() >= TEAM_BUDGET) break;
      const demands = demandsOf(vs);
      const p = planDebate(c + 1, demands || '- (a member could not answer; review the build again)');
      committee.push({ round: c + 1, plan: p.rounds, signed: p.signed, verdicts: [] });
      if (p.blocked) { blocked = p.blocked; break; }
      const e = ask<{ done: boolean; title: string; summary: string }>('engineer', 100 + c,
        `You are the ENGINEER. The committee sent the build back. Implement the revised plan in .autopilot/plan.md; it answers these demands (compliance first):\n${demands}\nKeep every acceptance test passing. Commit your work.`);
      if (!e?.done) break;
      clean = qaLoop(qa, docPath);
    }
    writeCommittee(blocked);
  }

  const prior = existsSync(docPath) ? readFileSync(docPath, 'utf8') : '';
  const record = renderSpecDoc({ title, variant: variantName, spec: design?.spec ?? '_see earlier spec_', agreed, discussion, qa, calls });
  writeFileSync(docPath, mode === 'build' || !prior ? record : `${prior}\n---\n\n## Fix ${new Date().toISOString().slice(0, 10)}\n\n${record.split('## QA log')[1] ? `## QA log${record.split('## QA log')[1]}` : ''}`);
  commitAll(`QA log for #${issue} (${variantName})`);

  // Always publish once the engineer has built something: a version with open findings still becomes a PR,
  // where CI and the fix loop (MAX_ATTEMPTS) keep working on it, so the human always gets every version to compare.
  const open = blocking(qa.at(-1)?.findings ?? []);
  const last = committee.at(-1)?.verdicts ?? [];
  const verdict = !committeeOn ? '' : blocked ? ` Blocked by the committee: ${blocked}.` : committeePassed(last)
    ? ` Committee: passed in round ${committee.length} (business lead and UX lead).` : ` Committee: not passed after ${committee.length} round(s); open demands below.`;
  finish({
    done: !blocked, blocked, title, docPath, design, committeePath: committeeOn ? committeePath : undefined,
    summary: `${clean ? 'Clean: all checks passed and the tester found no blocking problems' : `${open.length} open finding(s) after ${qa.length} QA round(s)`}.${verdict} Team cost $${spent().toFixed(2)}.`
      + (open.length ? `\n\nOpen findings:\n${open.map((f) => `- [${f.severity}] ${f.where}: ${headline(f.problem)}`).join('\n')}` : '')
      + (committeeOn && !blocked && !committeePassed(last) && demandsOf(last) ? `\n\nOpen committee demands:\n${demandsOf(last)}` : ''),
  });
}

// The useful line of a long check log: the first error/failure line, else the last non-empty one.
export const headline = (log: string) => {
  const lines = log.split('\n').map((l) => l.trim()).filter(Boolean);
  return (lines.find((l) => /✘|error|failed|fail\b/i.test(l)) ?? lines.at(-1) ?? '').slice(0, 300);
};

function finish(r: { done: boolean; summary: string; title?: string; docPath?: string; blocked?: string; committeePath?: string; design?: { direction: string; design: string; business: string; tradeoffs: string; measure: string } | null }) {
  const result: BuildResult = {
    done: r.done, title: r.title, summary: r.summary, specPath: r.docPath, costUsd: spent(), limit: hitLimit, blocked: r.blocked, committeePath: r.committeePath,
    direction: r.design?.direction, design: r.design?.design, business: r.design?.business, tradeoffs: r.design?.tradeoffs, measure: r.design?.measure,
  };
  writeFileSync('.autopilot/result.json', JSON.stringify(result));
  console.log(`team: ${r.done ? 'done' : 'not done'}: ${r.summary.split('\n')[0]}`);
}

if (import.meta.main) main();
