# Trust and safety runbook

F-16 (`docs/features/F-16-trust-and-safety-slice.md`, plan `docs/features/logs/F-16-F-17/plan.md` §5.3, §5.5, §5.6,
§5.8). The owner runs every step here from their own terminal, with `DATABASE_URL` for the deployment in `.env`. No
step needs a session, a page or an email. Every command below changes state only, never removes it, and every hide or
unhide writes its own audit row (`trust_audit`) in the same transaction.

## 1. Handling a report

1. Read the digest: `node --env-file=.env scripts/trust-digest.ts`. It prints open profile reports by category,
   **"May be under 18" first**, then held theses, hidden items, repeat unfounded reporters and the last sync tick.
2. Start with the under-18 group (section 3), then the others in the printed order.
3. Open the profile link. Look at the profile as a signed-out reader sees it. A report never hides anything by itself,
   whatever the count.
4. Decide: leave it, hide the profile, or hide one thesis (section 2). A single trade is never hidden: the record stays
   whole (losses like gains, TR-1).
5. Resolve each report you handled (section 4).

## 2. Hide and unhide

Hide a whole profile, or one thesis (by the trader's user id and the closing sell's id):

```
node --env-file=.env scripts/hide.ts profile <user_id> <reason>
node --env-file=.env scripts/hide.ts thesis <user_id> <sell_id> <reason>
```

Reasons (`lib/trust-hide-reasons.ts`): `impersonation-elsewhere`, `pretends-to-be-someone`, `may-be-under-18`,
`money-or-paid-access`, `abusive`, `personal-information`, `legal-notice`.

Show it again:

```
node --env-file=.env scripts/hide.ts unhide-profile <user_id> <unhide-reason>
node --env-file=.env scripts/hide.ts unhide-thesis <user_id> <sell_id> <unhide-reason>
```

Unhide reasons: `report-unfounded`, `issue-resolved`, `hidden-by-mistake`.

See what was done: `node --env-file=.env scripts/hide.ts history <user_id>` (codes and times only).

- The actor recorded is `owner` unless `--actor=<role word>` or `TRUST_ACTOR` names another role word. Never a
  person's name or address.
- A hidden profile answers a neutral "Profile not available" page (404) everywhere, and is counted on no public
  surface. The trader can still sign in, use settings and download their data.
- A hidden thesis shows only to its author, with the line "This thesis is not shown to others right now. Only you can
  see it." It stays hidden through the trader's edits, and through clearing and writing it again, until you unhide it.
  `scripts/review-theses.ts publish` does not release a hidden thesis.
- Cached share images and JSON can stay in a browser or CDN for up to 300 s (images) and 60 s (JSON) after a hide.
  Wait that long, or purge the deployment's cache for `/u/<handle>/*`.

## 3. Under-18 reports (K18)

- The owner reviews every "May be under 18" report, first.
- A hide (`may-be-under-18`) is allowed while you decide.
- Never ask for a date of birth, an ID document or an age estimate. The product has no age-assurance method yet
  (an owner decision, F-16 Open questions).
- When the owner finds such a report founded, the owner's step is `docs/COMPLIANCE.md` Section 7's under-18
  procedure, the one for a COPPA notice: delete the account, log what was done, and review the sign-up age gate.
- Closing the account is the owner's own decision and the owner's own action, taken through the product's
  account-closing path in settings or a documented owner procedure. It is never automatic and never done for you by
  a script or an assistant.
- **Owner item (open):** there is no audited, owner-run account-closing path yet. The settings path closes only the
  signed-in account, and no owner script closes another account with an audit row. Until one exists, keep the
  `may-be-under-18` hide in place and record the decision with `scripts/trust-digest.ts resolve`; building that path
  is an owner decision (F-16 Open questions).

## 4. Resolving reports and repeat unfounded reporters

```
node --env-file=.env scripts/trust-digest.ts reports <trader_id>
node --env-file=.env scripts/trust-digest.ts resolve <reporter_id> <trader_id> founded|unfounded
node --env-file=.env scripts/trust-digest.ts reporters
```

- Resolving changes that one report only (`resolved_at`, `resolution`). It never hides or shows anything.
- A reporter with 2 or more unfounded reports appears under `reporters` and in the digest count. Nothing happens to
  them automatically. Reporter ids are for your terminal only: never paste them into an issue, a PR or a log.

## 5. Restore from a backup, with deletion replay (Owner only)

A backup can bring back accounts that were closed after it was taken, and roll back hides and unhides made after it.
The restore replaces the very tables that record those changes, so read them from the live database first:

1. Note the backup's time (written below as `BACKUP_TIME`, an ISO timestamp such as `2026-10-01T03:00:00Z`).
2. Before restoring, export from the live database:
   - the handles held after a closing (`user_id` is null) whose release date, minus 365 days, is later than the
     backup's time. Each names an account closed after the backup:

     ```
     psql "$DATABASE_URL" -c "\copy (select handle, until from handle_reservations where user_id is null and until - interval '365 days' > timestamptz 'BACKUP_TIME' order by until) to 'closed-after-backup.csv' csv header"
     ```

   - every hide and unhide made after the backup's time:

     ```
     psql "$DATABASE_URL" -c "\copy (select at, kind, user_id, sell_id, action, reason, actor from trust_audit where at > timestamptz 'BACKUP_TIME' order by at, id) to 'trust-audit-after-backup.csv' csv header"
     ```

   Keep both files on the owner's machine, outside the repository. Never paste them into an issue, a PR or a log.
3. Restore the backup.
4. For each handle in `closed-after-backup.csv`, find the restored account that holds it and re-run the product's
   account-closing path (`lib/delete.ts#deleteProfile`, the same path the settings page uses), so the closing is
   complete again, including the vendor step.
5. Replay `trust-audit-after-backup.csv` in order (oldest first), one command per row with the row's own reason and
   actor: `scripts/hide.ts profile`, `thesis`, `unhide-profile` or `unhide-thesis` with `--actor=<actor>`. Skip a row
   whose account no longer exists after step 4. Check the result with `scripts/hide.ts history <user_id>`.

This is an owner procedure. There is no SQL in this runbook that removes rows.

## 6. Breach notice: items to check (not settled law)

These are items to check with counsel or the AI legal committee's findings, not a statement of what applies:

- [ ] Federal: the FTC Safeguards Rule's notice to the FTC within 30 days of discovery, when unencrypted information of
      500 or more consumers is involved. Check whether it applies to this product.
- [ ] State breach-notification laws: each state's timeline and threshold (some are 30 days). Check the states of
      affected users.
- [ ] Who must be told: affected users, regulators, the integrated vendor (SnapTrade) if its credentials are involved.
- [ ] What the notice must hold: what happened, what information, what was done, what users can do, a contact.
- [ ] First step, from `docs/POLICY.md` "If something leaks": rotate the credential immediately, then check access logs.

## 7. What this runbook never does

- It holds no secrets, no keys, no personal addresses and no real user data.
- It never removes data: hides and unhides are reversible state changes with an audit row.
- It never asks an assistant or an automated job to close accounts or remove data.
