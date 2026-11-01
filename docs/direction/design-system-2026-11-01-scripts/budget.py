"""Card-1 height estimate at 360x740 from line heights (spec section 4.3), worst case: signed out, demo card,
first-visit line, frozen, open-positions line, long thesis. Widths from the inline DejaVu table in widths.py.

Run from anywhere:  python3 -I docs/direction/design-system-2026-11-01-scripts/budget.py
Python 3 standard library only; reads and writes no files.
"""
import os, sys
sys.dont_write_bytecode = True  # leave no __pycache__ beside the spec
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from widths import R, B, w
def lines(t, first, rest, px=14, f=R):
    out, cur, lw = [], '', first
    for wd in t.split(' '):
        tt = (cur + ' ' + wd).strip()
        if w(tt, f, px) <= lw: cur = tt
        else: out.append(cur); cur = wd; lw = rest
    return len(out) + 1
M = '−'; L14 = 14 * 1.45; L16 = 16 * 1.5
fv = 'Closed trades imported read-only from connected broker accounts. Losses included. Demo records are marked Demo. How records are calculated →'
n_fv = lines(fv, 252, 304)
rl = 'Verified  41 closed trades · +38.0% average per trade, likely between +30.0% and +45.0%'
n_rl = lines(rl, 320, 320)  # feed card content box is 320 px at 360 (spec 2.8)
disc = 'Not investment advice. Past performance does not guarantee future results.'
items = [('top padding (fixed nav)', 64), (f'first-visit Notice {n_fv} lines + 24 padding', n_fv*L14 + 24), ('gap', 12),
         ('header row: avatar, name, handle, menu', 44), ('gap', 8), ('hero figure, max 70.4 px, lh 1', 70.4), ('gap', 8),
         (f'record line led by the badge, {n_rl} lines (24 px badge in a 20 px line +4)', n_rl*L14 + 4),
         ('Held N days · closed date', L14), ('Disconnected date (frozen fixture)', L14), ('F-6 open line', L14), ('gap', 12),
         ('UserNote: label line + thesis clamped 2 lines + 16 padding', L14 + 2*L16 + 16), ('gap', 12),
         (f'in-view disclaimer {lines(disc,328,328)} lines', lines(disc, 328, 328)*L14), ('bottom padding', 28)]
tot = 0
for k, v in items: tot += v; print(f'  {v:6.1f}  {k}')
print(f'  total {tot:.0f} of 740; spare {740-tot:.0f}; with the 78 px undo bar (Notice hidden): {tot - (n_fv*L14+24+12) + 78:.0f}')
held = dict(items)['Held N days · closed date']
print(f'  post-review: F-10 puts the record line in place of "held · closed": total {tot - held:.0f}, spare {740 - tot + held:.0f}')
