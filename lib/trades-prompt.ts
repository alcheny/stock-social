// The new-trade prompt's action and "seen" stamp, in one statement (orchestrator report 2026-11-01: e2e/app.spec.ts:488
// saw the prompt again after Dismiss). It used to be two updates — the action, then trades_prompt_seen_at — so a reload
// (or the test's poll on the action) between them read an old seen time and showed the prompt again. One update writes
// both at once: no reader can see the action without the new seen time.
import { sql } from './db.ts';
import { TRADES_PROMPT_ACTIONS, type TradesPromptAction } from './new-trades.ts';

// 'opened' replaces 'dismissed'; a later 'dismissed' never overwrites 'opened'. The seen time always moves.
export async function recordTradesPrompt(userId: number, action: TradesPromptAction): Promise<void> {
  if (!TRADES_PROMPT_ACTIONS.includes(action)) return;
  await sql`
    update users set
      trades_prompt_action = case when trades_prompt_action is null or (trades_prompt_action = 'dismissed' and ${action} = 'opened')
        then ${action} else trades_prompt_action end,
      trades_prompt_seen_at = now()
    where id = ${userId}`;
}
