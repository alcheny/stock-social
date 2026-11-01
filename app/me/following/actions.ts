'use server';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { removeExpiredHide, traderId } from '@/lib/follows.ts';

// F-2 PR-5 (business lead demand 2): "Remove" on a "Not interested" that ran its 90 days. Signed in only; no JavaScript needed.
export async function removeExpiredHideForm(handle: unknown): Promise<void> {
  const me = await currentUser();
  if (!me) redirect('/login');
  const trader = await traderId(handle);
  if (trader && trader !== me.id) await removeExpiredHide(me.id, trader);
  redirect('/me/following');
}
