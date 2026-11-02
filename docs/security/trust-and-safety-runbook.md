# Trust and safety runbook

F-16 (`docs/features/F-16-trust-and-safety-slice.md`, plan `docs/features/logs/F-16-F-17/plan.md` §5.3, §5.5, §5.6,
§5.8). The owner runs every step here from their own terminal, with `DATABASE_URL` for the deployment in `.env`. No
step needs a session, a page or an email. Every hide or unhide changes state only, never removes it, and writes its own
audit row (`trust_audit`) in the same transaction. The one command that removes data is the owner's account deletion
(section 3, `scripts/owner-delete.ts`), which writes its own audit row (`trust_deletions`) with the deletion mark.

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
  The owner does it like this:
  1. **Delete**, from the owner's own terminal:

     ```
     node --env-file=.env scripts/owner-delete.ts <user_id> under-18-founded --confirm=<handle>
     ```

     `--confirm` must be the account's current handle, so a mistyped id deletes nothing. The deletion is the same
     path the settings page uses (`lib/delete.ts#deleteProfile`): the vendor user, billing, the account's rows, and
     the handle is held (retired for good if the account had a connected record).
  2. **Log**: the script writes one `trust_deletions` row (date, reason code, actor role word and the counts of what
     was deleted; no user id, handle, email or name: OD 2.22) in the same transaction as the deletion mark, so nothing
     is deleted without its log row. Check it with `node --env-file=.env scripts/owner-delete.ts history`. The reports
     about the account go with it.
  3. **Review the gate**: read the sign-up age attestation path again (F-1, `docs/COMPLIANCE.md` Section 7) and record
     what you found and changed in your own notes, outside the repository.
- If the vendor step fails, the script exits with the error and the account stays marked (hidden everywhere, its log
  row written); run the same command again, or let the hourly tick finish it.
- Other owner-decided deletions use the same script with `legal-notice` or `owner-decision` as the reason.
- Deleting an account is the owner's own decision and the owner's own action. It is never automatic and never done for
  you by an assistant or an automated job: no agent runs this script.

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

     A retired handle (OD 2.17) has no release date to count back from, so also export every retired handle held after
     a closing (`until = 'infinity'` and `user_id` is null); a restored account that holds one of them was closed
     after the backup:

     ```
     psql "$DATABASE_URL" -c "\copy (select handle from handle_reservations where user_id is null and until = 'infinity' order by handle) to 'retired-after-closing.csv' csv header"
     ```

   - every owner deletion log row made after the backup's time (section 3), so the log comes back too. The rows name
     no account (OD 2.22); the accounts themselves are found again through the closed and retired handles above:

     ```
     psql "$DATABASE_URL" -c "\copy (select reason, actor, closed_trades, activities, open_positions, notes, reports, at from trust_deletions where at > timestamptz 'BACKUP_TIME' order by at, id) to 'deletions-after-backup.csv' csv header"
     ```

   - every hide and unhide made after the backup's time:

     ```
     psql "$DATABASE_URL" -c "\copy (select at, kind, user_id, sell_id, action, reason, actor from trust_audit where at > timestamptz 'BACKUP_TIME' order by at, id) to 'trust-audit-after-backup.csv' csv header"
     ```

   Keep both files on the owner's machine, outside the repository. Never paste them into an issue, a PR or a log.
3. Restore the backup.
4. Put the deletion log back: load `deletions-after-backup.csv` into `trust_deletions` (an insert, no row is removed):

   ```
   psql "$DATABASE_URL" -c "\copy trust_deletions (reason, actor, closed_trades, activities, open_positions, notes, reports, at) from 'deletions-after-backup.csv' csv header"
   ```

   Then, for each handle in `closed-after-backup.csv` and in
   `retired-after-closing.csv`, find the restored account that holds it (skip a handle no restored account holds) and
   re-run the product's account-closing path (`lib/delete.ts#deleteProfile`, the same path the settings page uses), so
   the closing is complete again, including the vendor step.
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
- Hides and unhides never remove data: they are reversible state changes with an audit row. The only removal is the
  owner's own account deletion in section 3, with its log row.
- It never asks an assistant or an automated job to close accounts or remove data.
