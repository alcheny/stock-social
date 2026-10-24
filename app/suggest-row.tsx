'use client';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { SECTION } from '@/lib/copy.ts';
import { canArm, horizontal, swipeOutcome } from '@/lib/discovery/reject.ts';

// F-2 PR-3: one section row. A tap (or Enter) on it opens the trader's pane as a modal sheet; Esc, "← Back" or a tap
// outside closes it and focus returns to the row. With JavaScript the row is its own native scroll-snap container
// [reject tray (signed in) | row | open sentinel], resting on the row (scroll-snap-stop: always): swiping toward the
// sentinel opens the sheet; swiping toward the tray commits "Not interested" (the menu's action:
// app/feed-hides.tsx collapses the row and shows "Hidden for 90 days." with Undo for 5 s). The reject arms only on a
// touch that starts on the row at rest, with no sheet open and not within 400 ms after one closed, while the travel is
// horizontal, and it commits only when the finger itself travelled half the row card (fix round 1: never on where a
// fling lands; lib/discovery/reject.ts). Feed cards keep SW-1 exactly (O1 open). Without JavaScript the row is a link.
// Where the tray is wider than the row (a very narrow row or large text), the row never reads as at rest, so the swipe
// never arms: it fails safe and the "…" menu stays the way.
let lastClose = 0;

// F-2 PR-3b: `href`, where the row leads without JavaScript (a Similar trades row: that trade's page); `lazy`, the pane
// enters the page only when its sheet first opens (a profile keeps one chart and one list of closes until then).
export function SuggestRow({ handle, name, signedIn, pane, actions, children, href = `/u/${handle}`, lazy = false }: { handle: string; name: string; signedIn: boolean; pane: ReactNode; actions: ReactNode; children: ReactNode; href?: string; lazy?: boolean }) {
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(!lazy);
  const box = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  const armed = useRef(false);
  const start = useRef<{ x: number; y: number; locked: boolean; last: number } | null>(null);
  const travel = useRef(0); // the finger's travel toward the tray at its last lift
  const timer = useRef(0);
  const rest = () => (signedIn ? box.current?.clientWidth ?? 0 : 0);
  const toRest = (smooth = false) => box.current?.scrollTo({ left: rest(), behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
  // Reviewer (UX R2-2): the sheet opens on the trader's name, not on its skip link (still the first Tab stop before it).
  const show = () => { const d = sheet.current; if (d && !d.open) { d.showModal(); d.querySelector<HTMLElement>('.pane .who')?.focus(); } };
  const want = useRef(false);
  const isShown = useRef(!lazy);
  const open = () => { if (isShown.current) show(); else { isShown.current = want.current = true; setShown(true); } };
  useEffect(() => { if (shown && want.current) { want.current = false; show(); } }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => sheet.current?.close();
  useEffect(() => setReady(true), []);
  useLayoutEffect(() => { if (ready) toRest(); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = box.current, d = sheet.current;
    if (!ready || !el || !d) return;
    const settle = () => {
      if (start.current) return; // a finger is still down
      const o = swipeOutcome(el.scrollLeft, rest(), el.clientWidth, armed.current, travel.current, el.closest('.srow-wrap')?.clientWidth ?? Infinity);
      armed.current = false; travel.current = 0;
      if (o === 'open') { toRest(); open(); }
      else if (o === 'reject') { toRest(); dispatchEvent(new CustomEvent('ss:hide', { detail: { handle, row: el.closest('.suggest') } })); }
      else if (o === 'back') toRest(true);
    };
    const ends = 'onscrollend' in window;
    // Settle at scrollend (or 150 ms after the last scroll where scrollend is missing), and 150 ms after the finger lifts
    // if nothing scrolls any more (a row already at its end fires no scrollend after the lift).
    const onScroll = () => { clearTimeout(timer.current); if (!ends) timer.current = window.setTimeout(settle, 150); };
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY, locked: false, last: t.clientX };
      travel.current = 0;
      armed.current = signedIn && canArm({ atRest: Math.abs(el.scrollLeft - rest()) < 2, paneOpen: !!document.querySelector('dialog[open]'), sinceClose: Date.now() - lastClose });
    };
    const move = (e: TouchEvent) => {
      const s = start.current, t = e.touches[0];
      if (s && t) s.last = t.clientX;
      if (!s || s.locked) return;
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (Math.abs(dx) + Math.abs(dy) < 10) return;
      s.locked = true;
      if (!horizontal(dx, dy)) armed.current = false;
    };
    const up = (e: TouchEvent) => {
      const s = start.current;
      travel.current = s ? (e.changedTouches[0]?.clientX ?? s.last) - s.x : 0;
      start.current = null; clearTimeout(timer.current); timer.current = window.setTimeout(settle, 150);
    };
    const onHide = (e: Event) => { if ((e as CustomEvent<{ handle: string }>).detail.handle === handle && d.open) close(); };
    const onClose = () => { lastClose = Date.now(); };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('scrollend', settle);
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    d.addEventListener('close', onClose);
    addEventListener('ss:hide', onHide);
    // Back at rest whenever the row's size changes: a new width moves the rest point, and a row shown again after Undo
    // (display: none drops its scroll position) must not open on its tray.
    const ro = new ResizeObserver(() => { if (!start.current && el.clientWidth) toRest(); });
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll); el.removeEventListener('scrollend', settle);
      el.removeEventListener('touchstart', down); el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up); el.removeEventListener('touchcancel', up);
      d.removeEventListener('close', onClose); removeEventListener('ss:hide', onHide); clearTimeout(timer.current); ro.disconnect();
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="srow-wrap">
        <div className="srow" ref={box}>
          {ready && signedIn && <div className="stray" aria-hidden="true"><span>{SECTION.tray}</span></div>}
          <div className="sitem">
            <a className="sopen" href={href} aria-haspopup={ready ? 'dialog' : undefined}
              onClick={(e) => { if (!ready || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); open(); }}>{children}</a>
          </div>
          {ready && <div className="ssentinel" aria-hidden="true" />}
        </div>
        {/* Outside the swipe container, so the "…" menu is never clipped by it. */}
        {actions && <div className="sactions">{actions}</div>}
      </div>
      <dialog className="pane-sheet" ref={sheet} aria-label={`${name}’s record`}
        onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-back]')) close(); }}>
        {/* Fix round 1: the page's skip link is behind the modal, so the sheet has its own (shown when focused). */}
        {ready && <button type="button" className="sheet-skip" onClick={() => sheet.current?.querySelector<HTMLElement>('.sheet-note')?.focus()}>{SECTION.skip}</button>}
        {ready && shown && pane}
      </dialog>
    </>
  );
}
