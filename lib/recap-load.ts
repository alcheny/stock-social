import { sql } from './db.ts';
import { isDemoUser } from './demo.ts';
import { publicRecord } from './connections.ts';
import { monthRecap, monthsOnRecord, parseYm, wholeRecord, type RecapView } from './recap.ts';
import { filerVisibleSql } from './public-gate.ts';
import { openPercents } from './trade-share-load.ts';
import { routeHandle } from './params.ts';
import { statusForOrNull as statusFor } from './record-status-load.ts'; // FIXES-LABELS: status (QA round 2 N3: guarded, null on error)
import { monthOptionCloseCount, optionHeadline, paneView } from './options-load.ts'; // OPTIONS: the strip's "Excluding options", gated per trader

// The only query behind the recap page and card. Reads closed_trades (so recaps stay public after disconnect), plus the
// open positions' unrealized percents for the strip's open count on a connected or failed record (F-12).
export async function loadRecap(handle: string, ym: string) {
  if (!routeHandle(handle)) return null; // F12: junk in the URL is a 404, not a database error
  const [u] = await sql`select id, display_name, public_filer_id from users u where handle = ${handle} and deleted_at is null and ${filerVisibleSql('u')}`;
  if (!u) return null;
  const rows = await sql`select sell_id, trade_key, symbol, verified, opened_at, closed_at, return_pct, holding_days from closed_trades where user_id = ${u.id} order by closed_at desc, id desc`; // F-12: the profile's order, so sums match it to the bit
  const all = rows.map((r) => ({ sellId: r.sell_id as string, tradeKey: r.trade_key as string, symbol: r.symbol as string, openedAt: r.opened_at as Date, closedAt: r.closed_at as Date, returnPct: r.return_pct as number, holdingDays: r.holding_days as number }));
  const now = new Date();
  const recap = monthRecap(all, ym, now);
  // ponytail: a month whose only closes are option trades has no recap (monthRecap needs a share close) and is a 404 — fix:
  // a month page that lists the month's option count alone once the options gate opens.
  if (!recap) return null;
  const state = (await publicRecord(Number(u.id))).state;
  const head = (await optionHeadline([Number(u.id)])).get(Number(u.id))!; // FIXES-CYCLE4-PART2 (F4-4): kept for the gate
  const excludingOptions = paneView(head).label; // OPTIONS
  // FIXES-CYCLE4-PART2 (F4-4, C4-9): the month's shown option closes, counted within monthRecap's own UTC bounds (parseYm).
  // ponytail: excluded and dangling option closes are counted per trader with no date (users.excluded_options_*), so a
  // month counts only the shown ones; its qualifier still keys on the trader — fix: date the excluded rows in the importer.
  const bounds = parseYm(ym, now)!;
  const monthOptionCloses = excludingOptions
    ? await monthOptionCloseCount(Number(u.id), bounds.start, bounds.end)
    : 0;
  const record = wholeRecord(all, now); // F-7 (C17): a public record never shows New record.
  // FIXES-LABELS: status (F-11): the status-line facts beside the state (the page renders live, the image static).
  return { handle, displayName: u.display_name as string, demo: await isDemoUser(u.id), verified: rows.length > 0 && rows.every((r) => r.verified), state, recap, record: { ...record, newRecord: record.newRecord && !u.public_filer_id }, open: await openPercents(Number(u.id), state), excludingOptions, optionsGate: head.gate, monthOptionCloses /* FIXES-CYCLE4-PART2 (F4-4) */, months: monthsOnRecord(all) /* FIXES-LABELS (D-24) */, status: await statusFor(Number(u.id), state) } satisfies RecapView;
}
