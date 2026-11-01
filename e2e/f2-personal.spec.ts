// F-2 PR-5 (criteria 12, 13, 15; business lead demands 4, 7): the personalization switches, the hidden-trades list and
// the feed's notes line, and the activity logger, against the real app (needs `npm run db:seed`). Screenshots at 360 px
// in docs/features/logs/F-2/screenshots/pr5/.
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const SHOTS = 'docs/features/logs/F-2/screenshots/pr5';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.afterAll(async () => { await sql.end({ timeout: 1 }); });
const shoot = async (page: Page, name: string) => {
  for (const colorScheme of ['light', 'dark'] as const) { await page.emulateMedia({ colorScheme }); await page.screenshot({ path: `${SHOTS}/${name}-${colorScheme}.png`, fullPage: true }); }
  await page.emulateMedia({ colorScheme: 'light' });
};
async function signIn(page: Page, handle: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
}
const handle = () => `pz${Math.random().toString(36).slice(2, 9)}`;
const removeUser = (h: string) => sql`delete from users where handle = ${h}`;
const events = async (h: string) => (await sql`select count(*)::int as n from discovery_events e join users u on u.id = e.viewer_id where u.handle = ${h}`)[0].n as number;
function watchEvents(ctx: BrowserContext): string[] {
  const seen: string[] = [];
  ctx.on('request', (r) => { if (/\/api\/events/.test(r.url())) seen.push(r.url()); });
  return seen;
}
async function phone(browser: Browser, js = true) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, javaScriptEnabled: js });
  return { ctx, page: await ctx.newPage(), sent: watchEvents(ctx) };
}

test('criterion 12: "Personalize with my activity" is Off by default; On and Off are equally prominent (same class and size, side by side at 360 px), named by their switch, and work without JavaScript', async ({ browser }) => {
  const h = handle();
  const { ctx, page } = await phone(browser, false);
  try {
    // Without JavaScript the dev sign-in form still posts.
    await signIn(page, h);
    await page.goto('/me/personalize');
    const on = page.getByRole('button', { name: 'Personalize with my activity: On' });
    const off = page.getByRole('button', { name: 'Personalize with my activity: Off' });
    await expect(on).toHaveCount(1);
    await expect(off).toHaveAttribute('aria-pressed', 'true');
    await expect(on).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Personalize my feed: On' })).toHaveAttribute('aria-pressed', 'true');
    const [a, b] = [(await on.boundingBox())!, (await off.boundingBox())!];
    expect(Math.abs(a.width - b.width)).toBeLessThan(1);
    expect(Math.abs(a.height - b.height)).toBeLessThan(1);
    expect(a.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(a.y - b.y)).toBeLessThan(1); // side by side
    expect(await on.getAttribute('class')).toBe('switch');
    expect((await off.getAttribute('class'))!.split(' ')[0]).toBe('switch');
    await shoot(page, 'personalize-default-360');
    await on.click();
    await expect(page.getByRole('status')).toHaveText('Activity is on. Recording starts now.');
    await expect(page.getByRole('button', { name: 'Personalize with my activity: On' })).toHaveAttribute('aria-pressed', 'true');
    expect((await sql`select activity_log_on_at is not null as on from users where handle = ${h}`)[0].on).toBe(true);
    await page.getByRole('button', { name: 'Personalize my feed: Off' }).click();
    await expect(page.getByRole('status')).toHaveText('Personalize my feed is off. You get the order everyone gets, minus what you hid.');
    await expect(page.getByText('Not recorded or used while Personalize my feed is off.')).toBeVisible();
    await shoot(page, 'personalize-off-360');
    // A crafted ?saved= that does not match the stored state says nothing.
    await page.goto('/me/personalize?saved=feedOn');
    await expect(page.getByRole('status')).toHaveText('');
  } finally {
    await ctx.close(); await removeUser(h);
  }
});

test('criterion 12: with activity Off the logger is not on the page and nothing is stored; On, reading the feed stores events; "Clear my activity" deletes them at once; signed out the route stores nothing', async ({ browser }) => {
  const release = await feedLock('shared');
  const h = handle();
  const { ctx, page, sent } = await phone(browser);
  try {
    await signIn(page, h);
    await page.goto('/');
    await page.locator('.feed > .row').first().waitFor();
    await page.mouse.wheel(0, 1500); await page.waitForTimeout(1200); await page.mouse.wheel(0, 1500); await page.waitForTimeout(800);
    await page.goto('/me/following'); // pagehide
    expect(sent, 'no request while Off').toEqual([]); // and none stored (the beacon path is checked by the rows below)
    expect(await events(h)).toBe(0);
    // A hand-made batch while Off stores nothing.
    const r = await page.request.post('/api/events', { data: JSON.stringify({ events: [{ type: 'impression', surface: 'feed', target: { kind: 'trader', handle: 'momentum_maya' } }] }), headers: { 'content-type': 'text/plain', origin: 'http://localhost:3000' } });
    expect(r.status()).toBe(204);
    expect(await events(h)).toBe(0);
    // On: the feed's cards are logged.
    await page.goto('/me/personalize');
    await page.getByRole('button', { name: 'Personalize with my activity: On' }).click();
    await expect(page.getByRole('status')).toHaveText('Activity is on. Recording starts now.');
    await page.goto('/');
    await page.locator('.feed > .row').first().waitFor();
    await page.waitForTimeout(1500);
    await page.mouse.wheel(0, 2000); await page.waitForTimeout(1500);
    await page.goto('/me/personalize'); // pagehide sends the batch
    await expect.poll(() => events(h), { timeout: 5000 }).toBeGreaterThan(0);
    // (A beacon sent on pagehide is not always reported as a page request; the stored rows are the proof.)
    // Each stored row: viewer, surface, target, type and time only.
    const [row] = await sql`select e.* from discovery_events e join users u on u.id = e.viewer_id where u.handle = ${h} limit 1`;
    expect(Object.keys(row).sort()).toEqual(['at', 'id', 'surface', 'target_kind', 'target_symbol', 'target_trade_key', 'target_user_id', 'type', 'viewer_id']);
    await page.getByRole('button', { name: 'Clear my activity' }).click();
    await expect(page.getByRole('status')).toHaveText('Your activity is cleared.');
    expect(await events(h)).toBe(0);
    // Cross-site posts are refused; signed out nothing is stored.
    const cross = await page.request.post('/api/events', { data: '{"events":[]}', headers: { origin: 'https://elsewhere.example' } });
    expect(cross.status()).toBe(403);
  } finally {
    await ctx.close(); await removeUser(h); await release();
  }
  const anon = await browser.newContext();
  try {
    const r = await anon.request.post('http://localhost:3000/api/events', { data: '{"events":[]}', headers: { 'content-type': 'text/plain', origin: 'http://localhost:3000' } });
    expect(r.status()).toBe(204);
    const p = await anon.newPage();
    await p.goto('/');
    expect(await p.content()).not.toContain('More like what you read');
  } finally { await anon.close(); }
});

test('criterion 15: "N trades hidden by you. Show them" on the feed, then the Hidden trades list with "Show again", by keyboard; the first card stays in view at 360 px', async ({ browser }) => {
  const release = await feedLock('shared');
  const h = handle();
  const { ctx, page } = await phone(browser);
  try {
    await signIn(page, h);
    await page.goto('/');
    await expect(page.locator('.feed-notes')).toHaveCount(0); // none hidden: absent
    const row = page.locator('.feed > .row[data-trade]').first();
    const trade = await row.getAttribute('data-trade');
    const who = await row.getAttribute('data-handle');
    // Hide it through the card's "…" menu (the keyboard route).
    await row.locator('summary').first().focus();
    await page.keyboard.press('Enter');
    await row.getByRole('button', { name: 'Hide this trade' }).focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await sql`select count(*)::int as n from trade_exclusions x join users u on u.id = x.viewer_id where u.handle = ${h}`)[0].n).toBe(1);
    await page.goto('/');
    const line = page.locator('.feed-notes');
    await expect(line).toContainText('1 trade hidden by you.');
    // User test demands 1, 2: on arrival the whole line is in view below the fixed nav, and still after scrollTo(0, 0); the
    // first card's symbol and return are in view too.
    const navBottom = async () => (await page.locator('nav.top').boundingBox())!.y + (await page.locator('nav.top').boundingBox())!.height;
    await expect(line).toBeInViewport({ ratio: 1 });
    // Its text (the content box, under the padding that clears the nav) starts below the nav.
    const textTop = await line.evaluate((e) => e.getBoundingClientRect().top + parseFloat(getComputedStyle(e).paddingTop));
    expect(textTop).toBeGreaterThanOrEqual(await navBottom());
    const first = page.locator('.feed > .row[data-trade]').first();
    await expect(first.locator('.card header').first()).toBeInViewport({ ratio: 1 });
    await page.locator('.feed').evaluate((f) => f.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await expect(line).toBeInViewport({ ratio: 1 });
    await shoot(page, 'feed-notes-360');
    const link = page.getByRole('link', { name: 'Show them: 1 hidden trade' });
    const box = (await link.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    await link.focus();
    // WCAG 2.4.11: the focused link is not hidden under the nav.
    await expect(link).toBeInViewport({ ratio: 1 });
    expect((await link.boundingBox())!.y).toBeGreaterThanOrEqual(await navBottom());
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/me\/hidden$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Hidden trades' })).toBeVisible();
    // User test demand 4: "SYMBOL, closed <date>" stays on one line at 360 px.
    const closed = page.locator('.hidden-trades .closed').first();
    const lh = await closed.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight) || 20);
    expect((await closed.boundingBox())!.height).toBeLessThan(lh * 1.5);
    await shoot(page, 'hidden-trades-360');
    const again = page.getByRole('button', { name: new RegExp(`^Show again: @${who}, `) });
    await again.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toHaveText(`@${who}'s trade is back in your feed.`);
    await expect(page.getByText("You haven't hidden a trade.")).toBeVisible();
    await page.goto('/');
    await expect(page.locator(`.feed > .row[data-trade="${trade}"]`)).toHaveCount(1);
    await expect(page.locator('.feed-notes')).toHaveCount(0);
  } finally {
    await ctx.close(); await removeUser(h); await release();
  }
});

test('criterion 13: "Personalize my feed: Off" gives the order everyone gets; a follow with it On shows the order line', async ({ browser }) => {
  const release = await feedLock('shared');
  const h = handle();
  const { ctx, page } = await phone(browser);
  const anon = await browser.newContext({ viewport: { width: 360, height: 640 } });
  try {
    const order = async (p: Page) => p.locator('.feed > .row[data-trade]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-trade')));
    const a = await anon.newPage();
    await a.goto('/');
    const everyone = await order(a);
    await signIn(page, h);
    await page.goto('/');
    expect(await order(page)).toEqual(everyone); // cold start: the order everyone gets
    // Follow the last trader on page 1 (made before the next session's asOf).
    const last = await page.locator('.feed > .row[data-handle]').last().getAttribute('data-handle');
    await sql`insert into follows (viewer_id, trader_id, created_at) select v.id, t.id, now() - interval '1 minute' from users v, users t where v.handle = ${h} and t.handle = ${last}`;
    await page.goto('/');
    await expect(page.locator('.feed-notes')).toContainText('Ordered using your follows.');
    await expect(page.locator('.feed-notes')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('link', { name: 'Change: how your feed is ordered' })).toHaveAttribute('href', '/me/personalize');
    await shoot(page, 'feed-personal-360');
    await sql`update users set personalize_feed = false where handle = ${h}`;
    await page.goto('/');
    await expect(page.locator('.feed-notes')).toHaveCount(0);
    expect(await order(page)).toEqual(everyone);
  } finally {
    await anon.close(); await ctx.close(); await removeUser(h); await release();
  }
});
