import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { applyClocks, CONNECT_COOKIE, getConnection, ownsConnection, parseConnectionId } from '@/lib/connections.ts';
import { sql } from '@/lib/db.ts';
import { FocusHeading } from './focus-heading.tsx';
import { NotFound } from './connection-not-found.tsx';
import { sessionSecret } from '@/lib/auth/sessions.ts';
import { currentUser } from '@/lib/session.ts';
import { ACCOUNT_CLAIMED_BODY, ACCOUNT_CLAIMED_TITLE } from '@/lib/claims.ts';
import { RESULT } from '@/lib/copy.ts';

// S6 declined / expired, S6c no real account, S7 abandoned / failed / claimed. Every terminal state has one retry and
// one way out (S7a also "Continue in a new page"); errors are role="alert" and take focus. No ids or vendor details are shown. `?k=abandoned` needs no
// connection (the portal returned without one); any other call without a valid, owned `c` is a plain not-found page
// (D3); a consented connection goes to the profile and a pending one back to consent (D7).
type Kind = 'declined' | 'expired' | 'none' | 'refused' | 'abandoned' | 'failed' | 'stale';

export default async function Result({ searchParams }: { searchParams?: Promise<{ c?: string; k?: string }> }) {
  const sp = await searchParams;
  const id = parseConnectionId(sp?.c);
  if (id === null && sp?.k !== 'abandoned') return <NotFound />;
  if (id !== null) await applyClocks(new Date(), { id });
  const c = id !== null ? await getConnection(id) : null;
  const me = await currentUser();
  const mine = c && ownsConnection(c, me?.id ?? null, (await cookies()).get(CONNECT_COOKIE)?.value, sessionSecret());
  if (id !== null && !mine && sp?.k !== 'abandoned') return <NotFound />;
  if (mine && (c.state === 'importing' || c.state === 'connected')) {
    const [u] = await sql`select handle from users where id = ${c.user_id}`;
    redirect(u ? `/u/${u.handle}` : '/connect');
  }
  if (mine && c.state === 'pending' && sp?.k !== 'none' && sp?.k !== 'refused') redirect(`/connect/consent?c=${c.id}`);
  const k: Kind = sp?.k === 'none' || sp?.k === 'refused' ? sp.k
    : !mine ? 'abandoned'
    : c.state === 'expired' ? 'expired'
    : c.state === 'declined' ? 'declined'
    : c.state === 'failed' ? (c.failure_reason === 'stale' ? 'stale' : 'failed')
    : 'abandoned';
  const error = k === 'abandoned' || k === 'failed' || k === 'stale' || k === 'refused';
  // PR-2b: S6 expired is a short heading with the rest as body text, like S6b.
  const text = k === 'declined' ? RESULT.declined : k === 'expired' ? RESULT.expiredPrefix : k === 'none' ? RESULT.none
    : k === 'abandoned' ? RESULT.abandoned : k === 'failed' ? RESULT.failed : k === 'stale' ? RESULT.stale : ACCOUNT_CLAIMED_TITLE;
  // S6b: a short heading; the explanation is body text, read with the focused heading through aria-describedby.
  const body = k === 'refused' ? ACCOUNT_CLAIMED_BODY : k === 'expired' ? RESULT.declined : null;
  const primary = k === 'none' ? RESULT.noneAction : k === 'refused' ? RESULT.claimedAction : k === 'declined' || k === 'expired' ? RESULT.again : RESULT.retry;
  return (
    <main className="page auth">
      <h1 id="result-heading" tabIndex={-1} role={error ? 'alert' : undefined} data-kind={k} aria-describedby={body ? 'result-body' : undefined}>{text}</h1>
      {body && <p id="result-body">{body}</p>}
      {error && <FocusHeading id="result-heading" />}
      <p><Link className="button wide" href="/connect">{primary}</Link></p>
      {/* S7a (plan §8 item 1): the second action is the redirect flow on the same attempt, a plain link (a route, not a page). */}
      {k === 'abandoned' && <p><a className="button wide secondary" href="/connect/start">{RESULT.continueNewPage}</a></p>}
      <p><Link className="button wide secondary" href="/">{k === 'abandoned' ? RESULT.notNow : RESULT.feed}</Link></p>
    </main>
  );
}
