// F-26: the trade page's author loader. Only the page body calls it, and only when the signed-in user is the trader
// (app/u/[handle]/trade/[sellId]/page.tsx); lib/trade-share-load.ts (the shared query behind the metadata and the share
// image) never imports it, so nothing shared or cached branches on who is asking.
// One statement: the held note's rule, and one count(*) of the author's closes ahead of this one in the profile's list
// order (closed_at desc, id desc: lib/paging.ts#byListOrder), which is the row's index there, so the link lands on the
// row's closes window and its edit field (lib/paging.ts#tradeHref).
import { sql } from './db.ts';
import { tradeHref } from './paging.ts';

const ID = /^[0-9]{1,18}$/;

export async function loadOwnNote(userId: number, tradeId: string, handle: string): Promise<{ rule: string | null; edit: string } | null> {
  if (!ID.test(tradeId)) return null;
  const [r] = await sql`
    select t.id::text as id, t.thesis_hold_rule as rule,
      (select count(*)::int from closed_trades x where x.user_id = t.user_id and (x.closed_at, x.id) > (t.closed_at, t.id)) as ahead
    from closed_trades t
    where t.id = ${tradeId} and t.user_id = ${userId} and t.thesis_status = 'held' and t.thesis <> ''`;
  return r ? { rule: (r.rule ?? null) as string | null, edit: tradeHref(`/u/${handle}`, r.id as string, r.ahead as number) } : null;
}
