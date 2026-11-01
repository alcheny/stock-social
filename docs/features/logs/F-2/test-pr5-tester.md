# F-2 PR-5/PR-6: tester findings (2026-11-01)

Branch `claude/f2-discovery-pr5-pr6`, diff `git diff 6b1a122 -- . ':!docs'`. Production server on :3000, ALLOW_DEV_AUTH=1,
Playwright chromium at 360x640, curl and psql against the local DB.

**Run cut short:** the server on :3000 stopped answering (connection refused, no `next` process) about 10 minutes into
the run. I wasn't started or stopped by this tester, and it was still down after another 10 minutes of waiting. The browser
checks below did not run: paging with >30 hidden trades, "No longer applied", personal order, Off, page 2, keyboard,
no-JS and dark mode. Scripts for them are ready (t4 to t6 in the tester scratch dir).

## Findings

1. **Medium (bug): the dwell/skip batch is lost whenever the page is left within 2 s of the 10 s periodic flush.**
   Repro: sign in as a new viewer, /me/personalize, Personalize with my activity: On; open `/`; scroll one card;
   navigate to `/how` at about 10.3 s after load (just after the periodic flush). Then query
   `select type, count(*) from discovery_events where viewer_id = <id> group by 1`.
   Expected: the impression rows plus one dwell_short/dwell_long/skip row per card seen (the logger's pagehide batch).
   Actual: impressions only (type 1, count 2). The pagehide beacon lands inside the route's one-batch-per-2-s gate
   (`BATCH_INTERVAL_MS`) and is refused with 429. The client drops refused batches (app/discovery-log.tsx), so every
   dwell outcome from that page view is gone. The same steps leaving at about 6 s stored both impressions and dwell_short
   rows. So roughly 1 page leave in 5 loses all of its dwell and skip signal. A related path: `hide()` sends only the first 50
   queued events, so with more than 50 the rest are lost on pagehide.
2. **Low (spec/copy): the activity notice says shares are recorded, but nothing logs a share.**
   /me/personalize says "...which you skip, open or share". The committee weights include `share +1`
   (lib/discovery/weights.ts IMPLICIT[7]), and the route accepts `share`. But no client code ever sends `share`
   (grep for `'share'` and `/api/events` in app/ and lib/: only app/discovery-log.tsx, which sends impression, dwell_*,
   skip, swipe_open and profile_open). Expected: the notice matches what is collected, or share logging exists.
   Actual: the notice describes collection that doesn't happen.

## Checked, no problem found
- POST /api/events: no Origin and no Sec-Fetch-Site → 403. Cross-origin Origin, `Origin: null`, Sec-Fetch-Site
  cross-site or same-site → 403. Signed out → 204 with nothing stored. Malformed JSON, a top-level array, 4,000-deep
  nesting and 51 events → 400. 50 events → 204. Over 8 KB, real or declared in Content-Length → 413. Types
  `follow`, `__proto__` and `toString`, a `watch` symbol event and the viewer's own handle → 204 with nothing stored.
  Rapid batches → the first 204, then 429. GET → 405. Stored rows hold only viewer, surface, type, target and time.
- Activity Off by default; On via the form stores `activity_log_on_at`. The logger stores impressions with surface feed and target trade.

## Retest (engineer, 2026-11-01, after the server was restarted)
- Finding 1 fixed: the events gate is now a window of 3 batches per 10 s (Postgres row lock), so the page-leave batch right
  after a periodic one is kept (`lib/f2-personal.db.test.ts`: the fourth batch in the window is refused).
- Finding 2 fixed: the notice says "which you skip or open" (no share emitter in PR-5; the type stays for later).
- t4 (hidden paging): 91 stored rows, 60 with a live close, all 60 listed once over 4 pages (the script's timeout was a
  click on a link detached by navigation). t5 (ordering): follow and like raise; Off equals everyone's order; scrolling
  repeats no card. t6 (keyboard, dark): every control has a visible 2 to 3 px focus outline; dark text and buttons read on
  their backgrounds.
