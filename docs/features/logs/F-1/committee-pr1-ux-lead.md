COMPLIANCE: FAIL · USABILITY: DEMANDS

# F-1 · PR-1 committee review · UX lead

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` after the tester's CLEAN re-run. Production build on
port 3102 with the in-repo fakes; Playwright at 375px and 360px, light and dark, as a first-time trader from a
shared link and as a signed-out viewer. No product code changed. Screenshots: `screenshots/pr1/committee-ux/`.

## Step 4 · User test, in plain words

- **Shared link → S1.** Entry is the top-nav "Publish your trades" (21px tall, pre-existing). S1 reads
  clearly. No horizontal scroll at 375, 360 or 320. Every string on S1, S2, the sent page, both error states,
  `/terms` and `/privacy` matches the plan's copy verbatim.
- **Email path** (`login-sent-375-dark.png`): box, address, "Send me a link" → "Check your email. The link
  works for 15 minutes." + "Send again" + "← Back" (44px). The link landed me on my profile with a provisional
  handle, "Connect your broker (read-only)" and "Change handle" (`own-profile-375-dark.png`). Reusing the
  link: "That link has expired. Send a new one?" but nothing to tap for "a new one": I re-checked the box and
  retyped my address.
- **Provider path**: one tap after the checkbox, straight to the profile.
- **Attestation error** (`login-attest-error-375-light.png`): focus on the box, the red line, address kept.
  The method order then changes (last method first): the button I tapped moved, a small surprise.
- **Brokerage-first, signed out** (`brokerage-first-loop-375-dark.png`): "Connect a brokerage instead" → S2
  ("Sign in first…") → "Connect brokerage (read-only)" → back to S1 with no explanation. This stopped me.
  Deferred to PR-2 by the tester; still a dead end on a PR-1 screen.
- **S2** (`connect-signedout-375-light.png`): four lines, links and primary 44px; the "·" separator wraps
  alone at 375px.
- **Keyboard-only**: nav → checkbox → Terms → Privacy → providers → email → send → brokerage, a visible 2px
  ring on every stop; Space checks, Enter sends, the link signs in, "Change handle" reachable. Complete.
- **Reduced motion**: no animation or transition on any PR-1 page.
- **Dark mode** (`login-375-dark.png`): white on the lilac primary is washed out. Computed: **2.72:1** on every
  primary (S1, S2, the profile CTA) at 16px bold; light mode 7.10:1. All other text ≥ 5.03:1.
- **Disclaimer**: footer on every page; on S1 at 375×740 just below the fold. Placeholders read exactly
  "Placeholder: the owner supplies the final text before launch." No request left the app's origin.

## Step 5 · (1) Compliance: FAIL

- Age gate first on every path: the checkbox blocks providers, email and brokerage; no row until attested. Pass.
- Consent at collection: read-only line and Terms/Privacy links before the address is collected; S2 says
  nothing is imported until the next screen. Pass (import consent is PR-2b).
- Claims: no advice, endorsement or "secure" promise; the audit line is the vendor's own statement, linked;
  "Verified" unchanged. Pass.
- Third-party loads: none. Personal data on screen: only the trader's own address. Pass.
- **Accessibility (POLICY A1, §9): FAIL.** Primary-button text in dark mode is 2.72:1 against the 4.5:1 AA
  minimum (16px bold is not large text). The token is pre-existing on `main`, but PR-1 puts it on the first
  screen every trader sees. One CSS rule in the dark scheme fixes it.

## Step 5 · (2) Usability: DEMANDS

My six demands (plan-round1 §5): 1 taps/no h-scroll: pass (three taps S1 → profile); 2 copy verbatim,
exported, tested: pass; 3 keyboard-only: pass; 6 error states reachable: pass; 4 and 5 are PR-2b.

1. **Dark-mode primary contrast ≥ 4.5:1** on S1, S2 and the profile CTA. Test: e2e under
   `colorScheme: 'dark'` computes text/background ratio of every `.button` and `button`.
2. **No dead end on brokerage-first signed out.** `/login?method=brokerage` shows a `role="status"` line
   ("Sign in with a provider or email first; the brokerage connection opens after.") or hides the brokerage
   button until PR-2 adds sign-in by connection. Test: the loop S1 → S2 → S1 ends on that line.
3. **Expired link keeps the address**: prefill from the `login_email` cookie (extend it to 15 minutes).
   Test: expired link → field holds the address.
4. **S2 links** each on their own 44px row, no orphan separator at 375px. Test: no "·" text node there.

Observations only: the inline Terms/Privacy links are 20px and navigating away unchecks the box; the empty
profile says "No trades yet." until PR-2b's S8 copy.
