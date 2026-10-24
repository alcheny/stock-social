'use client';
import { useEffect, useState } from 'react';
import type { PublicState } from '@/lib/connections.ts';
import { feedPaneChart } from '@/lib/chart-series.ts';
import { ProfilePane, type PaneTrade } from './pane.tsx';

// F-2 PR-3b fix round 1 (D2): a Similar trades sheet's pane, read from /u/<h>/pane when the sheet first opens (SuggestRow
// mounts it then). `highlight`: the row's trade, marked in the pane's list (D1).
export function LazyPane({ handle, name, highlight }: { handle: string; name: string; highlight: string }) {
  const [data, setData] = useState<{ state: PublicState; trades: PaneTrade[] } | null | 'failed'>(null);
  useEffect(() => {
    let live = true;
    fetch(`/u/${encodeURIComponent(handle)}/pane`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { state: PublicState; trades: (Omit<PaneTrade, 'closedAt'> & { closedAt: number })[] }) => {
        if (live) setData({ state: d.state, trades: d.trades.map((t) => ({ ...t, closedAt: new Date(t.closedAt) })) });
      }, () => live && setData('failed'));
    return () => { live = false; };
  }, [handle]);
  if (data === 'failed') return <p className="muted small sheet-wait">The record could not be loaded. <a href={`/u/${handle}`}>See full profile →</a></p>;
  if (!data) return <p className="muted small sheet-wait" role="status">Loading {name}’s record…</p>;
  const now = new Date();
  return <ProfilePane handle={handle} name={name} trades={data.trades} chart={feedPaneChart(data.trades, now)} now={now} state={data.state} highlight={highlight} back={false} />;
}
