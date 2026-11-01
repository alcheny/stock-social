// fix-user-text B (F-9): the one markup every thesis renders through (profile rows, trade page, /t/[symbol], feed card,
// and the chart sheet of the profile and the feed pane). Written with createElement, not JSX, so node:test renders it
// with react-dom/server (lib/user-note.test.ts); app/user-note.tsx adds the Report control.
// - The trader's text sits in <bdi>, so a right-to-left run can't reorder the attribution or a figure beside it. The
//   quotes stay outside it.
// - An attribution line ("Note by @handle") says whose words these are: never the product's.
// - "Written ‹date›, after the trade closed · edited ‹date›" only for dates that were recorded. Older theses have none
//   and show no date (never back-filled).
// - Never larger than the verified figure on the same surface: the text is set at body size or below (app/globals.css,
//   "fix-user-text: UserNote"; no inline font size here).
import { createElement as h, type ReactNode } from 'react';

export type NoteDate = Date | string | null | undefined;
// Fix round 2 (C): `byline={false}` where the surface already names the trader (the feed card's header): the caption
// starts at the date line, and there is no caption at all without a date or a Report control.
export type UserNoteProps = { text: string; handle: string; writtenAt?: NoteDate; editedAt?: NoteDate; report?: ReactNode; byline?: boolean };

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const day = (d: NoteDate): string | null => {
  if (!d) return null;
  const t = d instanceof Date ? d : new Date(d);
  return Number.isNaN(t.getTime()) ? null : DAY.format(t);
};

/** The date line, or null when no date was recorded. */
export function noteDateLine(writtenAt: NoteDate, editedAt: NoteDate): string | null {
  const w = day(writtenAt), e = day(editedAt);
  // ponytail: "after the trade closed" is true only because a thesis can be attached to a closed trade alone — if notes
  // on open positions are ever added, date them against the trade's own close instead of stating it.
  // Fix round 3: an edit on the same calendar day (UTC) as the writing is not named.
  if (w) return `Written ${w}, after the trade closed${e && e !== w ? ` · edited ${e}` : ''}`;
  if (e) return `Edited ${e}, after the trade closed`;
  return null;
}

export function UserNote({ text, handle, writtenAt, editedAt, report, byline = true }: UserNoteProps) {
  const dates = noteDateLine(writtenAt, editedAt);
  const quote = h('blockquote', { className: 'user-note-text' }, '“', h('bdi', null, text), '”');
  // Fix round 1: the Report control sits inside the caption, so the caption stays the figure's last child.
  const caption = byline
    ? h('figcaption', { className: 'user-note-by muted' }, `Note by @${handle}`, dates ? ` · ${dates}` : null, report ?? null)
    : dates || report ? h('figcaption', { className: 'user-note-by muted' }, dates, report ?? null) : null;
  return h('figure', { className: 'user-note', 'data-user-note': '' }, quote, caption);
}
