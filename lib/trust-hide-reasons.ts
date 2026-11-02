// F-16 (plan docs/features/logs/F-16-F-17/plan.md §5.3): what the owner's audited hide may act on and the fixed reason
// codes it records in trust_audit.reason. Client-safe constants, no database: lib/trust-hide.ts (the hide itself),
// scripts/hide.ts and lib/trust-digest.ts import them from here. The first six hide reasons are the profile report
// categories (lib/report-copy.ts REPORT_CATEGORIES), so a founded report maps to its reason by code; 'legal-notice'
// is the takedown page's path. Only a whole profile or a thesis can be hidden, never a single trade.
import { REPORT_CATEGORY_CODES, type ReportCategory } from './report-copy.ts';

export const HIDE_KINDS = ['profile', 'thesis'] as const;
export type HideKind = (typeof HIDE_KINDS)[number];
export type HideReason = ReportCategory | 'legal-notice';
export const HIDE_REASONS: readonly HideReason[] = [...REPORT_CATEGORY_CODES, 'legal-notice'];
export const UNHIDE_REASONS = ['report-unfounded', 'issue-resolved', 'hidden-by-mistake'] as const;
export type UnhideReason = (typeof UNHIDE_REASONS)[number];

export const isHideKind = (v: unknown): v is HideKind => typeof v === 'string' && (HIDE_KINDS as readonly string[]).includes(v);
export const isHideReason = (v: unknown): v is HideReason => typeof v === 'string' && (HIDE_REASONS as readonly string[]).includes(v);
export const isUnhideReason = (v: unknown): v is UnhideReason => typeof v === 'string' && (UNHIDE_REASONS as readonly string[]).includes(v);
