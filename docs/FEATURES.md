# Design sessions and the feature pipeline

How the owner designs Stock Social by talking it through in the Claude chat, and how those decisions get
built, checked and refined until every feature is accepted. Separate from the autopilot
(`docs/AUTOPILOT.md`): own switch, own workflow, own queue, no planner, no lines, no judge. It shares only
the infrastructure: CI, the policy scan (`docs/POLICY.md`), the build engine (`scripts/team.ts`), the
reviewer and the Gate.

```
 chat (design session)                     repo                              CI (features.yml)
 ─────────────────────                     ────                              ─────────────────
 owner discusses a feature   ──► Claude records every decision in docs/features/F-<n>-<slug>.md
 owner: "that's decided"     ──► Status: ready                      ──► picks the lowest ready/rework
                                                                        engineer ⇄ tester build it to the
                                                                        file as written (no redesign)
                                                                        PR `F-<n>: …` (label feature)
                                                                        CI → reviewer checks every
                                                                        acceptance criterion → Gate merges
                                 Status: built  ◄──────────────────────  (and starts the next feature)
 owner tries it:
   "good"                    ──► Status: accepted
   "change X"                ──► new decision + Status: rework   ──► rebuilt the same way
 repeat until every feature is accepted
```

## Feature files (`docs/features/`)

One file per feature, `F-<n>-<slug>.md`, from [TEMPLATE.md](features/TEMPLATE.md). The number sets the
build order. Sections: Why, Decisions (dated, with the reason), Acceptance criteria (each one testable),
Out of scope, Open questions, Rework notes, Build log (CI appends it).

| Status | Meaning | Set by |
|---|---|---|
| `draft` | Still being discussed; never built | Claude, in the chat |
| `ready` | Decided; queued for the pipeline | Claude, when the owner says it's decided |
| `built` | Merged to main; waiting for the owner to try it | The pipeline, in the feature's PR |
| `accepted` | The owner is satisfied; done | Claude, when the owner says so |
| `rework` | The owner wants changes (recorded as new decisions); queued again | Claude, in the chat |

## How Claude runs a design session (chat)

When the owner talks about how the app should look, work or feel, Claude:
1. Finds the feature file it belongs to, or creates the next `F-<n>` from the template (`Status: draft`).
2. Records each decision in the same turn: date, the decision in plain words, the reason. It never
   records something the owner didn't decide; open points go under Open questions.
3. Turns decisions into testable acceptance criteria and reads them back when a feature looks complete.
4. Sets `Status: ready` only when the owner confirms the feature is decided. Feedback on a built feature
   becomes new dated decisions plus `Status: rework`.
5. Commits the docs to main (docs only; no code is written in a design session unless the owner asks),
   and starts the pipeline when the owner says go: `gh workflow run features.yml --ref main`.
6. Applies `docs/POLICY.md` to every decision (no third-party names, no advice language, disclaimers…)
   and says so when a request conflicts with it.

Ask in the chat at any time: "what's decided?", "what's left?", or run `node scripts/features.ts list`.

## The pipeline (CI)

- **Switch:** repo variable `FEATURES` (`on`/`off`). Independent of `AUTOPILOT`.
- **One feature at a time.** `scripts/features.ts next` picks the lowest-numbered `ready`/`rework` feature,
  or fixes the open feature PR if its checks failed (up to `FEATURE_MAX_ATTEMPTS`, default 5, then it
  waits for the owner).
- **Build:** `scripts/team.ts` with `SPEC_FILE` set: no designer/analyst round, the engineer builds the
  owner's file as written, writing a test for each acceptance criterion; the tester and the deterministic
  checks loop until clean. The build and QA record goes to `docs/features/logs/`, never into the owner's
  file. Agents can't edit `docs/features/` (only the publish script updates status and the build log).
- **Merge:** the Gate merges a green feature PR (CI + reviewer, who checks every acceptance criterion
  against the feature file) and starts the next feature. Protected paths or oversized diffs wait for the
  owner.
- **Starting it:** from the chat (Claude runs the command), or `gh workflow run features.yml --ref main`.
  After that, each merge or failure starts the next run.
