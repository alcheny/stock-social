"""Demo colour candidates (spec section 2.2): contrast on the V-1 ink base and the CVD distance to every meaning
colour, with the one threshold the spec uses (minimum ΔE00 >= 9 under each simulated dichromacy). Also prints the
same distances under the two method variants the spec does not use, to show why the method is stated once.

Run from anywhere:  python3 -I docs/direction/design-system-2026-11-01-scripts/demo.py
Python 3 standard library only; reads and writes no files.
"""
import os, sys
sys.dont_write_bytecode = True  # leave no __pycache__ beside the spec
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from a11ylib import cr, cvd

THRESHOLD = 9.0
P = {'light': dict(bg='#f6f6f3', sf='#ffffff', up='#0b6b70', down='#b2441b', focus='#2152d9', warn='#8a5a00'),
     'dark': dict(bg='#0f1114', sf='#181b20', up='#3cc4b4', down='#ff8a5b', focus='#86a8ff', warn='#f2b84b')}
C = {'plum': ('#8a2b7f', '#e79ddd'), 'tuned plum': ('#6e1f66', '#f0b8e8'),
     'sky': ('#0369a1', '#38bdf8'), 'violet': ('#6d28d9', '#a78bfa')}
for name, (light, dark) in C.items():
    worst = []
    for scheme, h in (('light', light), ('dark', dark)):
        p = P[scheme]
        cells = []
        for k in ('up', 'down', 'focus', 'warn'):
            n, m, kind, _ = cvd(h, p[k])
            worst.append(m)
            cells.append(f'{k} {n:.1f} / {m:.1f} ({kind})')
        print(f'{name:10s} {scheme:5s} {h}  bg {cr(h, p["bg"]):.2f} sf {cr(h, p["sf"]):.2f} | ' + ' | '.join(cells))
    print(f'{"":10s} minimum {min(worst):.1f} -> {"passes" if min(worst) >= THRESHOLD else "fails"} >= {THRESHOLD}')

print('\nMethod variants, Demo vs gain (light), minimum over the three dichromacies:')
for name, h in (('tuned plum', '#6e1f66'), ('plum', '#8a2b7f')):
    a = cvd(h, '#0b6b70')
    b = cvd(h, '#0b6b70', quantise=False)
    c = cvd(h, '#0b6b70', linear=False, quantise=False)
    print(f'  {name}: linear sRGB, 8-bit {a[1]:.2f} ({a[2]}); linear, unrounded {b[1]:.2f}; '
          f'gamma-encoded sRGB {c[1]:.2f} ({c[2]})')
