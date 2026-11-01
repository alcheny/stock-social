// Privacy work (2026-11-01): every cookie the app sets, with its purpose and lifetime. The Privacy Policy's cookie
// section is written from this table; lib/privacy-cookies.test.ts scans the code for every cookie write
// (cookies().set, Set-Cookie headers, document.cookie) and fails when a cookie is set that is not listed here, or a
// row lists one nothing sets. All are first-party and strictly necessary; there are no analytics or ad cookies.
import { SESSION_COOKIE, SESSION_DAYS } from './auth/sessions.ts';
import { ATTEMPT_COOKIE, EMAIL_COOKIE, EMAIL_COOKIE_SECONDS } from './auth/links.ts';
import { TX_COOKIE } from './auth/tx.ts';
import { CONNECT_COOKIE, CONNECT_COOKIE_SECONDS } from './connections.ts';

export type CookieRow = { name: string; purpose: string; lifetimeSeconds: number; lifetime: string; path: string; setIn: string[] };

export const COOKIE_TABLE: CookieRow[] = [
  { name: SESSION_COOKIE, purpose: 'Keeps you signed in: a signed random token; only its hash is stored.', lifetimeSeconds: SESSION_DAYS * 86_400, lifetime: `${SESSION_DAYS} days, or until you sign out`, path: '/', setIn: ['lib/session.ts'] },
  { name: 'auth_last_method', purpose: 'Remembers which sign-in method you used last (the method name only, never who you are) to list it first.', lifetimeSeconds: 365 * 86_400, lifetime: '1 year', path: '/login', setIn: ['lib/session.ts'] },
  { name: EMAIL_COOKIE, purpose: 'Keeps the address you typed for a sign-in link so you do not retype it; never in a URL.', lifetimeSeconds: EMAIL_COOKIE_SECONDS, lifetime: `${EMAIL_COOKIE_SECONDS / 60} minutes (the link's life)`, path: '/login', setIn: ['app/auth/actions.ts'] },
  { name: ATTEMPT_COOKIE, purpose: 'Ties "Send again", and opening the emailed link without a confirm step, to the browser that started the sign-in.', lifetimeSeconds: 3600, lifetime: '1 hour', path: '/', setIn: ['app/auth/actions.ts'] },
  { name: CONNECT_COOKIE, purpose: 'Ties a brokerage-first sign-up to the browser that started it.', lifetimeSeconds: CONNECT_COOKIE_SECONDS, lifetime: `${CONNECT_COOKIE_SECONDS / 3600} hours, cleared when the connection completes`, path: '/connect', setIn: ['app/auth/actions.ts', 'app/connect/actions.ts'] },
  { name: TX_COOKIE, purpose: 'Protects a sign-in with a provider against forgery (state, nonce and code verifier).', lifetimeSeconds: 600, lifetime: '10 minutes, cleared on return', path: '/auth', setIn: ['app/auth/actions.ts'] },
];
