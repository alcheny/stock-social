import { sql } from './db.ts';
import { moderateDetail } from './moderation.ts';
import { sanitizeUserText } from './text-safety.ts';
import { REPORT_HOLD_AT, REPORT_RULE } from './reports.ts';

export const THESIS_MAX = 280;

/**
 * Save or clear a trader's thesis on one of their own closed trades (the profile thesis form, app/actions.ts#saveThesis).
 * The update and the removal of any copy a rebuild kept aside (lib/sync.ts#rebuildTrades) run in one transaction, so the
 * trader's latest word replaces the kept copy and a cleared thesis never comes back.
 *
 * fix-user-text B (F-9): the text is cleaned before it is stored (lib/text-safety.ts: direction controls and invisible
 * format characters removed), then matched (lib/moderation.ts#moderateDetail); a match is `held` with its rule's label
 * in thesis_hold_rule, never dropped. Dates: the first write of a thesis sets thesis_written_at; a later change sets
 * thesis_edited_at and keeps the written date as it is (a thesis written before the column existed keeps none: a date
 * is never invented). Any change clears thesis_reviewed_at, so an owner release (scripts/review-theses.ts) covers only
 * the text it was given. Saving the same text again changes nothing. Clearing removes the text and all of its dates.
 * Reports (thesis_reports) are never removed here, and thesis_reports_from is never touched: reports count only from the
 * last release (lib/reports.ts), so an edit after a release can't bring the reports made before it back. A thesis held by
 * reports stays held through an edit until the owner reviews it, so editing one character never escapes a report hold.
 * Fix round 3 (item 9): nor does clearing it and writing it again: any save of a note that REPORT_HOLD_AT distinct readers
 * reported since the last release (the count lib/reports.ts holds on) is held with rule 'reports'.
 */
export async function saveThesisFor(userId: number, tradeId: string, input: string) {
  if (!/^[0-9]{1,18}$/.test(tradeId)) return;
  const text = sanitizeUserText(input, THESIS_MAX);
  const { status, rule } = moderateDetail(text);
  await sql.begin(async (tx) => {
    const [prev] = await tx`select thesis, thesis_status, thesis_hold_rule, sell_id, thesis_reports_from from closed_trades where id = ${tradeId} and user_id = ${userId} for update`;
    if (!prev) return;
    if (!text) {
      await tx`
        update closed_trades set thesis = null, thesis_status = null, thesis_written_at = null, thesis_edited_at = null,
          thesis_hold_rule = null, thesis_reviewed_at = null
        where id = ${tradeId} and user_id = ${userId}`;
    } else if (text !== prev.thesis) {
      const first = prev.thesis === null;
      let reported = prev.thesis_status === 'held' && prev.thesis_hold_rule === REPORT_RULE;
      if (!reported) {
        const from = prev.thesis_reports_from as Date | null;
        const [{ n }] = await tx`select count(distinct r.reporter_id)::int as n from thesis_reports r
          join users u on u.id = r.reporter_id and u.deleted_at is null
          where r.trader_id = ${userId} and r.sell_id = ${prev.sell_id}
            and (${from}::timestamptz is null or r.created_at > ${from}::timestamptz)`;
        reported = n >= REPORT_HOLD_AT;
      }
      const [st, why] = reported ? ['held', REPORT_RULE] : [status, status === 'held' ? rule : null];
      await tx`
        update closed_trades set thesis = ${text}, thesis_status = ${st}, thesis_hold_rule = ${why},
          thesis_reviewed_at = null,
          thesis_written_at = ${first ? tx`now()` : tx`thesis_written_at`},
          thesis_edited_at = ${first ? tx`null` : tx`now()`}
        where id = ${tradeId} and user_id = ${userId}`;
    }
    await tx`delete from kept_theses where user_id = ${userId}
      and sell_id = (select sell_id from closed_trades where id = ${tradeId} and user_id = ${userId})`;
  });
}
