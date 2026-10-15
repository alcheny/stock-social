'use client';
import { useEffect, useRef, useState } from 'react';
import { recordTradeShared } from '../../../../actions.ts';

// Copy link + native share for one trade page. Identical for losses and gains; calls a server action only for the owner (records trade_shared_at).
export function TradeShare({ path, title, isOwner }: { path: string; title: string; isOwner: boolean }) {
  const [url, setUrl] = useState(path);
  const [canShare, setCanShare] = useState(false);
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
    setCanShare(typeof navigator.share === 'function');
  }, [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      if (isOwner) void recordTradeShared().catch(() => {});
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('failed');
    }
  }

  async function share() {
    try {
      await navigator.share({ title, url });
      if (isOwner) void recordTradeShared().catch(() => {});
    } catch (e) {
      if ((e as Error).name !== 'AbortError') console.error(e);
    }
  }

  return (
    <div>
      <div className="trade-share">
        <button type="button" onClick={copy}>{state === 'copied' ? 'Copied' : 'Copy link'}</button>
        {canShare && <button type="button" className="secondary" onClick={share}>Share…</button>}
      </div>
      <span aria-live="polite" className="sr-only">{state === 'copied' ? 'Link copied' : ''}</span>
      {state === 'failed' && (
        <p role="status" className="muted">Couldn&apos;t copy. Select the link below.
          <input ref={field} readOnly value={url} aria-label="Trade link" onFocus={(e) => e.currentTarget.select()} autoFocus />
        </p>
      )}
    </div>
  );
}
