'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FOLLOW } from '@/lib/copy.ts';
import { notInterested, undoNotInterested } from './discovery-actions.ts';
import { UNDO_MS } from './follow-button.tsx';

// F-2 PR-2 (plan demand B): "Not interested" on the feed, signed in. The trader's cards drop in place (a style rule,
// so a page appended meanwhile drops them too; the server leaves them out of later pages); nothing else moves: the
// card after the one the reader was on takes its place, instantly (no motion). "Hidden for 90 days." with Undo for
// 5 s (focus goes to Undo, then to that card); Undo puts the cards back where they were. A refusal puts them back too.
type Bar = { handle: string; text: string; undo: boolean };
const HANDLE = /^[a-z0-9_]{3,20}$/;

export function FeedHides() {
  const [hidden, setHidden] = useState<string[]>([]);
  const [bar, setBar] = useState<Bar | null>(null);
  const timer = useRef(0);
  const undoBtn = useRef<HTMLButtonElement>(null);
  const anchor = useRef<Element | null>(null); // the row to keep at the top after the next change
  const after = useRef<Element | null>(null); // where focus goes when the bar closes
  const source = useRef<Element | null>(null); // the row the reader hid from (Undo returns there)
  const show = (b: Bar | null) => {
    clearTimeout(timer.current);
    setBar(b);
    if (b) timer.current = window.setTimeout(() => {
      setBar(null);
      if (document.activeElement?.closest('.hide-bar')) after.current?.querySelector<HTMLElement>('.card .who')?.focus({ preventScroll: true });
    }, UNDO_MS);
  };
  useEffect(() => {
    const onHide = async (e: Event) => {
      const { handle, row } = (e as CustomEvent<{ handle: string; row: Element | null }>).detail;
      if (!HANDLE.test(handle)) return;
      let n = row?.nextElementSibling ?? null;
      while (n && n.getAttribute('data-handle') === handle) n = n.nextElementSibling;
      anchor.current = after.current = n;
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
  }, [hidden]);
  useEffect(() => { if (bar?.undo) undoBtn.current?.focus({ preventScroll: true }); }, [bar]);
  const undo = async (handle: string) => {
    show(null);
    const first = source.current ?? document.querySelector(`.feed .row[data-handle="${handle}"]`);
    const r = await undoNotInterested(handle).catch(() => ({ ok: false }));
    if (!r.ok) { show({ handle, text: FOLLOW.failed, undo: false }); return; }
    anchor.current = first;
    setHidden((h) => h.filter((x) => x !== handle));
    requestAnimationFrame(() => first?.querySelector<HTMLElement>('.card .who')?.focus({ preventScroll: true }));
  };
  return (
    <>
      <style>{hidden.map((h) => `.feed .row[data-handle="${h}"]{display:none}`).join('')}</style>
      <div className="hide-bar" role="status">
        {bar && <p>{bar.text}{bar.undo && <> <button type="button" ref={undoBtn} onClick={() => void undo(bar.handle)}>{FOLLOW.undo}</button></>}</p>}
      </div>
    </>
  );
}
