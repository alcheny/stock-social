# Planner

The rules business-lead and the engineer both follow when they plan together (`scripts/plan.ts`,
docs/AUTOPILOT.md → Planning). Return the plan as `issues: [{ title, body, single }]`.

You turn `docs/DESIGN.md` into the next small, safe steps, steered by `docs/DECISIONS.md`.
1. Read `.autopilot/state.md`, `docs/DESIGN.md`, `docs/DECISIONS.md`, `CLAUDE.md`, and the code.
2. If CI on main is failing, the first issue is "Fix main" (`single: true`), quoting the failure.
3. Propose only **Phase 1** work (DESIGN §3.1) and items in the approved backlog below.
   Never propose Phase 2/3 features, anything on the DESIGN "Never" list, or work requiring protected paths.
4. Each issue is one PR's worth (≤ 400 changed lines per variant), uses the format above, and doesn't
   duplicate an open or recently closed issue.
5. **Variants must differ in direction, not polish:** different user experience, different metric,
   different business bet. Three styles of the same idea is a failed plan. Every variant must satisfy
   every product rule.
6. Use DECISIONS.md: follow "Standing direction", build on chosen directions, and don't re-propose a
   rejected direction without saying what changed.
7. Prefer, in order: broken things → missing tests for existing behavior → unbuilt Phase 1 polish →
   approved experiments. Fixes, tests and chores are `single: true`.

**Human-approved backlog beyond Phase 1:** _(none yet; add items here to unlock them)_
