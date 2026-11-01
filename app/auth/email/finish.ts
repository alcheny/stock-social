import { claimLink } from '@/lib/auth/links.ts';
import { signInWithIdentity } from '@/lib/auth/attempts.ts';
import { rememberMethod, signIn } from '@/lib/session.ts';
import { landingFor } from '@/lib/auth/landing.ts';

// Claims the emailed link and signs this browser in; returns the path to land on. Single use: the row is claimed
// atomically (and its address blanked) before any sign-in happens. Called by GET /auth/email for the browser that asked
// for the link, and by the confirm step's POST (app/auth/actions.ts#confirmEmailLink) anywhere else.
// Security hardening (2026-11-01), F28: an unexpected failure is the expired state, never a 500; the log names an
// error code only (a database error's detail can carry the address, POLICY P3).
export async function finishEmailLink(token: string): Promise<string> {
  try {
    const claim = await claimLink(token);
    if (claim.status !== 'ok') return `/login?error=${claim.status === 'used' ? 'used' : 'expired'}`;
    const user = await signInWithIdentity(claim.attemptId, { provider: 'email', subject: claim.email, email: claim.email });
    await signIn(user.id);
    await rememberMethod('email');
    return landingFor(user); // an empty profile goes straight to S2 (committee item 7)
  } catch (e) {
    console.error('email sign-in failed', { code: String((e as { code?: unknown })?.code ?? (e as Error)?.name ?? 'unknown') });
    return '/login?error=expired';
  }
}
