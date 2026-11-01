// OPTIONS (docs/features/logs/options/plan.md D5, D6): the option parts of the profile, the SW-1 pane and their
// shared label, as pure components of the model lib/options-load.ts returns (no reads here). Closed gate: the one count
// line. Open gate: the options line, the short and technical lines, the "Option trades" list and the open rows.
// Percent only: no strike, premium, contract count or contract symbol is ever passed in. Plain links (no router
// import), so the surface tests can render them as static markup outside the app.
import type { ReactNode } from 'react';
import { expiryText, OPTIONS } from '@/lib/copy.ts';
import { pct } from '@/lib/trades.ts';
import { closesOf, hasOptions, openOf, shareLabel, type OpenOptionView, type OptionCounts, type OptionHeadline, type OptionTradeView, type PaneOptionsView, isOptionsLine } from '@/lib/options-view.ts';

const sign = (x: number) => (x > 0 ? 'up' : x < 0 ? 'down' : '');
const chip = (right: 'CALL' | 'PUT') => (right === 'CALL' ? OPTIONS.call : OPTIONS.put);
const closedDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** D5 (fix round 3: "Excluding options"): over a headline that leaves options out, whenever the trader has option closes
 *  or exclusions. */
export function ShareTradesLabel({ counts, show }: { counts?: OptionCounts; show?: boolean }) {
  return (show ?? (counts ? shareLabel(counts) : false)) ? <p className="muted small share-label" data-options="label">{OPTIONS.shareLabel}</p> : null;
}

// Fix round 3 (item 9): a figure stays on one line with its word ("36% wins", "-22.0% avg"): each " · " part is one
// unbreakable span, and an "avg" figure carries its sign color (item 11).
export function NowrapLine({ text }: { text: string }) {
  const parts = text.split(' · ');
  return <>{parts.map((p, i) => {
    const avg = /^(.*?)([+\-\u2212\u2248]?\d[\d.,]*%)( avg.*)$/.exec(p);
    return <span key={i}>{i > 0 && ' · '}<span className="nowrap">{avg ? <>{avg[1]}<b className={avg[2].startsWith('-') || avg[2].startsWith('\u2212') || avg[2].startsWith('\u2248') ? 'down' : avg[2].startsWith('+') ? 'up' : ''}>{avg[2]}</b>{avg[3]}</> : p}</span></span>;
  })}</>;
}

/** Fix round 3 (item 6): the gated sentence, then its own short link to /how. */
function GatedLine({ c, small = false }: { c: OptionCounts; small?: boolean }) {
  return <p className={`muted options-gated${small ? ' small' : ''}`} data-options="gated">{OPTIONS.gated(closesOf(c), openOf(c))} <a className="options-how" href="/how#options">{OPTIONS.howLink}</a></p>;
}

/** Fix round 3 (item 2): the options summary as a second stats row at the headline's size, with its own row label. */
export function OptionsGrid({ m, long }: { m: OptionHeadline & { gate: 'open' }; long?: string | boolean }) {
  const s = m.summary;
  if (!s) return null;
  return <section className="stats options-stats" aria-label={OPTIONS.gridLabel(s.n)} data-long={long}>
    <p className="row-label" aria-hidden="true">{OPTIONS.gridLabel(s.n)}</p>
    <div className="stat big"><b>{`${(s.winRate * 100).toFixed(0)}%`}</b><small>win rate</small></div>
    <div className="stat big"><b className={sign(s.avg)}>{pct(s.avg)}</b><small>avg return / trade</small>
      {s.range && <small className="range"><span className="nowrap">{`(${pct(s.range.low)} to ${pct(s.range.high)})`}</span> · 95% range</small>}
    </div>
  </section>;
}

/** D5/D6, fix round 3 (item 3): after the evidence line. Closed: the gated sentence and its link. Open: the options grid,
 *  then the short and technical lines, each on its own line. */
export function OptionsLines({ m, long }: { m: OptionHeadline; long?: string | boolean }) {
  const c = m.counts;
  // Fix round 1 (QA 8): share trades held over an exercise or assignment day are share trades (public words), so their
  // line shows in both gate states; while open it joins the technical line.
  const shares = c.exerciseShares > 0 && (m.gate === 'closed' || c.other === 0) ? <p className="muted options-exercise-shares">{OPTIONS.exerciseShares(c.exerciseShares)}</p> : null;
  if (!hasOptions(c)) return shares;
  if (m.gate === 'closed') {
    return <><GatedLine c={c} />{shares}</>;
  }
  return <div className="options-lines" data-options="open">
    <OptionsGrid m={m} long={long} />
    {c.short + c.openShort > 0 && <p className="muted options-short">{OPTIONS.short(c.short, c.openShort)}</p>}
    {c.other > 0 && <p className="muted options-technical">{OPTIONS.technical(c.other, c.exerciseShares)}</p>}
    {shares}
    {c.openOther > 0 && <p className="muted options-open-other">{OPTIONS.openOther(c.openOther)}</p>}
  </div>;
}

/** D6: one option close. Chip in text, not color; the accessible name reads the whole row. */
// ponytail: K2 no per-trade share card for options (the record card carries the label and the line) — add one with the
// trade page below, percent only.
// ponytail: K3 no option trade page, theses or likes on option trades — build them keyed by option_trades.close_id, as
// closed trades are keyed by sell_id.
export function OptionTradeRow({ t }: { t: OptionTradeView }) {
  const exp = expiryText(t.expiry);
  // Fix round 3 (item 8): the link's accessible name carries the whole row and says where it goes.
  return <li className="option-row">
    <div className="line">
      <span className="option-what"><b><a href={`/t/${encodeURIComponent(t.underlying)}`} className="tap44" aria-label={OPTIONS.rowName(t.underlying, chip(t.right), exp, pct(t.returnPct))}>{t.underlying}</a></b> <span className="chip">{chip(t.right)}</span></span>
      <b className={sign(t.returnPct)}>{pct(t.returnPct)}</b>
    </div>
    {/* L7: a demo row carries the Demo badge (Verified stays the profile's, from its source rows). */}
    <p className="muted small option-meta">closed {closedDay.format(t.closedAt)} · {exp}{!t.verified && <> <span className="badge demo">Demo</span></>}</p>
  </li>;
}

/** D6 (TR-1): "Option trades", newest first, every row reachable in windows of 50 (`start` from ?options=N). */
export const OPTION_WINDOW = 50;
export function OptionTradesSection({ trades, start = 0, handle }: { trades: OptionTradeView[]; start?: number; handle: string }) {
  if (!trades.length) return null;
  const from = Math.min(Math.max(0, start), Math.max(0, trades.length - 1));
  const shown = trades.slice(from, from + OPTION_WINDOW);
  const next = from + OPTION_WINDOW < trades.length ? from + OPTION_WINDOW : null;
  return <section className="option-trades" aria-labelledby="option-trades-h">
    <h2 id="option-trades-h">{OPTIONS.listTitle}</h2>
    {/* Fix round 1 (QA 1): keys by position only (a key reaches the page payload). */}
    <ul className="rows options">{shown.map((t, i) => <OptionTradeRow key={from + i} t={t} />)}</ul>
    {(next !== null || from > 0) && <p className="closes-more">
      {next !== null && <a className="button secondary" href={`/u/${handle}?options=${next}#option-trades-h`}>Show {Math.min(OPTION_WINDOW, trades.length - next)} more</a>}
      {from > 0 && <a className="button secondary" href={`/u/${handle}#option-trades-h`}>Back to the newest</a>}
    </p>}
  </section>;
}

/** D6 (TR-4): long open options as list items of the open block (fix round 3, item 1: one list with the share rows). */
export function OpenOptionItems({ open }: { open: OpenOptionView[] }) {
  return <>{open.map((p, i) => {
    const exp = expiryText(p.expiry);
    // Fix round 1 (QA 1): underlying, expiry and right plus the index; never the contract key (it holds the strike).
    return <li key={`${p.underlying}|${p.expiry}|${p.right}|${i}`} className="option-open">
      <div className="line"><span className="option-what"><b><a href={`/t/${encodeURIComponent(p.underlying)}`} aria-label={OPTIONS.rowName(p.underlying, chip(p.right), exp, `${pct(p.pct)} unrealized`)}>{p.underlying}</a></b> <span className="chip">{chip(p.right)}</span> <span className="muted small nowrap">{exp}</span></span><b className={sign(p.pct)}>{pct(p.pct)}</b></div>
    </li>;
  })}</>;
}
export function OpenOptionRows({ open }: { open: OpenOptionView[] }) {
  if (!open.length) return null;
  return <ul className="rows positions options-open"><OpenOptionItems open={open} /></ul>;
}

/** Fix round 3 (item 1): the open block: one "Open positions" heading, the "as of" line, then one list: share rows
 *  (built by the page) first, option rows after them. Nothing renders without any row. */
export function OpenPositionsBlock({ title, asOf, shareRows, open, hasShares }: { title: string; asOf?: ReactNode; shareRows?: ReactNode; open: OpenOptionView[]; hasShares: boolean }) {
  if (!hasShares && !open.length) return null;
  return <>
    <h2>{title}</h2>
    {asOf}
    <ul className="rows positions">{shareRows}<OpenOptionItems open={open} /></ul>
  </>;
}

/** D6: futures and similar open contracts, counted (not gated: no option term is published). */
export function UnsupportedLine({ counts }: { counts: OptionCounts }) {
  return counts.unsupported > 0 ? <p className="muted options-unsupported">{OPTIONS.unsupported(counts.unsupported)}</p> : null;
}

/** AC 24: the SW-1 pane's part: the rendered line only (the count line, or the options line once open). Fix round 1
 *  (QA 2): it receives the line, never the per-kind counts. */
export function PaneOptions({ v }: { v?: PaneOptionsView }) {
  if (!v?.line) return null;
  const open = isOptionsLine(v.line);
  return <div className="pane-options"><p className={open ? 'options-line small' : 'muted small options-gated'} data-options={open ? 'open' : 'gated'}>{open ? <NowrapLine text={v.line} /> : v.line}</p></div>;
}
