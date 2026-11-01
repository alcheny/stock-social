'use server';
// F-3: "Manage subscription" and "Cancel subscription" open the processor's hosted portal (committee K18: canceling is
// online, from a link labeled exactly "Cancel subscription"). Every change comes back through webhooks.
import { redirect } from 'next/navigation';
import { logSafe } from '@/lib/privacy-log.ts';
import { currentUser } from '@/lib/session.ts';
import { portalUrl, siteOrigin } from '@/lib/billing.ts';

export async function openPortal() { return portal(false); }
// "Cancel subscription" opens the portal's cancel flow for the live subscription directly.
export async function openCancel() { return portal(true); }

async function portal(cancel: boolean) {
  const me = await currentUser();
  if (!me) redirect('/login');
  let url: string | null = null;
  try { url = await portalUrl(me.id, siteOrigin(), cancel); } catch (e) { console.error('portal failed', logSafe(e)); }
  redirect(url ?? '/account?e=portal');
}
