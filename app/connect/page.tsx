import Link from 'next/link';
import { sql } from '@/lib/db.ts';
import { currentUser } from '@/lib/session.ts';
import { SIGNIN, TRUST_NOTICE, VENDOR_SECURITY_URL } from '@/lib/copy.ts';
import { providersFromEnv } from '@/lib/auth/providers.ts';
import { recordFunnel } from '@/lib/funnel.ts';

// S2 trust notice (docs/features/logs/F-1/plan.md §2): a page before any portal script, signed in or not.
// Every line is one the vendor publishes itself; no endorsement, no audit of any record (POLICY F3a).
// Signed in, the primary goes to today's redirect flow (/connect/start); PR-2b replaces it with the embedded portal.
// Signed out there is no primary: a status line says what comes first and lists the sign-in options (sign-in by
// connection lands in PR-2), so brokerage-first never loops back to S1 unexplained.
export default async function Connect({ searchParams }: { searchParams?: Promise<{ attempt?: string }> }) {
  const me = await currentUser();
  const attempt = Number((await searchParams)?.attempt);
  if (attempt > 0) {
    const [a] = await sql`select user_id, exists(select 1 from funnel_events f where f.attempt_id = signup_attempts.id and f.name = 'notice_seen') as seen from signup_attempts where id = ${attempt}`;
    if (a && !a.seen && (a.user_id === null || a.user_id === me?.id)) await recordFunnel(attempt, 'notice_seen');
  }
  const options = [...providersFromEnv().map((p) => ({ key: p.key, label: SIGNIN.provider(p.label) })), { key: 'email', label: TRUST_NOTICE.emailOption }];
  return (
    <main className="page auth">
      <h1>{TRUST_NOTICE.title}</h1>
      <ul className="notice">
        {TRUST_NOTICE.lines.map((l) => <li key={l}>{l}</li>)}
      </ul>
      {/* Each link on its own row (44px): no separator to orphan at 375px. */}
      <p className="small"><a className="tap" href={VENDOR_SECURITY_URL} rel="noopener noreferrer" target="_blank">{TRUST_NOTICE.vendorLink}</a> <span className="muted">({TRUST_NOTICE.vendorLinkNote})</span></p>
      <p className="small"><Link className="tap" href="/how">{TRUST_NOTICE.howLink}</Link></p>
      {me ? (
        <>
          <p><a className="button wide" href="/connect/start">{TRUST_NOTICE.primary}</a></p>
          <p className="small"><Link className="tap" href="/settings">{TRUST_NOTICE.settingsLink}</Link></p>
        </>
      ) : (
        <>
          <p role="status">{TRUST_NOTICE.signInFirst}</p>
          <ul className="options">
            {options.map((o) => <li key={o.key}><Link className="button wide secondary" href={`/login?method=${o.key}`}>{o.label}</Link></li>)}
          </ul>
        </>
      )}
    </main>
  );
}
