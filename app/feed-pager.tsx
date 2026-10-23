'use client';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FEED } from '@/lib/copy.ts';
import { nextFeedPage } from './feed-actions.tsx';

// F-2 PR-1: auto-append, no tap. When the card 5 from the end comes into view, the next 30 server-rendered cards are
// fetched through the action and appended in place (one request in flight). A failure shows one inline Retry. Without
// JavaScript the same element is a plain `?after=<cursor>` link to the next page.
export function FeedPager({ next: first }: { next: string }) {
  const [pages, setPages] = useState<ReactNode[]>([]);
  const [next, setNext] = useState<string | null>(first);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'stale'>('idle');
  const busy = useRef(false);
  const load = useCallback(async () => {
    if (!next || busy.current) return;
    busy.current = true;
    setState('loading');
    try {
      const r = await nextFeedPage(next);
      if ('stale' in r) { setState('stale'); return; }
      setPages((p) => [...p, r.rows]);
      setNext(r.next);
      setState('idle');
    } catch {
      setState('error');
    } finally {
      busy.current = false;
    }
  }, [next]);
  useEffect(() => {
    if (!next || state !== 'idle') return;
    // The sentinel is the card 5 from the end; every card after it and this control count too, so a jump past the
    // sentinel (a fast fling, End, a deep link) still loads.
    const feed = document.querySelector('.feed');
    const rows = [...(feed?.querySelectorAll(':scope > .row, :scope > .feed-more') ?? [])];
    if (!rows.length) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) void load(); }, { root: feed });
    for (const el of rows.slice(-7)) io.observe(el); // 6 cards (25 to 30 of a page) and the control
    return () => io.disconnect();
  }, [next, state, pages.length, load]);
  return (
    <>
      {pages.map((p, i) => <Fragment key={i}>{p}</Fragment>)}
      {state === 'stale' ? (
        <div className="feed-more"><a className="button" href="/">{FEED.stale}</a></div>
      ) : next && (
        <div className="feed-more">
          {state === 'error'
            ? <p role="status">{FEED.failed} <button type="button" onClick={() => void load()}>{FEED.retry}</button></p>
            : <a className="button" href={`/?after=${next}`} aria-busy={state === 'loading'} onClick={(e) => { e.preventDefault(); void load(); }}>{FEED.more}</a>}
        </div>
      )}
    </>
  );
}
