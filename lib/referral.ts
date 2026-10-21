// Referral attribution: which profile's call to action brought a new trader. Pure; never shown to anyone.
export function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const h = raw.trim().toLowerCase();
  return /^[a-z0-9_]{3,20}$/.test(h) ? h : null;
}

// Legacy referred_via column: its CHECK only allows these two.
export const REFERRED_VIA = ['profile', 'trade'] as const;
export type ReferredVia = (typeof REFERRED_VIA)[number];
// Which surface's call to action brought the signup (referred_surface column; validated here, no CHECK).
export const REFERRED_SURFACES = ['profile', 'trade', 'month'] as const;
export type ReferredSurface = (typeof REFERRED_SURFACES)[number];
export function normalizeVia(v: unknown): ReferredSurface | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  return (REFERRED_SURFACES as readonly string[]).includes(s) ? (s as ReferredSurface) : null;
}
export function legacyVia(s: ReferredSurface | null): ReferredVia | null {
  return s === 'profile' || s === 'trade' ? s : null;
}
export const ctaVia = (raw: unknown): ReferredSurface => normalizeVia(raw) ?? 'profile';

export type Referrer = { id: number; handle: string; isDemo: boolean };

export function resolveReferrer(i: { refHandle: unknown; referrer: Referrer | null; newHandle?: string }): number | null {
  const ref = normalizeHandle(i.refHandle);
  if (!ref || !i.referrer || i.referrer.isDemo) return null;
  if (ref === normalizeHandle(i.newHandle)) return null;
  return i.referrer.id;
}

export type ReferredRow = { id: number; handle: string; isDemo: boolean; hasSnaptradeActivity: boolean; referredSurface: string | null };

// Owner-only feedback: referred users who actually connected a broker. Bare signups, demo users and self-referrals don't count.
export function referralSummary(i: { ownerId: number; ownerIsDemo: boolean; rows: ReferredRow[] }): { connected: number; handles: string[]; byVia: Record<string, number> } {
  if (i.ownerIsDemo) return { connected: 0, handles: [], byVia: {} };
  const seen = new Set<number>();
  const handles: string[] = [];
  const byVia: Record<string, number> = {};
  for (const r of i.rows) {
    if (r.isDemo || !r.hasSnaptradeActivity || r.id === i.ownerId || seen.has(r.id)) continue;
    seen.add(r.id);
    handles.push(r.handle);
    if (r.referredSurface) byVia[r.referredSurface] = (byVia[r.referredSurface] ?? 0) + 1;
  }
  return { connected: handles.length, handles, byVia };
}
