// F-11 / D-12 / fix #4: the record status line, rendered from lib/record-status.ts segments only (the words are unit-
// tested there). Dated segments are <time dateTime>; a relative time is a <time> whose datetime is the absolute instant
// and whose title is the absolute date (F-11 AC7, design system R3). Words only: no icon, no colour carries the status. No hooks, so it renders on the server and inside
// the client-mounted pane alike.
import type { Segment } from '@/lib/record-status.ts';

// Dates never break inside ("Oct 30, 2026" stays together); rows wrap at "·" and spaces.
const NBSP = '\u00a0';
const Segs = ({ segments }: { segments: Segment[] }) =>
  <>{segments.map((s, i) => (s.iso
    ? <time key={i} dateTime={s.iso} title={s.title}>{s.title ? s.text : s.text.replace(/ /g, NBSP)}</time>
    : <span key={i}>{s.text}</span>))}</>;

export function StatusText({ segments, className = '', kind }: { segments: Segment[]; className?: string; kind?: string }) {
  if (!segments.length) return null;
  return <p className={`muted small record-status${className ? ` ${className}` : ''}`} data-status={kind}><Segs segments={segments} /></p>;
}

// The profile's per-account lines ("Account 1 of 2 · ‹institution›", "Account 2 of 2 removed ‹date›"), one item each.
export function StatusList({ items, label }: { items: Segment[][]; label: string }) {
  if (!items.length) return null;
  return <ul className="muted small record-accounts" aria-label={label}>{items.map((segs, i) => <li key={i}><Segs segments={segs} /></li>)}</ul>;
}
