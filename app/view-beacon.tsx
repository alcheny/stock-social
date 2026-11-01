'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { VISIBLE_MS, refClass, surfaceOf } from '@/lib/views-shared.ts';

// F-15 (docs/features/F-15-measurement-foundation.md): the first-party view beacon. Renders nothing. Once a counted page
// (lib/views-shared.ts#surfaceOf) has been visible for VISIBLE_MS in total (time in a background tab does not count), one
// request goes to the app's own /api/views, fire-and-forget: it never blocks or changes the page and its errors are
// swallowed. It sends the path, the referrer's class (computed here from its origin, so the full referrer never leaves
// the device) and the landing link's ?via=; a browser that reports automation sends nothing. No cookie is set and nothing is
// written to device storage. Soft navigations count as `internal` and carry no via (carrying it forward is MRC2-3, the
// owner's). A search-param change is not a new view. Unmount cancels a pending send; nothing is sent on page hide.
// ponytail: pages that close before 2 s, or render without scripts, are not counted (the readout says "views, not
// people") — fix: none planned; this is the bot filter's price.
const doc = { landingPath: null as string | null, leftLanding: false, sentLanding: false };

export function ViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      if (!pathname) return;
      // The landing is the document's first page, counted or not: a reader who lands on an uncounted page from another
      // site and then opens a profile has navigated inside the app (internal), not arrived from outside.
      doc.landingPath ??= pathname;
      if (pathname !== doc.landingPath) doc.leftLanding = true;
      if (!surfaceOf(pathname)) return;
      // A browser that reports automation is not a person: nothing is sent (the route also drops a beacon that says so),
      // so automated test runs and scripted browsers never add a request to a page.
      if (navigator.webdriver === true) return;
      let acc = 0, since: number | null = null, timer: ReturnType<typeof setTimeout> | undefined, sent = false;
      const fire = () => {
        if (sent) return;
        sent = true;
        const landing = !doc.leftLanding && !doc.sentLanding && pathname === doc.landingPath;
        if (landing) doc.sentLanding = true;
        const via = landing ? new URLSearchParams(window.location.search).get('via') : null;
        const body = JSON.stringify({
          path: pathname,
          ref: landing ? refClass(document.referrer, window.location.origin) : 'internal',
          via: via && via.length <= 16 ? via : undefined,
          auto: navigator.webdriver === true,
        });
        fetch('/api/views', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'content-type': 'text/plain' }, body })
          .catch(() => { /* never surfaced */ });
      };
      const start = () => { since = performance.now(); timer = setTimeout(fire, Math.max(0, VISIBLE_MS - acc)); };
      const stop = () => { if (since !== null) acc += performance.now() - since; since = null; clearTimeout(timer); };
      const onVisibility = () => { if (sent) return; if (document.visibilityState === 'visible') { if (since === null) start(); } else stop(); };
      if (document.visibilityState === 'visible') start();
      document.addEventListener('visibilitychange', onVisibility);
      return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
    } catch { /* never surfaced */ }
  }, [pathname]);
  return null;
}
