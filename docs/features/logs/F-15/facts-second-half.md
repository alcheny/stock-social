# F-15 second half: fact sheet (orchestrated build session, 2026-11-01)

Requested by the orchestrator after #69 merged: one PR from `claude/f15-second-half` (off main 1a5d4ab, with #71 and
#72) holding (1) "F-15 second half: share_action rows" (E5, G2), (2) "F-15: beacon into the layout" and (3) the ponytail
"no canonical link". Same committee cycle and gates as the first half (`plan.md`, `committee-2026-11-01.md`).

## Owner decisions that bind this half (feature file)
- `share_action` rows are additive. The four share columns on `users` stay in the schema (no drop, no data deleted);
  reads move to the new rows. Rows tied to a user are deleted with the profile and carry no thesis text or account id.
  This half edits `app/u/[handle]/share-prompt.tsx` and `lib/display-log.ts` (F-13 has merged, so it may).
- Acceptance: "`share_action` rows: one row per share action, deleted with the profile, no thesis text or account id
  (db test)" and "a test fails if any rollup, beacon or `share_action` table stores an IP, user agent, viewer id, session
  id, cookie value or fingerprint".
- Readout: G2 reads "after the share_action slice" until it lands; the strict DESIGN number beside any other; no cell
  < 5; no handle or return. Counts never an input to ordering, scores, streaks or badges; never shown to traders.
- Market council E5: `share_action` rows: trader id; time; surface; outcome (sheet or copy); record sign at that moment;
  format. Never kept: destination, recipients. G2 = G1 traders with >= 1 E5 by week 8, plus a 14-day rate per weekly
  cohort; sheet and copy reported apart (gate definitions beyond strict are MRC2-3, the owner's).
- Orchestrator: "aggregate only, the same privacy bar as view_rollup, suppression in the readout, deletion and purge,
  and SCHEMA_MAP".

## What exists (main 1a5d4ab)
- Share controls: `app/share-button.tsx` (`onShared(how: 'copied' | 'shared')`, via class chosen at click time),
  callers `app/u/[handle]/share-card.tsx` (profile "Share my record" → `markShareImageSaved`, month recap → nothing),
  `app/u/[handle]/share-prompt.tsx` (profile → `recordSharePromptAction(how)`), `app/u/[handle]/trade/[sellId]/trade-share.tsx`
  (trade page and month page → `recordTradeShared()` when the owner shares).
- Old columns (`users`): `share_prompt_seen_at`, `share_prompt_action` (first positive action wins),
  `trade_shared_at` (overwritten each time), `share_image_saved_at` (first only). Server actions in `app/actions.ts`.
  Nothing in `app/` reads them except `share_prompt_seen_at` (whether to show the prompt, `lib/share-prompt.ts`).
- `lib/display-log.ts`: append-only daily snapshot of what a public record displayed (one row a day per trader).
- Readout: `scripts/f15-readout.ts` (G2 prints `G2_TEXT`), shared base cells with complementary suppression, complete
  ISO weeks only.
- Beacon: `app/view-beacon.tsx` mounted in `app/template.tsx` (fragment). F-13 has merged, so it may move into
  `app/layout.tsx` (`<body>`), and the template is deleted. `lib/f15-isolation.test.ts` asserts the template mount today.
- Canonical: no page sets `alternates.canonical`; no `metadataBase`. `lib/billing.ts#siteOrigin()` gives the configured
  public origin (NEXT_PUBLIC_SITE_URL, else the platform production URL, else localhost).
- Privacy maps: `lib/privacy-retention.ts#SCHEMA_MAP`, `lib/privacy-purge.ts` (step 'views' exists), `lib/delete.ts`.
