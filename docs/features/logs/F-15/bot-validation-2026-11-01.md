# F-15 bot-filter validation, 2026-11-01 (scripted, local)

Re-run after the code-review fixes (rate cap before the drop write) on the merged branch; same result except the
burst row's drop count, as designed.

Run: `npm run build`, `ALLOW_DEV_AUTH=1 TRUST_PROXY_HEADERS=1 npm run start`, then
`node --env-file=.env scripts/f15-bot-validation.ts` (one machine, local Postgres 16, production build). Groups ran in
the script's order (human first) with a 61 s pause past the rate window between groups. One throwaway trader; its rows
were deleted at the end.

| group | n | counted | dropped | drop reasons |
|---|---|---|---|---|
| human (desktop agent, automation flag hidden, 2.5 s on the page) | 50 | 50 | 0 | — |
| nojs (declared-bot agents, no script engine) | 50 | 0 | 50 | no beacon sent |
| headless (25 headless agent, 25 automation flag) | 50 | 0 | 50 | declared_bot 25, automation 25 |
| preview (script-running, flag hidden, declared preview agent) | 50 | 0 | 50 | declared_bot 50 |
| post (20 declared-bot, 15 no fetch metadata, 15 cross-site) | 50 | 0 | 50 | declared_bot 20, no_fetch_metadata 15, cross-site refused (403) 15 |
| forged posts copying a browser's agent and headers (not in the 200) | 20 | 20 | 0 | — |
| burst, 70 posts from one address (not in the 200) | 70 | 60 | 10 | rate 1 (one drop row write per client and minute; the other 9 answered, not written) |

- Scripted (200): dropped 200/200 = 100.0% (bar ≥ 95%). Script-running visits and direct posts alone (150): 150/150 =
  100.0%. Without the rate rule: 200/200 = 100.0% (no scripted group hit the cap).
- Human (50): counted 50/50 = 100.0% (bar ≥ 95%). False-count rate on the scripted set: 0.0%.
- **Result: pass.**

Known bias, stated plainly: the human group is a real browser with its automation flag hidden and a desktop agent, so it
is exactly as visible to the filter as a script that does the same; the forged-post row shows a deliberate forger is
counted. The filter stops declared and default automated clients, not a determined one; the drop table in the readout
watches for drift. Real preview services and real devices were not tested: that is the owner's check before week 1
(owner item), logging drop reasons only.

Change after the full e2e run (2026-11-01): the beacon now sends nothing at all when the browser reports automation
(existing e2e tests count every POST a page makes, and every automated run would otherwise add one). The headless
group's 25 automation-flag visits therefore send no beacon instead of being dropped as `automation` (the route still
drops a beacon that says so); counted stays 0 of 50, so the result above is unchanged. Pinned by
`e2e/f15-beacon.spec.ts` ("automation: a browser that reports automation sends no beacon at all").

Correction after the orchestrator's review (2026-11-01): the burst row tested one address with one user agent. Then
the cap was keyed on address and agent together, so rotating the agent from one address got past it (1000 rotated
posts were all allowed). The cap now has a per-address bucket (180 a minute) in front of the per-address-and-agent bucket
(60 a minute), pinned by a unit test that rotates the agent (`lib/f15-views.test.ts`). What the cap covers: one trusted
client address, per server instance, per minute; it does not cover many addresses, or a server with no trusted address
header (skipped there, see Known limits).
