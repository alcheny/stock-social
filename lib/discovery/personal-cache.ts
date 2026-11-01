// F-2 PR-5: each viewer's personal list, kept for its cursor's lifetime (lib/feed.ts#loadFeedPage), so a later page of a
// running session slices the list page 1 showed after a like, an unlike or an unfollow. "Clear my activity" and either
// switch drop the viewer's kept lists at once (lib/discovery/activity.ts): nothing cleared or switched off is used for
// another page. Per server process; another server rebuilds from the inputs at asOf, which no longer hold what was cleared.
export type KeptSlot = { key: string; trader: number; symbol: string; explore: boolean; score: number };
const kept = new Map<string, { viewer: number; at: number; slots: KeptSlot[] }>();
// ponytail: kept per server process (another instance rebuilds the list from the inputs at asOf, so a page there may shift
// after an unlike or unfollow made mid-session) — a shared store keyed by viewer and cursor would hold it across instances.
// ponytail: at most PERSONAL_CACHE_MAX lists; past it the oldest go and their sessions rebuild — size it from real traffic.
export const PERSONAL_CACHE_MAX = 2_000;

export function personalSlots(viewer: number, key: string, now: number, maxAge: number, build: () => KeptSlot[]): KeptSlot[] {
  const k = `${viewer}|${key}`;
  const hit = kept.get(k);
  if (hit) return hit.slots;
  for (const [x, v] of kept) if (v.at < now - maxAge || kept.size >= PERSONAL_CACHE_MAX) kept.delete(x);
  const slots = build();
  kept.set(k, { viewer, at: now, slots });
  return slots;
}
export function forgetViewer(viewer: number) { for (const [k, v] of kept) if (v.viewer === viewer) kept.delete(k); }
export function clearPersonalCache() { kept.clear(); }
