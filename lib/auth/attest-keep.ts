// FIXES-CYCLE5 (F5-7, C5-9; cycle-5 Q2 accepted by the owner 2026-11-02; legal committee 2026-11-02 item 1, A1-A12):
// the trader's own 18+ tick survives an email-address error for the one page load the bounce makes.
// - Set only by app/auth/actions.ts#startSignIn, only on the redirect to /login?…error=email (that path is reached only
//   with `adult=on`, the attestation check runs first). One fixed value, no personal data, httpOnly, sameSite=lax,
//   path /login, secure on https, Max-Age ATTEST_KEEP_SECONDS (A1-A3).
// - Only the cookie together with error=email ticks the box; no query parameter, hash or form field can (A4).
// - Cleared after one use: proxy.ts drops it from the request and the response of every /login request that is not
//   the bounce itself (A5), and every later startSignIn clears it, as does sign-out.
// - It is NOT a consent record: the attestation is still read only from the submitted form's `adult` field and written
//   (signup_attempts) only when a method proceeds, exactly as before (A6, A8). Nothing is logged or stored when it is set
//   or read. Not age assurance (A10).
export const ATTEST_KEEP_COOKIE = 'login_attest_kept';
export const ATTEST_KEEP_VALUE = '1';
export const ATTEST_KEEP_SECONDS = 30;
export const ATTEST_KEEP_PATH = '/login';

// Pure: does /login render the 18+ box ticked? Only the exact cookie value and error=email.
export function keepsTick(cookieValue: string | undefined, error: string | undefined): boolean {
  return cookieValue === ATTEST_KEEP_VALUE && error === 'email';
}

// end FIXES-CYCLE5
