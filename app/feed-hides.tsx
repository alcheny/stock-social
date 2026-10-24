'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FOLLOW } from '@/lib/copy.ts';
import { notInterested, undoNotInterested } from './discovery-actions.ts';
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
type Bar = { handle: string; text: string; undo: boolean };
const HANDLE = /^[a-z0-9_]{3,20}$/;

// F-2 PR-3b: `scope`, the part of the page whose rows a hide collapses (the profile's Similar trades section).
export function FeedHides({ scope = '.feed' }: { scope?: string }) {
  const [hidden, setHidden] = useState<string[]>([]);
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
    (f ?? document.querySelector<HTMLElement>('.feed .row .card .who'))?.focus({ preventScroll: true });
  };
  const close = () => { clearTimeout(timer.current); const had = !!document.activeElement?.closest('.hide-bar'); setBar(null); if (had) toCard(); };
  const run = () => { clearTimeout(timer.current); timer.current = window.setTimeout(close, UNDO_MS); };
  const hover = useRef(false);
  const pressed = useRef(false); // a pointer went down on the bar since it opened
  const paused = () => hover.current || pressed.current || !!undoBtn.current?.matches(':focus-visible');
  const show = (b: Bar | null) => {
    clearTimeout(timer.current);
    pressed.current = false;
    setBar(b);
    if (b) run();
  };
  useEffect(() => {
    const onHide = async (e: Event) => {
      const { handle, row } = (e as CustomEvent<{ handle: string; row: Element | null }>).detail;
      if (!HANDLE.test(handle)) return;
      const inSection = !!row?.matches('.suggest');
      let n = inSection ? null : row?.nextElementSibling ?? null;
      while (n && n.getAttribute('data-handle') === handle) n = n.nextElementSibling;
      anchor.current = n;
      after.current = inSection ? row : n;
      source.current = row;
      setHidden((h) => [...h, handle]);
      show({ handle, text: FOLLOW.hidden, undo: true });
      const r = await notInterested(handle).catch(() => ({ ok: false }));
      if (!r.ok) { setHidden((h) => h.filter((x) => x !== handle)); show({ handle, text: FOLLOW.failed, undo: false }); }
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
  useEffect(() => { if (bar?.undo) { undoBtn.current?.focus({ preventScroll: true }); if (paused()) clearTimeout(timer.current); } }, [bar]);
  const undo = async (handle: string) => {
    show(null);
    const first = source.current ?? document.querySelector(`.feed .row[data-handle="${handle}"]`);
    const r = await undoNotInterested(handle).catch(() => ({ ok: false }));
    if (!r.ok) { show({ handle, text: FOLLOW.failed, undo: false }); return; }
    anchor.current = first;
    refocus.current = first?.querySelector<HTMLElement>(`li[data-handle="${handle}"] .more-menu summary`) ?? first?.querySelector<HTMLElement>(`li[data-handle="${handle}"] .sopen`)
      ?? first?.querySelector<HTMLElement>('.pane .more-menu summary') ?? first?.querySelector<HTMLElement>('.card .who') ?? null;
    setHidden((h) => h.filter((x) => x !== handle));
  };
  const pause = () => clearTimeout(timer.current);
  const resume = () => { if (bar && !paused()) run(); };
  return (
    <>
      <style>{hidden.map((h) => `${scope} [data-handle="${h}"]{display:none}`).join('')
        + (hidden.length ? `:is(${scope} .suggest, .suggest${scope}):not(:has(> .suggest-in > ul > li${hidden.map((h) => `:not([data-handle="${h}"])`).join('')})){display:none}` : '')}</style>
      <div className="hide-bar" role="status"
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') { hover.current = true; pause(); } }}
        onPointerLeave={() => { hover.current = false; resume(); }}
        onPointerDown={() => { pressed.current = true; pause(); }}
        onFocus={() => { if (paused()) pause(); }} onBlur={() => setTimeout(resume)}
        onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); close(); } }}>
        {bar && <p>{bar.text}{bar.undo && <> <button type="button" ref={undoBtn} onClick={() => void undo(bar.handle)}>{FOLLOW.undo}</button></>}</p>}
      </div>
    </>
  );
}
