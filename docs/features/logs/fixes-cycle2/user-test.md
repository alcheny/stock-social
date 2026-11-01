# Fixes cycle 2 (trust rows): user test, UX lead + business lead

2026-11-01, branch `claude/fixes-cycle2-trust`, `next start` on :3001, Chromium at 360x740. Screenshots: `screenshots/`.
Personas: (a) first-time trader via /login/dev (fresh `ut…` handle, 18+ checked; deleted afterwards), plus the demo
owner's /me/record; (b) first-time viewer, signed out, arriving from shared links. No horizontal scroll on any page (scrollWidth 360).

| # | Surface | Compliance (POLICY) | Usability |
|---|---|---|---|
| 1 | Join CTA on a non-demo profile, signed out (`b-real-profile-join`) | PASS. "Read-only broker connection. Sizes, prices and balances stay private. 18+." No "only percentages" claim, no completeness claim (P3/P6), 18+ shown. Correctly absent on demo profile (momentum_maya). | PASS. Reads in one pass, button full width and 44px. |
| 2 | Owner share prompt (`a-own-profile-share-prompt`) | PASS. Names handle, display name, published reasons and every PUBLIC_FIELDS entry; losses included; private items named. | DEMAND: the 45-word line is a list with no "and" and a trailing "; losses included". Join it like the consent line (`, and your current open positions…`) and end with a separate sentence "Losses are included." Test: the rendered text contains ", and your current open positions" and no ";". |
| 3 | 404 page, `/no-such-page` and `/u/momentum_maya/oops` (`b-404`, `b-404-dark`) | PASS. Status 404, `noindex`, footer disclaimer present, no advice. | DEMAND: "Back to the feed" and "All stocks" are inline links 20px tall. Make each a block link with min-height 44px (stacked, or with 8px+ spacing). Test: both `main a` boxes >= 44px high at 360px. Copy, heading and dark mode PASS. |
| 4 | Page titles | PASS. | PASS. All distinct: Sign in / Terms of Service / Privacy Policy / Page not found / Compare stocks / NVDA vs AMD verified trades / Stocks with verified trades / My record / Liked trades / profile "Name (@handle)". Note: /login title "Sign in" vs h1 "Publish your trades" differ; acceptable, not a demand. |
| 5 | /me/record copy (`a-me-record`, `a-me-record-synced`, `a-me-record-demo`) | PASS. "(including demo data)" shows only for the demo owner, absent for a non-demo trader: no "verified" claim over demo data (F3a). | PASS. "Choose up to two rules", "Your next sync will include them." (connected) and the Connect link (not connected) both render correctly. |
| 6 | Compare copy (`b-compare*`) | PASS. "Choose two stocks to compare." and "Choose two different stocks. You chose NVDA twice."; no "pick" anywhere on profile, ticker, compare, 404 (F1a). Disclaimer present on all performance screens. | PASS. |
| 7 | Referral nav label | PASS. Nav sign-in link on a profile is `/login?ref=<handle>&via=nav`; 'nav' accepted; owner feedback reads "the sign-in link on your pages". Not visible in UI without a connected referral; covered by `lib/referral-nav.test.ts` (3 pass). | PASS. |
| 8 | /me/likes tone class | PASS. | PASS. Empty state is clear and private-by-default. |

## Verdicts

- Compliance: **PASS** on every changed surface.
- Usability: **2 demands** (items 2 and 3); everything else PASS.

## Seen, outside this diff (follow-ups, not blockers for this branch)

- Nav links ("Stock Social", "Stocks", "Publish your trades", "@handle") are 21px tall at 360px, under the 44px rule;
  the signed-in handle is truncated ("@ut1213817…").
- `/t/NVDA` title says "NVDA verified trades" while every row is demo (h1 shows "Demo"); `/t` title likewise. Title
  should not say "verified" for demo-only data (F3a, product rule "Demo data always shows a Demo badge").
- Range buttons (1W/1M/3M/1Y) on profiles are 35px tall.
