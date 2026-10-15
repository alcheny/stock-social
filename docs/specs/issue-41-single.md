# Spec: Test thesis moderation rules and thesis re-attachment

Variant: **single** · Spec agreed by designer and business analyst

## Agreed spec

# Spec: tests for thesis moderation and thesis re-attachment (issue #41)

Type: test/chore. No UI change, no schema change, no protected paths. No Postgres needed (say so in the PR).

## 1. `lib/moderation.ts` (new)
```ts
export const HOLD: RegExp[] = [ /* the 8 regexes copied byte-identical from app/actions.ts */ ];
export type ThesisStatus = 'held' | 'published';
export function moderate(text: string): ThesisStatus {
  return HOLD.some((r) => r.test(text)) ? 'held' : 'published';
}
```
- Regexes are moved verbatim, in the same order, with the same flags. Keep the comment "Hold, never silently drop" (DESIGN §2.8).
- No `g` or `y` flags. If a future rule adds one, the idempotence test fails.
- `moderate` is pure. It does not trim or truncate. `saveThesis` keeps doing `.trim().slice(0, 280)` before calling it.
- No `enum`. Use `.ts` import extensions.

## 2. `app/actions.ts`
- Delete the inline `HOLD`. Add `import { moderate } from '../lib/moderation.ts';` (match the existing import style in that file).
- `const status = moderate(text);`. Everything else is unchanged. This includes the empty-text case: `thesis_status` stays null when `text` is empty, so `moderate('')` is not consulted for storage.
- Do not export anything new from this `'use server'` file.

## 3. `lib/theses.ts` (new, pure)
```ts
export type KeptThesis = { sell_id: string; thesis: string; thesis_status: string | null };
export function reattachTheses<T extends { sellId: string }>(
  kept: KeptThesis[], trades: T[],
): { attached: Map<string, KeptThesis>; orphaned: KeptThesis[] }
```
- `attached` is keyed by `sell_id`. It contains only theses whose `sell_id` matches some `trades[].sellId`.
- `orphaned` holds the theses whose sell is absent from the new trades. They are returned, never dropped silently.
- Inputs are not mutated. Duplicate `sell_id`s in `kept`: the last one wins in `attached`, and the earlier ones are not lost silently, so they go to `orphaned`. Document this.
- `thesis_status` is carried through unchanged (`held` stays `held`, so a rebuild never auto-publishes).

`lib/sync.ts#rebuildTrades`:
- Replace the `Map` construction with `const { attached, orphaned } = reattachTheses(kept, trades);`.
- Use `attached.get(t.sellId)?.thesis ?? null` and `attached.get(t.sellId)?.thesis_status ?? null` in the insert.
- If `orphaned.length`, call `console.warn` with the user id and the count (no thesis text in logs).
- Keep the same transaction and statements, so the behavior is otherwise identical. The delete still runs before the insert, and orphans are reported, not persisted. Add a one-line `// ponytail:` note that orphaned theses are lost from the DB once the old rows are deleted, and that the report is the only trace.
- Check the type of `kept` rows (postgres.js `Row`). Cast with `as KeptThesis[]` if needed.

## 4. Tests (node:test, `node:assert/strict`, `.ts` imports)

### `lib/moderation.test.ts`
Table-driven, one entry per rule, with at least one positive and one negative case each:
| Rule | Held | Published |
|---|---|---|
| /guarantee/i | "Guaranteed 10% a month" | "Waited for a pullback" |
| /risk[- ]?free/i | "risk-free trade", "Risk free", "riskfree" | "low risk entry" |
| /can'?t lose/i | "can't lose", "cant lose" | "can lose it all" |
| /\b100x\b/i | "going 100x" | "1000x"; "a 100 x move" is published |
| /to the moon/i | "TO THE MOON" | "moonshot" |
| contact/promo rule | "DM me", "join my group", "link in bio", "t.me/abc", "discord.gg/x", "WhatsApp" | "Admin me on the dashboard" |
| /\b(buy\|load up on) (now\|before)\b/i | "buy now", "Load up on before earnings" | "buy the dip"; "I did buy nowhere" is published |
| /financial advice/i | "not financial advice" | "financial planning notes" |

Also test:
- Held text is returned as `'held'`, never null or undefined, and there is no code path that returns a third value. `moderate` returns only `'held'` or `'published'`.
- Clean text and the empty string are `'published'`.
- Idempotence: for every positive case, call `moderate` twice, then three times in a loop, and assert equal results. A `g`-flag regex would flip on the second call. Also assert `HOLD.every(r => !r.global && !r.sticky)`.
- A snapshot guard: `HOLD.map(String)` deep-equals the literal list of the 8 regex source strings, so an accidental edit is caught. (Intentional rule changes update the test.)
- A mixed-case/multi-rule string is `held`.

### `lib/theses.test.ts`
- A thesis follows its closing sell: kept `{sell_id:'s1',...}` plus trades `[{sellId:'s1'}]` gives `attached.get('s1')` with the same text and status, and `orphaned` is `[]`.
- A rebuild that changes trade order or adds new trades keeps theses attached to the right sell.
- A thesis whose sell is gone is reported in `orphaned` and is absent from `attached`.
- `held` status is preserved (never promoted to `published`).
- Empty kept gives empty results. Empty trades gives all kept orphaned.
- Duplicate `sell_id` behavior as documented. Inputs are not mutated (deep-equal a clone).

## 5. Acceptance criteria
1. `npm test` passes and the test count is strictly higher than on main. No existing test is edited or removed.
2. `npx tsc --noEmit` and `npm run build` pass. `app/actions.ts` exports only async functions.
3. `git diff` shows the regexes moved byte-identical (verify with grep or the snapshot test).
4. `node scripts/autopilot.ts guard main` passes. No `.github/` or other CODEOWNERS paths and no `db/schema.sql` changes.
5. PR body states: "No live Postgres needed. Only the pure re-attachment step is tested; the SQL select/delete/insert in rebuildTrades is untested."

## Screens/states
None. There is no UI, no copy, and no accessibility impact.

## Designer ⇄ business discussion

### Round 1

**Designer:** Extract HOLD and a pure moderate() into lib/moderation.ts and a pure reattachTheses() into lib/theses.ts, wire both back into the action and rebuildTrades, and add node:test suites for each. No DB is needed.

**Business analyst (approved):**
- Ease of use: No user-facing change. For builders and reviewers the spec is easy to follow. Each rule gets a table row with positive and negative cases. The PR wording about Postgres is prescribed. The move into lib/moderation.ts and lib/theses.ts follows the existing lib/ pattern and keeps the 'use server' file valid.
- Retention: Indirect but real. The tests protect the two trust invariants: risky claims are held and never auto-published, and theses survive rebuilds. The spec preserves 'held' status through a rebuild. It adds the g-flag idempotence guard and the byte-identical snapshot guard. These make later moderation edits safe, so the trust the brand depends on holds up as traders come back.
- Virality: Not applicable to this change. The benefit is that shared profiles and cards can't carry hype or promo claims such as 'guaranteed', 'DM me' or 'link in bio'. That keeps a shared link credible. Nothing here conflicts with the product rules, since it adds no UI, no manual trade path and no hiding of losses.
- Feedback: Approved. Three optional notes for the builders, none blocking:

1. Orphaned theses are only logged and are lost once the old rows are deleted. The spec flags this with a `ponytail:` note, which is the right way to record it. A follow-up issue could keep orphaned theses held and visible to their owner, but don't build that here.

2. Make the console.warn log the user id and the count only, with no thesis text. The spec already says this.

3. The edge cases ('a 100 x move' published, 'I did buy nowhere' published) must be checked against the actual regexes before they are asserted. If a regex behaves differently from the table, fix the test and leave the regex alone, because there must be no behaviour change.

## QA log

| Round | By | Result | Findings |
|---|---|---|---|
| 1 | tester | ✅ pass | [note] lib/moderation.test.ts: The spec asked for a ‘no third value’ check and a 3-iteration loop. Both are covered. The rule table is also reused for the idempotence test. No blocking issues. The 74 tests pass, tsc is clean, the build passes, and `guard origin/main` says ok (plain `guard main` fails locally only because there is no local main ref). · [note] lib/sync.ts: The `as unknown as KeptThesis[]` cast is wider than the spec's `as KeptThesis[]`. It is harmless. The PR body must still carry the prescribed ‘No live Postgres needed…’ sentence. |

## Cost

4 role calls, $0.49 total: designer#1 $0.10, business#1 $0.07, engineer#1 $0.23, tester#1 $0.09
