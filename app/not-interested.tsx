'use client';
import { useEffect, useRef } from 'react';
import { FOLLOW } from '@/lib/copy.ts';
import { notInterestedForm } from './discovery-actions.ts';

// F-2 PR-2: the "…" menu with "Not interested in @x", the single negative action (a 90-day exclusion, weight −4).
// Never on a feed card. With JavaScript the feed (app/feed-hides.tsx) hides the trader's cards in place and offers Undo
// for 5 s; without it the form posts the action and the reader lands on the trader's profile with a line saying so
// ("Show again" on /me/following). Fix round 1: the popover opens leftward from the button's right edge, never wider
// than the screen (it wraps); it closes on Esc (focus back on "…"), a click outside, or focus leaving it.
export function NotInterested({ handle }: { handle: string }) {
  return (
    <MoreMenu label={FOLLOW.more(handle)}>
      <form action={notInterestedForm.bind(null, handle)} onSubmit={(e) => {
        e.preventDefault();
        const d = e.currentTarget.closest('details');
        if (d) d.open = false;
        dispatchEvent(new CustomEvent('ss:hide', { detail: { handle, row: e.currentTarget.closest('.row, .suggest') } })); // F-2 PR-3: or a section row
      }}>
        <button type="submit" className="secondary">{FOLLOW.notInterested(handle)}</button>
      </form>
    </MoreMenu>
  );
}

// F-2 PR-4: the popover itself, shared with the feed card's menu (app/card-menu.tsx).
export function MoreMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const close = (refocus = false) => { if (!d.open) return; d.open = false; if (refocus) d.querySelector('summary')?.focus(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && d.open) { e.preventDefault(); close(true); } };
    const onDown = (e: PointerEvent) => { if (!d.contains(e.target as Node)) close(); };
    const onOut = (e: FocusEvent) => { if (e.relatedTarget && !d.contains(e.relatedTarget as Node)) close(); }; // Tab away (a click is onDown)
    d.addEventListener('keydown', onKey);
    d.addEventListener('focusout', onOut);
    document.addEventListener('pointerdown', onDown);
    return () => { d.removeEventListener('keydown', onKey); d.removeEventListener('focusout', onOut); document.removeEventListener('pointerdown', onDown); };
  }, []);
  return (
    <details className="more-menu" ref={ref}>
      <summary aria-label={label}><span aria-hidden="true">…</span></summary>
      {children}
    </details>
  );
}
