// In-repo fake of the integrated vendor's API for tests: register/login/portal, accounts (with the paper flag and the
// initial-sync flag), paged activities, positions, delete connection and delete user, all in memory. The app's SDK is
// pointed here with SNAPTRADE_BASE_URL; no real vendor is ever contacted. Test controls live under /_ paths:
//   POST /_scenario {accounts:[{id, authorization?, institution?, paper?, activities?: number | rows, syncDone?}], delayMs?, portalDelayMs?}
//     the accounts the next portal "Connect" links (one authorization per distinct `authorization`, default 'auth-<n>');
//     portalDelayMs holds the portal page that long (the S3 loading states); portalFrameBlocked serves the portal page with
//     `Content-Security-Policy: frame-ancestors 'none'`, so a browser refuses to frame it (the frame loads blank) while a
//     top-level visit (the redirect flow) works
//   GET  /_post?m=<json>                           a page on the vendor's origin that posts `m` to its parent (a second,
//     vendor-origin frame for the event.source check)
// The portal page behaves like the vendor's (PR-2b): opened as a page, "Connect" links and redirects to customRedirect;
// loaded in an iframe it ignores customRedirect, opens the "broker login" in a popup it manages, and posts window
// messages to its parent: {status:'SUCCESS', authorizationId} after linking, {status:'ERROR', errorCode:'POPUP_BLOCKED'}
// when window.open returns null (a blocked popup), 'CLOSED' from its own Cancel.
//   POST /_sync {completed: boolean, accountId?}   flips initial_sync_completed
//   POST /_fail {status: number, times: number}    the next `times` API calls answer `status`
//   GET  /_state                                   users, their connections and accounts, for assertions
import { createServer, type Server } from 'node:http';

export type FakeActivity = { id: string; symbol: string; type: 'BUY' | 'SELL'; units: number; price: number; fee?: number; trade_date: string; option_symbol?: unknown };
export type FakeAccount = { id: string; authorization?: string; institution?: string; paper?: boolean; activities?: number | FakeActivity[]; syncDone?: boolean; positions?: { symbol: string; units: number; price: number; cost_basis: number }[] }; // price and cost_basis per unit, as the SDK documents
type Scenario = { accounts: FakeAccount[]; delayMs?: number; portalDelayMs?: number; portalFrameBlocked?: boolean };
type User = { secret: string; accounts: Map<string, FakeAccount & { authorization: string; rows: FakeActivity[]; syncDone: boolean }> };

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

export function startVendorFake(port: number): Promise<{ server: Server; base: string }> {
  const users = new Map<string, User>();
  let next: Scenario = { accounts: [{ id: 'acct-default', activities: 4, syncDone: true }] };
  let authSeq = 0;
  let fail: { status: number; times: number } = { status: 500, times: 0 };
  const base = `http://127.0.0.1:${port}`;
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
    if (p === '/_post') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(`<!doctype html><title>post</title><script>parent.postMessage(JSON.parse(${JSON.stringify(url.searchParams.get('m') ?? 'null')}), '*');</script>`);
    }
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
            const rows = Array.isArray(a.activities) ? a.activities : generateActivities(a.id, a.activities ?? 0);
            user.accounts.set(a.id, { ...a, authorization: a.authorization ?? auth, rows, syncDone: a.syncDone !== false });
          }
          auth = next.accounts[0]?.authorization ?? auth;
        }
        if (url.searchParams.get('json') === '1') return json({ authorizationId: auth }); // framed: the page posts the message
        res.writeHead(302, { location: r }); return res.end();
      }
      if (next.portalDelayMs) await new Promise((done) => setTimeout(done, next.portalDelayMs));
      const action = `/portal?u=${encodeURIComponent(u)}&r=${encodeURIComponent(r)}`;
      res.writeHead(200, { 'content-type': 'text/html', ...(next.portalFrameBlocked ? { 'content-security-policy': "frame-ancestors 'none'" } : {}) });
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
      return json({ redirectURI: `${base}/portal?u=${encodeURIComponent(userId)}&r=${encodeURIComponent(b.customRedirect ?? '')}` });
    }
    if (p === '/snapTrade/deleteUser' && req.method === 'DELETE') {
      if (!users.delete(userId)) return json({ detail: 'unknown user' }, 404);
      return json({ status: 'deleted', userId });
    }
    const user = users.get(userId);
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
      const data = a.rows.slice(offset, offset + limit).map((r) => ({ ...r, symbol: { symbol: r.symbol } }));
      return json({ data, pagination: { offset, limit, total: a.rows.length } });
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
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, base })));
}
