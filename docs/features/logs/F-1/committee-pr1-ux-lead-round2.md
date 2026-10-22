COMPLIANCE: PASS · USABILITY: PASS

# F-1 · PR-1 committee review · UX lead · round 2

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` at `4ff0b95` (fix rounds 2 and 3). Production build on port
3102 with the in-repo fakes; my own Playwright script and contrast formula at 375px and 360px, light and dark, touch
and keyboard-only. No product code changed. Screenshots: `screenshots/pr1/committee-ux-round2/`.

## My four demands, as a trader sees them

1. **Dark primary contrast.** Measured on `/login` (three primaries), `/connect` signed in and the own profile
   ("Connect your broker", "Save"): dark `rgb(11,11,15)` on `rgb(167,139,250)` = **7.22:1**; light white on
   `rgb(109,40,217)` = **7.10:1**; secondaries 16.4:1 / 18.8:1. Same at 360px. Pass.
2. **Brokerage-first signed out.** S1 → box → "Connect a brokerage instead" → S2: "Sign in first, then connect."
   (`role="status"`), no primary, three 45px option rows; tapping one lands on S1 with the form. No loop. Pass.
3. **Expired link keeps the address.** Reused link: "That link was already used. Send a new one?", address prefilled,
   "Send a new link" (44px). Expired in the DB: the expired line, same prefill and button. Pass.
4. **S2 link rows.** No "·"; the vendor link and "How records are calculated" are 44px rows, 58px apart. Pass.

## Observations re-checked

- Terms and Privacy open in a new tab; the box stays checked on return. The links are still 20px tall inside the
  44px row; fine for now.
- Disclaimer: at 375×740 the footer starts at 704px, so its first line shows without scrolling on S1 and S2; on the
  new profile it is in full view.
- "You're in. Next: connect your brokerage." sits between the handle heading and the primary; handle shown once.
- **Handle change, end to end:** "Change handle" (45px) → new handle → Save → URL, `h1`, page title, `og:title`, feed
  name and the `users` row all carry the new handle; the old one is gone from `main` (a 404 as a URL). Fixed.
  Leftover: right after saving, the top-nav still reads `@old_handle` until the next full load (soft navigation keeps
  the layout; `nav-after-handle-change-375-dark.png`). A reload corrects it. Observation for PR-2a, not a demand.

## Also

- Attestation error: focus on the box, address kept, method order unchanged.
- Keyboard-only: nav → box → Terms → Privacy → providers → email → send → brokerage, a 2px ring on every stop; Space
  checks, Enter sends, the link signs in, Tab reaches "Change handle", Enter opens it, Tab lands in the field.
- Reduced motion: nothing animates on S1. No horizontal scroll on S1, S2, sent or profile at 375 or 360.
- Compliance (step 5.1): age gate first on every path, consent before the address is taken, no new claims, no
  third-party load, contrast ≥ 4.5:1 on every control in both schemes, status lines announced. PASS.

Verdict: no demands left for PR-1.
