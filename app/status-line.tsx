// F-11 / D-12 / fix #4: the record status line, rendered from lib/record-status.ts segments only (the words are unit-
// tested there). Dated segments are <time dateTime>; a relative time is a <time> whose datetime is the absolute instant
// and whose title is the absolute date (F-11 AC7, design system R3). Words only: no icon, no colour carries the status. No hooks, so it renders on the server and inside
// the client-mounted pane alike.
import { glued, NBSP, timeText, type Segment } from '@/lib/record-status.ts';

// QA round 1 (finding 9): a relative time shows its absolute date beside it inside the <time> (timeText).
// QA round 2 (N8): a date never breaks inside and stays with the word before it (glued); rows wrap at "·" and spaces.
const Segs = ({ segments }: { segments: Segment[] }) =>
  <>{glued(segments).map((s, i) => (s.iso
    ? <time key={i} dateTime={s.iso} title={s.title?.replace(/\u00a0/g, ' ')}>{(s.title ? timeText(s) : s.text).replace(/ /g, NBSP)}</time>
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
