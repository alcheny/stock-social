// Security hardening (2026-11-01), F16 and F20 (COMPLIANCE §7: rate limits on sign-in): sign-in link sends and new
// attempts, limited in the database (lib/rate-limit.ts#hit) so every instance shares the count. Per canonical address
// (+tag variants count as one) and per client address where a trusted proxy names it; the global count alerts the
// operator and refuses only clients with no known address. Checks stop at the first refusal.
import { canonicalEmail, capReached, hit, limitKey } from '../rate-limit.ts';

type Limit = readonly [limit: number, windowSec: number];
// Per address 5 per 15 minutes only (no daily ceiling), so the longest anyone is locked out of their own sign-in is 15 minutes.
export const SEND_LIMITS = { addressShort: [5, 900], client: [10, 900], global: [500, 3_600], attempt: [3, 900] } as const satisfies Record<string, Limit>;
export const ATTEMPT_LIMITS = { client: [20, 3_600], unknown: [120, 3_600] } as const satisfies Record<string, Limit>;

const within = (key: string, [limit, windowSec]: Limit, now?: Date) => hit(key, limit, windowSec, now);

// The global count never refuses a client we can tell apart (one flood must not lock everyone out): past it, it only
// alerts. It refuses only requests with no known client address, the ones no per-client limit covers.
async function globalSend(ip: string | null, now?: Date): Promise<boolean> {
  if (await within('mail-all', SEND_LIMITS.global, now)) return true;
  capReached('mail-all', SEND_LIMITS.global[1], now);
  // ponytail: with no known client address (off Vercel without TRUST_PROXY_HEADERS) every such client shares this cap, so
  // one flood refuses them all for the rest of the hour — set TRUST_PROXY_HEADERS behind a proxy that appends
  // X-Forwarded-For, or run on Vercel.
  return ip !== null;
}

export async function sendAllowed(email: string, ip: string | null, now?: Date): Promise<boolean> {
  return await within(limitKey('mail', canonicalEmail(email)), SEND_LIMITS.addressShort, now)
    && (ip === null || await within(limitKey('mail-ip', ip), SEND_LIMITS.client, now))
    && await globalSend(ip, now);
}

// "Send again": at most three per attempt, and every send limit as well.
export async function resendAllowed(attemptId: number, email: string, ip: string | null): Promise<boolean> {
  return await within(`mail-attempt:${attemptId}`, SEND_LIMITS.attempt) && await sendAllowed(email, ip);
}

// Every sign-in method writes an attempt (and the brokerage one leads to a vendor user): per client address; requests
// with no known address share one bucket, so a deployment without a trusted proxy still has a bound.
export async function attemptAllowed(ip: string | null, now?: Date): Promise<boolean> {
  if (ip !== null) return within(limitKey('attempt-ip', ip), ATTEMPT_LIMITS.client, now);
  // ponytail: with no known client address (off Vercel without TRUST_PROXY_HEADERS) every client shares this 120/hour
  // bucket, so one flood refuses them all for the rest of the hour — set TRUST_PROXY_HEADERS behind a proxy that appends
  // X-Forwarded-For, or run on Vercel.
  return within('attempt-unknown', ATTEMPT_LIMITS.unknown, now);
}
