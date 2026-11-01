'use client';
import { recordShareAction, recordTradeShared } from '../../../../actions.ts';
import { ShareButton } from '../../../../share-button.tsx';

// One Share button for a trade page or a month recap. Identical for losses and gains. For the owner only (best-effort,
// never awaited): a trade page records trade_shared_at as before, and both record one F-15 share row
// (lib/share-actions.ts re-checks on the server that the path is the session user's own record).
export function TradeShare({ path, title, isOwner, kind }: { path: string; title: string; isOwner: boolean; kind: 'trade' | 'month' }) {
  const shared = (how: 'copied' | 'shared') => {
    if (!isOwner) return;
    if (kind === 'trade') void recordTradeShared().catch(() => {});
    void recordShareAction(path, how, false).catch(() => {});
  };
  return (
    <div className="trade-share">
      <ShareButton url={path} title={title} label="Share" onShared={shared} />
    </div>
  );
}
