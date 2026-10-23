import { sql } from './db.ts';
import { moderate } from './moderation.ts';

/**
 * Save or clear a trader's thesis on one of their own closed trades (the profile thesis form, app/actions.ts#saveThesis).
 * The update and the removal of any copy a rebuild kept aside (lib/sync.ts#rebuildTrades) run in one transaction, so the
 * trader's latest word replaces the kept copy and a cleared thesis never comes back.
 */
export async function saveThesisFor(userId: number, tradeId: string, input: string) {
  const text = input.trim().slice(0, 280);
  const status = moderate(text);
  await sql.begin(async (tx) => {
    await tx`
      update closed_trades set thesis = ${text || null}, thesis_status = ${text ? status : null}
      where id = ${tradeId} and user_id = ${userId}`;
    await tx`delete from kept_theses where user_id = ${userId}
      and sell_id = (select sell_id from closed_trades where id = ${tradeId} and user_id = ${userId})`;
  });
}
