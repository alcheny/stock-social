// F-34 · the open block on the 1200×630 trade and month images (docs/features/logs/F-34/plan.md §3, §3a). With open
// positions the strip's lines gain the open rows (lib/copy.ts#imageRows) and this first-fit search places them: the
// record rows step from 35 px to 30/28/26 px, never below the open values; the disclaimer stays at 28 px or more;
// "record frozen" is never dropped; a separate last pass (step 11) may drop only the "Disconnected ‹date›" row and the
// failed-note rows, which the page and the alt keep. Images without open positions never come here (byte-identical).
// Copy-free: every text it adds is passed in (lib/record-strip.ts#openImageBand). Not in lib/open-split.ts, whose test
// pins that module's literals to the tone names.
import type { ImageLine } from './record-strip.ts';

export type OpenBandStep = {
  last: boolean; r: number; o: number; g: number; disc: number; a: number; b: number; extra: boolean;
  losses: 'own' | 'count'; note: 1 | 2; options: 'own' | 'count'; frozen: 'rows' | 'asOf' | 'label';
};
// The search order (§3), outer loop first; `hero` sizes are per image (trade: symbol 80 → 40, held 30 → 26; month: label
// 52 → 26, never below the record rows, figures 30 → 26).
export const OPEN_BAND_STEPS = [
  { step: 11, axis: 'last', values: [false, true] },
  { step: 1, axis: 'r', values: [30, 28, 26] },
  { step: 2, axis: 'extra', values: [true, false] },
  { step: 3, axis: 'disc', values: [35, 32, 30, 28] },
  { step: 4, axis: 'hero', values: [] },
  { step: 5, axis: 'losses', values: ['own', 'count'] },
  { step: 6, axis: 'note', values: [2, 1] },
  { step: 7, axis: 'options', values: ['own', 'count'] },
  { step: 8, axis: 'frozen', values: ['rows', 'asOf', 'label'] },
  { step: 9, axis: 'o', values: [30, 28, 26] },
  { step: 10, axis: 'g', values: [4, 3, 2] },
] as const;
const axis = <K extends (typeof OPEN_BAND_STEPS)[number]['axis']>(k: K) => OPEN_BAND_STEPS.find((s) => s.axis === k)!.values as readonly never[];

export type BandGeometry = { width: number; top: number; bottom: number; glyph: number; lineHeight: number; minPx: number };
export type OpenBandInput = {
  base: (x: { disc: number; a: number; b: number; extra: boolean }) => ImageLine[]; // today's band lines (no open rows)
  rows: (size: number) => string[] | null; // lib/copy.ts#imageRows for this line and the band width
  asOf: string; // the image as-of words, to find the row that ends with them
  losses: string; failedShort: string;
  heroSteps: [number, number][];
  hasNote: boolean; hasFrozen: boolean;
  band: BandGeometry;
};
export type OpenBand = { lines: ImageLine[]; fits: boolean; tooWide: string[]; step: OpenBandStep };

const REC = ['count', 'average', 'range', 'early'];
const WRAPPED = ['open', 'note', 'frozen', 'disclaimer'];
const blockOf = (role: string) => (role.startsWith('open') ? 'open' : role.replace(/\d+$/, ''));
const gapAfter = (a: ImageLine, b: ImageLine) => !(blockOf(a.role) === blockOf(b.role) && WRAPPED.includes(blockOf(a.role)));

export function openBandTransform(base: ImageLine[], st: OpenBandStep, i: Omit<OpenBandInput, 'base' | 'heroSteps'>): ImageLine[] | null {
  const { width, glyph } = i.band;
  const fitPx = (t: string, max: number) => Math.min(max, Math.floor(width / (Math.max(t.length, 1) * glyph)));
  const fits = (t: string, s: number) => t.length * s * glyph <= width;
  if (st.o < st.r) return null;
  let ls = base.filter((l) => l.role !== 'losses').map((l) => (REC.includes(l.role) ? { ...l, size: Math.min(l.size, st.r, fitPx(l.text, st.r)) } : l));
  if (ls.some((l) => REC.includes(l.role) && l.size < 26)) return null;
  const rows = i.rows(st.o);
  if (!rows) return null;
  const block: ImageLine[] = rows.map((t, k) => ({ role: `open${k}`, text: t, size: st.o, tone: 'text', weight: k === 0 ? 700 : 400, block: 'open' }));
  // Options: its own row (capped at o) or joined to the count row.
  const oi = ls.findIndex((l) => l.role === 'options');
  if (oi >= 0) {
    if (st.options === 'own') ls[oi] = { ...ls[oi], size: Math.min(ls[oi].size, st.o) };
    else {
      const c = ls.findIndex((l) => l.role === 'count');
      if (c < 0) return null;
      const text = `${ls[c].text} · ${ls[oi].text}`, size = Math.min(ls[c].size, fitPx(text, ls[c].size));
      if (size < 26) return null;
      ls[c] = { ...ls[c], text, size };
      ls = ls.filter((_, j) => j !== oi);
    }
  } else if (st.options === 'count') return null;
  // "losses included": its own row at o, or joined to the count row (between 26 px and o).
  const k = Math.max(...[...REC, 'options'].map((r) => ls.findIndex((l) => l.role === r)));
  let losses: ImageLine[] = [];
  if (st.losses === 'own') losses = [{ role: 'losses', text: i.losses, size: st.o, tone: 'muted', weight: 400 }];
  else {
    const c = ls.findIndex((l) => l.role === 'count' || l.role === 'early');
    if (c < 0) return null;
    const text = `${ls[c].text} · ${i.losses}`, size = Math.min(ls[c].size, fitPx(text, ls[c].size));
    if (size < 26 || size > st.o) return null;
    ls[c] = { ...ls[c], text, size };
  }
  ls.splice(k + 1, 0, ...losses, ...block);
  // The failed note: two rows, or the one-row form.
  const n0 = ls.findIndex((l) => l.role === 'note0');
  if (st.note === 1) {
    if (n0 < 0 || ls[n0].tone !== 'warn') return null;
    ls = ls.filter((l) => l.role !== 'note1');
    ls[n0] = { ...ls[n0], text: i.failedShort, size: 26 };
  }
  // The frozen line: "Disconnected ‹date›" / "record frozen"; "record frozen" may ride the as-of row or the label row.
  const f1 = ls.findIndex((l) => l.role === 'frozen1');
  if (st.frozen !== 'rows') {
    if (f1 < 0) return null;
    const rf = ls[f1].text;
    if (st.frozen === 'asOf') {
      const a = ls.findIndex((l) => l.role.startsWith('open') && l.text.endsWith(i.asOf));
      if (a < 0) return null;
      const text = `${ls[a].text} · ${rf}`;
      if (!fits(text, ls[a].size)) return null;
      ls[a] = { ...ls[a], text };
    } else {
      const lb = ls.findIndex((l) => l.role === 'label');
      if (lb < 0) return null;
      const text = `${ls[lb].text} · ${rf}`, size = Math.min(ls[lb].size, fitPx(text, ls[lb].size));
      if (size < 26) return null;
      ls[lb] = { ...ls[lb], text, size };
    }
    ls = ls.filter((l) => l.role !== 'frozen1');
  }
  // The frozen and note rows never give way, except in the last pass (the "Disconnected" row and the failed note only).
  ls = ls.map((l) => (l.role.startsWith('frozen') || l.role.startsWith('note') ? { ...l, optional: false } : l));
  if (st.last) ls = ls.map((l) => ((l.role === 'frozen' && st.frozen !== 'rows') || (l.role.startsWith('note') && l.tone === 'warn') ? { ...l, optional: true } : l));
  return ls;
}

// Height with the block-aware gaps: `g` between blocks, none inside a wrapped block (the line height spaces it).
function height(ls: ImageLine[], g: number, lh: number) {
  let gaps = 0;
  for (let k = 1; k < ls.length; k++) if (gapAfter(ls[k - 1], ls[k])) gaps++;
  return ls.reduce((x, l) => x + l.size * lh, 0) + g * gaps;
}

// The first fit of steps 1–10 at every size; step 11 only after that whole search fails. null if nothing fits.
export function openBand(i: OpenBandInput): OpenBand | null {
  const { band } = i, room = band.bottom - band.top;
  for (const last of axis('last') as readonly boolean[])
    for (const r of axis('r') as readonly number[])
      for (const extra of axis('extra') as readonly boolean[])
        for (const disc of axis('disc') as readonly number[])
          for (const [a, b] of i.heroSteps) {
            if (b < band.minPx || a < r) continue;
            const base = i.base({ disc, a, b, extra }); // once per hero size: the inner steps only transform it
            for (const losses of axis('losses') as readonly ('own' | 'count')[])
              for (const note of (i.hasNote ? axis('note') : [2]) as readonly (1 | 2)[])
                for (const options of axis('options') as readonly ('own' | 'count')[])
                  for (const frozen of (i.hasFrozen ? axis('frozen') : ['rows']) as readonly ('rows' | 'asOf' | 'label')[])
                    for (const o of axis('o') as readonly number[])
                      for (const g of axis('g') as readonly number[]) {
                        const step: OpenBandStep = { last, r, o, g, disc, a, b, extra, losses, note, options, frozen };
                        const ls = openBandTransform(base, step, i);
                        if (!ls) continue;
                        let cur = ls;
                        const dropped: string[] = [];
                        while (height(cur, g, band.lineHeight) > room && cur.some((l) => l.optional)) {
                          const k = cur.findLastIndex((l) => l.optional);
                          dropped.push(cur[k].role);
                          cur = cur.filter((_, j) => j !== k);
                        }
                        const tooWide = cur.filter((l) => l.text.length * l.size * band.glyph > band.width);
                        if (height(cur, g, band.lineHeight) > room || tooWide.length) continue;
                        if (!last && dropped.some((d) => d.startsWith('frozen') || d.startsWith('note'))) continue;
                        let y = band.top;
                        const lines = cur.map((l, k) => {
                          if (k && gapAfter(cur[k - 1], l)) y += g;
                          const p = { ...l, y };
                          y += l.size * band.lineHeight;
                          return p;
                        });
                        return { lines, fits: true, tooWide: [], step };
                      }
          }
  return null;
}
