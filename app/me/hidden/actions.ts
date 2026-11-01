'use server';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { showTradeAgain } from '@/lib/likes.ts';

// F-2 PR-5: "Show again" on /me/hidden, a plain form post (works without JavaScript). Signed in only; by the trade's key.
export async function showTradeAgainForm(key: unknown, after: unknown): Promise<void> {
  const me = await currentUser();
  if (!me) redirect('/login');
  const ok = await showTradeAgain(me.id, key);
  const page = typeof after === 'string' && /^[0-9]{1,17}\.[0-9a-f]{64}$/.test(after) ? `after=${after}&` : '';
  redirect(ok && typeof key === 'string' ? `/me/hidden?${page}back=${key}` : '/me/hidden');
}
