// Product-rule checks against the real app (needs `npm run db:seed`). Each test maps to a rule in CLAUDE.md.
import { expect, test } from '@playwright/test';

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

test('share moment: copy records the action, shows once, hidden signed out; card renders with 0 trades', async ({ page, context, baseURL, request }) => {
  const { sql } = await import('../lib/db.ts');
  const handle = 'share_tester';
  // Reruns reuse the DB: clear connected state first so the signup landing page doesn't show (and mark seen) the prompt late.
  await sql`update users set snaptrade_user_id = null, last_synced_at = null where handle = ${handle}`;
  await page.goto('/login');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  await sql`update users set snaptrade_user_id = ${'e2e-' + Date.now()}, last_synced_at = now(), share_prompt_seen_at = null, share_prompt_action = null where handle = ${handle}`;

  const card = await request.get(`/u/${handle}/opengraph-image`); // 0 closed trades
  expect(card.status()).toBe(200);
  expect(card.headers()['content-type']).toBe('image/png');

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`/u/${handle}`);
  await expect(page.getByText('Your record is live.')).toBeVisible();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}/u/${handle}`);
  await expect.poll(async () => (await sql`select share_prompt_action a from users where handle = ${handle}`)[0].a).toBe('copied');
  const [row] = await sql`select share_prompt_seen_at s from users where handle = ${handle}`;
  expect(row.s).not.toBeNull();

  await page.reload();
  await expect(page.getByText('Your record is live.')).toHaveCount(0);

  await sql`update users set share_prompt_seen_at = null where handle = ${handle}`;
  await context.clearCookies();
  await page.goto(`/u/${handle}`);
  await expect(page.getByText('Your record is live.')).toHaveCount(0);
});

test('referral: CTA on real profiles signed out only; ref is recorded once on signup', async ({ page, context }) => {
  const { sql } = await import('../lib/db.ts');
  const signUp = async (handle: string, url = '/login') => {
    await page.goto(url);
    await page.getByLabel('Handle').fill(handle);
    await page.getByLabel('I am 18 or older').check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  };
  const cta = page.getByRole('link', { name: 'Verify your record' });

  await signUp('ref_owner');
  await expect(cta).toHaveCount(0); // owner's own view
  await context.clearCookies();

  await page.goto('/u/ref_owner');
  await expect(cta).toHaveAttribute('href', '/login?ref=ref_owner&via=profile');
  await page.goto('/u/momentum_maya');
  await expect(cta).toHaveCount(0); // demo profile

  await signUp('ref_friend', '/login?ref=Ref_Owner');
  const [f] = await sql`select u.referred_by_user_id r, o.id oid from users u, users o where u.handle = 'ref_friend' and o.handle = 'ref_owner'`;
  expect(f.r).toBe(f.oid);

  await context.clearCookies(); // signing in again never overwrites it
  await signUp('ref_friend', '/login?ref=momentum_maya');
  const [g] = await sql`select referred_by_user_id r from users where handle = 'ref_friend'`;
  expect(g.r).toBe(f.oid);

  await context.clearCookies(); // garbage ref still signs up normally, nothing recorded
  await signUp('ref_garbage', '/login?ref=../x');
  const [h] = await sql`select referred_by_user_id r from users where handle = 'ref_garbage'`;
  expect(h.r).toBeNull();
});

test('referral feedback: owner sees connected referrals only', async ({ page, context }) => {
  const { sql } = await import('../lib/db.ts');
  const signUp = async (handle: string, url = '/login') => {
    await page.goto(url);
    await page.getByLabel('Handle').fill(handle);
    await page.getByLabel('I am 18 or older').check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  };
  const line = page.getByText('connected from your link');
  await sql`delete from activities where user_id in (select id from users where handle = 'fb_friend')`; // reruns reuse the DB

  await signUp('fb_owner');
  await context.clearCookies();
  await signUp('fb_friend', '/login?ref=fb_owner');
  await context.clearCookies();
  await signUp('fb_owner'); // sign back in
  await expect(line).toHaveCount(0); // bare signup

  const [f] = await sql`select id from users where handle = 'fb_friend'`;
  const ext = `fb-${Date.now()}`;
  await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
    values (${f.id}, 'snaptrade', ${ext}, 'acct', 'AAPL', 'BUY', 1, 10, now(), '{}')`;
  await page.goto('/u/fb_owner');
  await expect(page.getByText('1 trader connected from your link')).toBeVisible();
  await expect(page.getByRole('link', { name: '@fb_friend' })).toHaveAttribute('href', '/u/fb_friend');

  await context.clearCookies();
  await signUp('fb_friend');
  await page.goto('/u/fb_owner');
  await expect(line).toHaveCount(0);

  await context.clearCookies();
  await page.goto('/u/fb_owner');
  await expect(line).toHaveCount(0);
});

test('trade permalink: signed out, record beside the trade, via=trade CTA, 404s, card', async ({ page, request }) => {
  const { sql } = await import('../lib/db.ts');
  const handle = 'tp_owner';
  const sell = `tp-sell-${Date.now()}`;
  const [u] = await sql`insert into users (handle, display_name, adult_attested_at) values (${handle}, 'TP Owner', now())
    on conflict (handle) do update set handle = excluded.handle returning id`;
  await sql`delete from closed_trades where user_id = ${u.id}`;
  await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, thesis, thesis_status)
    values (${u.id}, ${sell}, 'a', 'TSLA', now() - interval '3 days', now() - interval '1 day', -0.08, 2, true, 'held text', 'held')`;

  await page.goto(`/u/${handle}/trade/${sell}`);
  await expect(page.getByRole('heading', { name: 'TSLA' })).toBeVisible();
  await expect(page.getByText('-8.0%').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Their whole record/ })).toBeVisible();
  await expect(page.getByText('1 closed trade ·')).toBeVisible();
  await expect(page.getByText('held text')).toHaveCount(0); // held thesis never renders
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
  const href = await page.getByRole('link', { name: 'Verify your record' }).getAttribute('href');
  expect(href).toContain('ref=tp_owner');
  expect(href).toContain('via=trade');

  const card = await request.get(`/u/${handle}/trade/${sell}/opengraph-image`); // no thesis shown, single-trade trader
  expect(card.status()).toBe(200);
  expect(card.headers()['content-type']).toContain('image/png');

  expect((await request.get(`/u/${handle}/trade/does-not-exist`)).status()).toBe(404);
  expect((await request.get(`/u/momentum_maya/trade/${sell}`)).status()).toBe(404);
});

test('monthly recap: signed out, whole record beside the month, every trade listed, 404s, card', async ({ page, request }) => {
  const { sql } = await import('../lib/db.ts');
  const handle = 'mr_owner';
  const [u] = await sql`insert into users (handle, display_name, adult_attested_at) values (${handle}, 'MR Owner', now())
    on conflict (handle) do update set handle = excluded.handle returning id`;
  await sql`delete from closed_trades where user_id = ${u.id}`;
  await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    values (${u.id}, ${'mr-sell-' + Date.now()}, 'a', 'TSLA', now() - interval '3 days', now() - interval '1 day', -0.08, 2, true)`;
  const ym = new Date(Date.now() - 864e5).toISOString().slice(0, 7);

  await page.goto(`/u/${handle}/month/${ym}`);
  await expect(page.getByRole('heading', { name: /Their whole record/ })).toBeVisible();
  await expect(page.getByText('1 closed trade ·')).toBeVisible();
  await expect(page.locator('ol li')).toHaveCount(1);
  await expect(page.getByText('Too few trades for a win rate')).toBeVisible();

  const card = await request.get(`/u/${handle}/month/${ym}/opengraph-image`); // one-trade month
  expect(card.status()).toBe(200);
  expect(card.headers()['content-type']).toContain('image/png');

  // owner sees the share link on their profile
  await page.goto('/login');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  await expect(page.getByRole('link', { name: 'Share your latest recap' })).toHaveAttribute('href', `/u/${handle}/month/${ym}`);

  // demo trader: badge visible and the list shows every trade in the month
  const [d] = await sql`select id from users where handle = 'momentum_maya'`;
  const [m] = await sql`select to_char(closed_at at time zone 'UTC', 'YYYY-MM') ym from closed_trades where user_id = ${d.id} order by closed_at desc limit 1`;
  const [{ n }] = await sql`select count(*)::int n from closed_trades where user_id = ${d.id} and to_char(closed_at at time zone 'UTC', 'YYYY-MM') = ${m.ym}`;
  await page.goto(`/u/momentum_maya/month/${m.ym}`);
  await expect(page.locator('.badge.demo').first()).toHaveText('Demo');
  await expect(page.locator('ol li')).toHaveCount(n);

  expect((await request.get(`/u/${handle}/month/2099-01`)).status()).toBe(404);
  expect((await request.get(`/u/${handle}/month/bad`)).status()).toBe(404);
  expect((await request.get(`/u/nobody_here/month/${ym}`)).status()).toBe(404);
});

test('new trade prompt: owner only, dismiss records, first visit stamps without a panel', async ({ page, browser }) => {
  const { sql } = await import('../lib/db.ts');
  const handle = 'momentum_maya';
  const [u] = await sql`select id from users where handle = ${handle}`;
  const [tr] = await sql`select sell_id from closed_trades where user_id = ${u.id} order by closed_at desc limit 1`;
  const arrange = () => sql`update users set trades_prompt_seen_at = now() - interval '10 days', trades_prompt_action = null, share_prompt_seen_at = now() where id = ${u.id}`;
  await arrange();
  await sql`update closed_trades set closed_at = now() where user_id = ${u.id} and sell_id = ${tr.sell_id}`;
  const heading = (p: typeof page) => p.getByRole('heading', { name: 'New closed trades since your last visit' });
  const login = async (p: typeof page, h: string) => {
    await p.goto('/login');
    await p.getByLabel('Handle').fill(h);
    await p.getByLabel('I am 18 or older').check();
    await p.getByRole('button', { name: 'Continue' }).click();
    await expect(p).toHaveURL(new RegExp(`/u/${h}$`));
  };

  await page.goto(`/u/${handle}`);
  await expect(heading(page)).toHaveCount(0); // signed out

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await login(other, 'nt_other');
  await other.goto(`/u/${handle}`);
  await expect(heading(other)).toHaveCount(0);
  await ctx.close();

  await login(page, handle);
  await arrange();
  await page.goto(`/u/${handle}`);
  await expect(heading(page)).toBeVisible();
  await expect(page.locator('.new-trades').getByRole('link').first()).toHaveAttribute('href', `/u/${handle}/trade/${encodeURIComponent(tr.sell_id)}`);
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(heading(page)).toHaveCount(0);
  await expect.poll(async () => (await sql`select trades_prompt_action a from users where id = ${u.id}`)[0].a).toBe('dismissed');
  await page.reload();
  await expect(heading(page)).toHaveCount(0);

  await sql`update users set trades_prompt_seen_at = null where id = ${u.id}`;
  await page.goto(`/u/${handle}`);
  await expect(heading(page)).toHaveCount(0);
  await expect.poll(async () => (await sql`select trades_prompt_seen_at s from users where id = ${u.id}`)[0].s).not.toBeNull();
});

test('badge: public svg, 404, owner embed section copies absolute snippet and records it', async ({ page, request, context }) => {
  const { sql } = await import('../lib/db.ts');
  const res = await request.get('/u/momentum_maya/badge.svg');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/svg+xml');
  expect(await res.text()).toContain('Demo');
  expect((await request.get('/u/no_such_handle_xyz/badge.svg')).status()).toBe(404);

  await page.goto('/u/momentum_maya');
  await expect(page.getByText('Embed your badge')).toHaveCount(0); // signed out

  const handle = 'badge_owner';
  await page.goto('/login');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  await sql`update users set badge_copied_at = null where handle = ${handle}`;
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByText('Embed your badge').click();
  await page.getByRole('button', { name: 'Copy Markdown' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toMatch(new RegExp(`^\\[!\\[.*\\]\\(https?://[^)]+/u/${handle}/badge\\.svg\\)\\]\\(https?://[^)]+/u/${handle}\\?ref=${handle}&via=badge\\)$`));
  await expect.poll(async () => (await sql`select badge_copied_at b from users where handle = ${handle}`)[0].b).not.toBeNull();
});

test('story image: public route formats/404, owner-only Save section records first click', async ({ page, request, browser }) => {
  const { sql } = await import('../lib/db.ts');
  const dim = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];
  for (const [q, w, h] of [['?format=story', 1080, 1920], ['?format=square', 1080, 1080], ['?format=bogus', 1080, 1080]] as const) {
    const res = await request.get(`/u/momentum_maya/story${q}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
    expect(dim(await res.body())).toEqual([w, h]);
  }
  expect((await request.get('/u/no-such-handle-xyz/story')).status()).toBe(404);

  const handle = 'story_owner';
  await page.goto('/login');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  const [u] = await sql`select id from users where handle = ${handle}`;
  await sql`delete from closed_trades where user_id = ${u.id}`;
  await sql`update users set share_image_saved_at = null where id = ${u.id}`;
  expect((await request.get(`/u/${handle}/story`)).status()).toBe(200); // 0 trades
  await page.reload();
  const section = page.getByRole('heading', { name: 'Save your record as an image' });
  await expect(section).toHaveCount(0); // 0 trades: hidden

  await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    values (${u.id}, ${'story-sell-' + Date.now()}, 'a', 'TSLA', now() - interval '3 days', now() - interval '1 day', -0.08, 2, true)`;
  await page.reload();
  await expect(section).toBeVisible();
  const anonCtx = await browser.newContext();
  const anon = await anonCtx.newPage();
  await anon.goto(`/u/${handle}`);
  await expect(anon.getByRole('heading', { name: 'Save your record as an image' })).toHaveCount(0);
  await anonCtx.close();

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: /Save square/ }).click();
  await (await download).cancel();
  await expect(page.getByText('Saved. Post it wherever your friends are.')).toBeVisible();
  await expect.poll(async () => (await sql`select share_image_saved_at s from users where id = ${u.id}`)[0].s).not.toBeNull();
});
