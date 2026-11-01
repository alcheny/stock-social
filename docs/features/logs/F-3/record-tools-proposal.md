# F-3 · Record tools: the exact feature list put to the legal committee (2026-11-01)

The proposal the committee reviewed (round 1 input). The verdict and the conditions it attached are in
`committee-2026-11-01.md`; where they differ, the verdict wins and only what it clears is built.

## Context
- Record tools is the first paid feature for viewers (F-3 decision 2026-11-01): $9.99 a month or $99.99 a year,
  no trial, billed by the payment processor's hosted checkout and portal, in the processor's test mode only until
  the owner switches live billing on.
- It re-presents records that are already public and free on every profile. It adds no data a signed-out visitor
  cannot already see; it adds a way to put chosen records side by side, keep them, and annotate them privately.

## Feature list (each item is a separate yes/no for the committee)
R1. **Compare.** On `/tools`, a subscriber puts 2 to 4 traders side by side, in the order the subscriber chose
    (added order; "Move up" / "Move down" controls). Traders are added by handle (typed) or from the subscriber's
    own follow list. There is no list of suggested traders, no search by performance, no filter by any number.
R2. **The numbers per trader** (exactly what the public profile already shows, same formulas, same wording):
    handle with Verified or Demo badge; closed trades; win rate; average return per trade; the 95% range around
    the average ("-2.1% to +3.4%") and its lower bound stated as "Lower end of range"; the evidence line
    ("Past results: … · Evidence: thin (12 bets, 90 days)" or "Too early to tell …"); the period (first entry to
    last exit); max drawdown labeled "per-trade, equal-weight"; excluded positions count. Losses read exactly like
    gains (sign and text, never color alone). No open positions are listed (no symbols, no values).
R3. **No ranking.** The columns never sort by any number; no "best", highlight, crown, color scale, verdict,
    winner, "who to follow" or summary sentence comparing traders. The same inputs give every subscriber the same
    output (no personalization of the numbers).
R4. **Saved views.** A subscriber names and saves a comparison (up to 20 views, 4 traders each), reopens, renames,
    reorders and deletes it. Views are private: only their owner can open them (`/tools?view=<id>` answers 404 to
    anyone else, signed in or not).
R5. **Private notes.** One free-text note per trader per subscriber (up to 2,000 characters), shown only to that
    subscriber on Record tools. Never published, never shown to the trader or anyone else, never counted, never
    used for ranking or discovery.
R6. **Nothing shareable.** No share button, no share image, no permalink that works for anyone else; every
    Record tools page is `noindex, nofollow` and absent from the sitemap.
R7. **Nothing pushed.** Record tools sends no email, notification or feed item of any kind (POLICY F3b). Billing
    emails are the processor's receipts and payment notices, carrying no handle, symbol, return or record field.
R8. **Disclaimer** "Not investment advice. Past performance does not guarantee future results." on every Record
    tools surface, in plain view at the top, plus links to Terms, Privacy and How records are calculated.
R9. **Locked state.** A signed-in non-subscriber on `/tools` sees one sentence on what Record tools does, the
    price, the renewal terms and Subscribe; never a blurred or partial record. Signed out: the same page with
    "Sign in to subscribe". Nothing about plans appears on profiles, trade pages, the feed or the share card.
R10. **Export and deletion.** The account page offers "Download my data" (JSON: the subscriber's saved views,
    notes and subscription status). Deleting the account deletes views, notes and the billing rows the app keeps
    (the processor keeps its own records for tax law, as its terms say).
R11. **No entitlement by symbol.** No paid check is keyed by a symbol or sits under `app/t/**`; per-security pages
    stay free and unchanged. No Record tools action writes `discovery_events`. Follow and watchlist limits are the
    same for every viewer.

## Open questions for the committee (pick an option, give the reason)
Q1. Traders and Record tools. "A trader … is never shown a price, a plan or a card form" (acceptance criterion)
    and "traders are never charged". Options: (a) users who have connected a broker (connected or frozen) get
    Record tools included at no charge and never see a price; (b) traders see Record tools locked with no price
    and cannot subscribe; (c) traders have no Record tools entry at all.
Q2. Is R2's list right? Anything to remove (for example max drawdown, the lower bound line) or add?
Q3. Notes about a trader: delete them when the noted trader deletes their account (cascade), or keep them as the
    subscriber's own data? Moderation of private notes (U1 covers published text)?
Q4. Saved-view URL: owner-only `?view=<id>` with 404 for others, or no id in the URL at all?
Q5. Auto-renewal disclosures on the app's own Subscribe screen (before the hosted checkout) and after purchase:
    the exact content (price, interval, tax, renewal, how to cancel, when cancellation takes effect).
Q6. Grace period after a failed renewal (feature file recommends 7 days); dispute sets `unpaid` at once; does a
    refund end access?
Q7. What the app stores from the processor's events (the full payload, or ids, type and status only) and how long
    billing rows are kept after account deletion.
Q8. Anything in R1 to R11 that, in your field, must not be built, or must be built differently.
