'use client';
// F-25 (docs/features/F-25-one-link-rule-for-trade-rows.md): the pane's "Last 5 trades" links and the feed card's two
// footer links. Client components only so the page payload carries their compact props (key, symbol, date text, return),
// not each link's element tree: a feed page renders one pane per card, and as element trees these rows took ~100 KB of
// the F-2 heavy page's 500 KB budget (e2e/section.spec.ts). The server HTML and the names are the same either way.
import Link from 'next/link';
import { RECORD_LINK, signWord, TRADE_LINK } from '@/lib/copy.ts';
import { pct } from '@/lib/format.ts';
import { toneClass } from '@/lib/open-split.ts';
import { tradePageHref } from '@/lib/trade-href.ts';

// One pane row: [trade_key or null, symbol, the server's date text, return]. `current`: the highlighted row's index.
export type PaneRowData = [key: string | null, symbol: string, day: string, returnPct: number];

// Shape R: each row is one link to its trade page, named by its visible text, the sign word before the figure and the
// visually hidden suffix; the highlighted row's link carries aria-current. A row without a key stays text.
export function PaneTradeRows({ handle, rows, current }: { handle: string; rows: PaneRowData[]; current: number }) {
  return (
    <ul className="rows">
      {rows.map(([key, symbol, day, r], i) => {
        const cls = i === current ? 'line hl' : 'line', cur = i === current ? 'true' as const : undefined;
        const cells = <>
          <span><b>{symbol}</b> <span className="muted">{day}</span></span>
          <b className={toneClass(r)}><span className="sr-only">{`${signWord(r)} `}</span>{pct(r)}</b>
        </>;
        return (
          <li key={key ?? i}>
            {key
              ? <Link href={tradePageHref({ handle, tradeKey: key })} className={cls} aria-current={cur}>{cells}<span className="sr-only">{TRADE_LINK.suffix(symbol)}</span></Link>
              : <div className={cls} aria-current={cur}>{cells}</div>}
          </li>
        );
      })}
    </ul>
  );
}

// The feed card's footer links: "This trade →" (when the row has a key) then "Record, wins and losses →". Each name is
// unique on the page: the trade's symbol, sign word and figure, the trader's handle, in visually hidden text after the
// visible words (WCAG 2.5.3); the arrows are not read.
export function CardFooterLinks({ handle, tradeKey, symbol, returnPct }: { handle: string; tradeKey?: string; symbol: string; returnPct: number }) {
  return (
    <span className="f25-card-links">
      {tradeKey && <Link className="f25-card-link" href={tradePageHref({ handle, tradeKey })}>{TRADE_LINK.card}<span className="sr-only">{TRADE_LINK.cardName(symbol, returnPct)}</span>{' '}<span aria-hidden="true">→</span></Link>}
      <Link className="f25-card-link" href={`/u/${handle}`}>{RECORD_LINK}<span className="sr-only">{`: @${handle}`}</span>{' '}<span aria-hidden="true">→</span></Link>
    </span>
  );
}
