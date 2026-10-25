// F-4 PR 2, plan D4 (D1's fix): the card's glyph list equals the bundled font's coverage, so the renderer never asks a
// third-party font service for a glyph. The cmap reader below is test-only (formats 4 and 12, the two the font uses).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { CARD_GLYPHS, covered } from './card-glyphs.ts';

function cmapCoverage(file: string): Set<number> {
  const buf = readFileSync(file);
  const u16 = (o: number) => buf.readUInt16BE(o), u32 = (o: number) => buf.readUInt32BE(o), i16 = (o: number) => buf.readInt16BE(o);
  let cmap = -1;
  for (let i = 0; i < u16(4); i++) { const r = 12 + i * 16; if (buf.toString('latin1', r, r + 4) === 'cmap') cmap = u32(r + 8); }
  assert.ok(cmap > 0, 'the font has a cmap table');
  const cps = new Set<number>();
  for (let i = 0; i < u16(cmap + 2); i++) {
    const off = cmap + u32(cmap + 4 + i * 8 + 4), fmt = u16(off);
    if (fmt === 4) {
      const segX2 = u16(off + 6), ends = off + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ros = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = u16(ends + s * 2), start = u16(starts + s * 2), delta = i16(deltas + s * 2), ro = u16(ros + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          const raw = ro === 0 ? c : u16(ros + s * 2 + ro + (c - start) * 2);
          const glyph = ro !== 0 && raw === 0 ? 0 : (raw + delta) & 0xffff;
          if (glyph !== 0) cps.add(c);
        }
      }
    } else if (fmt === 12) {
      for (let g = 0; g < u32(off + 12); g++) {
        const b = off + 16 + g * 12, s = u32(b), e = u32(b + 4), gid = u32(b + 8);
        for (let c = s; c <= e; c++) if (gid + (c - s) !== 0) cps.add(c);
      }
    }
  }
  return cps;
}

const fontFile = join(dirname(createRequire(import.meta.url).resolve('next/package.json')), 'dist/compiled/@vercel/og/Geist-Regular.ttf');

test('D4: CARD_GLYPHS equals the cmap of the font next/og bundles (a Next upgrade that changes it fails here)', () => {
  const font = cmapCoverage(fontFile);
  const ours = new Set(CARD_GLYPHS.flatMap((r) => (typeof r === 'number' ? [r] : Array.from({ length: r[1] - r[0] + 1 }, (_, i) => r[0] + i))));
  assert.equal(font.size, 726);
  assert.deepEqual([...ours].sort((a, b) => a - b), [...font].sort((a, b) => a - b));
});

test('D4: covered() accepts the card\'s own characters and refuses what the font lacks', () => {
  for (const s of ['Record since Oct 2026 · 19 months', 'likely between −0.1% and +2.7%', '10,000 trades', 'Name…', 'José', 'José', '≈', 'Évelyne Ørsted']) assert.ok(covered(s), s);
  for (const s of ['✓ Maya', '山田', 'مريم', 'Maya 😀', 'A‍B', 'thin space', 'narrow space']) assert.equal(covered(s), false, s);
});
