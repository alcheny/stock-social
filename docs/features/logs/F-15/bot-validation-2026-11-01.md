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
