// OPTIONS (docs/features/logs/options/plan.md D5, D6): the option parts of the profile, the SW-1 pane and their
// shared label, as pure components of the model lib/options-load.ts returns (no reads here). Closed gate: the one count
// line. Open gate: the options line, the short and technical lines, the "Option trades" list and the open rows.
// Percent only: no strike, premium, contract count or contract symbol is ever passed in. Plain links (no router
// import), so the surface tests can render them as static markup outside the app.
import { expiryText, OPTIONS } from '@/lib/copy.ts';
import { pct } from '@/lib/trades.ts';
import { closesOf, hasOptions, openOf, shareLabel, type OpenOptionView, type OptionCounts, type OptionHeadline, type OptionTradeView, type PaneOptionsView } from '@/lib/options-view.ts';

const sign = (x: number) => (x > 0 ? 'up' : x < 0 ? 'down' : '');
const chip = (right: 'CALL' | 'PUT') => (right === 'CALL' ? OPTIONS.call : OPTIONS.put);
const closedDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** D5: "Share trades" over a headline that reads share trades only, whenever the trader has option closes or exclusions. */
export function ShareTradesLabel({ counts, show }: { counts?: OptionCounts; show?: boolean }) {
  return (show ?? (counts ? shareLabel(counts) : false)) ? <p className="muted small share-label" data-options="label">{OPTIONS.shareLabel}</p> : null;
}

/** D5/D6: under the headline. Closed: the count line, muted, linking to /how. Open: the options line at the headline's
 *  type size, then the short and technical lines, each on its own line. */
export function OptionsLines({ m }: { m: OptionHeadline }) {
  const c = m.counts;
  // Fix round 1 (QA 8): share trades held over an exercise or assignment day are share trades (public words), so their
  // line shows in both gate states; while open it joins the technical line.
  const shares = c.exerciseShares > 0 && (m.gate === 'closed' || c.other === 0) ? <p className="muted options-exercise-shares">{OPTIONS.exerciseShares(c.exerciseShares)}</p> : null;
  if (!hasOptions(c)) return shares;
  if (m.gate === 'closed') {
    return <><p className="muted options-gated" data-options="gated"><a href="/how#options">{OPTIONS.gated(closesOf(c), openOf(c))}</a></p>{shares}</>;
  }
  return <div className="options-lines" data-options="open">
    {m.summary && <p className="options-line">{OPTIONS.lineHead(m.summary.n, `${(m.summary.winRate * 100).toFixed(0)}%`)}<b className={sign(m.summary.avg)}>{pct(m.summary.avg)}</b> avg{m.summary.range ? ` (${pct(m.summary.range.low)} to ${pct(m.summary.range.high)})` : ''}</p>}
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
  return <li className="option-row" aria-label={`${t.underlying} ${chip(t.right).toLowerCase()}, ${exp}, ${pct(t.returnPct)}`}>
    <div className="line">
      <span className="option-what"><b><a href={`/t/${encodeURIComponent(t.underlying)}`} className="tap44">{t.underlying}</a></b> <span className="chip">{chip(t.right)}</span></span>
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

/** D6 (TR-4): long open options in the open block, with the chip and the absolute expiry. */
export function OpenOptionRows({ open }: { open: OpenOptionView[] }) {
  if (!open.length) return null;
  return <ul className="rows positions options-open">
    {open.map((p, i) => {
      const exp = expiryText(p.expiry);
      // Fix round 1 (QA 1): underlying, expiry and right plus the index; never the contract key (it holds the strike).
      return <li key={`${p.underlying}|${p.expiry}|${p.right}|${i}`} aria-label={`${p.underlying} ${chip(p.right).toLowerCase()}, ${exp}, ${pct(p.pct)} unrealized`}>
        <div className="line"><span className="option-what"><b><a href={`/t/${encodeURIComponent(p.underlying)}`}>{p.underlying}</a></b> <span className="chip">{chip(p.right)}</span> <span className="muted small">{exp}</span></span><b className={sign(p.pct)}>{pct(p.pct)}</b></div>
      </li>;
    })}
  </ul>;
}

/** D6: futures and similar open contracts, counted (not gated: no option term is published). */
export function UnsupportedLine({ counts }: { counts: OptionCounts }) {
  return counts.unsupported > 0 ? <p className="muted options-unsupported">{OPTIONS.unsupported(counts.unsupported)}</p> : null;
}

/** AC 24: the SW-1 pane's part: the rendered line only (the count line, or the options line once open). Fix round 1
 *  (QA 2): it receives the line, never the per-kind counts. */
export function PaneOptions({ v }: { v?: PaneOptionsView }) {
  if (!v?.line) return null;
  return <div className="pane-options"><p className={v.line.startsWith('Options:') ? 'options-line small' : 'muted small options-gated'} data-options={v.line.startsWith('Options:') ? 'open' : 'gated'}>{v.line}</p></div>;
}
