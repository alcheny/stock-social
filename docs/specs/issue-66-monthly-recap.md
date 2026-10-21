# Spec: Monthly recap implemented (#66)

Variant: **single** · Spec agreed by designer and business analyst

This is a short summary of the agreed spec. `issue-66-single.md` belongs to the embeddable badge and trade permalink work and is unchanged by this PR.

## Summary

Public per-month recap at `/u/[handle]/month/[YYYY-MM]` with an OG card.

- `lib/recap.ts` is pure: `parseYm`, `monthRecap`, `wholeRecord`, `latestRecapYm`. UTC half-open month on `closed_at`. Future, malformed or empty months 404.
- `lib/recap-load.ts` is the only SQL. It reads `closed_trades` only, so recaps stay public and frozen after disconnect.
- Under 5 trades the page shows the count and the full list instead of a win-rate headline.
- The whole record (`stats()`, `confidence()`, `isNewRecord`) is always shown beside the month, so a cherry-picked month is visible as one.
- Every trade is listed, losses styled like gains. Percentages only.
- The Verified label comes from the rows' `verified` flag. A demo user shows the Demo badge.
- Owner-only "Share your latest recap" link on the profile.

## Review fixes

- Loader selects `verified`, and the OG card shows "✓ Verified from broker" only when every closed trade is verified.
- Restored `issue-66-single.md` byte-for-byte from the base commit, and removed stray formatting in `app/u/[handle]/page.tsx`.
- Verified flag now requires at least one closed trade.
