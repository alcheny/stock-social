'use client';
import { useEffect } from 'react';
import { focusAfterKey, paneInert, restsOnCard } from '@/lib/feed-focus.ts';

// Feed row navigation: → opens the profile pane of the card in view, ← returns to the trade.
// Ignores keys the chart or a form already handled; back buttons scroll their own row.
// F-10 follow-up (approval cycle 2, fix #16): focus moves with the row (→ into the pane, ← and Back onto the card), and a
// row resting on its card has an `inert` pane, so Tab never lands off screen (lib/feed-focus.ts). The server renders no
// `inert`, so without JavaScript every pane stays reachable (the row scrolls to it). Panes go inert on the first Tab or
// ← / Back, not on load: until the keyboard is used nothing is off screen for focus, and an unopened pane's chart stays
// focusable by script (app.spec.ts fix round 8 loads it that way).
// ponytail: before the first Tab or ← a screen reader's browse cursor can still read off-screen panes — make them inert
// on load once app.spec.ts's fix round 8 test opens its pane with → instead of focusing the unopened chart by script
export function FeedKeys() {
  useEffect(() => {
    const go = (row: Element, left: number) =>
      row.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const paneOf = (row: Element) => row.querySelector<HTMLElement>(':scope > .pane');
    const whoIn = (row: Element, part: 'card' | 'pane') => row.querySelector<HTMLElement>(`:scope > .${part} .who`);
    const focusOf = (row: Element) => {
      const a = document.activeElement;
      if (!a || a === document.body) return 'none' as const;
      if (paneOf(row)?.contains(a)) return 'pane' as const;
      return row.querySelector(':scope > .card')?.contains(a) ? 'card' as const : 'other' as const;
    };
    // Focus follows the row: into the pane (made focusable first), or back onto the card with the pane inert again.
    const move = (row: Element, key: 'ArrowRight' | 'ArrowLeft' | 'back') => {
      const to = focusAfterKey(key, focusOf(row)), pane = paneOf(row);
      if (key === 'ArrowRight') { if (pane) pane.inert = false; go(row, row.clientWidth); }
      else go(row, 0);
      if (to) whoIn(row, to)?.focus({ preventScroll: true }); // the row's own smooth scroll shows it
      if (key !== 'ArrowRight' && pane && !pane.contains(document.activeElement)) pane.inert = true;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return onTab();
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if ((e.target as HTMLElement).closest?.('input, textarea, select')) return;
      const row = [...document.querySelectorAll('.row')].find((r) => Math.abs(r.getBoundingClientRect().top) < r.clientHeight / 2);
      if (!row) return;
      move(row, e.key);
      e.preventDefault();
    };
    // Before the browser moves focus (keydown runs first): every resting row's pane is inert, every open one is not. Focus
    // left inside a pane whose row came back to its card (a touch swipe) first moves onto that card.
    // ponytail: one pass over every feed row per Tab press (cheap at 30-60 rows; pages append without limit) — keep a set
    // of rows touched since the last pass if long sessions show it
    const onTab = () => {
      for (const row of document.querySelectorAll<HTMLElement>('.feed > .row')) {
        const pane = paneOf(row);
        if (!pane) continue;
        let holdsFocus = pane.contains(document.activeElement);
        if (holdsFocus && restsOnCard(row.scrollLeft, row.clientWidth)) { whoIn(row, 'card')?.focus({ preventScroll: true }); holdsFocus = false; }
        pane.inert = paneInert({ scrollLeft: row.scrollLeft, clientWidth: row.clientWidth, holdsFocus });
      }
    };
    // A row scrolling toward its pane (a swipe, a scroll by focus) frees it at once: inert would also block its taps.
    const last = new WeakMap<Element, number>();
    const onScroll = (e: Event) => {
      const r = e.target as Element;
      if (!(r instanceof HTMLElement) || !r.matches('.feed > .row')) return;
      const toward = r.scrollLeft > (last.get(r) ?? 0);
      last.set(r, r.scrollLeft);
      const pane = toward ? paneOf(r) : null;
      if (pane?.inert) pane.inert = false;
    };
    const onClick = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest('[data-back]')?.closest('.row');
      if (row) move(row, 'back');
    };
    addEventListener('keydown', onKey);
    addEventListener('click', onClick);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => { removeEventListener('keydown', onKey); removeEventListener('click', onClick); document.removeEventListener('scroll', onScroll, { capture: true }); };
  }, []);
  return null;
}
