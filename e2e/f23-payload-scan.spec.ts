// F-23 AC 8 (and AC 1/2), docs/features/F-23-public-payload-precision.md; plan docs/features/logs/F-23/plan.md point 8.
// One fixture trader (`f23s` + a random tag: fictional, verified, connected, feed-eligible, so the shared feed lock is
// held), removed at the end. Signed out, every response on the profile, pane, pane-chart, feed, trade and month pages
// (HTML, RSC flight with `RSC: 1` and with `?_rsc=`, the JSON routes, OG/Twitter alt, <title>) and, in a 360 px browser,
// every data-*/aria-* value and ARIA snapshot while the chart is scrubbed with the arrow keys, are scanned by three
// detectors:
// (a) planted digits: substrings only the stored (unrounded) fixture values or its clock times contain;
// (b) named fields: every return/stat field must equal wirePct(itself) (winRate: two decimals at most); the packed
//     charts and the pane model are decoded by schema (day offsets integers, base/t0/t1 5-digit UTC days);
// (c) times: no 13-digit epoch, no ISO instant with a time other than midnight, except a record-status <time> at
//     the whole UTC hour ('YYYY-MM-DDTHH:00Z', the relative "… hours ago" line).
// No generic "too many decimals" regex: ids, hashes, SVG geometry and CSP nonces cannot trip it. A self-check runs the
// same detectors on payloads in the pre-F-23 format and asserts that they flag them.
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { wirePct, wireDay, isoDay, wireCurve } from '../lib/public-wire.ts';

const DAY = 86_400_000, HOUR = 3_600_000;
const tag = Math.random().toString(36).slice(2, 7);
const H = `f23s${tag}`;
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });

// The fixture's clock: A and B on the same UTC day (yesterday, so both are in the past and within the last 2 days).
const NOW = Date.now();
const DAY_A = wireDay(NOW) - 1;
const at = (day: number, h: number, m: number, s: number, ms = 0) => new Date(day * DAY + h * HOUR + m * 60_000 + s * 1000 + ms);
const A_AT = at(DAY_A, 14, 31, 7, 123);
const B_AT = at(DAY_A, 16, 2, 41);
const OPEN_AT = new Date(Math.floor(NOW / HOUR) * HOUR - HOUR + 12 * 60_000 + 45_000); // hh:12:45, an hour ago
const SYNC_AT = new Date(Math.floor(NOW / HOUR) * HOUR - 2 * HOUR + 17 * 60_000 + 33_000); // hh:17:33, two hours ago
const CONNECTED_AT = at(DAY_A - 6, 8, 44, 19, 512);
const SELL = (k: string) => `f23-${tag}-${k}`; // non-numeric sell ids
const CLOSES: { k: string; r: number; at: Date; hold: number; thesis?: string }[] = [
  { k: 'a', r: 0.123456789, at: A_AT, hold: 2.3456, thesis: 'Sold into the gap after the breakout faded on light volume.' },
  { k: 'b', r: -0.0504999, at: B_AT, hold: 1.0498 },
  { k: 'c', r: -0.99987654, at: at(DAY_A, 9, 5, 0), hold: 4.2 },
  { k: 'd', r: 0.0000049, at: at(DAY_A, 10, 5, 0), hold: 3 },
  { k: 'e', r: 0.0876543, at: at(DAY_A, 11, 5, 0), hold: 5.5 },
  // A rounding-edge set for the average, and enough closes for the feed (5 recent).
  { k: 'f', r: 0.0344999, at: at(DAY_A - 1, 9, 5, 0), hold: 1 },
  { k: 'g', r: -0.0145001, at: at(DAY_A - 1, 10, 5, 0), hold: 1 },
  { k: 'h', r: 0.0249999, at: at(DAY_A - 1, 11, 5, 0), hold: 1 },
];
const OPEN_PCT = 0.087654321;
const A = SELL('a');
const YM = isoDay(A_AT).slice(0, 7);

// (a) Planted substrings. Decimal forms are checked everywhere; bare digits and clock times only in content that is the
// fixture's alone (its JSON bodies, its profile/trade/month pages, its feed card), since other e2e traders' data on the
// feed could carry the same digits honestly.
const PLANT_DEC = ['0.1234', '12.34', '12.345', '0.0504', '5.049', '99.987', '0.99987', '0.0876', '8.765', '0.00049', '4.9e-6', '0.0000049', '2.345', '1.049', '3.4499', '1.4500', '2.4999'];
const PLANT_BARE = ['1234', '5049', '0504', '9998765', '99987', '0876', '8765', '0000049', '23456', '34499', '45001', '49999'];
const PLANT_TIME = ['14:31', '31:07', '16:02', '02:41', ':12:45', ':17:33', ':44:19', '.123Z', '.512Z'];

const RETURN_KEYS = 'returnPct|return_pct|unrealized_pct|avg|avgReturn|last|dd|min|max|value|lo|hi|low|high|worst|best';
const DATE_KEYS = 'closedAt|closed_at|openedAt|opened_at|at|t0|t1|base|day|since|openAsOf|fetchedAt|fetched_at|asOf|syncedAt|lastSyncedAt';
const ISO = /\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:?\d\d)?/g;
const MIDNIGHT = /T00:00(?::00(?:\.0+)?)?(?:Z|[+-]00:?00)?$/;
const rateOk = (v: number) => Number(v.toFixed(2)) === v;
// Every regex metacharacter escaped (CodeQL: escape them all, not only the first dot).
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pctOk = (v: number) => wirePct(v) === v;
// The cumulative curve (point values, totals, y bounds): 3 significant figures from +100% (owner decision 2026-11-02).
const curveOk = (v: number) => wireCurve(v) === v;
// A drawdown prints negated ("max drawdown -99.999%"), so it is rounded as printed: -wirePct(-dd).
const ddOk = (v: number) => (-wirePct(-v) || 0) === v;

// Next's flight chunks in a page, decoded; the raw page with \" unescaped too.
const FLIGHT = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
const flightOf = (html: string) => [...html.matchAll(FLIGHT)].map((m) => JSON.parse(m[1]) as string).join('');
// Never data: CSP nonces, build asset paths, long hex hashes (trade keys, ids), base64url cursors, SVG geometry.
const neutral = (s: string) => s
  .replace(/nonce(=|\\?"?:)\\?"[^"\\]*\\?"/g, 'nonce=N').replace(/'nonce-[^']+'/g, "'nonce-N'")
  .replace(/\/_next\/static\/[^"'\s)\\]+/g, '/_next/static/X')
  // Ids and links (a serial trade id can hold any digits): id-named fields and id/link attributes.
  .replace(/"(id|userId|user_id|tradeId|trade_id|sellId|sell_id|key|href)":("[^"]*"|\d+)/g, '"$1":ID')
  .replace(/\b(id|data-trade|data-key|data-id|href|for|aria-controls|aria-labelledby|aria-describedby)=("[^"]*")/g, '$1=ID')
  .replace(/(?<![\d.])\b(?=[0-9a-f]*[a-f])[0-9a-f]{16,}\b/g, 'HEX') /* a hash has a letter; a float's fraction does not */.replace(/eyJ[A-Za-z0-9_-]{8,}/g, 'B64')
  .replace(/\b(d|points|viewBox|transform|x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|width|height|stroke-width|stroke-dasharray|offset)=("[^"]*")/g, '$1=G')
  .replace(/"(d|points|viewBox|transform|x|y|x1|x2|y1|y2|cx|cy|r|width|height|strokeWidth|strokeDasharray|offset)":("[^"]*"|-?[\d.e+-]+)/g, '"$1":G');

// The record-status line's hour (the only non-midnight time allowed): a <time datetime="…THH:00Z"> inside an element
// whose class has record-status, in HTML; in flight, a segment's "iso" (the line's prop) at the whole hour.
function allowStatusHours(html: string): string {
  return html.replace(/<p class="[^"]*\brecord-status\b[^"]*"[^>]*>[\s\S]*?<\/p>/g, (block) =>
    block.replace(/(datetime=")(\d{4}-\d\d-\d\dT\d\d:00Z)(")/gi, '$1STATUS-HOUR$3'));
}

// The same line in flight: the server-rendered status element (["$","p",…,{"className":"… record-status …",…}]), cut out
// by balanced brackets, its <time> children's "dateTime" at the whole hour.
function allowStatusHoursFlight(text: string): string {
  let out = '', from = 0;
  for (const m of text.matchAll(/"className":"[^"]*\brecord-status\b[^"]*"/g)) {
    const start = text.lastIndexOf('["$","p"', m.index!);
    if (start < from) continue;
    let depth = 0, inStr = false, i = start;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === '[') depth++; else if (ch === ']' && --depth === 0) break;
    }
    out += text.slice(from, start) + text.slice(start, i + 1).replace(/("dateTime":")(\d{4}-\d\d-\d\dT\d\d:00Z)(")/g, '$1STATUS-HOUR$3');
    from = i + 1;
  }
  return out + text.slice(from);
}

type Kind = 'html' | 'flight' | 'json' | 'attrs';
type Surface = { name: string; kind: Kind; body: string; fixture: boolean };

// The packed chart (lib/chart-series.ts#packChart, v=2) by schema.
function checkPacked(c: Record<string, unknown>, where: string, out: string[]) {
  const day5 = (v: unknown) => Number.isInteger(v) && (v as number) >= 10_000 && (v as number) <= 99_999;
  if (c.v !== 2) out.push(`${where}: packed chart v=${String(c.v)}`);
  if (!day5(c.base)) out.push(`${where}: base ${String(c.base)} is not a 5-digit UTC day`);
  for (const t of (c.trades ?? []) as unknown[][]) {
    if (typeof t[0] !== 'string') out.push(`${where}: trade id ${String(t[0])}`);
    if (!pctOk(t[2] as number)) out.push(`${where}: trade ${String(t[0])} return ${String(t[2])}`);
    if (Number((t[3] as number).toFixed(1)) !== t[3]) out.push(`${where}: trade ${String(t[0])} hold ${String(t[3])}`);
    if (c.sfx ? t.length !== 5 && t.length !== 7 : !Number.isInteger(t[5])) out.push(`${where}: trade ${String(t[0])} index ${String(t[5])}`);
    // F4-16: a published note's written and edited dates, UTC day numbers or null (after the row index; in the compact
    // form, which has no row index, right after the thesis).
    const days = t.slice(c.sfx ? 5 : 6);
    if (days.length && (days.length !== 2 || days.some((d) => d !== null && !day5(d)))) out.push(`${where}: trade ${String(t[0])} note days ${JSON.stringify(days)}`);
  }
  const stride = c.lite ? 2 : 3;
  for (const [k, r] of Object.entries((c.ranges ?? {}) as Record<string, Record<string, unknown>>)) {
    for (const f of ['t0', 't1']) if (!day5(r[f])) out.push(`${where}: ${k}.${f} ${String(r[f])} is not a 5-digit UTC day`);
    for (const f of ['last', 'dd', 'min', 'max']) if (!(f === 'dd' ? ddOk : curveOk)(r[f] as number)) out.push(`${where}: ${k}.${f} ${String(r[f])}`);
    if (!Number.isInteger(r.n)) out.push(`${where}: ${k}.n ${String(r.n)}`);
    const p = r.p as number[];
    // The compact form (c.sfx): ALL as [day, value] pairs, a dated range as its values only.
    if (c.sfx && k !== 'ALL') {
      if (p.length !== r.n) out.push(`${where}: ${k}.p has ${p.length} values for ${String(r.n)} closes`);
      for (const v of p) if (!curveOk(v)) out.push(`${where}: ${k}.p value ${v}`);
      continue;
    }
    const st = c.sfx ? 2 : stride;
    if (p.length % st) out.push(`${where}: ${k}.p length ${p.length} is not a multiple of ${st}`);
    for (let i = 0; i < p.length; i += st) {
      if (!Number.isInteger(p[i]) || p[i] < 0) out.push(`${where}: ${k}.p day offset ${p[i]}`);
      if (!curveOk(p[i + 1])) out.push(`${where}: ${k}.p value ${p[i + 1]}`);
      if (st === 3 && !Number.isInteger(p[i + 2])) out.push(`${where}: ${k}.p close index ${p[i + 2]}`);
    }
  }
}
// Every packed chart object in a text (flight or JSON), found by its head and cut out by balanced braces.
function packedIn(text: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of text.matchAll(/\{"v":\d+,"base":/g)) {
    let depth = 0, inStr = false, i = m.index!;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}' && --depth === 0) break;
    }
    // A chart that does not parse is a finding (it would otherwise hide its values from the schema check).
    try { out.push(JSON.parse(text.slice(m.index!, i + 1))); } catch { out.push({ unparsed: text.slice(m.index!, Math.min(i + 1, m.index! + 120)) }); }
  }
  return out;
}

// Pane JSON (app/u/[handle]/pane/route.ts) by schema, plus a walk over every value.
function walkJson(v: unknown, path: string, out: string[]) {
  if (typeof v === 'number') {
    const key = path.split('.').pop()!.replace(/\[\d+\]$/, '');
    if (/^1\d{12}$/.test(String(Math.trunc(Math.abs(v))))) out.push(`${path}: 13-digit epoch ${v}`);
    if (new RegExp(`^(${DATE_KEYS})$`).test(key) && !(Number.isInteger(v) && v < 100_000)) out.push(`${path}: date ${v} is not a UTC day`);
    if (key === 'winRate') { if (!rateOk(v)) out.push(`${path}: winRate ${v}`); }
    else if (!Number.isInteger(v) && !(key === 'dd' ? ddOk : /^(last|min|max|value|p)$/.test(key) ? curveOk : pctOk)(v)) out.push(`${path}: ${v} is finer than printed`);
  } else if (typeof v === 'string') {
    for (const m of v.matchAll(ISO)) if (!MIDNIGHT.test(m[0])) out.push(`${path}: time ${m[0]}`);
  } else if (Array.isArray(v)) v.forEach((x, i) => walkJson(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walkJson(x, `${path}.${k}`, out);
}

function scan(s: Surface): string[] {
  const out: string[] = [];
  const at = (msg: string) => out.push(`${s.name}: ${msg}`);
  let text = s.body;
  if (s.kind === 'html') text = allowStatusHours(text) + '\n' + flightOf(text);
  text = allowStatusHoursFlight(neutral(text.replace(/\\"/g, '"')));
  // (a)
  for (const p of PLANT_DEC) if (text.includes(p)) at(`planted digits ${p}`);
  if (s.fixture) for (const p of [...PLANT_BARE, ...PLANT_TIME]) if (text.includes(p)) at(`planted ${p}: …${text.slice(Math.max(0, text.indexOf(p) - 60), text.indexOf(p) + 30)}…`);
  // (b) named fields
  for (const m of text.matchAll(new RegExp(`"(${RETURN_KEYS})":(-?[\\d.]+(?:e[+-]?\\d+)?)(?=[,}\\]])`, 'g'))) if (!(m[1] === 'dd' ? ddOk : /^(last|min|max|value)$/.test(m[1]) ? curveOk : pctOk)(Number(m[2]))) at(`${m[1]}=${m[2]} is finer than printed`);
  for (const m of text.matchAll(/"winRate":(-?[\d.]+(?:e[+-]?\d+)?)/g)) if (!rateOk(Number(m[1]))) at(`winRate=${m[1]}`);
  for (const m of text.matchAll(/"(open|unrealized)":\[(-?[\d.e+,-]+)\]/g)) for (const v of m[2].split(',')) if (!pctOk(Number(v))) at(`${m[1]}[] ${v}`);
  for (const m of text.matchAll(new RegExp(`"(${DATE_KEYS})":(\\d+(?:\\.\\d+)?)`, 'g'))) if (Number(m[2]) >= 100_000) at(`${m[1]}=${m[2]} is not a UTC day`);
  for (const c of packedIn(text)) checkPacked(c, `${s.name} packed`, out);
  if (s.kind === 'json') { try { walkJson(JSON.parse(s.body), '$', out); } catch { at('JSON body does not parse'); } }
  // (c) times
  for (const m of text.matchAll(/(?<![\d.])1\d{12}(?![\d])/g)) at(`13-digit epoch ${m[0]}`);
  for (const m of text.matchAll(ISO)) {
    if (MIDNIGHT.test(m[0])) continue;
    at(`time ${m[0]} in …${text.slice(Math.max(0, m.index! - 140), m.index! + m[0].length + 20).replace(/\s+/g, ' ')}…`);
  }
  // Accessible values, OG alt, titles: no percent finer than a printed one (1 decimal; more only near -100%).
  if (s.kind === 'attrs') for (const m of text.matchAll(/(\d+)\.(\d{2,})\s?%/g)) if (m[1] !== '99') at(`percent ${m[0]}`);
  return [...new Set(out)];
}

// Page metadata: og/twitter alt and the <title>.
const metaOf = (html: string, attr: 'property' | 'name', key: string) =>
  [...html.matchAll(new RegExp(`<meta ${attr}="${escapeRe(key)}" content="([^"]*)"`, 'g'))].map((m) => m[1]);
const titleOf = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';

test.describe.configure({ mode: 'serial' });
let release: (() => Promise<void>) | null = null;

test.beforeAll(async () => {
  release = await feedLock('shared');
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id, last_synced_at)
    select ${H}, ${'F23 Scan'}, now(), a.id, ${SYNC_AT} from a returning id, signup_attempt_id`;
  await sql`insert into closed_trades ${sql(CLOSES.map((c) => ({
    user_id: u.id, sell_id: SELL(c.k), account_id: 'a', symbol: `FZ${c.k.toUpperCase()}`,
    opened_at: new Date(c.at.getTime() - 3 * DAY), closed_at: c.at,
    return_pct: c.r, holding_days: c.hold, verified: true, thesis: c.thesis ?? null, thesis_status: c.thesis ? 'published' : null,
  })))}`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', ${CONNECTED_AT}, ${CONNECTED_AT}, ${CONNECTED_AT}, ${CONNECTED_AT})`;
  await sql`insert into open_positions (user_id, account_id, symbol, unrealized_pct, fetched_at) values (${u.id}, 'a', 'FZO', ${OPEN_PCT}, ${OPEN_AT})`;
});
test.afterAll(async () => {
  await sql`delete from users where handle = ${H}`;
  await release?.();
  await sql.end({ timeout: 1 });
});

test('F-23 scan self-check: the planted digits are not in the rounded values, and the detectors flag the pre-F-23 format', () => {
  for (const v of [...CLOSES.map((c) => c.r), OPEN_PCT]) {
    const w = String(wirePct(v)), printed = (wirePct(v) * 100).toFixed(1);
    for (const p of [...PLANT_DEC, ...PLANT_BARE]) {
      expect(w.includes(p), `${p} is in wirePct(${v}) = ${w}`).toBe(false);
      expect(printed.includes(p), `${p} is in the print of ${v}`).toBe(false);
    }
  }
  for (const c of CLOSES) expect(String(Number(c.hold.toFixed(1)))).not.toMatch(new RegExp(PLANT_DEC.concat(PLANT_BARE).map(escapeRe).join('|')));
  // Old pane JSON: full returns, ms closedAt, ISO openAsOf.
  const oldPane = JSON.stringify({ trades: [{ id: 'f23-x-a', returnPct: 0.123456789, closedAt: A_AT.getTime(), holdingDays: 2.3456 }], open: [OPEN_PCT], openAsOf: OPEN_AT.toISOString() });
  const f1 = scan({ name: 'old pane', kind: 'json', body: oldPane, fixture: true });
  expect(f1.some((f) => f.includes('planted digits 0.1234'))).toBe(true);
  expect(f1.some((f) => f.includes('returnPct=0.123456789'))).toBe(true);
  expect(f1.some((f) => f.includes('13-digit epoch'))).toBe(true);
  expect(f1.some((f) => f.includes('closedAt=') && f.includes('not a UTC day'))).toBe(true);
  expect(f1.some((f) => f.includes('open[] 0.087654321'))).toBe(true);
  expect(f1.some((f) => f.includes('time ') && f.includes(':12:45'))).toBe(true);
  // A 6-decimal packed chart (and a ms t0), unplanted digits, so only the schema catches it.
  const oldChart = JSON.stringify({ v: 2, base: 20375, trades: [['f23-x-b', 'FZB', 0.112233, 2.3, null, 0]], ranges: { ALL: { t0: 1760400000000, t1: 20376, last: 0.112233, n: 1, dd: 0, min: 0, max: 0.112233, p: [0, 0.112233, 0, 0.5, 0.11, 0] } } });
  const f2 = scan({ name: 'old chart', kind: 'json', body: oldChart, fixture: false });
  expect(f2.some((f) => f.includes('trade f23-x-b return 0.112233'))).toBe(true);
  expect(f2.some((f) => f.includes('ALL.t0'))).toBe(true);
  expect(f2.some((f) => f.includes('ALL.p value 0.112233'))).toBe(true);
  expect(f2.some((f) => f.includes('ALL.p day offset 0.5'))).toBe(true);
  // Owner decision 2026-11-02: a curve value above +100% at one absolute decimal (98.123 = +9,812.3%) is finer than the
  // 3 figures the chart prints (+9,810%).
  const bigCurve = JSON.stringify({ v: 2, base: 20375, trades: [], ranges: { ALL: { t0: 20375, t1: 20376, last: 98.123, n: 0, dd: 0, min: 0, max: 98.123, p: [] } } });
  expect(scan({ name: 'big curve', kind: 'json', body: bigCurve, fixture: false }).some((f) => f.includes('ALL.last 98.123'))).toBe(true);
  // The same in a page's flight (escaped quotes, a $D date) and in an HTML <time>.
  const oldPage = `<html><head><title>x</title></head><body><time datetime="${A_AT.toISOString()}">x</time>`
    + `<script>self.__next_f.push([1,${JSON.stringify(`5:["$","div",null,{"points":[{"returnPct":0.112233,"closedAt":"$D${B_AT.toISOString()}","winRate":0.6666}]}]\n`)}])</script></body></html>`;
  const f3 = scan({ name: 'old page', kind: 'html', body: oldPage, fixture: true });
  expect(f3.some((f) => f.includes('returnPct=0.112233'))).toBe(true);
  expect(f3.some((f) => f.includes('winRate=0.6666'))).toBe(true);
  expect(f3.some((f) => f.includes(`time ${A_AT.toISOString()}`))).toBe(true);
  expect(f3.some((f) => f.includes(`time ${B_AT.toISOString()}`))).toBe(true);
  expect(f3.some((f) => f.includes('planted 14:31'))).toBe(true);
  // Float noise in a computed stat (no planted digits) is caught in flight and in a packed chart.
  const noisy = `<html><body><script>self.__next_f.push([1,${JSON.stringify('6:{"avg":0.024499999000000005}\n')}])</script></body></html>`;
  expect(scan({ name: 'noisy avg', kind: 'html', body: noisy, fixture: false }).some((f) => f.includes('avg=0.024499999000000005'))).toBe(true);
  const noisyChart = JSON.stringify({ v: 2, base: 20375, trades: [], ranges: { ALL: { t0: 20375, t1: 20376, last: 0.30000000000000004, n: 0, dd: 0, min: 0, max: 0, p: [] } } });
  expect(scan({ name: 'noisy chart', kind: 'json', body: noisyChart, fixture: false }).some((f) => f.includes('0.30000000000000004'))).toBe(true);
  // The whole hour outside a record-status line is still a finding.
  expect(scan({ name: 'hour', kind: 'flight', body: '5:["$","time","1",{"dateTime":"2026-10-14T09:00Z"}]', fixture: false }).some((f) => f.includes('time 2026-10-14T09:00Z'))).toBe(true);
  // An accessible name finer than the screen.
  expect(scan({ name: 'old aria', kind: 'attrs', body: 'aria-label=Up 12.35% on FZA', fixture: false }).some((f) => f.includes('percent 12.35%'))).toBe(true);
  // What must pass: ids, hashes, nonces, SVG geometry, a midnight day and the status hour.
  const clean = `<p class="muted small record-status"><time datetime="2026-10-14T09:00Z">2 hours ago</time></p>`
    + `<svg viewBox="0 0 312.3456 100"><path d="M0,12.345 L1234.5,99.987"/></svg><a data-key="${'a1234b'.repeat(11)}" nonce="x1234">`
    + `<script>self.__next_f.push([1,${JSON.stringify('7:["$","p",null,{"className":"muted small record-status","children":[["$","time","1",{"dateTime":"2026-10-14T09:00Z","title":"Oct 14"}]]}]\n6:{"returnPct":0.123,"winRate":0.67,"now":"$D2026-10-14T00:00:00.000Z","id":"9876543210123"}\n')}])</script>`;
  expect(scan({ name: 'clean', kind: 'html', body: clean, fixture: true })).toEqual([]);
});

test('F-23 AC 8 (+ AC 1/2): every signed-out response on the profile, pane, pane-chart, feed, trade and month pages carries no return finer than printed and no time finer than a UTC day', async ({ playwright, baseURL, browser }) => {
  test.setTimeout(180_000);
  const api = await playwright.request.newContext({ baseURL }); // signed out: no cookies
  const found: string[] = [];
  const surfaces: Surface[] = [];
  const meta: { page: string; og: string[]; tw: string[]; title: string }[] = [];
  const P = `/u/${H}`, TRADE = `${P}/trade/${encodeURIComponent(A)}`, MONTH = `${P}/month/${YM}`;
  const pages: [string, boolean][] = [['/', false], [P, true], [`${P}?closes=100`, true], [TRADE, true], [MONTH, true]];
  for (const [url, fixture] of pages) {
    const html = await api.get(url);
    expect(html.status(), url).toBe(200);
    const body = await html.text();
    surfaces.push({ name: `${url} HTML`, kind: 'html', body, fixture });
    if (url !== '/') {
      expect(body, `${url} is the fixture's`).toContain(H);
      const m = { page: url, og: metaOf(body, 'property', 'og:image:alt'), tw: metaOf(body, 'name', 'twitter:image:alt'), title: titleOf(body) };
      meta.push(m);
      for (const v of [...m.og, ...m.tw, m.title]) surfaces.push({ name: `${url} meta "${v}"`, kind: 'attrs', body: v, fixture: true });
      expect(m.title, `${url} <title>`).not.toMatch(/[‹›]/);
    }
    const flight = await api.get(url, { headers: { RSC: '1' } });
    expect(flight.status(), `${url} RSC`).toBe(200);
    surfaces.push({ name: `${url} RSC:1 (${flight.headers()['content-type']})`, kind: (flight.headers()['content-type'] ?? '').includes('html') ? 'html' : 'flight', body: await flight.text(), fixture });
    const q = `${url}${url.includes('?') ? '&' : '?'}_rsc=abc`;
    const rsc = await api.get(q);
    expect(rsc.status(), q).toBe(200);
    surfaces.push({ name: `${q} (${rsc.headers()['content-type']})`, kind: (rsc.headers()['content-type'] ?? '').includes('html') ? 'html' : 'flight', body: await rsc.text(), fixture });
    const both = await api.get(q, { headers: { RSC: '1' } });
    surfaces.push({ name: `${q} RSC:1`, kind: (both.headers()['content-type'] ?? '').includes('html') ? 'html' : 'flight', body: await both.text(), fixture });
  }
  // Review of #97: the stock pages and the sitemap (a ticker's lastmod once named a close to the millisecond). The
  // symbol pages list other traders' closes too, so only the detectors that cannot collide run on them (fixture: false).
  for (const url of [`/t/FZA`, `/t/compare?a=FZA&b=FZB`, '/t', '/sitemap.xml']) {
    const res = await api.get(url);
    expect(res.status(), url).toBeLessThan(400);
    const body = await res.text();
    surfaces.push({ name: `${url} ${url.endsWith('.xml') ? 'XML' : 'HTML'}`, kind: 'html', body, fixture: false });
    if (url.endsWith('.xml')) for (const m of body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) expect(m[1], `sitemap lastmod ${m[1]}`).toMatch(/T00:00:00(\.000)?Z$|^\d{4}-\d\d-\d\d$/);
    else {
      const rsc = await api.get(url, { headers: { RSC: '1' } });
      surfaces.push({ name: `${url} RSC:1`, kind: (rsc.headers()['content-type'] ?? '').includes('html') ? 'html' : 'flight', body: await rsc.text(), fixture: false });
    }
  }
  // The feed card is on page 1 (the profile check below needs the flight to name it, too).
  expect((surfaces.find((s) => s.name === '/ HTML')!.body).includes(`data-handle="${H}"`), 'the fixture is on feed page 1').toBe(true);
  // JSON routes: only ?v=2 is served; the bare URLs are a 404 with no figures.
  for (const r of ['pane', 'pane-chart']) {
    const bare = await api.get(`${P}/${r}`);
    expect(bare.status(), `${r} bare`).toBe(404);
    expect(await bare.text(), `${r} bare body`).not.toMatch(/\d/);
    const res = await api.get(`${P}/${r}?v=2`);
    expect(res.status(), `${r}?v=2`).toBe(200);
    const body = await res.text();
    surfaces.push({ name: `${r}?v=2`, kind: 'json', body, fixture: true });
    const j = JSON.parse(body);
    if (r === 'pane-chart') checkPacked(j, 'pane-chart', found);
    else {
      checkPacked(j.chart, 'pane.chart', found);
      // AC 2: unrealized_pct and openAsOf are covered: the open summary is present, rounded, and its date is a day.
      expect(j.model.open, 'pane open summary').toBeTruthy();
      expect(j.model.open.avg).toBe(wirePct(OPEN_PCT));
      expect(j.model.openAsOf).toBe(isoDay(OPEN_AT));
      expect(j.model.since).toMatch(/^\d{4}-\d\d-\d\d$/);
      for (const t of j.model.recent) expect(Number.isInteger(t.day) && t.day < 100_000, `recent day ${t.day}`).toBe(true);
    }
    // AC 1: A's odd return goes out as the printed 0.123 and its day as a UTC day, never its 14:31:07.
    const chart = r === 'pane-chart' ? j : j.chart;
    const a = (chart.trades as unknown[][]).find((t) => t[0] && (t[1] === 'FZA'));
    expect(a, `${r}: close A is in the chart`).toBeTruthy();
    expect(a![2]).toBe(wirePct(0.123456789));
  }

  // The browser: the profile at 360 px, the chart scrubbed point by point and each range tab, then the fixture's feed card.
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  const bodies: Promise<void>[] = [];
  let scope = { name: '', fixture: true };
  page.on('response', (res) => {
    const t = res.request().resourceType();
    if (!['document', 'fetch', 'xhr'].includes(t) || !res.url().startsWith(baseURL!)) return;
    const s = { ...scope };
    bodies.push(res.text().then((b) => {
      const ct = res.headers()['content-type'] ?? '';
      surfaces.push({ name: `browser ${s.name} ${t} ${res.url().slice(baseURL!.length)}`, kind: ct.includes('json') ? 'json' : ct.includes('html') ? 'html' : 'flight', body: b, fixture: s.fixture });
    }).catch(() => {}));
  });
  const grab = async (p: Page, root: string, name: string, fixture: boolean) => {
    const attrs = await p.evaluate((sel) => {
      const out: string[] = [];
      for (const el of document.querySelectorAll(`${sel}, ${sel} *`)) for (const a of el.attributes) {
        if (!/^(data-|aria-)/.test(a.name) && a.name !== 'datetime' && a.name !== 'title' && a.name !== 'alt') continue;
        if (/^(data-trade|data-key|data-id|aria-controls|aria-labelledby|aria-describedby|aria-owns)$/.test(a.name)) continue; // ids, not data
        const status = a.name === 'datetime' && el.closest('.record-status') && /^\d{4}-\d\d-\d\dT\d\d:00Z$/.test(a.value);
        out.push(`${a.name}=${status ? 'STATUS-HOUR' : a.value}`);
      }
      return out;
    }, root);
    surfaces.push({ name: `${name} data/aria`, kind: 'attrs', body: attrs.join('\n'), fixture });
    surfaces.push({ name: `${name} ARIA snapshot`, kind: 'attrs', body: await p.locator(root).first().ariaSnapshot(), fixture });
    return attrs;
  };
  scope = { name: 'profile', fixture: true };
  await page.goto(P);
  const scrub = page.getByRole('group', { name: /Scrub the chart/ }).first();
  await expect(scrub).toBeVisible();
  await scrub.focus();
  let labels = new Set<string>();
  for (let i = 0; i < CLOSES.length + 2; i++) {
    await page.keyboard.press('ArrowRight');
    const attrs = await grab(page, 'body', `profile scrub ${i}`, true);
    labels = new Set([...labels, ...attrs.filter((a) => a.startsWith('aria-'))]);
  }
  const tabs = page.getByRole('group', { name: 'Range' }).first().getByRole('button');
  for (let i = 0; i < await tabs.count(); i++) {
    await tabs.nth(i).click();
    await grab(page, 'body', `profile range ${i}`, true);
  }
  scope = { name: 'feed', fixture: false };
  await page.goto('/');
  const card = page.locator(`.row[data-handle="${H}"]`).first();
  await expect(card).toBeAttached();
  await card.scrollIntoViewIfNeeded();
  await grab(page, `.row[data-handle="${H}"]`, 'feed card', true);
  // Review of #97 (Low): the feed's paging action (a POST whose RSC response appends the next page), when there is one.
  scope = { name: 'feed paging', fixture: false };
  let posted = 0;
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().startsWith(baseURL!)) posted++; });
  const more = page.locator('.feed-more a.button');
  if (await more.count()) {
    const before = await page.locator('.feed > .row').count();
    await more.first().click();
    await expect.poll(() => page.locator('.feed > .row').count(), { timeout: 15_000 }).toBeGreaterThan(before);
    expect(posted, 'the paging action ran').toBeGreaterThan(0);
  } else test.info().annotations.push({ type: 'f23-scan-paging', description: 'feed has one page: no paging action to scan' });
  await Promise.all(bodies);
  await ctx.close();
  await api.dispose();

  for (const s of surfaces) found.push(...scan(s));
  // The scan saw the fixture's data (a positive control, so a pass is not a scan of empty pages): the profile's flight
  // carries its packed chart with close A, and the named-field pass matched returns in it.
  const prof = surfaces.find((s) => s.name === `${P} RSC:1 (text/x-component)`) ?? surfaces.find((s) => s.name.startsWith(`${P} RSC:1`))!;
  const packs = packedIn(prof.kind === 'html' ? flightOf(prof.body) : prof.body);
  expect(packs.length, 'packed charts decoded in the profile flight').toBeGreaterThan(0);
  expect(packs.some((c) => (c.trades as unknown[][]).some((t) => t[1] === 'FZA' && t[2] === wirePct(0.123456789))), 'close A, rounded, in the profile flight').toBe(true);
  expect(prof.body, 'named return fields in the profile flight').toMatch(new RegExp(`"(${RETURN_KEYS})":-?\\d`));
  console.log(`F-23 scan: ${surfaces.length} surfaces, ${[...labels].length} distinct aria values while scrubbing; meta:`, JSON.stringify(meta));
  expect(meta.find((m) => m.page === P)?.og.length, 'the profile has an og:image:alt').toBeGreaterThan(0);
  expect([...new Set(found)], 'precision leaks').toEqual([]);
});
