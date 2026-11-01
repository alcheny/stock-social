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
import { REPORT_COPY } from './report-copy.ts';
export { REPORT_COPY, type ReportState } from './report-copy.ts';

export const REPORT_HOLD_AT = 3;
export const REPORT_INTERVAL_MS = 60_000;
export const REPORT_RULE = 'reports';
const ID = /^[0-9]{1,18}$/;

export type ReportOutcome = 'reported' | 'held' | 'signed-out' | 'invalid' | 'not-found' | 'own' | 'already' | 'rate';
export type ReportDeps = { allow: (key: string, tx: TransactionSql) => boolean | Promise<boolean> };
// The shared limiter (lib/rate-limit.ts#hit, keyed hash, counted inside this transaction) backs the per-reader check on
// thesis_reports below: one report per reader per minute window on every instance.
export const defaultReportDeps: ReportDeps = { allow: (key, tx) => hit(limitKey('report', key), 1, REPORT_INTERVAL_MS / 1000, new Date(), tx) };

export async function reportThesis(reporterId: number | null | undefined, tradeId: unknown, deps: ReportDeps = defaultReportDeps): Promise<ReportOutcome> {
  if (!reporterId) return 'signed-out';
  if (typeof tradeId !== 'string' || !ID.test(tradeId)) return 'invalid';
  return sql.begin(async (tx): Promise<ReportOutcome> => {
    // The row lock serializes reports on one note, so the third distinct reporter always sees the other two.
    // Fix round 1 (item 8): a held note (any rule) is found too and answers exactly like a published one, so neither a
    // late reader nor the reporter who lost the race to hold it learns that it was held.
    const [t] = await tx`select t.user_id, t.sell_id, t.thesis_status, t.thesis_reports_from from closed_trades t
      join users u on u.id = t.user_id and u.deleted_at is null
      where t.id = ${tradeId} and t.thesis is not null for update of t`;
    if (!t) return 'not-found';
    if (t.user_id === reporterId) return 'own';
    // Reports count only from the last owner release (thesis_reports_from; never cleared by an edit).
    const from = t.thesis_reports_from as Date | null;
    const [dup] = await tx`select (${from}::timestamptz is null or created_at > ${from}::timestamptz) as counts from thesis_reports
      where reporter_id = ${reporterId} and trader_id = ${t.user_id} and sell_id = ${t.sell_id}`;
    if (dup?.counts) return 'already';
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
    if (t.thesis_status !== 'published') return 'held';
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
// answer never tells a hidden note from a missing one; a malformed id fails.
export function reportMessage(o: ReportOutcome): string {
  if (o === 'reported' || o === 'held' || o === 'not-found') return REPORT_COPY.done;
  if (o === 'already') return REPORT_COPY.already;
  if (o === 'rate') return REPORT_COPY.rate;
  return REPORT_COPY.failed;
}
