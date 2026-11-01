export type KeptThesis = {
  sell_id: string; thesis: string; thesis_status: string | null;
  // fix-user-text B (F-9): carried with the thesis, unchanged, by sell_id (lib/sync.ts#rebuildTrades).
  thesis_written_at?: Date | null; thesis_edited_at?: Date | null; thesis_hold_rule?: string | null; thesis_reviewed_at?: Date | null;
  thesis_reports_from?: Date | null; // fix round 1: reports count only after it (lib/reports.ts)
  thesis_checked_version?: number | null; // fix round 5: the rules version it was last checked at (lib/moderation.ts)
};

/**
 * Re-attach theses saved before a rebuild to the rebuilt trades, keyed by the closing sell's id.
 * Theses whose sell is no longer in `trades` are returned in `orphaned`, never dropped silently.
 * Duplicate `sell_id`s in `kept`: the last wins in `attached`; earlier ones go to `orphaned`.
 * An empty or blank thesis is never attached (it goes to `orphaned`).
 * Pure: inputs are not mutated and `thesis_status` is carried through unchanged.
 */
export function reattachTheses<T extends { sellId: string }>(
  kept: KeptThesis[], trades: T[],
): { attached: Map<string, KeptThesis>; orphaned: KeptThesis[] } {
  const sells = new Set(trades.map((t) => t.sellId));
  const attached = new Map<string, KeptThesis>();
  const orphaned: KeptThesis[] = [];
  for (const k of kept) {
    // Fix round 4 (item 5): a copy left empty by the stored-text cleanup (db/schema.sql) is never re-attached as a
    // note (it would render and be reportable as an empty one); it stays where it is, returned as not attached.
    if (!sells.has(k.sell_id) || !k.thesis?.trim()) { orphaned.push(k); continue; }
    const prev = attached.get(k.sell_id);
    if (prev) orphaned.push(prev);
    attached.set(k.sell_id, k);
  }
  return { attached, orphaned };
}
