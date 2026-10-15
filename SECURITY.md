# Security policy

## Reporting a vulnerability

**Do not open a public issue or pull request for a security problem**, and do not post the details in a
comment. Public issues, PRs, and Actions logs are visible to everyone, and this repository is built by an
autonomous loop of GitHub Actions agents that read issue and PR text.

Report privately through GitHub's **private vulnerability reporting**:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability** (under *Advisories*).
3. Describe the issue, the impact, and how to reproduce it.

The maintainer is notified privately and will respond there. Please give us a reasonable window to fix the
issue before any public disclosure.

If private reporting is ever unavailable, open a minimal issue that says only "security issue, please enable
private reporting" with no details, and wait to be contacted.

## Scope

This project pulls **read-only** verified trading records from brokers (via SnapTrade) and publishes
derived, percentage-only performance. Reports that are especially in scope:

- Any way to extract a secret (the Claude OAuth token, `APP_SECRET_KEY`, `CRON_SECRET`, a GitHub token, or a
  broker secret) from the repository, its Actions logs, or the build loop.
- Any way an outside contributor can get the autonomous loop to run attacker-controlled code with write
  permissions or secrets, merge unreviewed code to `main`, or act on instructions injected through issue, PR,
  comment, branch-name, or commit text.
- Exposure of per-trader identity or any non-public data, or any path that reveals absolute dollar amounts or
  quantities (the product publishes percentages only).
- Authentication or authorization flaws (note that `lib/session.ts` is a development stub and must be replaced
  before any public deployment).

## Supported versions

This is a pre-launch project under active development; only the current `main` branch is supported.
