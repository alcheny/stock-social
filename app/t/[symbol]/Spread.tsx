import { spreadCaption, type Spread as SpreadData } from '@/lib/ticker.ts';

const X0 = 16, W = 328, COL = W / 12, BASE = 120, TOP = 14;
const colX = (i: number) => X0 + i * COL;
// Percent -> x on a 12-column axis: columns 0 and 11 are the open bins, 1..10 the 10-point bins. Clamped for position only.
const posX = (p: number) => (p < -50 ? colX(0) + COL / 2 : p >= 50 ? colX(11) + COL / 2 : colX(1) + ((p + 50) / 100) * (COL * 10));

// Pure SVG, server-rendered, no JS. The one text source is spreadCaption(); losses and gains share one height scale.
// `shared` (compare page) forces one mode and one bar scale across sides; `bare` drops the section and h2 so the parent owns the outline.
export default function Spread({ spread, returns, symbol, demoOnly, mixed, shared, bare }: { spread: SpreadData; returns: number[]; symbol: string; demoOnly: boolean; mixed: boolean; shared?: { dots: boolean; maxCount: number }; bare?: boolean }) {
  const caption = spreadCaption(spread);
  const dots = shared ? shared.dots : spread.n < 10;
  const maxCount = shared ? Math.max(1, shared.maxCount) : Math.max(1, ...spread.bins.map((b) => b.count));
  const hatch = `spread-hatch-${symbol.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  const Wrap = bare ? 'div' : 'section';
  const zeroX = colX(6);
  const med = spread.median === null ? null : posX(spread.median);
  const stacks = new Map<number, number>();
  return (
    <Wrap {...(bare ? {} : { 'aria-label': 'Outcome spread' })}>
      {!bare && <h2>How the trades turned out</h2>}
      <p className="muted small" style={{ marginTop: 0 }}>{dots ? 'Each dot is one trade.' : 'Each bar counts trades in a 10-point range.'}</p>
      {demoOnly && <p role="note" className="muted small">Sample data, not from a real broker.</p>}
      {mixed && <p role="note" className="muted small">Includes sample data marked Demo.</p>}
      <svg className="spread" viewBox="0 0 360 170" role="img" aria-label={caption} data-symbol={symbol}>
        <title>{caption}</title>
        <defs>
          <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" strokeWidth="2" />
          </pattern>
        </defs>
        {[0, 11].map((i) => (
          <rect key={i} x={colX(i)} y={TOP} width={COL} height={BASE - TOP} fill={`url(#${hatch})`} stroke="var(--muted)" strokeWidth="1.5" opacity="0.35" />
        ))}
        <line x1={X0} y1={BASE} x2={X0 + W} y2={BASE} stroke="var(--line)" strokeWidth="1" />
        {!dots && spread.bins.map((b, i) => {
          const h = b.count ? Math.max(2, (b.count / maxCount) * (BASE - TOP - 8)) : 0;
          const fill = i < 6 ? 'var(--down)' : 'var(--up)';
          return h
            ? <rect key={i} x={colX(i) + 2} y={BASE - h} width={COL - 4} height={h} fill={fill} opacity="0.85" />
            : <line key={i} x1={colX(i) + 2} y1={BASE - 0.5} x2={colX(i) + COL - 2} y2={BASE - 0.5} stroke="var(--muted)" strokeWidth="1" />;
        })}
        {dots && returns.map((r, i) => {
          const x = posX(r);
          const k = stacks.get(x) ?? 0;
          stacks.set(x, k + 1);
          return <circle key={i} cx={x} cy={BASE - 6 - k * 11} r="5" fill={r < 0 ? 'var(--down)' : r > 0 ? 'var(--up)' : 'var(--muted)'} opacity="0.85" />;
        })}
        <line x1={zeroX} y1={TOP} x2={zeroX} y2={BASE + 4} stroke="var(--text)" strokeWidth="1.5" />
        {med !== null && (
          <g>
            <polygon points={`${med - 5},${TOP - 2} ${med + 5},${TOP - 2} ${med},${TOP + 6}`} fill="var(--text)" />
            <text x={Math.min(Math.max(med, X0 + 20), X0 + W - 20)} y={TOP - 4} textAnchor="middle" fontSize="11" fill="var(--text)">median</text>
          </g>
        )}
        <g fontSize="11" fill="var(--muted)" textAnchor="middle">
          <text x={colX(1)} y={BASE + 16}>-50%</text>
          <text x={zeroX} y={BASE + 16} fill="var(--text)">0%</text>
          <text x={colX(11)} y={BASE + 16}>+50%</text>
          <text x={colX(0) + COL / 2} y={BASE + 30}>≤ -50%</text>
          <text x={colX(11) + COL / 2} y={BASE + 30}>≥ +50%</text>
          <text x={(colX(1) + zeroX) / 2} y={BASE + 46}>losses</text>
          <text x={(zeroX + colX(11)) / 2} y={BASE + 46}>gains</text>
        </g>
      </svg>
      <p className="small" data-testid="spread-caption">{caption}</p>
    </Wrap>
  );
}
