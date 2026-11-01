# Known limits 2: committee record (2026-11-01)

Session: `claude/known-limits-2`, started by the owner's orchestrating session to resolve the next batch of `ponytail:`
known limits (owner: "ponytail skills should be used everywhere"). Follows `claude/known-limits` (#52). One engineer
subagent per item planned and built in parallel; a fresh-context reliability reviewer and the business lead signed the
plans; then tester QA and an independent code review on the combined diff. Open questions are decided by the
committee's recommended option; product questions go to the owner.

## Scope

| # | Item | Where |
|---|---|---|
| 1 | Display log snapshots one trader at a time in a 20 s box | `lib/display-log.ts` |
| 2 | Billing reconcile unboxed; a processor 409 for an in-flight idempotent customer create fails the checkout | `lib/billing.ts` |
| 3 | Tick loops and the attempt sweep start from the lowest id (starvation); the sweep is unlimited | `lib/connections.ts` |
| 4 | Similar-traders pool per process, rebuilt every 10 s, each request sorts the whole pool | `lib/similar.ts` |
| 5 | Own follow / hidden / expired-hide lists unpaged; referral names past 20 cut silently | `lib/follows.ts`, `/me/following`, `app/tools/page.tsx`, `app/u/[handle]/referral-feedback.tsx` |
| 6 | A profile view reads the record 3–4 times | `app/u/[handle]/page.tsx`, `record-card-data.ts` |
| 7 | Five missing indexes | `db/schema.sql`, `lib/delete.ts` |
| 8 | Privacy purge clearing and marking steps walk whole tables each tick | `lib/privacy-purge.ts` |
| 9 | Sitemap count cached per server; every chunk groups closed_trades and pages by offset | `lib/sitemaps.ts` |
| 10 | `lib/feed.ts` limits: full-pass fallback and the notes beside it | `lib/feed.ts` |

## Plan reviews (fresh context)

Business lead: all ten approved, eight with demands; all ten are fixes (no three-variant process). Cuts: the feed
plan's trigger on activity inserts (a second, hidden writer to the derived `closed_trades`; the case is unreachable
today) and the sitemaps plan's new `closed_trades (symbol collate "C") include (...)` index (write cost on every
rebuild for a request crawlers make a few times a day). Copy fixed for item 5.

Reliability reviewer: none blocked, seven with blocking demands. Main ones: purge must not loosen
`lib/likes.test.ts` (window over the `trade_key` hash range instead, a window that shrinks after a timeout, a separate
progress flag for due marks); billing pass writes fenced by a lease token, the box checked per subscription, grace
expiry and the event purge once per due day whatever the pass state; feed exploration picks driven from users in md5
order with a capped eligibility probe, and equivalence fixtures with eligible traders whose closes are all old; profile
tests without React internals, card equality including close order; similar pool writes fenced on the claim, a capped
cold wait; lists cursors built like `ownLikes` (no `to_timestamp(double)`); indexes: a test of the `lib/delete.ts`
rewrite including an identity with an empty email.

## Decisions

- 2026-11-01 · Purge: `trade_key` hash-range windows over the existing key indexes; `lib/likes.test.ts` unchanged.
  Why: the reliability path needs no test change (the business lead allowed one exact extra form; not needed).
- 2026-11-01 · Feed: no trigger on activities; the note at the same-vendor-id case stays, made precise. Why: both
  reviewers (derived table is never patched; cross-user write outside the per-user lock).
- 2026-11-01 · Sitemaps: no new index; range reads on the existing `closed_trades_symbol` index. Why: both reviewers.
- 2026-11-01 · Similar: the per-request bucket walk ships; the shared pool table only if a cold build is slow enough
  to justify it (business lead: ~150 ms). Why: business lead's "what would change my mind".
- 2026-11-01 · Billing: the engineer ships the boxed reconcile only if it meets every blocking demand; otherwise the
  409 fix alone and a precise note. Why: business lead's fallback.
- 2026-11-01 · Indexes go through `schema_add_index` (not `create index if not exists`, which `lib/schema.test.ts`
  forbids: it takes a table lock before noticing the index exists). Why: the file's rule.
- 2026-11-01 · Feed's 350-card day list is a product question for the owner (it decides who appears); its note is made
  precise only. Why: business lead.
