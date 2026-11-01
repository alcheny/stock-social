# Ponytail inventory (known-limits sweep 2, 2026-11-01)

Every `ponytail:` note on main (`git grep -n "ponytail:" -- app lib scripts db e2e` at origin/main 515a992) and its status on `claude/known-limits-2`. Line numbers are main's.

| # | Note (main) | Status |
|---|---|---|
| 1 | `app/actions.ts:73` the redirect drops ref/via and the typed handle — carry them through i… | precise and kept (outside this sweep) |
| 2 | `app/api/sync/route.ts:49` housekeeping's own vendor calls (import steps, deletions) are outside … | owned by F-14/sync session |
| 3 | `app/api/sync/route.ts:114` the cron schedule itself (vercel.json `crons`) is a deploy setting for… | owned by F-14/sync session |
| 4 | `app/discovery-log.tsx:15` a batch the route refuses (rate window, network) is dropped, and at mo… | owned by F-15 measurement session |
| 5 | `app/discovery-log.tsx:16` mounted on the feed only, so no share or profile-page event is logged … | owned by F-15 measurement session |
| 6 | `app/feed-keys.tsx:12` before the first Tab or ← a screen reader's browse cursor can still re… | precise and kept (outside this sweep) |
| 7 | `app/feed-keys.tsx:19` the SCROLL_MS fallback guesses the smooth scroll's length on browsers … | precise and kept (outside this sweep) |
| 8 | `app/feed-keys.tsx:60` one pass over every feed row per Tab press (cheap at 30-60 rows; pages… | precise and kept (outside this sweep) |
| 9 | `app/first-visit.tsx:15` with F-7's launch switch on, signed-out page 1 shows no first-visit li… | owned by F-13 session |
| 10 | `app/globals.css:501` 94 px keeps ≥ 8 px clear for a bar up to 70 px tall (one or two lines)… | owned by cycle-2 a11y session |
| 11 | `app/globals.css:567` the short-screen Report target is 24 px tall, not 44 — give the card r… | owned by cycle-2 a11y session |
| 12 | `app/globals.css:638` card 1's thesis excerpt is hidden until the line is dismissed — a line… | owned by cycle-2 a11y session |
| 13 | `app/pane.tsx:81` K1 option trades are not on feed cards and this last-5 list is share t… | owned by F-11 labels session |
| 14 | `app/review/theses/page.tsx:9` off until real admin identity exists — then gate this page on that ide… | precise and kept (outside this sweep) |
| 15 | `app/share-button.tsx:19` no page declares a canonical link, so a search engine may index a ?via… | precise and kept (outside this sweep) |
| 16 | `app/t/[symbol]/opengraph-image.tsx:40` a database error still answers 200 with the neutral picture — answer 5… | owned by F-11 labels session |
| 17 | `app/t/[symbol]/page.tsx:36` fetch every row for the symbol so the summary covers all of them; only… | owned by F-11 labels session |
| 18 | `app/t/[symbol]/page.tsx:97` move the grouping into SQL if one symbol's traders hold thousands of t… | owned by F-11 labels session |
| 19 | `app/t/page.tsx:64` when symbols exceed a few thousand, push sort + limit into SQL with a … | owned by F-11 labels session |
| 20 | `app/template.tsx:5` the beacon lives in the root template, which remounts when the first U… | precise and kept (outside this sweep) |
| 21 | `app/u/[handle]/options-block.tsx:72` K2 no per-trade share card for options (the record card carries the la… | owned by options session |
| 22 | `app/u/[handle]/options-block.tsx:74` K3 no option trade page, theses or likes on option trades — build them… | owned by options session |
| 23 | `app/u/[handle]/page.tsx:60` generateMetadata and the page each call load() (and the record card re… | resolved here |
| 24 | `app/u/[handle]/page.tsx:101` generateMetadata and the page each run load(), so a profile view reads… | resolved here |
| 25 | `app/u/[handle]/record-card-data.ts:11` a profile view reads its rows twice (load() in page.tsx, then this for… | resolved here |
| 26 | `app/u/[handle]/referral-feedback.tsx:20` handles past MAX_SHOWN are not named and nothing says so (the total is… | resolved here |
| 27 | `app/ui.tsx:56` local copy of the year rule — switch to lib/date-text.ts#dateText when… | precise and kept (outside this sweep) |
| 28 | `app/user-note.tsx:4` /t/[symbol] rows and the chart sheet show the note without the control… | precise and kept (outside this sweep) |
| 29 | `app/view-beacon.tsx:13` pages that close before 2 s, or render without scripts, are not counte… | precise and kept (outside this sweep) |
| 30 | `db/schema.sql:204` users.signup_attempt_id has no index, so the purge's per-attempt check… | resolved here |
| 31 | `db/schema.sql:226` no index, so sign-in by email scans identities — add an index (email).… | resolved here |
| 32 | `db/schema.sql:246` no index, so account deletion's email match scans login_links — add a … | resolved here |
| 33 | `db/schema.sql:277` no index, so the attempt purge's per-attempt check and attempt deletes… | resolved here |
| 34 | `db/schema.sql:326` legislators' and quarterly holdings reports are not sources — they nee… | precise and kept (same file, not on this sweep's list) |
| 35 | `db/schema.sql:328` open positions carry no percent — an owner-approved market-data vendor… | precise and kept (same file, not on this sweep's list) |
| 36 | `db/schema.sql:338` the attestation columns are NOT NULL, so filers carry a sentinel — an … | precise and kept (same file, not on this sweep's list) |
| 37 | `db/schema.sql:441` the shard filter (`id % of = shard`) is applied after this index, so e… | precise and kept (same file, not on this sweep's list) |
| 38 | `db/schema.sql:534` no index, so each dispute webhook's update by customer scans subscript… | resolved here |
| 39 | `db/schema.sql:547` 'incomplete' (a first payment being confirmed) is outside the one-live… | precise and kept (same file, not on this sweep's list) |
| 40 | `e2e/f13-first-visit.spec.ts:208` the later-page check runs only when the shared DB holds more than one … | precise and kept (outside this sweep) |
| 41 | `e2e/f3-billing.spec.ts:19` CI's e2e job has no billing env, so the fake-processor tests skip ther… | precise and kept (outside this sweep) |
| 42 | `e2e/f3-billing.spec.ts:332` the fake processor listens only while this block runs, so in a local r… | precise and kept (outside this sweep) |
| 43 | `e2e/fakes/billing.ts:14` the fake answers only the REST subset lib/billing.ts calls, in the pin… | precise and kept (outside this sweep) |
| 44 | `lib/a11y-copy.test.ts:107` a heuristic lexer, not a parser (prose with "=", "&&" or a keyword lik… | precise and kept (outside this sweep) |
| 45 | `lib/auth/attempts.ts:154` no 301 from /u/<old>/** yet (decision 10; old links 404) — look up han… | precise and kept (outside this sweep) |
| 46 | `lib/auth/attempts.ts:156` no rename-frequency limit (OD-12 b/c are the owner's call) — add a las… | precise and kept (outside this sweep) |
| 47 | `lib/auth/send-limits.ts:19` with no known client address (off Vercel without TRUST_PROXY_HEADERS) … | precise and kept (outside this sweep) |
| 48 | `lib/auth/send-limits.ts:40` with no known client address (off Vercel without TRUST_PROXY_HEADERS) … | precise and kept (outside this sweep) |
| 49 | `lib/bets.ts:15` confidence() in lib/trades.ts builds these clusters a second time, inl… | precise and kept (outside this sweep) |
| 50 | `lib/billing.ts:135` a second request with the same idempotency key while the first is stil… | resolved here |
| 51 | `lib/billing.ts:299` an apply that runs past the 2-minute lease can be claimed again by a r… | precise and kept (same file, not on this sweep's list) |
| 52 | `lib/billing.ts:492` a dispute ends every live subscription of the customer, not only the o… | precise and kept (same file, not on this sweep's list) |
| 53 | `lib/billing.ts:542` pages through every processor subscription with no time box inside the… | resolved here |
| 54 | `lib/billing.ts:599` with billing switched off the processor customer is left for manual cl… | precise and kept (same file, not on this sweep's list) |
| 55 | `lib/broker.ts:151` ` where it lives: K1 the… | needs the owner (protected file) |
| 56 | `lib/broker.ts:273` renames (the vendor's ADJUSTMENT rows) and transfers from outside the … | needs the owner (protected file) |
| 57 | `lib/claims.ts:25` a deleted profile releases its claims (`on delete cascade`) — keep the… | precise and kept (outside this sweep) |
| 58 | `lib/claims.ts:52` the identity check is inactive, so a fresh connection still dodges the… | precise and kept (outside this sweep) |
| 59 | `lib/connections.ts:522` no limit and lowest id first, so a vendor delete that keeps failing is… | resolved here |
| 60 | `lib/connections.ts:583` an account with more than one page (1,000) of share-moving rows makes … | precise and kept (same file, not on this sweep's list) |
| 61 | `lib/connections.ts:689` both loops restart from the lowest id each tick, so rows that keep fai… | resolved here |
| 62 | `lib/consent-versions.ts:22` K9 consents recorded before consent_scope_hash existed have no wording… | precise and kept (outside this sweep) |
| 63 | `lib/copy.ts:73` shown on the public profile only; the owner's /me/record line shows ex… | precise and kept (outside this sweep) |
| 64 | `lib/copy.ts:379` LIKES.likeLabel is now unused but kept in place (shared block of the f… | precise and kept (outside this sweep) |
| 65 | `lib/copy.ts:905` not shown on any screen yet — the F-19 sweep rework places it on the s… | precise and kept (outside this sweep) |
| 66 | `lib/corporate-actions.ts:8` a split the vendor never reports (no SPLIT row) followed by a partial … | precise and kept (outside this sweep) |
| 67 | `lib/corporate-actions.ts:39` the window is a fixed 14 calendar days and the action's own day is exc… | precise and kept (outside this sweep) |
| 68 | `lib/corporate-actions.ts:49` from units alone, ratios off this grid (a 2.5% dividend, 11:10) and mo… | precise and kept (outside this sweep) |
| 69 | `lib/corporate-actions.ts:67` rivals are searched up to 100:100 only, so a true ratio with a side ab… | precise and kept (outside this sweep) |
| 70 | `lib/corporate-actions.ts:153` a spin-off is recognised only by "spin-off" in the description and tai… | precise and kept (outside this sweep) |
| 71 | `lib/corporate-actions.ts:214` whether the vendor ever sends a real close at a price of 0, and how of… | precise and kept (outside this sweep) |
| 72 | `lib/corporate-actions.ts:297` a vendor correction to a stored row (a SPLIT whose ratio is added late… | precise and kept (outside this sweep) |
| 73 | `lib/cron-auth.ts:29` the limit is per route per warm server instance (a cold start resets i… | precise and kept (outside this sweep) |
| 74 | `lib/csp.ts:10` the vendor's exact portal host is not confirmed, so the default also a… | precise and kept (outside this sweep) |
| 75 | `lib/discovery/activity.ts:15` ordering reads only the newest READ_MAX events in the 90-day window — … | precise and kept (outside this sweep) |
| 76 | `lib/discovery/activity.ts:50` events past DAY_MAX in a UTC day are dropped silently — raise it, or k… | precise and kept (outside this sweep) |
| 77 | `lib/discovery/personal-cache.ts:7` kept per server process (another instance rebuilds the list from the i… | precise and kept (outside this sweep) |
| 78 | `lib/discovery/personal-cache.ts:9` at most PERSONAL_CACHE_MAX lists; past it the oldest go and their sess… | precise and kept (outside this sweep) |
| 79 | `lib/discovery/weights.ts:48` the implicit weights are the committee's proposal, not tuned on real r… | precise and kept (outside this sweep) |
| 80 | `lib/display-log.ts:75` one snapshot per trader, one after another (~5 queries and a whole-rec… | resolved here |
| 81 | `lib/feed.ts:38` a day's list holds at most FEED_LIST_MAX (350) cards, so most of thous… | made precise here (rewritten with measured cost and fix) |
| 82 | `lib/feed.ts:88` the time is read once, when the close is inserted, so a SELL with the … | made precise here (rewritten with measured cost and fix) |
| 83 | `lib/feed.ts:125` when the window cannot prove the 200, this ranks every close in closed… | made precise here (rewritten with measured cost and fix) |
| 84 | `lib/feed.ts:199` a page reads its traders' whole records (~50,000 closes for heavy ones… | made precise here (rewritten with measured cost and fix) |
| 85 | `lib/feed.ts:210` every page trader's whole record now also ships opened_at (~15–30 ms m… | precise and kept (same file, not on this sweep's list) |
| 86 | `lib/feed.ts:332` kept lists and weights are per process, so every server (and every res… | made precise here (rewritten with measured cost and fix) |
| 87 | `lib/feed.ts:363` the profile is read on every page, even when the kept personal list is… | made precise here (rewritten with measured cost and fix) |
| 88 | `lib/feed.ts:445` a trader's symbols are only those of their closes in the kept list (≤ … | made precise here (rewritten with measured cost and fix) |
| 89 | `lib/fixes-cycle2-trust.test.ts:18` these stock files still read closed_trades / open_positions with their… | precise and kept (outside this sweep) |
| 90 | `lib/follows.ts:89` every follow and every hidden trader, unpaged (/me/following and the R… | resolved here |
| 91 | `lib/follows.ts:123` one unpaged list (every expired hide of the viewer) — page it like /me… | resolved here |
| 92 | `lib/format.f19.test.ts:82` the walk reads one line at a time, so a definition split across lines … | precise and kept (outside this sweep) |
| 93 | `lib/format.ts:13` these call sites still format or tone a number on their own, not throu… | precise and kept (outside this sweep) |
| 94 | `lib/format.ts:52` ASCII hyphen sign, up to `digits + 4` decimals near -100% and no thous… | precise and kept (outside this sweep) |
| 95 | `lib/handles.ts:36` other users' handles are compared on hskel only (1→l, underscores kept… | owned by F-9/F-17 session |
| 96 | `lib/handles.ts:199` reads every typed display name in one query — page by id once there ar… | owned by F-9/F-17 session |
| 97 | `lib/health.ts:38` `last` is the newest heartbeat across all shards, so one dead shard am… | precise and kept (outside this sweep) |
| 98 | `lib/likes.ts:100` a page skips hidden trades whose close is gone (until the privacy purg… | precise and kept (outside this sweep) |
| 99 | `lib/likes.ts:106` past HIDDEN_COUNT_MAX the line says "1,000+" — an exact count would ne… | precise and kept (outside this sweep) |
| 100 | `lib/moderation.ts:48` spaced endings that are English words (".me", ".to", ".co", ".live", "… | owned by F-9/F-17 session |
| 101 | `lib/moderation.ts:61` spans in days are left out ("I made 8% in 3 days" is how a single trad… | owned by F-9/F-17 session |
| 102 | `lib/moderation.ts:79` a rate word reaches its figure across at most 4 words ("my avg over th… | owned by F-9/F-17 session |
| 103 | `lib/moderation.ts:97` the phrase rules are English only — a non-English promotion publishes … | owned by F-9/F-17 session |
| 104 | `lib/moderation.ts:106` a spaced "@ plainword" (no digit or _) publishes — it can't be told fr… | owned by F-9/F-17 session |
| 105 | `lib/moderation.ts:118` phone digits spelt as words ("five5five 123 4567") publish — add a num… | owned by F-9/F-17 session |
| 106 | `lib/moderation.ts:132` a bare "example com" with no www and no path publishes ("the company c… | owned by F-9/F-17 session |
| 107 | `lib/moderation.ts:203` a single-trade gain under 20% with no time total publishes even in the… | owned by F-9/F-17 session |
| 108 | `lib/moderation.ts:283` fix round 4 trades holds for false holds — a bare "next 10 bagger" (no… | owned by F-9/F-17 session |
| 109 | `lib/moderation.ts:375` the rules hash in lib/moderation-v2.test.ts covers these patterns and … | owned by F-9/F-17 session |
| 110 | `lib/moderation.ts:457` a split into 3+ parts, or one beside a leet or look-alike letter, publ… | owned by F-9/F-17 session |
| 111 | `lib/month-card.ts:29` monthCard is test-only code — move those assertions onto monthBand and… | precise and kept (outside this sweep) |
| 112 | `lib/options-load.ts:14` K10 existing traders stay gated until they consent again, and reconnec… | owned by options session |
| 113 | `lib/options-load.ts:86` K4 similar, compare, recap, /me/record and the import banner count ign… | owned by options session |
| 114 | `lib/options-sync.ts:203` K8 the exercise-day rule removes every share close in that account and… | owned by options session |
| 115 | `lib/options-sync.ts:280` a record whose per-account counts were never started keeps its totals … | owned by options session |
| 116 | `lib/options-sync.ts:323` a record with option positions or counts from before users.open_option… | owned by options session |
| 117 | `lib/options-sync.ts:339` an option on a future stored in open_positions before this PR (a froze… | owned by options session |
| 118 | `lib/options-sync.ts:353` a history longer than one vendor page takes one sync per page, and tha… | owned by options session |
| 119 | `lib/options.ts:16` K6 cash-settled exercise is not priced and index underlyings are outsi… | owned by options session |
| 120 | `lib/options.ts:46` K7 per-cause counts are returned by matchOptions but not stored — stor… | owned by options session |
| 121 | `lib/options.ts:156` K5 a corporate action on the underlying during a hold is caught only w… | owned by options session |
| 122 | `lib/options.ts:158` a mini contract's conventional root (the underlying plus a trailing di… | owned by options session |
| 123 | `lib/png.ts:4` palette, grey, 16-bit and interlaced PNGs are refused — add them here … | precise and kept (outside this sweep) |
| 124 | `lib/portal-probe.ts:47` first probes of one origin that start at the same moment on different … | precise and kept (outside this sweep) |
| 125 | `lib/privacy-purge.ts:78` both marking steps walk all of trade_likes / trade_exclusions (two ind… | resolved here |
| 126 | `lib/privacy-purge.ts:138` the clearing step walks orphan rows each tick until it finds a batch (… | resolved here |
| 127 | `lib/public-filings.ts:38` the daily index path and JSON shape are a generic design served by the… | owned by F-7 session |
| 128 | `lib/public-import.ts:31` a source with no cursor starts today (no backfill) — the dry run's day… | owned by F-7 session |
| 129 | `lib/public-import.ts:37` a filing with more than one reporting owner is skipped and counted — s… | owned by F-7 session |
| 130 | `lib/public-import.ts:60` a filing that fails to store is passed over; a re-read from an earlier… | owned by F-7 session |
| 131 | `lib/public-trades.ts:81` if both candidate handles are taken the filing fails on every read — a… | owned by F-7 session |
| 132 | `lib/public-trades.ts:100` a filer left with no priced close (an amendment) keeps its users row —… | owned by F-7 session |
| 133 | `lib/record-card.ts:46` in these wide states the preview's chart falls to about 22% (20% with … | precise and kept (outside this sweep) |
| 134 | `lib/record-card.ts:90` the account-weighted line waits for F-5 (position size, blocked) — dra… | precise and kept (outside this sweep) |
| 135 | `lib/record-card.ts:141` siteUrl's other callers (sign-in links, the sitemap) still fail on a s… | precise and kept (outside this sweep) |
| 136 | `lib/record-card.ts:208` the compare page still prints confidence()'s log-based range and tier … | precise and kept (outside this sweep) |
| 137 | `lib/record-strip.ts:183` a return of five digits before the point would push the bare line unde… | precise and kept (outside this sweep) |
| 138 | `lib/record-tools.ts:142` an owner's notes are listed whole (a note outlives its trader's place … | precise and kept (outside this sweep) |
| 139 | `lib/record-tools.ts:202` each card reads the trader's whole closed_trades, exactly as the profi… | precise and kept (outside this sweep) |
| 140 | `lib/referral.ts:78` invite codes are counted on views only; sign-up attribution (users.ref… | owned by F-15 measurement session |
| 141 | `lib/reports.ts:6` distinct reporters mean little while accounts are cheap (the dev sign-… | owned by F-9/F-17 session |
| 142 | `lib/rules.ts:73` a second percent formatter beside lib/format.ts#pct (it prints "+0.0%"… | precise and kept (outside this sweep) |
| 143 | `lib/shared-accounts.ts:22` only same-vendor-id duplicates are found here, and the claimant's reco… | precise and kept (outside this sweep) |
| 144 | `lib/similar.ts:18` per process, and rebuilt every SIMILAR_REFRESH_MS with a full feed lis… | resolved here |
| 145 | `lib/sitemaps.ts:45` the count is cached per server, so for up to COUNT_TTL_MS one server's… | resolved here |
| 146 | `lib/sitemaps.ts:47` every sitemap request groups all of closed_trades by symbol and pages … | resolved here |
| 147 | `lib/sync-limits.ts:31` the defaults hold production at the old sequential rate (~5k traders/h… | owned by F-14/sync session |
| 148 | `lib/sync-shard.ts:138` a request beyond the prepaid syncRequests(n) (another page on a first … | owned by F-14/sync session |
| 149 | `lib/sync-shard.ts:157` a multi-account activities read is timed as one call, so its requests … | owned by F-14/sync session |
| 150 | `lib/sync-shard.ts:212` the vendor budget is this run's, in process: one run per (of, shard) a… | owned by F-14/sync session |
| 151 | `lib/sync-shard.ts:241` the breaker's window is one run's attempts; an outage is re-detected b… | owned by F-14/sync session |
| 152 | `lib/sync-shard.ts:294` the guard covers each vendor call before it starts, not the database w… | owned by F-14/sync session |
| 153 | `lib/sync-shard.ts:396` the coverage counts scan every syncable trader on each shard-0 call (1… | owned by F-14/sync session |
| 154 | `lib/sync.ts:205` the marks compare the app's clock (`now`), not the database clock the … | owned by F-14/sync session |
| 155 | `lib/sync.ts:317` past SYNC_FIT_CAP accounts (or an activity or share-move read over one… | owned by F-14/sync session |
| 156 | `lib/sync.ts:425` absence is decided by vendor account id, not authorization, so an acco… | owned by F-14/sync session |
| 157 | `lib/thesis-review.ts:28` keeping replaces the matched rule's label with 'kept' (the list then s… | precise and kept (outside this sweep) |
| 158 | `lib/thesis-review.ts:98` the page stays off until real admin identity exists — then gate it on … | precise and kept (outside this sweep) |
| 159 | `lib/thesis-save.ts:52` clearing a kept note and writing it again starts moderation afresh (a … | precise and kept (outside this sweep) |
| 160 | `lib/trade-share-load.ts:34` only the first matched purchase is linked (closed_trades keeps no lot … | precise and kept (outside this sweep) |
| 161 | `lib/trade-share.ts:63` a symbol over HERO_MAX_CHARS (31) characters is cut with an ellipsis o… | precise and kept (outside this sweep) |
| 162 | `lib/trades.ts:142` the mark never clears, so a ticker the exchange later recycles for ano… | precise and kept (outside this sweep) |
| 163 | `lib/trades.ts:382` the interval reads closed trades only; open positions (TR-4, stored by… | precise and kept (outside this sweep) |
| 164 | `lib/trades.ts:384` bets are clustered by symbol, so a position renamed by a corporate act… | precise and kept (outside this sweep) |
| 165 | `lib/user-note.ts:30` "after the trade closed" is true only because a thesis can be attached… | owned by F-9/F-17 session |
| 166 | `lib/views.ts:39` with no trusted client address (off the platform without TRUST_PROXY_H… | precise and kept (outside this sweep) |
| 167 | `lib/views.ts:42` the cap is per instance, so N instances allow N × RATE_MAX a minute — … | precise and kept (outside this sweep) |
| 168 | `lib/views.ts:52` only the first capped beacon per client and minute is counted as a dro… | precise and kept (outside this sweep) |
| 169 | `lib/visible-users.ts:4` compare, the stock share image and app/t/open-positions.ts still filte… | precise and kept (outside this sweep) |
| 170 | `scripts/f15-bot-validation.ts:19` simulated humans and scripted fetchers on one machine, not real device… | precise and kept (outside this sweep) |
| 171 | `scripts/handoff.ts:68` PR titles, summaries and notes stay agent-written prose; only markers,… | needs the owner (protected file) |
| 172 | `scripts/handoff.ts:81` `limit` is the agents' own claim, so a hostile agent can pause new wor… | needs the owner (protected file) |
| 173 | `scripts/handoff.ts:274` relies on upload-artifact's log wording; if it changes, every leg is r… | needs the owner (protected file) |
| 174 | `scripts/review-theses.ts:8` an owner-run CLI with database access is the only admin identity today… | precise and kept (outside this sweep) |
| 175 | `scripts/review-theses.ts:14` `list` shows the first LIST_CAP held theses (by trader, then sell id),… | precise and kept (outside this sweep) |
| 176 | `scripts/token-budget.ts:11` cost is a proxy for tokens (the cap is on tokens; cache reads are chea… | owned by budget governor session |
| 177 | `scripts/token-budget.ts:29` priors come from one day's runs — refit them from finished sessions' c… | owned by budget governor session |
| 178 | `scripts/token-budget.ts:45` the orchestrator's reserve stops at 24h even when the reset is days aw… | owned by budget governor session |
| 179 | `scripts/token-budget.ts:58` the provider's resetsAt jitter is only known from observation (seconds… | owned by budget governor session |
| 180 | `scripts/token-budget.ts:72` evidence up to 10% above a calibrated high (spend seen in its window, … | owned by budget governor session |
| 181 | `scripts/token-budget.ts:76` a resetsAt more than 30 days old is taken as garbage (e.g. 0) rather t… | owned by budget governor session |
| 182 | `scripts/token-budget.ts:156` an entry without its own `resetsAt` is placed on this window's grid, a… | owned by budget governor session |
| 183 | `scripts/token-budget.ts:170` paused time is known only when the orchestrator passes pausedHours; wi… | owned by budget governor session |
| 184 | `scripts/token-budget.ts:187` pro rata assumes an even burn over the active hours, and puts the paus… | owned by budget governor session |
| 185 | `scripts/token-budget.ts:226` without a recent reading the burn is the lifetime average, which lags … | owned by budget governor session |
| 186 | `scripts/token-budget.ts:243` "half the overrun again" is a rule of thumb from one day of fix rounds… | owned by budget governor session |
| 187 | `scripts/token-budget.ts:248` in its first minutes (10 for a lifetime average, 5 with a recent readi… | owned by budget governor session |
| 188 | `scripts/token-budget.ts:259` a session's projected rate jumps from its prior's average to its obser… | owned by budget governor session |
| 189 | `scripts/token-budget.ts:266` the remaining cost is assumed to be spent evenly over the remaining ho… | owned by budget governor session |
| 190 | `scripts/token-budget.ts:281` the provider reports no percentage used, so the cap is inferred from t… | owned by budget governor session |
| 191 | `scripts/token-budget.ts:331` "far below" is 10% under the implied high, a guess at reading noise — … | owned by budget governor session |
| 192 | `scripts/token-budget.ts:595` a reading taken after the resume is penalised too (often ignored as to… | owned by budget governor session |
| 193 | `scripts/token-budget.ts:876` the bootstrap item is admitted without any cap check — a cap carried i… | owned by budget governor session |
| 194 | `scripts/token-budget.ts:895` under the point projection a finish frees nothing (its remaining becom… | owned by budget governor session |
| 195 | `scripts/token-budget.ts:1128` spend the orchestrator cannot see (a person's own sessions on the same… | owned by budget governor session |
| 196 | `scripts/token-budget.ts:1155` the pro rata spreads each session's cost evenly over its span (pauses … | owned by budget governor session |

New notes added by this PR (each also under Known limits):

- `lib/billing.ts:546` counts are per call, so a pass cut over several ticks logs one partial…
- `lib/connections.ts:711` the import loop runs before the cleanup loop and the attempt sweep, so…
- `lib/connections.ts:713` never-tried rows go first, so a burst of new rows delays older retried…
- `lib/display-log.ts:130` one 20 s box writes ~9,000-21,000 records (467-1,048 records/s measure…
- `lib/feed.ts:171` when not even 365 days prove the 200 (fewer than 200 capped closes of …
- `lib/feed.ts:257` the picks walk users in md5 order, so a site with many signed-up users…
- `lib/feed.ts:476` the profile is read on every page (settings, then follows, likes, reje…
- `lib/follows.ts:149` the cap bounds what is returned, not what is read: every follow of the…
- `lib/privacy-purge.ts:50` an orphan is seen up to one lap late (measured: a lap over 1,000,000 r…
- `lib/similar.ts:29` the shared pool is the full feed list, rebuilt fleet-wide every SIMILA…
- `lib/similar.ts:163` in a new hour, while another server builds its pool, every profile vie…
- `lib/sitemaps.ts:70` the boundaries are rebuilt by a crawler's request, once per REBUILD_MS…
