// Ticker share card: unfurls a pasted /t/SYMBOL link. Never throws on a bad symbol.
// F-12 (committee 2026-11-01, owner note): status, symbol, the closed-trade count and the trader count with "losses
// included", and the disclaimer, all inside the anti-crop band (lib/stock-image.ts). No pooled figure of any kind: about
// one stock it reads as a rating of the stock (POLICY F3b). The alt is static, so it states no figures and no trust word.
import { ImageResponse } from 'next/og';
// FIXES-LABELS (D-09): the F3 lines at the band's disclaimer size (lib/record-strip.ts DISCLAIMER_PX, from lib/image-fit.ts, DS-19).
import { DISCLAIMER } from '@/lib/share.ts';
import { sql } from '@/lib/db.ts';
import { visibleUser } from '@/lib/visible-users.ts';
import { decodeSymbolParam, tickerSummary, type TickerRow } from '@/lib/ticker.ts';
import { fitPx, layoutBand, STRIP_BAND, type ImageLine } from '@/lib/record-strip.ts';
import { disclaimerAtFoot, stockImageLines } from '@/lib/stock-image.ts';
import { RecordStripImage } from '@/app/record-strip.tsx';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Closed trades in one stock on Stock Social';
// F-16 (plan v2 E2): a bounded cache, like story/route.tsx, so a hide reaches a shared copy within 300 s.
// ponytail: a cached copy can outlive a hide by up to 300 s (images) — fix: versioned image keys purged on hide (plan §9.1).
const CACHE = { 'Cache-Control': 'public, max-age=300' };

// No trades to describe: the same band, with the title and one line (the brand box names the site).
function neutral(title: string, line: string, headers: Record<string, string> = CACHE) {
  const lines: ImageLine[] = [
    { role: 'title', text: title, size: Math.max(STRIP_BAND.minPx, fitPx(title, 120)), tone: 'text', weight: 800 },
    { role: 'line', text: line, size: Math.max(STRIP_BAND.minPx, fitPx(line, 40)), tone: 'muted', weight: 400 },
  ];
  return new ImageResponse(<RecordStripImage lines={layoutBand(lines).lines} />, { ...size, headers });
}

export default async function Card({ params }: { params: Promise<{ symbol: string }> }) {
  try {
    const symbol = decodeSymbolParam((await params).symbol);
    if (!symbol) return neutral('Stock Social', 'Verified trades by stock');
    // Deleted and hidden traders' trades are not counted (the page's rule: the visible-user predicate, F-16).
    // ponytail: the card keeps its own full read (lib/f12-followups.test.ts and lib/ticker-sql.test.ts pin this query) —
    // fix: switch it to app/t/ticker-sql.ts#tickerHeadline (the page's SQL summary) and move those two pins with it.
    const found = (await sql`select t.user_id, t.return_pct, t.holding_days, t.opened_at, t.closed_at, t.verified from closed_trades t join users u on u.id = t.user_id and ${visibleUser('u')} where t.symbol = ${symbol} and t.filing_url is null`) as unknown as
      { user_id: number; return_pct: number; holding_days: number; opened_at: Date; closed_at: Date; verified: boolean }[];
    if (!found.length) return neutral(symbol, 'No verified trades yet');
    const rows: TickerRow[] = found.map((r) => ({ userId: r.user_id, returnPct: r.return_pct, holdingDays: r.holding_days, openedAt: r.opened_at, closedAt: r.closed_at, verified: r.verified }));
    const s = tickerSummary(rows, new Date());
    const { lines } = layoutBand(stockImageLines({ symbol, n: s.n, traders: s.traders, demoOnly: s.demoOnly, mixed: s.mixed }));
    return new ImageResponse(<RecordStripImage lines={disclaimerAtFoot(lines)} disclaimer={DISCLAIMER} />, { ...size, headers: CACHE });
  } catch {
    // ponytail: a database error still answers 200 with the neutral picture (never cached) — fix: drop this catch so it
    // answers 500 as the trade and month images do.
    return neutral('Stock Social', 'Verified trades by stock', { 'Cache-Control': 'no-store' });
  }
}
