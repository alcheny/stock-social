// OPTIONS (docs/features/logs/options/plan.md D5, D6): the option parts of the profile, the SW-1 pane and their
// shared label, as pure components of the model lib/options-load.ts returns (no reads here). Closed gate: the one count
// line. Open gate: the options line, the short and technical lines, the "Option trades" list and the open rows.
// Percent only: no strike, premium, contract count or contract symbol is ever passed in. Plain links (no router
// import), so the surface tests can render them as static markup outside the app.
import { expiryText, OPTIONS } from '@/lib/copy.ts';
import { pct } from '@/lib/trades.ts';
import { closesOf, hasOptions, openOf, optionsLineText, shareLabel, type OpenOptionView, type OptionCounts, type OptionHeadline, type OptionTradeView } from '@/lib/options-view.ts';

const sign = (x: number) => (x > 0 ? 'up' : x < 0 ? 'down' : '');
const chip = (right: 'CALL' | 'PUT') => (right === 'CALL' ? OPTIONS.call : OPTIONS.put);
const closedDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** D5: "Share trades" over a headline that reads share trades only, whenever the trader has option closes or exclusions. */
export function ShareTradesLabel({ counts }: { counts: OptionCounts }) {
  return shareLabel(counts) ? <p className="muted small share-label" data-options="label">{OPTIONS.shareLabel}</p> : null;
}

/** D5/D6: under the headline. Closed: the count line, muted, linking to /how. Open: the options line at the headline's
 *  type size, then the short and technical lines, each on its own line. */
export function OptionsLines({ m }: { m: OptionHeadline }) {
  if (!hasOptions(m.counts)) return null;
  if (m.gate === 'closed') {
    return <p className="muted options-gated" data-options="gated"><a href="/how#options">{OPTIONS.gated(closesOf(m.counts), openOf(m.counts))}</a></p>;
  }
  const c = m.counts;
  return <div className="options-lines" data-options="open">
    {m.summary && <p className="options-line">{OPTIONS.lineHead(m.summary.n, `${(m.summary.winRate * 100).toFixed(0)}%`)}<b className={sign(m.summary.avg)}>{pct(m.summary.avg)}</b> avg{m.summary.range ? ` (${pct(m.summary.range.low)} to ${pct(m.summary.range.high)})` : ''}</p>}
    {c.short + c.openShort > 0 && <p className="muted options-short">{OPTIONS.short(c.short, c.openShort)}</p>}
    {c.other > 0 && <p className="muted options-technical">{OPTIONS.technical(c.other)}</p>}
  </div>;
}

/** D6: one option close. Chip in text, not color; the accessible name reads the whole row. */
export function OptionTradeRow({ t }: { t: OptionTradeView }) {
  const exp = expiryText(t.expiry);
  return <li className="option-row" aria-label={`${t.underlying} ${chip(t.right).toLowerCase()}, ${exp}, ${pct(t.returnPct)}`}>
    <div className="line">
      <span className="option-what"><b><a href={`/t/${encodeURIComponent(t.underlying)}`} className="tap44">{t.underlying}</a></b> <span className="chip">{chip(t.right)}</span></span>
      <b className={sign(t.returnPct)}>{pct(t.returnPct)}</b>
    </div>
    <p className="muted small option-meta">closed {closedDay.format(t.closedAt)} · {exp}</p>
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
    <ul className="rows options">{shown.map((t) => <OptionTradeRow key={t.id} t={t} />)}</ul>
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
    {open.map((p) => {
      const exp = expiryText(p.expiry);
      return <li key={p.key} aria-label={`${p.underlying} ${chip(p.right).toLowerCase()}, ${exp}, ${pct(p.pct)} unrealized`}>
        <div className="line"><span className="option-what"><b><a href={`/t/${encodeURIComponent(p.underlying)}`}>{p.underlying}</a></b> <span className="chip">{chip(p.right)}</span> <span className="muted small">{exp}</span></span><b className={sign(p.pct)}>{pct(p.pct)}</b></div>
      </li>;
    })}
  </ul>;
}

/** D6: futures and similar open contracts, counted (not gated: no option term is published). */
export function UnsupportedLine({ counts }: { counts: OptionCounts }) {
  return counts.unsupported > 0 ? <p className="muted options-unsupported">{OPTIONS.unsupported(counts.unsupported)}</p> : null;
}

/** AC 24: the SW-1 pane's part: the label and the count line, or the options line once open. */
export function PaneOptions({ m }: { m?: OptionHeadline }) {
  if (!m || !hasOptions(m.counts)) return null;
  return <div className="pane-options">
    {m.gate === 'closed'
      ? <p className="muted small options-gated" data-options="gated">{OPTIONS.gated(closesOf(m.counts), openOf(m.counts))}</p>
      : m.summary && <p className="options-line small" data-options="open">{optionsLineText(m.summary)}</p>}
  </div>;
}
