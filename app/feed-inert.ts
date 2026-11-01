import { useEffect } from 'react';

// A11Y-FIXES #17 (WCAG 2.4.3, 2.4.7, 2.4.11; committee B5): the half of a feed row that is off screen is `inert`, so Tab
// never walks into a hidden pane and focus never sits at x < 0.
// - Only the direct children of `.feed > .row` (the card and its pane); sheets, dialogs and anything else are never touched.
// - A row rests on the card while `scrollLeft <= clientWidth / 2`, else on the pane. Applied on mount, to rows appended
//   later (`?after=` pages, through a MutationObserver on the feed) and as a swipe crosses the halfway point.
// - → (and ← / Back) un-inert the half being opened before the row scrolls, then move focus there: → to the pane's Back
//   button, Back or ← to the element that had focus in the card before →, else the card's name link. The keys are read
//   on `document` in the bubble phase: after the page's own handlers (React listens on the document root, registered at
//   hydration, so a chart that handled an arrow has already called preventDefault) and before app/feed-keys.tsx, which
//   listens on `window` and starts the scroll. That order comes from the DOM event path, not from effect order.
// - A swipe moves focus only when it was inside the half that becomes inert (to the other half's entry), never to <body>.
// - Never server-rendered: without JavaScript nothing is inert (touch users still swipe and tap the pane).
type Side = 'card' | 'pane';
const ROW = '.feed > .row';
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
const sideOf = (el: Element): Side => (el.classList.contains('card') ? 'card' : 'pane');
const restsOn = (row: HTMLElement): Side => (row.scrollLeft > row.clientWidth / 2 ? 'pane' : 'card');

export function useFeedInert() {
  useEffect(() => {
    const feed = document.querySelector<HTMLElement>('.feed');
    if (!feed) return;
    const going = new WeakMap<HTMLElement, { side: Side; timer: number }>(); // a keyboard-started scroll still under way
    const memory = new WeakMap<HTMLElement, HTMLElement>(); // what had focus in each row's card before →
    const halves = (row: HTMLElement) => [...row.children] as HTMLElement[];
    const entry = (row: HTMLElement, side: Side) => {
      const half = halves(row).find((k) => sideOf(k) === side);
      if (!half) return null;
      // Tester High 1: the pane keeps its own vertical scroll; opened again it starts at the top, so Back (focused with
      // preventScroll) is on screen, not at top < 0.
      if (side === 'pane') { half.scrollTop = 0; return half.querySelector<HTMLElement>('[data-back]') ?? half.querySelector<HTMLElement>(FOCUSABLE); }
      const kept = memory.get(row);
      return kept?.isConnected && half.contains(kept) ? kept : half.querySelector<HTMLElement>('.who') ?? half.querySelector<HTMLElement>(FOCUSABLE);
    };
    // Show `side`: un-inert it first, move focus into it when focus was in the other half (or, on a key, anywhere but
    // already inside it), inert the rest.
    const apply = (row: HTMLElement, side: Side, focus = false) => {
      const kids = halves(row), active = document.activeElement;
      const leaving = !!active && kids.some((k) => sideOf(k) !== side && k.contains(active));
      const inside = !!active && kids.some((k) => sideOf(k) === side && k.contains(active));
      for (const k of kids) if (sideOf(k) === side && k.inert) k.inert = false;
      if (leaving || (focus && !inside)) entry(row, side)?.focus({ preventScroll: true });
      for (const k of kids) if (sideOf(k) !== side && !k.inert) k.inert = true;
    };
    const sync = (row: HTMLElement) => { if (!going.has(row)) apply(row, restsOn(row)); };
    const settle = (row: HTMLElement) => {
      const g = going.get(row);
      if (!g) return;
      clearTimeout(g.timer);
      going.delete(row);
      apply(row, restsOn(row));
    };
    const timers = new Set<number>(), rafs = new Set<number>(); // cancelled on unmount (review 5)
    const steer = (row: HTMLElement, side: Side, focus = true) => {
      if (side === 'pane') {
        const a = document.activeElement, card = halves(row).find((k) => sideOf(k) === 'card');
        if (a instanceof HTMLElement && card?.contains(a)) memory.set(row, a);
      }
      const prev = going.get(row);
      if (prev) { clearTimeout(prev.timer); timers.delete(prev.timer); }
      // Until the scroll ends (scrollend, or 1.5 s where it is missing) the row keeps the side it is heading to.
      // ponytail: without scrollend a scroll slower than 1.5 s re-syncs mid-way (focus follows the half in view) — drop the timer once scrollend is everywhere.
      if (restsOn(row) !== side) {
        const timer = window.setTimeout(() => { timers.delete(timer); settle(row); }, 1500);
        timers.add(timer);
        going.set(row, { side, timer });
      } else going.delete(row);
      apply(row, side, focus);
    };
    const rowInView = () => [...document.querySelectorAll<HTMLElement>('.row')].find((r) => Math.abs(r.getBoundingClientRect().top) < r.clientHeight / 2);
    // The same guards as app/feed-keys.tsx, so this moves focus exactly when that scrolls.
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if ((e.target as HTMLElement).closest?.('input, textarea, select')) return;
      const row = rowInView();
      // Review 2: an arrow moves focus into the row only when focus is already in it (or nowhere); from the nav, the
      // first-visit line or the footer it still scrolls the row (app/feed-keys.tsx) and un-inerts the half, focus stays.
      const a = document.activeElement;
      if (row?.matches(ROW)) steer(row, e.key === 'ArrowRight' ? 'pane' : 'card', !a || a === document.body || row.contains(a));
    };
    const onClick = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest?.('[data-back]')?.closest<HTMLElement>('.row');
      if (row?.matches(ROW)) steer(row, 'card');
    };
    const frames = new WeakMap<HTMLElement, number>();
    const onScroll = (e: Event) => {
      const row = e.target as HTMLElement;
      if (!(row instanceof HTMLElement) || !row.matches(ROW) || frames.has(row)) return;
      const id = requestAnimationFrame(() => { rafs.delete(id); frames.delete(row); sync(row); });
      rafs.add(id);
      frames.set(row, id);
    };
    const onScrollEnd = (e: Event) => {
      const row = e.target as HTMLElement;
      if (row instanceof HTMLElement && row.matches(ROW)) settle(row);
    };
    const all = () => feed.querySelectorAll<HTMLElement>(':scope > .row').forEach(sync);
    const added = new MutationObserver((list) => {
      for (const m of list) m.addedNodes.forEach((n) => { if (n instanceof HTMLElement && n.matches(ROW)) sync(n); });
    });
    all();
    added.observe(feed, { childList: true });
    feed.addEventListener('scroll', onScroll, { capture: true, passive: true });
    feed.addEventListener('scrollend', onScrollEnd, { capture: true, passive: true });
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      timers.forEach((t) => clearTimeout(t));
      rafs.forEach((r) => cancelAnimationFrame(r));
      added.disconnect();
      feed.removeEventListener('scroll', onScroll, { capture: true });
      feed.removeEventListener('scrollend', onScrollEnd, { capture: true });
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, []);
}
