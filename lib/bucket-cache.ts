// FIXES-CYCLE5 (F5-5, C5-7): a small in-process cache for values that are expensive to build and shared by many
// readers (feed page 1's ranked list). Pure, no I/O (lib/fixes-cycle5-bucket-cache.test.ts).
// - Single flight: concurrent gets of one key share one build (one candidate statement for 50 concurrent visitors).
// - True LRU: a get moves its key to the newest end; inserting past `max` evicts the least recently used key, so a
//   reader's page-1 list is not pushed out by a flood of other keys while that reader is still paging.
// - A failed build is evicted, so the next get builds again instead of replaying the error.
// - `isStale` (optional) drops an entry on read, e.g. a list older than the cursor's lifetime.
// ponytail: per process — every server and every restart builds its own copy; a shared table keyed the same way (see the
// ponytail above lib/feed.ts#lists) would let servers share one build.

export type BucketCache<V> = {
  get(key: string, build: () => Promise<V>): Promise<V>;
  peek(key: string): V | undefined;
  delete(key: string): void;
  clear(): void;
  readonly size: number;
  keys(): string[];
};

type Entry<V> = { done: boolean; value?: V; promise: Promise<V> };

export function bucketCache<V>(max: number, isStale?: (v: V) => boolean): BucketCache<V> {
  if (!Number.isInteger(max) || max < 1) throw new RangeError('bucketCache: max must be a positive integer');
  const map = new Map<string, Entry<V>>();
  const touch = (key: string, e: Entry<V>) => { map.delete(key); map.set(key, e); };
  const evict = () => {
    while (map.size > max) {
      const oldest = map.keys().next().value as string;
      map.delete(oldest);
    }
  };
  return {
    get(key, build) {
      const hit = map.get(key);
      if (hit && !(hit.done && isStale?.(hit.value as V))) {
        touch(key, hit);
        return hit.promise;
      }
      if (hit) map.delete(key);
      const e: Entry<V> = { done: false, promise: undefined as unknown as Promise<V> };
      e.promise = (async () => build())().then(
        (v) => { e.done = true; e.value = v; return v; },
        (err) => { if (map.get(key) === e) map.delete(key); throw err; },
      );
      map.set(key, e);
      evict();
      return e.promise;
    },
    peek(key) {
      const e = map.get(key);
      return e?.done ? e.value : undefined;
    },
    delete(key) { map.delete(key); },
    clear() { map.clear(); },
    get size() { return map.size; },
    keys() { return [...map.keys()]; },
  };
}
// end FIXES-CYCLE5
