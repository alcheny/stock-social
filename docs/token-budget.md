# Token budget governor

`scripts/token-budget.ts` tells the orchestrator of the parallel agent build which queued sessions it may
start now, so that sessions already running can finish before the usage window hits its cap, and new work
waits for the window to refresh. It reads one JSON snapshot and prints one JSON plan. It never starts,
pauses or stops anything itself, has no dependencies, never reads the clock (the snapshot's `now` is the
clock, so the same input always gives the same plan) and never throws on bad input: problems are listed
in `issues`.

```bash
node scripts/token-budget.ts plan snapshot.json    # prints the plan; exit 0, or 2 when the snapshot is unusable
node scripts/token-budget.ts plan - < snapshot.json
node --test scripts/token-budget.test.ts
```

All money is the sessions' reported `cost_usd`, used as a proxy for token use (the cap is on tokens; cost
is the only per-session figure that adds up across sessions). The provider reports no percentage used, so
the cap is estimated.

## Snapshot (input)

```jsonc
{
  "now": "2026-11-01T08:55:00Z",            // ISO string, or unix seconds / milliseconds
  "window": { "type": "seven_day", "resetsAt": 1793545200, "status": "allowed", "isUsingOverage": false },
  "config": {
    "capUsd": 1200,                // optional: a known cap; otherwise it is calibrated (below)
    "warnFraction": 0.75,          // the share of the cap at which status turns "allowed_warning"
    "safety": 1.5,                 // multiplier on running sessions' remaining-cost estimates
    "priors": { "build": 50, "council:fixing": 15 }   // overrides, see Priors
  },
  "sessions": [
    { "id": "f3-build", "kind": "build", "phase": "fixing", "priority": 5, "costUsd": 38.17,
      "startedAt": "2026-11-01T05:10:00Z", "lastActiveAt": "2026-11-01T08:54:00Z", "done": false,
      "recent": { "costUsd": 33.0, "at": "2026-11-01T08:24:00Z" } }   // optional earlier reading: recent burn
  ],
  "queue": [ { "id": "f5-build", "kind": "build", "priority": 4, "estimateUsd": 50 } ],
  "history": [ { "at": "2026-11-01T07:55:00Z", "totalCostUsd": 520, "status": "allowed" } ]
}
```

- `kind` is `build`, `council`, `review` or `orchestrator`. Another kind is treated as `build` (the
  costliest lifecycle) and reported.
- `priority`: a higher number is more important. Queue items and running sessions default to 0.
- `history[].totalCostUsd` is the spend in the window that contained `at`, which is exactly the plan's
  `historyEntry.totalCostUsd`: append each plan's `historyEntry` to the next snapshot's `history`.
  An entry may carry `resetsAt` to say which window it belongs to; without it, its window is inferred
  from `at`.

## Method

**Window.** The window ends at `resetsAt` and lasts 7 days (`seven_day`; `five_hour` lasts 5 hours; any
other type is treated as 7 days and reported). If `now >= resetsAt`, the window has rolled over: the plan
moves to the window containing `now`, spend counts restart from its start, and the snapshot's `status`
and `isUsingOverage` are stale and ignored (reported), since the provider clears them at reset.

**Spend in window.** Each session's cost is counted in full when it started inside the window. A session
that started before the window starts (the orchestrator) is counted pro rata: its cost times the share of
its active span (`startedAt` to `lastActiveAt`) that falls inside the window.

**Priors** (expected total cost of a whole session, USD), calibrated on 2026-11-01's runs:

| kind | prior | typical hours | tail hours | floor | from |
|---|---|---|---|---|---|
| build | 50 | 5 | 1 | 4 | committee feature builds: done $28.00, $20.78; running up to $38.17; fix rounds add more |
| build:small | 12 | 2 | 0.5 | 2 | a small dev task: $8.70 |
| council | 45 | 4 | 1 | 4 | done $31.36, $32.77, $40.90; one at $48.31 still fixing |
| review | 4 | 0.5 | 0.25 | 1 | independent review subagents: $1-4 |
| orchestrator | none | until reset | 1 | 2 | runs for the whole window: about $30/day |

A key `kind:phase` overrides `kind` for sessions in that phase; `config.priors` overrides the defaults by
the same keys.

**Remaining cost of a running session** = the largest of
1. prior − spent (what the session would cost if it ends at its prior);
2. burn × remaining hours, where burn is its recent rate (`recent` reading at least 5 minutes old) or
   else its lifetime average (cost over active hours, at least 15 minutes), and remaining hours =
   max(typical − elapsed, tail). The orchestrator's remaining hours are the hours until reset;
3. the floor.

So a session above its prior keeps a margin of its own burn over the tail (at least the floor), never 0
while it is not done. Done sessions count in spend and reserve nothing.

**Reserve** = Σ remaining × safety over every running session. It is always kept: admission only uses
what is left after it, so running work can finish before 100% of the cap.

**Cap.**
1. `config.capUsd` when given (source `config`).
2. Otherwise calibrated: in the most recent window in which status turned `allowed_warning` (history or
   the snapshot itself), the first warning reading's spend W gives cap ≈ W / warnFraction (source
   `calibrated`; it carries over to later windows). A `rejected` reading at spend R caps it at R.
3. Otherwise unknown (source `unknown`, `usd: null`). `lowerBoundUsd` reports, for information only, the
   largest A / warnFraction over `allowed` readings at spend A in this window (the cap is above it).

**Admission: the one rule.** Queued work is admitted while

    window spend + reserve (running) + Σ estimates of the newly admitted items ≤ 100% of the cap

Items are taken in priority order (then id); the first item that does not fit stops admission, so a large
important item is not starved by smaller ones. An item's estimate is its `estimateUsd` or the prior for its
kind, with no safety multiplier: the safety factor protects running sessions, it is not a lower ceiling.
While the cap is unknown, every queued item is admitted while status is `allowed`.

The governor never limits rate: it has no per-hour limits, pacing or concurrency caps, in code or in its
default config. It only keeps running sessions' reserves and queues work that would not fit under 100%.

**Warning.** `allowed_warning` is a calibration signal, never a brake: its first appearance sets the cap
(above) and admission carries on under the rule. The plan reports `warning: true`.

**Brakes** (nothing is admitted):
- `rejected` or `isUsingOverage`: running sessions may stall; the plan recommends pausing sessions
  starting with the lowest priority, then the least progress (spent / prior), never the orchestrator.
- status missing or unrecognised: treated as a brake until a valid status is read.

**Next admission time.** A queued item gets `nextAdmitAt`: the projected finish time of the running
session after which it would fit (each finish frees the unused part of its safety margin), if that is
before reset; otherwise `resetsAt`. Under a brake, `resetsAt`.

**Projection.** Burn rate is the window-spend slope over history readings in the last 2 hours of this
window (at least 15 minutes apart), else the sum of the running sessions' burns. Time to cap =
(cap − spend) / burn, compared with the hours to reset. `runningFits` says whether spend + Σ remaining
fits under the cap; `runningFitsWithSafety` uses the reserve.

## Plan (output)

`summary` is one line for a human. `admit` lists ids to start now; `queued` the rest, each with a
`reason` and `nextAdmitAt`. `brake`, `cap`, `spend`, `reserve` (per session, with the basis of each
estimate), `capacity`, `projection`, `pause` and `issues` explain the decision. `historyEntry` is what to
append to the next snapshot's `history`.

## Limits

- Cost is a proxy for tokens: cache reads are cheap in dollars but may weigh differently against the cap.
- Spend the orchestrator cannot see (a person's own sessions on the same account) is missing from spend,
  so a cap calibrated from a warning comes out lower than the real one: that errs on the safe side.
- Until the first warning (or a `capUsd`), the cap is unknown and everything is admitted while status is
  `allowed`: the warning at `warnFraction` is the signal that turns reserves on. If the fleet's committed
  work already exceeds the cap by then, `projection.runningFits` says so and the brakes take over at
  `rejected`.
