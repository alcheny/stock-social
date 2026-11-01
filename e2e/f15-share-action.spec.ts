// F-15 second half · share_action rows against the running app (360 px): each share control of a trader's own record
// writes one row with the right share class and outcome, one tap, "Link copied" still announced politely; a viewer's or
// signed-out share writes nothing; a failing write never touches the share. Shared database: each test makes its own
// trader and reads only its rows.
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.afterAll(async () => { await sql.end({ timeout: 1 }); });

const rows = async (id: number) => (await sql`select surface, outcome from share_action where user_id = ${id} order by surface, outcome`).map((r) => `${r.surface}/${r.outcome}`);

async function trader(page: Page): Promise<{ id: number; handle: string; sell: string; ym: string }> {
  const handle = `f15sa${Math.random().toString(36).slice(2, 9)}`;
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  const [u] = await sql`select id from users where handle = ${handle}`;
  const sell = `${handle}-s1`;
  const [c] = await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    values (${u.id}, ${sell}, 'a', 'AMD', now() - interval '3 days', now() - interval '1 day', 0.05, 2, true) returning to_char(closed_at at time zone 'UTC', 'YYYY-MM') ym`;
  return { id: u.id, handle, sell, ym: c.ym };
}

test.beforeEach(async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => { delete (Navigator.prototype as { share?: unknown }).share; }); // the copy path
});

test('owner: profile card, month recap, trade page and month page shares each write one row; old columns keep their meaning', async ({ page }) => {
  const t = await trader(page);
  await page.reload();
  const card = page.getByRole('region', { name: 'Share your record' });
  await card.getByRole('button', { name: 'Share my record' }).click();
  await expect(card.getByRole('button', { name: 'Link copied' })).toBeVisible();
  await expect(page.locator('[aria-live="polite"]', { hasText: 'Link copied' })).toHaveCount(1);
  await expect.poll(() => rows(t.id)).toEqual(['card/copy']);
  await card.getByRole('button', { name: /recap$/ }).click();
  await expect.poll(() => rows(t.id)).toEqual(['card/copy', 'month/copy']);
  await page.goto(`/u/${t.handle}/trade/${encodeURIComponent(t.sell)}`);
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
  await expect.poll(() => rows(t.id)).toEqual(['card/copy', 'month/copy', 'trade/copy']);
  await expect.poll(async () => (await sql`select trade_shared_at s from users where id = ${t.id}`)[0].s).not.toBeNull();
  await sql`update users set trade_shared_at = null where id = ${t.id}`;
  await page.goto(`/u/${t.handle}/month/${t.ym}`);
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
  await expect.poll(() => rows(t.id)).toEqual(['card/copy', 'month/copy', 'month/copy', 'trade/copy']);
  expect((await sql`select trade_shared_at s from users where id = ${t.id}`)[0].s).toBeNull(); // a month share is not a trade share
});

test('a viewer\'s share and a signed-out share of someone else\'s record write nothing', async ({ page, browser }) => {
  const t = await trader(page);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const anon = await ctx.newPage();
  await anon.addInitScript(() => { delete (Navigator.prototype as { share?: unknown }).share; });
  const actions: string[] = [];
  anon.on('request', (r) => { if (r.method() === 'POST' && r.headers()['next-action']) actions.push(r.url()); });
  for (const path of [`/u/${t.handle}/trade/${encodeURIComponent(t.sell)}`, `/u/${t.handle}/month/${t.ym}`]) {
    await anon.goto(path);
    await anon.getByRole('button', { name: 'Share' }).click();
    await expect(anon.getByRole('button', { name: 'Link copied' })).toBeVisible();
  }
  await anon.waitForTimeout(500);
  expect(actions).toEqual([]); // the client gate: no request at all
  expect(await rows(t.id)).toEqual([]);
  // A viewer who is signed in as another trader, on the first trader's trade page: nothing either.
  const other = await trader(anon);
  await anon.goto(`/u/${t.handle}/trade/${encodeURIComponent(t.sell)}`);
  await anon.getByRole('button', { name: 'Share' }).click();
  await expect(anon.getByRole('button', { name: 'Link copied' })).toBeVisible();
  await anon.waitForTimeout(500);
  expect(await rows(t.id)).toEqual([]);
  expect(await rows(other.id)).toEqual([]);
  await ctx.close();
});

test('a failing write never touches the share: one tap, "Link copied" announced, no error, page usable', async ({ page }) => {
  const t = await trader(page);
  await page.reload();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (r) => (r.request().method() === 'POST' && r.request().headers()['next-action'] ? r.fulfill({ status: 500, body: 'boom' }) : r.continue()));
  const card = page.getByRole('region', { name: 'Share your record' });
  await card.getByRole('button', { name: 'Share my record' }).click();
  await expect(card.getByRole('button', { name: 'Link copied' })).toBeVisible();
  await expect(page.locator('[aria-live="polite"]', { hasText: 'Link copied' })).toHaveCount(1);
  await expect(page.getByText(/boom|went wrong|error/i)).toHaveCount(0);
  await page.unroute('**/*');
  await expect(card.getByRole('button', { name: 'Share my record' })).toBeVisible({ timeout: 5_000 }); // label returns; still usable
  expect(errors).toEqual([]);
  expect(await rows(t.id)).toEqual([]);
});
