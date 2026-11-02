'use client';
import { useEffect } from 'react';

// F-1 PR-3 fix round 4 (UX lead demand 1): with JavaScript on, the row the URL's hash names (the first new row after
// "Show 50 more", or the trade a chart point opens) takes focus, so keyboard and screen-reader users continue from it.
// Without JavaScript the browser still scrolls to the anchor. Runs on every window change and every hash change.
// FIXES-CYCLE5 (F5-24): `#note-<trade_key>` (the trade page's "Edit it on your profile", lib/own-note.ts) names the row's
// note field itself, by the key that survives a rebuild, and the field takes focus.
export function RowFocus({ window: w }: { window: number }) {
  useEffect(() => {
    const go = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!/^trade-\d+$/.test(id) && !/^note-[0-9a-f]{64}$/.test(id)) return;
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.focus();
    };
    go();
    addEventListener('hashchange', go);
    return () => removeEventListener('hashchange', go);
  }, [w]);
  return null;
}
