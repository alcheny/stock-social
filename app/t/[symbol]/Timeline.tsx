import { timelineCaption, type Timeline as TimelineData } from '@/lib/ticker.ts';
import { Badge } from '../../ui.tsx';

const SLOT = 28, AXIS = 40, TOP = 12, BASE = 112, H = 128;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parts = (month: string) => ({ y: Number(month.slice(0, 4)), m: Number(month.slice(5)) - 1 });
const tableLabel = (month: string) => (month === 'earlier' ? 'Earlier' : `${MONTHS[parts(month).m]} ${parts(month).y}`);

// Pure SVG, server-rendered, no JS. A count chart: no returns, no P&L, no best or worst month. Up and down share one
// count scale; direction is solid vs hatched (not colour), and the palette is neutral, never --up/--down.
export default function Timeline({ timeline, symbol, demoOnly, mixed }: { timeline: TimelineData; symbol: string; demoOnly: boolean; mixed: boolean }) {
  const caption = timelineCaption(timeline);
  const buckets = timeline.buckets.filter((b) => b.month !== 'earlier' || b.n > 0);
  const maxCount = Math.max(1, ...buckets.flatMap((b) => [b.up, b.down]));
  const h = (c: number) => (c ? Math.max(2, (c / maxCount) * (BASE - TOP)) : 0);
  const width = buckets.length * SLOT + 8;
  const firstMonth = buckets.find((b) => b.month !== 'earlier')!.month;
  // Labels are placed by priority (Earlier, quarters, then the first month) and skipped when they would touch one already placed.
  const labels = new Map<number, { text: string; x: number; anchor: 'start' | 'middle' }>();
  const spans: [number, number][] = [];
  const place = (i: number, text: string, anchor: 'start' | 'middle') => {
    const w = text.length * 6.2, c = i * SLOT + SLOT / 2;
    const [a, z] = anchor === 'start' ? [i * SLOT, i * SLOT + w] : [c - w / 2, c + w / 2];
    if (spans.some(([s, e]) => a < e + 4 && z > s - 4)) return;
    spans.push([a, z]);
    labels.set(i, { text, x: anchor === 'start' ? i * SLOT : c, anchor });
  };
  const yr = (p: { m: number; y: number }) => `${MONTHS[p.m]} '${String(p.y).slice(2)}`;
  buckets.forEach((b, i) => { if (b.month === 'earlier') place(i, 'Earlier', 'start'); });
  buckets.forEach((b, i) => { if (b.month !== 'earlier') { const p = parts(b.month); if (p.m % 3 === 0) place(i, p.m === 0 ? yr(p) : MONTHS[p.m], 'middle'); } });
  buckets.forEach((b, i) => { if (b.month === firstMonth) place(i, yr(parts(b.month)), 'middle'); });
  return (
    <section aria-label="Trades by month">
      <h2>By month {demoOnly && <Badge verified={false} />}</h2>
      <p className="muted small" style={{ marginTop: 0 }}>Each pair of bars counts trades that closed in that month. Bars show how many trades, not how much they made.</p>
      {demoOnly && <p role="note" className="muted small">Sample data, not from a real broker.</p>}
      {mixed && <p role="note" className="muted small">Includes sample data marked Demo.</p>}
      <div className="timeline-wrap">
        <svg className="timeline-axis" width={AXIS} height={H} viewBox={`0 0 ${AXIS} ${H}`} aria-hidden="true">
          <g fontSize="11" fill="var(--muted)">
            <text x={AXIS - 6} y={BASE + 4} textAnchor="end">0</text>
            <text x={AXIS - 6} y={TOP + 4} textAnchor="end">{maxCount}</text>
            <text transform={`translate(10 ${(BASE + TOP) / 2}) rotate(-90)`} textAnchor="middle">trades closed</text>
          </g>
        </svg>
        <div className="timeline-scroll" tabIndex={0} role="group" aria-label="Trades by month chart, scrolls sideways" data-testid="timeline-scroll">
          <svg className="timeline" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={caption} data-symbol={symbol}>
            <title>{caption}</title>
            <defs>
              <pattern id="timeline-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="5" stroke="var(--text)" strokeWidth="2" />
              </pattern>
            </defs>
            <line x1={0} y1={BASE} x2={width - 4} y2={BASE} stroke="var(--line)" strokeWidth="1" />
            {buckets.map((b, i) => {
              const x = i * SLOT;
              const hu = h(b.up), hd = h(b.down);
              const label = labels.get(i);
              return (
                <g key={b.month}>
                  {hu > 0 && <rect x={x + 3} y={BASE - hu} width={10} height={hu} fill="var(--text)" opacity="0.75" />}
                  {hd > 0 && <rect x={x + 15} y={BASE - hd} width={10} height={hd} fill="url(#timeline-hatch)" stroke="var(--text)" strokeWidth="1" />}
                  {b.flat > 0 && <line x1={x + 8} y1={BASE - 1} x2={x + 20} y2={BASE - 1} stroke="var(--muted)" strokeWidth="2" />}
                  {b.n === 0 && <line x1={x + 3} y1={BASE - 0.5} x2={x + 25} y2={BASE - 0.5} stroke="var(--muted)" strokeWidth="1" />}
                  {label && <text x={label.x} y={BASE + 16} textAnchor={label.anchor} fontSize="11" fill="var(--muted)">{label.text}</text>}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <p className="muted small timeline-legend" data-testid="timeline-legend">
        <span><svg width="9" height="9" aria-hidden="true"><rect width="9" height="9" fill="var(--text)" opacity="0.75" /></svg> solid = up</span>
        <span><svg width="9" height="9" aria-hidden="true"><rect x="0.5" y="0.5" width="8" height="8" fill="url(#timeline-hatch)" stroke="var(--text)" strokeWidth="1" /></svg> hatched = down</span>
        <span><svg width="12" height="9" aria-hidden="true"><line x1="0" y1="5" x2="12" y2="5" stroke="var(--muted)" strokeWidth="2" /></svg> grey tick = flat</span>
      </p>
      <p className="small" data-testid="timeline-caption">{caption}</p>
      <table className="sr-only" data-testid="timeline-table">
        <caption>Trades closed by month</caption>
        <thead><tr><th>Month</th><th>Up</th><th>Down</th><th>Flat</th><th>Total</th></tr></thead>
        <tbody>
          {timeline.buckets.map((b) => (
            <tr key={b.month}><td>{tableLabel(b.month)}</td><td>{b.up}</td><td>{b.down}</td><td>{b.flat}</td><td>{b.n}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
