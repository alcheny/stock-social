import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { accountCounts, applyClocks, CONNECT_COOKIE, getConnection, ownsConnection, PENDING_HOURS } from '@/lib/connections.ts';
import { sessionSecret } from '@/lib/auth/sessions.ts';
import { currentUser } from '@/lib/session.ts';
import { CONSENT } from '@/lib/copy.ts';
import { consentAction, declineAction } from '../actions.ts';

// S4 consent: names the import depth before anything is read. The 24-hour clock is applied on this read too, so an
// expired link never shows a consent form (plan §1: lazy marking).
export default async function Consent({ searchParams }: { searchParams?: Promise<{ c?: string }> }) {
  const id = Number((await searchParams)?.c);
  await applyClocks(new Date(), { id });
  const c = id > 0 ? await getConnection(id) : null;
  const me = await currentUser();
  if (!c || !ownsConnection(c, me?.id ?? null, (await cookies()).get(CONNECT_COOKIE)?.value, sessionSecret())) redirect('/connect');
  if (c.state !== 'pending') redirect(`/connect/result?c=${c.id}`);
  const { total, paper } = accountCounts(c);
  const by = new Date(c.pending_at.getTime() + PENDING_HOURS * 3_600_000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' });
  return (
    <main className="page auth">
      <h1>{CONSENT.title}</h1>
      <p>{CONSENT.linked}</p>
      <ul className="notice">
        {CONSENT.lines(total, paper).map((l) => <li key={l}>{l}</li>)}
      </ul>
      <p className="muted small">{CONSENT.deadline(by)}</p>
      <form action={consentAction}><input type="hidden" name="c" value={c.id} /><button className="wide">{CONSENT.primary}</button></form>
      <form action={declineAction}><input type="hidden" name="c" value={c.id} /><button className="wide secondary">{CONSENT.secondary}</button></form>
    </main>
  );
}
