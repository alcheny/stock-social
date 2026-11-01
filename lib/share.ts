// One-click sharing: which path a Share button takes on this device (app/share-button.tsx).
// Phones get the system share sheet (with the record image when the device can share files, so it posts as a
// picture); desktops without a share sheet copy the link. Never a platform-specific button (docs/POLICY.md T5).
export type ShareMode = 'files' | 'link' | 'copy';

export function shareMode(c: { canShareFiles: boolean; canShare: boolean; hasImage: boolean }): ShareMode {
  if (c.hasImage && c.canShareFiles) return 'files';
  if (c.canShare) return 'link';
  return 'copy';
}

// The link shared or copied: absolute, so it works pasted anywhere.
export const absoluteUrl = (origin: string, path: string) => new URL(path, origin).toString();

// docs/POLICY.md F3: every image that shows performance carries this line, in plain view.
export const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';

// ---- F-15: the source class a shared link carries (lib/referral.ts#SHARE_VIAS) ----
// Which share control a link left from, read from what it shares: a trade page → trade, a month recap → month, a
// profile shared with its story picture → story, any other profile share → card. Never per person or per link.
export function shareVia(path: string, image?: string): 'card' | 'story' | 'trade' | 'month' {
  const p = path.split(/[?#]/)[0];
  if (/^\/u\/[^/]+\/trade\//.test(p)) return 'trade';
  if (/^\/u\/[^/]+\/month\//.test(p)) return 'month';
  if (image && /\/story(\?|$)/.test(image)) return 'story';
  return 'card';
}
// The path with `via=<code>` set (an existing via is replaced; other params and the fragment are kept).
export function withVia(path: string, via: string): string {
  const u = new URL(path, 'http://x.invalid');
  u.searchParams.set('via', via);
  return u.pathname + u.search + u.hash;
}
