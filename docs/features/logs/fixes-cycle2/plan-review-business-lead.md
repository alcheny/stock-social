# Fixes cycle 2 (trust rows): business lead review of the UX lead plan

2026-11-01 · saved by the build session from the business lead's report (the role is read-only).

**Decision:** SIGN, with demands 1-8. Demands 1 and 2 must pass before merge.

## Demands (summary, in the business lead's order)
1. Feed F3: `/` and `/u/[handle]/pane` pass the performance e2e in this PR, or link the open F-10 PR that does.
2. e2e "beside" check direction-independent (span from min top to max bottom ≤ screen between fixed bars).
3. join-cta.tsx: "Read-only broker connection. Sizes, prices and balances stay private. 18+." (no claim about what is public).
4. share-prompt.tsx: build the public line from `PUBLIC_FIELDS`, plus handle, display name and reasons; no second hand-kept copy.
5. `STOCK_LABELS.explainer`: "Closed trades in this stock, newest first. Fewer trades means a wider range."
6. lib/claims.ts: "A broker account can belong to one profile, ever, so two profiles never share an account."
7. `app/disclaimer.tsx` at body size; /me/likes line above the list.
8. #4 source-scan test also covers the stock image and fails on any unfiltered read under `app/t/**`.

Open questions as the business lead decided them: body size; one disclaimer above the compare grid; /me/likes only
with rows; /me/record as built; stock image query stays here; title "NVDA demo trades"; #28 label "the sign-in link on
your pages"; pending only with an owning build; empty valid symbol 200 + noindex; CTA without a list.

Owner (blocks real users, not this PR): `CONSENT_SCOPE_LINE` must name handle, display name and published reasons (P6).
