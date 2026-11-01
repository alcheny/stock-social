// F-2 PR-5 (criteria 2, 3): the implicit activity log's rules. Pure (lib/discovery/events.test.ts); app/api/events/route.ts
// resolves and stores what passes. Only implicit reading events are logged: explicit choices (follow, like, hide, reject)
// already live in their own tables and are never duplicated here. Logging runs only for a signed-in viewer who turned
// "Personalize with my activity" On (off by default, owner 2026-11-01).
// An event is: type, surface, target (a trader by handle, a trade by the card's id, or a symbol) and nothing else. The
// time is the server's (a client clock is never trusted, so no client time is read at all).

// Symbol-targeted events (watch, unwatch) stay off: the watchlist is never an ordering input, and nothing about a
// security is logged while this is false (criterion "watchlist", POLICY F1a).
export const SYMBOL_EVENTS = false;
export const BATCH_MAX = 50;
export const BATCH_BYTES = 8_192;
// One batch per viewer per this many ms (per server process; lib/rate-limit.ts).
export const BATCH_INTERVAL_MS = 2_000;

export const EVENT_TYPES = { impression: 1, dwell_short: 2, dwell_long: 3, skip: 4, swipe_open: 5, profile_open: 6, share: 7, watch: 8, unwatch: 9 } as const;
export const SURFACES = { feed: 1, pane: 2, profile: 3, section: 4, me: 5 } as const;
export type EventType = keyof typeof EVENT_TYPES;
export type Surface = keyof typeof SURFACES;
export type Target = { kind: 'trader'; handle: string } | { kind: 'trade'; id: string } | { kind: 'symbol'; symbol: string };
export type RawEvent = { type: EventType; surface: Surface; target: Target };

const HANDLE = /^[a-z0-9_]{3,20}$/;
const ID = /^[0-9]{1,18}$/;
const SYMBOL = /^[A-Z0-9.\-]{1,12}$/;
const SYMBOL_TYPES = new Set<EventType>(['watch', 'unwatch']);
const has = <T extends object>(o: T, k: PropertyKey): k is keyof T => Object.prototype.hasOwnProperty.call(o, k);
const exactKeys = (o: object, keys: string[]) => Object.keys(o).length === keys.length && keys.every((k) => has(o, k));
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function target(x: unknown): Target | null {
  if (!isObj(x)) return null;
  if (x.kind === 'trader' && exactKeys(x, ['kind', 'handle']) && typeof x.handle === 'string' && HANDLE.test(x.handle)) return { kind: 'trader', handle: x.handle };
  if (x.kind === 'trade' && exactKeys(x, ['kind', 'id']) && typeof x.id === 'string' && ID.test(x.id)) return { kind: 'trade', id: x.id };
  if (x.kind === 'symbol' && exactKeys(x, ['kind', 'symbol']) && typeof x.symbol === 'string' && SYMBOL.test(x.symbol)) return { kind: 'symbol', symbol: x.symbol };
  return null;
}

// One event, or null. Unknown keys, types, surfaces or target shapes are rejected; symbol events only with SYMBOL_EVENTS
// and only for the symbol types (and those only target a symbol).
export function parseEvent(x: unknown, symbolEvents = SYMBOL_EVENTS): RawEvent | null {
  if (!isObj(x) || !exactKeys(x, ['type', 'surface', 'target'])) return null;
  if (typeof x.type !== 'string' || !has(EVENT_TYPES, x.type) || typeof x.surface !== 'string' || !has(SURFACES, x.surface)) return null;
  const t = target(x.target);
  if (!t) return null;
  const type = x.type as EventType;
  if (SYMBOL_TYPES.has(type) !== (t.kind === 'symbol')) return null;
  if (t.kind === 'symbol' && !symbolEvents) return null;
  return { type, surface: x.surface as Surface, target: t };
}

// A batch: `{ events: [...] }`, at most BATCH_MAX; invalid events are dropped, duplicates within a batch kept once.
export function parseBatch(body: unknown, symbolEvents = SYMBOL_EVENTS): RawEvent[] | null {
  if (!isObj(body) || !exactKeys(body, ['events']) || !Array.isArray(body.events) || body.events.length > BATCH_MAX) return null;
  const seen = new Set<string>(), out: RawEvent[] = [];
  for (const x of body.events) {
    const e = parseEvent(x, symbolEvents);
    if (!e) continue;
    const k = JSON.stringify(e);
    if (!seen.has(k)) { seen.add(k); out.push(e); }
  }
  return out;
}
