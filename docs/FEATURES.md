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
 owner: "that's decided"     ──► Status: ready                      ──► picks up to FEATURE_PARALLEL ready/rework,
                                                                        lowest first, built side by side
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
| `blocked` | Waits for the owner or counsel (a hard stop); a `Blocked:` line under the status says what for. Skipped, never holds up the rest | Claude, in the chat |

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

- **Switch:** repo variable `FEATURES` (`on`/`off`). Independent of `AUTOPILOT`. Turning it off stops new rounds
  and merges; builds already running finish and publish their PR.
- **Parallel builds.** Up to `FEATURE_PARALLEL` (default 3) features are worked on at once. Each run of
  `features.yml` is one round: `scripts/features.ts next` plans it (one pick at a time, so two builds never take the
  same feature), then every task runs as its own matrix leg:
  - a **fix** for an open feature PR whose checks failed,
  - a **conflict resolution** for one that conflicts with main (another feature merged first),
  - a **build** of the next `ready`/`rework` feature, lowest number first, for each free slot.

  Open feature PRs count against the limit; a PR waiting for the owner doesn't. Blocked features are skipped.
- **How builders coordinate.** Builds run on separate machines and can't see each other, so the pipeline passes
  messages between them:
  - Before a build starts, `features.ts brief` adds a coordination brief to its task: every other build in the
    round, every open feature PR with the files it changed (shared files flagged), and the hand-off notes its
    builder left.
  - The brief carries the rules for parallel work: stay in your feature; no renames, moves or deletions; prefer a
    new file over one another build changed; shared files (`SHARED` in `scripts/features.ts`, such as
    `app/globals.css`, `lib/copy.ts` and `db/schema.sql`) take additive edits only, in one block named for the
    feature; schema changes are appended and idempotent; tests go in new files named for the feature, and feed
    tests hold the feed lock.
  - Each builder writes `.autopilot/handoff.md` (what the others need to know: shared files touched and where, new
    exports, columns, routes, copy keys). The publish step puts it, with the shared files the branch actually
    changed, under **Hand-off notes** in its PR, where the next briefs read it.
- **Keeping parallel work safe.**
  - The Gate merges a feature PR only once it contains the latest main, so every merge was tested together with
    what merged before it. A PR that is behind is updated in place (GitHub's update-branch), and CI and the review
    re-run.
  - A PR whose update conflicts becomes a conflict-resolution task: main is merged into the branch and the
    engineer resolves the marked files, keeping both features' changes. `features.ts resolved` fails the publish
    if a conflict marker is left.
  - A PR whose conflicts come back twice serializes the pipeline: no new build starts until it merges.
  - Fix and conflict attempts share `FEATURE_MAX_ATTEMPTS` (default 5); then the PR is labeled `needs-human` and
    waits for a design session.
- **Build:** `scripts/team.ts` with `SPEC_FILE` set: no designer/analyst round, the engineer builds the owner's file
  as written, writing a test for each acceptance criterion; the tester and the deterministic checks loop until
  clean. The build and QA record goes to `docs/features/logs/`, never into the owner's file. Agents can't edit
  `docs/features/` (only the publish script updates status and the build log).
- **Merge:** the Gate merges a green feature PR (CI, plus the reviewer checking every acceptance criterion against
  the feature file), provided it is up to date with main, then starts the next round. The 800-line cap
  (`MAX_DIFF`) counts product lines only for feature PRs: tests, end-to-end specs, docs and screenshots don't count
  (the owner's pre-authorization of 2026-10-24). Protected paths still wait for the owner.
- **Running until done.** Every merge, update or failure starts the next round, and an hourly heartbeat resumes the
  pipeline after a lost event. It keeps going until no feature is `ready` or `rework` and no feature PR is open.
  What remains then is `blocked` or `draft`: those wait for the owner (counsel, a decision, a design session).
- **Starting it:** set `FEATURES=on`, then run it from the chat (Claude runs the command) or
  `gh workflow run features.yml --ref main`.
