'use client';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { FEED, FEED_COUNTS } from '@/lib/copy.ts';
import { nextFeedPage } from './feed-actions.tsx';

// F-2 PR-1: auto-append, no tap. When the card 5 from the end comes into view, the next 30 server-rendered cards are
// fetched through the action and appended in place (one request in flight). A failure shows one inline Retry. Without
// JavaScript the same element is a plain `?after=<cursor>` link to the next page.
// Fix round 1 (blocking, all three reports): the page join.
// - A page that arrives while the reader is on the control (after Retry, a jump to the end, a fling, a slow server)
//   puts its first card (card 31) at the top, instantly. Before, the scroller kept the control in view while 30 cards
//   went in above it, so the reader skipped them, and the next page loaded from there, in a chain to card 180.
// - After a load, a card or the control loads the next page only once it comes into view anew: being in view when the
//   page arrived does not count. So one Retry or one jump is one request.
// - The control is out of scroll anchoring, and a card counts only once its top is inside the feed (card 25, not 24).
// Fix round 1 (UX follow-ups 2, 3, 5): "Loading…" while loading; Retry keeps focus while it retries and hands it to
// card 31 on success; a polite live line says how many trades were added. A card the reader already has (it can come
// back when the data changed between pages on another server) is left out.
export function FeedPager({ next: first }: { next: string }) {
  const [pages, setPages] = useState<ReactNode[]>([]);
  const [next, setNext] = useState<string | null>(first);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'stale'>('idle');
  const [retrying, setRetrying] = useState(false);
  const [said, setSaid] = useState('');
  const busy = useRef(false);
  const afterLoad = useRef(false);
  const pin = useRef<{ before: number; onControl: boolean; focus: boolean } | null>(null);
  const control = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    if (!next || busy.current) return;
    busy.current = true;
    setState('loading');
    try {
      const r = await nextFeedPage(next);
      if ('stale' in r) { setState('stale'); return; }
      // Where the reader is as the page arrives: at the control when any of it is in view (at the end of the list it
      // sits below the last card's lower part, as far as the feed scrolls).
      const feed = document.querySelector('.feed'), ctl = control.current;
      const shown = new Set([...document.querySelectorAll('.feed > .row[data-trade]')].map((e) => e.getAttribute('data-trade')));
      const rows = r.rows.filter((x) => !shown.has(x.id));
      pin.current = {
        before: feed?.querySelectorAll(':scope > .row').length ?? 0,
        onControl: !!feed && !!ctl && ctl.getBoundingClientRect().top < feed.getBoundingClientRect().bottom - 1,
        focus: !!ctl && ctl.contains(document.activeElement),
      };
      afterLoad.current = true;
      setPages((p) => [...p, <Fragment key={p.length}>{rows.map((x) => <Fragment key={x.id}>{x.node}</Fragment>)}{r.end}</Fragment>]);
      setNext(r.next);
      setRetrying(false);
      setState('idle');
      setSaid(FEED_COUNTS.added(rows.length));
    } catch {
      setRetrying(true);
      setState('error');
    } finally {
      busy.current = false;
    }
  }, [next]);
  // Right after the new rows are in, before paint.
  useLayoutEffect(() => {
    const p = pin.current;
    pin.current = null;
    const feed = document.querySelector('.feed');
    const firstNew = feed?.querySelectorAll(':scope > .row')[p?.before ?? -1] as HTMLElement | undefined;
    if (!p || !feed || !firstNew) return;
    if (p.onControl) feed.scrollTop += firstNew.getBoundingClientRect().top - feed.getBoundingClientRect().top;
    if (p.focus) firstNew.querySelector<HTMLElement>('.card .who')?.focus({ preventScroll: !p.onControl });
  }, [pages.length]);
  useEffect(() => {
    if (!next || state !== 'idle') return;
    // The sentinel is the card 5 from the end; every card after it and the control count too, so a jump past the
    // sentinel (a fast fling, End, a deep link) still loads.
    const feed = document.querySelector('.feed');
    const els = [...(feed?.querySelectorAll(':scope > .row') ?? [])].slice(-6);
    if (control.current) els.push(control.current);
    if (!feed || !els.length) return;
    // After a load, what is already in view when this observer starts does not count: it must come into view anew.
    const fresh = afterLoad.current;
    const was = new Map<Element, boolean>();
    const io = new IntersectionObserver((es) => {
      let go = false;
      for (const e of es) {
        const before = was.get(e.target);
        was.set(e.target, e.isIntersecting);
        if (e.isIntersecting && (before === false || (before === undefined && !fresh))) go = true;
      }
      if (go) void load();
    }, { root: feed, rootMargin: '0px 0px -1px 0px' });
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [next, state, pages.length, load]);
  const loading = state === 'loading';
  return (
    <>
      {pages}
      <p className="sr-only" aria-live="polite">{said}</p>
      {state === 'stale' ? (
        <div className="feed-more" ref={control}><a className="button" href="/">{FEED.stale}</a></div>
      ) : next && (
        <div className="feed-more" ref={control}>
          {retrying
            ? <p role="status">{loading ? null : <>{FEED.failed} </>}<button type="button" aria-disabled={loading} onClick={() => void load()}>{loading ? FEED.loading : FEED.retry}</button></p>
            : <a className="button" href={`/?after=${next}`} aria-busy={loading} onClick={(e) => { e.preventDefault(); void load(); }}>{loading ? FEED.loading : FEED.more}</a>}
        </div>
      )}
    </>
  );
}
