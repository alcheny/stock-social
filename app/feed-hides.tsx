'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FOLLOW, LIKES } from '@/lib/copy.ts';
import { notInterested, rejectTrade, undoNotInterested, undoRejectTrade } from './discovery-actions.ts';
import { UNDO_MS } from './follow-button.tsx';

// F-2 PR-2 (plan demand B): "Not interested" on the feed, signed in. The trader's cards drop in place (a style rule,
// so a page appended meanwhile drops them too; the server leaves them out of later pages); nothing else moves: the
// card after the one the reader was on takes its place, instantly (no motion). "Hidden for 90 days." with Undo for
// 5 s (focus goes to Undo, then to that card); Undo puts the cards back where they were. A refusal puts them back too.
// Fix round 1: the timer pauses while Undo has keyboard focus or the pointer is on the bar (WCAG 2.2.1); Esc or Tab
// closes it. Focus never drops to the page: it goes to the next visible card (or the one before, at the end), and
// after Undo to the "…" of the pane the reader hid from (the side they were on).
// F-2 PR-3: a hide from the suggestions section (its "…" menu, its reject swipe or the sheet it opens) collapses that
// row (and the trader's cards) with the reader left on the section; focus goes to the next row, Undo returns to the
// row's "…". Fix round 1: when no row is left the section collapses (no empty full-height stop) and card 6 takes its
// place; the bar also pauses once the reader touches or clicks it (any pointer), not only on hover or keyboard focus.
// F-2 PR-4: a hide with `trade` (the feed card's reject, O1) hides that one card ([data-key]) and calls rejectTrade;
// Undo returns to that card's "…". Fix round 1 (UX D1, tester High 1): `via` says how the hide was asked for. From a
// pointer (a swipe, a tap) the 5 s run and Undo takes focus without a ring; from the keyboard they pause while Undo has
// focus (WCAG 2.2.1). Before, a programmatic focus after a swipe matched :focus-visible and paused the bar for good.
// The feed cards' footers always sit above where the bar opens (tester Medium 1; fix round 2: room reserved for good, so
// nothing moves when the bar opens or closes), so the second tap of a double tap on "Hide this trade" cannot hit Undo.
type Bar = { handle: string; trade?: string; text: string; undo: boolean; via?: 'key' | 'pointer' };
type Hide = { handle: string; trade?: string };
const HANDLE = /^[a-z0-9_]{3,20}$/, KEY = /^[0-9a-f]{64}$/;
const sel = (h: Hide) => (h.trade ? `[data-key="${h.trade}"]` : `[data-handle="${h.handle}"]`);
const same = (a: Hide) => (b: Hide) => a.handle === b.handle && a.trade === b.trade;

// F-2 PR-3b: `scope`, the part of the page whose rows a hide collapses (the profile's Similar trades section).
export function FeedHides({ scope = '.feed' }: { scope?: string }) {
  const [hidden, setHidden] = useState<Hide[]>([]);
  const [bar, setBar] = useState<Bar | null>(null);
  const timer = useRef(0);
  const undoBtn = useRef<HTMLButtonElement>(null);
  const anchor = useRef<Element | null>(null); // the row to keep at the top after the next change
  const after = useRef<Element | null>(null); // where focus goes when the bar closes
  const source = useRef<Element | null>(null); // the row the reader hid from (Undo returns there)
  const refocus = useRef<HTMLElement | null>(null); // focused after the next change of `hidden`
  const toCard = () => {
    const target = (r: Element | null) => (r && (r as HTMLElement).offsetParent ? [...r.querySelectorAll<HTMLElement>('.card .who, .sopen')].find((e) => e.offsetParent) : undefined);
    let r: Element | null = after.current, f: HTMLElement | undefined;
    while (r && !(f = target(r))) r = r.nextElementSibling;
    if (!f) { r = source.current; while (r && !(f = target(r))) r = r.previousElementSibling; }
    // Fix round 1 (UX blocker): on a profile, once every row is hidden the section is hidden too; focus goes to the next
    // focusable item after it ("← Feed"), never to the page.
    if (!f && scope !== '.feed') {
      const box = document.querySelector(scope);
      f = box ? [...document.querySelectorAll<HTMLElement>('a[href], button, summary, [tabindex="0"]')].find((e) => !box.contains(e) && !!(box.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) && e.offsetParent) : undefined;
    }
    // Fix round 2 (UX N2): after a pointer hide (a swipe, a tap) the next card or row takes focus without a ring.
    (f ?? document.querySelector<HTMLElement>('.feed .row .card .who'))?.focus({ preventScroll: true, focusVisible: via.current === 'key' } as FocusOptions);
  };
  const close = () => { clearTimeout(timer.current); const had = !!document.activeElement?.closest('.hide-bar'); setBar(null); if (had) toCard(); };
  const run = () => { clearTimeout(timer.current); timer.current = window.setTimeout(close, UNDO_MS); };
  const hover = useRef(false);
  const pressed = useRef(false); // a pointer went down on the bar since it opened
  const via = useRef<Bar['via']>(undefined);
  const paused = () => hover.current || pressed.current || (via.current === 'key' && document.activeElement === undoBtn.current);
  const show = (b: Bar | null) => {
    clearTimeout(timer.current);
    pressed.current = false;
    via.current = b?.via;
    setBar(b);
    if (b) run();
  };
  useEffect(() => {
    const onHide = async (e: Event) => {
      const { handle, row, trade, via: how } = (e as CustomEvent<{ handle: string; row: Element | null; trade?: string; via?: 'key' }>).detail;
      if (!HANDLE.test(handle) || (trade !== undefined && !KEY.test(trade))) return;
      const h: Hide = { handle, trade };
      const inSection = !!row?.matches('.suggest');
      let n = inSection ? null : row?.nextElementSibling ?? null;
      while (n && !trade && n.getAttribute('data-handle') === handle) n = n.nextElementSibling;
      anchor.current = n;
      after.current = inSection ? row : n;
      source.current = row;
      setHidden((x) => [...x, h]);
      show({ ...h, text: trade ? LIKES.hidden : FOLLOW.hidden, undo: true, via: how === 'key' ? 'key' : 'pointer' });
      const r = await (trade ? rejectTrade(trade) : notInterested(handle)).catch(() => ({ ok: false }));
      if (!r.ok) { setHidden((x) => x.filter((y) => !same(h)(y))); show({ ...h, text: FOLLOW.failed, undo: false }); }
    };
    addEventListener('ss:hide', onHide);
    return () => { removeEventListener('ss:hide', onHide); clearTimeout(timer.current); };
  }, []);
  useLayoutEffect(() => {
    const feed = document.querySelector('.feed'), a = anchor.current;
    anchor.current = null;
    if (feed && a && (a as HTMLElement).offsetParent) feed.scrollTop += a.getBoundingClientRect().top - feed.getBoundingClientRect().top;
    refocus.current?.focus({ preventScroll: true });
    refocus.current = null;
  }, [hidden]);
  useEffect(() => {
    if (bar?.undo) { undoBtn.current?.focus({ preventScroll: true, focusVisible: bar.via === 'key' } as FocusOptions); if (paused()) clearTimeout(timer.current); }
  }, [bar]);
  const undo = async ({ handle, trade }: Hide) => {
    show(null);
    const first = source.current ?? document.querySelector(`.feed .row${sel({ handle, trade })}`);
    const r = await (trade ? undoRejectTrade(trade) : undoNotInterested(handle)).catch(() => ({ ok: false }));
    if (!r.ok) { show({ handle, trade, text: FOLLOW.failed, undo: false }); return; }
    anchor.current = first;
    refocus.current = (trade ? first?.querySelector<HTMLElement>('.card .more-menu summary') : null) ?? first?.querySelector<HTMLElement>(`li[data-handle="${handle}"] .more-menu summary`) ?? first?.querySelector<HTMLElement>(`li[data-handle="${handle}"] .sopen`)
      ?? first?.querySelector<HTMLElement>('.pane .more-menu summary') ?? first?.querySelector<HTMLElement>('.card .who') ?? null;
    setHidden((x) => x.filter((y) => !same({ handle, trade })(y)));
  };
  const pause = () => clearTimeout(timer.current);
  const traders = hidden.filter((h) => !h.trade);
  const resume = () => { if (bar && !paused()) run(); };
  return (
    <>
      <style>{hidden.map((h) => `${scope} ${sel(h)}{display:none}`).join('')
        + (traders.length ? `:is(${scope} .suggest, .suggest${scope}):not(:has(> .suggest-in > ul > li${traders.map((h) => `:not([data-handle="${h.handle}"])`).join('')})){display:none}` : '')}</style>
      <div className="hide-bar" role="status" data-via={bar?.via}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') { hover.current = true; pause(); } }}
        onPointerLeave={() => { hover.current = false; resume(); }}
        onPointerDown={() => { pressed.current = true; pause(); }}
        onFocus={() => { if (paused()) pause(); }} onBlur={() => setTimeout(resume)}
        onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); close(); } }}>
        {bar && <p>{bar.text}{bar.undo && <> <button type="button" ref={undoBtn} onClick={() => void undo(bar)}>{FOLLOW.undo}</button></>}</p>}
      </div>
    </>
  );
}
