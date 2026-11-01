'use client';
import { useEffect } from 'react';

// F-2 PR-5 (criteria 2, 12): the implicit activity logger. The feed page mounts it only for a signed-in viewer whose
// "Personalize with my activity" and "Personalize my feed" are both On (lib/discovery/activity.ts); otherwise it is not
// on the page at all, and /api/events stores nothing anyway. It renders nothing, takes no focus and shows nothing on
// failure. It measures visibility with IntersectionObserver, so reading by keyboard or screen reader counts the same as
// touch. What it sends, per card (a trade, by the card's id) or section row (a trader, by handle), once per page view:
// - impression: at least 60% visible for 500 ms;
// - dwell_long (≥ 5 s visible), dwell_short (1 to 5 s) or skip (seen, under 1 s), when it leaves view or the page hides;
// - swipe_open: the card's pane came into view (the opening swipe, SW-1);
// - profile_open: a link to a trader's profile was followed from the feed.
// One batch of at most 50 every 10 s and on pagehide (sendBeacon; text/plain, so no preflight); at most 500 queued. A
// refused batch is dropped (nothing retries).
const VISIBLE = 0.6, IMPRESSION_MS = 500, LONG_MS = 5_000, SHORT_MS = 1_000, FLUSH_MS = 10_000, BATCH = 50, QUEUE_MAX = 500;
type Target = { kind: 'trade'; id: string } | { kind: 'trader'; handle: string };
type Ev = { type: string; surface: 'feed' | 'section' | 'pane'; target: Target };

export function DiscoveryLog() {
  useEffect(() => {
    const queue: Ev[] = [];
    const once = new Set<string>();
    const since = new Map<Element, number>();
    const total = new Map<Element, number>();
    const timers = new Map<Element, number>();
    const push = (e: Ev, key?: string) => {
      if (key) { if (once.has(key)) return; once.add(key); }
      if (queue.length < QUEUE_MAX) queue.push(e);
    };
    const send = (events: Ev[], beacon: boolean) => {
      const body = JSON.stringify({ events });
      if (beacon && navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'text/plain' }))) return;
      fetch('/api/events', { method: 'POST', body, keepalive: true, credentials: 'same-origin', headers: { 'content-type': 'text/plain' } }).catch(() => {});
    };
    // One batch per flush: the route takes one batch per viewer per 2 s, so a second one at once would be refused.
    const flush = (beacon: boolean) => { if (queue.length) send(queue.splice(0, BATCH), beacon); };
    const what = (el: Element): { target: Target; surface: Ev['surface']; key: string } | null => {
      const trade = (el as HTMLElement).dataset.trade, handle = (el as HTMLElement).dataset.handle;
      if (el.matches('.row') && trade) return { target: { kind: 'trade', id: trade }, surface: 'feed', key: `t${trade}` };
      if (handle) return { target: { kind: 'trader', handle }, surface: 'section', key: `h${handle}` };
      return null;
    };
    const left = (el: Element) => {
      const w = what(el), t0 = since.get(el);
      clearTimeout(timers.get(el));
      if (!w || t0 === undefined) return;
      since.delete(el);
      const ms = (total.get(el) ?? 0) + performance.now() - t0;
      total.set(el, ms);
      const type = ms >= LONG_MS ? 'dwell_long' : ms >= SHORT_MS ? 'dwell_short' : 'skip';
      push({ type, surface: w.surface, target: w.target }, `${type}:${w.key}`);
    };
    const cards = new IntersectionObserver((entries) => {
      for (const en of entries) {
        const el = en.target, w = what(el);
        if (!w) continue;
        if (en.intersectionRatio >= VISIBLE) {
          if (since.has(el)) continue;
          since.set(el, performance.now());
          timers.set(el, window.setTimeout(() => push({ type: 'impression', surface: w.surface, target: w.target }, `i:${w.key}`), IMPRESSION_MS));
        } else left(el);
      }
    }, { threshold: [0, VISIBLE] });
    // The opening swipe: a card's pane (its second child) scrolled into view.
    const panes = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.intersectionRatio < VISIBLE) continue;
        const row = en.target.closest('.row') as HTMLElement | null;
        if (row?.dataset.trade) push({ type: 'swipe_open', surface: 'pane', target: { kind: 'trade', id: row.dataset.trade } }, `s:${row.dataset.trade}`);
      }
    }, { threshold: [VISIBLE] });
    const watched = new WeakSet<Element>();
    const scan = () => {
      for (const el of document.querySelectorAll('.feed .row[data-trade], .feed .suggest li[data-handle]')) {
        if (watched.has(el)) continue;
        watched.add(el);
        cards.observe(el);
        const pane = el.matches('.row') ? el.querySelector('.pane') : null;
        if (pane) panes.observe(pane);
      }
    };
    scan();
    const mo = new MutationObserver(scan); // the pager appends pages
    const feed = document.querySelector('.feed');
    if (feed) mo.observe(feed, { childList: true, subtree: true });
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="/u/"]') as HTMLAnchorElement | null;
      const m = a && /^\/u\/([a-z0-9_]{3,20})(?:$|[/?#])/.exec(a.getAttribute('href') ?? '');
      if (!m || !a!.closest('.feed')) return;
      push({ type: 'profile_open', surface: a!.closest('.suggest') ? 'section' : 'feed', target: { kind: 'trader', handle: m[1] } }, `p:${m[1]}`);
    };
    document.addEventListener('click', click, true);
    const hide = () => { for (const el of [...since.keys()]) left(el); flush(true); };
    const vis = () => { if (document.visibilityState === 'hidden') hide(); };
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', vis);
    const every = window.setInterval(() => flush(false), FLUSH_MS);
    return () => {
      hide();
      cards.disconnect(); panes.disconnect(); mo.disconnect();
      document.removeEventListener('click', click, true);
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', vis);
      clearInterval(every);
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);
  return null;
}
