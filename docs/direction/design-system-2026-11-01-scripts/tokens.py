"""Token re-run: contrast (WCAG 2.x) and CVD distance (2009 dichromat matrices, CIEDE2000) for every token pair on
today's base and on the V-1 ink base. Numbers behind spec sections 2.1, 2.2, 2.8 and 5.1.

Run from anywhere:  python3 -I docs/direction/design-system-2026-11-01-scripts/tokens.py
Python 3 standard library only; reads and writes no files.
"""
import os, sys
sys.dont_write_bytecode = True  # leave no __pycache__ beside the spec
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from a11ylib import cr, sim, de00, mix, cvd, KINDS as K
FIX = dict(  # fix tokens, identical on both bases
  L=dict(up='#0b6b70', down='#b2441b', control='#7c818b', focus='#2152d9', demo='#6e1f66', demobg='#f8eef6', warn='#8a5a00', warnbg='#fdf3df'),
  D=dict(up='#3cc4b4', down='#ff8a5b', control='#6f7682', focus='#86a8ff', demo='#f0b8e8', demobg='#2a1a28', warn='#f2b84b', warnbg='#2a2213'))
BASE = {
 'today': dict(L=dict(bg='#fafafa', sf='#ffffff', text='#111118', muted='#6b6b78', line='#e5e5ea', accent='#6d28d9', onacc='#ffffff', oldup='#15803d', olddown='#be123c'),
               D=dict(bg='#0b0b0f', sf='#16161d', text='#f4f4f6', muted='#8b8b98', line='#262631', accent='#a78bfa', onacc='#0b0b0f', oldup='#22c55e', olddown='#f43f5e')),
 'ink':   dict(L=dict(bg='#f6f6f3', sf='#ffffff', text='#15171c', muted='#585e69', line='#dedfda', accent='#15171c', onacc='#ffffff'),
               D=dict(bg='#0f1114', sf='#181b20', text='#eceef1', muted='#9aa1ac', line='#2a2e35', accent='#eceef1', onacc='#0f1114')),
}
for bn, B in BASE.items():
  for s in ('L', 'D'):
    P = dict(B[s]); P.update(FIX[s]); P['s2'] = mix(P['text'], P['sf'], 0.06)
    print(f'== {bn} {s}  surface-2 = {P["s2"]}')
    for t in ('text', 'muted', 'line', 'control', 'up', 'down', 'focus', 'demo', 'warn', 'accent'):
      print(f'  {t:8s} bg {cr(P[t],P["bg"]):5.2f} sf {cr(P[t],P["sf"]):5.2f} s2 {cr(P[t],P["s2"]):5.2f}')
    print(f'  s2 vs bg {cr(P["s2"],P["bg"]):.2f} vs sf {cr(P["s2"],P["sf"]):.2f}')
    print(f'  demo on demobg {cr(P["demo"],P["demobg"]):.2f}; demobg vs bg {cr(P["demobg"],P["bg"]):.2f}; warn on warnbg {cr(P["warn"],P["warnbg"]):.2f}; text on warnbg {cr(P["text"],P["warnbg"]):.2f}')
    print(f'  on-accent on accent {cr(P["onacc"],P["accent"]):.2f}')
    for p in (0.10, 0.12):
      for base in ('bg', 'sf'):
        ut = mix(P['up'], P[base], p); dt = mix(P['down'], P[base], p)
        print(f'  tint {int(p*100)}% over {base}: up {cr(P["up"],ut):.2f} down {cr(P["down"],dt):.2f} muted/downtint {cr(P["muted"],dt):.2f} control/downtint {cr(P["control"],dt):.2f}')
    # gain/loss
    ul = [de00(sim(P['up'], k), sim(P['down'], k)) for k in K]
    print(f'  ink up vs down: normal {de00(P["up"],P["down"]):.1f} cvdmin {min(ul):.1f} lumratio {cr(P["up"],P["down"]):.2f}')
    if 'oldup' in P:
      ol = {k: de00(sim(P['oldup'], k), sim(P['olddown'], k)) for k in K}
      print('  today up vs down cvd', {k: round(v, 1) for k, v in ol.items()})
    w = cvd(P['warn'], P['down']); print(f'  warn vs down normal {w[0]:.1f} min {w[1]:.1f} ({w[2]})  lum {cr(P["warn"],P["down"]):.2f}')
    for o in ('up', 'down', 'focus', 'warn', 'text', 'accent'):
      r = cvd(P['demo'], P[o]); print(f'  demo vs {o:6s}: n {r[0]:.1f} min {r[1]:.1f} ({r[2]}); lum {cr(P["demo"],P[o]):.2f}')
    if bn == 'today':
      for o in ('oldup', 'olddown'):
        r = cvd(P['demo'], P[o]); print(f'  demo vs today {o}: min {r[1]:.1f} ({r[2]}); lum {cr(P["demo"],P[o]):.2f}')
    r = cvd(P['focus'], P['accent']); print(f'  focus vs accent: n {r[0]:.1f} min {r[1]:.1f}')
    # focus ring
    print(f'  FOCUS blue: with 2px offset (ring sits on parent bg): vs bg {cr(P["focus"],P["bg"]):.2f} vs sf {cr(P["focus"],P["sf"]):.2f} vs s2 {cr(P["focus"],P["s2"]):.2f}')
    print(f'  FOCUS blue: no offset vs accent button fill {cr(P["focus"],P["accent"]):.2f}; vs secondary (sf) {cr(P["focus"],P["sf"]):.2f}; vs control border {cr(P["focus"],P["control"]):.2f}; vs up line {cr(P["focus"],P["up"]):.2f} down {cr(P["focus"],P["down"]):.2f}')
    print(f'  FOCUS = accent (interim): vs bg {cr(P["accent"],P["bg"]):.2f} vs sf {cr(P["accent"],P["sf"]):.2f}; no offset vs accent button 1.00')
    print(f'  :target inset 3px focus bar vs sf {cr(P["focus"],P["sf"]):.2f} vs bg {cr(P["focus"],P["bg"]):.2f}')
    print(f'  old :target accent14% over bg: down {cr(P["down"],mix(P["accent"],P["bg"],.14)):.2f} up {cr(P["up"],mix(P["accent"],P["bg"],.14)):.2f} muted {cr(P["muted"],mix(P["accent"],P["sf"],.14)):.2f}')
# lum range demo vs up/down across both bases
print('== images (dark)')
for bgn, bg in (('today card #0b0b0f', '#0b0b0f'), ('ink card #0f1114', '#0f1114')):
  print(f'  {bgn}: ink up {cr("#3cc4b4",bg):.2f} ink down {cr("#ff8a5b",bg):.2f} demo {cr("#f0b8e8",bg):.2f} demo-bg {cr("#f0b8e8","#2a1a28"):.2f} grey a3aab5 {cr("#a3aab5",bg):.2f} control 6f7682 {cr("#6f7682",bg):.2f} today card up 22c55e {cr("#22c55e",bg):.2f}')
for nm, u, d in (('today card', '#22c55e', '#f43f5e'), ('ink up/down', '#3cc4b4', '#ff8a5b')):
  print(f'  {nm}: demo vs up min {cvd("#f0b8e8",u)[1]:.1f} vs down min {cvd("#f0b8e8",d)[1]:.1f}; sky 38bdf8 vs up min {cvd("#38bdf8",u)[1]:.1f}')
print('today light Verified (up on 18% up over bg):', round(cr('#15803d', mix('#15803d', '#fafafa', .18)), 2))
print('today dark Verified (up on 18% over bg):', round(cr('#22c55e', mix('#22c55e', '#0b0b0f', .18)), 2), 'ΔE00 vs gain 0')
print('today .hl line outline L', round(cr('#e5e5ea', '#fafafa'), 2), 'D', round(cr('#262631', '#0b0b0f'), 2))

print('== post-review checks')
for nm, u, d in (('ink light', '#0b6b70', '#b2441b'), ('ink dark', '#3cc4b4', '#ff8a5b'),
                 ('today light', '#15803d', '#be123c'), ('today dark', '#22c55e', '#f43f5e')):
    q = cvd(u, d)[3]; r = cvd(u, d, quantise=False)[3]
    print(f'  gain vs loss {nm}: ' + ', '.join(f'{k} {q[k]:.1f} ({r[k]:.1f} unrounded)' for k in K))
for nm, f, a in (('light', '#2152d9', '#6d28d9'), ('dark', '#86a8ff', '#a78bfa')):
    q = cvd(f, a)[3]; r = cvd(f, a, quantise=False)[3]
    print(f'  focus vs violet {nm}: ' + ', '.join(f'{k} {q[k]:.2f} ({r[k]:.2f} unrounded)' for k in K))
lows = []
for bn, B in BASE.items():
    for s in ('L', 'D'):
        P = dict(B[s]); P.update(FIX[s])
        for p in (0.10, 0.12):
            for base in ('bg', 'sf'):
                for sign in ('up', 'down'):
                    lows.append((cr(P['muted'], mix(P[sign], P[base], p)), bn, s, int(p * 100), base, sign))
lows.sort()
print('  muted on a sign tint, lowest five:', [f'{v:.2f} {bn} {s} {p}% {sign} over {base}' for v, bn, s, p, base, sign in lows[:5]])
print('  muted on a sign tint over surface only, lowest:', [f'{v:.2f} {bn} {s} {p}% {sign}' for v, bn, s, p, base, sign in lows if base == 'sf'][:2])
