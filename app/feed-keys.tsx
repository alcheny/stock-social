'use client';
import { useEffect } from 'react';

// Feed row navigation: → opens the profile pane of the card in view, ← returns to the trade.
// Ignores keys the chart or a form already handled; back buttons scroll their own row.
export function FeedKeys() {
  useEffect(() => {
    const go = (row: Element, left: number) =>
      row.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if ((e.target as HTMLElement).closest?.('input, textarea, select')) return;
      const row = [...document.querySelectorAll('.row')].find((r) => Math.abs(r.getBoundingClientRect().top) < r.clientHeight / 2);
      if (!row) return;
      go(row, e.key === 'ArrowRight' ? row.clientWidth : 0);
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest('[data-back]')?.closest('.row');
      if (row) go(row, 0);
    };
    addEventListener('keydown', onKey);
    addEventListener('click', onClick);
    return () => { removeEventListener('keydown', onKey); removeEventListener('click', onClick); };
  }, []);
  return null;
}
