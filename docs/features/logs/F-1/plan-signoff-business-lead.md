SIGNED

Date: 2026-10-22. Plan: `plan.md` (converged draft, round 1). No decision in the feature file changes.

## Why I sign

- **PR-1 sign-in first.** The engineer is right and I was wrong. Mechanic (c) creates the user row at consent; the stub creates it at login. A state machine built on the stub hangs every connection off a user id that PR-1 then rewrites: the hardest part built twice. My cut survives: PR-1 ships on the email link alone if provider secrets are late.
- Every demand in my round-1 §5 maps to a test in the plan's §4 and the engineer's §3 table.
- Four taps S1 → S5, no handle fields, no stat preview, consent copy honest about "public" and "every account". The business case is intact.

## Non-blocking notes

1. PR-1 is ~900 lines, also over the 800 cap. Request #2 should name both PRs, or `/how` and `/settings` move to PR-2a. Otherwise PR-1 goes needs-human and the order gain is lost.
2. Requests #7 (hourly tick) and #8 (≥60 s) are listed before PR-2. Keep PR-2 buildable without them: lazy expiry covers the visible 24-hour rule; one vendor page per step should fit a default function limit, and if not, shrink the page.
3. Light and dark at 375px are in my demands but not in the test table. Tester adds them to the e2e walk.
4. Consent primary "Import my record" is acceptable because the lines above say the record becomes public. If `consented / link_succeeded` is low, test "Publish my record" first.
5. Hand-rolled OIDC unit tests must include wrong-audience and alg-none cases, not only nonce, issuer, signature and expiry.

## Open question: simulated ("paper") accounts

Recommendation to the owner: **exclude and count**, the plan's default.

- "Verified" means real broker activity. Simulated trades under that badge, even labeled, dilute the one promise the product makes (TR-1). Reject "include with a label".
- Refusing any login containing a simulated account turns away traders who keep both. That is intuition, not evidence, but being wrong costs a connected trader at a 50-trader kill gate; excluding costs nothing.
- Consent: "N accounts found (M simulated, not imported)". Zero real accounts: no user row, a decline-style page "No real brokerage account found." Profile lists excluded simulated accounts beside excluded sells, same component.
- Re-read the flag on every sync; a newly added simulated account never enters the record.
