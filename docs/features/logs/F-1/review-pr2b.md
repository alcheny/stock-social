approve: true

# F-1 PR-2b · Reviewer

2026-10-23. Branch `claude/adoring-euler-4469ys` at `658df80` against `origin/main`. Read-only: no code changed.

## Checks run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (Postgres 16) | 451 pass, 0 fail, 0 skipped |
| `compliance.ts diff origin/main` | only the installed-tree `@img/sharp-wasm32` licence line, as on main; no `package*.json` change |
| `autopilot.ts guard main` | `guard: ok` |
| `CI=1 npm run build < /dev/null` | first run stopped on the framework advisory (owner); the retry built |
| `npx playwright test` with the vendor fake | 88 passed, 3 skipped (OIDC and email fakes unset, as before) |

## Criteria

- **Plan §1, §2, §8.** Each item has a passing test:
  - S2 → S3 → S4 embedded, recorded `embedded`; popup blocked → `/connect/continue` → redirect completes; in-app browser goes straight to redirect.
  - Persistent new-page link; the 3 s and 8 s rules; focus trap; Escape and Close.
  - S5: 2 s poll, 5 s announcements, the 60 s line, "Import finished.", then the banner goes away. Visitors and hidden tabs do not poll.
  - S6 expired heading and body; S7a "Continue in a new page", with `abandoned` counted.
- **Carried items, all tested:**
  - evidence line shown once; zero-trade preview copy;
  - the lured portal: query and referrer are ignored;
  - no "broker" placeholder; one-sentence expired heading; S7a second action;
  - Demo badge contrast at least 4.5:1; the activities line follows every step.
- **Tests not weakened.** Every test name on main still exists (490 → 539). The changed assertions are acceptable:
  - `banner(n, owner)`: a business-lead demand;
  - the expired heading: carried item d;
  - global tick counts now `>= 1`, a race fix, with per-row assertions added;
  - older e2e tests block the page's own poll, so their per-step assertions still hold.
- **Security.**
  - The message listener checks the exact minted origin and `event.source`. A message can only pick one of two fixed paths.
  - The frame only loads the server-minted https URL (loopback only with the fake). The sandbox has no top navigation.
  - The probe: one HEAD, no credentials, pinned to the minted origin, same-origin manual redirects (at most 3), 1.5 s cap. No SSRF surface.
  - Only tagged SQL; no user-controlled HTML. `lax` cookies make a cross-site POST to `/connect/portal` a 401.
- **Scope.** No new dependency, vendor or schema change. Endpoints are as planned. `next.config.ts` adds only anti-framing headers.
- **Product rules hold:**
  - verified-only and percent-only; losses shown;
  - no stats while importing; 18+;
  - no celebration;
  - the disclaimer footer on every page, `/connect/continue` included.
- **Policy.** No secrets or personal data. Only the integrated vendor is named. All copy passes the banned list.

## Findings (none blocking)

1. **Low · `lib/copy.ts:218`, shown at `app/u/[handle]/page.tsx:124`.**
   - With no institution, a public profile reads "Connected: your broker (N accounts)". A visitor reads that as their own broker.
   - It breaks the PR's own rule (`lib/copy.ts:82`): "your" only to the owner.
   - Fix: use a neutral fallback.
   - Rule: POLICY F3a.
2. **Low · `lib/connections.ts:226-232`.**
   - `connectUrl` (a vendor call) still runs inside the mint lock. A slow vendor holds one pool connection per queued mint, and only registration needs the lock.
   - Round 4 moved the probe out, as asked. Follow-up.
3. **Info · `app/connect/portal/route.ts:28-33`.** `portal_opened` is written before the https check, so a 502 still counts toward the mint limit.
4. **Info (taste, carried by the committee):**
   - `lib/copy.ts:208` still says "embedded" and "the vendor's page".
   - `app/u/[handle]/page.tsx:185` shows a 0.0% average in loss red.
   - `app/connect/continue/page.tsx:13`: a status present at load may not be read before the 2 s auto-continue. This is a POLICY A1 note, not an AA failure.

## Owner

- The framework advisory stops the first `npm run build`. The dependency bump is yours.
- In preview, check two things:
  - whether the HEAD probe uses up the one-time portal URL;
  - whether the real portal's messages match `lib/portal.ts#parsePortalMessage`. It was written without the SDK, because request #5 has no answer.
- The poll limit and the probe cache are per instance (`ponytail`).
