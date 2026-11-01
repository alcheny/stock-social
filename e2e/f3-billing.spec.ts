// F-3 · Record tools and billing end to end at 360 px, against `npm run start` (ALLOW_DEV_AUTH=1) and seeded demo data.
// Two groups:
// - Always: entitlements come from the app's own `subscriptions` row (AC4), so these tests write the row directly and
//   need no processor: the locked page, traders never priced, public records unchanged by plan state, the comparison,
//   notes, owner-only views, the lapsed state, the export, the deleted-trader line, headers.
// - With the in-repo fake processor (e2e/fakes/billing.ts, started here on port 4103): the server must run with
//     STRIPE_API_BASE=http://127.0.0.1:4103 STRIPE_SECRET_KEY=sk_test_e2e STRIPE_WEBHOOK_SECRET=whsec_e2e
//     STRIPE_PRICE_MONTHLY=price_e2e_monthly STRIPE_PRICE_ANNUAL=price_e2e_annual
//   otherwise these skip and say so (CI has no billing env yet: pre-authorization request 1 in
//   docs/features/logs/F-3/plan-round2.md); lib/billing.test.ts covers the same behaviour against the same fake.
// Fictional data only (POLICY P2).
import { expect, test, type Page } from '@playwright/test';
import type { Server } from 'node:http';
import postgres from 'postgres';
import { startBillingFake, type BillingFake } from './fakes/billing.ts';

test.use({ viewport: { width: 360, height: 740 } });
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const billingOn = !!process.env.STRIPE_API_BASE;
const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
const tag = `f3${Date.now().toString(36).slice(-5)}`;
let seq = 0;
const handle = () => `${tag}_${++seq}`;
const created: string[] = [];

async function signIn(page: Page, h: string) {
  created.push(h);
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(h);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${h}$`));
  return (await sql`select id from users where handle = ${h}`)[0].id as number;
}
async function subscribeRow(userId: number, status = 'active', extra: { cancel?: boolean; grace?: boolean } = {}) {
  const id = `sub_e2e_${tag}_${userId}_${Math.random().toString(36).slice(2, 7)}`;
  await sql`insert into subscriptions (user_id, vendor_subscription_id, vendor_customer_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, grace_until)
    values (${userId}, ${id}, ${`cus_e2e_${userId}`}, 'monthly', ${status}, now() - interval '3 days', now() + interval '27 days', ${!!extra.cancel}, ${extra.grace ? sql`now() + interval '5 days'` : null})`;
  return id;
}
async function makeTrader(userId: number, state = 'connected') {
  const [u] = await sql`select signup_attempt_id from users where id = ${userId}`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at) values (${u.signup_attempt_id}, ${userId}, ${state}, ${state === 'pending' ? null : sql`now()`})`;
}
const demo = async () => (await sql`select u.handle from users u where exists (select 1 from activities a where a.user_id = u.id and a.source = 'demo') and u.deleted_at is null order by u.handle limit 3`).map((r) => r.handle as string);
// Notes fold away on comparison cards (business lead demand 2): open the fold first.
const note = async (page: Page, h: string) => {
  const fold = page.locator(`summary`, { hasText: new RegExp(`private note about @${h}$`) });
  if (await fold.count()) { const d = fold.locator('xpath=..'); if (!(await d.getAttribute('open') !== null)) await fold.click(); }
  return page.getByLabel(`Private note about @${h} (only you can see it)`);
};
const noPrice = async (page: Page) => {
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/\$\d|per month|per year|Subscribe:|Subscribe to|plus tax|card details|Plan:|Manage subscription|Cancel subscription/i);
  await expect(page.locator('input[type=checkbox][name=agreed]')).toHaveCount(0);
};

test.afterEach(async () => {
  for (const h of created.splice(0)) await sql`delete from users where handle = ${h}`;
});
test.afterAll(async () => { await sql.end({ timeout: 1 }); });

test('F-3 signed out: /tools is a locked page with the disclaimer and legal links first, no record, figure or handle; private headers; not indexed', async ({ page }) => {
  const res = await page.goto('/tools');
  expect(res!.status()).toBe(200);
  const h = res!.headers();
  expect(h['x-robots-tag']).toBe('noindex, nofollow');
  expect(h['referrer-policy']).toBe('no-referrer');
  expect(h['cache-control']).toMatch(/private/);
  expect(h['cache-control']).toMatch(/no-store/);
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('h1')).toHaveText('Record tools');
  const first = page.locator('main .rt-disclaimer').first();
  await expect(first).toContainText(DISCLAIMER);
  for (const name of ['Terms', 'Privacy', 'How records are calculated']) await expect(first.getByRole('link', { name })).toBeVisible();
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/@\w|%|\bbest\b|\btop\b|winner/i);
  await expect(page.locator('main canvas, main svg, main .rt-card')).toHaveCount(0);
  await expect(page.locator('input[type=checkbox][name=agreed]')).toHaveCount(0);
  if (billingOn) {
    await expect(page.getByRole('link', { name: 'Sign in to subscribe' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Not now' })).toHaveClass(/choice/);
  } else {
    await expect(page.getByText('Subscriptions are not available right now. Trader records stay free to view.')).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const sitemap = await (await page.request.get('/sitemap.xml')).text();
  expect(sitemap).not.toMatch(/\/tools|\/account/);
});

test('F-3 Subscribe screen: every disclosure visible above the buttons, no plan preselected, an unticked box is refused, "Not now" has the button\'s weight', async ({ page }) => {
  test.skip(!billingOn, 'needs the server started with the fake processor env (see the header)');
  await signIn(page, handle());
  await page.goto('/tools');
  const block = page.locator('#subscribe');
  for (const line of ['Test mode, no real charge', 'No free trial. You are charged today.', 'To cancel: Account → Cancel subscription.', 'Monthly plans: no refunds for partial months.',
    "You enter your card details on the payment processor's page. Stock Social never sees your card number.", 'Monthly: $9.99 per month plus applicable sales tax', 'Yearly: $99.99 per year plus applicable sales tax',
    'Monthly renews automatically every month at $9.99 plus tax. If you subscribe today, the next charge is on', 'Yearly renews automatically every year at $99.99 plus tax.']) await expect(block).toContainText(line);
  await expect(block.locator('details')).toHaveCount(0);
  for (const box of await block.locator('input[name=agreed]').all()) await expect(box).not.toBeChecked();
  await block.getByRole('button', { name: 'Subscribe: $9.99/month' }).click();
  await expect(page.locator('#sub-err')).toHaveText('Tick the box to agree to automatic renewal.');
  await expect(page).toHaveURL(/\/tools\?e=agree&p=monthly#subscribe$/);
  await expect(page.locator('#agree-monthly')).toBeFocused(); // UX lead U2
  const sub = await block.getByRole('button', { name: 'Subscribe: $9.99/month' }).evaluate((e) => getComputedStyle(e).fontWeight + getComputedStyle(e).backgroundColor + getComputedStyle(e).minHeight);
  const notNow = await block.getByRole('link', { name: 'Not now' }).evaluate((e) => getComputedStyle(e).fontWeight + getComputedStyle(e).backgroundColor + getComputedStyle(e).minHeight);
  expect(notNow).toBe(sub);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('F-3 "Sign in to subscribe" brings a new viewer back to Record tools, not the broker-connect screen', async ({ page }) => {
  test.skip(!billingOn, 'needs the server started with the fake processor env (see the header)');
  await page.goto('/tools');
  await page.getByRole('link', { name: 'Sign in to subscribe' }).click();
  await expect(page).toHaveURL(/\/login$/);
  const h = handle();
  created.push(h);
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(h);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/tools$/);
  await expect(page.locator('#subscribe')).toBeVisible();
  await page.goto('/login/dev'); // the cookie is read once
  await page.getByLabel('Handle').fill(h);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${h}$`));
});

test('F-3 traders never see a price: connected, frozen (failed after consent) and expired-after-consent traders have Record tools included; a pending connection is still a viewer', async ({ page }) => {
  for (const state of ['connected', 'failed', 'expired']) {
    const h = handle();
    const id = await signIn(page, h);
    await makeTrader(id, state);
    for (const path of ['/tools', '/account', '/settings', `/u/${h}`]) { await page.goto(path); await noPrice(page); }
    await page.goto('/tools');
    await expect(page.getByText('Record tools is included with your connected record.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create view' })).toBeVisible();
    await page.goto('/account');
    await expect(page.getByText('Record tools is included with your connected record.')).toBeVisible();
    await page.context().clearCookies();
  }
  const v = handle();
  const vid = await signIn(page, v);
  await makeTrader(vid, 'pending');
  await page.goto('/tools');
  await expect(page.getByRole('button', { name: 'Create view' })).toHaveCount(0);
});

test('F-3 a public record is the same for a subscriber, a lapsed subscriber and a non-subscriber (no paywall, no blur)', async ({ page }) => {
  const [maya] = await demo();
  const id = await signIn(page, handle());
  const snap = async () => { await page.goto(`/u/${maya}`); return page.locator('main').innerText(); };
  const before = await snap();
  const sub = await subscribeRow(id);
  const during = await snap();
  await sql`update subscriptions set status = 'canceled' where vendor_subscription_id = ${sub}`;
  const after = await snap();
  expect(during).toBe(before);
  expect(after).toBe(before);
  for (const path of [`/u/${maya}`, '/']) {
    await page.goto(path);
    expect(await page.locator('main').innerText()).not.toMatch(/Record tools|Subscribe|\$\d/);
    await expect(page.locator('[style*="blur"], .blur, .locked')).toHaveCount(0);
  }
});

test('F-3 Record tools: compare in the chosen order with each range and its lower end, the profile\'s figures, losses as signed text, no sorting or highlight; notes are private; views are owner-only', async ({ page, browser }) => {
  const traders = await demo();
  test.skip(traders.length < 3, 'needs the seeded demo traders');
  test.setTimeout(90_000);
  const id = await signIn(page, handle());
  await subscribeRow(id);
  await page.goto('/tools');
  await expect(page.locator('.rt-disclaimer').first()).toContainText(DISCLAIMER);
  await page.getByLabel('Name (optional)').fill('Mine');
  await page.getByRole('button', { name: 'Create view' }).click();
  await expect(page).toHaveURL(/\/tools\?view=[0-9a-f-]{36}&m=created$/);
  const viewUrl = page.url().replace(/&m=created$/, '');
  // Added in the order C, A, B; the cards keep that order (never sorted).
  for (const [i, h] of [traders[2], traders[0], traders[1]].entries()) {
    await page.getByLabel('Add a trader by exact handle').fill(h);
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await expect(page.locator('#rt-msg')).toHaveText(`Trader added in position ${i + 1} of ${i + 1}.`);
    expect(page.url()).not.toContain(h); // handles never in the URL (K1)
  }
  const order = () => page.locator('.rt-card h2 a').allInnerTexts();
  expect(await order()).toEqual([`@${traders[2]}`, `@${traders[0]}`, `@${traders[1]}`]);
  await page.getByRole('button', { name: `Move @${traders[2]} down` }).click();
  await expect(page.locator('#rt-msg')).toHaveText('Trader moved to position 2 of 3.');
  expect(await order()).toEqual([`@${traders[0]}`, `@${traders[2]}`, `@${traders[1]}`]);
  await expect(page.locator('#card-2')).toBeFocused(); // the moved card, scrolled into view (UX lead U3)
  await page.getByRole('button', { name: `Move @${traders[2]} up` }).click();
  await expect(page.locator('#rt-msg')).toHaveText('Trader moved to position 1 of 3.');
  await expect(page.locator('#card-1')).toBeFocused(); // a second action on the same page moves focus again
  await page.getByRole('button', { name: `Move @${traders[2]} down` }).click();
  await expect(page.locator('#rt-msg')).toHaveText('Trader moved to position 2 of 3.');
  // Figures equal the profile's own text; the lower end sits inside the range row only.
  const card = page.locator('.rt-card').first();
  const profile = await browser.newPage();
  await profile.goto(`/u/${traders[0]}`);
  const win = (await profile.locator('.stat.big b').first().innerText()).trim();
  const avg = (await profile.locator('.stat.big b').nth(1).innerText()).trim();
  const range = (await profile.locator('.stat small.range').innerText()).replace(' · 95% range', '').trim();
  await profile.close();
  await expect(card.locator('dd').nth(1)).toHaveText(win);
  await expect(card.locator('dd').nth(2)).toHaveText(avg);
  await expect(card.getByText(range)).toBeVisible();
  const low = range.match(/^\((\S+) to/)![1];
  await expect(card.getByText(`Lower end of range: ${low}`)).toBeVisible();
  await expect(page.locator('.rt-figures dt', { hasText: 'Lower end of range' })).toHaveCount(0);
  // Every card is styled the same: no first-place emphasis, no colour scale, no summary, no open positions.
  const looks = await page.locator('.rt-card').evaluateAll((cs) => cs.map((c) => { const s = getComputedStyle(c); return `${s.borderColor}|${s.backgroundColor}|${s.fontSize}|${s.fontWeight}`; }));
  expect(new Set(looks).size).toBe(1);
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/\bbest\b|\btop\b|winner|who to follow|Open positions|unrealized|leader|higher than|lower than/i);
  await expect(page.getByRole('button', { name: /share/i })).toHaveCount(0);
  // A private note, saved and shown only to its owner.
  await (await note(page, traders[0])).fill('Looks at holding periods <b>x</b>');
  await page.getByRole('button', { name: `Save note about @${traders[0]}` }).click();
  await expect(page.locator('#rt-msg')).toHaveText('Note saved.');
  await expect(await note(page, traders[0])).toHaveValue('Looks at holding periods <b>x</b>');
  await page.goto(`/u/${traders[0]}`);
  expect(await page.locator('body').innerText()).not.toContain('Looks at holding periods');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  // Owner-only: another account and a signed-out visitor get the same 404 as a view that does not exist.
  const missing = viewUrl.replace(/view=[0-9a-f-]{36}/, 'view=00000000-0000-4000-8000-000000000000');
  const other = await (await browser.newContext({ viewport: { width: 360, height: 740 } })).newPage();
  await signIn(other, handle());
  const r1 = await other.goto(viewUrl); const b1 = await other.locator('body').innerText();
  const r2 = await other.goto(missing); const b2 = await other.locator('body').innerText();
  expect([r1!.status(), r2!.status()]).toEqual([404, 404]);
  expect(b1).toBe(b2);
  expect(b1).not.toContain('Mine');
  const anon = await (await browser.newContext()).newPage();
  expect((await anon.goto(viewUrl))!.status()).toBe(404);
  // Export: exactly the user's own views, notes and status, with the disclaimer.
  const res = await page.request.get('/account/export');
  expect(res.headers()['content-disposition']).toMatch(/attachment/);
  const data = await res.json();
  expect(Object.keys(data).sort()).toEqual(['disclaimer', 'notes', 'subscription', 'views']);
  expect(data.disclaimer).toBe(DISCLAIMER);
  expect(data.views[0].traders).toEqual([traders[0], traders[2], traders[1]]);
  expect(data.notes[0]).toMatchObject({ trader: traders[0], text: 'Looks at holding periods <b>x</b>' });
  expect(data.subscription.status).toBe('active');
});

test('F-3 lapsed: views and notes stay readable, editable and downloadable; only the comparison is off; past-due and cancel-scheduled lines show their dates', async ({ page }) => {
  const traders = await demo();
  const id = await signIn(page, handle());
  const sub = await subscribeRow(id, 'past_due', { grace: true });
  await page.goto('/tools');
  await expect(page.getByRole('alert').filter({ hasText: 'Your last payment did not go through. You keep Record tools until' })).toBeVisible();
  await page.getByRole('button', { name: 'Create view' }).click();
  await page.getByLabel('Add a trader by exact handle').fill(traders[0]);
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await (await note(page, traders[0])).fill('kept after a lapse');
  await page.getByRole('button', { name: `Save note about @${traders[0]}` }).click();
  const viewUrl = page.url().split('&')[0];
  await sql`update subscriptions set status = 'past_due', grace_until = null, cancel_at_period_end = false where vendor_subscription_id = ${sub}`;
  await sql`update subscriptions set status = 'active', cancel_at_period_end = true where vendor_subscription_id = ${sub}`;
  await page.goto('/tools');
  await expect(page.getByText(/Your subscription ends on \w{3} \d{1,2}, \d{4}\. Record tools stays on until then\./)).toBeVisible();
  await sql`update subscriptions set status = 'canceled', cancel_at_period_end = false where vendor_subscription_id = ${sub}`;
  await page.goto(viewUrl);
  await expect(page.getByText('Your subscription has ended. The comparison is off; your saved views and notes stay here to read, edit, download or delete.')).toBeVisible();
  await expect(page.locator('.rt-figures')).toHaveCount(0);
  expect(await page.locator('.rt-card').innerText()).not.toMatch(/%/);
  await expect(await note(page, traders[0])).toHaveValue('kept after a lapse');
  await (await note(page, traders[0])).fill('edited after a lapse');
  await page.getByRole('button', { name: `Save note about @${traders[0]}` }).click();
  await expect(page.locator('#rt-msg')).toHaveText('Note saved.');
  await expect(page.getByLabel('Add a trader by exact handle')).toHaveCount(0);
  await expect(page.getByText('Adding and comparing traders needs a subscription. Your views and notes stay yours.')).toBeVisible();
  const data = await (await page.request.get('/account/export')).json();
  expect(data.notes[0].text).toBe('edited after a lapse');
  await page.goto('/account');
  await expect(page.getByText('You have no active subscription.')).toBeVisible();
});

test('F-3 a trader who deletes their account leaves the subscriber\'s views and notes; one line says so until dismissed, naming no one', async ({ page, browser }) => {
  const id = await signIn(page, handle());
  await subscribeRow(id);
  const gone = handle();
  const other = await (await browser.newContext()).newPage();
  await signIn(other, gone);
  await page.goto('/tools');
  await page.getByRole('button', { name: 'Create view' }).click();
  await page.getByLabel('Add a trader by exact handle').fill(gone);
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await (await note(page, gone)).fill('about them');
  await page.getByRole('button', { name: `Save note about @${gone}` }).click();
  await other.goto('/settings?confirm=1');
  await other.getByTestId('delete-final').click();
  await expect(other).toHaveURL(/localhost:3000\/$/);
  await page.goto('/tools');
  const line = page.getByText('A trader in your views or notes deleted their account; they and your note were removed.');
  await expect(line).toBeVisible();
  expect(await page.locator('main').innerText()).not.toContain(gone);
  await page.reload();
  await expect(line).toBeVisible(); // a reload or a prefetch never uses it up
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(line).toHaveCount(0);
});

test.describe('F-3 with the fake processor', () => {
  let fake: { server: Server; base: string; fake: BillingFake } | null = null;
  test.beforeAll(async () => {
    if (!billingOn) return;
    fake = await startBillingFake(4103, { webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_e2e', prices: { monthly: process.env.STRIPE_PRICE_MONTHLY ?? 'price_e2e_monthly', annual: process.env.STRIPE_PRICE_ANNUAL ?? 'price_e2e_annual' }, webhookUrl: 'http://localhost:3000/api/billing/webhook' });
  });
  test.afterAll(async () => { await new Promise((r) => fake?.server.close(r) ?? r(null)); });

  test('F-3 start, cancel and resume without support: hosted checkout, activation from the webhook, hosted portal via "Cancel subscription"', async ({ page }) => {
    test.skip(!billingOn, 'needs the server started with the fake processor env (see the header)');
    const id = await signIn(page, handle());
    await page.goto('/tools');
    await page.getByLabel('I agree my subscription renews automatically at $9.99 per month plus tax until I cancel.').check();
    await page.getByRole('button', { name: 'Subscribe: $9.99/month' }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:4103\/checkout\//);
    await expect(page.getByText(/plus tax/)).toBeVisible();
    await page.getByRole('button', { name: 'Pay (test card)' }).click();
    await expect(page).toHaveURL(/\/account\?activating=1$/);
    await expect(page.getByText('Plan: Monthly, $9.99 per month plus tax')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/^Renews on \w{3} \d{1,2}, \d{4} at \$9\.99 plus tax\.$/)).toBeVisible();
    await expect(page.getByText('Test mode, no real charge')).toBeVisible();
    const [consent] = await sql`select plan, disclosure_hash, livemode from billing_consents where user_id = ${id}`;
    expect(consent).toMatchObject({ plan: 'monthly', livemode: false });
    await page.getByRole('button', { name: 'Cancel subscription' }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:4103\/portal\//);
    await page.getByRole('button', { name: 'Cancel subscription' }).click();
    await page.getByRole('link', { name: 'Return' }).click();
    await expect(page.getByText(/^Your subscription ends on \w{3} \d{1,2}, \d{4}\. You keep Record tools until then and will not be charged again\.$/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Manage subscription' }).click();
    await page.getByRole('button', { name: 'Resume subscription' }).click();
    await page.getByRole('link', { name: 'Return' }).click();
    await expect(page.getByText(/^Renews on /)).toBeVisible({ timeout: 15_000 });
    // No billing email from the app, and the processor saw no handle, user id or email.
    const sent = fake!.fake.calls.filter((c) => c.method === 'POST').map((c) => decodeURIComponent(c.body)).join('\n');
    expect(sent).not.toMatch(new RegExp(`${tag}|email|user_id`));
  });
});
