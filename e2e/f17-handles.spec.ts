// F-17 handle and name integrity at 360 px (docs/features/F-17-handle-and-name-integrity.md; plan
// docs/features/logs/F-16-F-17/plan.md §2.6, §8 F-17 #6, #10, #17, #18). Each rejection names its rule in visible text
// directly under the field, the field is aria-invalid and described by the alert, the alert is role=alert and the
// field has focus. After a rename the old handle answers the neutral retired 404 and serves none of the trader's
// images. Fixture rows are this file's own (a random tag), removed by handle at the end.
import { expect, test, type Locator, type Page } from '@playwright/test';

// This file's own pool: ending lib/db.ts's shared pool here would end it for the next spec in the same worker.
let pool: import('postgres').Sql | undefined;
const db = async () => (pool ??= (await import('postgres')).default(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} }));
test.afterAll(async () => { await pool?.end({ timeout: 1 }); });

const tag = () => `f17${Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6).padEnd(6, 'q')}`;
const made: string[] = [];
test.afterEach(async () => {
  const sql = await db();
  if (!made.length) return;
  await sql`delete from handle_reservations where handle in ${sql(made)} or user_id in (select id from users where handle in ${sql(made)})`;
  await sql`delete from users where handle in ${sql(made)}`;
  made.length = 0;
});

async function signUp(page: Page, handle: string, name = '') {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  if (name) await page.getByLabel('Display name').fill(name);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
}

// The rule is visible text in an alert directly after the field; the field is invalid, described by it and focused,
// and both sit in the 360 px viewport.
async function expectFieldAlert(page: Page, field: Locator, text: string) {
  const id = await field.getAttribute('id');
  const alert = page.locator(`#${id} + [role="alert"]`);
  await expect(alert).toHaveText(text);
  await expect(alert).toBeVisible();
  const alertId = await alert.getAttribute('id');
  expect(alertId).toBeTruthy();
  expect((await field.getAttribute('aria-describedby'))?.split(' ')).toContain(alertId);
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toBeFocused();
  await expect(page.locator('main').getByRole('alert')).toHaveCount(1);
  const vp = page.viewportSize()!;
  for (const box of [await field.boundingBox(), await alert.boundingBox()]) {
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
  }
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 360, height: 740 }); });

test('sign-up: a reserved handle and a bidi "Verified" display name are each refused beside their field, at 360 px', async ({ page }) => {
  await signUp(page, 'admin');
  await expect(page).toHaveURL(/\/login\/dev\?error=handle-reserved/);
  await expectFieldAlert(page, page.getByLabel('Handle'), 'That handle is reserved. Try another.');
  expect(await page.locator('main').innerText()).not.toContain('Display name can');

  const h = tag();
  await signUp(page, h, 'Ver‮ified Desk');
  await expect(page).toHaveURL(/\/login\/dev\?error=name-verified/);
  await expectFieldAlert(page, page.getByLabel('Display name'), 'Display names can’t say verified or official.');
  expect(page.url()).not.toMatch(/Desk|%E2%80%AE|name=/i); // the typed name never rides in the URL
  expect((await (await db())`select 1 from users where handle = ${h}`).length).toBe(0);
});

test('rename: a reserved handle is refused beside the New handle field, at 360 px', async ({ page }) => {
  const h = tag();
  made.push(h);
  await signUp(page, h);
  await expect(page).toHaveURL(new RegExp(`/u/${h}$`));
  await page.getByText('Change handle').click();
  await page.getByLabel('New handle').fill('support');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${h}\\?handle=reserved$`));
  await expectFieldAlert(page, page.getByLabel('New handle'), 'That handle is reserved. Try another.');
  expect((await (await db())`select handle from users where handle = ${h}`).length).toBe(1);
});

test('after a rename the old handle is a neutral 404 and serves none of the trader\'s pages or images', async ({ page }) => {
  const sql = await db();
  const old = tag();
  const next = `${old}_n`;
  made.push(old, next);
  await signUp(page, old, 'Quill Fixture');
  await expect(page).toHaveURL(new RegExp(`/u/${old}$`));
  const [u] = await sql`select id from users where handle = ${old}`;
  const sell = `${old}-s`;
  await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    values (${u.id}, ${sell}, 'acct', 'QFX', now() - interval '4 days', now() - interval '1 day', -0.03, 3, true)`;
  expect((await page.request.get(`/u/${old}/trade/${sell}/opengraph-image`)).status()).toBe(200);

  await page.getByText('Change handle').click();
  await page.getByLabel('New handle').fill(next);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${next}$`));

  // A stranger following an old link (signed out, as a shared link lands).
  await page.context().clearCookies();
  const res = await page.goto(`/u/${old}`);
  expect(res?.status()).toBe(404);
  await expect(page).toHaveTitle('Handle no longer in use · Stock Social');
  await expect(page.locator('h1')).toHaveText('This handle is no longer in use');
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('Quill Fixture');
  expect(body).not.toContain('%');
  expect(await page.locator(`a[href*="${next}"]`).count()).toBe(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
  for (const path of ['/opengraph-image', '/story', `/trade/${sell}`, `/trade/${sell}/opengraph-image`, '/pane']) {
    expect((await page.request.get(`/u/${old}${path}`)).status(), path).toBe(404);
  }
  expect((await page.request.get(`/u/${next}/trade/${sell}/opengraph-image`)).status()).toBe(200);
});
