// F-26: the trade page's author loader. Only the page body calls it, and only when the signed-in user is the trader
// (app/u/[handle]/trade/[sellId]/page.tsx); lib/trade-share-load.ts (the shared query behind the metadata and the share
// image) never imports it, so nothing shared or cached branches on who is asking.
// One statement: the held note's rule, and one count(*) of the author's closes ahead of this one in the profile's list
// order (closed_at desc, id desc: lib/paging.ts#byListOrder), which is the row's index there, so the link lands on the
// row's closes window and its edit field.
import { sql } from './db.ts';
import { windowOf } from './paging.ts';

const ID = /^[0-9]{1,18}$/;

// FIXES-CYCLE5 (F5-24, committee round 3 item 9): the link names the note field by the trade's key (`#note-<trade_key>`,
// app/u/[handle]/row-focus.tsx focuses it), which survives a rebuild, where a row id does not. Built here from the window
// part, never by rewriting lib/paging.ts#tradeHref's output, so a change to tradeHref can't turn into a wrong anchor.
const noteHref = (linkBase: string, key: string, index: number) => `${linkBase}?closes=${windowOf(index)}#note-${key}`;

export async function loadOwnNote(userId: number, tradeId: string, handle: string): Promise<{ rule: string | null; edit: string } | null> {
  if (!ID.test(tradeId)) return null;
  const [r] = await sql`
    select t.trade_key, t.thesis_hold_rule as rule,
      (select count(*)::int from closed_trades x where x.user_id = t.user_id and (x.closed_at, x.id) > (t.closed_at, t.id)) as ahead
    from closed_trades t
    where t.id = ${tradeId} and t.user_id = ${userId} and t.thesis_status = 'held' and t.thesis <> ''`;
  return r ? { rule: (r.rule ?? null) as string | null, edit: noteHref(`/u/${handle}`, r.trade_key as string, r.ahead as number) } : null;
}
