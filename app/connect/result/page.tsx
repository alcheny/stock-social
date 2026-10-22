import Link from 'next/link';
import { cookies } from 'next/headers';
import { applyClocks, CONNECT_COOKIE, getConnection, ownsConnection } from '@/lib/connections.ts';
import { sessionSecret } from '@/lib/auth/sessions.ts';
import { currentUser } from '@/lib/session.ts';
import { ACCOUNT_CLAIMED_BODY, ACCOUNT_CLAIMED_TITLE } from '@/lib/claims.ts';
import { RESULT } from '@/lib/copy.ts';

// S6 declined / expired, S6c no real account, S7 abandoned / failed / claimed. Every terminal state has one retry and
// one way out; errors are role="alert". No ids or vendor details are shown.
type Kind = 'declined' | 'expired' | 'none' | 'refused' | 'abandoned' | 'failed' | 'stale';

export default async function Result({ searchParams }: { searchParams?: Promise<{ c?: string; k?: string }> }) {
  const sp = await searchParams;
  const id = Number(sp?.c);
  await applyClocks(new Date(), { id });
  const c = id > 0 ? await getConnection(id) : null;
  const me = await currentUser();
  const mine = c && ownsConnection(c, me?.id ?? null, (await cookies()).get(CONNECT_COOKIE)?.value, sessionSecret());
  const k: Kind = sp?.k === 'none' || sp?.k === 'refused' ? sp.k
    : !mine ? 'abandoned'
    : c.state === 'expired' ? 'expired'
    : c.state === 'declined' ? 'declined'
    : c.state === 'failed' ? (c.failure_reason === 'stale' ? 'stale' : 'failed')
    : 'abandoned';
  const error = k === 'abandoned' || k === 'failed' || k === 'stale' || k === 'refused';
  const text = k === 'declined' ? RESULT.declined : k === 'expired' ? `${RESULT.expiredPrefix} ${RESULT.declined}` : k === 'none' ? RESULT.none
    : k === 'abandoned' ? RESULT.abandoned : k === 'failed' ? RESULT.failed : k === 'stale' ? RESULT.stale : `${ACCOUNT_CLAIMED_TITLE} ${ACCOUNT_CLAIMED_BODY}`;
  const primary = k === 'none' ? RESULT.noneAction : k === 'refused' ? RESULT.claimedAction : k === 'declined' || k === 'expired' ? RESULT.again : RESULT.retry;
  return (
    <main className="page auth">
      <h1 tabIndex={-1} role={error ? 'alert' : undefined} data-kind={k}>{text}</h1>
      <p><Link className="button wide" href="/connect">{primary}</Link></p>
      <p><Link className="button wide secondary" href="/">{k === 'abandoned' ? RESULT.notNow : RESULT.feed}</Link></p>
    </main>
  );
}
