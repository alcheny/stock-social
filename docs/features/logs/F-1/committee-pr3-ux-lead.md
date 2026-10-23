COMPLIANCE: FAIL · USABILITY: DEMANDS

# F-1 · PR-3 committee · UX lead

2026-10-23, `81e79ec`, fresh `CI=1` build, port 3102, vendor fake 4162, no tick, 375 px light and dark. Screenshots:
`screenshots/pr3/committee-ux/`.

## Walk

- **Long import** (4 × 1,500 seeded activities, one simulated account, 3 s pages, one account still syncing).
  - The activities line moved every step. The status line said "0 closed trades so far" for 43 s, then 2,828.
  - The 60 s line came 60.9 s after the last new row (`importing-slow-light`).
  - "Import finished." was announced once and the banner left 5 s later (`finished-light`). CLS 0.98 (known).
- **Vendor hang, then failure.**
  - With 35 s pages, the 30 s bound held the import in `importing` and the 60 s line came on time.
  - A forced 403 showed the failed alert with "Try again" (`fail-failed-owner-dark`). The visitor saw "did not finish"
    with no badge or stats (`fail-failed-visitor-dark`).
  - "Try again" led through the notice, portal and consent. The import resumed at 1,500 and ended clean at 4,500
    activities; it was Verified only then.
- **Long profile** (2,828 closes, every row rendered): smooth scrolling, and the chart draws all points
  (`profile-chart-visitor-light`).

| | Visitor | Owner |
|---|---|---|
| HTML | 3.8 MB | 6.0 MB |
| Height | 196,879 px (≈ 240 screens) | 347,426 px |
| Tab stops before footer | 5,669 | 11,330 |

## Compliance: FAIL

On a heavy record, the footer is the only place for the F3 disclaimer and the Terms, Privacy and "How records are
calculated" links. It sits about 240 screens or 5,669 Tab presses down, and there is no skip link (A1). That is not
"plain view". Demand 1 fixes it. Everything else passes: nothing partial is ever Verified.

## Demands

1. **Bound the closed-trades list.**
   - Show the 50 most recent, with "Showing 50 of 2,828 closed trades".
   - Add a "Show 50 more" control: 44 px, focus moves to the first new row, and it works without JS.
   - Every trade stays reachable, and every chart point reaches its trade.
   - Test, at 2,828 closes: visitor HTML under 400 KB, at most 50 rows, the footer within 200 Tab presses, the page
     under 15,000 px, and no chart link to a missing anchor.
2. **Group thousands in every count** (banner, activities line, stats, chart label). Test: "2,828", never "2828".

## Notes

- With zero closes, a screen reader hears nothing for the whole paging phase.
- During a vendor hang, "Your broker is still sending history" is not quite true.
- "Too early to tell (9 of 10 bets)" beside 2,828 trades confuses.

Server and fake stopped; test users deleted.
