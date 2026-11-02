'use client';
import { useEffect, useState } from 'react';
import type { PublicState } from '@/lib/connections.ts';
import { PAYLOAD_V, type PackedChart } from '@/lib/chart-series.ts';
import { ProfilePane } from './pane.tsx';
import type { Segment } from '@/lib/record-status.ts'; // FIXES-LABELS: status
import type { PaneOptionsView } from '@/lib/options-view.ts'; // OPTIONS
import type { PaneModel } from '@/lib/pane-model.ts'; // F-23

// F-2 PR-3b fix round 1 (D2): a Similar trades sheet's pane, read from /u/<h>/pane when the sheet first opens (SuggestRow
// mounts it then). `highlight`: the row's trade, marked in the pane's list (D1).
// FIXES-LABELS (D-09): `disclaimer` false inside a sheet that carries its own .sheet-note.
// F-23: the route sends the pane's model (every printed figure, computed on the server from stored values) and its
// chart, both at the printed precision; nothing is recomputed here. The URL carries the payload version; a body of
// another version is a failed load (the "could not be loaded" line), never misread.
type PaneBody = { v: number; state: PublicState; model: PaneModel; chart: PackedChart; status?: Segment[] | null; options?: PaneOptionsView };
export const paneSrc = (handle: string) => `/u/${encodeURIComponent(handle)}/pane?v=${PAYLOAD_V}`;
export function LazyPane({ handle, name, highlight, disclaimer = true }: { handle: string; name: string; highlight: string; disclaimer?: boolean }) {
  const [data, setData] = useState<PaneBody | null | 'failed'>(null);
  useEffect(() => {
    let live = true;
    fetch(paneSrc(handle)).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: PaneBody) => { if (d.v !== PAYLOAD_V) throw new Error('payload version'); if (live) setData(d); })
      .catch(() => live && setData('failed'));
    return () => { live = false; };
  }, [handle]);
  // F-23 (user test, UX 4): announced like the loading line, and the link never breaks before its arrow.
  if (data === 'failed') return <p className="muted small sheet-wait" role="status">The record could not be loaded. <a href={`/u/${handle}`} style={{ whiteSpace: 'nowrap' }}>See full profile<span aria-hidden="true"> →</span></a></p>;
  if (!data) return <p className="muted small sheet-wait" role="status">Loading <bdi>{name}</bdi>’s record…</p>;
  return <ProfilePane handle={handle} name={name} model={data.model} chart={data.chart} now={new Date()} state={data.state} highlight={highlight} back={false} disclaimer={disclaimer} status={data.status ?? undefined} options={data.options} />;
}
