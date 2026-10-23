// F-1 PR-2b, S3: the embedded connection portal's protocol, pure so the browser and the tests share it. The vendor's
// portal, loaded in an iframe, posts window messages SUCCESS / ERROR / ABANDONED / CLOSED (as a string, optionally
// "STATUS:detail", or as an object with `status`); it opens the broker login in a popup it manages and ignores
// customRedirect while framed. No vendor SDK (pre-authorization #5 has no answer): this file is the in-repo protocol.

export const PORTAL_SLOW_MS = 3_000; // "Taking longer than usual."
export const PORTAL_LINK_MS = 8_000; // before load: the persistent "Open in a new page instead" link is promoted to a button
// Fix round 2: the dialog opens when the server says the portal can be framed, or after this long if the mint is
// still running (so the before-load rules above still have a dialog to show in).
export const PORTAL_MINT_GRACE_MS = 1_000;

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
// ERROR (a blocked broker popup reports itself this way) → the redirect flow on the same attempt, via PORTAL_CONTINUE.
export const PORTAL_REDIRECT = '/connect/start';
export const PORTAL_DONE = '/connect/done?m=embedded';
// Fix round 2 (engineer walk, UX lead note 4): an ERROR (the blocked popup) goes through one app page that says why the
// vendor's own page comes next, then on to the redirect flow (PORTAL_REDIRECT) on the same attempt.
export const PORTAL_CONTINUE = '/connect/continue';
export const portalTarget = (m: PortalEvent): typeof PORTAL_CONTINUE | typeof PORTAL_DONE => (m.kind === 'error' ? PORTAL_CONTINUE : PORTAL_DONE);

// What S3 shows, from the timers' and the frame's flags (fix round 2, business lead 1 and UX lead 1: no false alarm
// over a loaded portal). Fix round 1's rule still holds that "loaded" alone is not "working" (a refused frame loads
// blank); a handshake (any message from the minted origin and the portal's own frame) means it is working.
//   before load: "Opening…", plus "Taking longer than usual." from 3 s; at 8 s the new-page link becomes the filled
//     primary button (unchanged);
//   loaded: never the slow line and never the filled primary (a working portal can stay silent until the trader acts).
//     A control promoted while loading becomes the secondary button. After PORTAL_BLANK_MS of silence after the load, or
//     a frame error: "Page blank? Open it in a new page." beside the secondary button;
//   a handshake: nothing more, the control is a plain link.
export const PORTAL_BLANK_MS = 8_000;
export type PortalFlags = { loaded: boolean; handshake: boolean; slow: boolean; promoted: boolean; stuck: boolean; errored: boolean };
export type PortalLine = 'opening' | 'opening-slow' | 'blank' | null;
export type PortalControl = 'link' | 'primary' | 'secondary';
export function portalView(f: PortalFlags): { line: PortalLine; control: PortalControl } {
  if (f.handshake) return { line: null, control: 'link' };
  if (f.errored || (f.loaded && f.stuck)) return { line: 'blank', control: 'secondary' };
  if (f.loaded) return { line: null, control: f.promoted ? 'secondary' : 'link' };
  return { line: f.slow ? 'opening-slow' : 'opening', control: f.promoted ? 'primary' : 'link' };
}

// Fix round 2 (business lead 1): whether a browser would let the app's origin frame the portal, from the portal's
// response headers. Read on the server (lib/portal-probe.ts) so the client never has to guess. CSP `frame-ancestors`
// wins over `X-Frame-Options` when present (as browsers do), and every policy in the header must allow the app;
// `X-Frame-Options: DENY` refuses, `SAMEORIGIN` refuses unless the app is on the portal's own origin, anything else
// (the obsolete ALLOW-FROM included) is ignored, as browsers ignore it.
export function framingAllowed(h: { xfo: string | null; csp: string | null }, appOrigin: string, portalOrigin: string): boolean {
  const policies = (h.csp ?? '').split(',').map((p) => p.split(';').map((d) => d.trim().split(/\s+/)).find((d) => d[0]?.toLowerCase() === 'frame-ancestors'))
    .filter((d): d is string[] => !!d);
  if (policies.length) return policies.every((d) => d.slice(1).some((src) => sourceMatches(src, appOrigin, portalOrigin)));
  const xfo = (h.xfo ?? '').split(',').map((v) => v.trim().toLowerCase());
  if (xfo.includes('deny')) return false;
  if (xfo.includes('sameorigin')) return appOrigin === portalOrigin;
  return true;
}
const defaultPort = (scheme: string) => (scheme === 'https:' ? '443' : scheme === 'http:' ? '80' : '');
function sourceMatches(src: string, appOrigin: string, portalOrigin: string): boolean {
  let app: URL;
  try { app = new URL(appOrigin); } catch { return false; }
  const s = src.toLowerCase();
  if (s === "'none'") return false;
  if (s === "'self'") return appOrigin === portalOrigin;
  if (s === '*') return app.protocol === 'https:' || app.protocol === 'http:';
  if (/^[a-z][a-z0-9+.-]*:$/.test(s)) return app.protocol === s || (s === 'http:' && app.protocol === 'https:');
  const m = s.match(/^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.)?([a-z0-9.-]+|\*)(?::(\d+|\*))?(?:\/.*)?$/);
  if (!m) return false;
  const [, scheme, wild, host, port] = m;
  const base = scheme ? `${scheme}:` : new URL(portalOrigin).protocol;
  if (!(app.protocol === base || (base === 'http:' && app.protocol === 'https:'))) return false;
  const appHost = app.hostname.toLowerCase();
  if (host !== '*' && !(wild ? appHost.endsWith(`.${host}`) : appHost === host)) return false;
  const appPort = app.port || defaultPort(app.protocol);
  if (port === '*') return true;
  return (port ?? defaultPort(base)) === appPort || (!port && base === 'http:' && app.protocol === 'https:' && appPort === '443');
}
