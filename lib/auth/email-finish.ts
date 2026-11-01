// Claims the emailed link and signs a browser in; returns the path to land on. Single use: the row is claimed atomically
// (and its address blanked) before any sign-in happens. The session glue (lib/session.ts, cookies) is passed in, so
// node:test covers this; app/auth/email/finish.ts binds it. Used by GET /auth/email for the browser that asked for the
// link, and by the confirm step's POST (app/auth/actions.ts#confirmEmailLink) anywhere else.
// Security hardening (2026-11-01), F28: an unexpected failure is the expired state, never a 500; the log names an
// error code only (a database error's detail can carry the address, POLICY P3).
import { claimLink } from './links.ts';
import { signInWithIdentity } from './attempts.ts';
import { landingFor } from './landing.ts';
import { SignUpClosedError, signUpOpen } from '../launch-gate.ts';
import { logSafe } from '../privacy-log.ts';

export type SessionGlue = { signIn: (userId: number) => Promise<void>; rememberMethod: (method: string) => Promise<void> };

export async function finishEmailLink(token: string, session: SessionGlue): Promise<string> {
  try {
    const claim = await claimLink(token);
    if (claim.status !== 'ok') return `/login?error=${claim.status === 'used' ? 'used' : 'expired'}`;
    // Launch gate (D4, D5): an address with no account is refused only here, after the link is used, so the link page
    // never tells who has an account.
    const user = await signInWithIdentity(claim.attemptId, { provider: 'email', subject: claim.email, email: claim.email }, { allowNew: signUpOpen(claim.email) });
    await session.signIn(user.id);
    await session.rememberMethod('email');
    return await landingFor(user); // an empty profile goes straight to S2 (committee item 7)
  } catch (e) {
    if (e instanceof SignUpClosedError) return '/login?error=closed';
    console.error('email sign-in failed', logSafe(e));
    return '/login?error=expired';
  }
}
