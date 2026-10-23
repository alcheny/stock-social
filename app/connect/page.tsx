import Link from 'next/link';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db.ts';
import { currentUser } from '@/lib/session.ts';
import { sessionSecret } from '@/lib/auth/sessions.ts';
import { boundAttempt, CONNECT_COOKIE, refuseUnbound } from '@/lib/connections.ts';
import { SIGNIN, TRUST_NOTICE, VENDOR_SECURITY_URL } from '@/lib/copy.ts';
import { providersFromEnv } from '@/lib/auth/providers.ts';
import { recordFunnel } from '@/lib/funnel.ts';
import { PortalButton } from './portal-button.tsx';

// S2 trust notice (docs/features/logs/F-1/plan.md §2): a page before any portal script, signed in or not.
// Every line is one the vendor publishes itself; no endorsement, no audit of any record (POLICY F3a).
// The primary opens the vendor's portal embedded in a modal (S3, ./portal-button.tsx); its href is the redirect flow
// (/connect/start), which in-app browsers and every fallback use.
// Brokerage-first (committee fix): a browser holding the signed cookie of its own open, attested attempt (written at
// S1) gets the same primary; /connect/start reads the cookie, never an id. Signed out with no bound attempt there is
// no primary: a status line says what comes first and lists the sign-in options. An attempt id in the URL is never
// trusted; one this browser's cookie does not match is refused and counted (lib/connections.ts#refuseUnbound).
export default async function Connect({ searchParams }: { searchParams?: Promise<{ attempt?: string }> }) {
  const me = await currentUser();
  const attempt = me ? null : await boundAttempt((await cookies()).get(CONNECT_COOKIE)?.value, sessionSecret());
  const presented = (await searchParams)?.attempt;
  if (!me && presented !== undefined && presented !== String(attempt)) await refuseUnbound(presented);
  if (attempt !== null) {
    const [a] = await sql`select exists(select 1 from funnel_events f where f.attempt_id = ${attempt} and f.name = 'notice_seen') as seen`;
    if (!a.seen) await recordFunnel(attempt, 'notice_seen');
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
          <PortalButton label={TRUST_NOTICE.primary} />
          {/* After sign-in the trader lands here (committee item 7); the profile stays one tap away. */}
          <p className="small"><Link className="tap" href={`/u/${me.handle}`}>{TRUST_NOTICE.profileLink}</Link></p>
          <p className="small"><Link className="tap" href="/settings">{TRUST_NOTICE.settingsLink}</Link></p>
        </>
      ) : attempt !== null ? (
        <PortalButton label={TRUST_NOTICE.primary} />
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
