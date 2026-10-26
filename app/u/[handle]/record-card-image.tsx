// F-4 · The record card, drawn for next/og (Satori: flexbox only, inline SVG for the line). The only JSX of the card:
// the link unfurl (opengraph-image.tsx) and the Share button's square / story picture (story/route.tsx) both draw it,
// from the pure model in lib/record-card.ts, with the sizes in CARD_LAYOUT. A losing record uses this same layout and
// the same sizes; only the colors of the headline and the line follow the sign.
import { CARD_LAYOUT, UNFURL_COLUMN_GAP, type CardModel } from '@/lib/record-card.ts';

const C = { bg: '#0b0b0f', text: '#f4f4f6', muted: '#a1a1ad', up: '#22c55e', down: '#f43f5e', warn: '#f59e0b', base: '#6b6b78' };
const TONE = { ok: C.up, muted: C.muted, warn: C.warn };
const one = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } as const;
const col = { display: 'flex', flexDirection: 'column' } as const;

function Line({ m, fontSize }: { m: CardModel; fontSize: number }) {
  const c = m.chart!;
  const color = c.down ? C.down : C.up;
  // 0% on the axis (CH-1): the label sits on the baseline at the left, above it unless the baseline is at the top.
  const labelTop = c.zeroY < fontSize * 1.2 + 6 ? c.zeroY + 4 : c.zeroY - fontSize * 1.2 - 4;
  return (
    <div style={{ display: 'flex', position: 'relative', width: c.w, height: c.h }}>
      <svg width={c.w} height={c.h} viewBox={`0 0 ${c.w} ${c.h}`}>
        <line x1={0} x2={c.w} y1={c.zeroY} y2={c.zeroY} stroke={C.base} strokeWidth={2} strokeDasharray="8 8" />
        <path d={c.d} fill="none" stroke={color} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span style={{ position: 'absolute', left: 0, top: labelTop, fontSize, lineHeight: 1.2, color: C.muted }}>0%</span>
    </div>
  );
}

// `disclaimer` is passed by each image route itself (POLICY F3, lib/share.test.ts reads every route for it).
export function RecordCardImage({ m, disclaimer }: { m: CardModel; disclaimer: string }) {
  const L = CARD_LAYOUT[m.kind];
  const f = L.font;
  const text = (size: number, color: string = C.text, extra: object = {}) => ({ fontSize: size, lineHeight: 1.2, color, ...extra });
  const handleOnly = m.name === `@${m.handle}`;
  const headColor = m.headlineTone === 'up' ? C.up : m.headlineTone === 'down' ? C.down : C.text;
  const evidence = m.evidence ? `${m.evidence}${m.newRecord ? ' · New record' : ''}` : null;

  const big = <span style={text(f.headline, headColor, { lineHeight: 1, letterSpacing: -2 })}>{m.headline}</span>;
  const words = [
    m.range && <span key="r" style={text(f.sub)}>{m.range}</span>,
    evidence && <span key="e" style={text(f.sub, C.muted)}>{evidence}</span>,
  ];
  const facts = [
    <span key="c" style={text(f.line)}>{m.count}</span>,
    <span key="p" style={text(f.line, C.muted)}>{m.period}</span>,
  ];
  const chart = m.chart && (
    <div style={col}>
      <Line m={m} fontSize={f.sub} />
      <span style={text(f.sub, C.muted, { marginTop: 2 })}>{m.caption}</span>
    </div>
  );

  let main;
  if (m.body !== null) {
    main = <span style={text(m.kind === 'unfurl' ? 72 : 88)}>{m.body}</span>;
  } else if (m.kind === 'unfurl') {
    // Text column beside the chart: headline + "average per trade", the range, the evidence, the count, the period.
    main = (
      <div style={{ display: 'flex', gap: UNFURL_COLUMN_GAP }}>
        <div style={{ ...col, width: L.left }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 6 }}>
            {big}
            <span style={text(f.sub, C.muted)}>{m.headlineLabel}</span>
          </div>
          {words}
          <div style={{ ...col, marginTop: 8 }}>{facts}</div>
        </div>
        {chart}
      </div>
    );
  } else if (m.kind === 'square') {
    // Headline with its words beside it, then the chart, then the count and the period.
    main = (
      <div style={{ ...col, gap: L.gap }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {big}
          <div style={col}>
            <span style={text(f.sub, C.muted)}>{m.headlineLabel}</span>
            {words}
          </div>
        </div>
        {chart}
        <div style={col}>{facts}</div>
      </div>
    );
  } else {
    main = (
      <div style={{ ...col, gap: L.gap }}>
        <div style={col}>
          {big}
          <span style={text(f.sub, C.muted, { marginTop: 8 })}>{m.headlineLabel}</span>
          {words}
        </div>
        {chart}
        <div style={col}>{facts}</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: `${L.padTop}px ${L.padX}px ${L.padBottom}px`, background: C.bg, color: C.text, fontFamily: 'sans-serif' }}>
      <div style={col}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24 }}>
          <span style={text(f.brand, C.text, { fontWeight: 700 })}>Stock Social</span>
          <span style={text(f.label, TONE[m.tone], one)}>{m.label}</span>
        </div>
        {m.note && <span style={text(f.line, TONE[m.tone])}>{m.note}</span>}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, maxWidth: L.width - 2 * L.padX }}>
          <span style={text(f.name, C.text, one)}>{m.name}</span>
          {!handleOnly && <span style={text(f.handle, C.muted, one)}>@{m.handle}</span>}
        </div>
      </div>

      {main}

      <div style={col}>
        {m.trust && <span style={text(f.trust)}>{m.trust}</span>}
        {m.link && <span style={text(f.line, C.muted)}>{m.link}</span>}
        <span style={text(f.disclaimer, C.muted, { marginTop: 4 })}>{disclaimer || m.disclaimer}</span>
      </div>
    </div>
  );
}
