// F-10 / F-12: the one record strip component (approval council 2026-11-01: never a second strip). Both exports draw what
// lib/record-strip.ts#recordStrip built: RecordStrip as HTML (feed card, trade and month pages), RecordStripImage as the
// inline-styled band of a next/og image. Real text in reading order, never aria-hidden as a whole; the sign is always in
// the text, so nothing is said by colour alone.
import Link from 'next/link';
import { WarnNotice } from './warn-notice.tsx'; // F-27
import { BRAND_BOX, IMAGE, IMAGE_COLOURS, STRIP_BAND, type ImageLine, type Strip, type StripPart } from '@/lib/record-strip.ts';
import type { OpenLine } from '@/lib/copy.ts';
import { OpenLineText } from './open-rows.tsx'; // F-34

function Figures({ parts, open }: { parts: StripPart[]; open?: OpenLine | null }) {
  return parts.map((p, k) => (
    <span key={k} data-part={p.role}>
      {/* The separator stays readable text (user test 2026-11-01: hidden, a screen reader ran "trades+0.9%" together). */}
      {p.sep}
      {p.role === 'average' || p.role === 'early'
        ? <b data-role={p.role} className={p.tone === 'up' || p.tone === 'down' ? p.tone : undefined}>{p.text}</b>
        : p.role === 'open' && open
          // F-34: the open line's own block in the headline figures, right after "losses included", toned values.
          ? <span data-role="open" className="strip-open" data-open-line><OpenLineText parts={open.parts} asOf={open.asOf} /></span>
          : <span data-role={p.role}>{p.text}</span>}
    </span>
  ));
}

// `lead` (feed only, additive, DS-22): what leads the line, the card's trust badge, then a space and the figures.
export function RecordStrip({ strip, lead }: { strip: Strip; lead?: React.ReactNode }) {
  if (strip.surface === 'feed') {
    return <p className="record-strip" data-strip>{lead && <>{lead}{' '}</>}<Figures parts={strip.figures} /></p>;
  }
  if (strip.surface === 'figures') {
    return <p className="record-strip" data-strip-scope="month"><Figures parts={strip.figures} /></p>;
  }
  return (
    <div className="record-strip-block">
      {strip.label && <p className={`small strip-label ${strip.label.tone === 'ok' ? 'up' : 'muted'}`}>{strip.label.text}</p>}
      {strip.note && <WarnNotice role="status">{strip.note}</WarnNotice>}
      {strip.importing
        ? <p role="status" className="muted importing">{strip.importing}</p>
        : <p className="record-strip" data-strip><Figures parts={strip.figures} open={strip.open} /></p>}
      {/* FIXES-LABELS (D-09): the F3 line directly after the figures it qualifies, then the link. */}
      {strip.disclaimer && <p className="muted small" data-disclaimer>{strip.disclaimer}</p>}
      {strip.link && <p><Link href={strip.link.href}>{strip.link.text}</Link></p>}
    </div>
  );
}

// The image band: every line absolutely placed at the y lib/record-strip.ts#layoutBand gave it, inside x 309–891, one line
// each (no wrap, no ellipsis: the layout model checks the widths). The brand box is the one thing outside the band.
// `disclaimer` (POLICY F3, as RecordCardImage takes it): the band's disclaimer lines must spell it in full, or the image
// is not drawn at all.
export function RecordStripImage({ lines, disclaimer }: { lines: ImageLine[]; disclaimer?: string }) {
  if (disclaimer !== undefined && lines.filter((l) => l.role.startsWith('disclaimer')).map((l) => l.text).join(' ') !== disclaimer) {
    throw new Error('RecordStripImage: the band does not carry the disclaimer in full');
  }
  return (
    <div style={{ width: IMAGE.width, height: IMAGE.height, display: 'flex', position: 'relative', background: IMAGE.bg, color: IMAGE_COLOURS.text, fontFamily: 'sans-serif' }}>
      <span style={{ position: 'absolute', left: BRAND_BOX.x, top: BRAND_BOX.y, fontSize: BRAND_BOX.size, fontWeight: 800, lineHeight: STRIP_BAND.lineHeight }}>{BRAND_BOX.text}</span>
      {lines.map((l) => (
        <span key={l.role} data-role={l.role} style={{
          position: 'absolute', left: STRIP_BAND.x, top: l.y ?? 0, width: STRIP_BAND.width, fontSize: l.size, lineHeight: STRIP_BAND.lineHeight,
          fontWeight: l.weight, color: IMAGE_COLOURS[l.tone], whiteSpace: 'nowrap', overflow: 'hidden',
          ...(l.spans ? { display: 'flex' } : {}),
        }}>{l.spans ? l.spans.map((x, k) => <span key={k} style={{ color: IMAGE_COLOURS[x.tone], whiteSpace: 'pre' }}>{x.text}</span>) : l.text}</span>
      ))}
    </div>
  );
}
