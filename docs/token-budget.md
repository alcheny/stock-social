# Token budget governor

`scripts/token-budget.ts` tells the orchestrator of the parallel agent build which queued sessions it may
start now, so that sessions already running can finish before the usage window hits its cap, and new work
fills the window up to the cap. It reads one JSON snapshot and prints one JSON plan. It never starts, pauses
or stops anything itself, has no dependencies, never reads the clock (the snapshot's `now` is the clock, so
the same input always gives the same plan) and never throws on bad input: problems are listed in `issues`.

```bash
node scripts/token-budget.ts plan snapshot.json    # prints the plan
node scripts/token-budget.ts plan - < snapshot.json
node --test scripts/token-budget.test.ts
```

**Exit codes.** 2 only when no plan could be built: the file is unreadable or not JSON, `now` is missing
or invalid, or planning failed internally; stdout then holds `{ "error", "issues" }`. (Inside `plan()`,
an invalid `now` is an error issue and a brake: the fallback clock is 0.) A usage error (no
`plan <file|->`) prints the same JSON shape on stderr, also with exit 2. Otherwise 0, whatever the plan
says: the caller checks `brake` and any `error`-level `issues` itself.

**Units.** All money is USD, from the sessions' reported `cost_usd`, used as a proxy for token use (the cap
is on tokens; cost is the only per-session figure that adds up across sessions). Fields ending in `Usd`
are dollars, `Hours` hours, `UsdPerHour` dollars per hour, `At` times. The provider reports no percentage
used, so the cap is estimated.

**Bounds.** Money (costs, estimates, `capUsd`, history totals) is a number in [0, 1e12]; a numeric string
is accepted with a warning (`string-number`); anything else is an error-level issue and counts as 0 (or
is ignored). Times must lie inside the JavaScript Date range; prior hours are at most 1e4; `safety` is in
[1, 100] and `warnFraction` in [0.01, 0.99]. A non-finite figure that still slipped through is printed
as null with a `non-finite` error issue.

## Snapshot (input)

```jsonc
{
  "now": "2026-11-01T08:55:00Z",            // ISO string, or unix seconds / milliseconds
  "window": { "type": "seven_day", "resetsAt": 1793545200, "status": "allowed", "isUsingOverage": false },
  "config": {
    "capUsd": 1200,                // optional: a known cap; otherwise it is calibrated (below)
    "warnFraction": 0.75,          // the share of the cap at which status turns "allowed_warning"
    "safety": 1.5,                 // widens the high remaining-cost figures (reported, not used to admit)
    "admitAt": "low",              // "low" (default) or "point": which estimate of a new item admission charges
    "priors": { "build": { "low": 20, "point": 45, "high": 70 }, "council:fixing": 60 }   // overrides, see Priors
  },
  "sessions": [
    { "id": "f3-build", "kind": "build", "phase": "fixing", "priority": 5, "costUsd": 38.17,
      "startedAt": "2026-11-01T07:26:59Z", "lastActiveAt": "2026-11-01T08:54:00Z", "done": false, "paused": false,
      "recent": { "costUsd": 33.0, "at": "2026-11-01T08:44:00Z" } }   // optional earlier reading: recent burn
  ],
  "queue": [ { "id": "f5-build", "kind": "build", "phase": null, "priority": 4,
               "estimateLowUsd": 25, "estimateUsd": 45, "estimateHighUsd": 70 } ],
  "history": [ { "at": "2026-11-01T07:55:00Z", "totalCostUsd": 326.51, "status": "allowed",
                 "resetsAt": "2026-11-01T15:00:00Z", "type": "seven_day", "windowKnown": true } ]
}
```

- `kind` is `build`, `council`, `review` or `orchestrator`, optionally with its phase as `kind:phase`
  (`"build:small"` is kind `build`, phase `small`), in sessions and in the queue. Another kind is treated
  as `build` (the costliest lifecycle) and reported. `phase` (sessions and `queue[].phase`) picks a
  `kind:phase` prior; `admit[]` and `queued[]` keep it.
- `priority`: a higher number is more important. Queue items and running sessions default to 0.
- `done` and `paused` are booleans; the strings `"true"` / `"false"` are accepted with an issue, anything
  else counts as false with an issue. Duplicate session ids: a done reading wins, then the larger cost,
  then the later `lastActiveAt`. Sessions without an id get a generated `(missing id #i)` and are never
  merged.
- `recent.costUsd` above the session's `costUsd` is reported (`recent-above-cost`) and the lifetime burn
  used. Pass `recent` for every session, the orchestrator included: its lifetime average (about $30/day)
  understates it while it drives many sessions.
- `window.rateLimitType` is accepted as `window.type`, so the provider's rate-limit object passes straight
  through; with neither, `seven_day` is assumed and reported (`no-window-type`). `isUsingOverage` is a
  boolean (`"true"` / `"false"` accepted with an issue); any other value is an error and counts as
  overage, so the plan fails safe into the overage brake.
- `history[].totalCostUsd` is the spend in the window that contained `at`, which is exactly the plan's
  `historyEntry.totalCostUsd`: append each plan's `historyEntry` to the next snapshot's `history`.

**History.** An entry with its own `resetsAt` belongs to that window when it is consistent with the entry's
`at` (`resetsAt − window length ≤ at < resetsAt`) and is used as is; without one, its window is inferred
from `at` on the current window's grid. Ignored, with one issue each that counts them:
- entries with `windowKnown: false` or an explicit `resetsAt: null` (written without a usable window):
  `history-no-window`;
- entries whose `type` differs from the window's, or whose `resetsAt` does not fit a window of this type
  around `at`: `history-other-type`.

**History upkeep.** Append every plan's `historyEntry`, every tick; keep at least the last 2 hours plus
every reading of the current and the previous window (calibration and its carry-over). Skipping appends
makes calibration drift: the first warning reading is the one that sets the cap, so a missed tick moves it
later and the cap higher. Keep one history and one `capUsd` per window type.

**Where the fields come from** (one child session per entry in `sessions`):

| snapshot field | source |
|---|---|
| `sessions[].costUsd` | the child session's cumulative `usage.cost_usd` |
| `sessions[].startedAt` | when the orchestrator started the session (its `created_at`) |
| `sessions[].lastActiveAt` | the time of the session's latest event or cost update |
| `sessions[].done` | true once the session's final result arrived (finished, failed or archived) |
| `sessions[].paused` | true while the orchestrator holds the session paused |
| `sessions[].recent` | the previous tick's `costUsd` and `at` for that session |
| `window` | the latest `rate_limit_info` as reported (`status`, `resetsAt`, `rateLimitType`, `isUsingOverage`) |
| `history` | the `historyEntry` of every earlier plan of this window type |

**Mixed windows.** Children may report different rate-limit windows (`five_hour` and `seven_day`). Run one
plan per window type, each with that window's `rate_limit_info`, its own history and its own `capUsd`, and
combine them: start only the items every plan admits (the intersection of `admit[].id`), take the later
`nextAdmitAt` of an item, and pause the union of `pause.recommend`.

## Method

**Window.** The window ends at `resetsAt` and lasts 7 days (`seven_day`; `five_hour` lasts 5 hours; any
other type is treated as 7 days and reported). If `now >= resetsAt`, the window has rolled over: the plan
moves to the window containing `now`, spend counts restart from its start, and the snapshot's `status`
and `isUsingOverage` are stale and ignored (reported), since the provider clears them at reset: the plan
prints `window.status` null and `statusAssumed: "allowed"`. Without a usable `resetsAt` (window or field
missing, or outside the Date range) the plan brakes (`bad-window`), prints `window.resetsAt`, `startAt`
and `hoursToReset` as null with `window.assumed: true`, never invents a reset time and writes a
`historyEntry` with `windowKnown: false` and null `status` and `resetsAt`. A `resetsAt` more than one
window after `now` (the window would start after now) is an error (`window-ahead`) with the same brake and
`historyEntry`; every session is then counted in full.

**Spend in window.** Each session's cost is counted in full when it started inside the window. A session
that started before the window starts (the orchestrator) is counted pro rata: its cost times the share of
its active span (`startedAt` to `lastActiveAt`) that falls inside the window. A `history` reading of this
window above that sum (sessions dropped from the snapshot) is a floor on spend. Paused sessions count.

**Priors** (expected total cost of a whole session, USD, as low / point / high, and its hours), calibrated
on 2026-11-01's runs, where sessions finished in about an hour:

| kind | low | point | high | typical hours | tail hours | floor | from |
|---|---|---|---|---|---|---|---|
| build | 20 | 45 | 70 | 1.5 | 0.25 | 4 | committee builds: F-6 $28.00 in 57 min, privacy $20.78 in 73 min; running builds $31-38 at about 80 min |
| build:small | 5 | 9 | 15 | 0.5 | 0.1 | 2 | CI-speed small build $8.70 in 31 min |
| council | 30 | 45 | 65 | 1.25 | 0.25 | 4 | idea board $32.77 in 36 min; creative $31.36, design $40.90 in about 64 min; market $48.31 at 78 min, still fixing |
| review | 1 | 3 | 5 | 0.25 | 0.05 | 1 | independent review subagents: $1-4 |
| orchestrator | - | - | - | until reset | - | 2 | runs for the whole window: about $30/day; remaining hours are the hours to reset |

A key `kind:phase` overrides `kind` for sessions in that phase; `config.priors` overrides the defaults by
the same keys, as a number (low = point = high) or `{ "low", "point", "high" }` (also `typicalHours`,
`tailHours`, `floorUsd`).

**Remaining cost of a running session**, computed three times (with the low, point and high prior) as
the largest of
1. prior − spent (what the session would cost if it ends at its prior);
2. burn × remaining hours, where burn is its recent rate (`recent` reading at least 5 minutes old) or
   else its lifetime average (cost over active hours, counting at least 15 minutes), and remaining hours =
   max(typical − age, tail). The orchestrator's remaining hours are the hours until reset. The burn term
   counts once the session is 10 minutes old (5 minutes with a usable `recent` reading) or has spent its
   low prior: a few minutes' average extrapolates startup bursts, so a very young session is reserved at
   its prior;
3. the floor.

The high figure is also multiplied by `safety`. A session above its prior keeps a margin of its own burn
over the tail (at least the floor), never 0 while it is not done. Done sessions count in spend and
reserve nothing; paused sessions keep their reserve.

**Before the reset.** A running session's remaining cost is spread evenly over its remaining hours; only
the part before the reset counts against this window (`reserve.sessions[].inWindow`, each end with its own
figure), and the rest is reported as `carriesOverUsd`. A new item's in-window estimate is
min(estimate, estimate / typical hours × hours to reset). Admission, fill and overshoot use the in-window
figures. Nothing is clipped while the reset time is unknown. **Reserve** is Σ in-window remaining (point)
over the running sessions: admission only uses what is left after it, so running work can finish.

**New item estimate**: `estimateLowUsd` / `estimateUsd` / `estimateHighUsd` when given (one number alone
is used for all three), else the prior range for its kind and phase.

**Cap** (low / point / high).
1. `config.capUsd` when given: all three (source `config`).
2. Otherwise calibrated from the most recent window with an `allowed_warning` or `rejected` reading
   (history or the snapshot itself):
   - a warning: its first warning reading at spend W gives high = W / warnFraction; the last `allowed`
     reading before it in that window, at spend A, gives low = A / warnFraction (with no such reading,
     low = W; low never exceeds high);
   - a rejection in the same window: its first rejected reading at spend R lowers low and high to at most R;
   - a rejection in a newer window than the warning (or with no warning): it calibrates alone, high = R and
     low = A / warnFraction from the last allowed reading before it in its window (else R). A rejection in
     an older window than the warning is stale and ignored.
   point is the midpoint of low and high (admission uses high, fill uses point); a bracket with
   high / low above 1.25 is reported (`cap-bracket-wide`). Source `calibrated`; it carries over to later
   windows, but this window's evidence checks it: when `lowerBoundUsd` (below) is above a carried-over
   high, the old cap is disproved and dropped (`cap-stale`: the cap is unknown again); when it lies
   between low and high, low is raised to it (`cap-raised`). Any reading of this window that was not
   rejected, at spend S, proves the cap is at least S: low and high are raised to S, with
   `warn-fraction-suspect` when that raises high. `cap.calibratedFrom` names the reading that set the high
   end (`at`, `spendUsd`, `status`, `resetsAt`) and each reading used: `warning`, `rejected`, `allowedLow`.
3. Otherwise unknown (source `unknown`, values null). `lowerBoundUsd` is the largest A / warnFraction
   over `allowed` readings at spend A in this window (the cap is above it). It is always reported, never
   admits anything on its own, only checks a carried-over calibration, and is clamped to a cap set by a
   rejected reading (issue `lower-bound-clamped`, naming the reading).

**Admission: the one rule.** When unsure whether new work goes over the cap, the owner's call is to admit
it and accept the risk of going over. So queued work is admitted while

    window spend + Σ running in-window remaining (point) + Σ admitted items' in-window LOW estimate ≤ cap HIGH

Money is compared with a 1e-9 tolerance (0.1 + 0.2 fits under 0.3), here and in every fit test below.
Items are taken in priority order (then id); the first item that does not fit stops admission, so a large
important item is not starved by smaller ones. Work is queued only when it would clearly exceed 100% even
under these optimistic figures. While the cap is unknown, every queued item is admitted while status is
`allowed`. `safety` is not in the admission check. `config.admitAt: "point"` charges new items at their
point estimate instead; at the default `"low"`, a deep queue can be admitted that is likely over the cap at
point estimates, and the overshoot tier says so (`overshoot.note`).

**Overshoot risk** (`projection.overshoot`): worst case = spend + Σ running in-window high + Σ admitted
in-window high × safety, compared with the cap's low end. `none` when the worst case fits under cap low;
`possible` when it does not but the point case (spend + Σ running point + Σ admitted point) fits under cap
high; `likely` when even the point case is over cap high; `unknown` while the cap is unknown.

**Fill** (the owner's aim is to end each window with nothing left). `fill.expectedUnusedUsd` = cap point −
spend − Σ running in-window point − Σ admitted in-window point. When it is positive the plan asks for more
work: `recommendAdmitUsd`, and `suggestions`, one per prior key a queue item can express (kind and phase,
not the orchestrator): `{ kind, phase, inWindowUsd, count }`, where `inWindowUsd` is what one item of that
kind would spend before the reset and `count` how many fit in the unused budget, the biggest in-window
spend first (`suggestedKinds` lists the same keys). Near the reset, long kinds count only their part
before the reset, and the message says so. Zero under a brake (checked first: the message names the
brake); null while the cap is unknown.

The governor never limits rate: it has no per-hour limits, pacing or concurrency caps, in code or in its
default config. It only keeps running sessions' reserves and queues work that would not fit under 100%.

**Warning.** `allowed_warning` is a calibration signal, never a brake: its first appearance sets the cap
(above) and admission carries on under the rule. The plan reports `warning: true` only for a usable,
not rolled-over window.

**Brakes** (nothing is admitted). `brake` is one of:
- `rejected` or `overage` (`isUsingOverage`): running sessions may stall. `pause.recommend` lists the
  sessions to pause, lowest priority first, then the least progress (spent / point prior), never the
  orchestrator and never a session already paused; `pause.rule` says how: pause the listed sessions in
  order, one per tick, until the brake is none (rejected: status `allowed` or `allowed_warning`; overage:
  `isUsingOverage` false). `pause.needed` is true when the list is not empty. The summary shows the first
  three ids and a count of the rest.
- `unknown-status`: status missing or unrecognised (or `now` invalid), until a valid status is read.
- `bad-window`: no usable `resetsAt`, or one more than a window ahead.

With no brake, paused sessions are listed in `resume`, highest priority first, then the most progress (so
nearly done work finishes); the summary says "resume … first", and they are resumed before queued items
start. `pause.stallRisk` is true under `rejected`/`overage`, with `pause.reason`; it is also true, with an
informational reason and nothing to pause, when the cap is known and running work alone is projected over
it (`runningFits` false), which also raises `running-over-cap` with the shortfall.

**Next admission time.** `queued[].nextAdmitAt` is the latest an item would wait: `resetsAt` for an item
that does not fit or under `rejected`/`overage`, and null under `unknown-status` and `bad-window` (re-plan
every tick) and for an item already running. Under the point projection a finishing session frees nothing
(its remaining point estimate turns into spend); the orchestrator re-plans on each tick, and a session that
ends under its estimate frees the difference then. `queued[].reasonCode` is `brake`, `over-cap`, `behind`
(strict priority order) or `already-running`; an over-cap reason shows the real shortfall when the running
work alone already exceeds the cap.

**Projection.** The burn rate is the sum of the running (not paused) sessions' burns: the sessions' own
forward-looking model. `historyBurnUsdPerHour` reports the window-spend slope since the earliest history
reading of the last 2 hours (at least 15 minutes old) for information only; when it and the sessions'
burn differ by more than 2x the plan reports `burn-mismatch` (a warning: there is no independent
account-level total, since history holds the planner's own past entries). Time to cap = (cap high −
spend) / burn, compared with the hours to reset (null when the burn is 0 or the result is out of range):
a straight-line extrapolation, NOT used for admission or fill. When the cap would be hit before reset the
summary says "cap hit ~HH:MMZ at current burn" (with the date when it is not today, UTC) and never "queue
more work". `runningFits` says whether spend + Σ running in-window point fits under cap high;
`runningFitsWithSafety` uses the running in-window high figures and cap low.

## Plan (output)

```jsonc
{
  "version": 1,                      // bumped when the shape changes incompatibly
  "now": "2026-11-01T08:55:00.000Z", // every output time is ISO 8601 UTC, rounded to whole seconds
  "summary": "Admit 5 of 5 queued; …",
  "brake": "none",                   // none | rejected | overage | unknown-status | bad-window
  "warning": false,
  "window": { "type", "startAt", "resetsAt", "assumed", "rolledOver", "status", "statusAssumed", "isUsingOverage", "hoursToReset" },
  "cap": { "low", "point", "high", "source", "known", "calibratedFrom", "lowerBoundUsd" },
  "spend": { "windowUsd" },
  "reserve": { "totalUsd", "lowUsd", "highUsd", "carriesOverUsd", "safety",
               "sessions": [ { "id", "kind", "phase", "priority", "paused", "spentUsd", "priorUsd", "burnUsdPerHour",
                               "remainingHours", "remaining", "inWindow", "carriesOverUsd", "basis" } ] },
  "capacity": { "headroomUsd", "admitAt", "admittedLowUsd", "admittedPointUsd", "admittedHighUsd" },
  "resume": [ "id" ],
  "admit": [ { "id", "kind", "phase", "priority", "estimate", "inWindow" } ],
  "queued": [ { "id", "kind", "phase", "priority", "estimate", "inWindow", "reason", "reasonCode", "nextAdmitAt" } ],
  "projection": { "burnUsdPerHour", "burnSource", "historyBurnUsdPerHour", "timeToCapHours", "capHitAt",
                  "capHitBeforeReset", "runningProjectedSpendUsd", "runningFits", "runningFitsWithSafety",
                  "overshoot": { "worstCaseSpendUsd", "vsCapLowUsd", "risk", "note" } },
  "fill": { "expectedUnusedUsd", "recommendAdmitUsd", "suggestions", "suggestedKinds", "message" },
  "pause": { "stallRisk", "reason", "rule", "needed", "recommend" },
  "issues": [ { "level": "warn", "code": "string-number", "detail": "…" } ],   // level warn | error
  "historyEntry": { "at", "totalCostUsd", "status", "resetsAt", "type", "windowKnown" }
}
```

Times in may be ISO strings, unix seconds or milliseconds; times out are ISO strings rounded to whole
seconds. Money is rounded to cents in the output only. Every estimate is a range `{ low, point, high }`:
`cap`, `reserve.sessions[].remaining` and `.inWindow` (`basis` names the term that set the point figure),
`admit[]` / `queued[]` `.estimate` and `.inWindow`. `reserve.totalUsd` is the reserve (Σ in-window
point); `lowUsd` and `highUsd` sum the other ends, `carriesOverUsd` the point remaining after the reset.
`capacity.headroomUsd` = cap high − spend − reserve (null while the cap is unknown); `admittedLowUsd` /
`admittedPointUsd` / `admittedHighUsd` sum the admitted in-window estimates. Cap-dependent figures are null
while the cap is unknown. `issues[]` are `{ level, code, detail }`; `level` is `warn` or `error`.

## Limits

- Cost is a proxy for tokens: cache reads are cheap in dollars but may weigh differently against the cap.
- Spend the orchestrator cannot see (a person's own sessions on the same account) is missing from spend,
  so a cap calibrated from a warning comes out lower than the real one: that errs on the safe side.
- Until the first warning (or a `capUsd`), the cap is unknown and everything is admitted while status is
  `allowed`: the warning at `warnFraction` is the signal that turns reserves on. If the fleet's committed
  work already exceeds the cap by then, `projection.runningFits` says so and the brakes take over at
  `rejected`.
- A session in its first minutes (10, or 5 with a recent reading) below its low prior is reserved at its
  prior, not its burn, so one that bursts early is under-reserved briefly.
- Time to cap is a straight line through the sessions' burn; it ignores sessions finishing, so it is
  information only.
- Remaining cost is assumed to be spread evenly over a session's remaining hours when it is split at the
  reset.
