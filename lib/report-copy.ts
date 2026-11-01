// fix-user-text B (F-9): what the Report control says (a polite live region). No database here: the client island
// (app/report-note.tsx) imports it. Never names the trader, the reporter or a count, and never says a note was held.
export const REPORT_COPY = {
  label: 'Report this note',
  done: 'Reported. Thank you.',
  already: 'You already reported this note.',
  rate: 'Please wait a minute before reporting another note.',
  failed: 'Could not report this note. Try again later.',
} as const;

// The Report control's state (app/report-note.tsx with useActionState; app/actions.ts#reportNote).
export type ReportState = { message: string };
