import { sql } from './db.ts';
import { isDemoUser } from './demo.ts';
import { publicRecord } from './connections.ts';
import { tradeSharePayload, type TradeView } from './trade-share.ts';
import type { RecordState } from './copy.ts';
import { routeHandle } from './params.ts';
import { statusForOrNull as statusFor } from './record-status-load.ts'; // FIXES-LABELS: status (QA round 2 N3: guarded, null on error)
import { optionHeadline, paneView } from './options-load.ts'; // OPTIONS: the strip's "Excluding options", gated per trader
import { filerVisibleSql } from './public-gate.ts';
import { visibleId, visibleUser } from './visible-users.ts';
import { openingFilings, type PubRow } from './public-trades.ts';
import { TRADE_KEY_RE } from './trade-href.ts';

// F-25: who may see a trade page (a live user; a public filer only while shown), one rule for the page, the image and
// the legacy redirect, so a 308 never reveals the trade_key of a page that then 404s.

// F-25: a trade page is addressed by its trade_key (lib/trade-href.ts#tradePageHref). The key is 64 lowercase hex.
export async function loadTradeShareByKey(handle: string, tradeKey: string) {
  if (!TRADE_KEY_RE.test(tradeKey)) return null;
  return loadTrade(handle, sql`ct.trade_key = ${tradeKey}`);
}

// The trade by its closing sell's vendor id: test-only since F-25 (lib/thesis-save, f7-routes, options-strip and others load
// fixtures by sell id); the pages load by key, and old links resolve through legacyTradeKey. Never used to build a URL.
export async function loadTradeShare(handle: string, sellId: string) {
  if (sellId.includes('\0')) return null; // F12: junk in the URL is a 404, not a database error
  return loadTrade(handle, sql`ct.sell_id = ${sellId}`);
}

// F-25: the trade_key a legacy `/u/<handle>/trade/<sell_id>` URL resolves to, under the page's visibility rule; null for
// an unknown segment, another handle's sell id, a deleted user or a hidden or removed public filer (all 404, no redirect).
export async function legacyTradeKey(handle: string, sellId: string): Promise<string | null> {
  if (!routeHandle(handle) || sellId.includes('\0')) return null;
  const [r] = await sql`select ct.trade_key from closed_trades ct join users u on u.id = ct.user_id and ${visibleUser('u')} and ${filerVisibleSql('u')}
    where u.handle = ${handle} and ct.sell_id = ${sellId}`;
  return r ? (r.trade_key as string) : null;
}

// The only query behind the trade page and card. A held thesis is nulled in SQL, so it never reaches rendering code.
async function loadTrade(handle: string, match: ReturnType<typeof sql>) {
  if (!routeHandle(handle)) return null; // F12: junk in the URL is a 404, not a database error
  const [t] = await sql`
    select ct.id, ct.user_id, ct.symbol, ct.return_pct, ct.holding_days, ct.closed_at,
      case when ct.thesis_status = 'published' then ct.thesis end as thesis,
      case when ct.thesis_status = 'published' then ct.thesis_written_at end as thesis_written_at,
      case when ct.thesis_status = 'published' then ct.thesis_edited_at end as thesis_edited_at,
      u.display_name, u.public_filer_id, ct.filing_url, ct.opened_at, ct.trade_key
    from closed_trades ct join users u on u.id = ct.user_id and ${visibleUser('u')} and ${filerVisibleSql('u')}
    where u.handle = ${handle} and ${match}`;
  if (!t) return null;
  const all = await sql`select symbol, opened_at, closed_at, return_pct, holding_days, verified from closed_trades where user_id = ${t.user_id} and ${visibleId(Number(t.user_id))} order by closed_at desc, id desc`; // F-12: the profile's order, so sums match it to the bit
  const payload = tradeSharePayload({
    symbol: t.symbol, returnPct: t.return_pct, holdingDays: t.holding_days, closedAt: t.closed_at,
    thesis: t.thesis, thesisStatus: t.thesis ? 'published' : null, demo: await isDemoUser(t.user_id),
    allTrades: all.map((r) => ({ symbol: r.symbol, openedAt: r.opened_at, closedAt: r.closed_at, returnPct: r.return_pct, holdingDays: r.holding_days })),
  }, new Date());
  // Fix round 6 (TR-3): the record state and source travel with the payload, so the card and the link preview apply
  // the profile's rule (a failed import is never presented as a whole verified record).
  const verified = all.length > 0 && all.every((r) => r.verified);
  const state = (await publicRecord(Number(t.user_id))).state;
  const excludingOptions = paneView((await optionHeadline([Number(t.user_id)])).get(Number(t.user_id))!).label; // OPTIONS
  // F-7: the sale's and opening purchase's filing links (C17: never a New record). ponytail: only the first matched purchase is linked (closed_trades keeps no lot list) — store the matched buys' filing ids at rebuild to link each.
  const bought = t.public_filer_id ? openingFilings(await sql<PubRow[]>`select * from public_transactions where filer_id = ${t.public_filer_id}`, t.symbol, t.opened_at) : [];
  const filings = t.filing_url ? { sold: t.filing_url as string, bought } : null;
  // F-9: the note's dates and the trade's id (the Report control) ride beside the payload, never inside the share data.
  const note = { tradeId: String(t.id), writtenAt: (t.thesis_written_at ?? null) as Date | null, editedAt: (t.thesis_edited_at ?? null) as Date | null };
  // FIXES-LABELS: status (F-11): the status-line facts beside the state (the page renders live, the image static).
  return { ...payload, tradeKey: t.trade_key as string, newRecord: payload.newRecord && !filings, handle, displayName: t.display_name as string, state, verified, filings, note, open: await openPercents(Number(t.user_id), state), excludingOptions, status: await statusFor(Number(t.user_id), state) } satisfies TradeView;
}

// F-12 (F-6 on every surface): the trader's open positions as unrealized percents, for the strip's open count. Read only
// for a connected or failed record, as on the profile; never while an import runs (TR-3) or with nothing consented.
export async function openPercents(userId: number, state: RecordState): Promise<number[] | undefined> {
  if (state !== 'connected' && state !== 'failed') return undefined;
  const rows = await sql`select unrealized_pct from open_positions where user_id = ${userId} and ${visibleId(userId)}`;
  return rows.map((r) => r.unrealized_pct as number);
}

// Route params may be percent-encoded; malformed input (or a NUL byte, which Postgres text cannot hold) is a 404, not a 500.
export function decodeSellId(raw: string): string | null {
  let id: string;
  try { id = decodeURIComponent(raw); } catch { return null; }
  return id.includes('\0') ? null : id;
}
