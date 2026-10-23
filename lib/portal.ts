// F-1 PR-2b, S3: the embedded connection portal's protocol, pure so the browser and the tests share it. The vendor's
// portal, loaded in an iframe, posts window messages SUCCESS / ERROR / ABANDONED / CLOSED (as a string, optionally
// "STATUS:detail", or as an object with `status`); it opens the broker login in a popup it manages and ignores
// customRedirect while framed. No vendor SDK (pre-authorization #5 has no answer): this file is the in-repo protocol.

export const PORTAL_SLOW_MS = 3_000; // "Taking longer than usual."
export const PORTAL_LINK_MS = 8_000; // the persistent "Open in a new page instead" link is promoted to a button

export type PortalEvent =
  | { kind: 'success'; authorizationId: string | null }
  | { kind: 'error'; code: string | null }
  | { kind: 'closed' }
  | { kind: 'abandoned' };

// An id or code is an opaque short token; anything else is dropped (it is never used to navigate anywhere).
const token = (v: unknown): string | null => (typeof v === 'string' || typeof v === 'number') && /^[A-Za-z0-9_.-]{1,128}$/.test(String(v)) ? String(v) : null;

// Only a message from the exact origin of the portal URL the server minted counts. The caller also checks that the
// message came from the portal's own frame (event.source).
export function parsePortalMessage(ev: { origin: string; data: unknown }, expectedOrigin: string | null): PortalEvent | null {
  if (!expectedOrigin || ev.origin !== expectedOrigin) return null;
  let status: string, detail: unknown = null, id: unknown = null;
  const d = ev.data;
  if (typeof d === 'string') {
    const i = d.indexOf(':');
    status = (i < 0 ? d : d.slice(0, i)).trim().toUpperCase();
    detail = id = i < 0 ? null : d.slice(i + 1).trim();
  } else if (d && typeof d === 'object' && typeof (d as { status?: unknown }).status === 'string') {
    const o = d as { status: string; authorizationId?: unknown; errorCode?: unknown; detail?: unknown };
    status = o.status.toUpperCase();
    id = o.authorizationId ?? null;
    detail = o.errorCode ?? null;
  } else return null;
  switch (status) {
    case 'SUCCESS': return { kind: 'success', authorizationId: token(id) };
    case 'ERROR': return { kind: 'error', code: token(detail) };
    case 'CLOSED': case 'CLOSE_MODAL': return { kind: 'closed' };
    case 'ABANDONED': return { kind: 'abandoned' };
    default: return null;
  }
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
// The origin the browser checks messages against, from the URL the vendor returned to the server. Only https is ever
// embedded; plain http only on loopback while the test fake is configured (lib/vendor-env.ts keeps that out of production).
export function portalOrigin(url: string, opts: { allowLoopback: boolean }): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.username || u.password) return null;
  if (u.protocol === 'https:') return u.origin;
  if (u.protocol === 'http:' && opts.allowLoopback && LOOPBACK.has(u.hostname)) return u.origin;
  return null;
}

// Browsers that cannot show the portal's popup go straight to the redirect flow, generically: an Android WebView (the
// `wv` token), an iOS-style WebKit view (a `Mobile/<build>` token not followed by a browser's own `Name/<version>`
// token), and a site installed to the home screen (standalone display). Anything misread still has the persistent link.
export function prefersRedirect(ua: string, standalone = false): boolean {
  if (standalone) return true;
  if (/;\s*wv\)/.test(ua)) return true;
  return /\bMobile\/\w+/.test(ua) && !/\bMobile\/\w+ [A-Za-z]+\/[\d.]+/.test(ua);
}

// Where a counted message may take the app: one of two fixed same-origin paths, never anything the message carries.
// SUCCESS / CLOSED / ABANDONED → the server decides at /connect/done (consent if a link happened, S7a otherwise);
// ERROR (a blocked broker popup reports itself this way) → the redirect flow on the same attempt.
export const PORTAL_REDIRECT = '/connect/start';
export const PORTAL_DONE = '/connect/done?m=embedded';
export const portalTarget = (m: PortalEvent): typeof PORTAL_REDIRECT | typeof PORTAL_DONE => (m.kind === 'error' ? PORTAL_REDIRECT : PORTAL_DONE);

// Fix round 1 (tester defect 1): a vendor that refuses framing (CSP frame-ancestors) still fires the frame's load event,
// on a blank document. So "loaded" alone is not "working": the portal has spoken only once a message from its origin and
// its frame arrives (any message, known or not: the handshake). What S3 shows, from the timers' and the frame's flags:
//   before load: "Opening…", plus "Taking longer than usual." from 3 s; the new-page link promoted to a button at 8 s;
//   loaded but silent for PORTAL_LINK_MS after load (stuck), or the frame errored: "Taking longer than usual." and the
//   promoted button, whatever the load event said;
//   a handshake: nothing more, the portal is working (the persistent link goes back to a link).
export type PortalFlags = { loaded: boolean; handshake: boolean; slow: boolean; promoted: boolean; stuck: boolean; errored: boolean };
export function portalView(f: PortalFlags): { line: 'opening' | 'opening-slow' | 'slow' | null; promote: boolean } {
  if (f.handshake) return { line: null, promote: false };
  if (f.errored || (f.loaded && f.stuck)) return { line: 'slow', promote: true };
  if (f.loaded) return { line: null, promote: f.promoted }; // a button promoted while loading stays one: no flicker
  return { line: f.slow ? 'opening-slow' : 'opening', promote: f.promoted };
}
