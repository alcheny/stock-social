// F-6: open positions in this stock, aggregate only (no handles, rows or links: POLICY F1/F3b), and in words not
// included in the closed-trade figures above.
import { OPEN } from '@/lib/copy.ts';
import { pct } from '@/lib/trades.ts';
import type { SymbolOpen } from '../open-positions.ts';

export default function OpenPositions({ symbol, open }: { symbol: string; open: SymbolOpen }) {
  return (
    <section className="open-ticker" data-open aria-labelledby="open-h">
      <h2 id="open-h">{OPEN.tickerTitle(symbol)}</h2>
      <p>{OPEN.line(open.o, pct)}{OPEN.tickerTraders(open.traders)} {OPEN.tickerNote}</p>
    </section>
  );
}
