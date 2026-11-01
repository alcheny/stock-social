# Token budget governor

`scripts/token-budget.ts` tells the orchestrator of the parallel agent build which queued sessions it may
start now, so that sessions already running can finish before the usage window hits its cap, and new work
fills the window up to the cap. It reads one JSON snapshot and prints one JSON plan. It never starts, pauses
or stops anything itself, has no dependencies, never reads the clock (the snapshot's `now` is the clock, so
the same input always gives the same plan) and never throws on bad input: problems are listed in `issues`.

**What the owner's rule costs.** Admission compares against the cap's high end by default (the owner's rule: when
unsure, admit and accept the risk of going over), and a calibrated high end usually sits at or a little above the
true cap. With a deep backlog that means most windows end `rejected`, with running sessions stalled until the
reset: hours on `five_hour`, days on `seven_day`. `config.admitCapEnd` (`"high"`, the default, `"point"` or
`"low"`) chooses which end of the cap admission, resume and the next-window test compare against. In simulation it
barely changes stalls once the cap is calibrated (the bracket is then narrow, and stalls come from running work
reaching the cap, not from what is admitted); fewer stalls would need a margin below the cap, which is not built.

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

**Error-level issues with no brake.** Most input errors brake (`bad-now`, `no-window`, `no-resets-at`,
`window-ahead`, `bad-status`, `bad-overage`). The rest leave `brake: "none"`: proceed, but treat the plan as
optimistic until the input is fixed, because the plan has already replaced the bad value:

| code | the plan used |
|---|---|
| `bad-cost` | 0 for that session's cost: spend is understated, so the plan is optimistic until it is fixed |
| `bad-estimate` | the kind's prior range for that item (ignoring the bad field) |
| `bad-recent` | the session's lifetime burn |
| `bad-config` (`capUsd`) | no configured cap: calibrated or unknown instead |
| `bad-history` (a bad amount) | the reading ignored |
| `non-finite` | null for that output figure |

**Units.** All money is USD, from the sessions' reported `cost_usd`, used as a proxy for token use (the cap
is on tokens; cost is the only per-session figure that adds up across sessions). Fields ending in `Usd`
are dollars, `Hours` hours, `UsdPerHour` dollars per hour, `At` times; every range (`estimate`, `inWindow`,
`remaining`, `priorUsd`, and `cap.low` / `point` / `high`) is in USD too. The provider reports no percentage
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
    "orchestratorLookaheadHours": 24,  // the orchestrator's reserve looks at most this far ahead (default 24)
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
  then the later `lastActiveAt`, then a paused one, then the higher priority, then the smaller JSON text of
  the read session (so input order never matters). Sessions without an id get a generated `(missing id #i)` and are never
  merged.
- `recent` is an earlier reading of the same session: the latest reading that is at least 5 minutes of work
  old (keep one from that far back; a fresher one is ignored), with `recent.at` when it was taken and
  `recent.costUsd` the cost then, under the money rules (a numeric string is
  accepted with a warning; an invalid amount is an error-level `bad-recent`). A reading above the session's
  `costUsd` is reported (`recent-above-cost`) and the lifetime burn used. Pass `recent` for every session,
  the orchestrator included: its lifetime average (about $30/day) understates it while it drives many
  sessions.
- The orchestrator lists itself in `sessions` as kind `orchestrator`, with its own session's cost.
- `window.rateLimitType` is accepted as `window.type`, so the provider's rate-limit object passes straight
  through; with neither, `seven_day` is assumed and reported (`no-window-type`). `status` is matched
  case-insensitively (`ALLOWED` is read as `allowed` with a `status-case` warning). `isUsingOverage` is a
  boolean; missing or null means false; `"true"` / `"false"` are accepted with an issue; any other value is
  an error and counts as overage, so the plan fails safe into the overage brake (after a rollover it has no
  effect and is only a warning).
- `history[].totalCostUsd` is the spend in the window that contained `at`, which is exactly the plan's
  `historyEntry.totalCostUsd`: append each plan's `historyEntry` to the next snapshot's `history`. It is the
  spend the sessions prove (see Spend in window), which can be below `spend.windowUsd`. When the status was
  read more than 60 seconds before `now` (`window.at`), the entry is that reading: `at` = `window.at` (moved up
  to the window start when it lies up to the tolerance before it), its status, and the spend it was paired with.
  Once history holds that reading, later ticks write a spend-only entry instead (`at` = `now`, the proven spend,
  `status` null), so history keeps a spend for every tick to pair later stale readings with; a spend-only entry
  is never a cap reading (and never a bootstrap reading), only a spend floor. Identical entries count once.

**History.** An entry with its own `resetsAt` belongs to that window when it is consistent with the entry's
`at` (`resetsAt − window length ≤ at < resetsAt`) and is used as is; without one, its window is inferred
from `at` on the current window's grid. Ignored, with one issue each that counts them:
- entries with `windowKnown: false` (or the string `"false"`, also reported as `history-quirk`) or an
  explicit `resetsAt: null` (written without a usable window): `history-no-window`;
- entries whose `type` differs from the window's, or whose `resetsAt` does not fit a window of this type
  around `at`: `history-other-type`;
- entries whose own `resetsAt` names a newer window than the current one, or one overlapping it (an
  earlier reset less than one window length, less the tolerance, before the current one): `history-other-window`.
  The window-id tolerance is min(15 minutes, window length / 20) (15 minutes for both types): the supported
  `resetsAt` jitter is a spread of up to 15 minutes between neighbouring readings of one window. A `resetsAt`
  within the tolerance of the current window's grid (the current reset minus a whole number of windows) is
  snapped to that grid value first, so the same window always compares equal. Values off that grid that chain
  within the tolerance of each other (single linkage over the sorted values: each within the tolerance of the
  next) are one window too, named by the earliest of them. Windows of one type are at least one window length
  apart, so two are never merged. The plan's `historyEntry.resetsAt` repeats the earliest value history already
  holds for the current window (within the tolerance) while that value is still after `now` (else the
  snapshot's own value, which the tolerance groups with it), so every entry of a window carries one value and
  every entry is self-consistent (`at` < `resetsAt`). An entry's `at` may lie up to the tolerance outside its
  window (`resetsAt` − length − tolerance ≤ `at` < `resetsAt` + tolerance), so one written in the last seconds
  before a jittered reset keeps its window. Raw values are grouped first (single linkage), then a group is
  snapped to the grid when any member lies within the tolerance of it; entries written after a rollover carry
  the canonical value too. A plan written after a rollover records a
  `resetsAt` inferred on the old window's grid; if the provider's `five_hour` windows do not follow that
  grid, such entries are later ignored this way;
- entries with an unparseable `resetsAt`, `at` or `totalCostUsd`: `bad-history`.

`history-no-window` is reported only for such entries within the last window length; older ones are left
over from an earlier blind start: prune `windowKnown: false` entries older than one window. When pruning by
window, treat `resetsAt` values within the window-id tolerance (15 minutes) of each other as the same window.

**History upkeep.** Append every plan's `historyEntry`, every tick; keep at least the last 2 hours plus
every reading of the current and the previous window (the previous window is the latest older `resetsAt` held,
not the current `resetsAt` minus one window length, which differs when windows are off the grid) (calibration and its carry-over; a calibration is
checked against every later window still held, so keeping more windows only makes it safer). A calibration
carries over only as long as its window's entries are kept: drop them and the cap is unknown until the next
window's warning; keep at least the two previous windows to carry a calibration further, and always keep
every entry of the window named in `cap.calibratedFrom.resetsAt` (plus the current and the previous window).
Skipping appends makes calibration drift: the first warning reading is the one that sets the cap, so a missed
tick moves it later and the cap higher. Keep one history per window type, and at most one `capUsd` per window
type: a cap the owner knows and sets. Do not save the calibrated cap into `config.capUsd`: a configured cap is
never checked against later windows, so that would turn off `cap-stale` and `cap-disproved`.

**Where the fields come from** (one child session per entry in `sessions`):

| snapshot field | source |
|---|---|
| `sessions[].costUsd` | the child session's cumulative `usage.cost_usd` |
| `sessions[].startedAt` | when the orchestrator started the session (its `created_at`) |
| `sessions[].lastActiveAt` | the time of the session's latest event or cost update; a resume counts as an event: set it to the resume time |
| `sessions[].done` | true once the session's task finished or was abandoned (final result, failure or archive); an interrupted or paused session is never done |
| `sessions[].paused` | true while the orchestrator holds the session paused |
| `sessions[].pausedHours` | optional: the hours the session has spent paused so far, including a pause still running, kept by the orchestrator, together with `paused` (see Age: while `paused` is true the running pause is taken to lie after `lastActiveAt`, once it is false every pause is taken to lie inside the active span). Add time a session sat stalled under `rejected` too: a session is stalled when the brake is `rejected` or `overage` and it has had no event since; mark it `paused: true` while it is stalled (it emits no events), so the paused formula applies, and count that time in `pausedHours`: its stall starts at `lastActiveAt` and ends at the reset or its next event. Stalled sessions may appear in `resume.ids`; otherwise the stall counts as active |
| `sessions[].windowStartCostUsd` | optional: the session's `costUsd` at its last reading at or before the current window's start, taken at the canonical start (one length before the earlier of the reported `resetsAt` and the earliest value history holds for this window; the safe side for admission: it can only count more spend in the window), recorded by the orchestrator for a session that spans the start; its in-window spend is then `costUsd` − this (clamped to 0..`costUsd`; above `costUsd`: `window-start-above-cost`). It belongs to one window of one type: drop it when the window changes (it is ignored after a rollover, and a session last active before the window start counts nothing whatever it says), and with mixed windows give each plan its own window's value |
| `sessions[].recent` | the latest earlier reading of that session (`costUsd`, `at`, optional `pausedHours`: the session's `pausedHours` when the reading was taken) at least 5 minutes of work old. For a paused session the interval ends at `lastActiveAt`; with `recent.pausedHours` the pauses since the reading are taken out ((`now` − `at`) − (`pausedHours` − `recent.pausedHours`)); under 5 minutes of work the reading is ignored. After a resume, omit `recent` until a reading taken after the resume is 5 minutes old, or pass `recent.pausedHours` (above `pausedHours` it is ignored, `bad-recent`). Missing on a session with paused hours, it is taken as 0 (`recent-no-paused-hours`): every pause is taken out of the interval while that still leaves 5 minutes of work (a shorter interval, a higher burn); otherwise the plain interval is used (to `lastActiveAt` while paused, else to `now`), never the lifetime burn because of the default |
| `window` | the latest `rate_limit_info` as reported (`status`, `resetsAt`, `rateLimitType`, `isUsingOverage`), from any child session or the orchestrator's own session |
| `window.at` | optional: when that `rate_limit_info` arrived (default `now`). A status read more than 60 seconds before `now` is paired with the spend at that time: this window's latest history entry at or before `at` (at one time, the lower spend), else the proven spend of the sessions as they were then (sessions started after `at` dropped, each cost pro-rated over its span to min(`lastActiveAt`, `at`)); `historyEntry` then records that reading. `bad-window-at` when it is unreadable, after `now` or more than the tolerance before the window starts; `now` is used then. Pass the time the reading arrived |
| `history` | the `historyEntry` of every earlier plan of this window type |

**Mixed windows.** Children may report different rate-limit windows (`five_hour` and `seven_day`). Run one
plan per window type, each with that window's `rate_limit_info` (with its `window.at`), its own history and its
own `capUsd`, but the same `sessions` and `queue`, and combine them. A type never reported is left out of the
combination (no plan, not a `bad-window` brake); when no type has ever been reported, run one plan without a
window (the cold start). A type last reported long ago keeps its last reading, with `window.at` saying how old it
is:

| field | combined |
|---|---|
| `brake` | the most urgent of the plans' brakes, whatever the plan order: `rejected`/`overage` > `unknown-status` > `bad-window` > `none` |
| `admit` | the intersection of the plans' `admit[].id`; an item admitted in one plan and queued in another is queued, with that plan's `nextAdmitAt` |
| `queued[].nextAdmitAt` | the later of the plans'; null in any plan wins (re-plan every tick) |
| `pause.recommend` | the union, in the order of the more urgent plan (rejected/overage first) |
| `pause.next` | the first id of that union |
| `resume` | only when every plan's brake is `none`: the first id, in `resume.ids` order, present in every plan's `resume.fitting`; else hold. `resume.all`: the ids in every plan's `resume.all`; if that intersection is empty, resume the combined next alone |
| `fill` | the plan with the minimum `recommendAdmitUsd` (null means no limit; if all are null, null): its amount, suggestions and `blockedBy` |
| `summary` | written by the caller from the combined fields |

## Method

**Window.** The window ends at `resetsAt` and lasts 7 days (`seven_day`; `five_hour` lasts 5 hours; any
other type is treated as 7 days and reported). If `now >= resetsAt`, the window has rolled over: the plan
moves to the window containing `now`, spend counts restart from its start, and the snapshot's `status`
and `isUsingOverage` are stale and ignored (reported), since the provider clears them at reset: the plan
prints `window.status` null and `statusAssumed: "allowed"`. Without a usable `resetsAt` (window or field
missing, or outside the Date range, or implausible: at or before 0, or more than 30 days before `now`,
`resets-at-implausible`) the plan brakes (`bad-window`), prints `window.resetsAt`, `startAt`
and `hoursToReset` as null with `window.assumed: true`, never invents a reset time and writes a
`historyEntry` with `windowKnown: false` and null `status` and `resetsAt` (its `type` is the window type read, or the
default `seven_day` when there is none). A `resetsAt` more than one
window (plus the window-id tolerance) after `now` (the window would start after now) is an error (`window-ahead`) with the same brake and
`historyEntry`; every session is then counted in full.

**Spend in window.** Each session's cost is counted in full when it started inside the window, and not at all
when it was last active before the window start. A session
that started before the window starts (the orchestrator, or one resumed across a reset) counts `costUsd −
windowStartCostUsd` when the orchestrator passes that field; otherwise pro rata over its active hours (Age):
its cost times (`lastActiveAt` − window start) / active hours, at most all of it. Where its paused hours fell
is unknown, so `spend.windowUsd` puts them before the window start (the most spend in this window: the safe
side for admission), and the cap evidence, the snapshot's own status reading and `historyEntry.totalCostUsd`,
puts them inside it (the least: an overstated reading would raise a calibrated cap or disprove a right one).
The two agree unless a session spans the window start with paused hours and no `windowStartCostUsd`. A
`history` reading of this window above the sum (sessions dropped from the snapshot) is a floor on both.
Paused sessions count.

**Priors** (expected total cost of a whole session, USD, as low / point / high, and its hours), calibrated
on 2026-11-01's runs, where sessions finished in about an hour:

| kind | low | point | high | typical hours | tail hours | floor | from |
|---|---|---|---|---|---|---|---|
| build | 20 | 40 | 70 | 1.75 | 0.25 | 4 | committee builds: 2 of 9 finished, at 57 and 73 min (F-6 $28.00, privacy $20.78); six running at 81-90 min at $15.78-38.17, one at 60 min at $14.01 |
| build:small | 5 | 9 | 15 | 0.5 | 0.1 | 2 | CI-speed small build $8.70 in 31 min |
| council | 30 | 45 | 65 | 1.25 | 0.25 | 4 | idea board $32.77 in 36 min; creative $31.36, design $40.90 in about 64 min; market $48.31 at 78 min, still fixing |
| review | 1 | 3 | 5 | 0.25 | 0.05 | 1 | independent review subagents: $1-4 |
| orchestrator | - | - | - | until reset | - | 2 | runs for the whole window: about $30/day; remaining hours are the hours to reset |

A key `kind:phase` overrides `kind` for sessions in that phase; `config.priors` overrides the defaults by
the same keys, as a number (low = point = high) or `{ "low", "point", "high" }` (also `typicalHours`,
`tailHours`, `floorUsd`).

**Age** is active age throughout. With span = `lastActiveAt` − `startedAt`:
- while `paused`: max(0, min(span, `now` − `startedAt` − `pausedHours`)): the running pause lies after
  `lastActiveAt`;
- not paused: span − `pausedHours`: an ended pause lies inside the span, so idle time after the last event
  (a long tool call, a CI wait) does not hide it. When `pausedHours` is longer than the span, the session was
  just resumed with no event since and the pause lies after `lastActiveAt`: the paused formula is used. A short
  pause just resumed is taken to lie inside the span until the next event (a higher burn: the safe side).

`pausedHours` above `now` − `startedAt` is clamped (`paused-hours-above-span`). Idle and paused time does not
move a session through its typical hours, its overrun or its first minutes, and its lifetime burn is averaged
over the same active hours.

**Remaining cost of a running session**, computed three times (with the low, point and high prior) as
the largest of
1. prior − spent (what the session would cost if it ends at its prior);
2. burn × remaining hours, where burn is its recent rate (`recent` reading at least 5 minutes old) or
   else its lifetime average (cost over active hours, counting at least 15 minutes), and remaining hours =
   max(typical − age, tail) while the session is within its typical hours. A session past them (an
   overrun) is expected to need half as long again as its overrun so far: max(tail, 0.5 × (age −
   typical)); when that runs past the reset, the part after it carries over (below). The orchestrator's
   remaining hours are the hours to reset, but
   at most `config.orchestratorLookaheadHours` (default 24): it runs for the whole window, and reserving its
   burn for every hour to a reset days away would block all work (this is a horizon, not a rate limit). The burn term
   counts once the session is 10 minutes old (5 minutes with a usable `recent` reading) or has spent its
   low prior: a few minutes' average extrapolates startup bursts, so a very young session is reserved at
   its prior;
3. the floor.

The high figure is also multiplied by `safety`. A session above its prior keeps a margin of its own burn
over the tail (at least the floor), never 0 while it is not done. Done sessions count in spend and
reserve nothing; paused sessions keep their reserve.

**Before the reset.** A running session's remaining cost is spread evenly over its remaining hours; only
the part before the reset counts against this window (`reserve.sessions[].inWindow`, each end with its own
figure), and the rest is reported as `carriesOverUsd`. The orchestrator keeps running after the reset: its
burn × (min(lookahead, window length) − hours to reset), when positive, is added to its `carriesOverUsd`.
A new item's in-window estimate is
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
   high, the old cap is disproved and dropped (`cap-stale`: the cap is unknown again); the same check covers
   every later window held in history, this one included (each later window's bound is the largest A /
   warnFraction over its allowed readings at A; those windows hold no warning or rejection, so their highest
   non-rejected spend is such an A). Any reading that was not rejected, at spend S, proves the cap of its
   window is at least S; in the calibration's own window S is a bound too. Every bound is measured against
   the calibrated high before any raise (calHigh), so raises never compound and the order of windows never
   matters: the largest bound decides.
   - a bound up to 10% above calHigh (bound ≤ 1.1 × calHigh) raises high to the largest such bound
     (`cap-raised-high`; readings are estimates and warnFraction is inferred), but low stays where it was and
     point is the midpoint, so the bracket is kept;
   - a bound at or below calHigh raises low to it (`cap-raised` for a later window's);
   - a rejected reading in the calibration's window only ever lowers high (high = min(high, R), the lowest
     rejection); `cap-raised-high` is reported only when the raise stands after it;
   - a rejection in the warning's window at R below 0.9 × W / warnFraction is reported as
     `warn-fraction-suspect`, with the implied fraction W / R (set `config.warnFraction` to it);
   - a later window's bound beyond 10% drops the cap (`cap-stale`); S beyond 10% in the calibration's own
     window disproves it (`cap-disproved`; the cap is unknown, with `lowerBoundUsd` = max(this window's, S), and admission follows
   the unknown-cap rule while status is allowed or allowed_warning), unless a rejected reading later in
   the same window (later in the sorted order, so one at the same instant counts), at R ≥ S, caps it instead (high = R, low = max(S, the allowed reading before it /
   warnFraction), at most R). A calibration disproved in its own window stays dropped in later windows. A
   rejected reading at R that is followed in its window by a non-rejected reading at spend ≥ R has cleared
   (the provider's limit rolls) and caps nothing (`rejection-cleared`). Readings at the same time are
   ordered allowed, allowed_warning, rejected, then by spend, so the order of `history` never matters; the
   snapshot's own reading ranks after every history reading at `now`. "Later" and "followed" above mean
   later in this order.
   `cap.calibratedFrom` names the reading that set the high
   end (`at`, `spendUsd`, `status`, `resetsAt`) and each reading used: `warning`, `rejected`, `allowedLow`.
3. Otherwise unknown (source `unknown`, values null). `lowerBoundUsd` is the largest A / warnFraction
   over `allowed` readings at spend A in this window (the cap is above it). It is always reported, never
   admits anything on its own, only checks a carried-over calibration, and is clamped to a cap set by a
   rejected reading (issue `lower-bound-clamped`, naming the reading). Above a high end set otherwise it is
   reported, not clamped (`lower-bound-above-cap`: warnFraction may be wrong). This differs from `cap-stale`
   on purpose: an older window's calibration can be wrong for this window (the cap may have changed), but in
   the warning's own window an allowed reading above W / warnFraction cannot happen with a correct warnFraction
   (status does not go back to `allowed` before the reset), so the input, not the cap, is in doubt.

**Admission: the one rule, for this window and the next.** When unsure whether new work goes over the
cap, the owner's call is to admit it and accept the risk of going over. So queued work is admitted while

    this window: window spend + Σ running in-window remaining (point) + Σ admitted items' in-window LOW estimate ≤ cap HIGH
    next window: Σ running carry-over (point) + Σ admitted items' carry-over (LOW estimate − its in-window part) ≤ cap HIGH

An item must pass both, but the next-window test only binds items that carry something past the reset: one
that finishes before it is admitted whatever the next window has left. One that passes this window's test
but not the next window's is queued with
`reasonCode: "over-next-window"` (the cap carries forward, so near the reset a flood of long items cannot
start the next window over it). `capacity.nextWindowHeadroomUsd` = cap high − Σ running carry-over. While
the cap is unknown neither test applies. "Cap HIGH" in both tests, in resume and in `capacity.headroomUsd` is the
end `config.admitCapEnd` names (default `"high"`; `"point"` or `"low"` admit less, see the top), reported as
`capacity.admitCapEnd`.

Money is compared with a 1e-9 tolerance (0.1 + 0.2 fits under 0.3), here and in every fit test below.
Items are taken in priority order (then id); the first item that does not fit stops admission, so a large
important item is not starved by smaller ones. Work is queued only when it would clearly exceed 100% even
under these optimistic figures. While the cap is unknown, every queued item is admitted while status is
`allowed` or `allowed_warning`. `safety` is not in the admission check. `config.admitAt: "point"` charges new items at their
point estimate instead; at the default `"low"`, a deep queue can be admitted that is likely over the cap at
point estimates, and the overshoot tier says so (`overshoot.note`).

**Overshoot risk** (`projection.overshoot`): worst case = spend + Σ running in-window high + Σ admitted
in-window high × safety, compared with the cap's low end. `none` when the worst case fits under cap low;
`possible` when it does not but the point case (spend + Σ running point + Σ admitted point) fits under cap
high; `likely` when even the point case is over cap high; `unknown` while the cap is unknown. It also
reports the next window: `nextWindowCarryUsd` (running and admitted carry-over at point estimates) and
`nextWindowFits` (under cap high). `note` explains a `likely` tier or a next window over the cap that
admission at low estimates let through.

**Fill** (the owner's aim is to end each window with nothing left). `fill.expectedUnusedUsd` = cap point −
spend − Σ running in-window point − Σ admitted in-window point. When it is positive the plan asks for more
work: `recommendAdmitUsd`, and `suggestions`, one per prior key a queue item can express (kind and phase,
not the orchestrator): `{ kind, phase, inWindowUsd, carriesOverUsd, count }` (the message adds "each carries
~$X past reset" when an item carries something), where `inWindowUsd` is what one item of that
kind would spend before the reset and `count` how many fit, limited by this window (the unused budget /
`inWindowUsd`) and by the next (what the next window has left after carry-over / the item's own
carry-over); the biggest in-window spend first (`suggestedKinds` lists the same keys). The suggestions are
alternatives: "any one of" them, or any mix within `recommendAdmitUsd`. Near the reset, long kinds count only their part before the reset,
and the message says so. `recommendAdmitUsd` is 0 under a brake (checked first: the message names the
brake), 0 when no kind fits, and 0 while the queue is blocked: when an item is queued as `over-cap` or
`over-next-window` (and everything behind it waits), `fill.blockedBy` names it and the message says new
work only starts above its priority, or after splitting or lowering it (`expectedUnusedUsd` is still
reported). Null while the cap is unknown: for a single plan that means no limit, queue as much as you have.

The governor never limits rate: it has no per-hour limits, pacing or concurrency caps, in code or in its
default config. It only keeps running sessions' reserves and queues work that would not fit under 100%.

**Warning.** `allowed_warning` is a calibration signal, never a brake: its first appearance sets the cap
(above) and admission carries on under the rule. The plan reports `warning: true` only for a usable,
not rolled-over window.

**Brakes** (nothing is admitted, except the one bootstrap item under `bad-window` below). `brake` is one of:
- `rejected` or `overage` (`isUsingOverage`): running sessions may stall. `pause.recommend` lists the
  sessions to pause, lowest priority first, then the least progress (spent / point prior), never the
  orchestrator and never a session already paused; `pause.rule` says how: pause the listed sessions in
  order, one per tick, until the brake is none (rejected: status `allowed` or `allowed_warning`; overage:
  `isUsingOverage` false; both: both). `pause.needed` is true when the list is not empty. The summary shows the first
  three ids and a count of the rest.
- `unknown-status`: status missing or unrecognised (an error-level `bad-status`; or `now` invalid), until
  a valid status is read.
- `bad-window`: no usable `resetsAt`, or one more than a window ahead. Cold start: with no window or reset
  time at all, no child session running (the orchestrator and done sessions do not count) and no history
  entry holding a reading (entries with `windowKnown: false`, a null `status` or `resetsAt: null` do not
  count; a paused child counts as running), the top queued item alone is admitted (issue `bootstrap`) so that a rate-limit reading can be
  obtained; the queued reasons and the fill message then say "bootstrap: one item admitted to obtain a
  reading". With an empty queue, the fill asks for one: "queue one item to obtain a rate-limit reading",
  `recommendAdmitUsd` null and one suggestion, `{ kind: "review", count: 1 }` (the summary says so too).
  Any session's `rate_limit_info`, the orchestrator's own included, is a valid window source.
  Always start every `admit[]` id, even under a brake: a brake admits nothing except this bootstrap item.

A real `rejected` or overage status takes precedence over a bad window, so its pause list is still built;
`nextAdmitAt` stays null while the window is bad. `pause.next` is the first id to pause (or null).

With no brake, paused sessions (never the orchestrator) are listed in `resume.ids`, highest priority
first, then the most progress (so nearly done work finishes). Resume one per tick: `resume.next` is the
first of them that fits, in both windows, with the work actually running (spend + the unpaused sessions'
in-window point + its own in-window point ≤ cap high; likewise for carry-over); with the cap unknown, or
nothing but the orchestrator running, it is the first. `resume.fitting` lists every paused session that fits
alone now, in `resume.ids` order (for combining plans); with the cap unknown, or nothing but the orchestrator
running, it lists them all. `resume.all` lists the ones that fit together, taken greedily in that order (each
one that still fits with those before it; with nothing else running, the first always): resume them all now,
or `next` one per tick if you prefer (`resume.rule`). The summary says "resume X, Y, Z now" (from
`resume.all`), or "holding N paused" when none fits. Resuming and admitting can happen in the same tick: paused sessions' reserves are
already charged against the cap, so resuming while running work is over the cap changes nothing in the
plan (`resume.rule` says so). `pause.stallRisk` is true under `rejected`/`overage`, with `pause.reason`; it is also true, with an
informational reason and nothing to pause, when the cap is known and running work alone is projected over
it (`runningFits` false), which also raises `running-over-cap` with the shortfall.

**Next admission time.** `queued[].nextAdmitAt` is the latest an item would wait: `resetsAt` for an item
that does not fit or under `rejected`/`overage`, and null under `unknown-status` and `bad-window` (re-plan
every tick) and for an item already running. Under the point projection a finishing session frees nothing
(its remaining point estimate turns into spend); the orchestrator re-plans on each tick, and a session that
ends under its estimate frees the difference then. `queued[].reasonCode` is `brake`, `over-cap`, `behind`
(strict priority order) or `already-running`; an over-cap reason shows the real shortfall when the running
work alone already exceeds the cap.

**Projection.** The burn rate is the sum of the running (not paused) sessions' observed burns (recent,
else lifetime once it counts; the orchestrator its own burn). A session too young for its burn to count yet
is projected at no less than its prior's average rate (point prior / typical hours),
`reserve.sessions[].projectedBurnUsdPerHour`. On 2026-11-01 this gave about $295-330/h projected (depending
on which young sessions have 10 minutes of active age) against $258/h in the fixture's aggregate history and
about $294/h measured by the orchestrator over 07:25-08:44.
`historyBurnUsdPerHour` reports the window-spend slope since the earliest history
reading of the last 2 hours (at least 15 minutes old) for information only; when it and the projected
burn differ by more than 3x the plan reports `burn-mismatch`, except when a session started or finished in
the last 15 minutes (the slope lags then; only times given in the snapshot count, not a missing one
defaulted to now) (a warning: there is no independent
account-level total, since history holds the planner's own past entries). Time to cap = (cap high −
spend) / burn, compared with the hours to reset (null when the burn is 0 or the result is out of range):
a straight-line extrapolation, NOT used for admission or fill: `fill.recommendAdmitUsd` and its
suggestions alone decide whether to queue more. When the cap would be hit before reset the summary says
"cap hit ~HH:MMZ at current burn" (with the date when it is not today, UTC), and when fill also asks for
work: "~$X unused: queue more work (cap hit ~HH:MMZ at current burn, information only)".

**Summary.** One line: the admitted count with up to three ids, `resume X, Y, Z now`, spend, reserve and cap, the
overshoot tier, "running work over cap by $X" when running work alone exceeds the cap, "next window over
cap" when `nextWindowFits` is false, "cap reached" when
spend has reached the cap's high end, the cap-hit time, "blocked behind X" or "~$X unused: queue more
work". When running work alone is over the cap the fill message says nothing queued fits (no advice to
split or lower an item). Under a brake: what is queued, until when (rejected/overage: "until it clears or the reset
~HH:MMZ"; otherwise "re-plan each tick"), and "pause X now (then Y, Z)". Times are ~HH:MMZ, with the date
when it is not today (UTC). `runningFits` says whether spend + Σ running in-window point fits under cap high;
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
                               "projectedBurnUsdPerHour", "remainingHours", "remaining", "inWindow", "carriesOverUsd", "basis" } ] },
  "capacity": { "headroomUsd", "nextWindowHeadroomUsd", "admitAt", "admitCapEnd", "admittedLowUsd", "admittedPointUsd", "admittedHighUsd" },
  "resume": { "ids": [ "id" ], "next", "fitting": [ "id" ], "all": [ "id" ], "rule" },
  "admit": [ { "id", "kind", "phase", "priority", "estimate", "inWindow" } ],
  "queued": [ { "id", "kind", "phase", "priority", "estimate", "inWindow", "reason", "nextAdmitAt",
                "reasonCode" } ],   // brake | over-cap | over-next-window | behind | already-running
  "projection": { "burnUsdPerHour", "burnSource", "historyBurnUsdPerHour", "timeToCapHours", "capHitAt",
                  "capHitBeforeReset", "runningProjectedSpendUsd", "runningFits", "runningFitsWithSafety",
                  "overshoot": { "worstCaseSpendUsd", "vsCapLowUsd", "risk", "note", "nextWindowCarryUsd", "nextWindowFits" } },
  "fill": { "expectedUnusedUsd", "recommendAdmitUsd", "suggestions", "suggestedKinds", "blockedBy", "message" },
  "pause": { "stallRisk", "reason", "rule", "needed", "next", "recommend" },
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

- A session's projected rate jumps from its prior's average to its observed burn when it turns 10 minutes
  old (5 with a recent reading).
- Cost is a proxy for tokens: cache reads are cheap in dollars but may weigh differently against the cap.
- Spend the orchestrator cannot see (a person's own sessions on the same account) is missing from spend.
  A one-off amount makes a cap calibrated from a warning come out low, the safe side; steady background
  spend keeps growing the provider's total after calibration, so the rejection comes earlier than the plan
  expects. When background use is known, set `config.capUsd` to the cap less that use.
- Until the first warning (or a `capUsd`), the cap is unknown and everything is admitted while status is
  `allowed` (or `allowed_warning`, once a calibration has been disproved): the warning at `warnFraction` is the signal that turns reserves on. If the fleet's committed
  work already exceeds the cap by then, `projection.runningFits` says so and the brakes take over at
  `rejected`.
- A session in its first minutes (10, or 5 with a recent reading) below its low prior is reserved at its
  prior, not its burn, so one that bursts early is under-reserved briefly.
- Time to cap is a straight line through the sessions' burn; it ignores sessions finishing, so it is
  information only.
- Remaining cost is assumed to be spread evenly over a session's remaining hours when it is split at the
  reset.
- An overrun session is expected to need half its overrun again: a rule of thumb from one day of fix rounds.
- The orchestrator's reserve looks 24 hours ahead by default, so with days to the reset it is not reserved
  for the whole window.
- Without `windowStartCostUsd`, a session that spans the window start with paused hours is split pro rata
  over active hours with its pauses placed at the safe end for each use (above); time stalled under
  `rejected` counts as active unless the orchestrator marks the session paused and adds it to `pausedHours`.
- A `recent` reading without `recent.pausedHours` on a session that has paused hours has all of them taken out
  of its interval (`recent-no-paused-hours`): a shorter interval and a higher burn, possibly too short to use.
- A stale status reading (`window.at`) with no history entry at or before it is paired with the sessions'
  costs pro-rated over their spans to `at`, an estimate (pauses ignored).
- With admission at the cap's high end (the default `admitCapEnd`, the owner's rule) and a high end calibrated
  at or above the true cap, a deep backlog makes most windows end rejected, with running sessions stalled until
  the reset (days on `seven_day`). `config.admitCapEnd` does not change this much (see the top). Not built: an
  admission margin below the cap (e.g. up to a fraction of cap low), which would cut stalls at some utilisation.
- `resetsAt` jitter is supported up to a spread of 15 minutes between neighbouring readings of one window.
- A `resetsAt` more than 30 days old is treated as garbage (`resets-at-implausible`), not rolled forward.
