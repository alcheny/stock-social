# CHORES-3 user test (UX lead), 2026-11-01

Build: working tree vs `origin/main` (plan: `plan.md`, Round 2 overrides §1-§5). Running app at http://localhost:3000,
Playwright chromium, 360 x 780 px, light and dark color schemes. Screenshots are kept outside the repo.

**Verdict: PASS** (compliance and usability). Nothing in this diff stops a real user. Follow-ups below are outside the diff.

## Journey 1: first-time trader (keyboard only, then pointer)

- `/login/dev`: Tab order skip link → header (Stock Social, Trades by stock, Publish your trades) → Handle → Display
  name → "I am 18 or older" checkbox (named by its wrapping label) → Continue. Typed, Space to tick, Enter to submit:
  lands on `/u/<handle>`. Focus ring 2 px accent on every stop (6.8:1 light, 7.2:1 dark against the page).
- `/settings` view 1, new trader with no record: the "other subscribers' private notes" line is **absent** (C3-44
  correct). Same view as an existing demo trader with a record: the line is **present**. Headings H1 Settings → H2
  Record tools → H2 Delete my profile. No horizontal scroll.
- `/settings?confirm=1` (view 2): "This cannot be undone.", Delete my profile, Keep it; both buttons 44 px+ full width.
- `/account` (no subscription, billing not configured, CI's state): "You have no subscription." then the secondary
  button **"See Record tools (not available right now)"**: the state is visible text, not only an accessible name;
  wraps to two lines at 360 px (328 x 68 px), no overflow. Tab stop 9, after the disclaimer box, before Download my data.
  Contrast: text 18.8:1 light / 16.4:1 dark; boundary 3.75:1 light / 4.29:1 dark against the page (≥3:1 met). Only H1.
- Enter on it → `/tools` locked: what-it-is line, "Subscriptions are not available right now. Trader records stay
  free to view." (muted 5.0:1 light / 5.8:1 dark), then **"Back to the feed"**: 123 x 44 px, Tab stop 9, Enter → `/`.
  The account button's words match /tools' own line, so nothing promised on /account is missing on /tools.

## Journey 2: first-time viewer from a shared link, signed out

- `/` metadata: `og:title`/`twitter:title` = "Closed trades imported read-only from connected broker accounts.";
  `og:description`/`twitter:description` = "Losses included. Demo records are marked Demo." (does not repeat the
  title); `meta description` = the whole line + Demo sentence; `twitter:card` summary_large_image; image 1200 x 630
  PNG with alt = card text; `og:url` absolute; `?after=x` adds `noindex`. Document title stays "Stock Social".
- `/home-card`: 200, image/png, `public, max-age=3600`. Off-white on near-black (about 18:1), 60 px type, four lines,
  left-aligned, no overflow or clipping. In a simulated 360 px unfurl (328 px wide card) the text is about 16 px and
  easy to read; at a 120 px thumbnail it is about 6 px and not readable, but the title and description under it carry
  the same words, so nothing is lost. No name, logo, figure, chart or completeness claim; losses mentioned; demo
  disclosed while demo records exist (POLICY honest-marketing rules met).
- `/` signed out: feed renders, Tab order skip → header → first card; no horizontal scroll.
- `/tools` signed out: same locked screen with "Back to the feed" (44 px); Tab order header → disclaimer links →
  Back to the feed → footer.

## What confused or stopped me

Nothing in the changed screens. Small notes:
- The unfurl shows the same sentence twice (image text and title). Acceptable for a text-only card; revisit when the
  name and a visual are cleared.
- A platform that square-crops the 1.91:1 image would cut the left-aligned words. Not seen on the large-card format.
- For a trader who already has a record, "If you publish a record, ..." reads hypothetical (F-3 copy, not this diff).

## Follow-ups outside this diff (not blocking)

1. `/settings` text links (Following and hidden traders, Personalize your feed, Record tools, Account) are 20 px tall:
   they meet WCAG 2.2 SC 2.5.8 through spacing but miss the 44 px house rule. Give them the `.rt-links` treatment.
2. `/settings` shows an H2 "Record tools" followed by a link also named "Record tools": redundant for screen readers.
3. Feed (pre-existing): range buttons 1W..ALL are 35 px tall and chart point links are 12 x 12 px.

## Checks not run

Screen reader (VoiceOver/TalkBack) pass and axe (not a repo dependency; manual names/focus/order/contrast done instead).
