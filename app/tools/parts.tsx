// F-3 · shared pieces of Record tools and the account page (docs/features/logs/F-3/plan.md §2, §4). Server components.
import Link from 'next/link';
import { BILLING, CHORES_3, FOOTER, RECORD_TOOLS, billingDate } from '@/lib/copy.ts';
import { DISCLAIMER } from '@/lib/share.ts';
import { billingAvailable, checkoutOpen, nextCharge, type BillingConfig, type Plan } from '@/lib/billing.ts';
import { gateState } from '@/lib/launch-gate.ts';
import { subscribe } from './actions.ts';
import { FocusMessage } from './focus.tsx';

// Committee K8: the disclaimer in plain view at the top of every surface, with the three legal links.
export function Disclaimer() {
  return (
    <div className="rt-disclaimer">
      <p><b>{DISCLAIMER}</b></p>
      <nav aria-label="Legal" className="rt-legal">
        <Link href="/terms">{FOOTER.terms}</Link>
        <Link href="/privacy">{FOOTER.privacy}</Link>
        <Link href="/how">{FOOTER.how}</Link>
      </nav>
    </div>
  );
}

export const TestModeLabel = ({ on }: { on: boolean }) => (on ? <p className="badge test-mode">{BILLING.testMode}</p> : null);

// Committee K9, K15, K22, K23: every disclosure visible above the buttons, never collapsed. One form per plan
// (engineer D11), each with its own unchecked agreement box and button, so no plan is preselected and the box names
// the price of the button beside it; the server refuses a submit whose box is not ticked. "Not now" carries the same
// class as Subscribe (equal weight).
export function SubscribeBlock({ signedIn, testMode, error, chosen, now }: { signedIn: boolean; testMode: boolean; error: string | null; chosen: Plan | null; now: Date }) {
  const errText = error === 'agree' ? BILLING.errAgree : error === 'plan' ? BILLING.errPlan : error === 'checkout' ? BILLING.errCheckout : null;
  const plans: { plan: Plan; label: string; renew: string; agree: string; button: string }[] = [
    { plan: 'monthly', label: BILLING.planMonthly, renew: BILLING.renewMonthly(nextCharge('monthly', now)), agree: BILLING.agreeMonthly, button: BILLING.subscribeMonthly },
    { plan: 'annual', label: BILLING.planAnnual, renew: BILLING.renewAnnual(nextCharge('annual', now)), agree: BILLING.agreeAnnual, button: BILLING.subscribeAnnual },
  ];
  return (
    <section id="subscribe" className="rt-subscribe" aria-labelledby="sub-h">
      <h2 id="sub-h">{BILLING.title}</h2>
      <TestModeLabel on={testMode} />
      <p>{BILLING.whatYouGet}</p>
      <p>{BILLING.noTrial}</p>
      <p>{BILLING.cancelHow}</p>
      <p>{BILLING.refund}</p>
      <p>{BILLING.card}</p>
      {errText && <p role="alert" className="down" id="sub-err">{errText}</p>}
      {errText && <FocusMessage target={error === 'agree' && chosen ? `agree-${chosen}` : 'sub-err'} />}
      {plans.map((p) => (
        <form key={p.plan} action={subscribe} className="rt-plan-form" aria-labelledby={`plan-${p.plan}`}>
          <h3 id={`plan-${p.plan}`}>{p.label}</h3>
          <p className="small">{p.renew}</p>
          {signedIn && <>
            <input type="hidden" name="plan" value={p.plan} />
            <input type="hidden" name="shown" value={now.toISOString()} />
            <label className="rt-check"><input type="checkbox" id={`agree-${p.plan}`} name="agreed" value={p.plan} aria-invalid={error === 'agree' && chosen === p.plan ? true : undefined} aria-describedby={error === 'agree' && chosen === p.plan ? 'sub-err' : undefined} /> {p.agree}</label>
            <button className="button wide choice">{p.button}</button>
          </>}
        </form>
      ))}
      {!signedIn && <a className="button wide choice" href="/tools/signin">{BILLING.signIn}</a>}
      <Link className="button wide choice" href="/">{BILLING.notNow}</Link>
    </section>
  );
}

export function PastDueBanner({ until }: { until: Date }) {
  return <p role="alert" className="rt-banner">{RECORD_TOOLS.pastDue(until)} <Link href="/account">{BILLING.manage}</Link></p>;
}

export const fmt = billingDate;

// CHORES-3 (C3-39): the one rule for whether checkout is open to this viewer, shared by /tools and /account so the two
// pages never disagree. The launch gate: while sign-up is closed only an allowlisted account sees the Subscribe screen
// (lib/launch-gate.ts). `billing` null = checkout not open to them; `closed` = configured but the gate keeps them out
// (else: not configured, "not available right now"). A plain server function, not a server action.
export async function checkoutFor(userId: number | undefined): Promise<{ billing: BillingConfig | null; closed: boolean }> {
  const billing = (userId ? await checkoutOpen(userId) : gateState() !== 'closed') ? billingAvailable() : null;
  return { billing, closed: !!billingAvailable() && !billing };
}

// CHORES-3 (C3-39): locked /tools' way back into the app while checkout is not open (44 px from .rt-links).
export const BackToFeed = () => <p className="rt-links"><Link href="/">{CHORES_3.backToFeed}</Link></p>;
