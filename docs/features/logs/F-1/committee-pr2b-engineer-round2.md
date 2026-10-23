COMPLIANCE: PASS

# F-1 PR-2b · committee re-sit · engineer (2026-10-23)

Ran `b2cefed` on :3103, fake on :4153; no cron tick. All stopped; 13 test users and 1 attempt deleted, vendor first.

## Round-1 findings: all fixed

- **Registration.** 6 concurrent first opens on both routes created 1 vendor user, for a trader and for a brokerage-first attempt. A DB test covers deleting the race loser.
- **Mint limit.** After 6 opens, 8 parallel calls got 4×200 and 4×429. 10 rows total.
- **Poll limit.** 5 parallel steps got one 200 and four 429s (`Retry-After: 1`), all `no-store`.
- **401 stop.** Polling stops after `signedOut`. Unit tests: 58/58 pass.
- **frame-ancestors.** Present on pages, the share image, 404, static files, redirects and every API. Only the framework's bodiless 308 lacks them.

## Probe, against a hostile socket server

- **Stalls.** No answer, drip-fed headers, and a redirect to a hang all fell back to embedded at about 1.5 s.
- **Oversized replies.** A 100 MB body after HEAD took 7 ms, a 2 MB header 9 ms, and a 20-hop loop 33 ms.
- **Cookies and cache.** The probe sends no cookies and caches its result.
- **Steering.** A URL in the query, body or referrer is ignored. A foreign `?attempt=` goes to `/login`. `/connect/continue` only links to fixed paths.

## Findings

1. **Low: the probe and vendor calls run inside the mint transaction, and probes are not deduplicated.** I ran 12 mints during a hung probe. Each took 1.6–1.9 s; the pool ran out and the feed waited 1.6 s. Fix: probe after commit, with one probe in flight per origin.
2. **Low: the probe follows redirects to any host, including loopback.** Confirmed live; only the vendor's response can trigger it. Fix: `redirect: 'manual'` and pin the vendor's portal host.
3. **Info: the poll limit and probe cache are per process.** Behind N instances a trader gets N steps per second; new instances start empty. The mint limit and registration lock are in the database and hold across instances.

Owner: check in preview whether HEAD consumes the one-time portal URL.
