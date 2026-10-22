COMPLIANCE: PASS · USABILITY: DEMANDS

# F-1 · PR-1 committee review · Business lead

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` (9aaeb27) after the tester's CLEAN re-run. Production
build on 3101, local Postgres 16, `ALLOW_DEV_AUTH=1`, the in-repo fakes, Chromium at 375px, light and dark.

## 1. User test (step 4)

**(b) Signed-out viewer on a profile.** Record, stats, chart and disclaimer readable; no horizontal scroll. The
way in is the nav "Publish your trades" (a real profile adds "Verify your record").

**(a) First-time trader, email path.** Nav → S1. First 10 seconds: title, one line that answers the fear
("Read-only. We can never place trades or move money."), one checkbox, four buttons above the fold. I tapped Send
before checking the box: red line, focus on the box, address kept, but the email block jumped above the provider
buttons (the "last method" memory fired on a failed submit). Tapping the link: own profile, signed in, provisional handle. Second tap: "That link has expired." Taps to S2:
nav, checkbox, Send, link in mail, "Connect your broker" = 5; the provider path is 4. S2 reads well in both
themes; every control is 44px.

**Provider path.** Checkbox + "Continue with Mail Co" → own profile in two taps; a repeat resolved to the same
user, and the phone-maker's form_post path merged by email. Bad `state` → a clear red line. Contrast ≥ 4.5:1.

**What stopped me.** My first run used `127.0.0.1`: the sign-in link redirected me to `localhost`, where my own
profile showed me signed out with "Verify your record" on it. The claim and callback routes build redirects from
`req.url`, not the app's `origin()`. One host in a lab is a proxy or preview host in production.

**What felt off.** The landing profile greets a new trader with `trader_rzd1g2rz` twice (display name defaults to
the handle), then "Change handle" as bare text. Signed out, "Connect a brokerage instead" → S2 → primary → S1
again, a loop with a grey hint as the only explanation. A signed-in user on `/login` sees the full form.

## 2. Compliance verdict: PASS

- Age gate before any account on every path (email, both providers, brokerage, dev): rows 753–766 carry
  `adult_attested_at`; `users.signup_attempt_id` NOT NULL.
- Consent box unchecked by default; Terms and Privacy linked; placeholders marked in a dashed box.
- No advice, endorsement, guarantee or bare "secure" in any string (`lib/copy.test.ts`); S2 states only what the
  vendor publishes. Owner still confirms the vendor's exact audit wording and URL (engineer note 5).
- Disclaimer in the footer of every new page.
- Browser requests went only to the app and the sign-in issuer; no third-party loads.
- Funnel rows hold names and step values only; zero rows match `@` or a 7+ digit run.
- Server log: no address, token or cookie. Email transactional, one vendor, status-only errors.
- Scanner: only the pre-existing dependency finding, identical on main.
- For PR-2a, not a PR-1 failure: POLICY F3 wants Terms, Privacy and "How records are calculated" linked from
  every page; today only the attestation links two of them and `/how` is a 404 until PR-2a.

## 3. Usability and business verdict: DEMANDS

My §5 demands 1, 3, 5, 6, 7 are met on screen and in tests; 2 and 4 are PR-2 scope. Below the bar:

1. **Redirect host.** `app/auth/email/route.ts:19` and `app/auth/callback/[provider]/route.ts:13,30` build
   redirects from `await origin()`. Test: a claim request with `Host: 127.0.0.1:3101` redirects to that host and
   the profile renders signed in.
2. **Method memory only on completion.** Write `auth_last_method` when a sign-in completes, never on a tap; never
   move the brokerage block or its "or" divider first. Test: order unchanged after an attestation error; S1 never
   starts with "or".
3. **First screen after sign-in.** A provisional user shows the handle once (display name empty until set);
   "Change handle" styled as a link, 44px. Test: the handle appears once in the profile header.
4. **Signed-in `/login`** redirects to the own profile. Test: signed-in GET `/login` → 303 `/u/<handle>`.
5. **`landed` attribution.** The nav "Publish your trades" on a profile carries `ref` and `via=nav`, so the
   kill-gate measure (shared link → consented) counts nav arrivals. Test: `landed.source='profile'` after that path.
6. **Carry to PR-2a (blocks Status: built, not PR-1):** no S1 → S2 → S1 loop signed out; `notice_seen` deduped;
   footer links to Terms, Privacy, `/how`; request #12 so provider e2e runs in CI.

Demo sentence: "Tap the link in your email and your record page is already yours, read-only, no password."
