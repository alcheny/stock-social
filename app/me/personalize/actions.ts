'use server';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { clearActivity, setActivity, setPersonalize } from '@/lib/discovery/activity.ts';

// F-2 PR-5 (criteria 12, 13): the two switches and "Clear my activity", plain form posts (no JavaScript needed). Signed
// in only; each lands back on /me/personalize with `?saved=`, which the page checks against the stored state.
export async function setPersonalizeForm(on: boolean): Promise<void> {
  const me = await currentUser();
  if (!me) redirect('/login');
  await setPersonalize(me.id, on);
  redirect(`/me/personalize?saved=${on ? 'feedOn' : 'feedOff'}`);
}
export async function setActivityForm(on: boolean): Promise<void> {
  const me = await currentUser();
  if (!me) redirect('/login');
  await setActivity(me.id, on);
  redirect(`/me/personalize?saved=${on ? 'activityOn' : 'activityOff'}`);
}
export async function clearActivityForm(): Promise<void> {
  const me = await currentUser();
  if (!me) redirect('/login');
  const n = await clearActivity(me.id);
  redirect(`/me/personalize?saved=${n > 0 ? 'cleared' : 'nothing'}`);
}
