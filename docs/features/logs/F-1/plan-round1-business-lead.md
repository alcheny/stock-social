# F-1 · Plan round 1 · Business lead

Date: 2026-10-22. Scope: how to implement `docs/features/F-1-broker-connection.md` (Status ready).
No decision in the feature file is changed here.

## 1. Implementation approach

The business case is supply: a trader arrives from a shared link, taps "Publish your trades", and in
the same session has a public record. Screens in the order met, each with one primary action.

1. **Sign-in** (`/login`). Feel: quick. Do: one tap. Two provider buttons, an email field, one line
   "or connect your brokerage to start". No handle or display-name fields: derive a provisional handle
   and let the trader edit it on the profile.
2. **Attestation**. Feel: nothing to read. Do: one checkbox "I am 18 or older" with Terms and Privacy
   links, on the sign-in screen (buttons disabled until checked), stored on `signup_attempts` before
   any user row (mechanic c).
3. **Trust notice**. Feel: my password is safe, nothing can trade. Do: tap "Connect read-only". Four
   fixed lines (read-only; password not shared for login-handoff brokers; the vendor's own audit
   statement, linked; "How records are calculated"), one button. That page does not exist today; F-1
   creates it, since F3 and the notice both link it.
4. **Portal** (vendor web SDK in a modal; redirect fallback when the popup is blocked). Feel: I never
   left. Do: pick the broker, log in.
5. **Consent** (state `pending`). Feel: I know exactly what becomes public. Do: "Publish my record".
   Three lines: full history the broker provides; every account under this login; stays public after
   disconnect (P6, TR-2/3/5). Plus "Not now". No stat preview: first sync depth is zero, so nothing
   honest exists to show.
6. **Import banner** (`importing`). Feel: it's working, in my own profile. "Importing your record ·
   N trades so far", one vendor page per polled step; gone at `connected`.
7. **Empty profile**. Feel: already mine and real. Open positions block, then "No closed trades yet.
   Your record starts with your first close." The positions read (TR-4) is missing from
   `lib/broker.ts`; F-1 adds it because the owner's empty-state copy depends on it.
8. **Decline / expiry / failed**. Feel: clean, no residue. One component: "Import not started.
   Nothing is connected." or "The connection didn't complete.", one "Connect" button back to the
   notice.

**Three PRs, in priority order.** PR-2 (state machine, consent, banner, empty profile, decline
states) ships first on the existing dev sign-in: it is the business case. PR-1 (real sign-in,
attestation on `signup_attempts`) second. PR-3 (heavy tests) last, but before Status: built. If the
first pass must be cut: the provider buttons (email alone reaches everyone; fewer methods, fewer TR-6
duplicates) and the cron expiry (lazy expiry on read covers the visible rule). Not cuttable: consent,
decline cleanup at the vendor, attestation before the user row, TR-6 claims.

## 2. What to measure

Events per `signup_attempts` row, no personal data: `landed` (shared link / direct),
`method_chosen`, `attested`, `notice_seen`, `portal_opened` (embedded / redirect), `link_succeeded`,
`consented` / `declined` / `expired`, `import_finished` (trade count, seconds), `own_profile_viewed`.

Three numbers: (a) landed → consented in one session (target ≥ 40% of portal opens; the kill gate
needs 50 connected traders and this is the lever); (b) median seconds `method_chosen` →
`import_finished`; (c) `consented` / `link_succeeded`.

## 3. Compliance checklist (COMPLIANCE.md §1)

1. Performance: yes, the profile; disclaimer in the layout, empty state shows no stats → §2.
2. Personal data: yes; provider subject id, email, attestation, vendor link in `users` /
   `signup_attempts`; deletion end to end including the vendor user → §3.
3. Money: no.
4. Email: yes, the magic link, transactional only, one vendor → §5.
5. User text: no new text.
6. Sign-up/age/identity: yes; every method attests before the user row → §7.
7. Vendor/dependency: yes, vendor SDK and email vendor; every asset self-hosted → §8, §3.
8. Screen reader/keyboard: modal focus trap, named checkbox and buttons → §9.
9. Security: yes; real sessions, OIDC state and nonce, rate-limited link, cron bearer → §10.
10. Claims: the trust notice; fixed string in the vendor's words, tested against the banned list → §11.
11. Checkout: no.

## 4. Pre-authorization

Mandatory before the build: #1 protected paths, #2 diff cap or three-PR split, #4 test secrets,
#5 vendor SDK, #6 email vendor, #10 Terms/Privacy placeholders and consent copy (P6 blocks consent without them). Can wait: #3 budgets, #7 cron (lazy
expiry first), #8 duration limit (smaller chunks), #9 preview (in-job start plus screenshots for
round one), #11, #12.

## 5. Demands at committee review

Engineer: (1) a 375px signed-out walk from `/login` to an empty profile in at most four taps, no
scrolling on sign-in, attestation or consent; (2) decline leaves zero `broker_accounts` rows, no
vendor connection (asserted via the vendor's list call in test mode) and a `declined` timestamp;
(3) a schema-level test that no user row exists without a linked attestation; (4) a concurrent
`syncUser` test proving one transaction, the other skipped; (5) event rows contain no email, name or
provider id (test greps the row); (6) notice and consent copy in one constants file, tested against
the banned list; (7) light and dark, keyboard-only, reduced motion on the modal.
UX lead: one primary action per screen, no copy a design could have made unnecessary, the banner
count visibly updating.

## Disagreements for the owner

None with the decisions. One gap to record: the feature file assumes open positions (TR-4) are on
the profile; they are not, so F-1's scope includes the positions read in `lib/broker.ts`.
