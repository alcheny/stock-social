# Chores cycle 3: business-lead user test (built app)

Date: 2026-11-01 · Branch `claude/chores-cycle3` (diff against `origin/main`) · Plan: `plan.md` (Round 2 overrides §1-§5).
Method: Playwright, chromium, 360x740 viewport, against the running dev server at `localhost:3000` (CI's state: billing
not configured, so the "not available right now" variants render). Screenshots were taken and reviewed; none are committed.

**Verdict: PASS.** Compliance: pass on every check. Usability: pass, with two non-blocking demands (below).

## Journey 1: first-time trader

| Step | Observed | Verdict |
|---|---|---|
| `/login/dev` | Handle, Display name, "I am 18 or older" checkbox, Continue. New handle + 18+ → lands on the new profile. | Pass |
| `/settings` delete section | "Delete my profile" heading, explain line, primary **Delete my profile**, secondary **Keep it**. The subscriber-notes line is **absent** for the brand-new account. Signed in as the seeded demo trader, the line is present word for word ("If you publish a record, other subscribers' private notes about you are deleted and you are removed from their saved views."); `?confirm=1` shows neither line. | Pass (C3-44) |
| Delete my profile unchanged | Diff touches only the conditional around `BILLING.deleteNotes`; heading, copy, order, button styles and targets are as on main. | Pass |
| `/account` | Disclaimer box first; "You have no subscription."; **See Record tools (not available right now)** as `button secondary` (white, outlined; no primary-styled control on the page); Download my data secondary below. No horizontal scroll. | Pass (C3-39) |
| `/tools` (locked) | Disclaimer box; what-it-does line; muted "Subscriptions are not available right now. Trader records stay free to view."; **Back to the feed** → `/`, 44 px tall. Keyboard: Tab reaches it (9th stop, after nav and disclaimer links), Enter lands on `/`. No horizontal scroll. | Pass |

## Journey 2: signed-out viewer from a shared link

Head of `/` (signed out):
- `<title>` Stock Social (browser tab only; not part of the og/twitter card).
- `og:title` / `twitter:title`: "Closed trades imported read-only from connected broker accounts."
- `og:description` / `twitter:description`: "Losses included. Demo records are marked Demo." (does not repeat the title).
- `meta description`: the whole positioning line + the Demo sentence.
- `og:image` / `twitter:image`: absolute `/home-card`, 1200x630 png, `summary_large_image`, alt = card text.
- `/home-card`: 200 `image/png`, `public, max-age=3600`. Plain near-black card, white text, left-aligned in four
  lines: "Closed trades imported read-only from connected broker accounts. Losses included. Demo records are marked Demo."
  No name, logo, glyph, chart, figure or percent.
- What an unfurl shows: the large text card, the one-sentence title under it, "Losses included. Demo records are
  marked Demo." as the description, and the site's domain. Nothing names the product.
- `/how` and `/tools` keep main's description and carry no `/home-card` image; `/?after=…` carries the preview plus
  `robots noindex`.

Landing signed out: `/` renders the swipe feed (demo trader card, Demo badges, first-visit line, disclaimer under the
card), no horizontal scroll. `/tools` signed out: same locked screen as signed in, with Back to the feed (44 px).

## Compliance verdicts (POLICY)

1. No product name, logo or figure in the preview before T5a: **pass** (og/twitter tags and the image hold none; the
   `<title>` is not part of the unfurl and is unchanged from main).
2. No completeness claim: **pass** ("connected broker accounts", "closed trades"; no every/any/all/complete/verified).
3. Demo honesty: **pass** (the Demo sentence appears while demo records exist, in description, meta and image).
4. No price, date, "coming soon", waitlist, email field: **pass** on `/account`, `/tools` and the preview.
5. Disclaimer present: **pass** (first block on `/account` and `/tools`; under each feed card; footer). The preview has
   no performance figure, so it needs none.
6. Delete my profile unchanged: **pass**; the notes line is gated on the real data condition and fails open.

## Usability verdicts and demands (non-blocking; for a follow-up chore, not this PR)

1. `/account` at 360 px: "See Record tools (not available right now)" wraps to two lines with "now)" orphaned (68 px
   button). It reads, but it is the least crafted element on the page. Demand: keep one line at 360 px, e.g. the
   state as a muted line under a short "See Record tools" secondary button, or a shorter state word, still matching
   /tools' line.
2. The preview says "imported read-only from connected broker accounts"; the first screen the viewer lands on says
   "Verified trades, straight from the broker" (D27 `FIRST_VISIT.line`, unchanged here by design). Two wordings of one
   promise across one tap. Demand: route the alignment of `FIRST_VISIT.line` to the positioning line to the next
   design session (owner decision; it is D27's wording).
