// Pure model + SVG renderer for the embeddable verified badge. No sizes, prices or symbols exist here: percentages only.
import { confidence, isNewRecord, rangeText, stats, pct, type ConfidenceInput } from './trades.ts';

export const VALID_HANDLE = /^[a-z0-9_-]{1,64}$/;

export type BadgeInput = { handle: string; demo: boolean };
export type BadgeModel =
  | { state: 'empty'; handle: string; demo: boolean }
  | { state: 'new'; handle: string; demo: boolean; trades: number; asOf: string }
  | { state: 'record'; handle: string; demo: boolean; trades: number; avgReturn: number; winRate: number; range: string | null; tooEarly: boolean; asOf: string };

// Same inputs and `today` as the profile page. Stricter than the profile: a new record never shows a return.
export function badgeModel(user: BadgeInput, trades: ConfidenceInput[], today: Date): BadgeModel {
  const { handle, demo } = user;
  if (trades.length === 0) return { state: 'empty', handle, demo };
  const asOf = new Date(Math.max(...trades.map((t) => t.closedAt.getTime()))).toISOString().slice(0, 10);
  if (isNewRecord(trades.map((t) => ({ openedAt: t.openedAt })), trades.length, today)) return { state: 'new', handle, demo, trades: trades.length, asOf };
  const s = stats(trades.map((t) => ({ returnPct: t.returnPct, holdingDays: t.holdingDays, closedAt: t.closedAt })));
  const text = rangeText(confidence(trades, today));
  const range = text ? text.replace(/^\(|\)$/g, '') : null;
  return { state: 'record', handle, demo, trades: trades.length, avgReturn: s.avgReturn, winRate: s.winRate, range, tooEarly: range === null, asOf };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatAsOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const minus = (s: string) => s.replace(/-/g, '−');
const trunc = (h: string, n: number) => (h.length > n ? `${h.slice(0, Math.max(1, n))}…` : h);
// Line 1 is 10.5px (~5.5px/char) in a 240px badge: 38 chars fit alone, 32 fit left of the DEMO pill at x=196.
export const LINE1_MAX = 38;
export const LINE1_MAX_DEMO = 32;
const plural = (n: number) => `${n} trade${n === 1 ? '' : 's'}`;
const words = (x: string) => x.replace(/%/g, ' percent').replace(/−/g, 'minus ').replace(/\+/g, 'plus ').replace(/\s+/g, ' ').trim();

const FONT = '-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
const C = { bg: '#0f1115', border: '#2a2f3a', text: '#e8eaf0', muted: '#a8afbf', up: '#22c55e', down: '#f43f5e', pill: '#3a4153' };

export function renderBadgeSvg(m: BadgeModel): string {
  const verified = !m.demo && m.state !== 'empty';
  const brand = verified ? 'Stock Social · broker data' : m.demo ? 'Demo, Stock Social' : 'Stock Social';
  const prefix = `${m.demo ? 'Demo · Stock Social' : brand} · @`;
  const line1 = prefix + trunc(m.handle, (m.demo ? LINE1_MAX_DEMO : LINE1_MAX) - prefix.length - 1);
  let main = ''; let mainColor = C.text; let side = ''; let line3 = ''; let title = '';
  if (m.state === 'empty') {
    main = 'No record yet'; line3 = 'Percentages only';
    title = `Stock Social. @${m.handle}. No record yet.`;
  } else {
    const date = `as of ${formatAsOf(m.asOf)}`;
    if (m.state === 'new') {
      main = `New record, ${plural(m.trades)}`; line3 = `Short record · ${date}`;
      title = `${brand}. @${m.handle}. ${main}. Short record: wide uncertainty, ${date}.`;
    } else {
      side = `win ${(m.winRate * 100).toFixed(0)}% · ${plural(m.trades)}`;
      if (m.tooEarly) {
        // Trade count moves to line 3 so line 2 fits 240px.
        side = `win ${(m.winRate * 100).toFixed(0)}%`;
        main = 'Too early to tell'; line3 = `${plural(m.trades)} · ${date}`;
        title = `${brand}. @${m.handle}. Too early to tell, ${side}, ${plural(m.trades)}, ${date}.`;
      } else {
        main = minus(`${pct(m.avgReturn)} avg`); mainColor = m.avgReturn > 0 ? C.up : m.avgReturn < 0 ? C.down : C.text;
        const r = minus(m.range ?? '');
        line3 = `95% range ${r} · ${date}`;
        if (line3.length > 44) line3 = `range ${r} · ${date}`;
        title = `${brand}. @${m.handle}. Average return ${words(main.replace(' avg', ''))}, 95 percent range ${words(r)}, ${plural(m.trades)}, ${date}.`;
      }
    }
  }
  const big = m.state === 'record' && !m.tooEarly;
  const sideEl = side ? `<tspan dx="8" font-size="10" font-weight="400" fill="${C.muted}">${esc(side)}</tspan>` : '';
  const pill = m.demo ? `<rect x="196" y="6" width="34" height="14" rx="7" fill="${C.pill}"/><text x="213" y="16" font-size="8.5" font-weight="700" text-anchor="middle" fill="${C.text}" font-family="${FONT}">DEMO</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="56" viewBox="0 0 240 56" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>`
    + `<rect x="0.5" y="0.5" width="239" height="55" rx="8" fill="${C.bg}" stroke="${C.border}"/>`
    + `<text x="10" y="16" font-size="10.5" fill="${C.muted}" font-family="${FONT}">${esc(line1)}</text>${pill}`
    + `<text x="10" y="35" font-size="${big ? 16 : 13}" font-weight="700" fill="${mainColor}" font-family="${FONT}">${esc(main)}${sideEl}</text>`
    + `<text x="10" y="49" font-size="9.5" fill="${C.muted}" font-family="${FONT}" data-line="3">${esc(line3)}</text></svg>`;
}
