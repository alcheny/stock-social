# F-15 second half: QA (tester, 2026-11-01)

Branch `claude/f15-second-half` against the running production build (localhost:3000), shared DB (own rows only, removed after).

## Criterion → test
| # | Criterion | Test | Result |
|---|---|---|---|
| S1 | One row per share action, UTC day | `lib/f15-share-action.db.test.ts` (rows; UTC under another TZ) | pass |
| S2 | Deleted with the profile | same file, `deleteProfile` | pass |
| S3 | Exact column allow-list | same file | pass |
| S4 | Closed values; story only for a profile picture | `lib/f15-share-action.test.ts` | pass |
| S5 | Owner only | unit + db + `e2e/f15-share-action.spec.ts` (card, recap, trade, month; viewer, signed out) | pass (prompt: source check only, no e2e) |
| S6 | Server-side sign | db test (headline stats, none states) | pass |
| S7 | Cap 20/day, 25 concurrent | db test | pass |
| S8 | Old columns keep meaning | `e2e/f15-share-action.spec.ts` (trade_shared_at only on trade) | pass |
| S9 | Purge 120 days | `lib/f15-purge.db.test.ts` | pass |
| S10 | No page names the table | `lib/f15-isolation.test.ts` | pass |
| S12 | G2 readout, suppression | `scripts/f15-readout.test.ts` (incl. random sets) | pass |
| B1 | Beacon in layout, template gone | isolation test + `e2e/f15-beacon-human.spec.ts` (segment change, focus order) | pass; plan case 2 (scroll restored on back) not written |
| C1 | Canonical | `e2e/f15-canonical.spec.ts` | pass; misses the cases in bug 1 |

Runs: node tests 40/40 pass; e2e `f15-*` 18/18 pass.

## By hand
- Forged `recordShareAction` (captured action id, replayed): another trader's path, uppercase handle, trailing slash,
  `..`, `%2F..`, absolute URL, bad month, picture on a trade path, bogus outcome: 0 rows; another trader got 0 rows.
  Own path with `?via=`/`#`: 1 row (expected).
- 25 rapid taps on "Share my record": 20 rows. Month page owner share: 1 `month` row, `trade_shared_at` untouched.
- Canonical: `?via=card&via=trade`, `?VIA=x`, trailing slash → untagged canonical; no `og:url`; 404 profile, month
  (2099-01, garbage), trade (nope), uppercase handle: no canonical. Sell ids with space, `/`, `?`, `#`, `+`, `é`: one
  spelling, equal to the Share link minus `?via=`.
- Readout G2 with 1, 3, 5, 6, 7, 8 of 8 strict traders sharing (rows created, then deleted): no 1-4 count printed or
  derivable from the rows.

## Findings
1. **bug** (C1). The trade page's metadata and page body decode the sell id differently (each runs `decodeSellId` on a
   param this Next version hands them in different forms). (a) A sell id with `%` (e.g. `u3%y` at `/trade/u3%25y`):
   200, trade shown, but no canonical, generic title and no description. (b) A double-encoded address
   (`/trade/u7%25C3%25A9` for `u7é`): 404 status, but the head carries the trade's title and a canonical to the real
   trade. Same root cause as before this branch (title/description), new for canonical. Fix: build the canonical (and
   title) from the loaded row's stored sell id, and decode the param the same way in both, with a test for both cases.
2. **note** (S5). An owner's forged path to a trade or month that does not exist (`/u/me/trade/anything`,
   `/u/me/month/1999-01`) writes a `trade`/`month` row. Own record only, capped, not in the strict G2 row.
3. **spec** (B1). Plan §3 case 2 (feed scroll offset restored within 1 px after back from a profile) has no test; the
   existing feed test only checks the beacon firing in place.
4. **note** (S5). The share prompt's row is covered by a source-level unit check only; no new trader in the walkthrough
   saw the prompt, so no e2e reaches it.
