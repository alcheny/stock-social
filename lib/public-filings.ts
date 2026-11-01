// F-7: the only file that talks to the public filing system (legal C6, C7): fetch only, one module-wide serial worker,
// UA from env (nothing fetched without it), backoff then stop. parseFiling is pure, bounded, keeps matcher fields only (C4).
import { importerBaseAllowed } from './public-gate.ts';
import { isLoopbackUrl, type Env } from './vendor-env.ts';
export const MIN_GAP_MS = 250; // ≤ 4 requests a second
export const MAX_DOC_BYTES = 2 * 1024 * 1024;
const BACKOFF_MS = 1000, RETRIES = 2, TIMEOUT_MS = 10_000;
export class FilingsStopped extends Error { constructor() { super('filing system refused; tick stopped'); } }
export type IndexEntry = { id: string; url: string; filedAt: string; amends?: string };
let worker: Promise<unknown> = Promise.resolve();
let lastAt = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
// The body, or '' once it passes MAX_DOC_BYTES (chunked or not: the reader is cancelled there).
async function capped(res: Response): Promise<string> {
  const reader = res.body?.getReader(), parts: Uint8Array[] = [];
  for (let n = 0, c; reader && !(c = await reader.read()).done; parts.push(c.value)) if ((n += c.value.length) > MAX_DOC_BYTES) { await reader.cancel(); return ''; }
  return Buffer.concat(parts).toString('utf8');
}
export function filingsClient(base: string, env: Env = process.env, deadline = Infinity) {
  const contact = env.PUBLIC_FILINGS_CONTACT?.trim();
  if (!contact) throw new Error('PUBLIC_FILINGS_CONTACT is not set');
  if (!importerBaseAllowed(base, env) || (!isLoopbackUrl(base) && !base.startsWith('https://'))) throw new Error('filing system base URL not allowed');
  const root = base.replace(/\/+$/, ''), origin = new URL(root).origin; // filing links only on the base's own origin
  let stopped = false;
  async function send(path: string): Promise<string | null> {
    for (let i = 0; ; i++) {
      if (stopped) throw new FilingsStopped();
      await sleep(lastAt + MIN_GAP_MS - Date.now());
      lastAt = Date.now();
      const res = await fetch(root + path, { headers: { 'user-agent': `Stock Social ${contact}` }, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null);
      if (res?.status === 404) return null;
      if (res?.ok) return capped(res);
      const wait = BACKOFF_MS * 2 ** i;
      if (i >= RETRIES || Date.now() + wait > deadline) { stopped = true; throw new FilingsStopped(); }
      await sleep(wait);
    }
  }
  const get = (path: string) => { const p = worker.then(() => send(path)); worker = p.catch(() => {}); return p; };
  return {
    // ponytail: the daily index path and JSON shape are a generic design served by the local fake, not yet mapped to the
    // real filing system's index — an adapter to its published structured index (checked before the switch goes on) fixes it.
    async listFilings(cursor: { day: string }): Promise<IndexEntry[]> {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cursor.day)) throw new Error('bad day');
      const text = await get(`/index/${cursor.day}.json`);
      let list: unknown = [];
      try { list = text ? JSON.parse(text).filings : []; } catch { list = []; }
      return (Array.isArray(list) ? list : []).filter((e): e is IndexEntry => !!e && /^[\w-]{1,64}$/.test(e.id) && /^https?:\/\/\S+$/.test(e.url) && e.url.startsWith(`${origin}/`)
        && !Number.isNaN(Date.parse(e.filedAt)) && (e.amends === undefined || /^[\w-]{1,64}$/.test(e.amends)));
    },
    fetchFiling: (id: string) => get(`/filings/${encodeURIComponent(id)}.xml`),
  };
}
export type ParsedRow = { derivative: boolean; date: string; code: string; units: number; price: number | null; acquired: boolean; heldAfter: number | null; indirect: boolean };
export type ParsedFiling = { ownerKey: string; ownerName: string; director: boolean; officer: boolean; owners: number; symbol: string; rows: ParsedRow[] };
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
  e[0] !== '#' ? ENT[e] ?? m : String.fromCodePoint(/x/i.test(e[1]) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))).trim();
// Linear scans (a lazy regex is quadratic on many unclosed tags): [start, inner start, inner end] of each open…close.
function* spans(src: string, open: RegExp, close: string) { for (let m, e; (m = open.exec(src)) && (e = src.indexOf(close, open.lastIndex)) >= 0; open.lastIndex = e + close.length) yield [m.index, open.lastIndex, e]; }
const blocks = (src: string, tag: string) => [...spans(src, new RegExp(`<${tag}(?:\\s[^<>]*)?>`, 'g'), `</${tag}>`)].map(([, a, b]) => src.slice(a, b));
const noComments = (s: string) => { let o = '', i = 0; for (const [a, , e] of spans(s, /<!--/g, '-->')) { o += s.slice(i, a); i = e + 3; } return o + s.slice(i); };
function val(src: string | undefined, tag: string): string | undefined {
  const b = src === undefined ? undefined : blocks(src, tag)[0];
  const inner = b === undefined ? undefined : blocks(b, 'value')[0] ?? b;
  return inner === undefined || inner.includes('<') ? undefined : decode(inner);
}
const num = (s: string | undefined) => (s !== undefined && /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN);
const opt = (s: string | undefined) => (s === undefined || s === '' ? null : num(s));
function row(b: string, derivative: boolean): ParsedRow | null {
  const date = val(b, 'transactionDate')?.slice(0, 10) ?? '';
  const code = val(b, 'transactionCode') ?? '';
  const units = num(val(b, 'transactionShares')), price = opt(val(b, 'transactionPricePerShare')), heldAfter = opt(val(b, 'sharesOwnedFollowingTransaction'));
  const ad = val(b, 'transactionAcquiredDisposedCode');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || !/^[A-Z]$/.test(code) || !(units > 0) || Number.isNaN(price) || Number.isNaN(heldAfter) || (ad !== 'A' && ad !== 'D')) return null;
  return { derivative, date, code, units, price, acquired: ad === 'A', heldAfter, indirect: val(b, 'directOrIndirectOwnership') === 'I' };
}

// null for a too-large, truncated or unknown document; bad rows are skipped and counted.
export function parseFiling(xml: string): { filing: ParsedFiling | null; skipped: number } {
  try {
    if (xml.length > MAX_DOC_BYTES) return { filing: null, skipped: 0 };
    const doc = blocks(noComments(xml), 'ownershipDocument')[0];
    const symbol = val(doc && blocks(doc, 'issuer')[0], 'issuerTradingSymbol')?.toUpperCase() ?? '';
    const owners = doc ? blocks(doc, 'reportingOwner') : [];
    const ownerKey = val(owners[0], 'rptOwnerCik') ?? '', ownerName = val(owners[0], 'rptOwnerName') ?? '';
    if (!doc || !/^[A-Z0-9.-]{1,10}$/.test(symbol) || !/^[\w-]{1,40}$/.test(ownerKey) || !ownerName || ownerName.length > 200) return { filing: null, skipped: 0 };
    const rel = blocks(owners[0], 'reportingOwnerRelationship')[0];
    const flag = (t: string) => /^(1|true)$/i.test(val(rel, t) ?? '');
    const parsed = [...blocks(doc, 'nonDerivativeTransaction').map((b) => row(b, false)), ...blocks(doc, 'derivativeTransaction').map((b) => row(b, true))];
    const rows = parsed.filter((r): r is ParsedRow => r !== null);
    return { filing: { ownerKey, ownerName, director: flag('isDirector'), officer: flag('isOfficer'), owners: owners.length, symbol, rows }, skipped: parsed.length - rows.length };
  } catch { return { filing: null, skipped: 0 }; }
}
