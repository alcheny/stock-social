'use server';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { listsQuery, removeExpiredHide, traderId, type ListCursors } from '@/lib/follows.ts';
import { undoNotInterested } from '../../discovery-actions.ts';

// F-2 PR-5 (business lead demand 2): "Remove" on a "Not interested" that ran its 90 days. Signed in only; no JavaScript
// needed. Known-limits sweep (lists): both actions come back to the same pages of each list (`at`, checked again here).
export async function removeExpiredHideForm(handle: unknown, at?: ListCursors): Promise<void> {
  const me = await currentUser();
  if (!me) redirect('/login');
  const trader = await traderId(handle);
  if (trader && trader !== me.id) await removeExpiredHide(me.id, trader);
  redirect(`/me/following${listsQuery(at)}`);
}
// "Show again" from /me/following: app/discovery-actions.ts#showAgainForm, keeping the page position.
export async function showAgainHereForm(handle: unknown, at?: ListCursors): Promise<void> {
  const r = await undoNotInterested(handle);
  if (r.ok && typeof handle === 'string') redirect(`/me/following${listsQuery(at, { back: handle })}`);
}
