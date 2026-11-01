import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { login } from '../../actions.ts';
import { normalizeHandle, normalizeVia } from '@/lib/referral.ts';
import { devAuthAllowed } from '@/lib/session.ts';
import { memoryOutbox } from '@/lib/auth/email.ts';
import { devLoginHandleValue, HANDLE_RULE, signInErrorField, signInErrorText } from '@/lib/handles.ts';

// Fix #21 (approval council cycle 2, WCAG 2.4.2): each route has its own title.
export const metadata: Metadata = { title: 'Dev sign-in · Stock Social', robots: { index: false } };

// DEV-ONLY sign-in (no password). Exists only when ALLOW_DEV_AUTH=1 (or outside production); e2e uses it.
export default async function DevLogin({ searchParams }: { searchParams?: Promise<{ ref?: string; via?: string; error?: string; handle?: string }> }) {
  if (!devAuthAllowed()) notFound();
  const sp = await searchParams;
  const ref = normalizeHandle(sp?.ref);
  const via = ref ? normalizeVia(sp?.via) : null;
  const error = signInErrorText(sp?.error); // a refused name or handle (app/actions.ts#login), named by its rule
  // Fix round 2 (F): the alert is tied to the field it is about; the typed handle comes back (the name never does).
  const field = signInErrorField(sp?.error);
  const desc = (f: 'handle' | 'name' | 'adult', base?: string) => [base, field === f ? 'dev-err' : null].filter(Boolean).join(' ') || undefined;
  const lastLink = !process.env.AUTH_EMAIL_SEND_URL ? memoryOutbox.last : null;
  return (
    <main className="page auth">
      <h1>Publish your trades</h1>
      <p className="muted">Dev sign-in (no password). Not available in production.</p>
      {error && <p id="dev-err" role="alert" className="down small">{error}</p>}
      <form action={login}>
        {ref && <input type="hidden" name="ref" value={ref} />}
        {via && <input type="hidden" name="via" value={via} />}
        {sp?.error === 'handle' && <p role="alert" className="down small">That handle is taken or reserved.</p>}
        <label htmlFor="handle">Handle</label>
        <input id="handle" name="handle" type="text" required pattern="[a-z0-9_]{3,20}" title={HANDLE_RULE} placeholder="lowercase, 3–20 chars" defaultValue={devLoginHandleValue(sp?.handle)} autoFocus={field === 'handle'} aria-describedby={desc('handle', 'handle-hint')} />
        <p id="handle-hint" className="muted small">{HANDLE_RULE}</p>
        <label htmlFor="name">Display name</label>
        <input id="name" name="name" type="text" maxLength={40} autoFocus={field === 'name'} aria-describedby={desc('name')} />
        <label className="check"><input type="checkbox" name="adult" required aria-describedby={desc('adult')} /> I am 18 or older</label>
        <p><button>Continue</button></p>
      </form>
      {lastLink && (
        <section aria-labelledby="last-link">
          <h2 id="last-link" className="small muted">Last sign-in link (dev only, no email service configured)</h2>
          <p><a href={lastLink.url} data-testid="last-link">{lastLink.url}</a></p>
        </section>
      )}
    </main>
  );
}
