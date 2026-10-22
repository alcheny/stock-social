import { notFound } from 'next/navigation';
import { login } from '../../actions.ts';
import { normalizeHandle, normalizeVia } from '@/lib/referral.ts';
import { devAuthAllowed } from '@/lib/session.ts';
import { memoryOutbox } from '@/lib/auth/email.ts';

// DEV-ONLY sign-in (no password). Exists only when ALLOW_DEV_AUTH=1 (or outside production); e2e uses it.
export default async function DevLogin({ searchParams }: { searchParams?: Promise<{ ref?: string; via?: string }> }) {
  if (!devAuthAllowed()) notFound();
  const sp = await searchParams;
  const ref = normalizeHandle(sp?.ref);
  const via = ref ? normalizeVia(sp?.via) : null;
  const lastLink = !process.env.AUTH_EMAIL_SEND_URL ? memoryOutbox.last : null;
  return (
    <main className="page auth">
      <h1>Publish your trades</h1>
      <p className="muted">Dev sign-in (no password). Not available in production.</p>
      <form action={login}>
        {ref && <input type="hidden" name="ref" value={ref} />}
        {via && <input type="hidden" name="via" value={via} />}
        <label htmlFor="handle">Handle</label>
        <input id="handle" name="handle" type="text" required pattern="[a-z0-9_]{3,20}" placeholder="lowercase, 3–20 chars" />
        <label htmlFor="name">Display name</label>
        <input id="name" name="name" type="text" maxLength={40} />
        <label className="check"><input type="checkbox" name="adult" required /> I am 18 or older</label>
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
