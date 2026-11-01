// F-12 (image crop test): a minimal PNG decoder for the share images' pixel checks, with node:zlib only (no new
// dependency). Reads what next/og writes: 8-bit RGB or RGBA, not interlaced, every filter type. Test-side only: no
// route imports it.
// ponytail: palette, grey, 16-bit and interlaced PNGs are refused — add them here if an image renderer ever writes one.
import { inflateSync } from 'node:zlib';

export type Png = { width: number; height: number; data: Uint8Array }; // data: RGBA, row-major

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];

export function decodePng(buf: Uint8Array): Png {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length < 8 || SIG.some((v, i) => b[i] !== v)) throw new Error('not a PNG');
  let off = 8, width = 0, height = 0, ch = 0;
  const idat: Buffer[] = [];
  while (off + 8 <= b.length) {
    const len = b.readUInt32BE(off), type = b.toString('ascii', off + 4, off + 8), data = b.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error(`unsupported bit depth ${data[8]}`);
      if (data[9] !== 6 && data[9] !== 2) throw new Error(`unsupported colour type ${data[9]}`);
      if (data[12] !== 0) throw new Error('interlaced PNG not supported');
      ch = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!ch) throw new Error('PNG without IHDR');
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const cur = new Uint8Array(stride), prev = new Uint8Array(stride);
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, up = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let p = 0;
      if (f === 1) p = a;
      else if (f === 2) p = up;
      else if (f === 3) p = (a + up) >> 1;
      else if (f === 4) { const q = a + up - c, pa = Math.abs(q - a), pb = Math.abs(q - up), pc = Math.abs(q - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      cur[i] = (row[i] + p) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4, s = x * ch;
      out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = ch === 4 ? cur[s + 3] : 255;
    }
    prev.set(cur);
  }
  return { width, height, data: out };
}

export const pixel = (p: Png, x: number, y: number): [number, number, number, number] => {
  const o = (y * p.width + x) * 4;
  return [p.data[o], p.data[o + 1], p.data[o + 2], p.data[o + 3]];
};
