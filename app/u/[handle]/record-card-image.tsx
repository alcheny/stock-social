// F-4 · The record card, drawn for next/og (Satori: flexbox only, inline SVG for the line). The only JSX of the card:
// the link unfurl (opengraph-image.tsx) and the Share button's square / story picture (story/route.tsx) both draw it,
// from the pure model in lib/record-card.ts, with the sizes in CARD_LAYOUT. A losing record uses this same layout and
// the same sizes; only the colors of the headline and the line follow the sign.
// Committee round 1: the chart, the count and the period lead (count and period at 1.5× body, in the text color); the
// trust state is an outlined badge (Demo in its own tone, as strong as Verified); "New record" is a badge at the count's
// size; the evidence label shares the trust line's row; the 0% label sits in a gutter left of the line.
import { CARD_LAYOUT, disclaimerLines, noOrphan, UNFURL_COLUMN_GAP, type CardModel } from '@/lib/record-card.ts';

const C = { bg: '#0b0b0f', text: '#f4f4f6', muted: '#a1a1ad', up: '#22c55e', down: '#f43f5e', warn: '#f59e0b', demo: '#38bdf8', base: '#6b6b78' };
const TONE = { ok: C.up, muted: C.muted, warn: C.warn, demo: C.demo };
const one = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } as const;
const col = { display: 'flex', flexDirection: 'column' } as const;
const row = { display: 'flex', alignItems: 'center' } as const;

export function RecordCardImage({ m, disclaimer }: { m: CardModel; disclaimer: string }) {
  const L = CARD_LAYOUT[m.kind];
  const f = L.font;
  const lh = m.kind === 'unfurl' ? 1.1 : 1.15;
  const t = (size: number, color: string = C.text, extra: object = {}) => ({ fontSize: size, lineHeight: lh, color, ...extra });
  const big = (size: number, color: string = C.text, extra: object = {}) => ({ fontSize: size, lineHeight: 1, color, whiteSpace: 'nowrap', ...extra }) as const;
  const pill = (text: string, size: number, color: string) => (
    <span style={{ ...t(size, color), border: `3px solid ${color}`, borderRadius: 999, padding: '4px 16px', flexShrink: 0, whiteSpace: 'nowrap' }}>{text}</span>
  );
  const handleOnly = m.name === `@${m.handle}`;
  const headColor = m.headlineTone === 'up' ? C.up : m.headlineTone === 'down' ? C.down : C.text;
  const who = (
    <div style={{ ...row, alignItems: 'baseline', gap: 16, flex: 1, minWidth: 0, overflow: 'hidden' }}>
      {/* When the row is short (badges, a long name), the handle gives way first, then the name. */}
      <span style={{ ...t(f.name), ...one, flexShrink: 1, minWidth: 0 }}>{m.name}</span>
      {!handleOnly && <span style={{ ...t(f.handle, C.muted), ...one, flexShrink: 1000, minWidth: 0 }}>@{m.handle}</span>}
    </div>
  );
  const badge = pill(m.label, f.label, TONE[m.tone]);
  const newRecord = m.newRecord ? pill('New record', f.newRecord, C.text) : null;

  // The plot: the gutter holds the 0% label (never under the line), the dashed 0% baseline, one line.
  const c = m.chart;
  const plot = c && (() => {
    const labelH = f.zero * lh;
    const labelTop = Math.min(Math.max(c.zeroY - labelH / 2, 0), c.h - labelH);
    const labelLeft = L.bleed ? L.padX : 0;
    return (
      <div style={{ ...col, marginLeft: L.bleed ? -L.padX : 0 }}>
        <div style={{ display: 'flex', position: 'relative', width: c.w, height: c.h }}>
          <svg width={c.w} height={c.h} viewBox={`0 0 ${c.w} ${c.h}`}>
            <line x1={labelLeft + c.labelW + 4} x2={c.w} y1={c.zeroY} y2={c.zeroY} stroke={C.base} strokeWidth={2} strokeDasharray="8 8" />
            <path d={c.d} fill="none" stroke={c.down ? C.down : C.up} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span style={{ ...t(f.zero, C.muted), position: 'absolute', left: labelLeft, top: labelTop, width: c.labelW }}>0%</span>
        </div>
        <span style={t(f.body, C.muted, { marginLeft: L.bleed ? L.padX : 0, marginTop: 2 })}>{m.caption}</span>
      </div>
    );
  })();
  const count = (
    <div style={col}>
      <span style={big(f.line)}>{m.countValue}</span>
      <span style={t(f.body)}>{m.countNote}</span>
    </div>
  );
  const period = (
    <div style={col}>
      <span style={big(f.line)}>{m.periodLength}</span>
      <span style={{ ...t(f.body), whiteSpace: 'nowrap' }}>{m.periodSince}</span>
    </div>
  );
  const average = [
    <span key="h" style={big(f.headline, headColor, { letterSpacing: -2 })}>{m.headline}</span>,
    <div key="w" style={col}>
      <span style={t(f.body, C.muted)}>{m.headlineLabel}</span>
      {m.range && <span style={{ ...t(f.body), whiteSpace: 'nowrap' }}>{m.range}</span>}
    </div>,
  ];

  let main;
  if (m.body !== null) {
    main = <span style={t(m.kind === 'unfurl' ? 72 : 88)}>{m.body}</span>;
  } else if (m.kind === 'unfurl') {
    main = (
      <div style={{ display: 'flex', gap: UNFURL_COLUMN_GAP }}>
        <div style={{ ...col, width: L.left }}>
          {average}
          {count}
          {period}
        </div>
        {plot}
      </div>
    );
  } else {
    main = (
      <div style={{ ...col, gap: L.gap }}>
        <div style={m.kind === 'square' ? { ...row, gap: 28 } : col}>{average}</div>
        {plot}
        <div style={{ display: 'flex', gap: 48 }}>{count}{period}</div>
      </div>
    );
  }

  const head = m.kind === 'unfurl'
    ? <div style={{ ...row, justifyContent: 'space-between', gap: 16 }}>{who}<div style={{ ...row, gap: 12, flexShrink: 0 }}>{newRecord}{badge}</div></div>
    : (
      <div style={{ ...col, gap: L.gap }}>
        <div style={{ ...row, justifyContent: 'space-between', gap: 24 }}>
          <span style={{ ...t(f.brand), fontWeight: 700, flexShrink: 0 }}>Stock Social</span>
          {badge}
        </div>
        <div style={{ ...row, justifyContent: 'space-between', gap: 16 }}>{who}{newRecord}</div>
      </div>
    );

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: `${L.padTop}px ${L.padX}px ${L.padBottom}px`, background: C.bg, color: C.text, fontFamily: 'sans-serif' }}>
      <div style={{ ...col, gap: L.gap }}>
        {head}
        {m.note && <span style={t(f.body, TONE[m.tone])}>{m.note}</span>}
      </div>
      {main}
      <div style={col}>
        {m.trust && <span style={t(f.body)}>{noOrphan(`${m.evidence} · ${m.trust}`)}</span>}
        {m.link && <span style={t(f.body, C.muted)}>{m.link}</span>}
        {disclaimerLines(disclaimer || m.disclaimer).map((line) => <span key={line} style={t(f.disclaimer, C.muted)}>{line}</span>)}
      </div>
    </div>
  );
}
