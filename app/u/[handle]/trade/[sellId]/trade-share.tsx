'use client';
import { recordTradeShared } from '../../../../actions.ts';
import { ShareButton } from '../../../../share-button.tsx';

// One Share button for a trade page or a month recap. Identical for losses and gains; records trade_shared_at
// for the owner only (best-effort).
export function TradeShare({ path, title, isOwner }: { path: string; title: string; isOwner: boolean }) {
  return (
    <div className="trade-share">
      <ShareButton url={path} title={title} label="Share" onShared={() => { if (isOwner) void recordTradeShared().catch(() => {}); }} />
    </div>
  );
}
