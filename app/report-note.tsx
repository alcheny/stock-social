'use client';
import { useActionState } from 'react';
import { REPORT_COPY } from '@/lib/report-copy.ts';
import { reportNote } from './actions.ts';

// fix-user-text B (F-9): the Report control on a thesis, for a signed-in reader who is not its author (app/user-note.tsx
// renders it only then). A plain form button (keyboard: Tab, Enter or Space; works without JavaScript as a form post),
// named "Report this note"; the answer is spoken by an always-rendered polite live region. The button stays enabled, so
// focus never drops when it is pressed; a second press answers "already reported".
export function ReportNote({ tradeId, symbol }: { tradeId: string; symbol?: string }) {
  const [state, action, pending] = useActionState(reportNote, { message: '' });
  return (
    <form action={action} className="report-note">
      <input type="hidden" name="tradeId" value={tradeId} />
      <button type="submit" className="link-button" aria-label={symbol ? `${REPORT_COPY.label} on ${symbol}` : REPORT_COPY.label} aria-busy={pending || undefined}>Report</button>
      <span aria-live="polite" className="report-status">{state.message}</span>
    </form>
  );
}
