// Privacy work (2026-11-01): the launch gate. Real (non-demo) sign-up and broker connection stay closed until the owner
// opens them (POLICY P6: Terms and Privacy Policy live first). Pure and env-driven; env is read at call time.
// Decisions D1–D3 in docs/features/logs/privacy/committee-2026-11-01.md.
//
//   LAUNCH_OPEN=1                 open for everyone. Anything else (unset, 0, true) is closed.
//   LAUNCH_ALLOWLIST=a,b          while closed, a signed-in account with one of these handles may connect a broker.
//                                 List handles that already exist (a rename could take an unclaimed listed handle).
//   LAUNCH_ALLOWLIST_EMAILS=x,y   while closed, a verified email on this list may create an account and connect.
//                                 Env only: never put addresses in the repository (POLICY P1).
//
// Sandbox: a build where nothing real can enter is treated as open: dev auth is allowed (non-production, or
// ALLOW_DEV_AUTH=1), the broker vendor is the loopback fake or not configured, sign-in mail goes nowhere real, and every
// configured sign-in provider is on loopback. This is the e2e suite's production test build. Fails closed.
import { isLoopbackUrl, type Env } from './vendor-env.ts';

export type GateState = 'open' | 'sandbox' | 'closed';

const HANDLE = /^[a-z0-9_]{3,20}$/;
const list = (raw: string | undefined) => (raw ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
export const allowedHandles = (env: Env = process.env) => list(env.LAUNCH_ALLOWLIST).filter((h) => HANDLE.test(h));
export const allowedEmails = (env: Env = process.env) => list(env.LAUNCH_ALLOWLIST_EMAILS).filter((e) => /^[^@\s]+@[^@\s]+$/.test(e));

const loopbackOrUnset = (v: string | undefined) => !v || isLoopbackUrl(v);

export function isSandbox(env: Env = process.env): boolean {
  const devAuth = env.NODE_ENV !== 'production' || env.ALLOW_DEV_AUTH === '1';
  const vendor = env.SNAPTRADE_BASE_URL ? isLoopbackUrl(env.SNAPTRADE_BASE_URL) : !env.SNAPTRADE_CLIENT_ID;
  const mail = loopbackOrUnset(env.AUTH_EMAIL_SEND_URL);
  const providers = loopbackOrUnset(env.AUTH_EMAIL_PROVIDER_ISSUER) && loopbackOrUnset(env.AUTH_DEVICE_PROVIDER_ISSUER);
  return devAuth && vendor && mail && providers;
}

export function gateState(env: Env = process.env): GateState {
  if (env.LAUNCH_OPEN === '1') return 'open';
  return isSandbox(env) ? 'sandbox' : 'closed';
}

/** A new account by a real sign-in method. `email` is the identity's verified address, when there is one. */
export function signUpOpen(email: string | null = null, env: Env = process.env): boolean {
  if (gateState(env) !== 'closed') return true;
  return !!email && allowedEmails(env).includes(email.trim().toLowerCase());
}

/** A broker connection for a signed-in account (handle and its verified emails), or signed out (null: sign-up). */
export function mayConnect(who: { handle: string; emails?: (string | null)[] } | null, env: Env = process.env): boolean {
  if (gateState(env) !== 'closed') return true;
  if (!who) return false;
  if (allowedHandles(env).includes(who.handle.toLowerCase())) return true;
  const emails = allowedEmails(env);
  return (who.emails ?? []).some((e) => !!e && emails.includes(e.toLowerCase()));
}

/** For the tick's report: the state and the list sizes, never the entries. */
export const gateReport = (env: Env = process.env) => ({ gate: gateState(env), allowHandles: allowedHandles(env).length, allowEmails: allowedEmails(env).length });

export class SignUpClosedError extends Error { constructor() { super('sign-up is not open yet'); } }
