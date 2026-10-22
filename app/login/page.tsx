import Link from 'next/link';
import { headers } from 'next/headers';
import { startSignIn } from '../auth/actions.ts';
import { normalizeHandle, normalizeVia } from '@/lib/referral.ts';
import { SIGNIN } from '@/lib/copy.ts';
import { deviceFirst, orderMethods, providersFromEnv, type MethodKey } from '@/lib/auth/providers.ts';
import { devAuthAllowed } from '@/lib/session.ts';
import { MethodOrder } from './order.tsx';

type SP = { ref?: string; via?: string; error?: string; method?: string };

// S1 (docs/features/logs/F-1/plan.md §2): no handle fields; one attestation on every path; provider buttons only
// when configured; the email link always; brokerage-first goes to the trust notice.
export default async function Login({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) ?? {};
  const ref = normalizeHandle(sp.ref);
  const via = ref ? normalizeVia(sp.via) : null;
  const providers = providersFromEnv();
  const order = orderMethods({ available: providers.map((p) => p.key), deviceFirst: deviceFirst((await headers()).get('user-agent')) });
  const error = sp.error;
  const blocks: Partial<Record<MethodKey, React.ReactNode>> = {
    provider_a: providers.find((p) => p.key === 'provider_a') && <button name="method" value="provider_a" className="button wide">{SIGNIN.provider(providers.find((p) => p.key === 'provider_a')!.label)}</button>,
    provider_b: providers.find((p) => p.key === 'provider_b') && <button name="method" value="provider_b" className="button wide">{SIGNIN.provider(providers.find((p) => p.key === 'provider_b')!.label)}</button>,
    email: (
      <div className="email-block">
        <label htmlFor="email">{SIGNIN.emailLabel}</label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" aria-describedby={error === 'email' ? 'email-err' : undefined} aria-invalid={error === 'email' || undefined} />
        {error === 'email' && <p id="email-err" role="alert" className="down small">{SIGNIN.emailError}</p>}
        {error === 'rate' && <p role="alert" className="muted small">Too many links sent. Try again in a few minutes.</p>}
        <button name="method" value="email" className="button wide">{SIGNIN.emailButton}</button>
      </div>
    ),
    brokerage: (
      <>
        <p className="divider muted" aria-hidden="true">{SIGNIN.divider}</p>
        <button name="method" value="brokerage" className="button wide secondary">{SIGNIN.brokerage}</button>
      </>
    ),
  };
  return (
    <main className="page auth">
      <h1>{SIGNIN.title}</h1>
      <p className="muted">{SIGNIN.sub}</p>
      {error === 'expired' && <p role="alert">{SIGNIN.linkExpired}</p>}
      {error === 'provider' && <p role="alert" className="down">{SIGNIN.providerError}</p>}
      <form action={startSignIn}>
        {ref && <input type="hidden" name="ref" value={ref} />}
        {via && <input type="hidden" name="via" value={via} />}
        <input type="hidden" name="landed_at" value={Date.now()} />
        {/* Enter in the email field sends the link: the first submit button is the form's default. */}
        <button type="submit" name="method" value="email" hidden tabIndex={-1} aria-hidden="true" />
        <label className="check attest">
          <input type="checkbox" name="adult" aria-describedby={error === 'attest' ? 'adult-err' : undefined} aria-invalid={error === 'attest' || undefined} autoFocus={error === 'attest'} />
          <span>{SIGNIN.attest}<Link href="/terms">{SIGNIN.terms}</Link>{SIGNIN.and}<Link href="/privacy">{SIGNIN.privacy}</Link></span>
        </label>
        {error === 'attest' && <p id="adult-err" role="alert" className="down">{SIGNIN.attestError}</p>}
        <MethodOrder items={order.filter((k) => blocks[k]).map((k) => ({ key: k, node: blocks[k] }))} />
      </form>
      {devAuthAllowed() && <p className="small muted"><Link href="/login/dev">{SIGNIN.devLink}</Link></p>}
    </main>
  );
}
