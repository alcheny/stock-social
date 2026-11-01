// Fix #1 (approval council cycle 2, POLICY F3a/P2): what the stock pages and the stock share image call their trades.
// "Verified" only when every trade shown is verified (imported read-only from a connected broker); demo data is called
// "Demo" (one state name); a mix is called plainly "closed trades" and its Demo rows carry their own badge. Pure.
export type Mix = { demoOnly: boolean; mixed: boolean };

// The noun phrase for the trades on a page: "verified closed trades" | "closed trades".
export const tradesWord = (m: Mix | null) => (m && !m.demoOnly && !m.mixed ? 'verified closed trades' : 'closed trades');

export const STOCK_LABELS = {
  // The stock page's explainer: true on every page state (demo, mixed, verified, empty), so it names no state.
  explainer: 'Closed trades in this stock, newest first. Fewer trades means a wider range.',
  demoNote: 'Demo data, not from a real broker.',
  mixedNote: 'Includes demo data, marked Demo.',
  pageDemoNote: 'All trades on this page are demo data, not from a real broker.',
  pageMixedNote: 'Some trades here are demo data and are marked Demo. The summary includes them.',
  // Appended to search and share text; empty for an all-verified page.
  suffix: (m: Mix) => (m.demoOnly ? ' Demo data.' : m.mixed ? ' Includes demo data.' : ''),
  title: (symbol: string, m: Mix | null) => `${symbol} ${m?.demoOnly ? 'demo trades' : m && !m.mixed ? 'verified trades' : 'closed trades'} · Stock Social`,
  empty: (symbol: string) => `No closed trades in ${symbol} yet.`,
  // The share image's top-right status: words, never a check glyph (the image font has none).
  imageStatus: (m: Mix) => (m.demoOnly ? 'Demo data' : m.mixed ? 'Includes demo data' : 'Verified from broker'),
  imageAlt: 'Closed trades by stock on Stock Social',
  imageNeutralLine: 'Closed trades by stock',
  imageNeutralFooter: 'Stock Social · trading records from connected brokers',
  imageEmpty: 'No closed trades yet',
};
