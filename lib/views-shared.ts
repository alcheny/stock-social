// F-15: the pure parts of the view counter that the browser also runs (app/view-beacon.tsx): no database, no Node API.
// The server side is lib/views.ts.
import { normalizeHandle } from './referral.ts';

export const BEACON_BYTES = 512;
export const VISIBLE_MS = 2_000; // the page must have been visible this long in total before the beacon is sent

// The surfaces counted (market council cycle 2, E1). Every other path is not counted.
export const SURFACES = ['feed', 'profile', 'trade', 'month', 'ticker', 'compare', 'login', 'how'] as const;
// view_drops only: a dropped beacon whose path is not a counted surface.
export const DROP_OTHER = 'other';
export type Surface = (typeof SURFACES)[number];
export const REF_CLASSES = ['internal', 'external', 'none'] as const;
export type RefClass = (typeof REF_CLASSES)[number];
export const DROP_REASONS = ['declared_bot', 'no_fetch_metadata', 'automation', 'rate'] as const;
export type DropReason = (typeof DROP_REASONS)[number];

// A path → its surface and, for record surfaces, the handle in it (resolved to a user id by the route; never stored).
export type Target = { surface: Surface; handle: string | null; detail: string | null };
export function surfaceOf(path: unknown): Target | null {
  if (typeof path !== 'string' || path.length > 200 || !path.startsWith('/')) return null;
  const p = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const plain = (surface: Surface): Target => ({ surface, handle: null, detail: null });
  if (p === '/') return plain('feed');
  if (p === '/how') return plain('how');
  if (p === '/login') return plain('login');
  if (p === '/t/compare') return plain('compare');
  // A ticker page 404s for a malformed symbol (lib/ticker.ts#normalizeSymbol, same rule; lib/f15-views.test.ts pins it).
  const t = /^\/t\/([^/]+)$/.exec(p);
  if (t) return /^[A-Z][A-Z0-9.-]{0,9}$/.test(decodeSafe(t[1]).trim().toUpperCase()) ? plain('ticker') : null;
  const m = /^\/u\/([^/]+)(?:\/(trade|month)\/([^/]+))?$/.exec(p);
  if (!m) return null;
  // The pages match the handle exactly (no case folding or trimming): /u/Maya is a 404, so it counts nothing.
  const raw = decodeSafe(m[1]);
  const handle = normalizeHandle(raw);
  if (!handle || handle !== raw) return null;
  if (m[2] === 'month' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(m[3])) return null;
  const detail = m[3] ? decodeSafe(m[3]) : null;
  if (m[2] === 'trade' && (!detail || detail.length > 128 || detail.includes('\0'))) return null;
  return { surface: (m[2] as 'trade' | 'month' | undefined) ?? 'profile', handle, detail };
}
const decodeSafe = (s: string) => { try { return decodeURIComponent(s); } catch { return ''; } };

// The referrer reduced to a class, in the browser (app/view-beacon.tsx): only its origin is compared, so the full referrer
// never leaves the device. A soft navigation inside the app is 'internal'.
export function refClass(referrer: string, origin: string): RefClass {
  if (!referrer) return 'none';
  try { return new URL(referrer).origin === origin ? 'internal' : 'external'; } catch { return 'none'; }
}
export const isRefClass = (v: unknown): v is RefClass => typeof v === 'string' && (REF_CLASSES as readonly string[]).includes(v);

