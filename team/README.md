# The Stock Social team

Stock Social is built by a team of AI agents and one human. Each member has a written specification in
this folder; that spec is the member's job description: what they own, what they may touch, and the bar
they're held to. No member grades their own work.

## Members

| Member | Spec | Runs | Owns | Can change code? |
|---|---|---|---|---|
| **Business lead** | [business-lead.md](business-lead.md) | Planning (with the engineer); auto mode: the final merge decision (`judge.yml`); on request as a subagent | What gets built and whether it delivered the business case; pushes every other member | No (read-only) |
| **Planner** (business lead ⇄ engineer) | [planner.md](planner.md) | Autopilot, when there's no work queued | The issue format and planning rules both follow while they debate the next issues (`scripts/plan.ts`) | No (writes issues) |
| **UX lead** | [ux-lead.md](ux-lead.md) | Feature pipeline, per feature (committee) | The implementation plan for a decided feature; user tests and the usability and compliance verdict | Every tool, edits discarded |
| **Designer** | [designer.md](designer.md) | Autopilot branch team, per version | The spec the engineer builds from | No (read-only) |
| **Business analyst** | [business-analyst.md](business-analyst.md) | Autopilot branch team, per version | Ease of use, retention and virality of the spec | No (read-only) |
| **Engineer** | [engineer.md](engineer.md) | Planning (with business lead) and every branch team | Feasibility, size and engagement mechanics in planning; tests first, then the code, to the spec | Yes, on its branch only |
| **Tester** | [tester.md](tester.md) | Autopilot branch team, per version | Spec conformance, edge cases, 360px usability | No (runs checks only) |
| **Reviewer** | [reviewer.md](reviewer.md) | Autopilot, on every PR | Independent pass/fail against acceptance criteria and product rules | No (read-only) |
| **Judge** | [judge.md](judge.md) | Auto mode, once a variant set settles | The rules business-lead follows for the final merge decision | No (read-only) |
| **Doctor** | [doctor.md](doctor.md) | Lines mode, hourly, when a line is stuck | Fixing the loop itself (workflows, loop scripts, specs, docs) so lines keep going; never its own constraints | Loop files only, via a PR the Gate merges |
| **Human (@alcheny)** | `docs/AUTOPILOT.md` → "What stays human" | Always | Choosing versions in human mode, protected paths, phases, launch, kill gates | Yes |

## How a change moves through the team

```
Business lead ⇄ Engineer ─ debate until both sign off: issues with acceptance criteria + 3 directions (A/B/C)
      ▼
Per version: Designer ⇄ Business analyst (spec) → Engineer → checks → Tester ⇄ Engineer
      ▼
Reviewer ─ independent pass/fail on each PR
      ▼
human/request mode: Human /choose ─ one version merges to main, recorded in docs/DECISIONS.md
auto mode: Business lead picks the version instead (same process, same record); green single PRs auto-merge
      ▼
Business lead ─ reviews what shipped against the business case; demands for the next round
```

## Feature pipeline committee

Features the owner decided in design sessions (`docs/FEATURES.md`) are built by a committee
(`docs/IMPLEMENTATION.md`, "The cycle"): the UX lead plans, the business lead and the engineer sign; the
engineer builds tests first; the tester loop runs; then the business lead and the UX lead user-test the
running app and each return a compliance and a usability verdict. Demands go back to the plan, up to
`COMMITTEE_ROUNDS` (3). Committee members have every tool, but their file changes are discarded after each
call, so no member grades work it changed. Every round is logged in `docs/features/logs/<F-n>/`.

## Lines mode

In `AUTOPILOT_MODE=lines` the same members run three autonomous product lines in parallel. Business lead ⇄
engineer plan each line's next round from that line's own history (and keep it distinct from the other
two); a branch team builds it; the reviewer and gate merge green rounds into the line's branch. No human
choice or approval is involved until the human compares the lines. See `docs/AUTOPILOT.md` → Lines mode.

## Shared rules every member follows

- **`docs/POLICY.md` (legal and security) binds every member and outranks everything below**, including
  the product rules, speed and any persona. Its deterministic part (`scripts/compliance.ts`) runs in CI
  and in every branch team before the tester; the reviewer checks the rest.

- `CLAUDE.md` product rules and the DESIGN.md "Never" list outrank speed, growth and any member's opinion.
- `docs/DECISIONS.md` is precedent: human decisions outrank AI ones.
- Protected paths (`.github/CODEOWNERS`) are never changed without the human.

## These files are live

The running system reads these files directly. Editing one and merging it to `main` changes how that
member behaves on its next run, on the cloud runners and in Claude Code sessions.

| Spec | Read by |
|---|---|
| `business-lead.md` | Claude Code, via its identical copy `.claude/agents/business-lead.md` (keep both in sync) |
| `planner.md`, `business-lead.md`, `engineer.md` (planning) | `scripts/plan.ts`, run by `plan.yml` |
| `engineer.md` | Claude Code, via its copy `.claude/agents/engineer.md` (keep both in sync) |
| `reviewer.md`, `judge.md` | `review.yml`, `judge.yml` prompts |
| `business-lead.md` (final merge, auto mode) | `judge.yml` prompt |
| `designer.md`, `business-analyst.md`, `engineer.md`, `tester.md` | `scripts/team.ts`, on every branch-team call |
| `ux-lead.md`, `business-lead.md`, `engineer.md` (committee) | `scripts/team.ts`, on feature-pipeline builds |

`team/` and `.claude/agents/` are protected (`.github/CODEOWNERS`) and blocked from agent edits, so no
member can rewrite its own spec or another's. Changes need the human's approval.
