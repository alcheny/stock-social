"""Shared colour maths for the design system council's numbers (docs/direction/design-system-2026-11-01.md).

Run nothing here directly; tokens.py and demo.py import it. Python 3 standard library only.

Method (stated once in the spec, section 1):
- Contrast: WCAG 2.x relative luminance and contrast ratio.
- Colour-vision deficiency: the published 2009 dichromat simulation matrices at full severity (1.0),
  applied on linear sRGB, clipped to [0, 1], re-encoded and quantised to 8-bit sRGB (QUANTISE below).
- Colour difference: CIEDE2000 on CIELAB (D65).
"""
import math

QUANTISE = True  # 8-bit rounding of the simulated colour; set False to reproduce the unrounded figures


def hx(h):
    if isinstance(h, tuple):
        return h
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def unlin(c):
    c = min(1.0, max(0.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def lum(h):
    r, g, b = (lin(c) for c in hx(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def cr(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def mix(fg, bg, p):
    """CSS color-mix(in srgb, fg p, bg) over an opaque bg (sRGB-encoded mix, as browsers do)."""
    f, b = hx(fg), hx(bg)
    return '#' + ''.join('%02x' % round((p * x + (1 - p) * y) * 255) for x, y in zip(f, b))


M = {  # published 2009 dichromat simulation matrices, severity 1.0
    'protan': ((0.152286, 1.052583, -0.204868), (0.114503, 0.786281, 0.099216), (-0.003882, -0.048116, 1.051998)),
    'deutan': ((0.367322, 0.860646, -0.227968), (0.280085, 0.672501, 0.047413), (-0.011820, 0.042940, 0.968881)),
    'tritan': ((1.255528, -0.076749, -0.178779), (-0.078411, 0.930809, 0.147602), (0.004733, 0.691367, 0.303900)),
}
KINDS = ('protan', 'deutan', 'tritan')


def sim(h, kind, linear=True, quantise=None):
    """Simulated colour. linear=False applies the matrix to gamma-encoded sRGB (the method the spec does not use)."""
    if kind == 'normal':
        return hx(h)
    q = QUANTISE if quantise is None else quantise
    v = [lin(c) for c in hx(h)] if linear else list(hx(h))
    o = [sum(M[kind][i][j] * v[j] for j in range(3)) for i in range(3)]
    o = [unlin(c) for c in o] if linear else [min(1.0, max(0.0, c)) for c in o]
    return tuple(round(c * 255) / 255 for c in o) if q else tuple(o)


def lab(h):
    r, g, b = (lin(c) for c in hx(h))
    X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
    Y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b)
    Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > (6 / 29) ** 3 else t / (3 * (6 / 29) ** 2) + 4 / 29
    fx, fy, fz = f(X), f(Y), f(Z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def de00_lab(c1, c2):
    L1, a1, b1 = c1
    L2, a2, b2 = c2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    if C1p * C2p == 0: dhp = 0
    elif abs(h2p - h1p) <= 180: dhp = h2p - h1p
    elif h2p - h1p > 180: dhp = h2p - h1p - 360
    else: dhp = h2p - h1p + 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0: hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180: hbp = (h1p + h2p) / 2
    elif h1p + h2p < 360: hbp = (h1p + h2p + 360) / 2
    else: hbp = (h1p + h2p - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    dth = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc = 1 + 0.045 * Cbp
    Sh = 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dth)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def de00(a, b): return de00_lab(lab(a), lab(b))


def cvd(a, b, **kw):
    """(normal ΔE00, minimum ΔE00 over the three dichromacies, the deficiency giving the minimum, per-kind dict)."""
    v = {k: de00(sim(a, k, **kw), sim(b, k, **kw)) for k in KINDS}
    m = min(v, key=v.get)
    return de00(a, b), v[m], m, v


# Self-checks: white on black is 21:1; the published CIEDE2000 test data set (2005), pairs 1 and 7.
assert abs(cr('#ffffff', '#000000') - 21) < 1e-9
assert abs(de00_lab((50, 2.6772, -79.7751), (50, 0, -82.7485)) - 2.0425) < 1e-4
assert abs(de00_lab((50, 0, 0), (50, -1, 2)) - 2.3669) < 1e-4
