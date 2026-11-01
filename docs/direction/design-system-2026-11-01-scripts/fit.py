"""Fit re-run (spec sections 2.1, 2.5, 2.8, 4.3): hero at 78% of its box with tracking, stat tiles, nav, badges,
StatusLine, first-visit line, image band, card widths. Widths come from the inline DejaVu advance table in widths.py.

Run from anywhere:  python3 -I docs/direction/design-system-2026-11-01-scripts/fit.py
Python 3 standard library only; reads and writes no files.
"""
import os, sys
sys.dont_write_bytecode = True  # leave no __pycache__ beside the spec
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from widths import R, B, w, UPM
M = '−'
ADV = {**{d: .696 for d in '0123456789'}, '+': .838, M: .838, '%': 1.002, '.': .380, ',': .380, '≈': .838}
def fem(s, ls=-0.04): return sum(ADV[c] for c in s) + ls * len(s)
print('table check, Bold advances (em):', {c: round(B.getlength(c)/UPM, 3) for c in '0+%.,' + M + '≈'})
print('\nHERO font-size = min(120px, 22cqi, 78cqi / fig-em), fig-em with -0.04em tracking')
F = ['+12.3%', M+'4.5%', '+0.4%', M+'100.0%', '+999.9%', '+1,235%', '≈'+M+'100.0%', '+12,346%', '+123,457%']
for s in F:
    e = fem(s); row = [f'{s:10s} em {sum(ADV[c] for c in s):.3f} tracked {e:.3f}']
    for box in (320, 280, 520):
        fs = min(120, .22*box, .78*box/e); row.append(f'{box}: {fs:5.1f}px w {fs*e:5.1f} used {fs*e/box:.3f}')
    print(' | '.join(row))
print('\nSTAT TILES: content box 134 px (2 cols at 360), 302 px (full width); 200% text: one column 302 px')
for tok, px in (('num-m', 24), ('num-l', 32)):
    for box in (134, 302):
        print(f'  {tok} {px}px box {box}: longest fit at token size = {.78*box/px:.3f} em (no tracking)')
print('  200% text num-m 48px in 302 box: longest at size', round(.78*302/48, 3), 'em')
for s in ['+12.3%', M+'40.0%', '+123.4%', '+6,123%', '≈'+M+'100.0%', '+12,346%', '+123,457%', '99%']:
    e = sum(ADV.get(c, .696) for c in s)
    print(f'  {s:10s} {e:.3f} em -> 134 box: {min(24, .78*134/e):.1f}px ; 302 box num-l: {min(32, .78*302/e):.1f}px')
print('\nNAV at <=420px: 14.4px, links 600 -> Bold; logo 800 -> Bold, -0.02em; gap 10; 328 px')
logo = w('Stock Social', B, 14.4, -0.02)
for items in (['Stocks', 'Publish your trades'], ['Trades by stock', 'Sign in'], ['Stocks', 'My record', '@' + 'a'*20],
              ['Trades by stock', 'My record', '@' + 'a'*20], ['Trades by stock', 'Account'], ['Trades by stock', 'My record'], ['Trades by stock', 'Me']):
    ws = [w(x, B, 14.4) for x in items]
    print(f'  {items}: logo {logo:.1f} + {[round(x,1) for x in ws]} + gaps {10*len(items)} = {logo+sum(ws)+10*len(items):.1f}')
print('  @20-char handle bold 14.4:', round(w('@'+'m'*20, B, 14.4), 1), '(m)', round(w('@'+'a'*20, B, 14.4), 1), '(a)')
print('\nBADGES 13px Bold + 16 padding + 2 border')
for s in ('Verified', 'Demo', 'New record', 'Early record', 'Verified from broker', 'Public source', 'Public filing', 'Importing record', 'Import did not finish', 'Not verified'):
    print(f'  {s}: {w(s, B, 13)+18:.1f}  (200%: {w(s, B, 26)+18:.1f})')
print('  Demo ring box 9px+4 gap ->', round(w('Demo', B, 13)+18+13, 1))
print('\nSTATUSLINE 14px regular (box 328)')
rows = ['Record since Mar 4, 2025 · Connected: Broker One (2 accounts)', 'Last close Oct 30, 2026 · updated 2 hours ago',
        'Disconnected Oct 30, 2026 · record frozen', 'Record since Mar 4, 2025 · Demo', 'Last close Oct 30, 2026 · not updated since Sep 30, 2026',
        'What Verified means →']
for s in rows: print(f'  {w(s):6.1f} px ({w(s)/328:.2f} lines)  200%: {w(s,R,28):.0f}  {s}')
for s in ('Mar 4, 2025', 'Oct 30, 2026', 'Record since Mar 4, 2025', 'Disconnected Oct 30, 2026'): print(f'  200% {s}: {w(s,R,28):.0f}')
print('\nFIRST VISIT (text box 304 px minus 44+8 dismiss on line 1 = 252 first line)')
fv = 'Closed trades imported read-only from connected broker accounts. Losses included.'
for s in (fv + ' How records are calculated →', fv + ' Demo records are marked Demo. How records are calculated →'):
    W = w(s); print(f'  {W:.0f} px; lines at 304 with dismiss: {1 + max(0, W-252)/304:.2f}')
vd = ("Imported read-only from the trader's broker. Returns are calculated by Stock Social from those trades. Options, short sales, "
      "transfers in and positions with no recorded entry are left out. Verified does not confirm who the trader is, does not show "
      "accounts at other brokers, and is not a measure of skill, an audit or an endorsement by the broker, SnapTrade or anyone else.")
print(f'\nVERIFIED_DEFINITION {len(vd.split())} words, {w(vd):.0f} px at 14 -> {w(vd)/328:.1f} lines; at 16: {w(vd,R,16)/328:.1f}')
rl = '41 closed trades · +38.0% average per trade, likely between +30.0% and +45.0%'
print(f'record line 14px {w(rl):.0f} px ({w(rl)/328:.2f} lines) + badge 76.4+8 = {w(rl)+84.4:.0f} ({(w(rl)+84.4)/328:.2f})')
held = 'Verified  Held 89 days · closed May 30, 2025'
print(f'hero sub-line badge + held: {w("Held 89 days · closed May 30, 2025")+84.4:.0f} px')
print('\nIMAGE 1200x630, content 1072 x 502; figures to <= 90% of 1072 (965) by DejaVu table')
for sym in ('WWWWW', 'AAPL'):
    for fig in (M+'100.0%', '≈'+M+'100.0%', '+12,346%', '+12.3%'):
        figs = fig.replace('≈', '')  # images print 'about'
        pre = 'about ' if '≈' in fig else ''
        pill = w('Verified', B, 40) + 2*16 + 2  # pill at 40 px
        # row = pill + 24 + symbol (0.6 x fs, Bold) + 0.3em gap + [about ]figure (Bold)
        def roww(fs): return pill + 24 + w(sym, B, .6*fs) + .3*fs + w(pre, B, fs) + w(figs, B, fs)
        lo, hi = 10, 160
        for _ in range(40):
            mid = (lo+hi)/2; lo, hi = (mid, hi) if roww(mid) <= 965 else (lo, mid)
        print(f'  {sym} {pre}{figs}: figure {lo:.0f}px row {roww(lo):.0f}')
rlimg = rl + ' · Last close Oct 30, 2026'
print(f'  record line + Last close at 40px: {w(rlimg,R,40):.0f} px -> {w(rlimg,R,40)/1072:.2f} lines; without: {w(rl,R,40)/1072:.2f}')
dl = 'closed Oct 30, 2026 · stocksocial.example/u/trader_handle_twenty'
print(f'  date+link 32px: {w(dl,R,32):.0f} px')
disc = 'Not investment advice. Past performance does not guarantee future results.'
print(f'  disclaimer 35px: {w(disc,R,35):.0f} px -> {w(disc,R,35)/1072:.2f} lines')
fz = 'Disconnected Oct 30, 2026 · record frozen'; dm = 'Demo data, not a real broker record'
print(f'  frozen 35px {w(fz,R,35):.0f}; demo 35px {w(dm,R,35):.0f}')
for fs in (94, 121, 160):
    h = fs*1.0 + 16 + 32*1.25 + 16 + 2*40*1.25 + 35*1.25 + 24 + 2*35*1.25
    print(f'  band height with figure {fs}px (fig, 16, date/link 40, 16, record 2x50, state 44, 24, disclaimer 2x44): {h:.0f} of 502')
print('\nO-4 card pill: "Verified" 35px Bold pill then "Disconnected Oct 12, 2026" 35px regular:', round(w('Disconnected Oct 12, 2026', R, 35)), 'one-line Bold', round(w('Verified · Disconnected Oct 12, 2026', B, 35)))
cr = 'likely between ' + M + '36.5% and +86.9%'
print('card range line nowrap 35?', round(w(cr, R, 35)), '; card headline +12,346% at 96px?', round(w('+12,346%', B, 96)))

print('\nPOST-REVIEW: F-12 square-crop safe column, F-11 absolute date beside "updated"')
def nlines(t, box, px, f=R):
    n, cur = 1, ''
    for wd in t.split(' '):
        tt = (cur + ' ' + wd).strip()
        if w(tt, f, px) <= box: cur = tt
        else: n += 1; cur = wd
    return n
SAFE = 630 - 2 * 32  # centred 630 x 630 square of a 1200 x 630 image, 32 px inner padding
strip = 'Closed trades: 41 · +38.0% average per trade, likely between +30.0% and +45.0% · losses included'
link = "@trader_handle_twenty's record"
for px in (30, 35, 40):
    print(f'  strip {px}px in {SAFE}px: {nlines(strip, SAFE, px)} lines ({w(strip, R, px):.0f} px); '
          f'link {w(link, R, px):.0f} px; disclaimer {nlines(disc, SAFE, px)} lines')
for fs in (94, 121):
    for px in (30, 35):
        lh = px * 1.25
        h = fs + 16 + 40 + 16 + nlines(strip, SAFE, px) * lh + nlines(link, SAFE, px) * lh + lh + 24 + nlines(disc, SAFE, px) * lh
        print(f'  band height, figure {fs}px, strip and disclaimer at {px}px in the safe column: {h:.0f} of 502')
s2 = 'Last close Oct 30, 2026 · updated 2 hours ago (Nov 1, 2026)'
print(f'  StatusLine row 2 with the absolute date, 14px: {w(s2):.1f} px -> {nlines(s2, 328, 14)} lines in 328')
f13 = 'Verified trades, straight from the broker. Losses included. How records are calculated →'
print(f'  F-13 first-visit line + link: {w(f13):.0f} px; lines at 304 with dismiss: {1 + max(0, w(f13)-252)/304:.2f}')
