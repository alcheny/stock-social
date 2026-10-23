'use client';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { RANGES, nearestIndex, pct, rangeTrades, stepIndex, type RangeKey } from '@/lib/trades.ts';
import { chartSeries, pathD, unpackChart, type PackedChart } from '@/lib/chart-series.ts';
import { count } from '@/lib/format.ts';
import { tradeHref, unpackPoints, type PackedPoint } from '@/lib/paging.ts';

const W = 640, H = 240, T = 16, B = 16;

// CH-1, single-line scrub chart: one line, no axes, header number that follows the cursor, range tabs.
// Green when the range ends at or above its start, red below. The dashed baseline is the range start (0%).
// Scrub with mouse hover, touch-drag (touch-action: pan-y keeps vertical scrolling native) or arrow keys.
// Releasing / leaving / blurring restores the range total. Percent only, same series as equityCurve().
// Without JS the server-rendered ALL line stays; the tabs just do nothing.
// Kept from the trade-linked chart (#14, #21): a transparent overlay of links to each trade's row (hover/focus
// tooltip), and scrub-to-open: releasing a drag, or Enter, opens a sheet with hold time, thesis and a row link.
// F-1 PR-3 fix round 4 (UX lead demand 1): the record arrives packed (lib/paging.ts, list order) and each trade link
// opens the profile window that renders the row (`?closes=N#trade-id`; the anchor alone on the window shown, `current`).
// The per-point links are drawn after hydration only: they were never Tab stops (tabindex -1), and on a heavy record
// they were most of the page's HTML. Without JS, every trade is reached through the paged list.
export function PerformanceChart({ points, chart, now, linkBase = '', current }: { points?: PackedPoint[]; chart?: PackedChart; now: Date; linkBase?: string; current?: number }) {
  // F-1 PR-3 fix round 7 (business lead re-sit, demand 2): the profile passes the whole record (`points`) and draws it
  // at full resolution; the feed pane passes `chart`, each range's series already drawn at screen resolution on the
  // server (lib/chart-series.ts, at most FEED_CHART_POINTS points). Both draw and scrub the same way.
  const trades = useMemo(() => (points ? unpackPoints(points) : null), [points]);
  const packed = useMemo(() => (chart ? unpackChart(chart) : null), [chart]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [range, setRange] = useState<RangeKey>('ALL');
  const [active, setActive] = useState<number | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const dragging = useRef(false);
  const stack = useRef<HTMLDivElement>(null);
  const series = useMemo(() => (packed ? packed[range] : chartSeries(trades ?? [], range, now)), [packed, trades, range, now]);
  const total = packed ? packed.ALL.n : (trades?.length ?? 0);
  const inRange = (key: RangeKey) => (packed ? packed[key].n : rangeTrades(trades ?? [], key, now).length);
  if (total < 2) return null;

  const spec = RANGES.find((r) => r.key === range)!;
  const { pts, t0, t1, last } = series;

  // Scrub points: the range start (0%) then one per close (per kept close in the feed pane).
  const span = t1 - t0;
  const x = (i: number) => (span > 0 ? ((pts[i].at - t0) / span) * W : (i / (pts.length - 1 || 1)) * W);
  const { min, max } = series;
  const pad = (max - min) * 0.08 || 0.01;
  const lo = min - pad, hi = max + pad;
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const f = (n: number) => n.toFixed(1);
  const xs = pts.map((_, i) => x(i));

  // The line runs on to the range end at the last value when the range ends after the last close.
  const tail = span > 0 && t1 > pts[pts.length - 1].at;
  const d = pathD(tail ? [...xs, W] : xs, [...pts.map((p) => y(p.value)), ...(tail ? [y(last)] : [])]);

  const at = active === null ? null : pts[active];
  const shown = at ? at.value : last;
  const sub = at ? new Date(at.at).toLocaleDateString('en-US') + (at.trade ? ` · ${at.trade.symbol}` : '') : spec.label;
  const label = `${count(series.n)} trades, ${pct(last, 0)} total, max drawdown ${pct(-series.drawdown, 0)}`;

  const scrubTo = (e: PointerEvent) => {
    const r = stack.current!.getBoundingClientRect();
    const i = nearestIndex(xs, ((e.clientX - r.left) / r.width) * W);
    setActive(i);
    if (dragging.current) setSel(i);
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (step) {
      const i = stepIndex(active ?? sel ?? (step > 0 ? -1 : pts.length), step, pts.length);
      setActive(i);
      setSel(i);
    } else if (e.key === 'Enter' && sel !== null && pts[sel]?.trade) setOpen(true);
    else if (e.key === 'Escape') { setActive(null); setOpen(false); }
    else return;
    e.preventDefault();
  };
  const pick = (key: RangeKey) => { setRange(key); setActive(null); setSel(null); setOpen(false); };
  const chosen = sel === null ? null : (pts[sel]?.trade ?? null);

  return (
    <figure className={`chart ${last >= 0 ? 'gain' : 'loss'}`}>
      <figcaption>Return if every trade were the same size</figcaption>
      <div className="chart-head" aria-live="polite">
        <b className={`chart-value ${shown >= 0 ? 'up' : 'down'}`}>{pct(shown, 1)}</b>
        <span className="muted"> · {sub}</span>
      </div>
      {series.n === 0 ? (
        <p className="muted chart-empty">No closed trades in this range.</p>
      ) : (
        <div
          className="chart-stack"
          ref={stack}
          tabIndex={0}
          role="group"
          aria-label="Scrub the chart. Use left and right arrows to move."
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); setOpen(false); scrubTo(e); }}
          onPointerMove={(e) => { if (dragging.current || e.pointerType === 'mouse') scrubTo(e); }}
          onPointerUp={() => { dragging.current = false; setActive(null); setOpen(true); }}
          onPointerCancel={() => { dragging.current = false; setActive(null); }}
          onPointerLeave={() => { if (!dragging.current) setActive(null); }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
            <line x1="0" x2={W} y1={f(y(0))} y2={f(y(0))} className="zero" />
            <path d={d} className="curve" />
            {at && <>
              <line x1={f(xs[active!])} x2={f(xs[active!])} y1={T} y2={H - B} className="cursor" />
              <circle cx={f(xs[active!])} cy={f(y(at.value))} r="5" className="dot" />
            </>}
          </svg>
          {mounted && <svg viewBox={`0 0 ${W} ${H}`} className="chart-hit" role="group" aria-label="Chart points: each links to its trade below">
            {pts.map((p, i) => {
              if (!p.trade) return null;
              const cx = xs[i], cy = y(p.value);
              const text = `${p.trade.symbol} ${pct(p.trade.returnPct)}`;
              const tw = text.length * 8 + 12;
              const tx = Math.min(Math.max(cx - tw / 2, 2), W - tw - 2);
              const ty = cy > T + 28 ? cy - 30 : cy + 10;
              return (
                <a key={p.trade.id} tabIndex={-1} href={tradeHref(linkBase, p.trade.id, p.trade.index, current)} aria-label={`${text}, go to trade`}>
                  <circle cx={f(cx)} cy={f(cy)} r="12" className="hit" />
                  <g className="tip" pointerEvents="none">
                    <rect x={f(tx)} y={f(ty)} width={tw} height="22" rx="6" />
                    <text x={f(tx + tw / 2)} y={f(ty + 15)} textAnchor="middle">{text}</text>
                  </g>
                </a>
              );
            })}
          </svg>}
          <span className="zero-label" style={{ top: `${(y(0) / H) * 100}%` }}>0%</span>
        </div>
      )}
      <div className={`sheet${open ? ' open' : ''}`} aria-live="polite">
        {!chosen && <p className="muted" style={{ margin: 0 }}>Drag across the chart to scrub through trades; release to open one.</p>}
        {chosen && (
          <>
            <div className="line">
              <span><b>{chosen.symbol}</b> <span className="muted">{chosen.closedAt.toLocaleDateString('en-US')}</span></span>
              <b className={chosen.returnPct > 0 ? 'up' : 'down'}>{pct(chosen.returnPct)}</b>
            </div>
            {open && (
              <>
                <p className="muted" style={{ margin: '4px 0 0' }}>Held {chosen.holdingDays.toFixed(1)} days</p>
                {chosen.thesis && <p style={{ margin: '4px 0 0' }}>“{chosen.thesis}”</p>}
                <p style={{ margin: '8px 0 0' }}>
                  <a href={tradeHref(linkBase, chosen.id, chosen.index, current)}>Go to trade in list</a>{' '}
                  <button type="button" onClick={() => setOpen(false)}>Close</button>
                </p>
              </>
            )}
          </>
        )}
      </div>
      <div className="tabs" role="group" aria-label="Range">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            aria-pressed={r.key === range}
            disabled={inRange(r.key) === 0}
            onClick={() => pick(r.key)}
          >{r.key}</button>
        ))}
      </div>
    </figure>
  );
}
