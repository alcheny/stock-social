DEMANDS

# F-1 · Plan sign-off · UX lead

Date: 2026-10-22. Read: `plan.md`, both round-1 plans, the feature file. The S2 button swap, the
derived handle, the 60-second banner line and the added S9 screen meet the bar. The two substitutes
are honest about what the vendor's frame allows; the demands below close what they leave open.

1. **S3: keep "Open in a new page instead" visible for the whole life of the modal, not only while
   loading.** The fallback fires on no `window.opener`, a portal error, or the 8 s link. A desktop
   browser that silently blocks the broker popup produces none of those: the portal loads, the
   trader taps their broker, nothing happens. Their only exit is Close → S7a → "Try again" → the
   same dead end. The link is also S7a's second action ("Continue in a new page").

2. **S5: the import must progress without the trader's browser, and the banner must say so.** Each
   import step is driven by a client poll. A trader who closes the tab after a minute (the vendor's
   initial sync "can take minutes") returns to a banner frozen at "N trades so far". The hourly tick
   must advance `importing` rows; the 60 s line becomes "Your broker is still sending history. You
   can leave; the import continues." An `importing` row older than the expiry window moves to
   `failed` (S7b), never an indefinite banner.

3. **S5/S8: never show the empty-record copy while state is `importing`.** "No closed trades yet.
   Your record starts with your first close." under "Importing your record" says two contradictory
   things. While importing, the body shows positions (if fetched) and "Your trades appear here as
   they import." Same signed out.

4. **S9: deletion needs a second, explicit confirmation.** One 44 px primary deletes personal data,
   the vendor link and the record, and locks the handle for a year; a mis-tap on a phone is
   irreversible. The primary opens a confirm view ("This cannot be undone." with "Delete my
   profile" and "Keep it"); no typed handle, no pre-checked box, no shaming.

Non-blocking notes

- The provisional handle is never derived from the email address.
- Round-1 demand 4 stands: the fallback is shown on the preview with the real portal and popups
  blocked, not only against the fake that posts an error.
- "Import finished." is one line, visually distinct from the importing banner, no motion.
