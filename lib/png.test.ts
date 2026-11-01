// F-12 (image crop test): lib/png.ts decodes the PNGs next/og writes, with node:zlib only. Each test builds a PNG by hand
// with one filter type per row, so every un-filter path (0 None, 1 Sub, 2 Up, 3 Average, 4 Paeth) is checked against
// the pixels it was built from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { decodePng, pixel } from './png.ts';

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
}
const paeth = (a: number, b: number, c: number) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };

// rows: raw pixel bytes per row; filters: the filter type to apply to each row.
function encode(w: number, h: number, bpp: 3 | 4, rows: number[][], filters: number[]) {
  const stride = w * bpp;
  const out: number[] = [];
  for (let y = 0; y < h; y++) {
    const f = filters[y], cur = rows[y], prev = y ? rows[y - 1] : new Array(stride).fill(0);
    out.push(f);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
      out.push((cur[i] - pred) & 0xff);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = bpp === 4 ? 6 : 2;
  const z = deflateSync(Buffer.from(out));
  // Split IDAT in two, as encoders may.
  const half = Math.floor(z.length / 2);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', z.subarray(0, half)), chunk('IDAT', z.subarray(half)), chunk('IEND', Buffer.alloc(0))]);
}

const rnd = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 256);

for (const bpp of [4, 3] as const) {
  test(`png: every filter type decodes to the pixels it was built from (${bpp === 4 ? 'RGBA' : 'RGB'})`, () => {
    const w = 7, h = 10, r = rnd(bpp);
    const rows = Array.from({ length: h }, () => Array.from({ length: w * bpp }, r));
    const png = encode(w, h, bpp, rows, [0, 1, 2, 3, 4, 4, 3, 2, 1, 0]);
    const img = decodePng(png);
    assert.equal(img.width, w);
    assert.equal(img.height, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [R, G, B, A] = pixel(img, x, y);
      const o = x * bpp;
      assert.deepEqual([R, G, B, A], [rows[y][o], rows[y][o + 1], rows[y][o + 2], bpp === 4 ? rows[y][o + 3] : 255], `pixel ${x},${y}`);
    }
  });
}

test('png: refuses what it does not read (not a PNG, 16-bit, interlaced, palette)', () => {
  assert.throws(() => decodePng(Buffer.from('not a png at all')), /PNG/);
  const base = encode(1, 1, 4, [[1, 2, 3, 4]], [0]);
  const variant = (at: number, v: number) => {
    const b = Buffer.from(base);
    b[16 + at] = v; // IHDR data starts at byte 16
    // Re-sign the IHDR chunk so only the field is wrong.
    b.writeUInt32BE(crc(b.subarray(12, 29)), 29);
    return b;
  };
  assert.throws(() => decodePng(variant(8, 16)), /bit depth/);
  assert.throws(() => decodePng(variant(9, 3)), /colour type/);
  assert.throws(() => decodePng(variant(12, 1)), /interlaced/);
});
