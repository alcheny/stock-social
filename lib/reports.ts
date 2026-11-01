// fix-user-text B (F-9, POLICY U2): a signed-in reader reports a published thesis. One report per reader per thesis
// (unique row), keyed by the trader and the closing sell's id so it survives rebuildTrades; one report per reader per
// minute; a reader can't report their own note. A single report changes nothing: the thesis is held (rule 'reports')
// only once REPORT_HOLD_AT distinct readers reported it since its last owner release (thesis_reports_from). Reports only
// hold: nothing here deletes a thesis, a report on it, or touches a trade (TR-1). Nothing here logs.
// ponytail: distinct reporters mean little while accounts are cheap (the dev sign-in stub) — the count becomes meaningful
// with real authentication; until then the owner releases any brigaded note (scripts/review-theses.ts).
import { sql } from './db.ts';
import type { TransactionSql } from 'postgres';
import { hit, limitKey } from './rate-limit.ts';
import { PROFILE_REPORT_COPY, REPORT_COPY, isReportCategory, type ProfileReportState } from './report-copy.ts';
import { normalizeHandle } from './referral.ts';
import { visibleUser } from './visible-users.ts';
import { filerVisibleSql } from './public-gate.ts';
export { REPORT_COPY, type ReportState } from './report-copy.ts';

export const REPORT_HOLD_AT = 3;
export const REPORT_INTERVAL_MS = 60_000;
export const REPORT_RULE = 'reports';
const ID = /^[0-9]{1,18}$/;
// #82: a card names its close by the stable trade_key (64 hex: sha256 of the sell id, lib/likes.ts#tradeKey), which
// survives rebuildTrades; a row id (what older pages sent) is still accepted, with the same rules.
const TRADE_KEY = /^[0-9a-f]{64}$/;

export type ReportOutcome = 'reported' | 'held' | 'signed-out' | 'invalid' | 'not-found' | 'own' | 'already' | 'rate';
export type ReportDeps = { allow: (key: string, tx: TransactionSql) => boolean | Promise<boolean> };
// The shared limiter (lib/rate-limit.ts#hit, keyed hash, counted inside this transaction) backs the per-reader check on
// thesis_reports below: one report per reader per minute window on every instance.
export const defaultReportDeps: ReportDeps = { allow: (key, tx) => hit(limitKey('report', key), 1, REPORT_INTERVAL_MS / 1000, new Date(), tx) };

export async function reportThesis(reporterId: number | null | undefined, tradeId: unknown, deps: ReportDeps = defaultReportDeps): Promise<ReportOutcome> {
  if (!reporterId) return 'signed-out';
  if (typeof tradeId !== 'string' || !(ID.test(tradeId) || TRADE_KEY.test(tradeId))) return 'invalid';
  const byKey = TRADE_KEY.test(tradeId);
  return sql.begin(async (tx): Promise<ReportOutcome> => {
    // The row lock serializes reports on one note, so the third distinct reporter always sees the other two.
    // Fix round 4 (item 2): a note that is missing, empty or not published (held for any rule, including by these
    // reports) gets one neutral answer, 'not-found' (REPORT_COPY.done), on every press: nothing is written and no rate
    // slot is spent, so a reader can't tell a held note from a missing one. A held note needs no more reports. Only the
    // author is told it is their own (they know their note exists).
    const [t] = await tx`select t.user_id, t.sell_id, t.thesis_status, t.thesis_reports_from, t.thesis_edited_at from closed_trades t
      join users u on u.id = t.user_id and ${visibleUser('u')} and u.public_filer_id is null -- F-7: filers have no notes; F-16: nor a hidden profile
      where ${byKey ? sql`t.trade_key = ${tradeId}` : sql`t.id = ${tradeId}`} and t.thesis is not null and t.thesis <> '' for update of t`;
    if (!t) return 'not-found';
    if (t.user_id === reporterId) return 'own';
    if (t.thesis_status !== 'published') return 'not-found';
    // Reports count only from the last owner release (thesis_reports_from; never cleared by an edit).
    const from = t.thesis_reports_from as Date | null;
    const [dup] = await tx`select (${from}::timestamptz is null or created_at > ${from}::timestamptz) as counts from thesis_reports
      where reporter_id = ${reporterId} and trader_id = ${t.user_id} and sell_id = ${t.sell_id}`;
    if (dup?.counts) return 'already';
    // Fix round 5 (item 6): a report made before the release counts again only when the note changed since the release
    // (edited after it); the same readers can't re-hide the note the owner released by pressing Report again.
    const edited = t.thesis_edited_at as Date | null;
    if (dup && !(from && edited && edited > from)) return 'already';
    const [recent] = await tx`select 1 from thesis_reports where reporter_id = ${reporterId} and created_at > now() - ${REPORT_INTERVAL_MS / 1000} * interval '1 second' limit 1`;
    if (recent) return 'rate';
    if (dup) {
      // A reader who reported this note before its release reports it again: the one row (unique per reader and note)
      // is re-dated, so it counts after the release. Nothing is deleted.
      await tx`update thesis_reports set created_at = now() where reporter_id = ${reporterId} and trader_id = ${t.user_id} and sell_id = ${t.sell_id}`;
    } else {
      const ins = await tx`insert into thesis_reports (reporter_id, trader_id, sell_id) values (${reporterId}, ${t.user_id}, ${t.sell_id})
        on conflict do nothing returning 1`;
      if (!ins.length) return 'already';
    }
    // Fix round 3 (item 10): the shared limiter's slot is spent only once the report is recorded (a reader who lost the
    // insert race to their own other request spends nothing); a refused slot rolls the report back with it.
    if (!(await deps.allow(String(reporterId), tx))) throw RATE;
    const [{ n }] = await tx`select count(distinct r.reporter_id)::int as n from thesis_reports r
      join users u on u.id = r.reporter_id and u.deleted_at is null
      where r.trader_id = ${t.user_id} and r.sell_id = ${t.sell_id}
        and (${from}::timestamptz is null or r.created_at > ${from}::timestamptz)`;
    if (n < REPORT_HOLD_AT) return 'reported';
    await tx`update closed_trades set thesis_status = 'held', thesis_hold_rule = ${REPORT_RULE}
      where user_id = ${t.user_id} and sell_id = ${t.sell_id} and thesis_status = 'published'`;
    return 'held';
  }).catch((e) => { if (e === RATE) return 'rate' as const; throw e; });
}
const RATE = new Error('report rate');

// Fix round 3 (item 10): a well-formed id that names no note (gone, or never there) is answered like a report, so the
// answer never tells a hidden note from a missing one; a malformed id fails. Fix round 4: a held note answers
// 'not-found' too (see reportThesis).
export function reportMessage(o: ReportOutcome): string {
  if (o === 'reported' || o === 'held' || o === 'not-found') return REPORT_COPY.done;
  if (o === 'already') return REPORT_COPY.already;
  if (o === 'rate') return REPORT_COPY.rate;
  return REPORT_COPY.failed;
}

// ---- F-16 (docs/features/F-16-trust-and-safety-slice.md; plan docs/features/logs/F-16-F-17/plan.md §5.5, v2 E10) ----
// A signed-in reader reports a whole profile under one fixed category. Same table as thesis reports: target 'profile',
// sell_id '' (so the unique (reporter_id, trader_id, sell_id) row allows one report per reader per profile, ever).
// A profile report never hides or changes anything, at any count and in any category (under-18 included): it only
// reaches the owner's digest (lib/trust-digest.ts), who decides (lib/trust-hide.ts). F-9's REPORT_HOLD_AT stays
// theses-only. Nothing here logs, and no trader-facing read selects a reporter.
export const REPORT_TARGETS = ['thesis', 'profile'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export const RESOLUTIONS = ['founded', 'unfounded'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];
export const isResolution = (v: unknown): v is Resolution => typeof v === 'string' && (RESOLUTIONS as readonly string[]).includes(v);
export const PROFILE_REPORTS_PER_DAY = 5; // per reporter, any profiles (the shared limiter)
export const PROFILE_REPORTS_PER_TARGET_HOUR = 10; // per reported profile, any reporters
// ponytail: the per-target limit refuses honest reports during a flood (the same wording as the per-reporter one, so
// volume never leaks) — accept and count beyond it once the digest shows floods.

export type ProfileReportOutcome = 'reported' | 'signed-out' | 'invalid' | 'not-found' | 'own' | 'already' | 'rate';
export type ProfileReportDeps = { allow: (reporterId: number, tx: TransactionSql) => boolean | Promise<boolean> };
export const defaultProfileReportDeps: ProfileReportDeps = {
  allow: (id, tx) => hit(limitKey('report-profile', String(id)), PROFILE_REPORTS_PER_DAY, 86_400, new Date(), tx),
};

export async function reportProfile(reporterId: number | null | undefined, handle: unknown, category: unknown, deps: ProfileReportDeps = defaultProfileReportDeps): Promise<ProfileReportOutcome> {
  if (!reporterId) return 'signed-out';
  const h = normalizeHandle(handle);
  if (!h || !isReportCategory(category)) return 'invalid';
  return sql.begin(async (tx): Promise<ProfileReportOutcome> => {
    // Fix round 1 (review item 5): the reporter's lock first, so two concurrent reports by one reader on two profiles
    // meet the one-a-minute rule one at a time. Always reporter then target, so two transactions never wait on each
    // other in opposite orders.
    await tx`select pg_advisory_xact_lock(hashtext(${`report-reporter:${reporterId}`}))`;
    // v2 E10: the target, then its lock, so concurrent reports on one profile are counted one at a time.
    // Fix round 2 (T5): the same lookup as the report page (app/u/[handle]/report/page.tsx): a hidden F-7 filer is gone.
    const [t] = await tx`select u.id from users u where u.handle = ${h} and ${visibleUser('u')} and ${filerVisibleSql('u')}`;
    if (!t) return 'not-found';
    const traderId = t.id as number;
    await tx`select pg_advisory_xact_lock(hashtext(${`report-target:${traderId}`}))`;
    if (traderId === reporterId) return 'own';
    const [dup] = await tx`select 1 from thesis_reports where reporter_id = ${reporterId} and trader_id = ${traderId} and sell_id = ''`;
    if (dup) return 'already';
    // Per reader: one report of anything a minute (F-9's rule, across targets), then the daily shared limit below.
    const [recent] = await tx`select 1 from thesis_reports where reporter_id = ${reporterId} and created_at > now() - ${REPORT_INTERVAL_MS / 1000} * interval '1 second' limit 1`;
    if (recent) return 'rate';
    const [{ n }] = await tx`select count(*)::int as n from thesis_reports where trader_id = ${traderId} and target = 'profile'
      and created_at > now() - interval '1 hour'`;
    if (n >= PROFILE_REPORTS_PER_TARGET_HOUR) return 'rate';
    const ins = await tx`insert into thesis_reports (reporter_id, trader_id, sell_id, target, category)
      values (${reporterId}, ${traderId}, '', 'profile', ${category}) on conflict do nothing returning 1`;
    if (!ins.length) return 'already';
    // F-9's order: the shared slot is spent only once the report is recorded; a refused slot rolls the report back.
    if (!(await deps.allow(reporterId, tx))) throw RATE;
    return 'reported';
  }).catch((e) => { if (e === RATE) return 'rate' as const; throw e; });
}

// Fix round 2 (T2, plan §2.2 "Already reported"): a read-only check for the report page, so a reader who already
// reported this profile sees only the status line, never the form again. The signed-in reader's own row only.
export async function hasReportedProfile(reporterId: number | null | undefined, traderId: number): Promise<boolean> {
  if (!reporterId) return false;
  const [r] = await sql`select 1 from thesis_reports where reporter_id = ${reporterId} and trader_id = ${traderId} and sell_id = '' limit 1`;
  return !!r;
}

/** What the report form shows for an outcome (app/report-actions.ts). `category` is what the form sent. */
export function profileReportState(o: ProfileReportOutcome, category?: unknown): ProfileReportState {
  const c = PROFILE_REPORT_COPY;
  if (o === 'reported') return { state: 'sent', message: c.done };
  if (o === 'already') return { state: 'already', message: c.already };
  if (o === 'rate') return { state: 'rate', message: c.rate };
  if (o === 'signed-out') return { state: 'signed-out', message: c.signedOut };
  if (o === 'own') return { state: 'invalid', message: c.own };
  if (o === 'invalid' && !isReportCategory(category)) return { state: 'invalid', message: c.noCategory, field: 'category' };
  return { state: 'invalid', message: c.failed }; // a malformed handle, or a profile no longer shown
}

/**
 * The server action's body, testable without a request: the caller passes the signed-in reader's id. A failure throws:
 * app/report-actions.ts is the one try/catch (it logs the error's name only and shows PROFILE_REPORT_COPY.failed).
 */
export async function submitProfileReport(reporterId: number | null | undefined, form: { get: (k: string) => unknown }, deps: ProfileReportDeps = defaultProfileReportDeps): Promise<ProfileReportState> {
  const category = form.get('category');
  return profileReportState(await reportProfile(reporterId, form.get('handle'), category, deps), category);
}
// end F-16
