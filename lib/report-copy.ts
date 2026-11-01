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
  'picks or tips': 'a stock recommendation or price target',
  'platform claim': 'a claim about this site or being verified',
  'return claim': 'a return claim beyond this trade',
  'copy trading': 'an offer to copy trades',
};

// The rule a reader-report hold stores (lib/reports.ts#REPORT_RULE; kept equal by lib/report-copy.test.ts).
const REPORTS = 'reports';
// Fix round 5 (item 9): the rule a note the owner reviewed and kept held stores (lib/thesis-review.ts#releaseThesis):
// it stays held through an edit until the owner releases it (lib/thesis-save.ts).
export const KEPT_RULE = 'kept';
// F-16 (plan §3, §5.3): the rule a thesis the owner hid stores (lib/trust-hide.ts; thesis_status 'held'). Only the
// audited unhide clears it: an edit, a clear-and-rewrite or the review script's release never does.
export const HIDDEN_RULE = 'hidden';
// F-16 (plan v2 B2): the author's own-view line under a hidden thesis. Neutral: never "reported", "review" or a reason.
export const HIDDEN_LINE = 'This thesis is not shown to others right now. Only you can see it.';
/**
 * Fix round 2 (B): the line only the author sees under a held thesis. Muted text, never the loss colour. Names the
 * label's explanation; a reader-report hold says only that readers reported it (never a count); an unknown or missing
 * label names no reason (the stored value is never printed).
 */
export function heldLine(rule: string | null | undefined): string {
  if (rule === HIDDEN_RULE) return HIDDEN_LINE; // F-16: before the held head, which says "review"
  const head = 'Thesis held for review. Only you can see it.';
  if (rule === REPORTS) return `${head} Readers reported it; it stays held until reviewed.`;
  // Fix round 5 (item 9): an edit does not publish a kept note, so the line never says it would.
  if (rule === KEPT_RULE) return `${head} Held after review; it stays held until the owner releases it.`;
  const why = rule && Object.hasOwn(RULE_EXPLAIN, rule) ? ` Held because it has ${RULE_EXPLAIN[rule]}.` : '';
  return `${head}${why} Edit it to publish, or it stays held until reviewed.`;
}

// ---- F-16 (docs/features/F-16-trust-and-safety-slice.md; plan docs/features/logs/F-16-F-17/plan.md §5.5) ----
// The profile report's fixed categories, in form order. Client-safe (no database). Factual, names no platform, never
// judges skill or the record, no age-group words, no free text and no "other" box (P3). The codes are stored in
// thesis_reports.category and are the first six owner hide reasons (lib/trust-hide-reasons.ts HIDE_REASONS).
export const REPORT_CATEGORIES = [
  { code: 'impersonation-elsewhere', label: 'Impersonating this trader elsewhere' },
  { code: 'pretends-to-be-someone', label: 'Pretends to be another person or a company' },
  { code: 'may-be-under-18', label: 'May be under 18' },
  { code: 'money-or-paid-access', label: 'Asks for money or offers a paid service' },
  { code: 'abusive', label: 'Abusive or hateful name or note' },
  { code: 'personal-information', label: 'Shares someone\'s personal information' },
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]['code'];
export const REPORT_CATEGORY_CODES: readonly ReportCategory[] = REPORT_CATEGORIES.map((c) => c.code);
export const isReportCategory = (v: unknown): v is ReportCategory =>
  typeof v === 'string' && (REPORT_CATEGORY_CODES as readonly string[]).includes(v);

// The profile report page and its messages (plan §5.5; app/u/[handle]/report, app/report-actions.ts). One rate
// wording for the per-reporter and per-target limits, so a target's report volume never leaks.
export const PROFILE_REPORT_COPY = {
  menu: 'Report this profile',
  title: (h: string) => `Report @${h}`,
  h1: 'Report this profile',
  legend: 'What is wrong with this profile?',
  hint: 'Choose one. The trader is never told who reported. A report alone does not hide or remove a profile.',
  submit: 'Send report',
  noCategory: 'Choose what is wrong with this profile.',
  rate: 'Too many reports right now. Try again later.',
  failed: 'Could not send this report. Try again later.',
  done: 'Report sent. Thank you.',
  already: 'You already reported this profile.',
  own: 'This is your profile, so you can\'t report it.',
  signedOut: 'Sign in to report this profile.',
  signIn: 'Sign in',
  back: (h: string) => `Back to @${h}`,
  other: 'Something else, or a legal notice?',
} as const;
// end F-16
