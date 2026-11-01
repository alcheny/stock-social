# Token budget governor

`scripts/token-budget.ts` tells the orchestrator of the parallel agent build which queued sessions it may
start now, so that sessions already running can finish before the usage window hits its cap, and new work
waits for the window to refresh. It reads one JSON snapshot and prints one JSON plan. It never starts,
pauses or stops anything itself, has no dependencies, never reads the clock (the snapshot's `now` is the
clock, so the same input always gives the same plan) and never throws on bad input: problems are listed
in `issues`. Inputs are bounded so every number in the plan is finite: money (costs, estimates, `capUsd`,
history totals) up to $1e12, times inside the JavaScript Date range, prior hours up to 1e4, `safety` in
[1, 100], `warnFraction` in [0.01, 0.99]; anything outside is treated as invalid and reported. A
non-finite figure that still slipped through is printed as null with a `non-finite` error issue.

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
    "safety": 1.5,                 // widens running sessions' high remaining-cost figure (reported, not used to admit)
    "priors": { "build": { "low": 20, "point": 40, "high": 55 }, "council:fixing": 60 }   // overrides, see Priors
  },
  "sessions": [
    { "id": "f3-build", "kind": "build", "phase": "fixing", "priority": 5, "costUsd": 38.17,
      "startedAt": "2026-11-01T05:10:00Z", "lastActiveAt": "2026-11-01T08:54:00Z", "done": false,
      "recent": { "costUsd": 33.0, "at": "2026-11-01T08:24:00Z" } }   // optional earlier reading: recent burn
  ],
  "queue": [ { "id": "f5-build", "kind": "build", "priority": 4, "estimateLowUsd": 25, "estimateUsd": 40, "estimateHighUsd": 55 } ],
  "history": [ { "at": "2026-11-01T07:55:00Z", "totalCostUsd": 520, "status": "allowed" } ]
}
```

- `kind` is `build`, `council`, `review` or `orchestrator`. Another kind is treated as `build` (the
  costliest lifecycle) and reported.
- `priority`: a higher number is more important. Queue items and running sessions default to 0.
- `done` is a boolean; the strings `"true"` / `"false"` are accepted with an issue, anything else counts as
  running (false) with an issue. Duplicate session ids: a done reading wins, then the larger cost, then the
  later `lastActiveAt`. Sessions without an id get a generated `(missing id #i)` and are never merged.
- `recent.costUsd` above the session's `costUsd` is reported (`recent-above-cost`) and the lifetime burn used.
- `window.rateLimitType` is accepted as `window.type`, so the provider's rate-limit object passes straight
  through; with neither, `seven_day` is assumed and reported (`no-window-type`).
- `history[].totalCostUsd` is the spend in the window that contained `at`, which is exactly the plan's
  `historyEntry.totalCostUsd`: append each plan's `historyEntry` to the next snapshot's `history`.
  An entry may carry `resetsAt` to say which window it belongs to; without it, its window is inferred
  from `at`.

**History upkeep.** Append every plan's `historyEntry`, every tick; keep at least the last 2 hours (the
burn slope) plus every reading of the current and the previous window (calibration and its carry-over).
Skipping appends makes calibration drift: the first warning reading is the one that sets the cap, so a
missed tick moves it later and the cap higher. An entry written without a usable window has `status` and
`resetsAt` null and never calibrates anything.

**Where the fields come from** (one child session per entry in `sessions`):

| snapshot field | source |
|---|---|
| `sessions[].costUsd` | the child session's cumulative `usage.cost_usd` |
| `sessions[].startedAt` | when the orchestrator started the session (its own record of the launch) |
| `sessions[].lastActiveAt` | the time of the session's latest event or cost update |
| `sessions[].done` | true once the session's final result arrived (finished, failed or archived) |
| `sessions[].recent` | the previous tick's `costUsd` and `at` for that session |
| `window` | the latest `rate_limit_info` as reported (`status`, `resetsAt`, `rateLimitType`, `isUsingOverage`) |
| `history` | the `historyEntry` of every earlier plan |

**Mixed windows.** Children may report different rate-limit windows (`five_hour` and `seven_day`). Run one
plan per window, each with that window's `rate_limit_info`, and start only the items that every plan
admits. `admit` lists objects: start `admit[].id`.

## Method

**Window.** The window ends at `resetsAt` and lasts 7 days (`seven_day`; `five_hour` lasts 5 hours; any
other type is treated as 7 days and reported). If `now >= resetsAt`, the window has rolled over: the plan
moves to the window containing `now`, spend counts restart from its start, and the snapshot's `status`
and `isUsingOverage` are stale and ignored (reported), since the provider clears them at reset. Without a
usable `resetsAt` (window or field missing, or outside the Date range) the plan brakes (`unknown-status`),
prints `window.resetsAt`, `startAt` and `hoursToReset` as null with `window.assumed: true`, never invents a
reset time (`nextAdmitAt` null) and writes a `historyEntry` with null `status` and `resetsAt`. A `resetsAt`
more than one window after `now` (the window would start after now) is an error (`window-ahead`): brake,
every session counted in full, and a `historyEntry` with null `status` and `resetsAt`.

**Spend in window.** Each session's cost is counted in full when it started inside the window. A session
that started before the window starts (the orchestrator) is counted pro rata: its cost times the share of
its active span (`startedAt` to `lastActiveAt`) that falls inside the window. A `history` reading of this
window above that sum (sessions dropped from the snapshot) is a floor on spend. Without a usable
`window.resetsAt` every session counts in full and the plan brakes (`unknown-status`) until one is read.

**Priors** (expected total cost of a whole session, USD, as low / point / high), calibrated on
2026-11-01's runs:

| kind | low | point | high | typical hours | tail hours | floor | from |
|---|---|---|---|---|---|---|---|
| build | 20 | 40 | 55 | 5 | 1 | 4 | committee feature builds: done $28.00, $20.78; running up to $38.17; fix rounds add more |
| build:small | 5 | 9 | 12 | 2 | 0.5 | 2 | a small dev task: $8.70 |
| council | 30 | 40 | 60 | 4 | 1 | 4 | done $31.36, $32.77, $40.90; one at $48.31 still fixing, so the high end is above 50 |
| review | 1 | 3 | 4 | 0.5 | 0.25 | 1 | independent review subagents: $1-4 |
| orchestrator | - | - | - | until reset | - | 2 | runs for the whole window: about $30/day; remaining hours are the hours to reset |

A key `kind:phase` overrides `kind` for sessions in that phase; `config.priors` overrides the defaults by
the same keys, as a number (low = point = high) or `{ "low", "point", "high" }`.

**Remaining cost of a running session**, computed three times (with the low, point and high prior) as
the largest of
1. prior − spent (what the session would cost if it ends at its prior);
2. burn × remaining hours, where burn is its recent rate (`recent` reading at least 5 minutes old) or
   else its lifetime average (cost over active hours, counting at least 15 minutes), and remaining hours =
   max(typical − elapsed, tail). The orchestrator's remaining hours are the hours until reset. The burn
   term counts only once the session is at least 30 minutes old or has spent its low prior: a few
   minutes' average extrapolates startup bursts (a $3.16 council at 5 minutes would otherwise reserve
   $49.51), so a young session is reserved at its prior;
3. the floor.

The high figure is also multiplied by `safety`. A session above its prior keeps a margin of its own burn
over the tail (at least the floor), never 0 while it is not done. Done sessions count in spend and
reserve nothing. **Reserve** is Σ remaining (point) over the running sessions: admission only uses what
is left after it, so running work can finish.

**New item estimate**: `estimateLowUsd` / `estimateUsd` / `estimateHighUsd` when given (one number alone
is used for all three), else the prior range for its kind.

**Cap** (low / point / high).
1. `config.capUsd` when given: all three (source `config`).
2. Otherwise calibrated: in the most recent window in which status turned `allowed_warning` (history or
   the snapshot itself), the first warning reading at spend W gives high = W / warnFraction; the last
   `allowed` reading before it in that window, at spend A, gives low = A / warnFraction (with no such
   reading, low = W: the cap is at least the spend already seen; low never exceeds high). point is the
   midpoint of low and high (admission uses high, fill uses point); a bracket with high / low above 1.25
   is reported (`cap-bracket-wide`). Source `calibrated`; it carries over to later windows.
   The first `rejected` reading (at spend R) of the most recent window with one lowers low and high to at
   most R, but only when that window is the warning's own window or newer: an older window's rejection is
   stale. With no warning at all, the rejected reading calibrates alone: high = R, low = A / warnFraction
   from the last allowed reading before it in its window (else R).
   A calibration from an older window is raised by this window's evidence: low and high become at least
   `lowerBoundUsd` (issue `cap-raised`). `cap.calibratedFrom` names the reading that set the high end
   (`at`, `spendUsd`, `status`, `resetsAt`) and each reading used: `warning`, `rejected`, `allowedLow`.
3. Otherwise unknown (source `unknown`, values null). `lowerBoundUsd` is the largest A / warnFraction
   over `allowed` readings at spend A in this window (the cap is above it). It is always reported, never
   admits anything on its own, only raises a carried-over calibration (above), and is clamped to a cap
   set by a rejected reading (issue `lower-bound-clamped`).

**Admission: the one rule.** When unsure whether new work goes over the cap, the owner's call is to admit
it and accept the risk of going over. So queued work is admitted while

    window spend + Σ running remaining (point) + Σ admitted items' LOW estimate ≤ cap HIGH

Money is compared with a 1e-9 tolerance (0.1 + 0.2 fits under 0.3). Items are taken in priority order
(then id); the first item that does not fit stops admission, so a large
important item is not starved by smaller ones. Work is queued only when it would clearly exceed 100% even
under these optimistic figures. While the cap is unknown, every queued item is admitted while status is
`allowed`. `safety` is not in the admission check; it only widens the reported high figures.

**Overshoot risk** (`projection.overshoot`): worst case = spend + Σ running high + Σ admitted high,
compared with the cap's low end. `none` when the worst case fits under cap low; `possible` when it does not
but the point case (spend + Σ running point + Σ admitted point) fits under cap high; `likely` when even
the point case is over cap high.

**Fill** (the owner's aim is to end each window with nothing left). `fill.expectedUnusedUsd` = cap point −
spend − Σ running remaining (point) − Σ admitted estimates (point); work that will not finish before reset
still counts in full. When it is positive the plan asks for more work: `recommendAdmitUsd`, and
`suggestedKinds`, the kinds whose typical hours fit before the reset and whose point prior fits in the
unused budget, biggest first, so near the reset it recommends shorter items (the message says so), or
says none fits. Zero under a brake (checked first: the message names the brake); null while the cap is
unknown. `window.hoursToReset` is the longest an item can run before the reset.

The governor never limits rate: it has no per-hour limits, pacing or concurrency caps, in code or in its
default config. It only keeps running sessions' reserves and queues work that would not fit under 100%.

**Warning.** `allowed_warning` is a calibration signal, never a brake: its first appearance sets the cap
(above) and admission carries on under the rule. The plan reports `warning: true`.

**Brakes** (nothing is admitted):
- `rejected` or `isUsingOverage`: running sessions may stall; the plan recommends pausing sessions
  starting with the lowest priority, then the least progress (spent / point prior), never the
  orchestrator. `pause.rule` says how to use the list: pause in this order until status is allowed
  again. The summary shows the first three ids and a count of the rest.
- status missing or unrecognised: treated as a brake until a valid status is read.

`pause.stallRisk` is true under these brakes, with `pause.reason`; it is also true, with an
informational reason and nothing to pause, when the cap is known and running work alone is projected
over it (`runningFits` false). That case also raises an issue `running-over-cap` with the shortfall:
with a calibrated cap, spend the orchestrator cannot see makes the cap come out low (the safe side).

**Next admission time.** A queued item gets `nextAdmitAt`. Under the point projection a finishing
session frees nothing (its remaining point estimate turns into spend), so an item that does not fit waits
for `resetsAt`; the orchestrator re-plans on each tick, and a session that ends under its estimate frees
the difference then. Under a brake, `resetsAt`; null when the window has no usable reset time. An item
whose id is already running is listed in `queued` with reason `already running` and `nextAdmitAt: null`.

**Projection.** Burn rate is the window-spend slope over history readings in the last 2 hours of this
window (at least 15 minutes apart), else the sum of the running sessions' burns. Time to cap =
(cap high − spend) / burn, compared with the hours to reset (null when the burn is 0 or the result is out
of range): a straight-line extrapolation, reported for information and NOT used for admission or fill.
When the cap would be hit before reset the summary says "cap hit ~HH:MMZ at current burn". When the
history slope and the running sessions' summed burns differ by more than 2x, the plan reports
`burn-mismatch`: history higher means spend outside the listed sessions (or sessions that just finished),
so reserves may be understated; sessions higher means lifetime averages overstate the current burn, or
history readings are missing. `runningFits` says whether spend + Σ running point fits under cap high;
`runningFitsWithSafety` uses the running high figures and cap low. While the cap is unknown the
cap-dependent figures are null and `overshoot.risk` is `unknown`.

## Plan (output)

`summary` is one line for a human. `admit` lists the items (objects) to start now: start each
`admit[].id`. `queued` holds the rest, each with a `reason` and `nextAdmitAt`. `pause` is
`{ stallRisk, reason, rule, recommend }`. `brake`, `warning`, `cap`, `spend`, `reserve` (per session,
with the basis of each estimate), `capacity`, `projection`, `fill`, `pause` and `issues` explain the
decision. `historyEntry`
is what to append to the next snapshot's `history` (its `status` is null after a rollover: the stale status
is not a reading). Money is rounded to cents and times to whole seconds in the output only.

Every estimate is a range `{ low, point, high }`: `cap` (with `source`, `known`, `calibratedFrom`,
`lowerBoundUsd`), `reserve.sessions[].remaining` (`basis` names the term that set the point figure),
`admit[].estimate` and `queued[].estimate`. `reserve.totalUsd` is the reserve (Σ point); `lowUsd` and
`highUsd` sum the other ends. `capacity.headroomUsd` = cap high − spend − reserve (null while the cap is
unknown); `admittedLowUsd` / `admittedPointUsd` / `admittedHighUsd` sum the admitted estimates.

## Limits

- Cost is a proxy for tokens: cache reads are cheap in dollars but may weigh differently against the cap.
- Spend the orchestrator cannot see (a person's own sessions on the same account) is missing from spend,
  so a cap calibrated from a warning comes out lower than the real one: that errs on the safe side.
- Until the first warning (or a `capUsd`), the cap is unknown and everything is admitted while status is
  `allowed`: the warning at `warnFraction` is the signal that turns reserves on. If the fleet's committed
  work already exceeds the cap by then, `projection.runningFits` says so and the brakes take over at
  `rejected`.
- A session younger than 30 minutes is reserved at its prior, not its burn, so one that bursts early is
  under-reserved until it is 30 minutes old.
- Time to cap is a straight line through the burn rate; it ignores sessions finishing, so it is
  information only.
- Remaining cost (and `fill`) count work that runs past the reset fully against this window.
