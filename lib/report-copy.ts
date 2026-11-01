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

// Fix round 2 (business lead): each moderation label (lib/moderation.ts HOLD_V2) in plain words, for the author's held
// line: "Held because it has ‹explanation›."
export const RULE_EXPLAIN: Record<string, string> = {
  link: 'a link or web address',
  'contact details': 'contact details or an @mention',
  promotion: 'a promotion',
  'picks or tips': 'a stock pick or price target',
  'platform claim': 'a claim about this site or being verified',
  'return claim': 'a return claim beyond this trade',
  'copy trading': 'an offer to copy trades',
};

// The rule a reader-report hold stores (lib/reports.ts#REPORT_RULE; kept equal by lib/report-copy.test.ts).
const REPORTS = 'reports';
// Fix round 5 (item 9): the rule a note the owner reviewed and kept held stores (lib/thesis-review.ts#releaseThesis):
// it stays held through an edit until the owner releases it (lib/thesis-save.ts).
export const KEPT_RULE = 'kept';
/**
 * Fix round 2 (B): the line only the author sees under a held thesis. Muted text, never the loss colour. Names the
 * label's explanation; a reader-report hold says only that readers reported it (never a count); an unknown or missing
 * label names no reason (the stored value is never printed).
 */
export function heldLine(rule: string | null | undefined): string {
  const head = 'Thesis held for review. Only you can see it.';
  if (rule === REPORTS) return `${head} Readers reported it; it stays held until reviewed.`;
  // Fix round 5 (item 9): an edit does not publish a kept note, so the line never says it would.
  if (rule === KEPT_RULE) return `${head} Held after review; it stays held until the owner releases it.`;
  const why = rule && Object.hasOwn(RULE_EXPLAIN, rule) ? ` Held because it has ${RULE_EXPLAIN[rule]}.` : '';
  return `${head}${why} Edit it to publish, or it stays held until reviewed.`;
}
