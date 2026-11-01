// CHORES-3 end to end at 360 px (docs/features/logs/chores-cycle3/plan.md, Round 2 overrides §1-§5), against
// `npm run start` with ALLOW_DEV_AUTH=1 and the seeded demo data. CI has no billing env, so the C3-39 checks here run the
// "not available right now" state; with the billing vendor's fake env (header of e2e/f3-billing.spec.ts) an account
// that is not allowlisted sees "(not open yet)" and an allowlisted one the unchanged F-3 screens (f3-billing.spec.ts).
// Every fixture is this file's own account, selected by handle (shared database). Fictional data only (POLICY P2).
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

test.use({ viewport: { width: 360, height: 740 } });
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const billingOn = !!process.env.STRIPE_API_BASE;
const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
const NOTES = "If you publish a record, other subscribers' private notes about you are deleted and you are removed from their saved views.";
const POSITION = 'Closed trades imported read-only from connected broker accounts. Losses included.';
const tag = `c3${Date.now().toString(36).slice(-6)}`;
let seq = 0;
const created: string[] = [];

async function signIn(page: Page) {
  const h = `${tag}_${++seq}`;
  created.push(h);
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(h);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${h}$`));
  return { handle: h, id: (await sql`select id from users where handle = ${h}`)[0].id as number };
}
const noScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

test.afterAll(async () => {
  if (created.length) {
    await sql`delete from connections where user_id in (select id from users where handle = any(${created}))`;
    await sql`delete from users where handle = any(${created})`;
  }
  await sql.end({ timeout: 1 });
});

test('C3-34: /api/health answers ok (200) or degraded (503) only, never cached, the same with a wrong bearer; a wrong cron bearer is still a plain 401', async ({ request }) => {
  for (const headers of [{}, { authorization: 'Bearer wrong-wrong-wrong' }] as Record<string, string>[]) {
    const res = await request.get('/api/health', { headers });
    expect(res.headers()['cache-control']).toBe('no-store');
    const body = await res.json();
    expect(Object.keys(body)).toEqual(['status']);
    expect([[200, 'ok'], [503, 'degraded']]).toContainEqual([res.status(), body.status]);
  }
  for (const path of ['/api/sync', '/api/billing/reconcile']) {
    const res = await request.post(path, { headers: { authorization: 'Bearer wrong-wrong-wrong' } });
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  }
  if (process.env.CRON_SECRET) {
    const res = await request.get('/api/health', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    const body = await res.json();
    expect(Object.keys(body)).toEqual(['status', 'db', 'lastRunAt', 'lastRunAgeHours', 'stalestSyncAgeHours', 'thresholdHours']);
    expect(body.db).toBe(true);
    expect(body.thresholdHours).toBe(0.25); // MISSING_SHARD_MS on the documented 5-minute schedule
    expect(JSON.stringify(body)).not.toMatch(/@|\$|%|error/i);
  }
});

test('C3-44: the notes line on delete shows only when it applies; a connection alone is not a record; view 2 unchanged', async ({ page }) => {
  const u = await signIn(page);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Delete my profile' })).toBeVisible();
  await expect(page.getByText(NOTES)).toHaveCount(0);
  await expect(page.getByTestId('delete-first')).toBeVisible(); // Delete my profile unchanged (C3-40 not approved)
  const [a] = await sql`select signup_attempt_id from users where id = ${u.id}`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at) values (${a.signup_attempt_id}, ${u.id}, 'importing', now())`;
  await page.reload();
  await expect(page.getByText(NOTES)).toHaveCount(0);
  await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    values (${u.id}, ${`${tag}-s`}, 'acct', 'CHX', now() - interval '3 days', now() - interval '1 day', -0.04, 2, true)`;
  await page.reload();
  await expect(page.getByText(NOTES, { exact: true })).toBeVisible();
  await noScroll(page);
  await page.goto('/settings?confirm=1');
  await expect(page.getByText(NOTES)).toHaveCount(0);
  await expect(page.getByTestId('delete-final')).toBeVisible();
});

test('K20: the home link preview carries the positioning line, no product name or figure, an absolute text-only card; other pages keep theirs', async ({ page, request }) => {
  await page.goto('/');
  const meta = (sel: string) => page.locator(sel).getAttribute('content');
  const title = await meta('meta[property="og:title"]');
  const desc = await meta('meta[property="og:description"]');
  expect(title).toBe('Closed trades imported read-only from connected broker accounts.');
  // FIXES-CYCLE4-PART2 (F4-8): the card URL names the public-filing state too (p=1 while the feed can show a filer's
  // record; other specs create filer fixtures on the shared database, so either state is read from the URL, then held).
  const image = await meta('meta[property="og:image"]');
  expect(image).toMatch(/^https?:\/\/[^/]+\/home-card\?d=1&p=[01]$/); // the seed is demo: the card URL names that state
  const pub = image!.endsWith('p=1') ? ' Records built from public filings are marked Public filing.' : '';
  // The seed is all demo: the Demo sentence is appended while demo records exist.
  expect(desc).toBe(`Losses included.${pub} Demo records are marked Demo.`);
  expect(desc!.startsWith(title!)).toBe(false);
  expect(await meta('meta[name="description"]')).toBe(`${POSITION}${pub} Demo records are marked Demo.`);
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  expect(await meta('meta[name="twitter:title"]')).toBe(title);
  for (const s of [title, desc]) expect(s).not.toMatch(/stock social|\d|%|\$|\bevery\b|any broker|the only/i);
  await expect(page).toHaveTitle('Stock Social');
  const card = await request.get('/home-card?d=1');
  expect(card.status()).toBe(200);
  expect(card.headers()['content-type']).toBe('image/png');
  const png = await card.body();
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
  for (const path of ['/how', '/t']) {
    await page.goto(path);
    expect(await meta('meta[name="description"]')).not.toContain(POSITION);
    expect(await page.locator('meta[property="og:image"][content*="/home-card"]').count()).toBe(0);
  }
  await page.goto('/?after=x');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
});

test('C3-39: while checkout is not open, /account has no primary button to the locked page and says why in the link text', async ({ page }) => {
  await signIn(page);
  await page.goto('/account');
  const text = billingOn ? 'See Record tools (not open yet)' : 'See Record tools (not available right now)';
  const link = page.locator('main').getByRole('link', { name: text, exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveClass(/\bsecondary\b/);
  await expect(link).toHaveAttribute('href', '/tools');
  await expect(page.locator('main').getByRole('link', { name: 'See Record tools', exact: true })).toHaveCount(0);
  // No primary-styled control in main: every .button there is secondary.
  const primaries = await page.locator('main .button, main button').evaluateAll((els) => els.filter((e) => !e.classList.contains('secondary')).length);
  expect(primaries).toBe(0);
  expect(await page.locator('main').innerText()).not.toMatch(/\$\d|soon|waitlist|notify me|email/i);
  await noScroll(page);
});

for (const signedIn of [false, true]) {
  test(`C3-39: locked /tools ${signedIn ? 'signed in' : 'signed out'} has one way back into the app, keyboard reachable, 44 px tall; disclaimer first`, async ({ page }) => {
    test.skip(billingOn && !signedIn, 'with checkout open to signed-out viewers the Subscribe screen shows (F-3, unchanged)');
    if (signedIn) await signIn(page);
    await page.goto('/tools');
    await expect(page.locator('main .rt-disclaimer').first()).toContainText(DISCLAIMER);
    const legal = ['Terms', 'Privacy', 'How records are calculated'];
    const names = await page.locator('main a').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
    expect(names.filter((n) => !legal.includes(n))).toEqual(['Back to the feed']);
    const back = page.locator('main').getByRole('link', { name: 'Back to the feed' });
    await expect(back).toHaveAttribute('href', '/');
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await back.focus();
    await expect(back).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/tools');
    await noScroll(page);
  });
}
