'use client';
// F-25 (docs/features/F-25-one-link-rule-for-trade-rows.md): the pane's "Last 5 trades" links and the feed card's two
// footer links. Client components only so the page payload carries their compact props (key, symbol, the printed date,
// figure and sign: never more precision than the row shows),
// not each link's element tree: a feed page renders one pane per card, and as element trees these rows took ~100 KB of
// the F-2 heavy page's 500 KB budget (e2e/section.spec.ts). The server HTML and the names are the same either way.
import Link from 'next/link';
import { RECORD_LINK, TRADE_LINK } from '@/lib/copy.ts';
import { toneWord, type Tone } from '@/lib/format.ts';
import { tradePageHref } from '@/lib/trade-href.ts';

// One pane row, as the server prints it: [trade_key or null, symbol, date, figure (pct), tone]. `current`: the highlighted
// row's index. The class and the sign word follow the tone, as toneClass and signWord do.
export type PaneRowData = [key: string | null, symbol: string, day: string, figure: string, tone: Tone];

// Shape R: each row is one link to its trade page, named by its visible text, the sign word before the figure and the
// visually hidden suffix; the highlighted row's link carries aria-current. A row without a key stays text.
export function PaneTradeRows({ handle, rows, current }: { handle: string; rows: PaneRowData[]; current: number }) {
  return (
    <ul className="rows">
      {rows.map(([key, symbol, day, figure, tone], i) => {
        const cls = i === current ? 'line hl' : 'line', cur = i === current ? 'true' as const : undefined;
        const cells = <>
          <span><b>{symbol}</b> <span className="muted">{day}</span></span>
          <b className={tone === 'flat' ? undefined : tone}><span className="sr-only">{`${toneWord(tone)} `}</span>{figure}</b>
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
// `name`: TRADE_LINK.cardName(symbol, returnPct), printed by the server.
export function CardFooterLinks({ handle, tradeKey, name }: { handle: string; tradeKey?: string; name: string }) {
  return (
    <span className="f25-card-links">
      {tradeKey && <Link className="f25-card-link" href={tradePageHref({ handle, tradeKey })}>{TRADE_LINK.card}<span className="sr-only">{name}</span>{' '}<span aria-hidden="true">→</span></Link>}
      <Link className="f25-card-link" href={`/u/${handle}`}>{RECORD_LINK}<span className="sr-only">{`: @${handle}`}</span>{' '}<span aria-hidden="true">→</span></Link>
    </span>
  );
}
