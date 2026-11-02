import { sql } from './db.ts';
import { MODERATION_VERSION, moderateDetail } from './moderation.ts';
import { HIDDEN_RULE, KEPT_RULE } from './report-copy.ts';
import { thesisHiddenByOwner } from './trust-hide.ts';
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
 * Fix round 5 (item 9): a note the owner reviewed and kept held (rule 'kept') stays held through an edit, until the owner
 * releases it. Fix round 5 (item 3): a saved note records the rules version it was checked at (thesis_checked_version),
 * so the start-up re-check only applies rules added after it.
 */
// FIXES-CYCLE5 (F5-2, C5-3): the profile form names its trade by trade_key (64 hex: sha256 of the closing sell's id,
// lib/likes.ts#tradeKey, a generated column), which survives rebuildTrades. A row id changes on every rebuild, so a note
// typed on a page loaded before a sync used to be dropped without a word. A row id (what a page rendered before this
// change posts, and the tests' fixtures) is still accepted, with the same rules. A save that finds no trade writes nothing
// and answers 'changed', which the form says out loud (app/actions.ts#saveThesis); never a silent drop (POLICY U1).
export type SaveOutcome = 'saved' | 'changed' | 'invalid';
const TRADE_KEY = /^[0-9a-f]{64}$/;

export async function saveThesisFor(userId: number, tradeId: string, input: string): Promise<SaveOutcome> {
  const byKey = TRADE_KEY.test(tradeId);
  if (!byKey && !/^[0-9]{1,18}$/.test(tradeId)) return 'invalid';
  const text = sanitizeUserText(input, THESIS_MAX);
  const { status, rule } = moderateDetail(text);
  return sql.begin(async (tx): Promise<SaveOutcome> => {
    const byTradeKey = () => tx`select id, thesis, thesis_status, thesis_hold_rule, sell_id, thesis_reports_from from closed_trades where user_id = ${userId} and trade_key = ${tradeId} for update`;
    let [prev] = byKey ? await byTradeKey() : await tx`select thesis, thesis_status, thesis_hold_rule, sell_id, thesis_reports_from from closed_trades where id = ${tradeId} and user_id = ${userId} for update`;
    // A rebuild holding this trader's rows (lib/sync.ts#rebuildTrades locks them all) deletes the row this select waited
    // for, so in READ COMMITTED it comes back empty once the rebuild commits; the next statement's snapshot sees the
    // rebuilt row, which keeps its trade_key. Once is enough: a second rebuild waits on this transaction's lock.
    if (!prev && byKey) [prev] = await byTradeKey();
    if (!prev) return 'changed';
    if (byKey) tradeId = String(prev.id); // the writes below name the locked row
    if (!text) {
      await tx`
        update closed_trades set thesis = null, thesis_status = null, thesis_written_at = null, thesis_edited_at = null,
          thesis_hold_rule = null, thesis_reviewed_at = null, thesis_checked_version = null
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
      // ponytail: clearing a kept note and writing it again starts moderation afresh (a cleared note keeps no rule, and
      // rebuildTrades carries only notes with text) — keep a per-sell kept mark if the review queue shows it used.
      const kept = prev.thesis_status === 'held' && prev.thesis_hold_rule === KEPT_RULE;
      // F-16 (plan §5.3, v2 E6): a thesis the owner hid stays hidden through an edit, and through a clear and rewrite
      // (the cleared row keeps no rule, so the latest trust_audit row decides). Only the audited unhide clears it.
      const hidden = (prev.thesis_status === 'held' && prev.thesis_hold_rule === HIDDEN_RULE) || await thesisHiddenByOwner(tx, userId, prev.sell_id);
      const [st, why] = hidden ? ['held', HIDDEN_RULE] : reported ? ['held', REPORT_RULE] : kept ? ['held', KEPT_RULE] : [status, status === 'held' ? rule : null];
      await tx`
        update closed_trades set thesis = ${text}, thesis_status = ${st}, thesis_hold_rule = ${why},
          thesis_reviewed_at = null, thesis_checked_version = ${MODERATION_VERSION},
          thesis_written_at = ${first ? tx`now()` : tx`thesis_written_at`},
          thesis_edited_at = ${first ? tx`null` : tx`now()`}
        where id = ${tradeId} and user_id = ${userId}`;
    }
    // FIXES-CYCLE5 (F5-2): keyed on the locked row's sell_id (the same close), not on a second read by id.
    await tx`delete from kept_theses where user_id = ${userId} and sell_id = ${prev.sell_id}`;
    return 'saved';
  });
}
