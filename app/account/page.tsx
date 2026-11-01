import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { access, billingAvailable, canceledOnConnect, rowEntitles, testMode } from '@/lib/billing.ts';
import { BILLING, RECORD_TOOLS } from '@/lib/copy.ts';
import { Disclaimer, PastDueBanner, TestModeLabel } from '../tools/parts.tsx';
import { openCancel, openPortal } from './actions.ts';
import { Activating } from './activating.tsx';

// F-3 · the account page (docs/features/logs/F-3/plan.md §8): plan, renewal or end date, the cancel path and refund
// line, the billing contact, Manage and Cancel (hosted portal), Download my data. Traders see only that Record tools is
// included: never a price, plan or checkout (committee K14). Private: noindex, no referrer.
export const metadata: Metadata = { title: `${BILLING.accountTitle} · Stock Social`, robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function Account({ searchParams }: { searchParams?: Promise<{ activating?: string; e?: string }> }) {
  const me = await currentUser();
  if (!me) redirect('/login');
  const sp = (await searchParams) ?? {};
  const now = new Date();
  const a = await access(me.id, now);
  const billing = billingAvailable();
  const contact = process.env.BILLING_CONTACT?.trim();
  const row = a.kind === 'subscriber' || a.kind === 'none' ? a.row : null;
  const live = a.kind === 'subscriber';
  return (
    <main className="page rt">
      <h1>{BILLING.accountTitle}</h1>
      {a.kind !== 'trader' && <TestModeLabel on={testMode(billing)} />}
      <Disclaimer />
      {sp.e === 'portal' && <p role="alert" className="down">{BILLING.errPortal}</p>}
      {a.kind === 'trader' && <>
        <p>{RECORD_TOOLS.trader}</p>
        <p><a className="button wide" href="/tools">{RECORD_TOOLS.open}</a></p>
        {await canceledOnConnect(me.id) && <p className="muted">{BILLING.traderCanceled}</p>}
      </>}
      {a.kind !== 'trader' && sp.activating === '1' && !live && <Activating waiting={BILLING.activating} slow={BILLING.activatingSlow} checkAgain={BILLING.checkAgain} />}
      {live && <>
        {a.row.status === 'past_due' && a.row.grace_until && <PastDueBanner until={a.row.grace_until} />}
        <p><b>{BILLING.plan(a.row.plan)}</b></p>
        {a.row.cancel_at_period_end && a.row.current_period_end
          ? <><p>{BILLING.endsOn(a.row.current_period_end)}</p><p>{BILLING.keepIt}</p></>
          : a.row.current_period_end && <p>{BILLING.renewsOn(a.row.current_period_end, a.row.plan)}</p>}
        <p><a className="button wide" href="/tools">{RECORD_TOOLS.open}</a></p>
        <p className="muted">{BILLING.receipt}</p>
        {!a.row.cancel_at_period_end && <p>{BILLING.cancelHow}</p>}
        <p>{BILLING.refund}</p>
        {contact && <p>{BILLING.contact(contact)}</p>}
        <form action={openPortal} className="rt-actions">
          <button className="button wide choice">{BILLING.manage}</button>
          {!a.row.cancel_at_period_end && <button className="button wide choice" formAction={openCancel}>{BILLING.cancel}</button>}
        </form>
      </>}
      {/* Orchestrator review 5: a first payment still being confirmed: no Subscribe button, and a way to stop it. */}
      {a.kind === 'none' && row?.status === 'incomplete' && <>
        <p role="status">{BILLING.confirming}</p>
        <form action={openPortal} className="rt-actions"><button className="button wide choice">{BILLING.manage}</button></form>
      </>}
      {a.kind === 'none' && row?.status !== 'incomplete' && sp.activating !== '1' && (row && !rowEntitles(row, now)
        ? <><p>{row.ended_reason === 'refund' ? BILLING.refunded : BILLING.lapsed}</p><p><Link className="button" href="/tools#subscribe">{BILLING.subscribeAgain}</Link></p></>
        : <><p>{BILLING.none}</p><p><Link className="button" href="/tools">{BILLING.seeTools}</Link></p></>)}
      <p><a className="button secondary" href="/account/export" download>{RECORD_TOOLS.download}</a></p>
      <p className="muted small">{BILLING.downloadHelp}</p>
    </main>
  );
}
