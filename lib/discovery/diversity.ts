// F-2 PR-1 (criterion 6): in any 10 consecutive feed cards no trader or symbol appears more than twice.
// Pure: reads only what it is given (no database, session or viewer data; lib/discovery/imports.test.ts).
// Greedy over the ranked list: each slot takes the best-ranked card that fits. A cap is never relaxed: when nothing
// left fits, the list ends there (a short feed is honest; a third card of one trader in ten is not).

export type MixCard = { key: string; trader: number | string; symbol: string };
export type Caps = { window: number; maxPerTrader: number; maxPerSymbol: number };
export const FEED_CAPS: Caps = { window: 10, maxPerTrader: 2, maxPerSymbol: 2 };

// Can `c` go in the slot after `placed`? Only the last window − 1 cards share a window with it.
export function fits(placed: readonly MixCard[], c: MixCard, caps: Caps = FEED_CAPS): boolean {
  let t = 0, s = 0;
  for (let i = Math.max(0, placed.length - (caps.window - 1)); i < placed.length; i++) {
    if (placed[i].trader === c.trader) t++;
    if (placed[i].symbol === c.symbol) s++;
  }
  return t < caps.maxPerTrader && s < caps.maxPerSymbol;
}

export function diversify<T extends MixCard>(ranked: readonly T[], caps: Caps = FEED_CAPS): T[] {
  const left = [...ranked];
  const out: T[] = [];
  for (;;) {
    const i = left.findIndex((c) => fits(out, c, caps));
    if (i < 0) return out;
    out.push(left.splice(i, 1)[0]);
  }
}

// The most cards of one trader and of one symbol in any `window` consecutive cards (tests and the load check).
export function worstWindow(list: readonly MixCard[], window = FEED_CAPS.window): { trader: number; symbol: number } {
  let trader = 0, symbol = 0;
  const t = new Map<MixCard['trader'], number>(), s = new Map<string, number>();
  const add = (m: Map<unknown, number>, k: unknown, d: number) => { const v = (m.get(k) ?? 0) + d; m.set(k, v); return v; };
  list.forEach((c, i) => {
    trader = Math.max(trader, add(t, c.trader, 1));
    symbol = Math.max(symbol, add(s, c.symbol, 1));
    if (i >= window - 1) { const o = list[i - window + 1]; add(t, o.trader, -1); add(s, o.symbol, -1); }
  });
  return { trader, symbol };
}
