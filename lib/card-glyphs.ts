// F-4 PR 2 (plan D1/D4): the code points the share card's bundled font (next/og's Geist Regular) can draw. The image
// renderer fetches any glyph its fonts lack from a third-party font service (or an emoji CDN, which crashes the render
// when unreachable), and that cannot be switched off through ImageResponse. So the card never hands it an uncovered
// glyph: every string the card model produces is checked against this list, and a display name outside it shows as
// @handle. lib/card-glyphs.test.ts compares this constant with the font file's cmap, so a Next upgrade that changes the
// font fails a test instead of quietly sending text to another company's servers (POLICY P6).
// Ranges are inclusive [first, last]; a single number is one code point. 726 code points in 112 ranges.
export const CARD_GLYPHS: readonly (number | readonly [number, number])[] = [
  [32, 126], [160, 172], [174, 275], [278, 299], [302, 311], [313, 318], [321, 328], [330, 333], [336, 382], 399, 402,
  [416, 417], [431, 432], [461, 462], [484, 489], [536, 539], 567, 601, 697, 700, [710, 712], [728, 733], [768, 772],
  [774, 780], 786, 795, 803, [806, 808], [821, 824], 923, 937, [955, 956], 960, 969, [1024, 1119], [1122, 1123],
  [1130, 1131], [1138, 1141], [1168, 1171], [1174, 1175], [1178, 1179], [1186, 1187], [1198, 1203], [1206, 1207],
  [1210, 1211], 1216, 1231, [1240, 1241], [1250, 1251], [1256, 1257], [1262, 1263], 3647, [7712, 7713], [7808, 7813],
  7838, [7840, 7929], [8211, 8212], [8216, 8218], [8220, 8222], [8224, 8226], 8230, 8240, [8242, 8243], [8249, 8250],
  8260, 8304, [8308, 8313], [8320, 8329], 8362, 8364, 8369, 8372, 8377, 8381, [8470, 8471], 8482, [8531, 8533],
  [8539, 8542], [8592, 8601], 8605, [8617, 8618], [8624, 8625], [8627, 8629], [8676, 8677], 8679, 8706, 8710, 8719,
  [8721, 8722], 8730, 8734, 8747, 8758, 8776, 8800, [8804, 8805], [9312, 9320], 9450, 9471, [9650, 9651], [9654, 9655],
  [9660, 9661], [9664, 9665], [9674, 9676], 9679, [9785, 9786], [10102, 10110], 12291, 12316, [42891, 42892], 63743,
  [64257, 64258],
];

const SET = new Set<number>(CARD_GLYPHS.flatMap((r) => (typeof r === 'number' ? [r] : Array.from({ length: r[1] - r[0] + 1 }, (_, i) => r[0] + i))));

// True when the font draws every code point of s (so the renderer makes no request for it).
export const covered = (s: string): boolean => [...s].every((ch) => SET.has(ch.codePointAt(0)!));
