// F-3 · Viewer subscriptions (docs/features/F-3-viewer-subscriptions.md; the legal committee's conditions in
// docs/features/logs/F-3/committee-2026-11-01.md). The only file that talks to the payment processor (Stripe), over its
// REST API with fetch: no SDK. Same isolation rule as lib/broker.ts.
//
// - The processor is the source of truth for money; the app's own `subscriptions` row is the source of truth for
//   entitlements (`entitled`), written only from verified webhooks and the nightly reconciliation.
// - Test mode only: a live key is refused unless the owner's switch LIVE_BILLING=on is set.
// - The app keeps ids, plan, status and dates only: no event payload, no card, name, email or address (condition 20).
// - Traders (a consented broker connection) have Record tools included, never see a price and never become processor
//   customers through it (condition 14).
// - The app sends no email: every billing notice is the processor's (condition 21).
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { sql } from './db.ts';
import { BILLING } from './copy.ts';
import { DISCLAIMER } from './share.ts';
import { connectAllowed } from './privacy-gate-data.ts';
import { logSafe } from './privacy-log.ts';

export type Plan = 'monthly' | 'annual';
export const PLANS: Record<Plan, { cents: number; label: string; interval: 'month' | 'year' }> = {
  monthly: { cents: 999, label: '$9.99', interval: 'month' },
  annual: { cents: 9999, label: '$99.99', interval: 'year' },
};
export const isPlan = (v: unknown): v is Plan => v === 'monthly' || v === 'annual';
export type Status = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused' | 'incomplete';

export const GRACE_DAYS = 7; // condition 19
export const ANNUAL_REFUND_DAYS = 14; // condition 15's refund line
export const EVENT_RETENTION_DAYS = 35; // condition 20
export const CONSENT_RETENTION_YEARS = 3; // condition 16
export const SIGNATURE_TOLERANCE_S = 300;
const DAY = 86_400_000;

// ---- configuration --------------------------------------------------------------------------------------------------

export type BillingConfig = {
  key: string; live: boolean; base: string; webhookSecrets: string[];
  prices: Record<Plan, string>;
};

export class BillingConfigError extends Error {}

// Null when billing is not configured (the pages then say subscriptions are not available). Throws on a live key
// without LIVE_BILLING=on, or a key of neither kind.
export function billingConfig(env: Record<string, string | undefined> = process.env): BillingConfig | null {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  const live = /^(sk|rk)_live_/.test(key);
  if (live && env.LIVE_BILLING !== 'on') throw new BillingConfigError('Live billing key refused: billing runs in test mode unless LIVE_BILLING=on.');
  if (!live && !/^(sk|rk)_test_/.test(key)) throw new BillingConfigError('STRIPE_SECRET_KEY is neither a test nor a live key.');
  const monthly = env.STRIPE_PRICE_MONTHLY?.trim(), annual = env.STRIPE_PRICE_ANNUAL?.trim();
  const webhookSecrets = (env.STRIPE_WEBHOOK_SECRET ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!monthly || !annual || !webhookSecrets.length) throw new BillingConfigError('Billing needs STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL and STRIPE_WEBHOOK_SECRET.');
  // A live key only ever goes to the processor itself: the test-only base override is refused with it (code review nit 7).
  if (live && env.STRIPE_API_BASE?.trim()) throw new BillingConfigError('STRIPE_API_BASE is for the in-repo fake only; it is refused with a live key.');
  return { key, live, base: (env.STRIPE_API_BASE?.trim() || 'https://api.stripe.com').replace(/\/$/, ''), webhookSecrets, prices: { monthly, annual } };
}

// Pages call this: never throws, so a misconfigured key shows "not available" instead of a crash (the error is logged
// without the key).
export function billingAvailable(): BillingConfig | null {
  // Logged as the error's class only (BillingConfigError), never the key.
  try { return billingConfig(); } catch (e) { console.error('billing disabled', logSafe(e)); return null; }
}
export const testMode = (c: BillingConfig | null) => !!c && !c.live;

function cfg(): BillingConfig {
  const c = billingConfig();
  if (!c) throw new BillingConfigError('Billing is not configured.');
  return c;
}

// Tests swap these (the in-repo fake processor, e2e/fakes/billing.ts, provides a fetch).
export const billingDeps: { fetch: typeof fetch; now: () => Date; sleep: (ms: number) => Promise<void> } = {
  fetch: (...a) => fetch(...a), now: () => new Date(), sleep: (ms) => new Promise((ok) => setTimeout(ok, ms)),
};

// ---- the processor's REST API ---------------------------------------------------------------------------------------

export class VendorError extends Error {
  status: number; code: string | null;
  constructor(status: number, code: string | null) { super(`billing vendor error ${status}${code ? ` (${code})` : ''}`); this.status = status; this.code = code; }
}

type Params = { [k: string]: string | number | boolean | undefined | Params | (string | Params)[] };
export function formEncode(p: Params, prefix = ''): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => out.push(typeof x === 'object' ? formEncode(x, `${key}[${i}]`) : `${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(x)}`));
    else if (typeof v === 'object') out.push(formEncode(v, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.filter(Boolean).join('&');
}

type Obj = Record<string, unknown>;
async function vendor(method: 'GET' | 'POST' | 'DELETE', path: string, params?: Params, idempotencyKey?: string): Promise<Obj> {
  const c = cfg();
  const body = params ? formEncode(params) : '';
  const url = `${c.base}${path}${method === 'GET' && body ? `?${body}` : ''}`;
  const headers: Record<string, string> = { authorization: `Bearer ${c.key}`, 'stripe-version': API_VERSION };
  if (method !== 'GET' && body) headers['content-type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const res = await billingDeps.fetch(url, { method, headers, body: method !== 'GET' && body ? body : undefined, signal: AbortSignal.timeout(20_000) });
  const json = (await res.json().catch(() => ({}))) as Obj;
  if (!res.ok) throw new VendorError(res.status, ((json.error as Obj | undefined)?.code as string | undefined) ?? null);
  return json;
}
const enc = encodeURIComponent;
// Pinned (engineer D6): the shapes read below (subscription.current_period_*, invoice.payment_intent and .charge) are
// this version's; the fake processor answers in exactly this shape and refuses any other version.
export const API_VERSION = '2024-06-20';

// ---- references, customers, consent ---------------------------------------------------------------------------------

// The processor sees an opaque reference, never a user id, handle or email (condition 22).
export function billingRef(userId: number): string {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret) throw new BillingConfigError('APP_SECRET_KEY is not set.');
  return `ss_${createHmac('sha256', secret).update(`billing:${userId}`).digest('hex').slice(0, 24)}`;
}

// A trader: a consented broker connection, connected or frozen (any state after consent), or broker-sourced records.
// Depends on nothing but the bare connection (condition 14).
export async function isTrader(userId: number): Promise<boolean> {
  const [r] = await sql`select (exists (select 1 from connections where user_id = ${userId} and consent_at is not null)
    or exists (select 1 from activities where user_id = ${userId} and source = 'snaptrade')) as t`;
  return !!r?.t;
}

export const CUSTOMER_RETRY_MS = 500;
async function ensureCustomer(userId: number): Promise<string> {
  const stored = async () => (await sql`select vendor_customer_id from billing_customers where user_id = ${userId}`)[0]?.vendor_customer_id as string | undefined;
  const have = await stored();
  if (have) return have;
  const ref = billingRef(userId);
  const create = () => vendor('POST', '/v1/customers', { metadata: { ref } }, `customer-${ref}`);
  const inFlight = (e: unknown) => e instanceof VendorError && e.status === 409;
  let c: Obj;
  try { c = await create(); } catch (e) {
    // Known-limits sweep 2: the same idempotency key still in flight (two tabs, a double submit) is answered 409. One
    // short wait, then the first request's stored customer, or one retry (a replay of that request), then the stored
    // customer again; never a loop. A checkout that still fails can be tried again.
    if (!inFlight(e)) throw e;
    await billingDeps.sleep(CUSTOMER_RETRY_MS);
    const won = await stored();
    if (won) return won;
    try { c = await create(); } catch (e2) { const late = inFlight(e2) ? await stored() : undefined; if (late) return late; throw e2; }
  }
  // Two checkouts at once (two tabs, a double submit) get the same customer (one idempotency key per user) and insert
  // the same row. With `on conflict (user_id)` only, the one that lost the race on the vendor_customer_id index raised
  // 23505 instead of reading the winner's row (CI, PR #52). No target: every unique index is an arbiter, and both
  // conflicts mean this user's own customer.
  await sql`insert into billing_customers (user_id, vendor_customer_id) values (${userId}, ${c.id as string}) on conflict do nothing`;
  const [row] = await sql`select vendor_customer_id from billing_customers where user_id = ${userId}`;
  return row.vendor_customer_id as string;
}

export const DISCLOSURE_VERSION = '2026-11-01';
// The next charge if the subscriber pays today: one month or one year on, in UTC.
export function nextCharge(plan: Plan, now: Date): Date {
  const d = new Date(now);
  if (plan === 'annual') d.setUTCFullYear(d.getUTCFullYear() + 1); else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}
// The full text the Subscribe screen shows for a plan, in order (committee condition 15); the consent record hashes it.
export function disclosureText(plan: Plan, now: Date): string {
  return [
    BILLING.title, DISCLAIMER, BILLING.whatYouGet,
    plan === 'annual' ? BILLING.planAnnual : BILLING.planMonthly,
    plan === 'annual' ? BILLING.renewAnnual(nextCharge('annual', now)) : BILLING.renewMonthly(nextCharge('monthly', now)),
    BILLING.noTrial, BILLING.cancelHow, BILLING.refund, BILLING.card,
    plan === 'annual' ? BILLING.agreeAnnual : BILLING.agreeMonthly,
    plan === 'annual' ? BILLING.subscribeAnnual : BILLING.subscribeMonthly,
  ].join('\n');
}
export const disclosureHash = (text: string) => createHash('sha256').update(`${DISCLOSURE_VERSION}\n${text}`).digest('hex');

export class CheckoutRefused extends Error {
  reason: 'trader' | 'subscribed' | 'consent' | 'closed';
  constructor(reason: 'trader' | 'subscribed' | 'consent' | 'closed') { super(`checkout refused: ${reason}`); this.reason = reason; }
}

// The launch gate (lib/launch-gate.ts): while sign-up is closed, only an allowlisted account may check out, exactly as
// for a broker connection (privacy work, 2026-11-01; POLICY P6).
export async function checkoutOpen(userId: number): Promise<boolean> {
  const [u] = await sql`select id, handle from users where id = ${userId} and deleted_at is null`;
  return !!u && connectAllowed({ id: u.id as number, handle: u.handle as string });
}

// D10: return URLs come from the configured site URL, never a request's Host header.
export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  const site = env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return (site || (vercel ? (/^https?:\/\//.test(vercel) ? vercel : `https://${vercel}`) : 'http://localhost:3000')).replace(/\/+$/, '');
}

// Hosted checkout. `disclosure` is the full text shown above the button, which the consent record hashes (condition 16).
export async function startCheckout(i: { userId: number; plan: Plan; agreed: boolean; disclosure: string; origin: string }): Promise<string> {
  const c = cfg();
  if (!i.agreed) throw new CheckoutRefused('consent');
  if (!(await checkoutOpen(i.userId))) throw new CheckoutRefused('closed');
  if (await isTrader(i.userId)) throw new CheckoutRefused('trader');
  const [live] = await sql`select 1 from subscriptions where user_id = ${i.userId} and status in ('trialing', 'active', 'past_due', 'incomplete')`;
  if (live) throw new CheckoutRefused('subscribed');
  // D3: an ended row whose subscription the processor still holds (unpaid, paused) is canceled there first, so an old
  // invoice can never succeed beside the new subscription.
  const stale = await sql`select vendor_subscription_id from subscriptions where user_id = ${i.userId} and status in ('unpaid', 'paused')`;
  for (const x of stale) await cancelWithRefund(i.userId, { id: x.vendor_subscription_id as string } as VendorSub, 0, 'grace');
  const customer = await ensureCustomer(i.userId);
  const [consent] = await sql`insert into billing_consents (user_id, vendor_customer_id, plan, disclosure_version, disclosure_hash, livemode)
    values (${i.userId}, ${customer}, ${i.plan}, ${DISCLOSURE_VERSION}, ${disclosureHash(i.disclosure)}, ${c.live}) returning id`;
  const ref = billingRef(i.userId);
  const session = await vendor('POST', '/v1/checkout/sessions', {
    mode: 'subscription', customer, client_reference_id: ref,
    line_items: [{ price: c.prices[i.plan], quantity: 1 }],
    automatic_tax: { enabled: true }, customer_update: { address: 'auto' },
    subscription_data: { metadata: { ref } },
    success_url: `${i.origin}/account?activating=1`, cancel_url: `${i.origin}/tools#subscribe`,
  }, `checkout-${ref}-${consent.id}`);
  return session.url as string;
}

// `cancel`: the portal opens straight on canceling the live subscription ("as easy as sign-up"), else its home page.
export async function portalUrl(userId: number, origin: string, cancel = false): Promise<string | null> {
  const [row] = await sql`select vendor_customer_id from billing_customers where user_id = ${userId}`;
  if (!row) return null;
  const [live] = cancel ? await sql`select vendor_subscription_id from subscriptions where user_id = ${userId} and status in ('trialing', 'active', 'past_due') order by id desc limit 1` : [];
  const flow = live ? { flow_data: { type: 'subscription_cancel', subscription_cancel: { subscription: live.vendor_subscription_id as string } } } : {};
  const s = await vendor('POST', '/v1/billing_portal/sessions', { customer: row.vendor_customer_id as string, return_url: `${origin}/account`, ...flow });
  return s.url as string;
}

// ---- entitlements (the app's own rows only) -------------------------------------------------------------------------

export type SubscriptionRow = {
  plan: Plan; status: Status; current_period_start: Date | null; current_period_end: Date | null; cancel_at_period_end: boolean;
  grace_until: Date | null; disputed_at: Date | null; ended_reason: string | null; updated_at: Date;
};

// Pure: whether a row grants paid features at `now`.
export function rowEntitles(r: Pick<SubscriptionRow, 'status' | 'grace_until' | 'disputed_at' | 'current_period_end' | 'cancel_at_period_end'> | null, now: Date): boolean {
  if (!r || r.disputed_at) return false;
  if (r.cancel_at_period_end && r.current_period_end && r.current_period_end <= now) return false;
  if (r.status === 'active' || r.status === 'trialing') return true;
  return r.status === 'past_due' && !!r.grace_until && r.grace_until > now;
}

// The latest row for the account page (live first, then the most recent ended one).
export async function subscriptionFor(userId: number): Promise<SubscriptionRow | null> {
  const [r] = await sql<SubscriptionRow[]>`select plan, status, current_period_start, current_period_end, cancel_at_period_end, grace_until, disputed_at, ended_reason, updated_at
    from subscriptions where user_id = ${userId}
    order by (status in ('trialing', 'active', 'past_due')) desc, updated_at desc, id desc limit 1`;
  return r ?? null;
}

export type Access = { kind: 'signed-out' } | { kind: 'trader' } | { kind: 'subscriber'; row: SubscriptionRow } | { kind: 'none'; row: SubscriptionRow | null };
// The one entitlement helper (server only). Feature is fixed: Record tools is the only paid feature.
export async function access(userId: number | undefined, now = billingDeps.now()): Promise<Access> {
  if (!userId) return { kind: 'signed-out' };
  if (await isTrader(userId)) return { kind: 'trader' };
  const row = await subscriptionFor(userId);
  return rowEntitles(row, now) ? { kind: 'subscriber', row: row! } : { kind: 'none', row };
}
export async function entitled(userId: number | undefined, feature: 'record_tools' = 'record_tools', now = billingDeps.now()): Promise<boolean> {
  void feature;
  const a = await access(userId, now);
  return a.kind === 'trader' || a.kind === 'subscriber';
}

// ---- webhooks -------------------------------------------------------------------------------------------------------

export class SignatureError extends Error {}

// The processor's scheme: header `t=<unix>,v1=<hex>[,v1=…]`, HMAC-SHA256 of `${t}.${rawBody}`; any configured secret
// (comma-separated, for rotation) may match; timestamps outside the tolerance are rejected.
export function verifySignature(raw: string, header: string | null, secrets: string[], now: Date): void {
  if (!header) throw new SignatureError('missing signature');
  const parts = header.split(',').map((p) => p.trim().split('='));
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v ?? '');
  if (!Number.isFinite(t) || !sigs.length) throw new SignatureError('malformed signature');
  if (Math.abs(now.getTime() / 1000 - t) > SIGNATURE_TOLERANCE_S) throw new SignatureError('timestamp outside tolerance');
  for (const secret of secrets) {
    const want = Buffer.from(createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex'));
    if (sigs.some((s) => { const got = Buffer.from(s); return got.length === want.length && timingSafeEqual(got, want); })) return;
  }
  throw new SignatureError('no matching signature');
}
export const signPayload = (raw: string, secret: string, t: number) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`;

type Event = { id: string; type: string; livemode?: boolean; data?: { object?: Obj } };
export type WebhookResult = { status: 200 | 400 | 500; outcome: 'processed' | 'duplicate' | 'ignored' | 'rejected' | 'failed' };

const idOf = (v: unknown): string | null => (typeof v === 'string' ? v : v && typeof v === 'object' && typeof (v as Obj).id === 'string' ? ((v as Obj).id as string) : null);
const invoiceSubscription = (inv: Obj): string | null =>
  idOf(inv.subscription) ?? idOf(((inv.parent as Obj | undefined)?.subscription_details as Obj | undefined)?.subscription);

// Verify, store once by event id, apply. 200 only after the row is written; 500 (with an error code, never vendor text)
// so the processor retries. Nothing from a rejected body is logged (condition 22).
export async function handleWebhook(raw: string, signature: string | null): Promise<WebhookResult> {
  const c = cfg();
  try { verifySignature(raw, signature, c.webhookSecrets, billingDeps.now()); } catch { return { status: 400, outcome: 'rejected' }; }
  let ev: Event;
  try { ev = JSON.parse(raw) as Event; } catch { return { status: 400, outcome: 'rejected' }; }
  if (typeof ev?.id !== 'string' || typeof ev.type !== 'string') return { status: 400, outcome: 'rejected' };
  if (!!ev.livemode !== c.live) return { status: 400, outcome: 'rejected' }; // a test-mode app never applies live events
  const obj = (ev.data?.object ?? {}) as Obj;
  const customer = idOf(obj.customer);
  // No transaction spans the processor calls (engineer D1: a held transaction per event exhausted the pool). The row is
  // stored once by event id; a delivery claims it (2-minute lease) before applying, so concurrent duplicates are no-ops.
  await sql`insert into billing_events (vendor_event_id, type, vendor_object_id, vendor_customer_id, livemode)
    values (${ev.id}, ${ev.type}, ${idOf(obj)}, ${customer}, ${!!ev.livemode}) on conflict (vendor_event_id) do nothing`;
  // ponytail: an apply that runs past the 2-minute lease can be claimed again by a retry (both apply idempotently and
  // converge) — a heartbeat on claimed_at while applying would close it.
  const [claim] = await sql`update billing_events set claimed_at = now() where vendor_event_id = ${ev.id} and processed_at is null
    and (claimed_at is null or claimed_at < now() - interval '2 minutes') returning vendor_event_id`;
  if (!claim) return { status: 200, outcome: 'duplicate' };
  try {
    const flagged = await applyEvent(ev.type, obj);
    await sql`update billing_events set processed_at = now(), error_code = null, flagged = flagged or ${flagged === true} where vendor_event_id = ${ev.id}`;
    return { status: 200, outcome: flagged === null ? 'ignored' : 'processed' };
  } catch (e) {
    // D7: an event naming a customer or price this app does not know will not change on retry: stored, flagged, 200.
    if (e instanceof ApplyError && PERMANENT.has(e.code)) {
      await sql`update billing_events set processed_at = now(), error_code = ${e.code}, flagged = true where vendor_event_id = ${ev.id}`;
      console.error('billing webhook flagged', ev.id, logSafe(e)); // the code is stored on the event row
      return { status: 200, outcome: 'processed' };
    }
    const code = e instanceof VendorError ? `vendor_${e.status}` : e instanceof ApplyError ? e.code : 'internal';
    await sql`update billing_events set error_code = ${code}, claimed_at = null where vendor_event_id = ${ev.id}`;
    console.error('billing webhook failed', ev.id, logSafe(e));
    return { status: 500, outcome: 'failed' };
  }
}

const PERMANENT = new Set(['unknown_customer', 'unknown_price', 'second_live_subscription', 'dispute_without_customer', 'missing_object']);

class ApplyError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

// Returns whether a human should look (a dispute), or null when the event type is not one the app acts on.
async function applyEvent(type: string, obj: Obj): Promise<boolean | null> {
  if (type.startsWith('customer.subscription.')) { const id = idOf(obj); if (!id) throw new ApplyError('missing_object'); await syncSubscription(id); return false; }
  if (type === 'checkout.session.completed') { const s = idOf(obj.subscription); if (s) await syncSubscription(s); return false; }
  if (type.startsWith('invoice.')) { const s = invoiceSubscription(obj); if (s) await syncSubscription(s); return false; }
  if (type === 'charge.refunded') { await applyRefund(obj); return false; }
  if (type === 'charge.dispute.created') { await applyDispute(obj, true); return true; }
  if (type === 'charge.dispute.closed') { await applyDispute(obj, obj.status !== 'won'); return true; }
  return null;
}

// ---- applying the processor's state ---------------------------------------------------------------------------------

type VendorSub = Obj & { id: string; customer: unknown; status: string; cancel_at_period_end?: boolean; items?: { data?: Obj[] } };

export function mapStatus(vendorStatus: string): Status {
  switch (vendorStatus) {
    case 'trialing': case 'active': case 'past_due': case 'canceled': case 'unpaid': case 'paused': return vendorStatus;
    case 'incomplete_expired': return 'canceled';
    case 'incomplete': return 'incomplete'; // a first payment still being confirmed: no access, never canceled by the app
    default: return 'unpaid';
  }
}
const secs = (v: unknown): Date | null => (typeof v === 'number' ? new Date(v * 1000) : null);

// Pure: the row the processor's object implies, given the row the app holds now.
// A price no longer configured (after a price change) keeps the plan the app already holds for that subscription
// (grandfathered); only a subscription the app has never seen on an unknown price is refused.
export function desiredRow(sub: VendorSub, prices: Record<Plan, string>, prev: (Pick<SubscriptionRow, 'grace_until' | 'disputed_at' | 'ended_reason'> & { plan?: Plan }) | null, now: Date) {
  const item = sub.items?.data?.[0] ?? {};
  const priceId = idOf(item.price);
  const plan = (Object.keys(prices) as Plan[]).find((p) => prices[p] === priceId) ?? prev?.plan;
  if (!plan) throw new ApplyError('unknown_price');
  let status = mapStatus(sub.status);
  const graceUntil = status === 'past_due' ? prev?.grace_until ?? new Date(now.getTime() + GRACE_DAYS * DAY) : null;
  if (status === 'past_due' && graceUntil && graceUntil <= now) status = 'unpaid';
  if (prev?.disputed_at && status !== 'canceled') status = 'unpaid';
  return {
    plan, status, grace_until: graceUntil, disputed_at: prev?.disputed_at ?? null, ended_reason: prev?.ended_reason ?? null,
    current_period_start: secs(sub.current_period_start ?? item.current_period_start),
    current_period_end: secs(sub.current_period_end ?? item.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
  };
}

// Out-of-order events converge: whatever event arrives, the subscription is fetched fresh and the row set from it.
export async function syncSubscription(id: string, seen: Seen = {}): Promise<'unchanged' | 'changed'> {
  const sub = (await vendor('GET', `/v1/subscriptions/${enc(id)}`)) as VendorSub;
  return upsertFromVendor(sub, seen);
}

// `seen.trader`: set when this call canceled the subscription because its subscriber is now a trader (the count).
type Seen = { trader?: boolean };
async function upsertFromVendor(sub: VendorSub, seen: Seen = {}): Promise<'unchanged' | 'changed'> {
  const c = cfg();
  const customer = idOf(sub.customer);
  const [owner] = await sql`select user_id from billing_customers where vendor_customer_id = ${customer}`;
  if (!owner) throw new ApplyError('unknown_customer');
  const [prev] = await sql<(SubscriptionRow & { id: number })[]>`select * from subscriptions where vendor_subscription_id = ${sub.id}`;
  const d = desiredRow(sub, c.prices, prev ?? null, billingDeps.now());
  if (prev && sameRow(prev, d)) { if (await applyRefundPolicy(owner.user_id as number, sub, d)) seen.trader = true; return 'unchanged'; }
  try {
    await sql`insert into subscriptions (user_id, vendor_subscription_id, vendor_customer_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, grace_until, disputed_at, ended_reason)
      values (${owner.user_id}, ${sub.id}, ${customer}, ${d.plan}, ${d.status}, ${d.current_period_start}, ${d.current_period_end}, ${d.cancel_at_period_end}, ${d.grace_until}, ${d.disputed_at}, ${d.ended_reason})
      on conflict (vendor_subscription_id) do update set plan = excluded.plan, status = excluded.status,
        current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
        cancel_at_period_end = excluded.cancel_at_period_end, grace_until = excluded.grace_until, updated_at = now()`;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      // Code review (blocking 2): a second paid subscription (two tabs, a double submit) would renew with no access
      // attached. It is canceled at once with a full refund, and the event is flagged for a human.
      await cancelWithRefund(owner.user_id as number, sub, 1, 'duplicate');
      throw new ApplyError('second_live_subscription');
    }
    throw e;
  }
  if (await applyRefundPolicy(owner.user_id as number, sub, d)) seen.trader = true;
  return 'changed';
}

const t = (d: Date | null) => d?.getTime() ?? null;
function sameRow(a: SubscriptionRow, b: ReturnType<typeof desiredRow>) {
  return a.plan === b.plan && a.status === b.status && a.cancel_at_period_end === b.cancel_at_period_end
    && t(a.current_period_start) === t(b.current_period_start) && t(a.current_period_end) === t(b.current_period_end) && t(a.grace_until) === t(b.grace_until);
}

// The refund decision (F-3 feature file, 2026-11-01): a subscription set to cancel within 14 days of its first charge
// (monthly or yearly), or of a yearly renewal, is canceled now with a full refund; canceling in that window is the
// request. Condition 14: a subscriber who has since connected a broker is canceled now with a pro-rata refund.
// `firstPeriod`: the current period is the subscription's first (no renewal yet).
export function refundShare(plan: Plan, start: Date | null, end: Date | null, now: Date, reason: 'cancel' | 'trader', firstPeriod = false): number {
  if (!start || !end || end <= start || now >= end) return 0;
  if (reason === 'trader') return Math.max(0, Math.min(1, (end.getTime() - now.getTime()) / (end.getTime() - start.getTime())));
  const inWindow = now.getTime() - start.getTime() <= ANNUAL_REFUND_DAYS * DAY;
  return inWindow && (plan === 'annual' || firstPeriod) ? 1 : 0;
}
// The current period is the first when it starts where the subscription started (the processor's `start_date`).
const isFirstPeriod = (sub: VendorSub, d: { current_period_start: Date | null }) => {
  const started = secs(sub.start_date);
  return !!started && !!d.current_period_start && Math.abs(started.getTime() - d.current_period_start.getTime()) < 60_000;
};

// True when it canceled the subscription because the subscriber is now a trader.
async function applyRefundPolicy(userId: number, sub: VendorSub, d: ReturnType<typeof desiredRow>): Promise<boolean> {
  if (!['active', 'past_due', 'trialing'].includes(d.status)) return false;
  const now = billingDeps.now();
  if (await isTrader(userId)) { await cancelWithRefund(userId, sub, refundShare(d.plan, d.current_period_start, d.current_period_end, now, 'trader'), 'trader'); return true; }
  if (d.cancel_at_period_end) {
    const asked = secs(sub.canceled_at) ?? now; // D5: when the subscriber asked, not when the event is processed
    const share = refundShare(d.plan, d.current_period_start, d.current_period_end, asked, 'cancel', isFirstPeriod(sub, d));
    if (share > 0) await cancelWithRefund(userId, sub, share, 'refund');
  }
  return false;
}

// Cancels now, then refunds `share` of the latest paid invoice (rounded down to the cent) unless that charge already
// carries a refund (engineer D4: cancel first, so a retry never refunds twice). Idempotent per subscription.
// Code review (blocking 1): the refund comes first, while the subscription is still live, so a failure anywhere leaves
// it live and every retry path (the next event, cancelIfTrader, the reconciliation, deletion) runs this again; the
// metadata tag on the app's own refund means a retry never refunds twice (and engineer D4's double-refund risk is
// closed the same way). Then the cancel; a retry after a failed cancel finds the refund and only cancels.
async function cancelWithRefund(userId: number, sub: VendorSub, share: number, reason: 'trader' | 'refund' | 'deletion' | 'dispute' | 'grace' | 'duplicate') {
  const inv = idOf(sub.latest_invoice);
  if (share > 0 && inv) await refundShareOf(sub.id, inv, share);
  try { await vendor('DELETE', `/v1/subscriptions/${enc(sub.id)}`); } catch (e) { if (!(e instanceof VendorError && e.status === 404)) throw e; }
  await sql`update subscriptions set status = 'canceled', ended_reason = coalesce(ended_reason, ${ENDED[reason]}), cancel_at_period_end = false, updated_at = now()
    where vendor_subscription_id = ${sub.id} and user_id = ${userId}`;
}
async function refundShareOf(subId: string, inv: string, share: number) {
  const invoice = await vendor('GET', `/v1/invoices/${enc(inv)}`);
  const chargeId = idOf(invoice.charge);
  const pi = idOf(invoice.payment_intent);
  if (!chargeId || !pi) return;
  // E3: an earlier refund made by someone else (a partial goodwill refund) lowers what is left, never blocks this one;
  // a refund this app already made for this subscription (tagged in its metadata) is never made twice.
  const ours = await vendor('GET', '/v1/refunds', { payment_intent: pi, limit: 100 });
  if (((ours.data ?? []) as Obj[]).some((r) => (r.metadata as Obj | undefined)?.subscription === subId)) return;
  const charge = await vendor('GET', `/v1/charges/${enc(chargeId)}`);
  const paid = Number(invoice.amount_paid ?? 0), refunded = Number(charge.amount_refunded ?? 0);
  const amount = Math.min(Math.floor(paid * share), paid - refunded);
  if (amount > 0) await vendor('POST', '/v1/refunds', { payment_intent: pi, amount, metadata: { subscription: subId } }, `refund-${subId}`);
}
const ENDED: Record<string, string | null> = { trader: 'trader', refund: 'refund', deletion: 'deletion', dispute: null, grace: null, duplicate: null };

// Condition 19: a full refund ends access at once (the subscription is canceled); a partial refund changes nothing.
async function applyRefund(charge: Obj) {
  if (!(Number(charge.amount) > 0 && Number(charge.amount_refunded) >= Number(charge.amount))) return;
  // Only the subscription that charge paid for: charge → invoice → subscription (never every subscription of the
  // customer: the full refund of a canceled duplicate must not end the live one).
  const inv = idOf(charge.invoice);
  if (!inv) return;
  const subId = invoiceSubscription(await vendor('GET', `/v1/invoices/${enc(inv)}`));
  const rows = await sql`select s.user_id, s.vendor_subscription_id from subscriptions s where s.vendor_subscription_id = ${subId} and s.status in ('trialing', 'active', 'past_due')`;
  for (const r of rows) {
    const sub = (await vendor('GET', `/v1/subscriptions/${enc(r.vendor_subscription_id)}`)) as VendorSub;
    await cancelWithRefund(r.user_id as number, sub, 0, 'refund');
  }
}

// Condition 19: a dispute sets `unpaid` at once and flags the event; a dispute closed as won clears it.
async function applyDispute(dispute: Obj, open: boolean) {
  const chargeId = idOf(dispute.charge);
  if (!chargeId) throw new ApplyError('dispute_without_customer');
  const charge = await vendor('GET', `/v1/charges/${enc(chargeId)}`);
  const customer = idOf(charge.customer);
  if (!customer) throw new ApplyError('dispute_without_customer');
  if (open) {
    // ponytail: a dispute ends every live subscription of the customer, not only the one the disputed charge paid for
    // (deliberate: a dispute is a fraud signal) — map charge → invoice → subscription, as applyRefund does, to narrow it.
    // D2: access ends here and the processor stops renewing (no charge to someone without access).
    const rows = await sql`update subscriptions set disputed_at = coalesce(disputed_at, now()), status = case when status = 'canceled' then status else 'unpaid' end, updated_at = now()
      where vendor_customer_id = ${customer} and status <> 'canceled' returning user_id, vendor_subscription_id`;
    for (const r of rows) await cancelWithRefund(r.user_id as number, { id: r.vendor_subscription_id as string } as VendorSub, 0, 'dispute');
    return;
  }
  const rows = await sql`update subscriptions set disputed_at = null, updated_at = now() where vendor_customer_id = ${customer} and disputed_at is not null returning vendor_subscription_id`;
  for (const r of rows) await syncSubscription(r.vendor_subscription_id as string);
}

// D9, condition 14: called right after a broker connection is consented; the nightly reconciliation is the backstop.
// A live subscription of a user who is now a trader is canceled at once with a pro-rata refund.
export async function cancelIfTrader(userId: number): Promise<void> {
  const rows = await sql`select vendor_subscription_id from subscriptions where user_id = ${userId} and status in ('trialing', 'active', 'past_due')`;
  if (!rows.length || !(await isTrader(userId))) return;
  for (const r of rows) await syncSubscription(r.vendor_subscription_id as string);
}

// Whether this account ever had a subscription (the delete screen's billing line shows only then: no billing words
// for anyone who never paid, traders included).
export async function hasSubscribed(userId: number): Promise<boolean> {
  const [r] = await sql`select 1 from subscriptions where user_id = ${userId} limit 1`;
  return !!r;
}

// The account page's line for a trader whose paid plan was canceled when they connected (condition 14).
export async function canceledOnConnect(userId: number): Promise<boolean> {
  const [r] = await sql`select 1 from subscriptions where user_id = ${userId} and ended_reason = 'trader' limit 1`;
  return !!r;
}

// ---- nightly reconciliation -----------------------------------------------------------------------------------------

// `done`: the pass completed in this call.
// ponytail: counts are per call, so a pass cut over several ticks logs one partial line per tick and no pass total —
// persist the counters on billing_runs 'reconcile' (fenced like the cursor) if a per-pass report is needed.
export type ReconcileReport = { checked: number; mismatches: number; missing: number; failed: number; graceExpired: number; tradersCanceled: number; eventsPurged: number; consentsPurged: number; done: boolean };
export type ReconcileOpts = { boxMs?: number; clock?: () => number; pageSize?: number; hold?: () => Promise<void> };

// Known-limits sweep 2: the reconciliation is one pass resumed tick by tick, time-boxed like the other cron stages
// (lib/privacy-purge.ts, lib/display-log.ts). billing_runs 'reconcile' holds the pass in progress: its start, phase,
// cursor (the last processor subscription handled; `starting_after` takes any id) and the failures at that cursor.
// Every pass write is fenced by the holder's lease token, renewed per subscription, so a holder that overran its lease
// can neither move the cursor nor complete the pass after another holder took it over.
// - 'list': the processor's paged list of subscriptions that are not canceled, compared with the app's rows. The box
//   is checked, and the cursor saved, per subscription. A page failing RECONCILE_MAX_FAILS times at one cursor moves
//   the pass on to 'missing', which covers the rest one by one.
// - 'missing': every live local row this pass has not listed or fetched (`listed_at` older than the pass start: the
//   in-memory `listed` set, persisted across ticks) is fetched on its own.
// - Completion sets the day mark (`last_at` = the pass start; the next pass is due 23 h later).
// Grace expiry and the purges ('reconcile_daily') run once per due day: on the tick that completes the pass, or, with
// no pass in progress or one stuck past its day, on its own. Each expiry first reads the subscription fresh, so a
// subscription the processor holds live is never expired, and a rerun (the day given back) cancels nothing twice.
export const RECONCILE_BOX_MS = 20_000;
export const RECONCILE_LEASE_S = 120; // > the box plus one subscription's vendor calls
export const RECONCILE_MAX_FAILS = 3;
// Engineer D16: the hourly /api/sync tick runs the reconciliation once a day (no new cron). One caller at a time.
export const RECONCILE_EVERY_HOURS = 23;
type Run = { lease: string; started: Date; phase: 'list' | 'missing'; cursor: string | null };

async function claimPass(due: boolean): Promise<Run | null> {
  await sql`insert into billing_runs (job, last_at) values ('reconcile', now() - interval '1 day') on conflict (job) do nothing`;
  const lease = randomUUID();
  const [run] = await sql`update billing_runs set lease_id = ${lease}, lease_until = now() + ${RECONCILE_LEASE_S} * interval '1 second',
      pass_started_at = coalesce(pass_started_at, now()), phase = coalesce(phase, 'list'),
      cursor = case when pass_started_at is null then null else cursor end, fails = case when pass_started_at is null then 0 else fails end
    where job = 'reconcile' and (lease_until is null or lease_until < now())
      and (${!due}::boolean or pass_started_at is not null or last_at < now() - ${RECONCILE_EVERY_HOURS} * interval '1 hour')
    returning pass_started_at, phase, cursor`;
  return run ? { lease, started: run.pass_started_at as Date, phase: run.phase as Run['phase'], cursor: (run.cursor as string | null) ?? null } : null;
}
// The pass handled `id` (listed or fetched): the row is stamped, the cursor moved (list phase), the failures reset and
// the lease renewed, all only while this holder has the lease. False: the lease is lost; stop.
async function handled(run: Run, id: string): Promise<boolean> {
  const [r] = await sql`with run as (
      update billing_runs set cursor = case when phase = 'list' then ${id}::text else cursor end, fails = 0,
        lease_until = now() + ${RECONCILE_LEASE_S} * interval '1 second'
      where job = 'reconcile' and lease_id = ${run.lease} returning 1),
    stamp as (update subscriptions set listed_at = now() where vendor_subscription_id = ${id} and exists (select 1 from run) returning 1)
    select exists (select 1 from run) as ok`;
  return !!r?.ok;
}
async function fenced(run: Run, set: 'missing' | 'complete' | 'release' | 'fail'): Promise<boolean> {
  const lease = run.lease;
  const q = set === 'missing'
    ? sql`update billing_runs set phase = 'missing', fails = 0, lease_until = now() + ${RECONCILE_LEASE_S} * interval '1 second' where job = 'reconcile' and lease_id = ${lease} returning 1`
    : set === 'complete'
      ? sql`update billing_runs set last_at = pass_started_at, pass_started_at = null, phase = null, cursor = null, fails = 0, lease_id = null, lease_until = null where job = 'reconcile' and lease_id = ${lease} returning 1`
      : set === 'fail'
        ? sql`update billing_runs set fails = fails + 1, phase = case when fails + 1 >= ${RECONCILE_MAX_FAILS} then 'missing' else phase end, lease_id = null, lease_until = null where job = 'reconcile' and lease_id = ${lease} returning 1`
        : sql`update billing_runs set lease_id = null, lease_until = null where job = 'reconcile' and lease_id = ${lease} returning 1`;
  return (await q).length > 0;
}

// One boxed step of the pass. True: the pass completed in this call.
async function stepPass(run: Run, r: ReconcileReport, boxSpent: () => boolean, opts: ReconcileOpts): Promise<boolean> {
  let moved = false; // every call handles at least one subscription, so a pass always moves forward
  const spent = () => moved && boxSpent();
  if (run.phase === 'list') {
    let after = run.cursor ?? undefined;
    for (;;) {
      if (spent()) return false;
      const page = await vendor('GET', '/v1/subscriptions', { limit: opts.pageSize ?? 100, starting_after: after }); // D8: excludes canceled
      const data = (page.data ?? []) as VendorSub[];
      for (const sub of data) {
        if (spent()) return false;
        if (!['canceled', 'incomplete_expired'].includes(sub.status)) {
          const [local] = await sql`select 1 from subscriptions where vendor_subscription_id = ${sub.id} and status <> 'canceled'`;
          if (local) r.checked++;
          const seen: Seen = {};
          try { const res = await upsertFromVendor(sub, seen); if (local && res === 'changed') r.mismatches++; if (!local) r.missing++; } catch { r.failed++; }
          if (seen.trader) r.tradersCanceled++;
        }
        if (!(await handled(run, sub.id))) return false;
        moved = true;
        await opts.hold?.();
      }
      if (!page.has_more || !data.length) break;
      after = data[data.length - 1].id;
    }
    if (!(await fenced(run, 'missing'))) return false;
  }
  for (;;) {
    const rows = await sql`select vendor_subscription_id from subscriptions where status <> 'canceled'
      and (listed_at is null or listed_at < ${run.started}) order by id limit 100`;
    for (const x of rows) {
      if (spent()) return false;
      const id = x.vendor_subscription_id as string;
      r.checked++;
      const seen: Seen = {};
      try { if ((await syncSubscription(id, seen)) === 'changed') r.mismatches++; } catch { r.failed++; }
      if (seen.trader) r.tradersCanceled++;
      if (!(await handled(run, id))) return false; // stamped on failure too: one bad row cannot pin the pass
      moved = true;
      await opts.hold?.();
    }
    if (rows.length < 100) break;
  }
  return fenced(run, 'complete');
}

// Grace expiry and the purges. False: the box ended first (the day is given back; the next tick goes on).
async function dailySteps(r: ReconcileReport, spent: () => boolean): Promise<boolean> {
  r.eventsPurged = (await sql`delete from billing_events where received_at < now() - ${EVENT_RETENTION_DAYS} * interval '1 day'`).count;
  r.consentsPurged = (await sql`delete from billing_consents where user_id is null and retain_until < now()`).count;
  // D3: grace over → no access and the processor stops retrying (a later success would charge someone without access).
  // E2: also any row the processor itself moved to unpaid (no grace window recorded).
  const due = await sql`select vendor_subscription_id from subscriptions where status = 'unpaid' or (status = 'past_due' and grace_until <= now()) order by id`;
  for (const x of due) {
    if (spent()) return false;
    const id = x.vendor_subscription_id as string;
    const seen: Seen = {};
    // A fresh read first: a subscription the processor holds live (a lost payment event) becomes live here instead.
    try { await syncSubscription(id, seen); } catch (e) { if (!(e instanceof VendorError && e.status === 404)) { r.failed++; continue; } }
    if (seen.trader) r.tradersCanceled++;
    const [still] = await sql`update subscriptions set status = 'unpaid', updated_at = now()
      where vendor_subscription_id = ${id} and (status = 'unpaid' or (status = 'past_due' and grace_until <= now())) returning user_id`;
    if (!still) continue;
    try { await cancelWithRefund(still.user_id as number, { id } as VendorSub, 0, 'grace'); r.graceExpired++; } catch { r.failed++; }
  }
  return true;
}
async function runDaily(r: ReconcileReport, spent: () => boolean, force: boolean): Promise<boolean> {
  const [won] = await sql`insert into billing_runs (job, last_at) values ('reconcile_daily', now())
    on conflict (job) do update set last_at = now() where ${force}::boolean or billing_runs.last_at < now() - ${RECONCILE_EVERY_HOURS} * interval '1 hour'
    returning job`;
  if (!won) return false;
  const giveBack = () => sql`update billing_runs set last_at = now() - interval '1 day' where job = 'reconcile_daily'`;
  try { if (!(await dailySteps(r, spent))) await giveBack(); } catch (e) { await giveBack(); throw e; }
  return true;
}

async function runReconcile(due: boolean, opts: ReconcileOpts): Promise<ReconcileReport | null> {
  const clock = opts.clock ?? Date.now;
  const end = clock() + Math.min(opts.boxMs ?? RECONCILE_BOX_MS, RECONCILE_BOX_MS);
  const spent = () => clock() >= end;
  const r: ReconcileReport = { checked: 0, mismatches: 0, missing: 0, failed: 0, graceExpired: 0, tradersCanceled: 0, eventsPurged: 0, consentsPurged: 0, done: false };
  let ran = false;
  try {
    // No pass in progress, or one stuck past its day: the day's grace expiry and purges do not wait for it.
    const [st] = await sql`select pass_started_at is null or pass_started_at < now() - ${RECONCILE_EVERY_HOURS} * interval '1 hour' as free
      from billing_runs where job = 'reconcile'`;
    let daily = false;
    if (due && (st?.free ?? true)) daily = ran = await runDaily(r, spent, false);
    const run = await claimPass(due);
    if (run) {
      ran = true;
      try { r.done = await stepPass(run, r, spent, opts); } catch (e) { await fenced(run, 'fail'); throw e; }
      if (!r.done) await fenced(run, 'release');
    }
    if (r.done && !daily) await runDaily(r, spent, !due);
  } finally {
    if (ran) console.log('billing reconcile', JSON.stringify({ checked: r.checked, mismatches: r.mismatches, missing: r.missing, failed: r.failed, graceExpired: r.graceExpired, tradersCanceled: r.tradersCanceled, eventsPurged: r.eventsPurged, consentsPurged: r.consentsPurged }));
  }
  return ran ? r : null;
}

// Compares every live row against the processor, adds processor subscriptions missing locally, expires grace windows,
// cancels subscribers who became traders, purges old events and consents. Logs counts only. Not gated by the day:
// it steps the pass in progress (or starts one), and after a completed pass runs grace expiry and the purges.
export async function reconcile(opts: ReconcileOpts = {}): Promise<ReconcileReport> {
  return (await runReconcile(false, opts)) ?? { checked: 0, mismatches: 0, missing: 0, failed: 0, graceExpired: 0, tradersCanceled: 0, eventsPurged: 0, consentsPurged: 0, done: false };
}
// The hourly tick's call: null when nothing was due or another caller holds the pass. A throw keeps the cursor (and
// counts a failure at it); the next tick resumes.
export async function reconcileIfDue(opts: ReconcileOpts = {}): Promise<ReconcileReport | null> {
  if (!billingAvailable()) return null;
  return runReconcile(true, opts);
}

// ---- account deletion (condition 20) --------------------------------------------------------------------------------

// Before the users row goes: cancel every live subscription at the processor now (no further charge), apply the refund
// policy, delete the processor customer, then the app's billing rows except the consent records, which are re-keyed to
// the processor customer id and kept 3 years. A processor error throws: lib/delete.ts keeps the account marked and the
// hourly tick retries. No processor configured and no customer row: nothing to do.
export async function endBillingForDeletion(userId: number): Promise<void> {
  const [cust] = await sql`select vendor_customer_id from billing_customers where user_id = ${userId}`;
  // Code review (should-fix 3): billing never blocks deletion. With billing switched off there is no processor to call:
  // the local rows go, and a counted alert asks for a manual cleanup at the processor (no ids logged).
  // ponytail: with billing switched off the processor customer is left for manual cleanup, and a persistent processor
  // error retries hourly with no cap (the account stays marked) — an attempt counter with a counted alert after N tries.
  if (cust && !billingAvailable()) console.error('billing: account deleted while billing is not configured; processor cleanup needed (1)');
  if (cust && billingAvailable()) {
    const live = await sql`select vendor_subscription_id, plan from subscriptions where user_id = ${userId} and status <> 'canceled'`;
    for (const s of live) {
      let sub: VendorSub | null = null;
      try { sub = (await vendor('GET', `/v1/subscriptions/${enc(s.vendor_subscription_id)}`)) as VendorSub; } catch (e) { if (!(e instanceof VendorError && e.status === 404)) throw e; }
      if (sub && !['canceled', 'incomplete_expired'].includes(sub.status)) {
        // The stored plan stands in for a price no longer configured: deletion never waits on a price mapping.
        const d = desiredRow(sub, cfg().prices, { grace_until: null, disputed_at: null, ended_reason: null, plan: s.plan as Plan }, billingDeps.now());
        await cancelWithRefund(userId, sub, refundShare(d.plan, d.current_period_start, d.current_period_end, billingDeps.now(), 'cancel', isFirstPeriod(sub, d)), 'deletion');
      }
    }
    try { await vendor('DELETE', `/v1/customers/${enc(cust.vendor_customer_id)}`); } catch (e) { if (!(e instanceof VendorError && e.status === 404)) throw e; }
    await sql`delete from billing_events where vendor_customer_id = ${cust.vendor_customer_id}`;
  }
  await sql.begin((tx) => [
    tx`update billing_consents set user_id = null, retain_until = now() + ${CONSENT_RETENTION_YEARS} * interval '1 year' where user_id = ${userId}`,
    tx`delete from subscriptions where user_id = ${userId}`,
    tx`delete from billing_customers where user_id = ${userId}`,
  ]);
}

// For the export (condition 11): plan, status, period end, cancel at period end. Nothing else.
export async function exportSubscription(userId: number) {
  const r = await subscriptionFor(userId);
  return r ? { plan: r.plan, status: r.status, current_period_end: r.current_period_end?.toISOString() ?? null, cancel_at_period_end: r.cancel_at_period_end } : null;
}
