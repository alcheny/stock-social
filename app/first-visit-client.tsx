'use client';
// F-13: the client parts of the first-visit line and the SW-1 swipe hint. Both server-render shown (no layout shift on a
// first visit); the pre-paint script in app/layout.tsx hides them for a returning visitor before the first paint; here
// the stored flag is re-read after hydration (useSyncExternalStore starts from the server's "shown") and re-applied to
// <html> in useLayoutEffect (the dev remount clears attributes React does not own). No cookie, no request.
import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { addSeenToken, deviceFlags, FLAGS, type FlagName } from '@/lib/device-flag.ts';

const flags = deviceFlags(() => (typeof window === 'undefined' ? undefined : window));
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const html = () => (typeof document === 'undefined' ? null : document.documentElement);

function markSeen(name: FlagName) {
  flags.set(FLAGS[name].key, FLAGS[name].value);
  addSeenToken(html(), FLAGS[name].token);
  listeners.forEach((l) => l());
}

function useSeen(name: FlagName): boolean {
  const seen = useSyncExternalStore(subscribe, () => flags.get(FLAGS[name].key) != null, () => false);
  useLayoutEffect(() => { if (flags.get(FLAGS[name].key) != null) addSeenToken(html(), FLAGS[name].token); }, [name]);
  return seen;
}

// The line's block: in flow (never an overlay), at the top of page 1's first card (app/feed-rows.tsx). Dismiss moves focus to the
// first card's profile link (WCAG 2.4.3), so focus never falls to <body>.
export function FirstVisitBox({ dismissLabel, children }: { dismissLabel: string; children: React.ReactNode }) {
  const dismissed = useSeen('line');
  if (dismissed) return null;
  const dismiss = () => {
    markSeen('line');
    const link = document.querySelector<HTMLElement>('[data-first-card-link]');
    link?.focus();
    // Review 4: when the first row shows its pane, the card is inert and focus() fails; take the first control in view.
    if (document.activeElement !== link) document.querySelector<HTMLElement>('.feed > .row > :not([inert]) :is(a[href], button)')?.focus();
  };
  return (
    <div className="first-visit" data-first-visit>
      {/* Floated right before the text, so the text wraps under it and the block stays short in card 1. */}
      <button type="button" className="quiet-x" aria-label={dismissLabel} onClick={dismiss}>×</button>
      <div className="fv-text">{children}</div>
    </div>
  );
}

// "Swipe ← for profile" on the first card of page 1 only. Gone after the first swipe or → key: either one scrolls a feed
// row sideways past half its width (FeedKeys and the native swipe both do), seen by one capture listener that removes
// itself once it fires. No dismiss button (no extra Tab stop on the card); no motion, hidden at once.
export function SwipeHint({ text }: { text: string }) {
  const seen = useSeen('hint');
  useEffect(() => {
    if (seen) return;
    const onScroll = (e: Event) => {
      const row = e.target as HTMLElement;
      if (!row?.classList?.contains('row') || !row.closest('.feed')) return;
      if (row.scrollLeft > row.clientWidth / 2) { document.removeEventListener('scroll', onScroll, true); markSeen('hint'); }
    };
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, [seen]);
  if (seen) return null;
  return <p className="swipe-hint small" data-swipe-hint>{text}</p>;
}
