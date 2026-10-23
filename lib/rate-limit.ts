// F-1 PR-2b fix round 2 (engineer, Low): a minimum interval per key, in this server process. The import poll uses it
// (one step per trader per second): each step reaches the vendor, and the banner itself polls every 2 s, so only a
// script or many open tabs ever meet it. ponytail: per process, not shared between instances; the per-user advisory
// lock in lib/connections.ts still serializes the steps themselves. A shared limit would go in the database.
export function minInterval(ms: number, max = 10_000) {
  const last = new Map<string, number>();
  return (key: string, now = Date.now()): boolean => {
    const t = last.get(key);
    if (t !== undefined && now - t < ms) return false;
    if (last.size >= max) for (const [k, v] of last) if (now - v >= ms) last.delete(k);
    last.delete(key); // re-insert: the map stays in time order
    last.set(key, now);
    return true;
  };
}
