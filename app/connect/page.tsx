import Link from 'next/link';
import { sql } from '@/lib/db.ts';
import { currentUser } from '@/lib/session.ts';
import { TRUST_NOTICE, VENDOR_SECURITY_URL } from '@/lib/copy.ts';
import { recordFunnel } from '@/lib/funnel.ts';

// S2 trust notice (docs/features/logs/F-1/plan.md §2): a page before any portal script, signed in or not.
// Every line is one the vendor publishes itself; no endorsement, no audit of any record (POLICY F3a).
// The primary goes to today's redirect flow (/connect/start); PR-2b replaces it with the embedded portal.
export default async function Connect({ searchParams }: { searchParams?: Promise<{ attempt?: string }> }) {
  const me = await currentUser();
  const attempt = Number((await searchParams)?.attempt);
  if (attempt > 0) {
    const [a] = await sql`select user_id from signup_attempts where id = ${attempt}`;
    if (a && (a.user_id === null || a.user_id === me?.id)) await recordFunnel(attempt, 'notice_seen');
  }
  return (
    <main className="page auth">
      <h1>{TRUST_NOTICE.title}</h1>
      <ul className="notice">
        {TRUST_NOTICE.lines.map((l) => <li key={l}>{l}</li>)}
      </ul>
      <p className="small">
        <a className="tap" href={VENDOR_SECURITY_URL} rel="noopener noreferrer" target="_blank">{TRUST_NOTICE.vendorLink}</a> <span className="muted">({TRUST_NOTICE.vendorLinkNote})</span>
        {' · '}<Link className="tap" href="/how">{TRUST_NOTICE.howLink}</Link>
      </p>
      <p><a className="button wide" href={me ? '/connect/start' : `/login${attempt > 0 ? `?method=brokerage` : ''}`}>{TRUST_NOTICE.primary}</a></p>
      {!me && <p className="muted small">Sign in first; the connection then opens read-only.</p>}
    </main>
  );
}
