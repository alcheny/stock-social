# F-1 plan, round 1: UX lead

Date: 2026-10-22. Every screen: 375px, one column, `.page` container, existing tokens; controls
≥ 44px, 4.5:1 contrast, visible `:focus-visible`, nothing animates under `prefers-reduced-motion`. The
footer disclaimer stays on every page.

## 1. Screens and states (first-time trader, in order)

**S1 Sign-in** (`/login`, replaces the stub). H1 "Publish your trades". Sub: "Read-only. We can never
place trades or move money." Stack: phone-maker button, email-provider button, email field +
"Send me a link", divider "or", secondary "Connect a brokerage instead". Provider buttons use the
provider's required label (names in config, not repo copy). One required checkbox on every path: "I am
18 or older and accept the Terms and Privacy Policy" (both linked). A tap with it unchecked focuses the
box and shows "Confirm you are 18 or older to continue." (`aria-describedby`). The attestation writes
`signup_attempts` before any redirect. Exit: provider return, link sent, or S2.
*Link sent*: "Check your email. The link works for 15 minutes on this device." + "Send again".
*Expired link*: "That link has expired. Send a new one?"

**S2 Trust notice** (`/connect`, a page, not a modal; also the signed-in "Connect your broker" path).
H1 "Before you connect". Four lines, icons by shape: "Read-only. Stock Social can never place trades or
move money." / "Your broker password is not shared with SnapTrade or with us when your broker uses a
login handoff." / "SnapTrade reports an independent audit of its security controls (its words,
linked)." / "Every account under this login and your full trade history are included. Nothing is
imported until you confirm on the next screen." Links: SnapTrade's security page (external, labeled
"opens SnapTrade's site") and "How records are calculated". Primary "Open SnapTrade". One exported
constant, tested against the banned-claims list. Exit: S3.

**S3 Portal** (vendor SDK modal over S2). While loading: button disabled "Opening…" with `aria-busy`;
after 3 s "Taking longer than usual."; after 8 s a link "Open in a new page instead" (redirect
fallback). Modal: `role="dialog"` labeled "Connect your brokerage", focus trapped, Escape or "Close"
returns focus to the button. Close without a link → S7a; vendor error → S7b; success → S4.

**S4 Consent** (`/connect/consent`, 24-hour clock). H1 "Confirm what gets imported". "Your brokerage is
linked. Nothing has been imported yet." List: "Full trade history your broker provides" / "Every account
under this login (N found)" / "Closed trades are published on your public profile as percent returns.
No amounts, quantities or prices." / "A broker account can belong to one profile, ever." / "Your record
stays public if you disconnect; deleting your profile removes it." Then "Decide by ‹date time›, or this
link is removed automatically." Primary "Import my record", secondary outlined "Don't import". The
primary tap is the recorded consent. Exit: S5 or S6.

**S5 Profile with import banner.** `role="status"`, `aria-live="polite"`, under the H1: "Importing your
record · 0 trades so far", updated in place (poll 2 s, live-region update at most every 5 s, no
spinner). On finish: "Import finished." until next navigation. No celebration. Stats fill as they
arrive; disclaimer in footer.

**S6 Declined.** "Import not started. Nothing is connected." + "Connect again" (→ S2) + "Back to
feed". *Expired* is the same page prefixed "The time to decide ran out."

**S7 Errors** (`role="alert"`, focus moved to the heading). (a) Abandoned: "Connection not completed.
Nothing was saved." + "Try again" + "Not now". (b) Broker failure: "Your brokerage didn't finish
connecting. Nothing was saved." + "Try again". (c) Claimed: existing `ACCOUNT_CLAIMED_*` copy + "Try
another login". (d) Offline while polling: banner reads "Waiting for connection…", count kept.

**S8 Empty record.** Open positions first (TR-4) when any, then "No closed trades yet. Your record
starts with your first close." Signed out, same line, "Record since" omitted.

## 2. Interaction details

- Popup-blocked: the SDK's popup callback (or a null `window.open` inside the tap handler) switches the
  button to "Continue at SnapTrade" and does today's full-page redirect within the same gesture; no
  blank modal. In-app browsers without `window.opener` go straight to redirect.
- Loading: S3 timings; the page behind the modal is scroll-locked but readable.
- Undo/retry: every terminal state has one primary retry and one secondary way out; "Don't import"
  asks nothing further (S6 is the confirmation).
- Order: phone-maker button first on that maker's phones, email-provider first elsewhere (user-agent
  family only); email link third; brokerage fourth. The last method used (`localStorage`) is listed
  first. Funnel events carry method and step, no email.

## 3. Acceptance criteria → screen → user-side assertion

| Criterion | Screen | Assert |
|---|---|---|
| Three sign-in methods, 18+ first | S1 | each path blocks at the unchecked box; no `users` row until S4 |
| Funnel events | S1–S5 | one row per step; no `@`, 7+ digit runs or names |
| Trust notice precedes portal | S2 | S2 renders before any SDK script; constant passes banned list |
| Embedded portal, popup fallback | S3 | dialog visible; popups blocked → vendor URL → back to S4 |
| Connect writes link + claims only | S4 | `activities` empty after S3; depth and N shown |
| States + 24h expiry | S4, S6 | clock +24h: S4 URL shows S6-expired text |
| Decline copy, claims released | S6 | exact string; same account connects again |
| All-claimed-by-self signs in | S1→S5 | own profile, no second link |
| Attestation before user row | S1 | `signup_attempts` row before provider redirect |
| Account deletion | profile settings | profile 404; handle-reserved message on re-signup |
| Import banner | S5 | "0 trades" → N → gone |
| No interleaved syncs | S5 | two concurrent polls, one monotonic count |
| Failed/abandoned page | S7 | copy and retry; no rows |
| Claimed by another | S7c | existing copy |
| Edge and heavy | S5/S8 | S8 copy on empty; 10k activities end with banner gone |
| 375px profile signed out | S8/profile | no horizontal scroll; stats, range, chart, list visible |

## 4. Compliance notes

- §3: S4 is the consent at collection of financial data: what becomes public, no opt-out, persistence
  after disconnect (P6), timestamp recorded. The SDK script loads only on `/connect` after S2, never
  site-wide; funnel events are first-party and personal-data-free.
- §7: attestation on every path including brokerage-first and provider returns; TR-6 explained on S4;
  S7c links the support contact.
- §9: accessible names, live regions, focus management and reduced-motion as stated; sign kept in text.

## 5. Demands on the engineer (held at review)

1. S1→S5 in ≤ 5 taps at 375px, no horizontal scroll at any step.
2. Trust and consent copy are the exact strings above (or amended in this log), exported and tested.
3. Keyboard-only run of the whole flow; modal trap and focus return verified.
4. Popup-blocked path shown on the preview, not only in a test.
5. Banner updates without layout shift; profile readable while importing.
6. Every error state reachable by a forced failure on the preview.

## Disagreements for the owner

None. Note: "Open SnapTrade" names the vendor on a button since the SDK shows its name anyway; "Connect
brokerage" is an acceptable swap within the plan.
