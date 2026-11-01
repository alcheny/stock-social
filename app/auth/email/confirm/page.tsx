import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { confirmEmailLink } from '../../actions.ts';
import { EMAIL_CONFIRM } from '@/lib/copy.ts';
import { maskEmail, peekLink } from '@/lib/auth/links.ts';

export const metadata: Metadata = { title: EMAIL_CONFIRM.title, robots: { index: false, follow: false } };

// Security hardening (2026-11-01), F14: the emailed link opened in a browser that did not ask for it. Nothing is claimed
// until "Continue signing in" is pressed (a POST to a server action, which Next checks against the page's origin). The
// masked address lets someone lured here by another person's link see it is not theirs.
export default async function ConfirmEmailLink({ searchParams }: { searchParams?: Promise<{ t?: string }> }) {
  const t = String((await searchParams)?.t ?? '');
  const peek = await peekLink(t);
  if (peek.status !== 'ok') redirect(`/login?error=${peek.status === 'used' ? 'used' : 'expired'}`);
  return (
    <main className="page auth">
      <h1>{EMAIL_CONFIRM.title}</h1>
      <p>{EMAIL_CONFIRM.forAddress(maskEmail(peek.email))}</p>
      <form action={confirmEmailLink}>
        <input type="hidden" name="t" value={t} />
        <button className="button">{EMAIL_CONFIRM.button}</button>
      </form>
      <p className="muted small">{EMAIL_CONFIRM.notYou}</p>
    </main>
  );
}
