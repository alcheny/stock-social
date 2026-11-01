# Parallel build of 2026-11-01: file ownership and merge order

The owner's autonomous build runs ten sessions at once. Each owns the files below; everything else is shared and
takes additive edits only (a block named for the session; schema appended and idempotent; tests in new files).
The orchestrator merges one PR at a time in the order below, and every other session then merges `main` into its
branch (never rebase or force-push).

| Session | Owns |
|---|---|
| PR #25 (orchestrator) | scripts/team.ts, scripts/features.ts, scripts/autopilot.ts, .github/workflows/features.yml and build.yml, team/, docs/IDEAS.md, docs/features/*.md decisions |
| Privacy groundwork | lib/launch-gate.ts, lib/privacy-*.ts, lib/display-log.ts, the tick's purge additions, the likes and consent copy |
| CI speed | .github/workflows/ci.yml |
| Security hardening | next.config security headers and CSP, lib/rate-limit.ts, docs/security/ |
| Stock splits | lib/trades.ts matcher, lib/corporate-actions.ts |
| Sharded sync | lib/sync.ts structure, app/api/sync/**, lib/sync-*.ts |
| F-6 open positions | lib/open-split.ts, F-6 additions to the profile, feed card and pane, app/t/** |
| F-4 share card | lib/record-card.ts, lib/confidence.ts, the card image routes, share-prompt.tsx |
| F-2 PR-5 and PR-6 | lib/discovery/**, app/api/events/**, app/me/** |
| F-3 billing and Record tools | lib/billing.ts, lib/record-tools*.ts, app/api/billing/**, the Record tools and account routes |
| Idea board | docs/ideas/, register rows in docs/IDEAS.md, "Idea board" notes in feature files |

Merge order (smallest blast radius first, then dependencies): #25 → CI speed → Privacy groundwork → Security
hardening → Stock splits → Sharded sync → F-6 → F-4 → F-2 → F-3 → Idea board. A PR that is green and reviewed
earlier than its turn may merge earlier when it does not conflict with an unmerged one above it.

Known overlaps to handle at merge: lib/sync.ts (sync structure, privacy log hygiene); lib/feed.ts and app/page.tsx
(F-2, F-6); app/u/[handle]/page.tsx (F-4 record length, F-6); lib/copy.ts, app/globals.css, db/schema.sql (most
sessions); lib/trades.ts (splits; F-6 only if needed).
