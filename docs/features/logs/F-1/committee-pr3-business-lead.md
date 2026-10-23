COMPLIANCE: PASS · USABILITY: DEMANDS

# F-1 · PR-3 committee · Business lead

2026-10-23. Build of `81e79ec`, 375×667, light and dark. Fake vendor at 2.5 s per page; 4 accounts × 2,500 seeded
activities plus 1 simulated. One sync via the test hook, own trader only. Cleaned up.

## User test

- **Import.** Consent to "Import finished." in 67 s. 10,000 activities, 4,743 closes and 89 excluded, all equal to the
  pure matcher. No layout shift.
- **The wait.** The headline read "0 closed trades so far" for 58 of the 67 s. Only the grey line moved ("1000 … 10000
  activities imported"). I stayed, but the headline looks stuck. No thousands separators.
- **Visitor during the import.** "Importing this record", no Verified badge, no stats, not in the feed; disclaimer
  present.
- **Visitor after.** Correct, but all 4,744 rows render: 6.4 MB HTML (510 KB gzipped), 0.9–1.3 s to first byte on
  localhost.
- **Feed.** `/` returns **500** (`value out of range: underflow`) whenever any close is older than about 4.1 years:
  the recency term `exp(-hours/48)` underflows (`app/page.tsx:16,21`). TR-3 guarantees such closes.
- **Hourly sync.** 10.6 s at 2.5 s per page against 0.44 s at zero latency. A same-round repeat cost 1 ms.

## Compliance: PASS

Nothing partial is Verified or ranked while importing. Disclaimers present. Generic fixtures; logs carry ids only;
no third-party names.

## Business: the design is right; the promise is not yet proven

The claim design is correct and cheap. But the measured 10× headroom is latency-free: at 2.5 s per page one caller covers about 340 four-account traders per hour, under the 500 target. One
call must also fit one function duration, and none is set. The :30 boundary only bites a call over 30 minutes; demand 3
rules that out.

## Demands

1. **Blocker, this PR: feed underflow.** Clamp the recency term. *Verify:* a test with a close dated 2015 renders `/`
   with 200 and ranks that close last; fails today.
2. **Before Status: built: page the visitor profile.** The 50 newest closes, then "Show more", with stats over the whole
   record
   (not hiding, TR-1). *Verify:* heavy-record profile under 300 KB HTML; every close reachable.
3. **Before Status: built: coverage under real latency.** Give `syncTick` a deadline below the route's `maxDuration`
   (export it on `/api/sync` and `/api/import/step`, above `VENDOR_TIMEOUT_MS` with margin). The owner sets the cron
   to every 5 minutes, never at :30 (amends #7). Log traders unclaimed at round end. *Verify:* 3
   traders and a deadline that fits 1: three calls in one round sync each exactly once; a unit test asserts the
   timeout is below each route's duration.
4. **Before Status: built: request #13 answered.** Until then, any PR that touches `lib/sync.ts`, `lib/connections.ts`,
   `lib/trades.ts` or `lib/broker.ts` attaches a `LOAD=1` run. Add heavy-record feed and profile renders to the suite.
5. **Taste (UX lead):** during the import, lead with the moving count, and format numbers with separators.

## Demo sentence

"Ten thousand trades, five accounts, one minute: the whole record, losses included."
