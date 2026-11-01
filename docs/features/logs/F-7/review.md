# F-7 independent code review (2026-11-01)

Reviewer: a fresh-context subagent that did not write the code; read-only over the full diff from the merge-base with
main, against the feature file's acceptance criteria, `plan.md` (rounds 3-5) and the legal conditions C1-C24.

**Blocking findings: none verified.**

Non-blocking (verified), with what was done:
1. A priced sale could disappear uncounted when the public matcher's lot epsilon and the FIFO matcher's relative
   epsilon disagree (large fractional lots). Fixed: counted.
2. "Bought: filing" links ignored amendments and could link an unrelated same-day purchase. Fixed: effective rows only.
3. Response bodies were bounded only when a length header was present; the daily index had no cap. Fixed: byte cap
   on the stream for both.
4. The block reader's lazy pattern could go quadratic on many unclosed tags. Bounded (see the fix round notes).
5. Filing links accepted any host from the index. Fixed: the link's origin must equal the configured base's.
6. Viewer lists (following, not interested, likes) could show a hidden or removed filer, or any filer with the switch
   off. Fixed: the visibility condition applies there.
7. The feed pane shows a filer's closes inside the 30-day floor, as the profile does: kept (the viewer opened that
   filer, which the legal list of feed reads excludes); recorded for the committee.
8. The paged feed's late-import array scans public transactions by creation time; same pinning gap as broker data
   (a late purchase that newly prices an old sale). Kept, noted as a known limit.
9. Handle edge cases: combining accents become `_`; two taken candidates make a filing fail on every read; existing
   pre-F-7 handles starting with `pf_` can't use the dev login. Kept, noted as known limits.
10. One test applies the raw schema instead of the shared helper and leaves its own funnel rows. Kept (scoped rows).

Checked and correct: FIFO math (unknown-cost, pre-report and shortfall lots; amendments; reconciliation; derivative
and indirect rows; feed floor); no Verified or plain Demo label on any filer surface; no amounts in HTML or logs;
switch and importer semantics, User-Agent, one worker at ≥ 250 ms, backoff; no session for a filer by any path; feed
floor and visibility on every feed-side read, stock pages, images and the sitemap; Follow, Like and record tools refuse
a filer; removal; SQL identifiers from constants only; schema idempotent with no destructive lines.
