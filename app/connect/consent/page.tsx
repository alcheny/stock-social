import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { accountCounts, applyClocks, CONNECT_COOKIE, getConnection, ownsConnection, parseConnectionId } from '@/lib/connections.ts';
import { sql } from '@/lib/db.ts';
import { NotFound } from '../result/connection-not-found.tsx';
import { sessionSecret } from '@/lib/auth/sessions.ts';
import { currentUser } from '@/lib/session.ts';
import { CONSENT, LAUNCH } from '@/lib/copy.ts';
import { connectAllowed } from '@/lib/privacy-gate-data.ts';
import { consentAction, declineAction } from '../actions.ts';

// S4 consent: names the import depth before anything is read. The 24-hour clock is applied on this read too, so an
// expired link never shows a consent form (plan §1: lazy marking). A missing or malformed id is a plain not-found page
// (D3); a connection already consented goes to the profile, where the import shows (D7). Committee fix (item 7): no lead
// line, one scope line and a deadline with no clock time, so the primary sits above the fold at 375×667.
export default async function Consent({ searchParams }: { searchParams?: Promise<{ c?: string }> }) {
  const id = parseConnectionId((await searchParams)?.c);
  if (id === null) return <NotFound />;
  await applyClocks(new Date(), { id });
  const c = await getConnection(id);
  const me = await currentUser();
  if (!c || !ownsConnection(c, me?.id ?? null, (await cookies()).get(CONNECT_COOKIE)?.value, sessionSecret())) return <NotFound />;
  if (c.state === 'importing' || c.state === 'connected') {
    const [u] = await sql`select handle from users where id = ${c.user_id}`;
    redirect(u ? `/u/${u.handle}` : '/connect');
  }
  if (c.state !== 'pending') redirect(`/connect/result?c=${c.id}`);
  const { total, paper } = accountCounts(c);
  const allowed = await connectAllowed(me);
  // Privacy work (D9): the deadline sits under the buttons (consent-page CSS block) so the primary stays above the fold
  // with the longer public-scope line. Launch gate (D8): closed, no import; "Don't import" still removes the link.
  return (
    <main className="page auth consent">
      <h1>{CONSENT.title}</h1>
      <ul className="notice">
        {CONSENT.lines(total, paper).map((l) => <li key={l}>{l}</li>)}
      </ul>
      {allowed
        ? <form action={consentAction}><input type="hidden" name="c" value={c.id} /><button className="wide">{CONSENT.primary}</button></form>
        : <p role="status">{LAUNCH.connectClosed}</p>}
      <form action={declineAction}><input type="hidden" name="c" value={c.id} /><button className="wide secondary">{CONSENT.secondary}</button></form>
      <p className="muted small">{CONSENT.deadline}</p>
    </main>
  );
}
