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
// Fix #28 (cycle 2): 'nav' is the nav's sign-in link on a profile (app/nav-login.tsx); it was sent but dropped here.
export const REFERRED_SURFACES = ['profile', 'trade', 'month', 'nav'] as const;
export type ReferredSurface = (typeof REFERRED_SURFACES)[number];
export function normalizeVia(v: unknown): ReferredSurface | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  return (REFERRED_SURFACES as readonly string[]).includes(s) ? (s as ReferredSurface) : null;
}
export function legacyVia(s: ReferredSurface | null): ReferredVia | null {
  return s === 'profile' || s === 'trade' ? s : null;
}
// A join button's own surface: the page it sits on. 'nav' is only the nav link's (app/nav-login.tsx), so a hand-typed
// ?via=nav on a profile still attributes that profile's join button to the profile (cycle 2 review of fix #28).
export type CtaSurface = Exclude<ReferredSurface, 'nav'>;
export const ctaVia = (raw: unknown): CtaSurface => { const v = normalizeVia(raw); return v && v !== 'nav' ? v : 'profile'; };

export type Referrer = { id: number; handle: string; isDemo: boolean };

export function resolveReferrer(i: { refHandle: unknown; referrer: Referrer | null; newHandle?: string }): number | null {
  const ref = normalizeHandle(i.refHandle);
  // F-7: a public filer ('pf_' handles, lib/public-gate.ts) is never a referrer.
  if (!ref || ref.startsWith('pf_') || !i.referrer || i.referrer.isDemo) return null;
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

// ---- F-15 (docs/features/F-15-measurement-foundation.md): the one closed `via` registry ----
// A `via` is a source class, never a per-person or per-link id: unknown values are dropped (to 'none'), so no id can be
// smuggled into a stored row. Codes are written by the product (Share appends a share class) or by the owner (invite
// codes on outreach links); adding one is a reviewed code change here, never a database value.
// Share classes: which share control the link left from (app/share-button.tsx, lib/share.ts#shareVia).
export const SHARE_VIAS = ['card', 'story', 'trade', 'month'] as const;
// Invite codes: one per recruiting segment (market council cycle 2, MRC #9), attribution only, gating no access.
export const INVITE_VIAS = ['inv_t', 'inv_h'] as const;
// Path codes: which sign-in path a reader chose (lib/funnel.ts META_KEYS.method_chosen 'path').
export const PATH_CODES = ['publish', 'follow'] as const;
export type PathCode = (typeof PATH_CODES)[number];
// Every source class a view may carry: share classes, the CTA surfaces above (incl. nav) and invite codes.
export const VIA_CODES = [...new Set([...SHARE_VIAS, ...REFERRED_SURFACES, ...INVITE_VIAS])] as readonly string[];
export const VIA_NONE = 'none';
const pick = (list: readonly string[], v: unknown): string | null => {
  if (typeof v !== 'string' || v.length > 16) return null;
  const s = v.trim().toLowerCase();
  return list.includes(s) ? s : null;
};
// A view's via: a registry code or 'none'.
export const viewVia = (v: unknown): string => pick(VIA_CODES, v) ?? VIA_NONE;
export const isViewVia = (v: unknown): boolean => typeof v === 'string' && (v === VIA_NONE || VIA_CODES.includes(v));
export const pathCode = (v: unknown): PathCode | null => pick(PATH_CODES, v) as PathCode | null;
// ponytail: invite codes are counted on views only; sign-up attribution (users.referred_surface) still needs a referrer
// handle, and outreach links point at Demo profiles, which resolveReferrer ignores — fix: an owner ruling on attributing
// sign-ups to a code with no referrer (MRC2-3), then normalizeVia accepts INVITE_VIAS.
