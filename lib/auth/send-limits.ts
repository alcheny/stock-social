// Security hardening (2026-11-01), F16 and F20 (COMPLIANCE §7: rate limits on sign-in): sign-in link sends and new
// attempts, limited in the database (lib/rate-limit.ts#hit) so every instance shares the count. Per canonical address
// (+tag variants count as one), per client address where a trusted proxy names it, and overall, so neither one inbox
// nor many can be flooded through the app. Checks stop at the first refusal, so a refused send uses up nothing further.
import { canonicalEmail, hit, limitKey } from '../rate-limit.ts';

type Limit = readonly [limit: number, windowSec: number];
export const SEND_LIMITS = { addressShort: [5, 900], addressDay: [20, 86_400], client: [10, 900], global: [500, 3_600], attempt: [3, 900] } as const satisfies Record<string, Limit>;
export const ATTEMPT_LIMITS = { client: [20, 3_600] } as const satisfies Record<string, Limit>;

const within = (key: string, [limit, windowSec]: Limit) => hit(key, limit, windowSec);

export async function sendAllowed(email: string, ip: string | null): Promise<boolean> {
  const mail = limitKey('mail', canonicalEmail(email));
  return await within(mail, SEND_LIMITS.addressShort)
    && await within(mail, SEND_LIMITS.addressDay)
    && (ip === null || await within(limitKey('mail-ip', ip), SEND_LIMITS.client))
    && await within('mail-all', SEND_LIMITS.global);
}

// "Send again": at most three per attempt, and every send limit as well.
export async function resendAllowed(attemptId: number, email: string, ip: string | null): Promise<boolean> {
  return await within(`mail-attempt:${attemptId}`, SEND_LIMITS.attempt) && await sendAllowed(email, ip);
}

// Every sign-in method writes an attempt (and the brokerage one leads to a vendor user): per client address.
export async function attemptAllowed(ip: string | null): Promise<boolean> {
  return ip === null || await within(limitKey('attempt-ip', ip), ATTEMPT_LIMITS.client);
}
