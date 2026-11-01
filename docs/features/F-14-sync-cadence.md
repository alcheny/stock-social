# F-14 · Sync cadence within the vendor's guidance

Status: ready

## Why
The hourly cron reads activities and positions for every account on every round (`lib/sync.ts`, `ROUND_MS`). Once it
is switched on with real accounts, that is about 24 times the vendor's guidance for activities and 6 times for
positions. The vendor can end access at will, and it is the only data source behind every Verified record (market
research council, §11 T2 and §13 #2). Approved by the approval council (`docs/ideas/approval-2026-11-01.md`, C19:
second-vote mean 3.80, final vote 15/15).

## Decisions
- 2026-11-01: Per account, activities are read at most once per 24 hours and positions at most 4 times per day. A
  per-account timestamp is checked before each vendor call and stored in additive columns. Why: approved by the
  approval council; the vendor's polling guidance.
- 2026-11-01: The first sync after a connection (`/connect/done`) is never throttled, so a new trader sees the record
  at once. Why: approved by the approval council; the red team's abandonment case.
- 2026-11-01: A failed vendor call does not advance the throttle timestamp. A missing or null timestamp means "sync
  now", so a column or clock bug can never freeze records silently. Why: approved by the approval council (reliability).
- 2026-11-01: The hourly cron, `/connect/done` and the 7-day re-read stay as they are. Only the per-account gate is new.
  `vercel.json` and the deploy cron are not changed. Why: approved by the approval council (decisions keeper; legal:
  deploy settings are the owner's).
- 2026-11-01: Built inside the running sharded-sync session, which owns `lib/sync.ts` and `app/api/sync/**`, not by a new
  session. It ships with or after F-11's freshness line, so slower records say how fresh they are. Why: approved by the
  approval council; file ownership in the coordination map.
- 2026-11-01: Broker accounts only. F-7 public sources are outside this feature. Why: the decisions keeper's F-7
  interface condition.
- 2026-11-01: CLAUDE.md and DESIGN §2.7 describe an hourly sync. After this feature the cron is still hourly, but each
  account is read within the caps above. Those doc edits go to the owner (protected paths). Why: legal; CODEOWNERS.

## Acceptance criteria
- [ ] A test with the vendor fake counts at most 1 activities call and at most 4 positions calls per account per
      24 hours across 24 hourly rounds.
- [ ] A test shows the first sync after `/connect/done` calls the vendor immediately, whatever the timestamps say.
- [ ] A test shows a failed call leaves the timestamp unchanged, so the next round retries, and that a null timestamp
      syncs.
- [ ] The 7-day re-read window and the existing sync tests still pass. The total test count does not drop.
- [ ] `db/schema.sql` changes are additive and idempotent, and `vercel.json` is unchanged.
- [ ] Logs carry no account ids together with user ids (POLICY P6), and no new log fields hold personal data.
- [ ] Merges after (or with) F-11.

## Out of scope
- Changing the cron schedule or deploy settings (owner), webhooks, and any F-7 source.

## Open questions
- None from the council. The exact guidance figures were checked by the market research council (FC-M18, FC-K8). If
  the vendor's written answer (MR-1) gives different caps, the constants change and this file gets a dated decision.

## Rework notes
