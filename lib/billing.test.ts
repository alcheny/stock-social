// F-3 billing core (lib/billing.ts) against the in-repo fake processor (e2e/fakes/billing.ts) and the database: test mode
// only, signature-verified idempotent webhooks with every lifecycle event, replay and out-of-order delivery, entitlements
// from the app's own rows, grace, disputes, refunds, traders, reconciliation, deletion and the data the app may keep.
// Fixture data is fictional (POLICY P2): opaque ids and test handles only.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBillingFake, type BillingFake } from '../e2e/fakes/billing.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
const DAY = 86_400_000;
const SECRET = 'whsec_unit_test_only';
const PRICES = { monthly: 'price_unit_monthly', annual: 'price_unit_annual' };
const ENV = { STRIPE_SECRET_KEY: 'sk_test_unit', STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_MONTHLY: PRICES.monthly, STRIPE_PRICE_ANNUAL: PRICES.annual, STRIPE_API_BASE: 'http://fake.invalid' };
const LIVE = ['sk', 'live', 'x'.repeat(24)].join('_'); // built at run time: never a key-shaped literal in the repo

const saved: Record<string, string | undefined> = {};
before(async () => {
  for (const [k, v] of Object.entries(ENV)) { saved[k] = process.env[k]; process.env[k] = v; }
  process.env.APP_SECRET_KEY ??= 'unit-test-secret';
  if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
});
after(async () => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 });
});

let fake: BillingFake;
let now = Date.UTC(2026, 10, 1, 12);
beforeEach(async () => {
  const b = await import('./billing.ts');
  now = Date.UTC(2026, 10, 1, 12);
  fake = createBillingFake({ webhookSecret: SECRET, prices: PRICES, now: () => now, deliver: (raw, sig) => b.handleWebhook(raw, sig) });
  b.billingDeps.fetch = fake.fetch;
  b.billingDeps.now = () => new Date(now);
});

const tag = `bl${process.pid % 100000}`;
let n = 0;
async function user(): Promise<number> {
  const { sql } = await import('./db.ts');
  const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${`${tag}_${++n}`}, 'Test viewer', now(), ${a.id}) returning id`;
  return u.id as number;
}
async function makeTrader(userId: number) {
  const { sql } = await import('./db.ts');
  const [a] = await sql`select signup_attempt_id from users where id = ${userId}`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at) values (${a.signup_attempt_id}, ${userId}, 'connected', now())`;
}
async function subscribe(userId: number, plan: 'monthly' | 'annual' = 'monthly') {
  const b = await import('./billing.ts');
  const url = await b.startCheckout({ userId, plan, agreed: true, disclosure: 'the full disclosure text', origin: 'http://app.test' });
  const id = url.split('/checkout/')[1];
  await fake.handle('POST', `/checkout/${id}/pay`, '', {});
  return fake.subs.get(fake.state().checkouts.find((c) => c.id === id)!.subscription as string)!;
}
const row = async (userId: number) => (await import('./billing.ts')).subscriptionFor(userId);
const ent = async (userId: number) => (await import('./billing.ts')).entitled(userId);

test('test mode only: a live key is refused unless LIVE_BILLING=on; a key of neither kind and missing prices are refused; no key = not configured', async () => {
  const { billingConfig, BillingConfigError } = await import('./billing.ts');
  assert.equal(billingConfig({}), null);
  assert.equal(billingConfig(ENV)!.live, false);
  assert.throws(() => billingConfig({ ...ENV, STRIPE_SECRET_KEY: LIVE }), BillingConfigError);
  assert.throws(() => billingConfig({ ...ENV, STRIPE_SECRET_KEY: LIVE, LIVE_BILLING: '1' }), /LIVE_BILLING=on/);
  assert.equal(billingConfig({ ...ENV, STRIPE_SECRET_KEY: LIVE, LIVE_BILLING: 'on' })!.live, true);
  assert.throws(() => billingConfig({ ...ENV, STRIPE_SECRET_KEY: 'pk_test_x' }), /neither a test nor a live key/);
  assert.throws(() => billingConfig({ ...ENV, STRIPE_PRICE_ANNUAL: '' }), BillingConfigError);
  assert.throws(() => billingConfig({ ...ENV, STRIPE_WEBHOOK_SECRET: ' , ' }), BillingConfigError);
  assert.deepEqual(billingConfig({ ...ENV, STRIPE_WEBHOOK_SECRET: 'whsec_a, whsec_b' })!.webhookSecrets, ['whsec_a', 'whsec_b']);
});

test('signatures: the right secret (or a rotated one) passes; a wrong secret, a skewed timestamp, a malformed or missing header fails', async () => {
  const { verifySignature, signPayload, SignatureError } = await import('./billing.ts');
  const at = new Date(Date.UTC(2026, 10, 1)); const t = at.getTime() / 1000; const raw = '{"id":"evt_1"}';
  verifySignature(raw, signPayload(raw, SECRET, t), [SECRET], at);
  verifySignature(raw, signPayload(raw, SECRET, t), ['whsec_old', SECRET], at);
  verifySignature(raw, `${signPayload(raw, 'whsec_other', t)},v1=${signPayload(raw, SECRET, t).split('v1=')[1]}`, [SECRET], at);
  assert.throws(() => verifySignature(raw, signPayload(raw, 'whsec_other', t), [SECRET], at), SignatureError);
  assert.throws(() => verifySignature(`${raw} `, signPayload(raw, SECRET, t), [SECRET], at), SignatureError);
  assert.throws(() => verifySignature(raw, signPayload(raw, SECRET, t - 301), [SECRET], at), /tolerance/);
  assert.throws(() => verifySignature(raw, signPayload(raw, SECRET, t + 301), [SECRET], at), /tolerance/);
  assert.throws(() => verifySignature(raw, 'v1=abc', [SECRET], at), /malformed/);
  assert.throws(() => verifySignature(raw, 'garbage', [SECRET], at), /malformed/);
  assert.throws(() => verifySignature(raw, null, [SECRET], at), /missing/);
});

test('pure rules: entitlement by status, grace and dispute; refund shares; status mapping; form encoding', async () => {
  const { rowEntitles, refundShare, mapStatus, formEncode } = await import('./billing.ts');
  const at = new Date(Date.UTC(2026, 10, 10));
  const base = { status: 'active' as const, grace_until: null, disputed_at: null, current_period_end: new Date(at.getTime() + DAY), cancel_at_period_end: false };
  assert.equal(rowEntitles(null, at), false);
  assert.equal(rowEntitles(base, at), true);
  assert.equal(rowEntitles({ ...base, status: 'trialing' }, at), true);
  assert.equal(rowEntitles({ ...base, status: 'past_due', grace_until: new Date(at.getTime() + 1) }, at), true);
  assert.equal(rowEntitles({ ...base, status: 'past_due', grace_until: at }, at), false);
  for (const s of ['canceled', 'unpaid', 'paused'] as const) assert.equal(rowEntitles({ ...base, status: s }, at), false);
  assert.equal(rowEntitles({ ...base, disputed_at: at }, at), false);
  assert.equal(rowEntitles({ ...base, cancel_at_period_end: true, current_period_end: at }, at), false);
  assert.equal(rowEntitles({ ...base, cancel_at_period_end: true }, at), true);
  const start = new Date(Date.UTC(2026, 10, 1)), end = new Date(Date.UTC(2027, 10, 1));
  assert.equal(refundShare('annual', start, end, new Date(start.getTime() + 14 * DAY), 'cancel'), 1);
  assert.equal(refundShare('annual', start, end, new Date(start.getTime() + 14 * DAY + 1), 'cancel'), 0);
  assert.equal(refundShare('monthly', start, new Date(Date.UTC(2026, 11, 1)), new Date(start.getTime() + DAY), 'cancel'), 0);
  assert.ok(Math.abs(refundShare('monthly', start, new Date(start.getTime() + 30 * DAY), new Date(start.getTime() + 10 * DAY), 'trader') - 2 / 3) < 1e-9);
  assert.equal(refundShare('annual', start, end, end, 'trader'), 0);
  assert.equal(mapStatus('incomplete'), 'unpaid');
  assert.equal(mapStatus('incomplete_expired'), 'canceled');
  assert.equal(mapStatus('past_due'), 'past_due');
  assert.equal(formEncode({ a: 1, b: { c: 'x y' }, l: [{ price: 'p', quantity: 1 }], u: undefined }), 'a=1&b%5Bc%5D=x%20y&l%5B0%5D%5Bprice%5D=p&l%5B0%5D%5Bquantity%5D=1');
});

dbTest('start: hosted checkout with tax by the processor, an opaque reference only, a consent record with the disclosure hash; the webhook is the proof of payment', async () => {
  const b = await import('./billing.ts');
  const { sql } = await import('./db.ts');
  const u = await user();
  await assert.rejects(b.startCheckout({ userId: u, plan: 'monthly', agreed: false, disclosure: 'x', origin: 'http://app.test' }), /consent/);
  const url = await b.startCheckout({ userId: u, plan: 'annual', agreed: true, disclosure: 'the full disclosure text', origin: 'http://app.test' });
  assert.match(url, /\/checkout\/cs_fake/);
  assert.equal(await ent(u), false, 'no access from the return URL alone');
  const cs = fake.state().checkouts.at(-1)!;
  assert.equal(cs.automatic_tax, true);
  assert.equal(cs.success_url, 'http://app.test/account?activating=1');
  assert.equal(cs.cancel_url, 'http://app.test/tools#subscribe');
  const sent = fake.calls.filter((c) => c.method === 'POST').map((c) => decodeURIComponent(c.body)).join('\n');
  assert.doesNotMatch(sent, new RegExp(`${tag}|Test viewer|email|name\\]|user_id|\\b${u}\\b`));
  assert.match(String(cs.client_reference_id), /^ss_[0-9a-f]{24}$/);
  const [consent] = await sql`select * from billing_consents where user_id = ${u}`;
  assert.equal(consent.plan, 'annual');
  assert.equal(consent.disclosure_hash, b.disclosureHash('the full disclosure text'));
  assert.equal(consent.livemode, false);
  assert.deepEqual(Object.keys(consent).sort(), ['created_at', 'disclosure_hash', 'disclosure_version', 'id', 'livemode', 'plan', 'retain_until', 'user_id', 'vendor_customer_id']);
  await fake.handle('POST', `/checkout/${cs.id}/pay`, '', {});
  assert.equal(await ent(u), true);
  assert.equal((await row(u))!.plan, 'annual');
  await assert.rejects(b.startCheckout({ userId: u, plan: 'monthly', agreed: true, disclosure: 'x', origin: 'http://app.test' }), /subscribed/);
  assert.match((await b.portalUrl(u, 'http://app.test'))!, /\/portal\/bps_fake/);
  assert.equal(await b.portalUrl(await user(), 'http://app.test'), null);
});

dbTest('every lifecycle event with recorded payloads: created, trial ending, renewed, payment failed, past due (grace), canceled at period end, resumed, refunded (partial and full), disputed', async () => {
  const { sql } = await import('./db.ts');
  const b = await import('./billing.ts');
  const u = await user();
  const sub = await subscribe(u);
  const types = () => sql`select type from billing_events where vendor_customer_id = ${sub.customer} order by received_at, vendor_event_id`.then((r) => r.map((x) => x.type));
  assert.equal((await row(u))!.status, 'active');
  assert.deepEqual(await types(), ['checkout.session.completed', 'customer.subscription.created', 'invoice.paid']);
  await fake.lifecycle(sub.id, 'trial_will_end'); // no trial at launch: stored, changes nothing
  assert.equal((await row(u))!.status, 'active');
  const end1 = (await row(u))!.current_period_end!.getTime();
  now += 31 * DAY; await fake.lifecycle(sub.id, 'renew');
  assert.ok((await row(u))!.current_period_end!.getTime() > end1);
  await fake.lifecycle(sub.id, 'payment_failed');
  const r = (await row(u))!;
  assert.equal(r.status, 'past_due');
  assert.equal(r.grace_until!.getTime(), now + 7 * DAY);
  assert.equal(await ent(u), true, 'access kept in the grace period');
  now += 3 * DAY; await fake.emit('customer.subscription.updated', sub as never);
  assert.equal((await row(u))!.grace_until!.getTime(), now - 3 * DAY + 7 * DAY, 'a retry keeps the first grace end');
  await fake.lifecycle(sub.id, 'payment_recovered');
  assert.equal((await row(u))!.status, 'active');
  assert.equal((await row(u))!.grace_until, null);
  // Cancel at period end via the portal: the date is kept and access continues until it.
  sub.cancel_at_period_end = true; await fake.emit('customer.subscription.updated', sub as never);
  assert.equal((await row(u))!.cancel_at_period_end, true);
  assert.equal(await ent(u), true);
  await fake.lifecycle(sub.id, 'resume');
  assert.equal((await row(u))!.cancel_at_period_end, false);
  await fake.lifecycle(sub.id, 'refund_partial');
  assert.equal((await row(u))!.status, 'active', 'a partial refund changes nothing');
  assert.equal(await ent(u), true);
  await fake.lifecycle(sub.id, 'refund_full');
  assert.equal((await row(u))!.status, 'canceled', 'a full refund ends access at once');
  assert.equal((await row(u))!.ended_reason, 'refund');
  assert.equal(await ent(u), false);
  assert.equal(fake.subs.get(sub.id)!.status, 'canceled');
  // Disputed: unpaid at once, flagged for a human, and the processor stops renewing (engineer D2).
  const again = await subscribe(u);
  await fake.lifecycle(again.id, 'dispute');
  const disputed = (await sql`select status, disputed_at from subscriptions where vendor_subscription_id = ${again.id}`)[0];
  assert.ok(disputed.disputed_at, 'the dispute is recorded');
  assert.equal(disputed.status, 'canceled', 'unpaid at once, then canceled at the processor');
  assert.equal(await ent(u), false);
  assert.equal(fake.subs.get(again.id)!.status, 'canceled', 'no renewal charge to someone without access');
  const [flag] = await sql`select count(*)::int as n from billing_events where type = 'charge.dispute.created' and flagged and vendor_customer_id is null`;
  assert.ok(flag.n >= 1, 'a dispute is flagged for a human');
  await fake.lifecycle(again.id, 'dispute_won');
  const after = (await sql`select status, disputed_at from subscriptions where vendor_subscription_id = ${again.id}`)[0];
  assert.equal(after.disputed_at, null);
  assert.equal(after.status, 'canceled', 'resuming after a dispute goes through the Subscribe screen again');
  assert.equal(fake.refunds.length, 0, 'a dispute or a canceled refund never refunds twice');
  void b;
});

dbTest('a failed renewal past the grace window ends access; retries exhausted (unpaid) and canceled end it too; resubscribing works after', async () => {
  const b = await import('./billing.ts');
  const u = await user();
  const sub = await subscribe(u);
  await fake.lifecycle(sub.id, 'payment_failed');
  now += 7 * DAY;
  assert.equal(await ent(u), false, 'grace over');
  await fake.lifecycle(sub.id, 'unpaid');
  assert.equal((await row(u))!.status, 'unpaid');
  await fake.lifecycle(sub.id, 'cancel_now');
  assert.equal((await row(u))!.status, 'canceled');
  const again = await subscribe(u, 'annual');
  assert.notEqual(again.id, sub.id);
  assert.equal(await ent(u), true);
  void b;
});

dbTest('replay: the same event delivered again is stored once and is a no-op; a stored-but-failed event is retried', async () => {
  const { sql } = await import('./db.ts');
  const b = await import('./billing.ts');
  const u = await user();
  const sub = await subscribe(u);
  const ev = fake.events.at(-1)!;
  const raw = JSON.stringify(ev);
  const sig = b.signPayload(raw, SECRET, Math.floor(now / 1000));
  const before = await sql`select count(*)::int as n from subscriptions where user_id = ${u}`;
  for (let i = 0; i < 3; i++) assert.deepEqual(await b.handleWebhook(raw, sig), { status: 200, outcome: 'duplicate' });
  assert.deepEqual(await sql`select count(*)::int as n from subscriptions where user_id = ${u}`, before);
  assert.equal((await sql`select count(*)::int as n from billing_events where vendor_event_id = ${ev.id}`)[0].n, 1);
  // A failed apply (the processor down) answers 500 and keeps the event unprocessed; the retry applies it.
  const e2 = { ...ev, id: `${ev.id}_retry` };
  const raw2 = JSON.stringify(e2); const sig2 = b.signPayload(raw2, SECRET, Math.floor(now / 1000));
  fake.fail(503, 1);
  assert.deepEqual(await b.handleWebhook(raw2, sig2), { status: 500, outcome: 'failed' });
  assert.equal((await sql`select error_code from billing_events where vendor_event_id = ${e2.id}`)[0].error_code, 'vendor_503');
  assert.deepEqual(await b.handleWebhook(raw2, sig2), { status: 200, outcome: 'processed' });
  assert.equal((await sql`select error_code, processed_at is not null as done from billing_events where vendor_event_id = ${e2.id}`)[0].done, true);
  void sub;
});

dbTest('out-of-order delivery converges to the same state (each event fetches the subscription fresh)', async () => {
  const { sql } = await import('./db.ts');
  const b = await import('./billing.ts');
  const u = await user();
  const queued: { raw: string; sig: string }[] = [];
  const hold = createBillingFake({ webhookSecret: SECRET, prices: PRICES, now: () => now, deliver: async (raw, sig) => { queued.push({ raw, sig }); return { status: 200 }; } });
  b.billingDeps.fetch = hold.fetch;
  const url = await b.startCheckout({ userId: u, plan: 'monthly', agreed: true, disclosure: 'd', origin: 'http://app.test' });
  await hold.handle('POST', `/checkout/${url.split('/checkout/')[1]}/pay`, '', {});
  const sub = [...hold.subs.values()].at(-1)!;
  await hold.lifecycle(sub.id, 'payment_failed');
  sub.cancel_at_period_end = true; await hold.emit('customer.subscription.updated', sub as never);
  for (const q of queued.reverse()) assert.equal((await b.handleWebhook(q.raw, q.sig)).status, 200);
  const r = (await row(u))!;
  assert.equal(r.status, 'past_due');
  assert.equal(r.cancel_at_period_end, true);
  assert.equal((await sql`select count(*)::int as n from subscriptions where user_id = ${u}`)[0].n, 1);
});

dbTest('a malformed or wrong signature, a body that is not an event, or a live event in test mode is rejected (400) and stores nothing', async () => {
  const { sql } = await import('./db.ts');
  const b = await import('./billing.ts');
  const t = Math.floor(now / 1000);
  const ev = JSON.stringify({ id: 'evt_bad_sig_unit', type: 'invoice.paid', livemode: false, data: { object: {} } });
  assert.deepEqual(await b.handleWebhook(ev, b.signPayload(ev, 'whsec_wrong', t)), { status: 400, outcome: 'rejected' });
  assert.deepEqual(await b.handleWebhook(ev, 'not a signature'), { status: 400, outcome: 'rejected' });
  assert.deepEqual(await b.handleWebhook(ev, null), { status: 400, outcome: 'rejected' });
  assert.deepEqual(await b.handleWebhook('not json', b.signPayload('not json', SECRET, t)), { status: 400, outcome: 'rejected' });
  const live = JSON.stringify({ id: 'evt_live_unit', type: 'invoice.paid', livemode: true, data: { object: {} } });
  assert.deepEqual(await b.handleWebhook(live, b.signPayload(live, SECRET, t)), { status: 400, outcome: 'rejected' });
  assert.equal((await sql`select count(*)::int as n from billing_events where vendor_event_id in ('evt_bad_sig_unit', 'evt_live_unit')`)[0].n, 0);
  const other = JSON.stringify({ id: `evt_other_${tag}_${Date.now()}`, type: 'product.created', livemode: false, data: { object: { id: 'prod_x' } } });
  assert.deepEqual(await b.handleWebhook(other, b.signPayload(other, SECRET, t)), { status: 200, outcome: 'ignored' });
});

dbTest('traders: Record tools included with no customer row, checkout refused; a subscriber who connects a broker is canceled with a pro-rata refund', async () => {
  const { sql } = await import('./db.ts');
  const b = await import('./billing.ts');
  const tr = await user();
  await makeTrader(tr);
  assert.equal(await ent(tr), true);
  assert.deepEqual(await b.access(tr), { kind: 'trader' });
  await assert.rejects(b.startCheckout({ userId: tr, plan: 'monthly', agreed: true, disclosure: 'd', origin: 'http://app.test' }), /trader/);
  assert.equal((await sql`select count(*)::int as n from billing_customers where user_id = ${tr}`)[0].n, 0);
  const u = await user();
  const sub = await subscribe(u);
  now += 10 * DAY;
  await makeTrader(u);
  const report = await b.reconcile();
  assert.ok(report.tradersCanceled >= 1);
  const r = (await sql`select status, ended_reason from subscriptions where user_id = ${u}`)[0];
  assert.deepEqual({ ...r }, { status: 'canceled', ended_reason: 'trader' });
  const refund = fake.refunds.at(-1)!;
  const period = sub.current_period_end - sub.current_period_start;
  assert.equal(refund.amount, Math.floor(999 * (sub.current_period_end - now / 1000) / period));
  assert.equal(await ent(u), true, 'now a trader: included');
});

dbTest('a yearly plan canceled within 14 days of purchase is canceled now with a full refund; after 14 days it runs to period end', async () => {
  const u = await user();
  const sub = await subscribe(u, 'annual');
  now += 13 * DAY;
  sub.cancel_at_period_end = true; await fake.emit('customer.subscription.updated', sub as never);
  assert.equal((await row(u))!.status, 'canceled');
  assert.equal(fake.refunds.at(-1)!.amount, 9999);
  const v = await user();
  const late = await subscribe(v, 'annual');
  now += 15 * DAY;
  late.cancel_at_period_end = true; await fake.emit('customer.subscription.updated', late as never);
  assert.equal((await row(v))!.status, 'active');
  assert.equal((await row(v))!.cancel_at_period_end, true);
  assert.equal(await ent(v), true);
  const m = await user();
  const monthly = await subscribe(m);
  monthly.cancel_at_period_end = true; await fake.emit('customer.subscription.updated', monthly as never);
  assert.equal((await row(m))!.status, 'active', 'monthly: no partial-month refund, runs to period end');
});

dbTest('nightly reconciliation: drift is found, fixed and counted; missing rows are added; expired grace becomes unpaid; old events and consents are purged; logs hold counts only', async () => {
  const { sql } = await import('./db.ts');
  const b = await import('./billing.ts');
  const u = await user();
  const sub = await subscribe(u);
  sub.status = 'past_due'; // drift: the processor changed without a delivered event
  const v = await user();
  const quiet = createBillingFake({ webhookSecret: SECRET, prices: PRICES, now: () => now, deliver: async () => ({ status: 200 }) });
  void quiet;
  // A subscription the app never heard of (its events were lost): the customer row exists.
  const [cust] = await sql`insert into billing_customers (user_id, vendor_customer_id) values (${v}, ${`cus_unit_lost_${tag}_${n}`}) returning vendor_customer_id`;
  fake.state(); // the fake's own customer table is separate from the app's; a lost subscription is created directly
  const lost = await (async () => { const s = await fake.newPaidSubscription(cust.vendor_customer_id as string, 'annual'); return s; })();
  await sql`delete from subscriptions where vendor_subscription_id = ${lost.id}`;
  await sql`insert into billing_events (vendor_event_id, type, livemode, received_at) values ('evt_unit_old', 'invoice.paid', false, now() - interval '36 days')`;
  await sql`insert into billing_consents (plan, disclosure_version, disclosure_hash, livemode, retain_until) values ('monthly', 'v', 'h', false, now() - interval '1 day')`;
  const logs: string[] = []; const orig = console.log; console.log = (...a: unknown[]) => { logs.push(a.join(' ')); };
  let r: Awaited<ReturnType<typeof b.reconcile>>;
  try { r = await b.reconcile(); } finally { console.log = orig; }
  assert.ok(r.checked >= 1);
  assert.ok(r.mismatches >= 1);
  assert.ok(r.missing >= 1);
  assert.equal((await row(u))!.status, 'past_due');
  assert.equal((await row(v))!.plan, 'annual');
  assert.ok(r.eventsPurged >= 1);
  assert.ok(r.consentsPurged >= 1);
  assert.equal((await sql`select count(*)::int as n from billing_events where vendor_event_id = 'evt_unit_old'`)[0].n, 0);
  const line = logs.find((l) => l.startsWith('billing reconcile'))!;
  assert.match(line, /^billing reconcile \{"checked":\d+,"mismatches":\d+,"missing":\d+,"failed":\d+,"graceExpired":\d+,"tradersCanceled":\d+,"eventsPurged":\d+,"consentsPurged":\d+\}$/);
  now += 8 * DAY;
  await sql`update subscriptions set grace_until = now() - interval '1 second' where user_id = ${u}`;
  const r2 = await b.reconcile();
  assert.ok(r2.graceExpired >= 1);
  assert.equal((await row(u))!.status, 'canceled', 'grace over: no access, and the processor stops retrying (engineer D3)');
  assert.equal(fake.subs.get(sub.id)!.status, 'canceled');
  assert.equal(await ent(u), false);
});

dbTest('account deletion cancels at the processor first (no further charge), deletes the processor customer and every billing row except the consent, re-keyed and kept 3 years', async () => {
  const { sql } = await import('./db.ts');
  const b = await import('./billing.ts');
  const { deleteProfile } = await import('./delete.ts');
  const u = await user();
  const sub = await subscribe(u, 'annual');
  const [{ handle }] = await sql`select handle from users where id = ${u}`;
  fake.fail(503, 1);
  await assert.rejects(deleteProfile({ id: u, handle, snaptrade_user_id: null, snaptrade_secret_enc: null }));
  assert.equal((await sql`select count(*)::int as n from users where id = ${u} and deleted_at is not null`)[0].n, 1, 'marked for the hourly retry');
  await deleteProfile({ id: u, handle, snaptrade_user_id: null, snaptrade_secret_enc: null });
  assert.equal(fake.subs.get(sub.id)!.status, 'canceled');
  assert.equal(fake.state().customers.some((c) => c.id === sub.customer), false);
  assert.equal(fake.refunds.at(-1)!.amount, 9999, 'yearly within 14 days: the refund policy applies');
  for (const t of ['subscriptions', 'billing_customers']) assert.equal((await sql.unsafe(`select count(*)::int as n from ${t} where user_id = $1`, [u]))[0].n, 0, t);
  assert.equal((await sql`select count(*)::int as n from billing_events where vendor_customer_id = ${sub.customer}`)[0].n, 0);
  const [c] = await sql`select user_id, vendor_customer_id, retain_until from billing_consents where vendor_customer_id = ${sub.customer}`;
  assert.equal(c.user_id, null);
  assert.ok(c.retain_until.getTime() > Date.now() + 2.9 * 365 * DAY);
  // No charge after the request: the processor holds no live subscription for that customer.
  assert.equal([...fake.subs.values()].filter((s) => s.customer === sub.customer && s.status !== 'canceled').length, 0);
  void b;
});

test('the app stores no card data or personal billing fields: no PAN, CVV, expiry, name, email or address column in the billing tables; no payload column; billing sends no email', () => {
  const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const block = schema.slice(schema.indexOf('-- ---- F-3'));
  const tables = [...block.matchAll(/create table if not exists (\w+) \(([\s\S]*?)\n\);/g)].filter((m) => /^billing|^subscriptions/.test(m[1]));
  assert.deepEqual(tables.map((m) => m[1]).sort(), ['billing_consents', 'billing_customers', 'billing_events', 'billing_runs', 'subscriptions']);
  for (const [, name, cols] of tables) {
    const names = cols.split('\n').map((l) => l.trim().split(/\s+/)[0]).filter((w) => /^[a-z_]+$/.test(w) && w !== 'check' && w !== 'primary');
    for (const c of names) assert.doesNotMatch(c, /card|pan$|cvv|cvc|exp|last4|brand|email|name|address|postal|zip|phone|ip$|payload|amount|tax/, `${name}.${c}`);
  }
  for (const f of ['../lib/billing.ts', '../db/schema.sql', '../e2e/fakes/billing.ts']) {
    assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), 'utf8'), /card_?number|\bcvv\b|\bcvc\b|exp_month|exp_year|\bpan\b/i, f);
  }
  const src = readFileSync(new URL('./billing.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /from '\.\/auth\/|sendMail|AUTH_EMAIL_SEND|login_links/);
  assert.doesNotMatch(src, /snaptrade-typescript-sdk|stripe['"]/);
  // The only file that calls the processor's API.
  assert.match(src, /billingDeps\.fetch\(/);
});

dbTest('heavy use: concurrent deliveries with duplicates are stored once each and none is lost (LOAD=1 runs 100,000)', async () => {
  const { sql } = await import('./db.ts');
  const b = await import('./billing.ts');
  const total = process.env.LOAD === '1' ? 100_000 : 3_000;
  const u = await user();
  const sub = await subscribe(u);
  const t = Math.floor(now / 1000);
  const ids = Array.from({ length: total }, (_, i) => `evt_load_${tag}_${i}`);
  const bodies = ids.map((id, i) => { const raw = JSON.stringify({ id, type: i % 2 ? 'customer.subscription.updated' : 'invoice.paid', livemode: false, data: { object: i % 2 ? { id: sub.id, customer: sub.customer } : { id: `in_${i}`, customer: sub.customer, subscription: sub.id } } }); return { raw, sig: b.signPayload(raw, SECRET, t) }; });
  const started = Date.now();
  let next = 0;
  const outcomes = new Map<string, number>();
  const worker = async () => {
    while (next < bodies.length * 2) {
      const k = next++; const x = bodies[k % bodies.length];
      const r = await b.handleWebhook(x.raw, x.sig);
      assert.equal(r.status, 200);
      outcomes.set(r.outcome, (outcomes.get(r.outcome) ?? 0) + 1);
    }
  };
  await Promise.all(Array.from({ length: 32 }, worker)); // engineer D1: more workers than pool connections
  const ms = Date.now() - started;
  const [{ n: stored }] = await sql`select count(*)::int as n from billing_events where vendor_event_id like ${`evt_load_${tag}_%`} and processed_at is not null`;
  assert.equal(stored, total, 'every event stored once and processed');
  assert.equal(outcomes.get('duplicate'), total, 'every second delivery was a no-op');
  assert.equal((await sql`select count(*)::int as n from subscriptions where user_id = ${u}`)[0].n, 1);
  console.log(`# load: ${total * 2} deliveries (${total} unique) in ${ms} ms, ${Math.round((total * 2) / (ms / 3_600_000))} per hour`);
  await sql`delete from billing_events where vendor_event_id like ${`evt_load_${tag}_%`}`;
});

dbTest('a subscription the processor moved to unpaid itself is canceled there by the reconciliation (engineer E2)', async () => {
  const b = await import('./billing.ts');
  const u = await user();
  const sub = await subscribe(u);
  await fake.lifecycle(sub.id, 'unpaid');
  assert.equal((await row(u))!.status, 'unpaid');
  assert.equal((await row(u))!.grace_until, null);
  await b.reconcile();
  assert.equal(fake.subs.get(sub.id)!.status, 'canceled');
  assert.equal((await row(u))!.status, 'canceled');
});

dbTest('an earlier partial refund lowers the pro-rata refund but never blocks it, and a retry never refunds twice (engineer E3)', async () => {
  const b = await import('./billing.ts');
  const u = await user();
  const sub = await subscribe(u);
  await fake.lifecycle(sub.id, 'refund_partial'); // 499 of 999 refunded by someone else
  now += 15 * DAY;
  await makeTrader(u);
  await b.cancelIfTrader(u);
  const ours = fake.refunds.filter((r) => (r.metadata as { subscription?: string }).subscription === sub.id);
  assert.equal(ours.length, 1);
  const share = Math.floor(999 * (sub.current_period_end - now / 1000) / (sub.current_period_end - sub.current_period_start));
  assert.equal(ours[0].amount, Math.min(share, 999 - 499));
  await b.reconcile(); // the backstop finds nothing left to do
  await b.cancelIfTrader(u);
  assert.equal(fake.refunds.filter((r) => (r.metadata as { subscription?: string }).subscription === sub.id).length, 1);
});
