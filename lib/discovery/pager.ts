// F-2 PR-1: the feed in pages of 30. Every page is a slice of one list: ranked at a fixed time (`asOf`, the clock of
// page 1) and seeded by its UTC day. Each page recomputes that same list and slices [offset, offset + 30), so the
// diversity window spans the page join by construction, no card repeats and none vanishes.
// Pure (lib/discovery/imports.test.ts). The cursor is public and carries no viewer data: base64url JSON
// { d: day, a: asOf ms, o: offset }. Anything that does not validate reads as page 1, never an error.

export const PAGE_SIZE = 30;
export const CURSOR_MAX_BYTES = 200;
// A cursor older than this (a tab left open for two days) starts today's feed over.
export const CURSOR_MAX_AGE_MS = 48 * 3_600_000;
const SKEW_MS = 60_000;

export type Cursor = { day: string; asOf: number; offset: number };

export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const firstPage = (now: number): Cursor => ({ day: utcDay(now), asOf: now, offset: 0 });

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify({ d: c.day, a: c.asOf, o: c.offset })).toString('base64url');
}

// `limit`: the list's cap (FEED_CANDIDATES); an offset at or past it cannot hold a card.
export function decodeCursor(raw: unknown, now: number, limit: number): Cursor | null {
  if (typeof raw !== 'string' || !raw.length || raw.length > CURSOR_MAX_BYTES || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  let v: unknown;
  try {
    const text = Buffer.from(raw, 'base64url').toString('utf8');
    if (Buffer.from(text).toString('base64url') !== raw) return null; // not canonical: tampered or truncated
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (Object.keys(o).sort().join() !== 'a,d,o') return null;
  const { d: day, a: asOf, o: offset } = o;
  if (typeof day !== 'string' || !Number.isSafeInteger(asOf) || !Number.isSafeInteger(offset)) return null;
  const at = asOf as number, off = offset as number;
  if (at > now + SKEW_MS || at < now - CURSOR_MAX_AGE_MS || utcDay(at) !== day) return null;
  if (off < PAGE_SIZE || off % PAGE_SIZE !== 0 || off >= limit) return null;
  return { day, asOf: at, offset: off };
}

// The page a `?after=` value asks for: a repeated param uses its first value; anything invalid is page 1.
export function readCursor(param: unknown, now: number, limit: number): Cursor {
  return decodeCursor(Array.isArray(param) ? param[0] : param, now, limit) ?? firstPage(now);
}

export function pageOf<T>(list: readonly T[], c: Cursor): { items: T[]; next: Cursor | null } {
  const end = c.offset + PAGE_SIZE;
  return { items: list.slice(c.offset, end), next: end < list.length ? { ...c, offset: end } : null };
}
