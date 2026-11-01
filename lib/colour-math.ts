// Colour maths (F-20: moved verbatim from lib/fixes-cycle2-a11y.test.ts so every contrast and colour-vision test shares
// one set of values): a TypeScript port of docs/direction/design-system-2026-11-01-scripts/a11ylib.py. Its self-checks
// (21:1, the CIEDE2000 published pairs, the spec's numbers) stay in lib/fixes-cycle2-a11y.test.ts.
// ---- colour maths: a port of a11ylib.py (WCAG 2.x; 2009 dichromat matrices on linear sRGB, quantised; CIEDE2000) ----
export type RGB = [number, number, number];
export const hx = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
export const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const unlin = (c: number) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
export const lumRGB = (v: RGB) => { const [r, g, b] = v.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string, b: string) => { const x = lumRGB(hx(a)), y = lumRGB(hx(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// CSS color-mix(in srgb, fg p, bg) over an opaque bg (sRGB-encoded mix, as browsers do).
export const mix = (fg: string, bg: string, p: number) => { const f = hx(fg), b = hx(bg); return `#${f.map((x, i) => Math.round((p * x + (1 - p) * b[i]) * 255).toString(16).padStart(2, '0')).join('')}`; };
export const M = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
} as const;
export type Kind = keyof typeof M;
export const KINDS = Object.keys(M) as Kind[];
export const QUANTISE = true; // as a11ylib.py: the spec's numbers round the simulated colour to 8-bit sRGB
export function sim(h: string, kind: Kind): RGB {
  const v = hx(h).map(lin);
  const o = M[kind].map((row) => unlin(row[0] * v[0] + row[1] * v[1] + row[2] * v[2]));
  return (QUANTISE ? o.map((c) => Math.round(c * 255) / 255) : o) as RGB;
}
export function lab(v: RGB): RGB {
  const [r, g, b] = v.map(lin);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export const rad = (d: number) => (d * Math.PI) / 180, deg = (r: number) => (r * 180) / Math.PI;
export function de00Lab([L1, a1, b1]: RGB, [L2, a2, b2]: RGB): number {
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = ((deg(Math.atan2(b1, a1p)) % 360) + 360) % 360, h2p = ((deg(Math.atan2(b2, a2p)) % 360) + 360) % 360;
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp: number;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp: number;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbp = (h1p + h2p + 360) / 2;
  else hbp = (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos(rad(hbp - 30)) + 0.24 * Math.cos(rad(2 * hbp)) + 0.32 * Math.cos(rad(3 * hbp + 6)) - 0.20 * Math.cos(rad(4 * hbp - 63));
  const dth = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dth)) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}
export const cvd = (a: string, b: string) => Object.fromEntries(KINDS.map((k) => [k, de00Lab(lab(sim(a, k)), lab(sim(b, k)))])) as Record<Kind, number>;
export const cvdMin = (a: string, b: string) => Math.min(...Object.values(cvd(a, b)));
