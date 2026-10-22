SIGNED

# F-1 · Plan sign-off · UX lead · round 2

Date: 2026-10-22. Read: `plan.md` §8 against my round-1 demands, as the trader meets each:

1. **Persistent redirect link.** S3 keeps "Open in a new page instead" from open until success, so
   a trader whose popup is silently blocked has an exit inside the modal; S7a's second action is
   "Continue in a new page" on the same attempt. Met.
2. **Import without the browser.** The hourly tick advances every `importing` row; profile reads
   mark staleness lazily; 24 hours without progress → `failed` (S7b), so no banner lives forever;
   the 60 s line ends "You can leave; the import continues." Met.
3. **No empty-record copy while importing.** S5 body is positions + "Your trades appear here as
   they import."; S8 copy only in `connected`; same signed out; unit test by state. Met.
4. **Second deletion confirmation.** S9 view 2, "This cannot be undone.", only its primary deletes;
   integration test that the first action deletes nothing. Met.

Non-blocking notes

- "You can leave; the import continues." is a promise the hourly call (§6 #7) keeps. The plan ties
  #7 to Status: built; keep it there. That line never ships without the tick.
- Between a closed tab and the next tick a returning trader sees the same count for up to an hour;
  the "still sending history" line covers it.
- Round-1 notes (handle never from the email; preview check with popups blocked; "Import
  finished." one still line) are in the plan.
