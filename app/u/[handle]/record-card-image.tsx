// F-4 · The record card, drawn for next/og (Satori: flexbox only, inline SVG for the line). The only JSX of the card:
// the link unfurl (opengraph-image.tsx) and the Share button's square / story picture (story/route.tsx) both draw it,
// from the pure model in lib/record-card.ts, with the sizes in CARD_LAYOUT. A losing record uses this same layout and
// the same sizes; only the colors of the headline and the line follow the sign.
// F-4 rework (2026-11-01): the chart caption takes its own full-width row (it no longer fits beside the unfurl's
// chart); F-6: the open positions in words, in their own row at the same size whether they gain or lose.
// Committee round 1: the chart, the count and the period lead (count and period at 1.5× body, in the text color); the
// trust state is an outlined badge (Demo in its own tone, as strong as Verified); "New record" is a badge at the count's
// size; the evidence label shares the trust line's row; the 0% label sits in a gutter left of the line.
import { CARD_LAYOUT, disclaimerLines, noOrphan, UNFURL_COLUMN_GAP, unfurlHeadlineSize, unfurlWide, type CardModel } from '@/lib/record-card.ts';

const C = { bg: '#0b0b0f', text: '#f4f4f6', muted: '#a1a1ad', up: '#22c55e', down: '#f43f5e', warn: '#f59e0b', demo: '#38bdf8', base: '#6b6b78' };
const TONE = { ok: C.up, muted: C.muted, warn: C.warn, demo: C.demo };
const one = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } as const;
const col = { display: 'flex', flexDirection: 'column' } as const;
const row = { display: 'flex', alignItems: 'center' } as const;

export function RecordCardImage({ m, disclaimer }: { m: CardModel; disclaimer: string }) {
  const L = CARD_LAYOUT[m.kind];
  const f = L.font;
  const lh = L.lh;
  const t = (size: number, color: string = C.text, extra: object = {}) => ({ fontSize: size, lineHeight: lh, color, ...extra });
  const big = (size: number, color: string = C.text, extra: object = {}) => ({ fontSize: size, lineHeight: 1, color, whiteSpace: 'nowrap', ...extra }) as const;
  const pill = (text: string, size: number, color: string) => (
    <span style={{ ...t(size, color), border: `3px solid ${color}`, borderRadius: 999, padding: '2px 16px', flexShrink: 0, whiteSpace: 'nowrap' }}>{text}</span>
  );
  const handleOnly = m.name === `@${m.handle}`;
  const headColor = m.headlineTone === 'up' ? C.up : m.headlineTone === 'down' ? C.down : C.text;
  const who = (
    <div style={{ ...row, alignItems: 'baseline', gap: 16, flex: 1, minWidth: 0, overflow: 'hidden' }}>
      {/* User test 2026-11-01: the @handle is the card's one unique identity (anyone can pick any display name), so it
          always shows in full; when the row is short only the display name gives way. */}
      {/* A trader with no display name shows the handle here: then it never truncates either (code review). */}
      <span style={handleOnly ? { ...t(f.name), whiteSpace: 'nowrap', flexShrink: 0 } : { ...t(f.name), ...one, flexShrink: 1, minWidth: 0 }}>{m.name}</span>
      {!handleOnly && <span style={{ ...t(f.handle, C.muted), whiteSpace: 'nowrap', flexShrink: 0 }}>@{m.handle}</span>}
    </div>
  );
  const badge = pill(m.label, f.label, TONE[m.tone]);
  const newRecord = m.newRecord ? pill('New record', f.newRecord, C.text) : null;
  const toneColor = (tone: 'up' | 'down' | 'flat') => (tone === 'up' ? C.up : tone === 'down' ? C.down : C.text);
  const lineColor = toneColor(m.headlineTone ?? 'flat'); // the line agrees with the headline it sums to

  // F-6: "3 open, unrealized · 2 up, 1 down · lowest -8.0%, highest +12.1%", each percent in its own sign's color (the
  // words carry the meaning; the color only repeats it). Never clipped: a held loser is never hidden.
  const o = m.open;
  // `lead`: whether words come before the spread on its row (no indent before "at 0.0%" when nothing does).
  const gap = (on: boolean) => ({ marginLeft: on ? '0.28em' : 0 });
  const spread = (lead: boolean) => o && (o.low === o.high
    ? [<span key="a" style={gap(lead)}>at</span>, <span key="l" style={{ color: toneColor(o.lowTone), ...gap(true) }}>{o.low}</span>]
    : [<span key="a" style={gap(lead)}>lowest</span>, <span key="l" style={{ color: toneColor(o.lowTone), ...gap(true) }}>{o.low}</span>,
      <span key="c">,</span>, <span key="b" style={gap(true)}>highest</span>, <span key="h" style={{ color: toneColor(o.highTone), ...gap(true) }}>{o.high}</span>]);
  const openRow = (size: number, short: boolean) => {
    if (!o) return null;
    const words = [short ? o.shortTitle : '', o.split].filter(Boolean).join(' · ');
    return (
      <div style={{ ...row, flexWrap: 'wrap', ...t(size), lineHeight: 1 }}>
        {words && <span>{`${words} ·`}</span>}{spread(!!words)}
      </div>
    );
  };
  // The note sits on the title's row (it wraps under it only if the row is full), so the block is two rows high and
  // the worst case (failed note, New record, 12 positions) keeps every row (UX test, round 2).
  const openBlock = o && (
    <div style={col}>
      <div style={{ ...row, alignItems: 'baseline', flexWrap: 'wrap', gap: 16 }}>
        <span style={big(f.line)}>{o.title}</span>
        <span style={{ ...t(f.body, C.muted), whiteSpace: 'nowrap' }}>{o.note}</span>
      </div>
      {openRow(f.body, false)}
    </div>
  );

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
            <path d={c.d} fill="none" stroke={lineColor} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span style={{ ...t(f.zero, C.muted), position: 'absolute', left: labelLeft, top: labelTop, width: c.labelW }}>0%</span>
        </div>
        {m.kind !== 'unfurl' && <span style={t(f.body, C.muted, { marginLeft: L.bleed ? L.padX : 0, marginTop: 2, whiteSpace: 'nowrap' })}>{m.caption}</span>}
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
    // The number never shrinks under its label (QA 2026-11-01: "+0.3%average"); the label column wraps instead.
    <span key="h" style={big(f.headline, headColor, { flexShrink: 0 })}>{m.headline}</span>,
    <div key="w" style={{ ...col, flexShrink: 1, minWidth: 0 }}>
      <span style={t(f.body, C.muted)}>{m.headlineLabel}</span>
      {m.range && <span style={t(f.body)}>{m.range}</span>}
    </div>,
  ];
  // The unfurl's left column: the label beside the number on two lines ("average per" / "closed trade"), the range
  // under them; every row one line high (lineHeight 1) so the column fits beside the chart with every element kept.
  // Only the long label ("average per closed trade") takes two lines; "average per trade" stays on one. A number of 7
  // or more characters ("+100.0%") leaves too little room beside it, so its label goes under it on one line.
  const one1 = (size: number, color: string = C.text) => ({ fontSize: size, lineHeight: 1, color, whiteSpace: 'nowrap' }) as const;
  // Orchestrator review: a long average or range widens the text column (the model narrows the chart by the same
  // width, lib/record-card.ts#unfurlWide), the label then takes two lines beside the number, and an average of 8 or more
  // characters is drawn smaller (unfurlHeadlineSize): the column never gains a row, so nothing below it is pushed off.
  const wide = unfurlWide(m.headline, m.range);
  // Breathing room around the range and before the count (user test), except where the 630 px card has none to spare:
  // two extra rows (failed-import note and open positions) or a wide card.
  const tight = !!(m.note && o) || wide;
  const [labelA, labelB] = m.open || wide || m.shareLabel /* OPTIONS */ ? (m.headlineLabel ?? '').split(/(?<=per) /) : [m.headlineLabel];
  const unfurlAverage = (
    <div style={col}>
      <div style={{ ...row, gap: 20 }}>
        <span style={big(unfurlHeadlineSize(m.headline), headColor, { flexShrink: 0 })}>{m.headline}</span>
        <div style={{ ...col, flexShrink: 0 }}>
          <span style={one1(f.body, C.muted)}>{labelA}</span>
          {labelB && <span style={one1(f.body, C.muted)}>{labelB}</span>}
        </div>
      </div>
      {m.range && <span style={{ ...one1(f.body), marginTop: tight ? 0 : 4 }}>{m.range}</span>}
    </div>
  );

  let main;
  if (m.body !== null) {
    // An empty record with open positions (F-6) still shows its unrealized part, at the body's size.
    main = (
      <div style={{ ...col, gap: L.gap * 3 }}>
        <span style={t(o ? f.line : m.kind === 'unfurl' ? 72 : 88)}>{m.body}</span>
        {openBlock}
      </div>
    );
  } else if (m.kind === 'unfurl') {
    // Only the text-and-chart row may ever give way (it never should: see unfurlWide); the caption and the
    // open-positions row never shrink, so a held loser is never clipped (orchestrator review).
    main = (
      <div style={{ ...col, flexShrink: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', gap: UNFURL_COLUMN_GAP, flexShrink: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ ...col, width: L.width - 2 * L.padX - UNFURL_COLUMN_GAP - (m.chart?.w ?? L.chart.w), flexShrink: 0 }}>
            {unfurlAverage}
            <div style={{ ...col, marginTop: tight ? 0 : 10 }}><span style={big(f.line)}>{m.countValue}</span><span style={one1(f.body)}>{m.countNote}</span></div>
            <div style={col}><span style={big(f.line)}>{m.periodLength}</span><span style={one1(f.body)}>{m.periodSince}</span></div>
          </div>
          {plot}
        </div>
        {/* OPTIONS: the options line takes the caption's row (two lines at most; the model gave the chart's row up). */}
        {m.optionsLine
          ? <span style={{ ...t(f.body, C.muted), lineHeight: 1, marginTop: 4, flexShrink: 0 }}>{m.optionsLine}</span>
          : <span style={{ ...t(f.body, C.muted), lineHeight: 1, whiteSpace: 'nowrap', marginTop: 4, flexShrink: 0 }}>{m.caption}</span>}
        {o && <div style={{ display: 'flex', marginTop: L.gap, flexShrink: 0 }}>{openRow(f.body, true)}</div>}
      </div>
    );
  } else {
    main = (
      <div style={{ ...col, gap: L.gap }}>
        <div style={m.kind === 'square' ? { ...row, gap: 28 } : col}>{average}</div>
        {plot}
        <div style={{ display: 'flex', gap: 48 }}>{count}{period}</div>
        {m.optionsLine && <span style={t(f.body, C.muted)}>{m.optionsLine}</span>/* OPTIONS */}
        {openBlock}
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
      <div style={{ ...col, gap: L.gap, flexShrink: 0 }}>
        {head}
        {m.note && <span style={t(f.body, TONE[m.tone])}>{m.note}</span>}
      </div>
      {/* If an extreme record ever overflows, the middle gives way, never the trust line or the disclaimer (POLICY F3). */}
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 1, minHeight: 0, overflow: 'hidden' }}>{main}</div>
      <div style={{ ...col, flexShrink: 0 }}>
        {m.trust && <span style={t(f.body)}>{noOrphan(`${m.evidence} · ${m.trust}`)}</span>}
        {m.link && <span style={t(f.body, C.muted)}>{m.link}</span>}
        {disclaimerLines(disclaimer || m.disclaimer).map((line) => <span key={line} style={t(f.disclaimer)}>{line}</span>)}
      </div>
    </div>
  );
}
