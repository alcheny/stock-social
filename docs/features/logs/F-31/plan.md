# F-31: plan (UX lead draft, 2026-11-01)

Reads with `docs/features/F-31-readout-limits-and-partial-rows.md` (the WHAT, every decision stands),
`docs/features/F-15-measurement-foundation.md` (the readout it extends) and `scripts/f31-readout-baseline.ts` (the
pre-F-31 text for the last acceptance criterion). One PR. The interface is the owner's plain-text/markdown readout
(`scripts/f15-readout.ts`), so "screens" below means printed blocks, rows and cells.

**Start condition.** F4-11 (fixture filers in `demoUser`) and F4-12 (`DEMO_INVITE_LINE`, the Demo-landings row) are on
main in 1eab2ef (#89). The baseline file was cut from that commit. The feature file still says `Status: blocked`. The
owner or the pipeline flips that status; this plan does not edit the feature file.

## 0. Decisions in this plan (summary)

| # | Point | Recommendation |
|---|---|---|
| D1 | Trader/filer split vs. "strict G3 unchanged" (notes 1) | **Option A, refined.** Existing base cells unchanged. Per week, the strict cell S is split into three atoms (other traders a, internal traders b, filers c) by a separate second-level rule with a priority order. No "≥ n" on second-level rows (S − bound would leak). No totals. |
| D2 | Address-cap source of truth (owner open question; notes 2) | **Stored aggregate**: a new table `view_cap_days(day, trusted)` holding presence marks, written at most once per instance per day per kind. A deploy setting read on the owner's machine would be a guess. |
| D3 | Where the flag prints (notes 3) | A per-week row `address cap` directly under the strict G3 row (`live` or `not readable as a gate: address cap not live`), plus the `address cap: live / not live` line in the limits block for the latest printed week. |
| D4 | Concentration row (notes 4) | Per week, the largest single profile's strict-G3 views from a dedicated loader (groups by `user_id`, never selects it). Prints the share rounded down to a whole percent, only when the week's family is printable, the profile has ≥ 5 views, and every class quantity the owner can know minus it is 0 or ≥ 5. |
| D5 | Self-views row surfaces (notes 5) | Every record surface (profile, trade, month), every referrer class and every via, trader targets only. It uses its own Base row, so it gets the same suppression. No total column. |
| D6 | Internal handles (notes 6) | Env `READOUT_INTERNAL_HANDLES`, read only in `main`. buildReadout never receives a handle. G1 and G3 rows print "(s)" whenever the removed part, or what is left, would be 1 to 4. |
| D7 | "tagged link or external referrer" (notes 7) | Profile surface, trader targets, and either an external referrer or a via in `SHARE_VIAS ∪ INVITE_VIAS`. A sum of existing base cells, so it is safe by construction. |
| D8 | Source scan (notes 8) | Scans every `select` list, at every depth, in `scripts/f15-readout.ts`. Bans id, user_id, handle, display_name, return_pct, filer_key, `*` and value-collecting aggregates, and includes a self-test on bad snippets. One behaviour-neutral edit is needed: main's G1 subquery drops its unused `u.id`. |
| D9 | "Under each G3 row" | Read as **under the strict G3 row**, the one row the risk is about. The helper takes any key set, so adding the split under another row later is one line each. The business lead or owner confirms this (§9). |
| D10 | Owner Q (MRC2-3): should filer views count toward G3? | This plan doesn't decide it. The limits block says it is the owner's call, and the rows only show the two apart. |

## 1. Where everything prints (top to bottom)

```
# F-15 owner readout
<the five existing header lines, unchanged>
                                               ← blank line (existing)
## Limits of these counts                      ← NEW block (§2), above the first G-row
...
## G1
| Traders with a connected broker | ≥ 50 | … |                       (unchanged)
| partial: traders whose connections are all frozen or failed … |   (unchanged)
| partial: strict G1 without internal accounts |  | … |               NEW, only when the env list is set
## G2                                                                (unchanged)
## G3
| Profile views from external referrers / week (views, not people) | ≥ 5,000 | … |   (unchanged)
| address cap |  | live / not readable as a gate: address cap not live |             NEW
| of which: broker-trader profiles |  | … |                                          NEW
| of which: public-filing profiles |  | … |                                          NEW
| largest single profile's share of strict G3 |  | … |                               NEW
| partial: strict G3 without internal accounts' profiles |  | … |                    NEW, env set only
| partial: tagged link or external referrer |  | … |                                 NEW
| partial: tagged links, card | … (every existing partial row, unchanged, same order)
| self-views removed (signed in) |  | … |                                            NEW, last row
<three existing G3 note lines, unchanged>
<NEW note lines: SPLIT_LINE, TOP_LINE, SELF_LINE, then INTERNAL_LINE when the env list is set>
## G4, ## Bot filter drops, ## Views by surface × via × week          (unchanged)
```

The G3 table keeps its columns: metric, Continue if, then the 8 weeks. It has **no Total column**. The "Continue if"
cell of every new row is empty, so a threshold sits only beside the strict figures, as F-15 requires. Plain text only:
no colour, no box-drawing, no emoji. Every state is said in words (`live`, `not live`, `(s)`, `—`).

## 2. The limits block: exact text

Exported constants: `LIMITS_HEADING`, `LIMIT_LINES` (array) and the fact-line builders. The block prints on **every
run**, whatever the data (empty input included). It comes right after the existing header's blank line and before
`## G1`, followed by one blank line.

```
## Limits of these counts

- These are first-party counts from the app's own view beacon. They can be inflated, and they are not verified figures.
- Signed-out views by a trader of their own record, by the owner or by the team can't be told apart from anyone else's views; only signed-in self-views are removed (row "self-views removed (signed in)").
- A scripted client can forge a view and its via tag; a forged view that passes the bot filter is counted and leaves no trace in the drops table.
- A tagged link opened with no referrer is outside the strict G3 row, which counts external referrers only; the row "partial: tagged link or external referrer" counts both.
- "Views, not people" applies to every row that counts views: one person can add many views.
- Whether filer views count toward G3, and how any gate is read, is the owner's call (MRC2-3); the "of which" rows only show trader and filer views apart.

This week's facts (<weekHeader(latest printed week)>, the latest week printed):
- <address cap line, one of three>
- <flag line, only when any printed week is not shown live>
- <internal accounts line, one of three>
```

Address cap line (latest printed week; §4 has the week rule):
- live: `- address cap: live (every beacon that week was checked against a trusted client address; the cap is per server instance).`
- untrusted mark seen: `- address cap: not live (some beacons that week had no trusted client address, so the per-address rate cap was skipped for them).`
- no mark: `- address cap: not live (not shown live: no address check was recorded that week).`

Flag line (when any of the 8 printed weeks is not live):
`- While the address cap is not shown live, strict G3 is not readable as a gate; it still prints, and the row "address cap" under it reads "not readable as a gate: address cap not live" for each such week.`

Internal accounts line:
- env unset or blank: `- internal accounts: not removed (READOUT_INTERNAL_HANDLES is unset).`
- set, no valid handle: `- internal accounts: not removed (READOUT_INTERNAL_HANDLES lists no valid handle).`
- set: `- internal accounts: removed only in the rows "partial: strict G1 without internal accounts" and "partial: strict G3 without internal accounts' profiles"; every other row still counts them.`
  When entries were ignored, it adds ` <n> listed entry was not a valid handle and was ignored.` (or `entries were`). That is a
  count of config entries, never their text.

Each decided sentence maps to a line. "first-party … inflated, not verified" is line 1. "signed-out self, owner and team
… cannot be told apart" is line 2. "scripted clients can forge views and `via` with no drop trail" is line 3. "tagged
landings with no referrer … one partial row" is line 4. "views, not people applies to every row" is line 5, worded
"every row that counts views" because G1 and G2 count traders. Line 6 is the owner's-call line from the C4-4 reshape
(ballots, R-1). The three fact lines are the decided "this week's facts".

## 3. New rows: labels, values and suppression

Notation: `OK(x)` ⇔ `x === 0 || x >= 5`. "Exact" means `views.exact(...)` from the existing Base.

### 3.1 The strict family (one per week): "of which" rows, concentration, internal G3

The atoms come from the same rollup rows that feed the strict cell. These are the rows buildReadout already keeps for
`profile|*|ext|trader`: a known surface, `self_view` false, not demo, in the window. Each row's count is also added to
one atom of week w:
- `c` = filer target (`row.filer === true`)
- `b` = internal trader (`row.internal === true`, never a filer, by the loader)
- `a` = every other trader target

By construction `a + b + c` equals the strict cell's value, so S is always split exactly. A test asserts the identity.

**Gate.** When the strict cell for week w is not exact (it prints `<5`, `(s)` or `≥ n`), every row of the family prints
`(s)` for that week. Otherwise the family is computed by an exported pure function:

`strictFamily({ a, b, c }, top: number | null, internalSet: boolean)` → `{ trader, filer, withoutInternal, top }` (strings)

1. **Pair** (`of which: broker-trader profiles` = a + b, `of which: public-filing profiles` = c). Both print exactly
   iff `OK(a + b) && OK(c)`. Otherwise both print `(s)`. They never print "≥ n": with S exact, S − bound gives the
   hidden part.
2. **Internal G3** (`partial: strict G3 without internal accounts' profiles` = a + c, only when `internalSet`). It
   prints exactly iff `OK(a + c) && OK(b) && (!pairPrinted || OK(a))`. Otherwise it prints `(s)`. The pair has
   priority, because it is the decided core (C4-4). The internal row yields when printing both would make `a` known.
3. **Concentration** (`largest single profile's share of strict G3`). Let K be the class quantities the owner can
   know: always {S}; with the pair printed, add a + b and c; with the internal row printed, add a + c and b; with both
   printed, add a, b, c and every sum of them. The row prints `floor(100·M/S)%` (`100%` only when M = S) iff
   `S > 0 && top !== null && 5 <= M <= S && M <= max(a, b, c)` and, for every k in K with `k >= M`, `OK(k − M)`.
   When S = 0 it prints `—`. Otherwise it prints `(s)`. A missing or inconsistent top value (no row for a week with
   S > 0, or M > S) also prints `(s)`, the same choice as G2's blind case.

**Why there is no subtraction path (weekly).** Inside one week, the only equation that ties family rows to anything
else printed is `a + b + c = S`:
- Printed rows are sums of atoms, never bounds. Their span is {S}, plus {a + b, c} with the pair, plus {a + c, b} with
  the internal row, which is everything when both print. The rules above require every quantity in that span to be
  OK, so no count from 1 to 4 of an atom or a sum of atoms can be worked out.
- M is one profile's views, and a profile has exactly one class. So the owner can learn "M sits inside k" only for
  class quantities, and the rule checks `k − M` for every known class quantity k ≥ M. It doesn't need to know where M
  sits, so it is conservative.
- A profile's views spread over vias, so M never sits inside a via-sliced base sum, and `base sum − M` can't be
  worked out.
- The atoms against the existing via-sliced base cells form a two-way table with known margins. In such a table a
  cell can be pinned only in the degenerate case where a margin equals S, and then the cell equals another margin that
  is already printed safely. So the split adds no new small value at the via level.

**Why there is no subtraction path (cumulative).** No family row has a total. No printed figure sums family rows over
weeks, and the existing totals are sums of base cells, which never contain an atom split. Each week's family is
therefore closed, and no cross-week complement is needed. Whether a week's family is hidden reveals only "something
here is 1 to 4", which is what `<5` already says. Cell vocabulary: exact number, `(s)`, `—`, and for the concentration
row `NN%`. The family rows never print `<5`, because a `<5` on one part would hand over the other part as S − part.

### 3.2 Base-cell rows (safe by the existing Base contract)

- `partial: tagged link or external referrer` = `select((k) => k.surface === 'profile' && (k.ext || TAGGED.includes(k.via)))`,
  with `TAGGED = [...SHARE_VIAS, ...INVITE_VIAS]`. Trader targets only: Demo invite landings stay in their own two
  rows. nav and profile vias are in-app CTA codes, not links that leave the app, so they stay out. The cell uses
  `views.print`. A printed number never contains a hidden base cell, so no subtraction against strict, the
  surface × via table, its totals or the drops table can recover one. That is the existing proof (header of
  `class Base`).
- `self-views removed (signed in)`: a second Base (`selfs`) with one key, `self`. It is filled from rollup rows with
  `self_view === true`, a known record surface (profile, trade or month), `demo !== true` and the week in the window.
  It is sealed like `views`: cells 1 to 4 are hidden, plus a row-wise complement across the 8 weeks. It prints
  per week with `selfs.print` and has no Total column. Self-views are in no other printed number, so this row shares
  no equation with any other.

### 3.3 Address cap row

`address cap`, one cell per week: `live` when the week has at least one `trusted = true` mark and no
`trusted = false` mark; otherwise `not readable as a gate: address cap not live`. These are booleans, so there is
nothing to suppress. The strict row above prints unchanged in every case (AC4).

### 3.4 G1 internal row

`partial: strict G1 without internal accounts` = g − k, where g = `traders.length` (the strict G1 figure) and k =
the traders with `internal === true`. It prints exactly iff `OK(g) && OK(k) && OK(g − k)`, else `(s)`. It
prints only when the env list is set. G1 already prints k-free. With g − k printed, k becomes known, so k must be OK.
Against G2, internal traders cross G2's partitions as a two-way table: no cell is pinned unless k = g, and then g − k
is 0 and adds nothing. So no G2 cell can be worked out.

Consequence for a solo owner (k = 1): the G1 row reads `(s)` on every run. This is the small-cell rule working as
written. A "≥ g − h" bound from the number of listed handles was considered and rejected: the readout's legend gives
"≥ n" one meaning ("n counts only the visible parts"), and two meanings would mislead. The owner is told in §9.

### 3.5 New note lines under G3 (exact)

```
SPLIT_LINE: The "of which" rows split the strict row by profile: a broker-trader profile or a public-filing profile. They print only in a week whose strict figure is exact, and read "(s)" when either part, or anything that could be worked out from them and the rows below, would be 1 to 4; they have no total and no difference row.
TOP_LINE: The largest single profile's share is one profile's strict G3 views over the week's strict G3, rounded down to a whole percent; it names no profile, reads "(s)" unless that profile has 5 or more views and nothing from 1 to 4 can be worked out from it, and reads "—" when the strict figure is 0.
SELF_LINE: "self-views removed (signed in)" counts signed-in traders' views of their own profile, trade and month pages; they are in no other row. Signed-out self-views can't be told apart and stay in the counts.
INTERNAL_LINE (env set only): Internal accounts come from an env list read only on the machine that runs this readout; no handle is printed. Their rows read "(s)" when 1 to 4 internal accounts (G1), 1 to 4 views of internal profiles (G3), or 1 to 4 of what is left would be worked out by subtraction.
```

### 3.6 Worked example: the baseline input (AC8)

For `baseInput()` at `BASE_NOW`, with the env unset and no cap, top or filer data, the new rows read:

| Row | W36 | W37 | W38 | W39 | W40 | W41 | W42 | W43 |
|---|---|---|---|---|---|---|---|---|
| address cap | not readable as a gate: address cap not live | (same in every week) | | | | | | |
| of which: broker-trader profiles | (s) | 48 | 50 | (s) | 54 | 56 | 58 | 60 |
| of which: public-filing profiles | (s) | 0 | 0 | (s) | 0 | 0 | 0 | 0 |
| largest single profile's share of strict G3 | (s) | (s) | (s) | (s) | (s) | (s) | (s) | (s) |
| partial: tagged link or external referrer | ≥ 18 | 60 | 62 | ≥ 21 | 66 | 68 | 70 | 72 |
| self-views removed (signed in) | 0 | 0 | 0 | 0 | <5 | 0 | 0 | 0 |

The concentration row reads `(s)` because the input has no `top`. The facts read `2026-W43, Oct 19–25`, `address cap:
not live (not shown live: …)`, the flag line, and `internal accounts: not removed (READOUT_INTERNAL_HANDLES is
unset).` The engineer checks these figures against the build and records any difference with its reason in the QA
log.

## 4. Data model

**Additive schema** (`db/schema.sql`, a new block after `view_drops`):

```sql
-- F-31 (docs/features/F-31-readout-limits-and-partial-rows.md): per UTC day, which kinds of client-address check the
-- view beacon met. trusted = the address came from a trusted proxy header, so the per-address rate cap ran; false = no
-- trusted address, so the cap was skipped. Written at most once a day per kind per server instance
-- (lib/views.ts#markCapDay). No address, user agent, user id or count. Read only by scripts/f15-readout.ts; purged after
-- VIEW_RETENTION_DAYS with view_rollup (lib/privacy-purge.ts).
create table if not exists view_cap_days (
  day date not null,
  trusted boolean not null,
  primary key (day, trusted)
);
```

A week is **live** iff some day of it has `trusted = true` and no day has `trusted = false`. Weeks before the deploy
have no marks and read "not shown live", so nothing is guessed. On Vercel, `clientIp` reads `x-real-ip` (`VERCEL=1`),
so the marks are `true` from the first deploy. Local dev writes `false`, which is correct.

Presence marks are used instead of a count. A per-beacon count would make one hot row per day for every beacon, and it
would be a new number needing suppression. Presence answers live or not live, which is all the decision needs.

**Privacy map** (`lib/privacy-retention.ts`, one additive entry after `view_drops`):
`view_cap_days: { personal: false, retention: 'short', holds: 'per UTC day, whether view beacons were checked with and/or without a trusted client address (a day and a flag; no address, user agent, user id or count); purged after 120 days' }`

**Purge** (`lib/privacy-purge.ts`): add a third entry to the `views` steps array, counted in `r.views`, and a comment
line in the header list:
`async () => full((await conn\`delete from view_cap_days where ctid in (select ctid from view_cap_days where day < ${now}::date - ${VIEW_RETENTION_DAYS}::int limit ${batch})\`).count)`.
No `lib/delete.ts` change is needed, because the table has no user id.

**Writer** (`lib/views.ts`, additive exports):
- `addressTrusted(h: Headers, env = process.env): boolean` → `clientIp(h, env) !== null`. It is the same rule the cap
  uses, so the mark can't disagree with the cap.
- `markCapDay(trusted: boolean, now = new Date()): Promise<void>`: an in-memory memo `{ day, kinds:Set<boolean> }` keyed
  by the UTC day. On a miss it runs `insert into view_cap_days (day, trusted) values (${now}::date, ${trusted}) on
  conflict do nothing`, the same `::date` cast as `recordView`, and adds the kind to the memo after success. That is
  at most 2 writes per instance per day.

**Route** (`lib/views-route.ts`, additive): `BeaconDeps` gains optional `markCap?: (trusted: boolean) => Promise<void>`
and `trusted?: (h: Headers) => boolean`. Right after `const limit = …` (a parsed beacon, before the `over` return) the
route runs:
`if (deps.markCap) try { await deps.markCap((deps.trusted ?? addressTrusted)(h)); } catch (e) { console.error('view cap mark failed', logSafe(e)); }`.
Its own try/catch means a failed mark never loses the view, and the error line carries no address.
`app/api/views/route.ts` adds `markCap: markCapDay` to the deps. Injected tests that omit `markCap` are unchanged and
don't touch the database.

**Input types** (`scripts/f15-readout.ts`, all optional, so old inputs still build):
- `RollupRow` + `filer?: boolean; internal?: boolean` (ignored by `keyOf`, so base keys are unchanged)
- `SharerRow` + `internal?: boolean` (ignored by `g2Cells`)
- `ReadoutInput` + `top?: { week: Day; n: number }[]`, `cap?: { day: Day; trusted: boolean }[]`,
  `internal?: { state: 'unset' | 'none-valid' | 'set'; ignored: number }`. A missing `internal` means `unset`.

buildReadout never receives a handle string.

## 5. Loaders (never selecting id, handle, return or filing name)

- `loadRollup(sql, from, to, onlyUsers?, internal: string[] = [])` adds two select items and groups by 1–8:
  `(r.user_id is not null and u.public_filer_id is not null) as filer`,
  `(r.user_id is not null and u.public_filer_id is null and u.handle = any(${internal}::text[])) as internal`.
  The handle appears only inside a comparison with a bound parameter. The output column is a boolean.
- `loadG2(sql, to, retentionDays, onlyUsers?, internal: string[] = [])` adds
  `coalesce(bool_or(u.public_filer_id is null and u.handle = any(${internal}::text[])), false) as internal` and maps
  it into each trader row.
- **new** `loadTop(sql, from, to, onlyUsers?)` → `{ week, n }[]`:
  ```sql
  select to_char(p.wk, 'YYYY-MM-DD') as week, max(p.n)::int as n
  from (select date_trunc('week', r.day)::date as wk, sum(r.n) as n
        from view_rollup r join users u on u.id = r.user_id
        where r.day between ${from}::date and ${to}::date
          and r.surface = 'profile' and r.ref_class = 'external' and not r.self_view
          and u.deleted_at is null and not ${demoUser(sql, sql`r.user_id`)}
          ${onlyUsers ? sql`and r.user_id = any(${onlyUsers}::int[])` : sql``}
        group by 1, r.user_id) p
  group by 1
  ```
  This uses the same filters as the strict cell. `user_id` is grouped by, never selected. Postgres `date_trunc('week')`
  is the ISO Monday that `weekIndex` expects.
- **new** `loadCapMarks(sql, from, to)` → `select to_char(day, 'YYYY-MM-DD') as day, trusted from view_cap_days where
  day between ${from}::date and ${to}::date`.
- `main`: the G1 subquery `select u.id, bool_or(...) as connected … group by u.id` becomes
  `select bool_or(c.state = 'connected') as connected … group by u.id`. `u.id` was unused, so the output is
  identical, and the source scan can apply to every depth.

## 6. Env variable

`READOUT_INTERNAL_HANDLES`: a comma- or whitespace-separated list. It is read only in `main` of
`scripts/f15-readout.ts`, through an exported pure parser `parseInternalHandles(raw: string | undefined) →
{ state, handles, ignored }`:
- undefined or blank → `unset`
- otherwise: split on `/[\s,]+/`, drop empties, strip one leading `@`, then `normalizeHandle` (`lib/referral.ts`:
  trim, lowercase, `^[a-z0-9_]{3,20}$`)
- drop invalid entries and `pf_` entries (a public filer is never an internal account), counting them in `ignored`
- dedupe
- zero valid → `none-valid`, else `set`

The handles go only to the loaders as one bound `text[]` parameter. They are never printed or logged, and never passed
to buildReadout. `main` wraps its database part in its own try/catch that prints `logSafe(e)` (class and code, from
`lib/privacy-log.ts`), never `e.message`. That way a driver error can't echo a parameter. The `--out` and argument
errors before the database keep their messages. `.env.example` gains an empty placeholder with a comment (additive):
`# F-31: internal (owner and team) handles for the owner's readout only; set on the machine that runs it, never in the
deploy env, never committed.` then `READOUT_INTERNAL_HANDLES=`. The header comment of `scripts/f15-readout.ts` gains
one usage line.

## 7. States

| State | What prints |
|---|---|
| Empty database | Limits block. Strict 0. `of which` 0 / 0. Concentration `—`. Self-views 0. Tagged 0. Cap `not live (not shown live …)` with the flag in every week. |
| Only Demo data | Same as empty, except the two existing invite rows. Demo traders and fixture filers are in no new row (the `demo` predicate applies to every atom and to `loadTop`). |
| One new trader with ≥ 5 strict views and nothing else | Pair `n` / `0`. Concentration `100%`. Intended: this is exactly "one profile carries the gate". |
| Small week (S of 1 to 4, or S not exact) | Every family row `(s)`. Strict prints as today. |
| Weeks before F-31 deployed | Cap `not live (not shown live …)`. The rows still print. |
| Env set, all entries invalid | `internal accounts: not removed (… lists no valid handle)`. No internal rows. |
| Database error | No file is written. One `logSafe` line on stderr. Exit 1. |
| Signed out, loading, all losses | Not applicable: an owner-run script with no returns. |

**Accessibility.** The output is markdown text. Every meaning is in words, nothing relies on colour or symbols, and the
symbols the readout uses (`<5`, `(s)`, `≥ n`, `—`) are explained in the existing legend line and the new note lines.
Row labels make sense on their own when a screen reader reads a row.

## 8. Tests: one per acceptance criterion (all new files)

- **AC1** `scripts/f31-readout.db.test.ts`, test `F-31: a real-filer view and a trader view print both "of which" rows;
  strict G3 equals today's value`. It sets up fictional users: one broker trader (`f31t…`) and one non-demo filer
  (`public_filers` with `demo = false`, a `users` row `pf_f31…` with `public_filer_id`). It uses a far-past window, as
  `f15-readout.db.test.ts` does, with `onlyUsers`.
  - (i) One external profile view each. The strict cell prints `<5`, the value the pre-F-31 rule gives for S = 2.
    Both rows are present and read `(s)`.
  - (ii) 7 trader and 9 filer views. The strict cell prints `16`, trader `7`, filer `9`. A third run without
    `internal` checks that the strict row's cells match the strict row built from `loadRollup` rows with
    `filer`/`internal` stripped.
  - Cleanup deletes the users and the filer.
- **AC2** `scripts/f31-readout.test.ts`:
  - (a) Exhaustive, at family level. For S in {0} ∪ 5..24, every split a + b + c = S, internalSet in {false, true},
    and top in {null} ∪ every (holding atom x, 1 ≤ M ≤ x): group `strictFamily` outputs, with a printed percent
    replaced by M exactly as the worst case. In every group, assert that no protected quantity takes a single value
    in 1..4. The protected quantities are every non-empty subset sum of {a, b, c}, and `U − M` for every subset U
    holding x.
  - (b) buildReadout prints exactly `strictFamily` for exact weeks and `(s)` for non-exact weeks.
  - (c) Weekly and cumulative cross-table cases:
    - filer 3 inside an exact strict 60: no `57`, `3` or `≥ 57` anywhere
    - internal 2: the internal row reads `(s)`
    - S − M = 4: the concentration reads `(s)`
    - a self-view 2 in one week, with no total anywhere
    - tagged-or-ext against strict, the profile row and "all" when an `oth` cell is hidden: no hidden value is
      recoverable
  - (d) Structure: the G3 header has no `Total` column, and no printed row sums family rows over weeks.
- **AC3** `scripts/f31-readout.test.ts`: `LIMIT_LINES` and the three fact-line variants are pinned as literals.
  The block is present and its index is before `## G1` for empty input, the baseline, env unset and env set. There
  are no box-drawing characters (U+2500–U+257F) and no ANSI escapes anywhere in the output.
- **AC4** `scripts/f31-readout.test.ts`:
  - no cap marks: every `address cap` cell reads `not readable as a gate: address cap not live`, the flag line is
    present, and the strict row's cells equal the same input's cells built with all-trusted marks
  - all-trusted marks: `live` and `address cap: live`
  - a week with both kinds: not live
  - DB part in `f31-readout.db.test.ts`: `markCapDay` writes one row and the second call writes none (memo),
    `loadCapMarks` reads it back, and `purgePrivacy({ only: ['views'] })` removes a mark past the bound. These use
    far-past days.
  - Route part in `f31-readout.test.ts` with injected deps: a bad body doesn't call `markCap`, a beacon calls it once
    with the injected `trusted`, and a throwing `markCap` still records the view and answers 204.
- **AC5**: pure part in `f31-readout.test.ts`; DB part in `f31-readout.db.test.ts`.
  - Pure:
    - `parseInternalHandles`: blank → unset; `' @F31_a , f31b,, x , pf_f31c '` → set, `['f31_a', 'f31b']`, ignored 2
    - unset → `internal accounts: not removed (READOUT_INTERNAL_HANDLES is unset).` and no internal rows
    - set → both rows with values
  - DB: run `main` as a subprocess (`node scripts/f15-readout.ts --out <os tmpdir>`) with
    `READOUT_INTERNAL_HANDLES` naming two fictional users, one of them connected, with views in the last complete
    week. Assert both rows are present in the file, and that neither handle appears in the file, stdout or stderr.
- **AC6** `scripts/f31-readout.test.ts`: profiles of 30 + 10 → `75%`; M = 4 → `(s)`; S − M = 3 → `(s)`; S = 0 → `—`;
  ids, handles and returns put on extra input fields never reach the output. DB part in `f31-readout.db.test.ts`:
  `loadTop` with two fictional profiles returns rows whose keys are exactly `['week', 'n']` with the larger sum.
- **AC7** `scripts/f31-readout-scan.test.ts`: read `scripts/f15-readout.ts` and replace each `${…}` with a placeholder.
  For every `select` at every depth, split its list at top-level commas up to the matching `from`. Fail on any of:
  - a bare or qualified `id`, `user_id`, `handle`, `display_name`, `return_pct` or `filer_key`
  - an alias equal to one of those
  - `*` or `x.*`
  - `array_agg`, `string_agg`, `json_agg`, `jsonb_agg`, `json_build_object`, `row_to_json` or `to_json[b]`

  `select 1` is allowed. The test also covers the scanner: bad snippets must fail, and
  `(u.handle = any($1)) as internal` must pass. The same file adds an isolation check: outside tests, only
  `lib/views.ts`, `lib/views-route.ts` (none expected), `lib/privacy-purge.ts`, `lib/privacy-retention.ts`,
  `scripts/f15-readout.ts` and `db/schema.sql` name `view_cap_days`, and no `app/` file does.
- **AC8** `scripts/f31-readout.test.ts`: `buildReadout(baseInput(), BASE_NOW)` with the env unset. The test asserts
  that the output is `BASE_TEXT` plus inserted lines only: every `BASE_TEXT` line appears in order, and every extra
  line is either a limits-block line or a row whose label is in the exported `F31_ROW_LABELS`. Every label and every
  note constant must actually appear, so the test can't pass by stripping nothing.

The existing tests stay unchanged, and their count only grows. `lib/privacy-retention.test.ts` covers the new
`SCHEMA_MAP` entry.

## 9. Owner and business-lead points

1. **Owner, open question 2 (address-cap source).** This plan builds the stored marks (D2). If the owner picks a
   deploy setting instead, the readout can't read the production setting from the owner's machine and would be
   trusting a local value. The facts line would then have to say "as set on this machine". Recommendation: the
   stored marks.
2. **Owner, open question 1 (MRC2-3).** Not needed for the build. The strict row is unchanged, and line 6 of the
   limits block says the call is the owner's.
3. **"Under each G3 row"** (D9): read as the strict G3 row. The business lead confirms this, or the owner widens it.
   If it widens, each extra row needs its own family and its own exhaustive test.
4. **Solo-owner G1 internal row reads `(s)`** (§3.4). The owner should know before setting the env.
5. **Feature status**: the start conditions are met on main (1eab2ef). The owner or the pipeline flips `Status`.

No counsel item, no secret, no new dependency or vendor. Nothing here waits on a hard stop.

## 10. Shared files (additive edits; other sessions edit in parallel)

`scripts/f15-readout.ts` (this feature's slot: new constants, rows, loaders and optional params; one
behaviour-neutral subquery edit), `lib/views.ts` (+2 exports), `lib/views-route.ts` (+2 optional deps, one guarded
call), `app/api/views/route.ts` (+1 dep), `db/schema.sql` (+1 table block), `lib/privacy-retention.ts` (+1 entry),
`lib/privacy-purge.ts` (+1 step, +1 comment line), `.env.example` (+2 lines). New files: the three tests in §8. No
protected path is touched.

## 11. Rollout

One PR. `vercel-build` applies the schema (`create table if not exists`). After the deploy, beacons start marking
days. The first complete week after the deploy is the first that can read `live`. Before that the readout says `not
live (not shown live …)` and flags the strict row. The owner sets `READOUT_INTERNAL_HANDLES` only in the local `.env`
used to run the readout. Nothing changes for traders or viewers. The beacon's response, timing and body are unchanged,
apart from at most two inserts per instance per day.

## 12. COMPLIANCE Section 1

1. **Performance shown, ranked or described?** No. View counts only, owner-only, no return. The readout already
   prints no return, and the source scan bans `return_pct`.
2. **Personal data?** Yes (Section 3).
   - Read: `view_rollup`, with trader ids summed away. The new `filer` and `internal` flags are booleans, and the top
     profile is grouped by id but never selected.
   - New table `view_cap_days`: a day and a flag, no personal data, `personal: false`, purged after 120 days with the
     rollup.
   - The internal-handles list lives only in the env on the owner's machine. It is bound as a SQL parameter and never
     printed, logged, committed or passed to the text builder.
   - The output stays outside the repo (`resolveOut`), mode 0600. Small-cell rules cover every new count (POLICY P3).
3. **Money?** No.
4. **Email, push, SMS or tracking?** No new tracking. The first-party beacon gains one memoized write. Nothing new is
   read from the viewer: the flag is derived from the same in-memory address check the cap already does, and the
   address is never stored. No third party.
5. **User-written text?** No.
6. **Sign-up, age, identity?** No.
7. **Vendor, dependency, font or copy?** No.
8. **Screen reader or no mouse?** Yes: plain text, meaning in words, no colour or box-drawing (decided; AC3 test).
9. **Security posture?** `/api/views` gains one bounded write on an existing path. No new input is accepted. Errors
   are logged by class and code only. `READOUT_INTERNAL_HANDLES` is not a secret, but it is treated as private: an
   empty placeholder in `.env.example`, a value never set in the deploy env.
10. **Claims?** None outward. The block makes the readout claim less: "not verified figures" is about view counts
    and doesn't touch the product's "Verified" meaning, which is about trades.
11. **Checkout?** No.
