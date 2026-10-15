// Product-rule checks against the real app (needs `npm run db:seed`). Each test maps to a rule in CLAUDE.md.
import { expect, test } from '@playwright/test';
import postgres from 'postgres';

test('feed works signed out and shows losses alongside gains', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card').first()).toBeVisible();
  await expect(page.locator('.ret.up').first()).toBeVisible();
  await expect(page.locator('.ret.down').first()).toBeVisible();
  await expect(page.locator('.badge.demo').first()).toHaveText('Demo'); // seed data is never "Verified"
});

test('profile shows headline stats and excluded positions', async ({ page }) => {
  await page.goto('/u/momentum_maya');
  await expect(page.getByText('win rate', { exact: true })).toBeVisible();
  await expect(page.getByText('avg return / trade')).toBeVisible();
  await expect(page.getByText('max drawdown (per-trade, equal-weight)')).toBeVisible();
  await expect(page.getByText(/earlier position\(s\) excluded/)).toBeVisible();
});

test('profile chart is labeled, accessible and links points to trades', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/u/momentum_maya');
  await expect(page.getByText('Return if every trade were the same size', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /\d+ trades, .*% total, max drawdown -?[\d.]+%/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('.chart .zero')).toBeAttached(); // dashed baseline
  await expect(page.locator('.chart .zero-label')).toHaveText('0%'); // CH-1
  await expect(page.locator('.tabs button')).toHaveText(['1W', '1M', '3M', '1Y', 'ALL']);
  await expect(page.locator('.tabs button[aria-pressed="true"]')).toHaveText('ALL');
  const point = page.locator('.chart a').first();
  await point.focus();
  await expect(point.locator('.tip')).toBeVisible();
  const href = await point.getAttribute('href');
  // Keyboard activation: a click lands on the bbox center, which includes the open tooltip, not the point.
  await point.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.locator(`${href}`)).toBeInViewport();
});

test('chart: arrow keys move the active trade and Enter opens it', async ({ page }) => {
  await page.goto('/u/momentum_maya');
  const stack = page.locator('.chart-stack');
  const sheet = page.locator('.chart .sheet');
  await stack.focus();
  await page.keyboard.press('ArrowRight');
  const first = await sheet.innerText();
  await page.keyboard.press('ArrowRight');
  expect(await sheet.innerText()).not.toBe(first);
  await expect(sheet).not.toContainText('Held');
  await page.keyboard.press('Enter');
  await expect(sheet).toContainText(/Held [\d.]+ days/);
  await page.keyboard.press('Escape');
  await expect(sheet).not.toContainText('Held');
});

test('chart: horizontal drag scrubs and opens on release; vertical scroll is not captured', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/u/momentum_maya');
  expect(await page.locator('.chart-stack').evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-y');
  await page.locator('.chart-stack').scrollIntoViewIfNeeded();
  const box = (await page.locator('.chart-stack').boundingBox())!;
  const y = box.y + box.height / 2;
  const sheet = page.locator('.chart .sheet');
  await page.mouse.move(box.x + 10, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, y);
  const start = await sheet.innerText();
  await page.mouse.move(box.x + box.width * 0.6, y, { steps: 8 });
  expect(await sheet.innerText()).not.toBe(start);
  await expect(sheet).not.toContainText('Held');
  await page.mouse.up();
  await expect(sheet).toContainText(/Held [\d.]+ days/);
});

test('chart: tab switching updates the header and disables empty ranges', async ({ page }) => {
  await page.goto('/u/momentum_maya');
  const head = page.locator('.chart-head');
  await expect(head).toContainText('All time');
  const all = await head.innerText();
  const tab = page.locator('.tabs button:enabled:not([aria-pressed="true"])').first();
  const key = await tab.innerText();
  await tab.click();
  await expect(page.locator('.tabs button[aria-pressed="true"]')).toHaveText(key);
  await expect(head).not.toContainText('All time');
  expect(await head.innerText()).not.toBe(all);
});

test('chart: arrow keys scrub the header and Escape restores the range total', async ({ page }) => {
  await page.goto('/u/momentum_maya');
  const head = page.locator('.chart-head');
  const total = await head.innerText();
  await page.locator('.chart-stack').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(head).toContainText(/\d+\/\d+\/\d{4}/);
  await expect(page.locator('.chart .cursor')).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(head).toHaveText(total);
});

test('chart: horizontal drag scrubs and release restores; vertical scroll is not captured', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/u/momentum_maya');
  expect(await page.locator('.chart-stack').evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-y');
  await page.locator('.chart-stack').scrollIntoViewIfNeeded();
  const box = (await page.locator('.chart-stack').boundingBox())!;
  const y = box.y + box.height / 2;
  const head = page.locator('.chart-head');
  const total = await head.innerText();
  await page.mouse.move(box.x + 10, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, y, { steps: 8 });
  await expect(head).toContainText(/\d+\/\d+\/\d{4}/);
  await page.mouse.up();
  await expect(head).toHaveText(total);
});

test('feed: pane opens with → and closes with ←, name tap still opens the profile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  const row = page.locator('.row').first();
  const pane = row.locator('.pane');
  await expect(pane.locator('.badge.demo')).toHaveText('Demo');
  const href = await row.locator('.card .who').getAttribute('href');
  // Re-press until hydration has attached the key handler; → is idempotent.
  await expect.poll(async () => { await page.keyboard.press('ArrowRight'); return row.evaluate((el) => el.scrollLeft); }).toBeGreaterThan(300);
  await expect(pane.locator('.chart .zero-label')).toHaveText('0%');
  await expect(pane.getByText('win rate', { exact: true })).toBeVisible();
  await expect(pane.getByText('Since first closed trade')).toBeVisible();
  await expect(pane.locator('.rows li')).toHaveCount(5);
  await expect(pane.getByRole('link', { name: 'See full profile →' })).toHaveAttribute('href', href!);
  // With focus in the chart, arrows step chart points and never move the row.
  await pane.locator('.chart-stack').focus();
  const left = await row.evaluate((el) => el.scrollLeft);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  expect(await row.evaluate((el) => el.scrollLeft)).toBe(left);
  await pane.locator('.chart-stack').blur();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBe(0);
  await row.locator('.card .who').click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

test('profile shows honest evidence, record-since and demo label at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/u/momentum_maya');
  await expect(page.getByText(/Past results: .*Evidence:|Too early to tell/).first()).toBeVisible();
  await expect(page.getByText(/Record since/)).toBeVisible();
  await expect(page.getByText(/Demo data/)).toBeVisible();
  await expect(page.locator('.badge.demo').first()).toBeVisible();
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/skill|proven|guaranteed|all of their trades/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('unknown profile is a 404', async ({ page }) => {
  expect((await page.goto('/u/nobody_here'))?.status()).toBe(404);
});

test('share card is a PNG', async ({ request }) => {
  const res = await request.get('/u/momentum_maya/opengraph-image');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
});

test('sync endpoint rejects requests without the cron secret', async ({ request }) => {
  expect((await request.post('/api/sync')).status()).toBe(401);
});

test('my record is private: signed out goes to login, owner sees it from their profile', async ({ page }) => {
  await page.goto('/me/record');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Handle').fill('dividend_dan');
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('link', { name: 'My record' }).click();
  await expect(page.getByRole('heading', { name: 'My record', level: 1 })).toBeVisible();
  await expect(page.getByText('Only you can see this page')).toBeVisible();
});

test('my record: "Since your last visit" shows for an owner with a baseline and survives a reload', async ({ page }) => {
  const db = postgres(process.env.DATABASE_URL!);
  try {
    await page.goto('/login');
    await page.getByLabel('Handle').fill('dividend_dan');
    await page.getByLabel('I am 18 or older').check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    await db`update users set record_prev_viewed_at = now() - interval '30 days', record_last_viewed_at = now() where handle = 'dividend_dan'`;
    await page.goto('/me/record');
    const h = page.getByRole('heading', { name: 'Since your last visit' });
    await expect(h).toBeVisible();
    await page.reload();
    await expect(h).toBeVisible();
  } finally { await db.end(); }
});

test('my record: rules set and clear, and never appear on the public profile', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Handle').fill('dividend_dan');
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await page.goto('/me/record');
  await expect(page.getByRole('heading', { name: 'Your rules' })).toBeVisible();
  const card = page.getByRole('region', { name: 'Close losing trades within N days' });
  await expect(card).toBeVisible();
  await expect(page.getByRole('region', { name: 'Hold winning trades at least N days' })).toBeVisible();
  await card.getByLabel('Days').fill('7');
  await card.getByRole('button', { name: 'Set rule' }).click();
  await expect(card.getByRole('button', { name: 'Clear rule' })).toBeVisible();
  await expect(card.getByText(/too few trades to say|losing trades were closed within 7 days/).first()).toBeVisible();
  await card.getByRole('button', { name: 'Clear rule' }).click();
  await expect(card.getByText('Not set')).toBeVisible();
  await page.goto('/u/dividend_dan');
  await expect(page.getByText('Your rules')).toHaveCount(0);
});

test('my record: recent versus earlier rule comparison is private and honest about small samples', async ({ page }) => {
  await page.goto('/me/record');
  await expect(page).toHaveURL(/\/login$/);
  const db = postgres(process.env.DATABASE_URL!);
  const ids = Array.from({ length: 15 }, (_, i) => `e2e-trend-${i}`);
  try {
    await page.getByLabel('Handle').fill('dividend_dan');
    await page.getByLabel('I am 18 or older').check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    const [u] = await db`select id from users where handle = 'dividend_dan'`;
    await db`delete from trade_rules where user_id = ${u.id}`;
    for (const [i, id] of ids.entries()) {
      const closed = new Date(Date.now() - (40 - i) * 86_400_000);
      await db`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
        values (${u.id}, ${id}, 'e2e', 'ZZTR', ${new Date(closed.getTime() - 30 * 86_400_000)}, ${closed}, -4, ${i >= 8 ? 3 : 20}, false)`;
    }
    await page.goto('/me/record');
    const card = page.getByRole('region', { name: 'Close losing trades within N days' });
    await card.getByLabel('Days').fill('7');
    await card.getByRole('button', { name: 'Set rule' }).click();
    const group = card.getByRole('group', { name: 'Recent versus earlier' });
    await expect(group.getByText(/Followed (more|less|equally) often: on \d+ of your latest 10 applicable trades, versus \d+ of the \d+ before\./)).toBeVisible();
    await expect(group.getByText(/These are small samples/)).toBeVisible();
    await db`delete from closed_trades where sell_id = any(${ids})`;
    await page.reload();
    await expect(card.getByRole('group', { name: 'Recent versus earlier' }).getByText('too few trades to say')).toBeVisible();
    await page.goto('/u/dividend_dan');
    await expect(page.getByText('Recent versus earlier')).toHaveCount(0);
  } finally {
    await db`delete from closed_trades where sell_id = any(${ids})`;
    await db`delete from trade_rules where user_id = (select id from users where handle = 'dividend_dan')`;
    await db.end();
  }
});

test('thesis moderation holds risky claims and publishes clean ones', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Handle').fill('dividend_dan');
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/u\/dividend_dan$/);

  const first = page.locator('.rows li').first();
  await first.getByRole('textbox').fill('Guaranteed 100x, DM me');
  await first.getByRole('button', { name: 'Save' }).click();
  await expect(first.getByText('Thesis held for review.')).toBeVisible();

  await first.getByRole('textbox').fill('Rotation into staples ahead of CPI.');
  await first.getByRole('button', { name: 'Save' }).click();
  await expect(first.getByText('“Rotation into staples ahead of CPI.”')).toBeVisible();
});
