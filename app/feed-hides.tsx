'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FC5, FOLLOW } from '@/lib/copy.ts';
import { LIKES } from '@/lib/copy.ts';
import { notInterested, rejectTradeAction, undoNotInterested, undoRejectTradeAction } from './discovery-actions.ts';
// FIXES-CYCLE5 (F5-21, C5-24, F3-24): the hide bar waits 20 s for the reader (WCAG 2.2.1); the follow bar keeps UNDO_MS.
export const HIDE_UNDO_MS = 20_000;

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
// F-2 PR-4: `trade`, a feed card's trade rejected (its swipe or "Hide this trade"): only that card drops, for good.
// `trade` is the row id (the style rule that drops the card); `key` its trade_key, which the actions send (stable
// across rebuildTrades; the row id is the fallback for a row rendered without one).
type Bar = { handle: string; text: string; undo: boolean; trade?: string; key?: string };
const HANDLE = /^[a-z0-9_]{3,20}$/;

// F-2 PR-3b: `scope`, the part of the page whose rows a hide collapses (the profile's Similar trades section).
export function FeedHides({ scope = '.feed' }: { scope?: string }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [trades, setTrades] = useState<string[]>([]);
  const [bar, setBar] = useState<Bar | null>(null);
  // FIXES-LABELS (QA round 2 N4): while the bar is raised, html.bar-hide gives the feed cards room under their F3 line in
  // browsers without :has() (app/globals.css).
  useEffect(() => {
    document.documentElement.classList.toggle('bar-hide', !!bar);
    return () => document.documentElement.classList.remove('bar-hide');
  }, [bar]);
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
  const run = () => { clearTimeout(timer.current); timer.current = window.setTimeout(close, HIDE_UNDO_MS); };
  // FIXES-CYCLE5 (F5-21): the bar pauses while the pointer is over it or pressed on it, or after any focusin inside it
  // that the bar did not make itself (Tab, Shift+Tab, a tap on a button, a screen reader's focus move). The hide's own
  // move of focus to Undo (`selfFocus`) does not pause it, so a reader who does nothing gets the full 20 s, then
  // close() → toCard(). When the pointer or focus leaves after a pause, a fresh 20 s starts.
  const hover = useRef(false);
  const pressed = useRef(false);
  const engaged = useRef(false);
  const selfFocus = useRef(false);
  const paused = () => hover.current || pressed.current || engaged.current;
  const show = (b: Bar | null) => {
    clearTimeout(timer.current);
    hover.current = pressed.current = engaged.current = false;
    setBar(b);
    if (b) run();
  };
  useEffect(() => {
    const onHide = async (e: Event) => {
      const { handle, row, trade, key: k } = (e as CustomEvent<{ handle: string; row: Element | null; trade?: string; key?: string }>).detail;
      if (!HANDLE.test(handle) || (trade !== undefined && !/^[0-9]+$/.test(trade))) return;
      const key = typeof k === 'string' && /^[0-9a-f]{64}$/.test(k) ? k : trade;
      if (trade) {
        anchor.current = after.current = row?.nextElementSibling ?? null;
        source.current = row;
        setTrades((t) => [...t, trade]);
        show({ handle, trade, key, text: LIKES.hidden, undo: true });
        const r = await rejectTradeAction(key).catch(() => ({ ok: false }));
        if (!r.ok) { setTrades((t) => t.filter((x) => x !== trade)); show({ handle, text: FOLLOW.failed, undo: false }); }
        return;
      }
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
  }, [hidden, trades]);
  useEffect(() => {
    if (!bar?.undo || !undoBtn.current || document.activeElement === undoBtn.current) return;
    selfFocus.current = true; // FIXES-CYCLE5 (F5-21): this focus is the bar's own, not the reader's
    undoBtn.current.focus({ preventScroll: true });
    selfFocus.current = false;
  }, [bar]);
  const undo = async (handle: string, trade?: string, key = trade) => {
    show(null);
    if (trade) {
      const r = await undoRejectTradeAction(key).catch(() => ({ ok: false }));
      if (!r.ok) { show({ handle, text: FOLLOW.failed, undo: false }); return; }
      anchor.current = source.current;
      refocus.current = source.current?.querySelector<HTMLElement>('.card .more-menu summary') ?? null;
      setTrades((t) => t.filter((x) => x !== trade));
      return;
    }
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
  const barEl = useRef<HTMLDivElement>(null);
  return (
    <>
      <style>{hidden.map((h) => `${scope} [data-handle="${h}"]{display:none}`).join('') + trades.map((t) => `${scope} > .row[data-trade="${t}"]{display:none}`).join('')
        + (hidden.length ? `:is(${scope} .suggest, .suggest${scope}):not(:has(> .suggest-in > ul > li${hidden.map((h) => `:not([data-handle="${h}"])`).join('')})){display:none}` : '')}</style>
      {/* FIXES-CYCLE5 (F5-21): Tab and Shift+Tab move through the bar's controls and out (they pause it while inside);
          Esc closes it onto the next card; Dismiss closes it the same way, as the timeout does. */}
      <div className="hide-bar" role="status" ref={barEl}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') { hover.current = true; pause(); } }}
        onPointerLeave={() => { hover.current = false; pressed.current = false; resume(); }}
        onPointerDown={() => { pressed.current = true; pause(); }}
        onPointerUp={(e) => { if (e.pointerType !== 'mouse') { pressed.current = false; resume(); } }}
        onFocus={() => { if (selfFocus.current) return; engaged.current = true; pause(); }}
        onBlur={(e) => { if (e.relatedTarget instanceof Node && barEl.current?.contains(e.relatedTarget)) return; engaged.current = false; setTimeout(resume); }}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } }}>
        {bar && <p>{bar.text}{bar.undo && <> <button type="button" ref={undoBtn} onClick={() => void undo(bar.handle, bar.trade, bar.key)}>{FOLLOW.undo}</button></>}
          {' '}<button type="button" className="secondary bar-dismiss" style={{ minHeight: 44, minWidth: 44 }} onClick={() => { clearTimeout(timer.current); setBar(null); toCard(); }}>{FC5.dismiss}</button></p>}
      </div>
    </>
  );
}
