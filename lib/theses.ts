export type KeptThesis = { sell_id: string; thesis: string; thesis_status: string | null };

/**
 * Re-attach theses saved before a rebuild to the rebuilt trades, keyed by the closing sell's id.
 * Theses whose sell is no longer in `trades` are returned in `orphaned`, never dropped silently.
 * Duplicate `sell_id`s in `kept`: the last wins in `attached`; earlier ones go to `orphaned`.
 * Pure: inputs are not mutated and `thesis_status` is carried through unchanged.
 */
export function reattachTheses<T extends { sellId: string }>(
  kept: KeptThesis[], trades: T[],
): { attached: Map<string, KeptThesis>; orphaned: KeptThesis[] } {
  const sells = new Set(trades.map((t) => t.sellId));
  const attached = new Map<string, KeptThesis>();
  const orphaned: KeptThesis[] = [];
  for (const k of kept) {
    if (!sells.has(k.sell_id)) { orphaned.push(k); continue; }
    const prev = attached.get(k.sell_id);
    if (prev) orphaned.push(prev);
    attached.set(k.sell_id, k);
  }
  return { attached, orphaned };
}
