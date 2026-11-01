// In-repo fake of the integrated vendor's API for tests: register/login/portal, accounts (with the paper flag and the
// initial-sync flag), paged activities, positions, delete connection and delete user, all in memory. The app's SDK is
// pointed here with SNAPTRADE_BASE_URL; no real vendor is ever contacted. Test controls live under /_ paths:
//   POST /_scenario {accounts:[{id, authorization?, institution?, paper?, activities?: number | rows, syncDone?}], delayMs?, portalDelayMs?}
//     the accounts the next portal "Connect" links (one authorization per distinct `authorization`, default 'auth-<n>');
//     portalDelayMs holds the portal page that long (the S3 loading states); portalFrameBlocked serves the portal page with
//     `Content-Security-Policy: frame-ancestors 'none'`, so a browser refuses to frame it (the frame loads blank) while a
//     top-level visit (the redirect flow) works. Fix round 2: only on GET, so the app's server-side HEAD probe does not
//     see it (a refusal that "slipped past the probe"); portalFrameHeaders serves `X-Frame-Options: DENY` and
//     `frame-ancestors 'none'` on every request, HEAD included (the probe sees it), and hands out the portal URL on
//     `localhost` instead of `127.0.0.1`: another origin, so the app's per-origin probe cache never carries it into
//     other tests
//   GET  /_post?m=<json>                           a page on the vendor's origin that posts `m` to its parent (a second,
//     vendor-origin frame for the event.source check)
// The portal page behaves like the vendor's (PR-2b): opened as a page, "Connect" links and redirects to customRedirect;
// loaded in an iframe it ignores customRedirect, opens the "broker login" in a popup it manages, and posts window
// messages to its parent: {status:'SUCCESS', authorizationId} after linking, {status:'ERROR', errorCode:'POPUP_BLOCKED'}
// when window.open returns null (a blocked popup), 'CLOSED' from its own Cancel.
//   POST /_sync {completed: boolean, accountId?}   flips initial_sync_completed
//   An account with `seed` and a numeric `activities` gets seededActivities (PR-3 heavy-use tests); activities honour
//   `startDate` like the vendor's endpoint
//   POST /_fail {status: number, times: number}    the next `times` API calls answer `status`
//   POST /_remove {accountId} | {all: true}        drops one account from the listing, or every account (FIXES-LABELS: status)
//   GET  /_state                                   users, their connections and accounts, for assertions
//     (bulk users below are not listed: there can be 100,000 of them)
//   POST /_bulk {prefix, from, to, accounts?, activities?, slowEvery?, slowOffset?, slowMs?, failEvery?, failOffset?, failStatus?}
//     (sharded-sync load test, lib/sync-shard.load.test.ts) vendor users `${prefix}${i}` for every integer i in
//     [from, to], held as one rule, not as rows: nothing is stored per user and each request generates what it answers.
//     User i has `accounts[i % accounts.length]` accounts (default [1]) with ids `${prefix}${i}-a${j}`, all under one
//     authorization `${prefix}${i}-auth`, the paper flag off and the initial sync done; each account has `activities`
//     (default 2) BUY/SELL pairs' rows, ids `${account}-${k}`, dated within the last two days of the bulk's creation (a
//     first sync or backfill reads them all in one page); no positions. The registerUser step is not needed (secrets are
//     ignored, as everywhere in this fake). Users with `i % slowEvery === slowOffset` hold every API answer `slowMs`
//     first (default 0); users with `i % failEvery === failOffset` answer every API call with `failStatus` (default
//     400) at once (failing wins over slow). Posting the same prefix again replaces the rule (keeping its activity dates); `{prefix, clear: true}`
//     removes it.
//   POST /_latency {ms, jitterMs?}                 every vendor API request (not the portal, not /_ controls) waits ms
//     plus a uniform random 0..jitterMs first; {ms: 0} turns it off. Adds to `delayMs` and the bulk's `slowMs`
//   GET  /_stats                                   {requests}: vendor API requests answered since the fake started
import { createServer, type Server } from 'node:http';

// Corporate actions (F3c): share-moving rows (SPLIT, STOCK_DIVIDEND, REI, ADJUSTMENT...) with an optional description,
// served like the vendor's; the activities endpoint honours the `type` filter as the vendor documents it.
export type FakeActivity = { id: string; symbol: string; type: 'BUY' | 'SELL'; units: number; price: number; fee?: number; trade_date: string; option_symbol?: unknown };
export type FakeCorporateRow = Omit<FakeActivity, 'type'> & { type: 'SPLIT' | 'STOCK_DIVIDEND' | 'REI' | 'ADJUSTMENT' | 'TRANSFER'; description?: string };
export type FakeAccount = { id: string; authorization?: string; institution?: string; paper?: boolean; activities?: number | (FakeActivity | FakeCorporateRow)[]; seed?: number; syncDone?: boolean; positions?: { symbol: string; units: number; price: number; cost_basis: number }[] }; // price and cost_basis per unit, as the SDK documents
type Scenario = { accounts: FakeAccount[]; delayMs?: number; portalDelayMs?: number; portalFrameBlocked?: boolean; portalFrameHeaders?: boolean };
type User = { secret: string; accounts: Map<string, FakeAccount & { authorization: string; rows: (FakeActivity | FakeCorporateRow)[]; syncDone: boolean }> };
export type BulkSpec = { prefix: string; from: number; to: number; accounts?: number[]; activities?: number; slowEvery?: number; slowOffset?: number; slowMs?: number;
  failEvery?: number; failOffset?: number; failStatus?: number };
type Bulk = BulkSpec & { at: number };

// A bulk user's accounts (with their rows, generated on demand) and its behavior, or null when no rule covers the id.
function bulkUser(bulks: Map<string, Bulk>, userId: string) {
  for (const b of bulks.values()) {
    if (!userId.startsWith(b.prefix)) continue;
    const rest = userId.slice(b.prefix.length);
    if (!/^\d{1,9}$/.test(rest)) continue;
    const i = Number(rest);
    if (i < b.from || i > b.to) continue;
    const pattern = b.accounts?.length ? b.accounts : [1];
    const n = pattern[i % pattern.length];
    const auth = `${b.prefix}${i}-auth`;
    const pairs = b.activities ?? 2;
    const rows = (account: string): FakeActivity[] => Array.from({ length: pairs * 2 }, (_, k) => ({
      id: `${account}-${k}`, symbol: ['AAA', 'BBB', 'CCC'][Math.floor(k / 2) % 3], type: k % 2 ? 'SELL' : 'BUY', units: 10,
      price: k % 2 ? 100 + ((i + k) % 7) - 3 : 100, fee: 0, trade_date: new Date(b.at - 48 * 3_600_000 + k * 60_000).toISOString(),
    }));
    const accounts = new Map(Array.from({ length: n }, (_, j) => {
      const id = `${b.prefix}${i}-a${j}`;
      return [id, { id, authorization: auth, institution: 'Fake Brokerage', paper: false, syncDone: true, get rows() { return rows(id); } }] as const;
    }));
    const failStatus = b.failEvery && i % b.failEvery === (b.failOffset ?? 0) ? b.failStatus ?? 400 : 0;
    const slowMs = !failStatus && b.slowEvery && i % b.slowEvery === (b.slowOffset ?? 0) ? b.slowMs ?? 0 : 0;
    return { accounts, slowMs, failStatus };
  }
  return null;
}

// Deterministic BUY/SELL pairs so `n` activities give n/2 closed trades per account.
export function generateActivities(accountId: string, n: number): FakeActivity[] {
  const syms = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE'];
  const out: FakeActivity[] = [];
  for (let i = 0; i < n; i++) {
    const pair = Math.floor(i / 2);
    const sell = i % 2 === 1;
    const day = new Date(Date.UTC(2024, 0, 1) + pair * 86_400_000 + (sell ? 43_200_000 : 0)).toISOString();
    out.push({ id: `${accountId}-${i}`, symbol: syms[pair % syms.length], type: sell ? 'SELL' : 'BUY', units: 10, price: sell ? 100 + ((pair * 7) % 11) - 5 : 100, fee: 0, trade_date: day });
  }
  return out;
}

// PR-3 (heavy-use tests): a reproducible, realistic history from a seed. Several symbols per account, buys of varying
// size, partial and full sells across lots (FIFO), fees, same-instant ties, and an occasional sell with no recorded entry
// (excluded, never guessed). Times move forward from 2020-01-01 in steps of minutes to days. Same seed, same rows.
// F-1 PR-3 fix round 6: a long history (2,500 rows reach about 2030) is shifted back as a whole so its last row is at
// SEEDED_END, a fixed past date: the import quarantines trades dated in the future (lib/sync.ts#FUTURE_GRACE_HOURS).
export const SEEDED_END = Date.UTC(2026, 0, 1);
export function seededActivities(accountId: string, n: number, seed: number): FakeActivity[] {
  let t = seed >>> 0;
  const rnd = () => { t = (t + 0x6d2b79f5) >>> 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const syms = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH'];
  const held = new Map<string, number>(), price = new Map<string, number>(syms.map((s, i) => [s, 20 + i * 15]));
  let at = Date.UTC(2020, 0, 1);
  const out: FakeActivity[] = [];
  for (let i = 0; i < n; i++) {
    if (rnd() > 0.05) at += Math.floor(rnd() * 3 * 86_400_000) + 60_000; // 5% share the previous row's instant
    const symbol = syms[Math.floor(rnd() * syms.length)];
    const p = Math.max(1, price.get(symbol)! * (1 + (rnd() - 0.5) * 0.08));
    price.set(symbol, p);
    const have = held.get(symbol) ?? 0;
    const orphan = rnd() < 0.01; // a sell with no recorded entry
    const sell = orphan || (have > 0 && rnd() < 0.5);
    const units = sell ? (orphan ? have + 1 + Math.floor(rnd() * 5) : Math.max(1, Math.floor(have * (0.3 + rnd() * 0.7)))) : 1 + Math.floor(rnd() * 20);
    held.set(symbol, sell ? Math.max(0, have - units) : have + units);
    out.push({ id: `${accountId}-${i}`, symbol, type: sell ? 'SELL' : 'BUY', units, price: Math.round(p * 100) / 100, fee: Math.round(rnd() * 100) / 100, trade_date: new Date(at).toISOString() });
  }
  const back = Math.max(0, at - SEEDED_END);
  if (back) for (const r of out) r.trade_date = new Date(new Date(r.trade_date).getTime() - back).toISOString();
  return out;
}

export function startVendorFake(port: number): Promise<{ server: Server; base: string }> {
  const users = new Map<string, User>();
  let next: Scenario = { accounts: [{ id: 'acct-default', activities: 4, syncDone: true }] };
  let authSeq = 0;
  let fail: { status: number; times: number } = { status: 500, times: 0 };
  const base = `http://127.0.0.1:${port}`;
  const refusingBase = `http://localhost:${port}`; // portalFrameHeaders: the portal on another origin
  const probes: { method: string; cookie: boolean }[] = []; // the app's HEAD probes, for assertions (GET /_probes)
  const bulks = new Map<string, Bulk>(); // POST /_bulk rules, by prefix
  let latency = { ms: 0, jitterMs: 0 }; // POST /_latency
  let requests = 0; // GET /_stats
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', base);
    const p = url.pathname;
    const json = (o: unknown, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    const body = async () => { let b = ''; for await (const c of req) b += c; return b ? JSON.parse(b) : {}; };
    const userId = url.searchParams.get('userId') ?? '';
    // Test controls.
    if (p === '/_scenario' && req.method === 'POST') { next = await body(); return json({ ok: true }); }
    if (p === '/_sync' && req.method === 'POST') {
      const b = await body();
      for (const u of users.values()) for (const a of u.accounts.values()) if (!b.accountId || b.accountId === a.id) a.syncDone = !!b.completed;
      return json({ ok: true });
    }
    if (p === '/_fail' && req.method === 'POST') { fail = await body(); return json({ ok: true }); }
    // FIXES-LABELS: status (F-11, TR-5): POST /_remove {accountId, userId?} drops that account from the listing (an account
    // removed at the broker); {all: true, userId?} empties the listing (a disconnect). Without userId, every user's.
    if (p === '/_remove' && req.method === 'POST') {
      const b = await body();
      let n = 0;
      for (const [id, u] of users) {
        if (b.userId && b.userId !== id) continue;
        for (const k of [...u.accounts.keys()]) if (b.all || k === b.accountId) { u.accounts.delete(k); n++; }
      }
      return json({ ok: true, removed: n });
    }
    if (p === '/_post') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(`<!doctype html><title>post</title><script>parent.postMessage(JSON.parse(${JSON.stringify(url.searchParams.get('m') ?? 'null')}), '*');</script>`);
    }
    if (p === '/_probes') return json(probes);
    if (p === '/_bulk' && req.method === 'POST') {
      const b = await body();
      if (typeof b.prefix !== 'string' || !b.prefix) return json({ detail: 'prefix required' }, 400);
      if (b.clear) { bulks.delete(b.prefix); return json({ ok: true }); }
      bulks.set(b.prefix, { ...b, at: bulks.get(b.prefix)?.at ?? Date.now() });
      return json({ ok: true, users: b.to - b.from + 1 });
    }
    if (p === '/_latency' && req.method === 'POST') { const b = await body(); latency = { ms: Number(b.ms) || 0, jitterMs: Number(b.jitterMs) || 0 }; return json({ ok: true }); }
    if (p === '/_stats') return json({ requests });
    if (p === '/_state') {
      const out: Record<string, { connections: Record<string, string[]> }> = {};
      for (const [id, u] of users) {
        const connections: Record<string, string[]> = {};
        for (const a of u.accounts.values()) (connections[a.authorization] ??= []).push(a.id);
        out[id] = { connections };
      }
      return json(out);
    }
    // The portal: "Connect" links the pending scenario to the user and returns to customRedirect.
    if (p === '/portal') {
      const u = url.searchParams.get('u') ?? '';
      const r = url.searchParams.get('r') ?? '';
      if (req.method === 'POST' || url.searchParams.get('go') === '1') {
        const user = users.get(u);
        let auth = `auth-${++authSeq}`;
        if (user) {
          for (const a of next.accounts) {
            const rows = Array.isArray(a.activities) ? a.activities : a.seed !== undefined ? seededActivities(a.id, a.activities ?? 0, a.seed) : generateActivities(a.id, a.activities ?? 0);
            user.accounts.set(a.id, { ...a, authorization: a.authorization ?? auth, rows, syncDone: a.syncDone !== false });
          }
          auth = next.accounts[0]?.authorization ?? auth;
        }
        if (url.searchParams.get('json') === '1') return json({ authorizationId: auth }); // framed: the page posts the message
        res.writeHead(302, { location: r }); return res.end();
      }
      if (req.method === 'HEAD') probes.push({ method: 'HEAD', cookie: !!req.headers.cookie });
      if (next.portalDelayMs) await new Promise((done) => setTimeout(done, next.portalDelayMs));
      const action = `/portal?u=${encodeURIComponent(u)}&r=${encodeURIComponent(r)}`;
      const refuse = next.portalFrameHeaders ? { 'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'none'" }
        : next.portalFrameBlocked && req.method === 'GET' ? { 'content-security-policy': "frame-ancestors 'none'" } : {};
      res.writeHead(200, { 'content-type': 'text/html', ...refuse });
      return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Fake portal</title>
<style>body{font:16px system-ui;margin:16px}button{min-height:44px;margin:4px 0}</style>
<h1>Fake brokerage portal</h1><form method="post" action="${action}"><button>Connect</button></form>
<button type="button" id="cancel">Cancel</button>
<script>
const framed = window.self !== window.top;
document.getElementById('cancel').addEventListener('click', () => { if (framed) parent.postMessage('CLOSED', '*'); else location.assign(${JSON.stringify(r)}); });
if (framed) document.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const login = window.open('about:blank', 'broker-login', 'popup,width=420,height=600');
  if (!login) { parent.postMessage({ status: 'ERROR', errorCode: 'POPUP_BLOCKED', detail: 'The login window was blocked.' }, '*'); return; }
  login.close();
  const res = await fetch(${JSON.stringify(action)} + '&json=1', { method: 'POST' });
  const { authorizationId } = await res.json();
  parent.postMessage({ status: 'SUCCESS', authorizationId }, '*');
});
</script>`);
    }
    requests++;
    if (latency.ms || latency.jitterMs) await new Promise((r) => setTimeout(r, latency.ms + Math.random() * latency.jitterMs));
    if (fail.times > 0) { fail.times--; return json({ detail: 'forced failure' }, fail.status); }
    if (next.delayMs && p.includes('/activities')) await new Promise((r) => setTimeout(r, next.delayMs));
    // The vendor API surface the app uses.
    if (p === '/snapTrade/registerUser' && req.method === 'POST') {
      const b = await body();
      users.set(b.userId, { secret: `secret-${b.userId}`, accounts: new Map() });
      return json({ userId: b.userId, userSecret: `secret-${b.userId}` });
    }
    if (p === '/snapTrade/login' && req.method === 'POST') {
      const b = await body();
      if (!users.has(userId)) return json({ detail: 'unknown user' }, 401);
      if (b.connectionType !== 'read') return json({ detail: 'only read connections are accepted by this fake' }, 400);
      return json({ redirectURI: `${next.portalFrameHeaders ? refusingBase : base}/portal?u=${encodeURIComponent(userId)}&r=${encodeURIComponent(b.customRedirect ?? '')}` });
    }
    if (p === '/snapTrade/deleteUser' && req.method === 'DELETE') {
      if (!users.delete(userId)) return json({ detail: 'unknown user' }, 404);
      return json({ status: 'deleted', userId });
    }
    let user = users.get(userId);
    if (!user) {
      const bu = bulks.size ? bulkUser(bulks, userId) : null;
      if (bu?.slowMs) await new Promise((r) => setTimeout(r, bu.slowMs));
      if (bu?.failStatus) return json({ detail: 'forced failure' }, bu.failStatus);
      if (bu) user = { secret: '', accounts: bu.accounts as unknown as User['accounts'] };
    }
    if (!user) return json({ detail: 'unknown user' }, 401);
    if (p === '/accounts') {
      return json([...user.accounts.values()].map((a) => ({
        id: a.id, brokerage_authorization: a.authorization, name: null, number: '****', institution_name: a.institution ?? 'Fake Brokerage',
        created_date: '2024-01-01T00:00:00Z', sync_status: { transactions: { initial_sync_completed: a.syncDone } }, balance: { total: null }, is_paper: !!a.paper,
      })));
    }
    const act = p.match(/^\/accounts\/([^/]+)\/activities$/);
    if (act) {
      const a = user.accounts.get(decodeURIComponent(act[1]));
      if (!a) return json({ detail: 'unknown account' }, 404);
      const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 1000);
      // `startDate` (YYYY-MM-DD, inclusive), as the vendor documents it: the hourly sync's backfill window.
      const from = url.searchParams.get('startDate');
      const types = url.searchParams.get('type')?.split(',');
      const rows = a.rows.filter((r) => (!from || r.trade_date.slice(0, 10) >= from) && (!types || types.includes(r.type)));
      const data = rows.slice(offset, offset + limit).map((r) => ({ ...r, symbol: { symbol: r.symbol } }));
      return json({ data, pagination: { offset, limit, total: rows.length } });
    }
    const pos = p.match(/^\/accounts\/([^/]+)\/positions\/all$/);
    if (pos) {
      const a = user.accounts.get(decodeURIComponent(pos[1]));
      if (!a) return json({ detail: 'unknown account' }, 404);
      return json({ results: (a.positions ?? []).map((x) => ({ instrument: { kind: 'stock', id: x.symbol, symbol: x.symbol, raw_symbol: x.symbol }, units: String(x.units), price: String(x.price), cost_basis: String(x.cost_basis) })), data_freshness: { as_of: new Date().toISOString() } });
    }
    const del = p.match(/^\/connection\/([^/]+)$/);
    if (del && req.method === 'DELETE') {
      const id = decodeURIComponent(del[1]);
      let n = 0;
      for (const [k, a] of user.accounts) if (a.authorization === id) { user.accounts.delete(k); n++; }
      if (!n) return json({ detail: 'unknown connection' }, 404);
      return json({ detail: 'deleted' });
    }
    json({ detail: 'not found' }, 404);
  });
  // `localhost` (portalFrameHeaders) may resolve to ::1 first on some machines: listen there too when the host has IPv6.
  const v6 = createServer((req, res) => server.emit('request', req, res));
  v6.on('error', () => {});
  server.on('close', () => v6.close());
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => { v6.listen(port, '::1'); resolve({ server, base }); }));
}
