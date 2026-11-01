// In-memory sliding-window rate limit for sign-in sends (COMPLIANCE §7: rate limits on sign-in). Per process;
// a second instance has its own window, which is enough for the Phase 1 scale.
const hits = new Map<string, number[]>();

export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
export const resetRateLimits = () => hits.clear();
