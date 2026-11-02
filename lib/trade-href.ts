// F-25 (docs/features/F-25-one-link-rule-for-trade-rows.md): the one builder of every trade-page URL. It takes the row's
// fields, not a ready string, so a later change of key stays here. The key is closed_trades.trade_key (sha256 of the
// closing sell's vendor id, a generated column), which survives rebuildTrades; the vendor id itself never appears in a URL.
export const TRADE_KEY_RE = /^[0-9a-f]{64}$/;

export function tradePageHref({ handle, tradeKey }: { handle: string; tradeKey: string }): string {
  if (!TRADE_KEY_RE.test(tradeKey)) throw new Error('tradePageHref: not a trade key');
  return `/u/${handle}/trade/${tradeKey}`;
}

// F-25: the legacy redirect keeps the request's query string (so `?via=` on an old shared link survives the 308): every
// value, repeated keys in order, re-encoded; none gives the bare href.
export function withQuery(href: string, search: Record<string, string | string[] | undefined> | undefined): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(search ?? {})) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) qs.append(k, x);
  return qs.size ? `${href}?${qs}` : href;
}
