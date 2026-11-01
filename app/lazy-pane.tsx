'use client';
import { useEffect, useState } from 'react';
import type { PublicState } from '@/lib/connections.ts';
import { feedPaneChart } from '@/lib/chart-series.ts';
import { ProfilePane, type PaneTrade } from './pane.tsx';
import { TrustFoot } from './trust-foot.tsx'; // F-16 (plan v2 B1): shown per the profile's <TrustShown>
import type { Segment } from '@/lib/record-status.ts'; // FIXES-LABELS: status
import type { PaneOptionsView } from '@/lib/options-view.ts'; // OPTIONS

// F-2 PR-3b fix round 1 (D2): a Similar trades sheet's pane, read from /u/<h>/pane when the sheet first opens (SuggestRow
// mounts it then). `highlight`: the row's trade, marked in the pane's list (D1).
// FIXES-LABELS (D-09): `disclaimer` false inside a sheet that carries its own .sheet-note.
export function LazyPane({ handle, name, highlight, disclaimer = true }: { handle: string; name: string; highlight: string; disclaimer?: boolean }) {
  const [data, setData] = useState<{ state: PublicState; trades: PaneTrade[]; open?: number[]; openAsOf?: Date; status?: Segment[]; options?: PaneOptionsView } | null | 'failed'>(null);
  useEffect(() => {
    let live = true;
    fetch(`/u/${encodeURIComponent(handle)}/pane`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { state: PublicState; trades: (Omit<PaneTrade, 'closedAt' | 'openedAt'> & { closedAt: number; openedAt?: number })[]; open?: number[]; openAsOf?: number | null; status?: Segment[] | null; options?: PaneOptionsView }) => {
        if (live) setData({ state: d.state, trades: d.trades.map((t) => ({ ...t, closedAt: new Date(t.closedAt), openedAt: t.openedAt ? new Date(t.openedAt) : undefined /* FIXES-LABELS (code review) */ /* FIXES-CYCLE4-PART2 (F4-16): writtenDay/editedDay pass through as day numbers */ })), open: d.open, openAsOf: d.openAsOf ? new Date(d.openAsOf) : undefined, status: d.status ?? undefined /* FIXES-LABELS: status */, options: d.options });
      }, () => live && setData('failed'));
    return () => { live = false; };
  }, [handle]);
  if (data === 'failed') return <p className="muted small sheet-wait">The record could not be loaded. <a href={`/u/${handle}`}>See full profile →</a></p>;
  if (!data) return <p className="muted small sheet-wait" role="status">Loading <bdi>{name}</bdi>’s record…</p>;
  const now = new Date();
  // F-16: the trust line under the pane; the sheet's own F3 note follows it (app/u/[handle]/similar-section.tsx).
  return <><ProfilePane handle={handle} name={name} trades={data.trades} chart={feedPaneChart(data.trades, now)} now={now} state={data.state} highlight={highlight} back={false} open={data.open} openAsOf={data.openAsOf} disclaimer={disclaimer} status={data.status} options={data.options} /><TrustFoot inPane disclaimer={false} /></>;
}
