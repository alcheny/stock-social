'use server';
// S4 actions. "Import my record" is the recorded consent (consent_at); "Don't import" declines and removes the link.
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AccountClaimedError } from '@/lib/claims.ts';
import { CONNECT_COOKIE, consent, decline, getConnection, NotPendingError, ownsConnection } from '@/lib/connections.ts';
import { sessionSecret } from '@/lib/auth/sessions.ts';
import { currentUser, rememberMethod, signIn } from '@/lib/session.ts';

async function owned(form: FormData) {
  const id = Number(form.get('c'));
  const c = id > 0 ? await getConnection(id) : null;
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
  if (!me) { await signIn(user.userId); await rememberMethod('brokerage'); } // sign-in by completing a connection
  redirect(`/u/${user.handle}`);
}

export async function declineAction(form: FormData) {
  const { c } = await owned(form);
  await decline(c.id);
  redirect(`/connect/result?c=${c.id}`);
}
