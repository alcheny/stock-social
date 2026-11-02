import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { startSignIn } from '../auth/actions.ts';
import { normalizeHandle, normalizeVia } from '@/lib/referral.ts';
import { FC5, FC5_WP4, LAUNCH, SIGNIN } from '@/lib/copy.ts';
import { ATTEST_KEEP_COOKIE, keepsTick } from '@/lib/auth/attest-keep.ts'; // FIXES-CYCLE5 (F5-7)
import { signUpOpen } from '@/lib/launch-gate.ts';
import { FocusHeading } from '../connect/result/focus-heading.tsx';
import { deviceFirst, orderMethods, providersFromEnv, type MethodKey } from '@/lib/auth/providers.ts';
import { currentUser, devAuthAllowed, LAST_METHOD_COOKIE } from '@/lib/session.ts';
import { EMAIL_COOKIE } from '@/lib/auth/links.ts';

// Fix #21 (approval council cycle 2, WCAG 2.4.2): each route has its own title.
export const metadata: Metadata = { title: 'Sign in · Stock Social' };

type SP = { ref?: string; via?: string; error?: string; method?: string };

// S1 (docs/features/logs/F-1/plan.md §2): no handle fields; one attestation on every path; provider buttons only
// when configured; the email link always; brokerage-first goes to the trust notice. Signed in, S1 is the own profile.
export default async function Login({ searchParams }: { searchParams?: Promise<SP> }) {
  const me = await currentUser();
  if (me) redirect(`/u/${me.handle}`);
  const sp = (await searchParams) ?? {};
  const ref = normalizeHandle(sp.ref);
  const via = ref ? normalizeVia(sp.via) : null;
  const providers = providersFromEnv();
  const jar = await cookies();
  // The last method that completed a sign-in in this browser goes first; a failed or abandoned tap never changes the order.
  const order = orderMethods({ available: providers.map((p) => p.key), deviceFirst: deviceFirst((await headers()).get('user-agent')), last: jar.get(LAST_METHOD_COOKIE)?.value });
  const error = sp.error;
  const linkAgain = error === 'expired' || error === 'used';
  const typed = error ? jar.get(EMAIL_COOKIE)?.value ?? '' : ''; // the address typed before a validation redirect, or the one the link went to
  // FIXES-CYCLE5 (F5-7; legal committee 2026-11-02 A4, A7): the trader's own tick, back for the one render their email
  // bounce makes, only from the cookie together with error=email (never a URL). The error then says the box is still
  // ticked; otherwise it asks for the tick again. Exactly one of the two, matching the box.
  const ticked = keepsTick(jar.get(ATTEST_KEEP_COOKIE)?.value, error);
  // Launch gate (D6): while sign-up is closed the page says so before anyone starts, and the brokerage-first button
  // (it only ever creates an account) is hidden; email and providers stay for existing accounts.
  const open = signUpOpen();
  const blocks: Partial<Record<MethodKey, React.ReactNode>> = {
    provider_a: providers.find((p) => p.key === 'provider_a') && <button name="method" value="provider_a" className="button wide">{SIGNIN.provider(providers.find((p) => p.key === 'provider_a')!.label)}</button>,
    provider_b: providers.find((p) => p.key === 'provider_b') && <button name="method" value="provider_b" className="button wide">{SIGNIN.provider(providers.find((p) => p.key === 'provider_b')!.label)}</button>,
    email: (
      <div className="email-block">
        <label htmlFor="email">{SIGNIN.emailLabel}</label>
        {/* FIXES-CYCLE5 (F5-7): the email error keeps the trader in the field, with the typed address. */}
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" defaultValue={typed} aria-describedby={error === 'email' ? 'email-err' : undefined} aria-invalid={error === 'email' || undefined} autoFocus={error === 'email'} />
        {error === 'email' && <p id="email-err" role="alert" className="down small">{SIGNIN.emailError} {ticked ? FC5_WP4.tickKept : FC5.attestAgain}</p>}
        {error === 'rate' && <><p id="email-rate" role="alert" tabIndex={-1} className="muted small">{SIGNIN.tooMany}</p><FocusHeading id="email-rate" /></>}
        <button name="method" value="email" className="button wide">{linkAgain ? SIGNIN.newLink : SIGNIN.emailButton}</button>
      </div>
    ),
    brokerage: open && (
      <>
        <p className="divider muted" aria-hidden="true">{SIGNIN.divider}</p>
        <button name="method" value="brokerage" className="button wide secondary">{SIGNIN.brokerage}</button>
      </>
    ),
  };
  return (
    <main className="page auth">
      <h1>{open ? SIGNIN.title : LAUNCH.signInTitle}</h1>
      <p className="muted">{SIGNIN.sub}</p>
      {error === 'closed'
        ? <><p id="launch-closed" role="alert" tabIndex={-1}>{LAUNCH.closedAfter}</p><FocusHeading id="launch-closed" /></>
        : !open && <p role="status">{LAUNCH.closed}</p>}
      {error === 'expired' && <p role="alert">{SIGNIN.linkExpired}</p>}
      {error === 'used' && <p role="alert">{SIGNIN.linkUsed}</p>}
      {error === 'provider' && <p role="alert" className="down">{SIGNIN.providerError}</p>}
      <form action={startSignIn}>
        {ref && <input type="hidden" name="ref" value={ref} />}
        {via && <input type="hidden" name="via" value={via} />}
        <input type="hidden" name="landed_at" value={Date.now()} />
        {/* Enter in the email field sends the link: the first submit button is the form's default. */}
        <button type="submit" name="method" value="email" hidden tabIndex={-1} aria-hidden="true" />
        {/* The legal links open in a new tab so the checked box is still there when the trader comes back. */}
        <label className="check attest">
          <input type="checkbox" name="adult" defaultChecked={ticked} aria-describedby={error === 'attest' ? 'adult-err' : undefined} aria-invalid={error === 'attest' || undefined} autoFocus={error === 'attest'} />
          <span>{SIGNIN.attest}<Link href="/terms" target="_blank" rel="noopener noreferrer">{SIGNIN.terms}</Link>{SIGNIN.and}<Link href="/privacy" target="_blank" rel="noopener noreferrer">{SIGNIN.privacy}</Link></span>
        </label>
        {error === 'attest' && <p id="adult-err" role="alert" className="down">{SIGNIN.attestError}</p>}
        <div className="stack">{order.filter((k) => blocks[k]).map((k) => <div key={k} data-method={k}>{blocks[k]}</div>)}</div>
      </form>
      {devAuthAllowed() && <p className="small muted"><Link href="/login/dev">{SIGNIN.devLink}</Link></p>}
    </main>
  );
}
