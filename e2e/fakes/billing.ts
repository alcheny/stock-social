// F-3: an in-repo fake of the payment processor's REST API (the subset lib/billing.ts calls) for unit and e2e tests.
// No real processor is ever contacted: the app is pointed here with STRIPE_API_BASE. In memory, deterministic ids.
//   REST: POST /v1/customers, DELETE /v1/customers/:id, POST /v1/checkout/sessions, POST /v1/billing_portal/sessions,
//         GET /v1/subscriptions/:id, GET /v1/subscriptions (status, limit, starting_after), DELETE /v1/subscriptions/:id,
//         GET /v1/invoices/:id, GET /v1/charges/:id, POST /v1/refunds. Idempotency-Key replays the first response.
//   Hosted pages (fictional): GET /checkout/:id with "Pay (test card)" and "Back"; GET /portal/:id with "Cancel
//         subscription", "Resume subscription", "Switch plan" and "Return". Both post to themselves, emit events and
//         redirect like the real pages.
//   Events: signed with the webhook secret and POSTed to `webhookUrl` (HTTP mode) or handed to `deliver` (unit mode).
//   Test controls: POST /_lifecycle {subscription, action} (renew, payment_failed, payment_recovered, unpaid, cancel_now,
//         refund_full, refund_partial, dispute, dispute_won, trial_will_end, resume), GET /_state, POST /_fail
//         {status, times}, POST /_clock {now}.
// Fictional data only (POLICY P2): no names, emails or card numbers are ever created or stored.
import { createServer, type Server } from 'node:http';
import { API_VERSION, signPayload } from '../../lib/billing.ts';

type Obj = Record<string, unknown>;
export type FakeSub = {
  id: string; object: 'subscription'; customer: string; status: string; cancel_at_period_end: boolean;
  current_period_start: number; current_period_end: number; start_date: number; latest_invoice: string; livemode: boolean; canceled_at: number | null;
  items: { data: { price: { id: string }; current_period_start: number; current_period_end: number }[] }; metadata: Obj;
};
export type FakeEvent = { id: string; type: string; livemode: boolean; created: number; data: { object: Obj } };

export type BillingFakeOptions = {
  webhookSecret: string; prices: { monthly: string; annual: string };
  amounts?: Record<string, number>; // price id → cents
  base?: string; webhookUrl?: string; deliver?: (raw: string, signature: string) => Promise<unknown>;
  now?: () => number; // ms
};

export function createBillingFake(o: BillingFakeOptions) {
  const amounts: Record<string, number> = o.amounts ?? { [o.prices.monthly]: 999, [o.prices.annual]: 9999 };
  let clock = o.now ?? (() => Date.now());
  const sec = () => Math.floor(clock() / 1000);
  let seq = 0;
  const run = Math.random().toString(36).slice(2, 8); // ids stay unique across fake instances (rows outlive a test run)
  const id = (p: string) => `${p}_fake${run}${String(++seq).padStart(6, '0')}`;
  const customers = new Map<string, Obj>(), subs = new Map<string, FakeSub>(), invoices = new Map<string, Obj>(), charges = new Map<string, Obj>();
  const checkouts = new Map<string, Obj>(), portals = new Map<string, Obj>(), refunds: Obj[] = [];
  const idem = new Map<string, { status: number; body: Obj }>();
  const events: FakeEvent[] = [];
  const delivered: { id: string; status: number }[] = [];
  const calls: { method: string; path: string; body: string }[] = [];
  let fail = { status: 500, times: 0 };
  let failPath: { re: RegExp; method: string; status: number; times: number } | null = null; // targeted failures (unit tests)

  const periodEnd = (start: number, priceId: string) => {
    const d = new Date(start * 1000);
    if (priceId === o.prices.annual) d.setUTCFullYear(d.getUTCFullYear() + 1); else d.setUTCMonth(d.getUTCMonth() + 1);
    return Math.floor(d.getTime() / 1000);
  };

  async function emit(type: string, object: Obj) {
    const ev: FakeEvent = { id: id('evt'), type, livemode: false, created: sec(), data: { object: structuredClone(object) } };
    events.push(ev);
    await send(ev);
    return ev;
  }
  async function send(ev: FakeEvent, signature?: string) {
    const raw = JSON.stringify(ev);
    const sig = signature ?? signPayload(raw, o.webhookSecret, sec());
    let status = 0;
    try {
      if (o.deliver) { const r = await o.deliver(raw, sig) as { status?: number } | undefined; status = r?.status ?? 200; }
      else if (o.webhookUrl) status = (await fetch(o.webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': sig }, body: raw })).status;
    } catch { status = -1; }
    delivered.push({ id: ev.id, status });
    return status;
  }

  function pay(sub: FakeSub, amountCents?: number, ok = true) {
    const price = sub.items.data[0].price.id;
    const pi = id('pi');
    const invId = id('in');
    const ch = { id: id('ch'), object: 'charge', customer: sub.customer, invoice: invId, amount: amountCents ?? amounts[price], amount_refunded: 0, payment_intent: pi, paid: ok };
    charges.set(ch.id, ch);
    const inv = { id: invId, object: 'invoice', customer: sub.customer, subscription: sub.id, amount_paid: ok ? ch.amount : 0, payment_intent: pi, charge: ch.id, status: ok ? 'paid' : 'open' };
    invoices.set(inv.id, inv);
    sub.latest_invoice = inv.id;
    return inv;
  }
  function newSub(customer: string, priceId: string): FakeSub {
    const start = sec(), end = periodEnd(start, priceId);
    const sub: FakeSub = { id: id('sub'), object: 'subscription', customer, status: 'active', cancel_at_period_end: false, canceled_at: null, start_date: start, current_period_start: start, current_period_end: end, latest_invoice: '', livemode: false, items: { data: [{ price: { id: priceId }, current_period_start: start, current_period_end: end }] }, metadata: {} };
    subs.set(sub.id, sub);
    return sub;
  }
  function setPeriod(sub: FakeSub, start: number) {
    const end = periodEnd(start, sub.items.data[0].price.id);
    sub.current_period_start = start; sub.current_period_end = end;
    sub.items.data[0].current_period_start = start; sub.items.data[0].current_period_end = end;
  }

  async function lifecycle(subId: string, action: string): Promise<Obj> {
    const sub = subs.get(subId);
    if (!sub) return { error: 'no such subscription' };
    switch (action) {
      case 'renew': { setPeriod(sub, sub.current_period_end); sub.status = 'active'; const inv = pay(sub); await emit('invoice.paid', inv); await emit('customer.subscription.updated', sub); break; }
      case 'payment_failed': { const inv = pay(sub, undefined, false); sub.status = 'past_due'; await emit('invoice.payment_failed', inv); await emit('customer.subscription.updated', sub); break; }
      case 'payment_recovered': { const inv = pay(sub); sub.status = 'active'; await emit('invoice.paid', inv); await emit('customer.subscription.updated', sub); break; }
      case 'unpaid': sub.status = 'unpaid'; await emit('customer.subscription.updated', sub); break;
      case 'cancel_now': sub.status = 'canceled'; sub.canceled_at = sec(); await emit('customer.subscription.deleted', sub); break;
      case 'resume': sub.cancel_at_period_end = false; sub.canceled_at = null; await emit('customer.subscription.resumed', sub); break;
      case 'trial_will_end': await emit('customer.subscription.trial_will_end', sub); break;
      case 'refund_full': case 'refund_partial': {
        const inv = invoices.get(sub.latest_invoice)!; const ch = charges.get(inv.charge as string)!;
        ch.amount_refunded = action === 'refund_full' ? ch.amount : Math.floor((ch.amount as number) / 2);
        await emit('charge.refunded', ch); break;
      }
      case 'dispute': case 'dispute_won': {
        const inv = invoices.get(sub.latest_invoice)!;
        await emit(action === 'dispute' ? 'charge.dispute.created' : 'charge.dispute.closed', { id: id('dp'), object: 'dispute', charge: inv.charge, status: action === 'dispute' ? 'needs_response' : 'won' });
        break;
      }
      default: return { error: `unknown action ${action}` };
    }
    return sub as unknown as Obj;
  }

  const json = (status: number, body: Obj) => ({ status, body: JSON.stringify(body), type: 'application/json' });
  const html = (body: string, status = 200) => ({ status, body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Test processor</title></head><body>${body}</body></html>`, type: 'text/html' });
  const redirect = (to: string) => ({ status: 303, body: '', type: 'text/plain', location: to });
  const notFound = () => json(404, { error: { code: 'resource_missing' } });
  type Out = { status: number; body: string; type: string; location?: string };

  async function handle(method: string, rawUrl: string, body: string, headers: Record<string, string | undefined>): Promise<Out> {
    const url = new URL(rawUrl, 'http://fake');
    const p = url.pathname;
    const form = new URLSearchParams(method === 'GET' ? url.search : body);
    if (p.startsWith('/v1/')) {
      calls.push({ method, path: p, body: method === 'GET' ? url.search : body });
      if (!/^Bearer (sk|rk)_test_/.test(headers.authorization ?? '')) return json(401, { error: { code: 'invalid_api_key' } });
      if (headers['stripe-version'] !== API_VERSION) return json(400, { error: { code: 'api_version_invalid' } });
      if (fail.times > 0) { fail.times--; return json(fail.status, { error: { code: 'fake_failure' } }); }
      if (failPath && failPath.times > 0 && failPath.method === method && failPath.re.test(p)) { failPath.times--; return json(failPath.status, { error: { code: 'fake_failure' } }); }
      const key = headers['idempotency-key'];
      if (key && idem.has(key)) { const r = idem.get(key)!; return json(r.status, r.body); }
      const out = await api(method, p, form);
      if (key && method === 'POST') idem.set(key, { status: out.status, body: JSON.parse(out.body) });
      return out;
    }
    let m: RegExpMatchArray | null;
    if ((m = p.match(/^\/checkout\/([\w]+)(\/pay)?$/))) {
      const s = checkouts.get(m[1]); if (!s) return html('<p>Not found</p>', 404);
      if (method === 'POST' && m[2]) {
        if (!s.subscription) {
          const sub = newSub(s.customer as string, s.price as string);
          sub.metadata = (s.metadata as Obj) ?? {};
          const inv = pay(sub); s.subscription = sub.id; s.status = 'complete';
          await emit('checkout.session.completed', s); await emit('customer.subscription.created', sub); await emit('invoice.paid', inv);
        }
        return redirect(s.success_url as string);
      }
      const amt = ((amounts[s.price as string] ?? 0) / 100).toFixed(2);
      return html(`<main><h1>Test checkout</h1><p>Subscription: $${amt} plus tax $0.00. Total today: $${amt}.</p><p>Test mode, no real charge.</p>
        <form method="post" action="/checkout/${m[1]}/pay"><button>Pay (test card)</button></form><p><a href="${s.cancel_url}">Back</a></p></main>`);
    }
    if ((m = p.match(/^\/portal\/([\w]+)(?:\/(cancel|resume|switch))?$/))) {
      const s = portals.get(m[1]); if (!s) return html('<p>Not found</p>', 404);
      const live = [...subs.values()].filter((x) => x.customer === s.customer && !['canceled', 'incomplete_expired'].includes(x.status));
      if (method === 'POST' && m[2]) {
        for (const sub of live) {
          if (m[2] === 'cancel') { sub.cancel_at_period_end = true; sub.canceled_at = sec(); }
          if (m[2] === 'resume') { sub.cancel_at_period_end = false; sub.canceled_at = null; }
          if (m[2] === 'switch') { const to = sub.items.data[0].price.id === o.prices.monthly ? o.prices.annual : o.prices.monthly; sub.items.data[0].price.id = to; setPeriod(sub, sec()); pay(sub); }
          await emit('customer.subscription.updated', sub);
        }
        return redirect(`/portal/${m[1]}`);
      }
      const lines = live.map((x) => `<li>${x.items.data[0].price.id === o.prices.annual ? 'Yearly' : 'Monthly'} · ${x.cancel_at_period_end ? 'cancels at period end' : 'renews'}</li>`).join('');
      return html(`<main><h1>Test billing portal</h1><ul>${lines || '<li>No subscription</li>'}</ul>
        <form method="post" action="/portal/${m[1]}/cancel"><button>Cancel subscription</button></form>
        <form method="post" action="/portal/${m[1]}/resume"><button>Resume subscription</button></form>
        <form method="post" action="/portal/${m[1]}/switch"><button>Switch plan</button></form>
        <p><a href="${s.return_url}">Return</a></p></main>`);
    }
    if (p === '/_lifecycle' && method === 'POST') { const b = JSON.parse(body || '{}'); return json(200, await lifecycle(b.subscription, b.action)); }
    if (p === '/_fail' && method === 'POST') { fail = { status: 500, times: 0, ...JSON.parse(body || '{}') }; return json(200, {}); }
    if (p === '/_clock' && method === 'POST') { const n = Number(JSON.parse(body || '{}').now); clock = () => n; return json(200, {}); }
    if (p === '/_state') return json(200, state() as unknown as Obj);
    return notFound();
  }

  async function api(method: string, p: string, f: URLSearchParams): Promise<Out> {
    let m: RegExpMatchArray | null;
    if (p === '/v1/customers' && method === 'POST') {
      const c = { id: id('cus'), object: 'customer', metadata: { ref: f.get('metadata[ref]') }, keys: [...f.keys()] };
      customers.set(c.id, c); return json(200, c);
    }
    if ((m = p.match(/^\/v1\/customers\/(\w+)$/)) && method === 'DELETE') {
      if (!customers.delete(m[1])) return notFound();
      return json(200, { id: m[1], deleted: true });
    }
    if (p === '/v1/checkout/sessions' && method === 'POST') {
      const customer = f.get('customer'); const price = f.get('line_items[0][price]');
      if (!customer || !customers.has(customer) || !price || !(price in amounts)) return json(400, { error: { code: 'parameter_invalid' } });
      const s = { id: id('cs'), object: 'checkout.session', customer, price, mode: f.get('mode'), success_url: f.get('success_url'), cancel_url: f.get('cancel_url'),
        client_reference_id: f.get('client_reference_id'), automatic_tax: f.get('automatic_tax[enabled]') === 'true', metadata: { ref: f.get('subscription_data[metadata][ref]') }, subscription: null as string | null, status: 'open', url: '' };
      s.url = `${o.base ?? ''}/checkout/${s.id}`;
      checkouts.set(s.id, s); return json(200, s);
    }
    if (p === '/v1/billing_portal/sessions' && method === 'POST') {
      const customer = f.get('customer');
      if (!customer || !customers.has(customer)) return json(400, { error: { code: 'parameter_invalid' } });
      const s = { id: id('bps'), object: 'billing_portal.session', customer, return_url: f.get('return_url'), url: '',
        flow: f.get('flow_data[type]'), flowSubscription: f.get('flow_data[subscription_cancel][subscription]') };
      s.url = `${o.base ?? ''}/portal/${s.id}`;
      portals.set(s.id, s); return json(200, s);
    }
    if (p === '/v1/subscriptions' && method === 'GET') {
      const st = f.get('status'); // no status: every subscription that is not canceled (the processor's default)
      const all = [...subs.values()].filter((s) => (st === 'all' ? true : st ? s.status === st : s.status !== 'canceled'));
      const after = f.get('starting_after'); const limit = Number(f.get('limit') ?? 10);
      const start = after ? all.findIndex((s) => s.id === after) + 1 : 0;
      const data = all.slice(start, start + limit);
      return json(200, { object: 'list', data, has_more: start + limit < all.length });
    }
    if ((m = p.match(/^\/v1\/subscriptions\/(\w+)$/))) {
      const sub = subs.get(m[1]); if (!sub) return notFound();
      if (method === 'DELETE') { if (sub.status !== 'canceled') { sub.status = 'canceled'; sub.canceled_at = sec(); await emit('customer.subscription.deleted', sub); } }
      return json(200, sub as unknown as Obj);
    }
    if ((m = p.match(/^\/v1\/invoices\/(\w+)$/))) { const x = invoices.get(m[1]); return x ? json(200, x) : notFound(); }
    if ((m = p.match(/^\/v1\/charges\/(\w+)$/))) { const x = charges.get(m[1]); return x ? json(200, x) : notFound(); }
    if (p === '/v1/refunds' && method === 'GET') {
      return json(200, { object: 'list', data: refunds.filter((r) => r.payment_intent === f.get('payment_intent')), has_more: false });
    }
    if (p === '/v1/refunds' && method === 'POST') {
      const pi = f.get('payment_intent'); const amount = Number(f.get('amount'));
      const ch = [...charges.values()].find((c) => c.payment_intent === pi);
      if (!ch || !(amount > 0) || amount > (ch.amount as number) - (ch.amount_refunded as number)) return json(400, { error: { code: 'parameter_invalid' } });
      ch.amount_refunded = (ch.amount_refunded as number) + amount;
      const r = { id: id('re'), object: 'refund', payment_intent: pi, amount, metadata: { subscription: f.get('metadata[subscription]') } };
      refunds.push(r);
      await emit('charge.refunded', ch);
      return json(200, r);
    }
    return notFound();
  }

  function state() {
    return { customers: [...customers.values()], subscriptions: [...subs.values()], refunds, events: events.map((e) => ({ id: e.id, type: e.type })), delivered, checkouts: [...checkouts.values()], calls };
  }

  // A fetch for unit tests: lib/billing.ts's billingDeps.fetch = fake.fetch.
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const h: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => { h[k] = v; });
    const out = await handle(init?.method ?? 'GET', url, typeof init?.body === 'string' ? init.body : '', h);
    return new Response(out.body, { status: out.status, headers: { 'content-type': out.type, ...(out.location ? { location: out.location } : {}) } });
  }) as typeof fetch;

  return {
    handle, fetch: fakeFetch, lifecycle, emit, send, state, events, subs, charges, refunds, calls,
    setNow: (ms: number) => { clock = () => ms; },
    fail: (status: number, times: number) => { fail = { status, times }; },
    failOn: (method: string, re: RegExp, status: number, times: number) => { failPath = { method, re, status, times }; },
    newPaidSubscription: async (customer: string, plan: 'monthly' | 'annual') => {
      const sub = newSub(customer, o.prices[plan]); const inv = pay(sub);
      await emit('customer.subscription.created', sub); await emit('invoice.paid', inv); return sub;
    },
  };
}
export type BillingFake = ReturnType<typeof createBillingFake>;

export function startBillingFake(port: number, o: Omit<BillingFakeOptions, 'base'>): Promise<{ server: Server; base: string; fake: BillingFake }> {
  const base = `http://127.0.0.1:${port}`;
  const fake = createBillingFake({ ...o, base });
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const h: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) h[k] = Array.isArray(v) ? v[0] : v;
    const out = await fake.handle(req.method ?? 'GET', req.url ?? '/', Buffer.concat(chunks).toString('utf8'), h);
    res.writeHead(out.status, { 'content-type': out.type, ...(out.location ? { location: out.location } : {}) });
    res.end(out.body);
  });
  return new Promise((ok, bad) => { server.once('error', bad); server.listen(port, '127.0.0.1', () => ok({ server, base, fake })); });
}
