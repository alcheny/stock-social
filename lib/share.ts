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
