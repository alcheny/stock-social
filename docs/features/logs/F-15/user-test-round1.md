# F-15 user test, round 1 (business lead, then UX lead), 2026-11-01

Build: `claude/f15-measurement` at 265c90e, on the running app at http://localhost:3000, 360 x 740, Chromium (Playwright).
Scripts: `/tmp/claude-0/ut/f15-r1.ts` and `/tmp/claude-0/ut/f15-r1b.ts`. Screenshots: `/tmp/claude-0/ut/j*.png`.

## What I did and what I saw
**J1, first-time trader.** `/login/dev` → new handle, 18+ ticked → landed on `/u/<handle>`. A trader with no broker sees no
Share (same as before). To reach Share without the vendor, the test set `snaptrade_user_id`/`last_synced_at` in the DB the
way `e2e/app.spec.ts` does. Prompt: "Share my record" (156 x 44 px), one tap → clipboard `/u/<handle>?via=card`, label turns
"Link copied" and is back after 2 s; the `aria-live="polite"` span says "Link copied", no assertive or alert region. With
one closed trade the Share card shows "Share my record" → `?via=card` and "Share October recap" → `/month/2026-10?via=month`.
No view count, "views" or visitor wording on the own profile, a trade page, `/settings` or `/account` (the only "views" there
are the existing "saved views" copy).

**J2, signed-out viewer from a shared link.** `/u/momentum_maya?via=card` with an external referer: 200, looks as before.
One beacon at 2.2 s, body `{path, ref:"external", via:"card", auto}`, answered 204; the full referrer did not leave the page.
Focusable elements 74 before and after, CLS 0, no new visible node; the page's DOM grows after load by the same amount with
the beacon blocked (lazy chart, not F-15). 60 Tab presses cycle through 38 distinct stops: no focus trap. Cookies: none.
localStorage and sessionStorage: empty, also after sharing. URL keeps `?via=card`. Trade page Share (73 x 44 px) copies
`…/trade/<id>?via=trade`, month page Share copies `…/month/2026-11?via=month`, both announce "Link copied" politely.
With `/api/views` forced to 500: page 200, no error text, Share still works.

**J3, feed → pane → profile → back.** Opened card 2's pane: feed scroll and pane stay put across the beacon firing. "See
full profile →" → `/u/yolo_yuki`, then Back → feed at the top with the pane closed. That is not new: `/` and `/u/…` are
different pages, so the feed unmounts on that navigation with or without `app/template.tsx` (reasoned, not A/B-run on
main). Beacons: `/` none, `/u/yolo_yuki` internal, `/` internal; no via carried forward. No page errors.

**Readout.** `node scripts/f15-readout.ts --out /tmp/claude-0/ut` wrote one Markdown file outside the repo; `--out` inside
the repo is refused. The four DESIGN §3.5 thresholds are verbatim; G2 "after the share_action slice"; G3 "views, not
people"; G4 "strict G4 can't be read in this slice; signed-out D7 return is not measured"; no handle, no return; small
cells print "<5" and roll into "other".

## Business lead: DEMANDS (readout only; the app journeys pass)
1. The owner sees three different totals for the same week (G3 502, surface table 518, drops table "counted views" 524)
   with no line saying why. Fix: one line under the surface table: "518 = all referrer classes, demo and self-views
   excluded; G3 counts external only; the drops table includes demo profiles." Test: readout text test asserts the line.
2. Week columns read "2026-W44" only; the owner has to look up which days that is. Fix: print the date span in the header
   ("2026-W44, Oct 26-Nov 1 (partial)"). Test: header regex.

## UX lead: PASS
Every journey behaved as the feature file requires at 360 px: one-tap share with the right `?via=`, polite "Link copied",
44 px tap targets, no visible or focusable addition, no layout shift, no cookie or device storage, no error on beacon
failure, and no count anywhere a trader can see it. Compliance: POLICY P3/P6 (no stored viewer data, first party only) and
F6 (no count shown or ranked) hold in what I could observe.
