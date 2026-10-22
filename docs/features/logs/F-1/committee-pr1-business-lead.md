COMPLIANCE: FAIL · USABILITY: DEMANDS

# F-1 · PR-1 committee review · Business lead

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` (9aaeb27). Production build on 3101, local Postgres 16,
in-repo fakes, Chromium at 375px, light and dark. No product code changed.

## 1. User test (step 4)

**(b) Signed-out viewer.** Profile readable, no horizontal scroll; the way in is the nav "Publish your trades".

**(a) First-time trader, email path.** S1 in 10 seconds: title, one line that answers the fear ("Read-only. We
can never place trades or move money."), one checkbox, four buttons above the fold. Send before checking the box:
red line, focus on the box, address kept, but the email block jumped above the providers ("last method" memory
fired on a failed submit). The link lands on my own profile, signed in; a second tap says expired. Taps to S2:
nav, checkbox, Send, link, "Connect your broker" = 5; provider path 4. S2 reads well in both themes, controls 44px.

**Provider path.** Two taps to my own profile; a repeat resolved to the same user; the form_post provider merged
by email. Bad `state` → a clear red line. Muted and error text ≥ 4.5:1 in both themes.

**What stopped me.** My first run used `127.0.0.1`: the sign-in link redirected me to `localhost`, where my own
profile showed me signed out. The claim and callback routes build redirects from `req.url`, not the app's
`origin()`. In production that host is a proxy or preview.

**What felt off.** The landing profile shows `trader_rzd1g2rz` twice (display name defaults to the handle) and
"Change handle" as bare text. Signed out, "Connect a brokerage instead" → S2 → primary → S1: a loop, a grey
hint its only explanation. A signed-in user on `/login` sees the full form.

## 2. Compliance verdict: FAIL

One failure, raised by the engineer and confirmed against the live constraints:

- **§3 / POLICY P6, deletion.** `login_links.email` survives profile deletion: its FK points at
  `signup_attempts` (no cascade) and `signup_attempts.user_id` is `on delete set null`. Rows are never purged
  on claim or expiry either (93 rows, 54 addresses in my database). A deleted trader's address stays. Fix:
  null or delete the address on claim, purge expired rows from the hourly tick, delete by attempt in
  `lib/delete.ts`; assert in `lib/delete.test.ts` that no table holds the address afterwards. I missed this: I checked funnel
  rows and the log, not every table.

Everything else passes:

- Age gate before any account on every path (email, both providers, brokerage, dev); `users.signup_attempt_id`
  NOT NULL.
- Consent box unchecked by default; Terms and Privacy linked; placeholders marked.
- No advice, endorsement, guarantee or bare "secure" in any string (`lib/copy.test.ts`); S2 states only what the
  vendor publishes (owner confirms the exact audit wording and URL).
- Disclaimer on every new page; no third-party loads; funnel rows and server log hold no personal data.
- For PR-2a: POLICY F3 wants Terms, Privacy and `/how` linked from every page; `/how` is a 404 until then.

## 3. Usability and business verdict: DEMANDS

My §5 demands 1, 3, 5, 6, 7 are met; 2 and 4 are PR-2 scope. Below the bar:

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
   kill-gate measure (shared link → consented) counts nav arrivals. Test: `landed.source='profile'`.
6. **Carry to PR-2a (blocks Status: built):** no S1 → S2 → S1 loop signed out; `notice_seen` deduped; footer
   links to Terms, Privacy, `/how`; request #12 so provider e2e runs in CI.

Demo sentence: "Tap the link in your email and your record page is already yours, read-only, no password."
