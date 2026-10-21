# Spec: My record: personal rules and adherence (#68)

Variant: **single** · Spec agreed by designer and business analyst

## Agreed spec

# Spec: My rules — set up to two personal rules on /me/record and see how your closed trades measured up

## User story
As a connected trader viewing my private `/me/record`, I set up to two rules for myself ("close losers within N days", "hold winners at least N days") and see in plain numbers how many of my closed trades followed each. Descriptive only. No advice, no streaks, no public surface.

## Data
Add to `db/schema.sql` (additive, idempotent, no drop/delete/truncate), placed after `trade_reflections`:

```sql
-- Private personal rules. USER-SUPPLIED, not derived: never rebuild it with closed_trades and never delete it in rebuildTrades.
-- Stores a kind and a day count only: no quantities, no prices. Private to the owner; never read by public pages, the feed or the share card.
create table if not exists trade_rules (
  user_id int not null references users on delete cascade,
  kind text not null check (kind in ('cut_losers', 'hold_winners')),
  days int not null check (days between 1 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);
```
The unique key (user_id, kind) caps a user at two rules (one per kind). Also update the header comment at schema.sql line 3 to mention `trade_rules` next to `trade_reflections`.

## lib/rules.ts (pure, no imports from db/next; imports `MIN_TRADES` from `./insights.ts`, `pct` if needed)
`RULE_KINDS`, `RuleKind`, `Rule`, `RULE_LABEL`, `isRuleKind`, `checkRule`, `ruleAdherence`.

`checkRule` behavior (one generic error `'Not allowed'` for every rejection, so nothing leaks):
- `userId === null` → rejected (non-owner / signed out).
- `kind` not in RULE_KINDS → rejected.
- If `clear` is true → `{ ok: true, kind, days: null }`, the days value is ignored.
- `days` may be a number or a numeric string from FormData. Accept only a string matching `/^\d{1,3}$/` or a JS integer number; it must be an integer 1..365. Reject 0, 366, negatives, "1.5", "", "abc", NaN, Infinity, "1e2", " 7 ", and null/undefined.

`ruleAdherence(trades, rules)`:
- applicable: cut_losers → returnPct < 0; hold_winners → returnPct > 0. returnPct === 0 counts as neither.
- followed: cut_losers → holdingDays <= days; hold_winners → holdingDays >= days (a hold of exactly N days follows both).
- enough: applicable >= MIN_TRADES (5); otherwise share and takeaway are null.
- Output in RULE_KINDS order, only kinds present. Duplicate kinds: last wins.
- Takeaways (descriptive): `"{followed} of {applicable} losing trades were closed within {days} day(s)"` / `"{followed} of {applicable} winning trades were held at least {days} day(s)"`. Neutral wording; no advice words.

## Server action (app/actions.ts) — `setRule(form: FormData)`
- `currentUser()`; no user → `redirect('/login')`.
- Read `kind`, `days`, `intent` ('set' | 'clear'); validate with `checkRule`; throw `Error('Not allowed')` on rejection.
- Set: upsert on `(user_id, kind)`. Clear: delete the user's own row.
- `revalidatePath('/me/record')` only.

## Page (app/me/record/page.tsx)
Section "Your rules" after "Your reasons". Two cards always visible (one per kind): not set (days input + "Set rule"), set with enough data (big share figure, `x of y`, takeaway, Update/Clear), set without enough data ("too few trades to say", applicable count). Plain forms, no JS needed, neutral styling for kept and broken rules alike.

## Product rules compliance
- No streaks, badges, notifications, confetti, points or comparison with other users.
- Nothing about rules in feed, `app/u/**`, OG image or `/api/*`; `lib/rules.ts` imported only by `app/me/record/page.tsx` and `app/actions.ts`.
- No quantities or prices stored. `closed_trades` and theses untouched.

## Tests
`lib/rules.test.ts` covers `checkRule` (rejections, accepted values, clear) and `ruleAdherence` (no rules, empty trades, 4 vs 5 applicable, boundaries, zero return, ordering, singular wording, no advice words). E2E: signed out redirects; owner sets and clears a rule; public profile does not contain "Your rules".

## Out of scope
Protected paths, alerts, reminders, emails, advice wording, other rule kinds, free-text rules, any public display, changes to `closed_trades`, theses or public pages.

## Measure
Count of users with ≥1 `trade_rules` row ÷ count of users with `record_first_viewed_at` set, read from the DB.

## Designer ⇄ business discussion

**Designer:** Adds a private "Your rules" section to /me/record: two fixed rule kinds with N days 1–365, a user-supplied trade_rules table, pure checkRule and ruleAdherence, and a setRule server action. Fewer than 5 applicable trades shows "too few trades to say".

**Business analyst (approved):** Good ease of use; strongest retention hook on this line; no virality by design (private). Optional polish: grep check for imports of lib/rules.ts, a line explaining the inclusive boundary, deterministic E2E for the too-few branch, generic error from setRule.

## QA log

| Round | By | Result | Findings |
|---|---|---|---|
| 1 | checks | ✖ fail | E2E failure in first run (fixed in later rounds) |
| 2 | tester | ✅ pass | [note] heading reads "within 1 days" at days=1 (cosmetic) · [note] one form with Update/Clear instead of separate Change form (equivalent) · [note] Playwright not run by tester |

## Cost

7 role calls, $0.98 total.
