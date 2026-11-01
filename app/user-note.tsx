// fix-user-text B (F-9): UserNote with the Report control. The markup is lib/user-note.ts (one component for every
// surface); `reportId` (the closed trade's id) adds the Report control, and the caller passes it only for a signed-in
// reader who is not the note's author, so signed out there is no control at all (the action refuses too).
// ponytail: /t/[symbol] rows and the chart sheet show the note without the control (the row is one link, the sheet is a
// client component) — add it there when those rows get a separate action area.
import { UserNote as Note, type UserNoteProps } from '@/lib/user-note.ts';
import { ReportNote } from './report-note.tsx';

export function UserNote({ reportId, symbol, ...p }: Omit<UserNoteProps, 'report'> & { reportId?: string; symbol?: string }) {
  return <Note {...p} report={reportId ? <ReportNote tradeId={reportId} symbol={symbol} /> : undefined} />;
}
