'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LIKES } from '@/lib/copy.ts';
import { unlike, unlikeForm } from '../../discovery-actions.ts';

// F-2 PR-4 fix round 1 (UX demand 2, WCAG 2.4.3): Unlike removes the row and moves focus to the next row's Unlike, else
// the previous one, else the "Liked records" heading, and says what happened in a status line. Without JavaScript the
// form posts and the page renders again. Rows wrap (business lead D3): the trade, then whose it is, never clipped.
export type LikedRow = { key: string; href: string; symbol: string; day: string; handle: string };
export function LikedList({ rows: first, capped }: { rows: LikedRow[]; capped: number | null }) {
  const [rows, setRows] = useState(first);
  const [said, setSaid] = useState('');
  const focus = useRef<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const k = focus.current;
    focus.current = null;
    if (k !== null) (list.current?.querySelector<HTMLElement>(`[data-key="${k}"] button`) ?? document.getElementById('liked'))?.focus();
  }, [rows]);
  const remove = async (i: number) => {
    const t = rows[i];
    if (!(await unlike(t.key).catch(() => ({ ok: false }))).ok) return;
    focus.current = (rows[i + 1] ?? rows[i - 1])?.key ?? '';
    setSaid(LIKES.unliked(t.symbol, t.handle));
    setRows(rows.filter((r) => r.key !== t.key));
  };
  return (
    <>
      <p role="status" className="follow-status">{said}</p>
      {rows.length ? (
        <ul className="rows people" ref={list}>
          {rows.map((t, i) => (
            <li key={t.key} className="line" data-key={t.key}>
              <span className="who-col liked"><Link href={t.href}><span>{LIKES.closed(t.symbol, t.day)}</span><span className="muted">@{t.handle}</span></Link></span>
              <form action={unlikeForm.bind(null, t.key)} onSubmit={(e) => { e.preventDefault(); void remove(i); }}>
                <button className="secondary" aria-label={LIKES.unlikeFor(t.symbol, t.handle)}>{LIKES.unlike}</button>
              </form>
            </li>
          ))}
        </ul>
      ) : <p>{LIKES.none}</p>}
      {capped !== null && rows.length >= capped && <p className="muted small">{LIKES.capped(capped)}</p>}
    </>
  );
}
