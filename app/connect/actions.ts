'use server';
// S4 actions. "Import my record" is the recorded consent (consent_at); "Don't import" declines and removes the link.
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AccountClaimedError } from '@/lib/claims.ts';
import { CONNECT_COOKIE, consent, decline, getConnection, NotPendingError, ownsConnection, parseConnectionId } from '@/lib/connections.ts';
import { sessionSecret } from '@/lib/auth/sessions.ts';
import { currentUser, rememberMethod, signIn } from '@/lib/session.ts';
import { cancelIfTrader } from '@/lib/billing.ts';

async function owned(form: FormData) {
  const id = parseConnectionId(form.get('c'));
  const c = id !== null ? await getConnection(id) : null;
  const me = await currentUser();
  if (!c || !ownsConnection(c, me?.id ?? null, (await cookies()).get(CONNECT_COOKIE)?.value, sessionSecret())) redirect('/connect');
  return { c, me };
}

export async function consentAction(form: FormData) {
  const { c, me } = await owned(form);
  let user: { userId: number; handle: string };
  try {
    user = await consent(c.id);
  } catch (e) {
    if (e instanceof NotPendingError) redirect(`/connect/result?c=${c.id}`);
    if (e instanceof AccountClaimedError) redirect(me ? `/u/${me.handle}?connect=account-claimed` : `/connect/result?c=${c.id}&k=refused`);
    throw e;
  }
  // F-3 (committee condition 14): a paying subscriber who connects a broker is canceled at once with a pro-rata refund.
  // Never blocks the connection: on a processor error the nightly reconciliation finishes it.
  try { await cancelIfTrader(user.userId); } catch (e) { console.error('billing: cancel on connect failed', e instanceof Error ? e.message : 'unknown'); }
  if (!me) {
    // Sign-in by completing a connection. The attempt is consumed: its browser binding has no further use.
    await signIn(user.userId);
    await rememberMethod('brokerage');
    (await cookies()).set(CONNECT_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/connect', maxAge: 0 });
  }
  redirect(`/u/${user.handle}`);
}

export async function declineAction(form: FormData) {
  const { c } = await owned(form);
  await decline(c.id);
  redirect(`/connect/result?c=${c.id}`);
}
