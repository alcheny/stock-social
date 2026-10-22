// Sending the sign-in link: one HTTPS call to the email vendor (POLICY: the single Phase 1 vendor exception),
// behind an interface so tests and the e2e sink inject their own. Transactional only; the body is lib/copy.ts.
import { LOGIN_MAIL } from '../copy.ts';

export type Env = Record<string, string | undefined>;
export type LoginMail = { to: string; url: string };
export type Sender = (m: LoginMail) => Promise<void>;

export function httpsSender(env: Env = process.env, fetchFn: typeof fetch = fetch): Sender {
  const url = env.AUTH_EMAIL_SEND_URL!;
  return async (m) => {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(env.AUTH_EMAIL_SEND_KEY ? { authorization: `Bearer ${env.AUTH_EMAIL_SEND_KEY}` } : {}) },
      body: JSON.stringify({ from: env.AUTH_EMAIL_FROM ?? '', to: m.to, subject: LOGIN_MAIL.subject, text: LOGIN_MAIL.text(m.url) }),
    });
    if (!res.ok) throw new Error(`email send failed (${res.status})`); // status only: never the address or the link
  };
}

// In-memory sink for tests and local dev. Holds the last message only; shown on /login/dev under ALLOW_DEV_AUTH=1.
export const memoryOutbox: { last: LoginMail | null } = { last: null };
export const memorySender: Sender = async (m) => { memoryOutbox.last = m; };

export function defaultSender(env: Env = process.env): Sender {
  if (env.AUTH_EMAIL_SEND_URL) return httpsSender(env);
  if (env.NODE_ENV === 'production' && env.ALLOW_DEV_AUTH !== '1') throw new Error('AUTH_EMAIL_SEND_URL is not set');
  return memorySender;
}
