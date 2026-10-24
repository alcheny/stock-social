'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LIKES } from '@/lib/copy.ts';
import { NOT_TAP, cardRejectOutcome, isDoubleTap, isTap, type Tap } from '@/lib/discovery/gestures.ts';
import { canArm, horizontal } from '@/lib/discovery/reject.ts';

// F-2 PR-4: the feed card's two gestures, delegated from the feed (one listener set for every card, appended pages too).
// - Double tap on the card body (lib/discovery/gestures.ts): signed in, it clicks the card's own Like button
//   (app/card-menu.tsx), so the gesture and the button are one action; signed out, one inline sign-in line.
// - Reject swipe (O1): signed in, a drag away from the profile on a card at rest moves the card with the finger and, past
//   half the card, hides that trade (app/feed-hides.tsx: "Trade hidden." with Undo for 5 s); shorter, it snaps back.
//   It arms as the section swipe does: on a card at rest (the row not scrolled toward its pane), not within 400 ms after
//   the row came back from its pane, horizontal only (≥ 2× vertical). The opening direction stays SW-1's native scroll.
export function FeedGestures({ signedIn }: { signedIn: boolean }) {
  const [askSignIn, setAskSignIn] = useState(false);
  useEffect(() => {
    const feed = document.querySelector<HTMLElement>('.feed');
    if (!feed) return;
    const cardOf = (t: EventTarget | null) => (t as Element | null)?.closest?.<HTMLElement>('.feed > .row > .card') ?? null;
    let down: Tap | null = null, prev: Tap | null = null;
    const onDown = (e: PointerEvent) => {
      down = cardOf(e.target) && !(e.target as Element).closest(NOT_TAP) && (e.isPrimary) ? { t: e.timeStamp, x: e.clientX, y: e.clientY } : null;
    };
    const onUp = (e: PointerEvent) => {
      const card = cardOf(e.target), d = down;
      down = null;
      if (!card || !d) { prev = null; return; }
      const tap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
      if (!isTap(d, tap) || (card.parentElement?.scrollLeft ?? 0) > 2) { prev = null; return; }
      if (!isDoubleTap(prev, tap)) { prev = tap; return; }
      prev = null;
      if (!signedIn) { setAskSignIn(true); return; }
      card.querySelector<HTMLButtonElement>('[data-like]')?.click();
    };
    const onCancel = () => { down = null; prev = null; };
    // The reject swipe.
    const away = new WeakMap<Element, number>(); // when each row was last scrolled toward its pane
    let s: { card: HTMLElement; x: number; y: number; locked: boolean; armed: boolean } | null = null;
    // A row counts as away while its pane shows by a quarter or more (the card's own drag never moves it that far).
    const onScroll = (e: Event) => { const r = e.target as Element; if (r instanceof HTMLElement && r.matches('.feed > .row') && r.scrollLeft > r.clientWidth / 4) away.set(r, Date.now()); };
    const onTouchStart = (e: TouchEvent) => {
      const card = cardOf(e.target), row = card?.parentElement, t = e.touches[0];
      s = card && row && t && e.touches.length === 1 ? { card, x: t.clientX, y: t.clientY, locked: false,
        armed: canArm({ atRest: row.scrollLeft < 2, paneOpen: !!document.querySelector('dialog[open]'), sinceClose: Date.now() - (away.get(row) ?? 0) }) } : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (!s.locked) {
        if (Math.abs(dx) + Math.abs(dy) < 10) return;
        s.locked = true;
        if (!horizontal(dx, dy) || dx < 0) s.armed = false;
      }
      if (!s.armed) return;
      if (e.cancelable) e.preventDefault();
      s.card.style.transition = 'none';
      s.card.style.transform = `translateX(${Math.max(0, dx)}px)`;
      s.card.dataset.rejecting = LIKES.tray;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const g = s;
      s = null;
      if (!g?.armed) return;
      const travel = (e.changedTouches[0]?.clientX ?? g.x) - g.x;
      const row = g.card.parentElement!;
      const reject = cardRejectOutcome(true, travel, g.card.clientWidth) === 'reject';
      g.card.style.transition = reject || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'transform 150ms ease-out';
      g.card.style.transform = '';
      delete g.card.dataset.rejecting;
      row.scrollLeft = 0; // the drag's transform can nudge the snap; the card stays at rest
      if (reject) dispatchEvent(new CustomEvent('ss:hide', { detail: { handle: row.dataset.handle, trade: row.dataset.trade, row } }));
    };
    feed.addEventListener('pointerdown', onDown);
    feed.addEventListener('pointerup', onUp);
    feed.addEventListener('pointercancel', onCancel);
    if (signedIn) {
      feed.addEventListener('scroll', onScroll, { capture: true, passive: true });
      feed.addEventListener('touchstart', onTouchStart, { passive: true });
      feed.addEventListener('touchmove', onTouchMove, { passive: false });
      feed.addEventListener('touchend', onTouchEnd);
      feed.addEventListener('touchcancel', onTouchEnd);
    }
    return () => {
      feed.removeEventListener('pointerdown', onDown); feed.removeEventListener('pointerup', onUp); feed.removeEventListener('pointercancel', onCancel);
      feed.removeEventListener('scroll', onScroll, { capture: true }); feed.removeEventListener('touchstart', onTouchStart);
      feed.removeEventListener('touchmove', onTouchMove); feed.removeEventListener('touchend', onTouchEnd); feed.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [signedIn]);
  return (
    <p className="signin-line" role="status">
      {askSignIn && <>{LIKES.signIn} <Link href="/login">{LIKES.signInLink}</Link> <button type="button" className="quiet-x" aria-label={LIKES.close} onClick={() => setAskSignIn(false)}>×</button></>}
    </p>
  );
}
