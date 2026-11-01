// F-2 PR-5: the events route accepts same-origin requests only. A browser marks a cross-site request with
// Sec-Fetch-Site and sends Origin on every POST; both must say this site (the Origin's host equals the request's Host or
// X-Forwarded-Host). A request with neither header (not a browser) is refused too. Pure (lib/discovery/events.test.ts).
export function sameOrigin(h: { get(name: string): string | null }): boolean {
  const site = h.get('sec-fetch-site');
  if (site !== null && site !== 'same-origin') return false;
  const origin = h.get('origin');
  if (origin === null) return site === 'same-origin';
  let host: string;
  try { host = new URL(origin).host; } catch { return false; }
  const own = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim();
  return !!own && host === own;
}
