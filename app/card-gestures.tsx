'use client';
import { useEffect } from 'react';
import { canArm, cardOutcome, horizontal, isDoubleTap, type Tap } from '@/lib/discovery/reject.ts';
import { like, unlike } from './discovery-actions.ts';

// F-2 PR-4: the feed card's gestures, one listener set for the whole feed (appended pages included), no per-card state.
// - Like (private, +3 for PR-5): a double tap on the card's body (two taps within 300 ms and 24 px, never on a link,
//   button or chart: lib/discovery/reject.ts#isDoubleTap) likes once; the heart button toggles (aria-pressed, the
//   keyboard and screen-reader route). Optimistic, reverted if the server refuses. Outline to filled: no burst, motion,
//   vibration or count; a like on a loss is the same as on a gain. Signed in only (fix round 1, business lead D2: no
//   heart signed out, as Follow; this component is mounted only for a signed-in viewer).
// - Reject (owner decision O1): signed in, a drag of the card away from the pane (SW-1 keeps the opening direction). It
//   arms only on a touch that starts with the row at rest, no sheet open and not within 400 ms after the row came back
//   from its pane; a fling can never carry into it (the card is moved by the finger, not by scrolling). It commits when
//   the finger travelled half the card ("Hide this trade" in the card's "…" is its button); past half the tray darkens;
//   app/feed-hides.tsx hides the card with Undo.
// - The pressed state is read once per card from GET /me/liked (the feed's own read never reads likes). Fix round 1
//   (UX D4): the heart stays invisible (its space kept) until that answer, or 1 s, so a liked card never shows ♡ first.
let lastBack = 0; // when a row last came back from its pane to the card

export function CardGestures() {
  useEffect(() => {
    const feed = document.querySelector<HTMLElement>('.feed');
    if (!feed) return;
    const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touched = new Set<string>(), asked = new Set<string>();
    const set = (key: string, on: boolean) => feed.querySelectorAll(`[data-like="${key}"]`).forEach((b) => b.setAttribute('aria-pressed', String(on)));
    const toggle = async (key: string, on: boolean) => {
      touched.add(key);
      set(key, on);
      const r = await (on ? like : unlike)(key).catch(() => ({ ok: false }));
      if (!r.ok) set(key, !on);
    };
    const ready = (keys: string[]) => keys.forEach((k) => feed.querySelectorAll(`[data-like="${k}"]`).forEach((b) => b.setAttribute('data-ready', '')));
    const load = async () => {
      const keys = [...feed.querySelectorAll('[data-like]')].map((b) => b.getAttribute('data-like')!).filter((k) => !asked.has(k));
      keys.forEach((k) => asked.add(k));
      const late = setTimeout(() => ready(keys), 1000);
      await Promise.all(Array.from({ length: Math.ceil(keys.length / 60) }, async (_, i) => {
        const part = keys.slice(i * 60, i * 60 + 60);
        const r = await fetch(`/me/liked?k=${part.join(',')}`, { cache: 'no-store' }).then((x) => x.json()).catch(() => ({ liked: [] }));
        for (const k of r.liked as string[]) if (!touched.has(k)) set(k, true);
        ready(part);
      }));
      clearTimeout(late);
    };
    const mo = new MutationObserver(() => void load());
    void load();
    mo.observe(feed, { childList: true, subtree: true });
    const reject = (row: Element | null) => {
      const key = row?.getAttribute('data-key');
      if (row && key) dispatchEvent(new CustomEvent('ss:hide', { detail: { handle: row.getAttribute('data-handle'), trade: key, row, via: 'pointer' } }));
    };
    const onClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-like]');
      if (b) void toggle(b.dataset.like!, b.getAttribute('aria-pressed') !== 'true');
    };
    // Double tap.
    let last: Tap | null = null, down: { x: number; y: number } | null = null;
    const cardOf = (el: Element) => el.closest('.feed > .row > .card');
    const plain = (el: Element) => !el.closest('a, button, input, textarea, select, summary, label, details, .chart-stack');
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      const el = e.target as Element, card = cardOf(el), key = card?.querySelector('[data-like]')?.getAttribute('data-like');
      if (!card || !key || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { last = null; return; }
      const tap = { t: e.timeStamp, x: e.clientX, y: e.clientY, card: key, plain: plain(el) };
      if (!isDoubleTap(last, tap)) { last = tap; return; }
      last = null;
      if (card.querySelector('[data-like]')?.getAttribute('aria-pressed') !== 'true') void toggle(key, true);
    };
    const noSelect = (e: MouseEvent) => { if (e.detail > 1 && cardOf(e.target as Element) && plain(e.target as Element)) e.preventDefault(); };
    // The reject drag.
    let drag: { row: HTMLElement; card: HTMLElement; x: number; y: number; armed: boolean; locked: boolean } | null = null;
    const away = new WeakSet<Element>(); // rows scrolled toward their pane
    const onScroll = (e: Event) => {
      const row = e.target as HTMLElement;
      if (!row.matches?.('.feed > .row')) return;
      if (row.scrollLeft > 2) away.add(row); else if (away.delete(row)) lastBack = Date.now();
    };
    const place = (d: NonNullable<typeof drag>, dx: number, smooth = false) => {
      d.card.style.transition = smooth && !reduce() ? 'transform .2s ease-out' : '';
      d.card.style.transform = dx ? `translateX(${dx}px)` : '';
      d.row.classList.toggle('dragging', dx > 0);
      d.row.classList.toggle('past', dx >= d.card.clientWidth / 2);
    };
    const onStart = (e: TouchEvent) => {
      const card = (e.target as Element).closest<HTMLElement>('.feed > .row > .card'), row = card?.parentElement;
      drag = null;
      if (!card || !row?.hasAttribute('data-key') || !row.querySelector('[data-like]') || e.touches.length !== 1) return;
      const t = e.touches[0];
      drag = { row, card, x: t.clientX, y: t.clientY, locked: false,
        armed: canArm({ atRest: row.scrollLeft < 2, paneOpen: !!document.querySelector('dialog[open]'), sinceClose: Date.now() - lastBack }) };
    };
    const onMove = (e: TouchEvent) => {
      const d = drag, t = e.touches[0];
      if (!d || !t || !d.armed) return;
      const dx = t.clientX - d.x, dy = t.clientY - d.y;
      if (!d.locked) { if (Math.abs(dx) + Math.abs(dy) < 10) return; d.locked = true; if (dx < 0 || !horizontal(dx, dy)) { d.armed = false; return; } }
      place(d, Math.max(0, dx));
    };
    const onEnd = (e: TouchEvent) => {
      const d = drag;
      drag = null;
      if (!d?.armed || !d.locked) return;
      const travel = (e.changedTouches[0]?.clientX ?? d.x) - d.x;
      if (e.type === 'touchend' && cardOutcome(true, travel, d.card.clientWidth) === 'reject') { reject(d.row); place(d, 0); }
      else place(d, 0, true);
    };
    feed.addEventListener('click', onClick);
    feed.addEventListener('pointerdown', onDown);
    feed.addEventListener('pointerup', onUp);
    const onCancel = () => { last = null; };
    feed.addEventListener('pointercancel', onCancel);
    feed.addEventListener('mousedown', noSelect);
    feed.addEventListener('scroll', onScroll, { capture: true, passive: true });
    feed.addEventListener('touchstart', onStart, { passive: true });
    feed.addEventListener('touchmove', onMove, { passive: true });
    feed.addEventListener('touchend', onEnd);
    feed.addEventListener('touchcancel', onEnd);
    return () => {
      mo?.disconnect();
      feed.removeEventListener('click', onClick); feed.removeEventListener('pointerdown', onDown); feed.removeEventListener('pointerup', onUp);
      feed.removeEventListener('pointercancel', onCancel); feed.removeEventListener('mousedown', noSelect); feed.removeEventListener('scroll', onScroll, { capture: true });
      feed.removeEventListener('touchstart', onStart); feed.removeEventListener('touchmove', onMove);
      feed.removeEventListener('touchend', onEnd); feed.removeEventListener('touchcancel', onEnd);
    };
  }, []);
  return null;
}
