COMPLIANCE: PASS

# F-1 PR-3 · Committee review, round 2 (engineer)

2026-10-23, `b95f281`, Postgres 16. Scratch probes on my own traders; touched files' 95 unit tests pass. No product code changed.

## Verified

- **Clamp:** `lib/feed.ts` holds the only age `exp()`. 1990/1900 closes rank last, no error.
- **`?closes=`:** these never throw, and the query never reads the parameter:
  - `-50`, `0`, `1e309`, `NaN`, `abc`, `0x10`, `[]` give window 1.
  - `0.5` gives window 50.
  - `1e308` and 2^53 give the last window.
  - Chart links fall in 57 windows, max 2850.
- **Log:** counts only.
- **Release:** a failure logs id + message, and the tick continues. The report counts leave it out (Info).
- **`source` keyset:** tested.
- **Formatter:** `-0` and ±1e-9 → `0.0%`; -0.99984 → `-99.98%`.

## Findings

1. **Medium, DEMAND: a future-dated close breaks the feed.** No lower clamp.
   - A `2031-01-02` close gives `value out of range: overflow`, so the whole feed returns 500. The cutoff is >34,070 h ahead.
   - A `2030` close scores 2e253 and pins the top. +1 day outranks all real closes.
   - The vendor date is unchecked.
   - Fix: `greatest(0, least(age/48, 600))`, plus a test.
2. **Low: units can overrun the route.** They start only before 210 s (sync) or 25 s (step), but can then run past the limit. Assuming answers just under 30 s:
   - An n-account sync takes (1+2n)×30 s: n=1 overruns 300 s by ~0.4 s, n=2 by 60 s.
   - The first-sync history path has no page bound.
   - `cleanupAttempts` has no per-row deadline. 10 timed-out rows kill the call before any sync, and no log line is written.
   - The rebuild positions read (noted): n≥2 exceeds 60 s.

   In every case the transaction rolls back and the lease lapses, so no data is lost.

## Recommendation

Merge after finding 1. Follow-up: a per-row deadline in `cleanupAttempts`, and a reserve sized by account count.

## Cleanup

My traders are deleted. The other 87 users' claim and lease hash is unchanged. Orphan sign-up attempts remain.
