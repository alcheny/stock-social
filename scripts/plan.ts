// Planning (docs/AUTOPILOT.md → "Planning"): business-lead and the engineer debate the next issues until
// both sign off. Business-lead drafts; the other side either agrees or returns a critique and the revised
// plan it would sign; roles alternate until one side agrees with the other's latest plan (capped).
// Read-only Claude calls with JSON answers; plan-post creates the issues and posts the discussion.
//
//   NEED=<n> node scripts/plan.ts   → .autopilot/plan.json { issues, agreed, discussion }
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cliEnv, cliErr, parseResult } from './team.ts';

export type PlanIssue = { title: string; body: string; single: boolean };
export type Turn = { who: 'lead' | 'engineer'; agree: boolean; critique: string; issues: PlanIssue[]; costUsd: number };

const env = (k: string, d = '') => process.env[k] || d;
const NAME = { lead: 'Business lead', engineer: 'Engineer' } as const;
// LOOP_DIR: main's copy of the loop (build.yml snapshots it), so a line's stale copy never steers its agents.
const LOOP = env('LOOP_DIR');
const at = (path: string) => (LOOP ? `${LOOP}/${path}` : path);
const SPEC = { lead: at('team/business-lead.md'), engineer: at('team/engineer.md') } as const;
const SCHEMA = {
  type: 'object', required: ['agree', 'critique', 'issues'], properties: {
    agree: { type: 'boolean' }, critique: { type: 'string' },
    issues: { type: 'array', items: { type: 'object', required: ['title', 'body', 'single'], properties: {
      title: { type: 'string' }, body: { type: 'string' }, single: { type: 'boolean' } } } } },
};

// Agreement = the reviewer accepts the other side's latest plan unchanged. Pure; tested in plan.test.ts.
export function outcome(turns: Turn[]): { issues: PlanIssue[]; agreed: boolean } {
  const last = turns.at(-1);
  if (!last) return { issues: [], agreed: false };
  if (last.agree && turns.length > 1) return { issues: turns.at(-2)!.issues, agreed: true };
  return { issues: last.issues, agreed: false };
}

export function renderDiscussion(turns: Turn[], agreed: boolean): string {
  const total = turns.reduce((s, t) => s + t.costUsd, 0);
  return [`**Planning discussion** (${agreed ? 'agreed by business lead and engineer' : 'no agreement within the round cap; latest plan used'}, ${turns.length} turns, $${total.toFixed(2)})`,
    ...turns.map((t, i) => `**${i + 1}. ${NAME[t.who]}${i === 0 ? ' (draft)' : t.agree ? ' (agrees)' : ' (revises)'}:** ${t.critique.trim()}${!t.agree && i > 0 ? `\n_Revised to: ${t.issues.map((x) => x.title).join(' · ')}_` : ''}`)].join('\n\n');
}

function ask(who: Turn['who'], prompt: string): Turn | null {
  const model = env(who === 'lead' ? 'MODEL_LEAD' : 'MODEL_ENGINEER');
  const tools = `Read,Glob,Grep,Bash(git log:*),Bash(git show:*)${who === 'lead' ? ',WebSearch' : ''}`;
  console.log(`→ ${NAME[who]}`);
  const p = spawnSync(env('CLAUDE_BIN', 'claude'), ['-p',
    `${prompt}\n\nYour role and bar: ${SPEC[who]}. Issue format and planning rules: ${at('team/planner.md')}. State: .autopilot/state.md. Precedent: docs/DECISIONS.md. Product rules: CLAUDE.md, docs/DESIGN.md.`,
    '--output-format', 'json', '--json-schema', JSON.stringify(SCHEMA), '--allowedTools', tools, '--permission-mode', 'dontAsk', ...(LOOP ? ['--add-dir', LOOP] : []),
    '--max-turns', '40', '--max-budget-usd', env('BUDGET_PLAN_CALL', '1.5'), ...(model ? ['--model', model] : [])],
  { encoding: 'utf8', maxBuffer: 64 << 20, env: cliEnv() });
  const r = parseResult(p.stdout ?? '');
  if (r.error) { console.error(`${who} failed: ${r.error}${cliErr(p.stderr) ? ` | CLI: ${cliErr(p.stderr)}` : ''}`); return null; }
  return { ...(r.out as Omit<Turn, 'who' | 'costUsd'>), who, costUsd: r.cost };
}

// Business-lead drafts; the other side agrees unchanged or returns a critique and the revised plan it
// would sign; they alternate until one accepts the other's latest plan, PLAN_ROUNDS or PLAN_BUDGET_USD.
function debate(need: number, draftPrompt: string, reviewRules: string) {
  const rounds = Number(env('PLAN_ROUNDS', '4'));
  const budget = Number(env('PLAN_BUDGET_USD', '6'));
  const turns: Turn[] = [];
  const draft = ask('lead', draftPrompt);
  // A draft can't agree with itself: the schema has `agree`, and a draft answering true used to end the debate before the engineer spoke.
  if (draft) turns.push({ ...draft, agree: false });
  while (turns.length && turns.length <= rounds && !turns.at(-1)!.agree && turns.reduce((s, t) => s + t.costUsd, 0) < budget) {
    const prev = turns.at(-1)!;
    const who = prev.who === 'lead' ? 'engineer' : 'lead';
    const t = ask(who, `You are planning ${need} issue(s) with the ${prev.who === 'lead' ? 'business lead' : 'engineer'}. Discussion so far:\n\n` +
      renderDiscussion(turns, false) + `\n\nTheir current plan (JSON):\n${JSON.stringify(prev.issues)}\n\n` +
      `Scrutinize it hard from your role. ${reviewRules} If you would sign it exactly as written, set agree=true and return it unchanged. ` +
      `Otherwise set agree=false, say precisely what is wrong and why in critique, and return the full revised plan of ${need} issue(s) you would sign.`);
    if (!t) break;
    turns.push(t);
  }
  const { issues, agreed } = outcome(turns);
  const discussion = renderDiscussion(turns, agreed);
  mkdirSync('.autopilot', { recursive: true });
  writeFileSync('.autopilot/plan.json', JSON.stringify({ issues, agreed, discussion }));
  console.log(`plan: ${issues.length} issue(s), ${agreed ? 'agreed' : 'not agreed'} after ${turns.length} turns`);
  return issues;
}

function main() {
  const line = env('LINE');
  if (line) { // lines mode: this line's next round, from its own history and the other lines'
    const ctx = 'Read .autopilot/line.md: your line, everything it has built so far, and what the other two lines are doing. ';
    const [is] = debate(1, `${ctx}You are planning with the engineer. Draft exactly 1 issue: the most valuable next step for your line (one PR, about 400 changed lines), building on what it already has. ` +
      'Your line has no fixed direction: it is whatever its rounds have made it, and you may deepen it or turn it, but keep it clearly distinct from the other two lines. ' +
      'Obey every product rule. Never plan changes to the loop itself (.github/, scripts/autopilot.ts, scripts/team.ts, scripts/plan.ts, team/, CLAUDE.md, docs/AUTOPILOT.md, docs/DESIGN.md, docs/DECISIONS.md, playwright.config.ts). ' +
      'In critique, explain the business case and what the engineer should pressure-test.',
    `${ctx}Check that it builds on this line, stays distinct from the other lines, fits one PR, and never touches the loop files listed in the draft prompt.`);
    if (!is) { console.error('plan: no issue for this line'); process.exit(1); }
    writeFileSync('.autopilot/task.md', `# Task: next round of this line\n\n${readFileSync('.autopilot/line.md', 'utf8')}\n\n## This round: ${is.title}\n\n${is.body}\n`);
    return;
  }
  const need = Number(env('NEED', '1'));
  if (env('KICKOFF')) { // lines mode, once: three different starting steps, no long-term directions
    debate(need, `You are planning with the engineer. Three autonomous teams are about to start from the current main; each will grow its own version of Stock Social, round after round, with no human input. ` +
      `Draft exactly ${need} issues: one different FIRST STEP per team (one PR each, about 400 changed lines). Make them as different from each other as you can (different user, problem and bet) so the teams diverge, but don't fix long-term directions: those evolve. ` +
      'Each is a single change for one team (no "## Variants" section; set single=false). Never plan changes to the loop files (.github/, scripts/autopilot.ts, scripts/team.ts, scripts/plan.ts, team/, CLAUDE.md, docs/AUTOPILOT.md, docs/DESIGN.md, docs/DECISIONS.md). In critique, explain the bet behind each.',
    'Check the three are genuinely different starting points, each one PR, each within the product rules.');
    return;
  }
  debate(need, `You are planning with the engineer. Draft exactly ${need} issue(s) for what Stock Social should build next. Anything a user sees is not single and needs a "## Variants" section with three different directions. ` +
    'In critique, explain the business case for each and what you want the engineer to pressure-test.',
  'Check each "single" flag: only fixes, tests and chores are single; anything a user sees gets three variants with a "## Variants" section.');
}

if (import.meta.main) main();
