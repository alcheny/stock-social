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

  await page.goto('/login/dev');
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
    await page.goto('/login/dev');
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
  await page.goto('/login/dev');
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
    await page.goto('/login/dev');
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
  await page.goto('/login/dev');
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
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  await sql`update users set snaptrade_user_id = ${'e2e-' + Date.now()}, last_synced_at = now(), share_prompt_seen_at = null, share_prompt_action = null where handle = ${handle}`;

  const card = await request.get(`/u/${handle}/opengraph-image`); // 0 closed trades
  expect(card.status()).toBe(200);
  expect(card.headers()['content-type']).toBe('image/png');

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => { delete (Navigator.prototype as { share?: unknown }).share; }); // desktop path: one click copies the link
  await page.goto(`/u/${handle}`);
  await expect(page.getByText('Your record is live.')).toBeVisible();
  await page.getByRole('button', { name: 'Share my record' }).click();
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
  const signUp = async (handle: string, url = '/login/dev') => {
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

  await signUp('ref_friend', '/login/dev?ref=Ref_Owner');
  const [f] = await sql`select u.referred_by_user_id r, o.id oid from users u, users o where u.handle = 'ref_friend' and o.handle = 'ref_owner'`;
  expect(f.r).toBe(f.oid);

  await context.clearCookies(); // signing in again never overwrites it
  await signUp('ref_friend', '/login/dev?ref=momentum_maya');
  const [g] = await sql`select referred_by_user_id r from users where handle = 'ref_friend'`;
  expect(g.r).toBe(f.oid);

  await context.clearCookies(); // garbage ref still signs up normally, nothing recorded
  await signUp('ref_garbage', '/login/dev?ref=../x');
  const [h] = await sql`select referred_by_user_id r from users where handle = 'ref_garbage'`;
  expect(h.r).toBeNull();
});

test('referral feedback: owner sees connected referrals only', async ({ page, context }) => {
  const { sql } = await import('../lib/db.ts');
  const signUp = async (handle: string, url = '/login/dev') => {
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
  await signUp('fb_friend', '/login/dev?ref=fb_owner');
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
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle}, 'TP Owner', now(), a.id from a
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
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible(); // one button
  await expect(page.getByRole('button', { name: 'Copy link' })).toHaveCount(0);
  const href = await page.getByRole('link', { name: 'Verify your record' }).getAttribute('href');
  expect(href).toContain('ref=tp_owner');
  expect(href).toContain('via=trade');

  const card = await request.get(`/u/${handle}/trade/${sell}/opengraph-image`); // no thesis shown, single-trade trader
  expect(card.status()).toBe(200);
  expect(card.headers()['content-type']).toContain('image/png');

  expect((await request.get(`/u/${handle}/trade/does-not-exist`)).status()).toBe(404);
  expect((await request.get(`/u/momentum_maya/trade/${sell}`)).status()).toBe(404);
});

test('fix round 6: the demo trader\'s trade link preview says demo trades, never verified; its preview image renders', async ({ page }) => {
  const { sql } = await import('../lib/db.ts');
  const [t] = await sql`select ct.sell_id from closed_trades ct join users u on u.id = ct.user_id where u.handle = 'momentum_maya' order by ct.closed_at desc limit 1`;
  await page.goto(`/u/momentum_maya/trade/${encodeURIComponent(t.sell_id as string)}`);
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toMatch(/^\d+ demo trades? · /);
  expect(description).not.toMatch(/verified/i);
  const image = await page.locator('meta[property="og:image"]').first().getAttribute('content');
  const res = await page.request.get(new URL(image!).pathname + new URL(image!).search);
  expect(res.status()).toBe(200);
  // Fix round 5 (TR-3): the demo trader's profile link preview says demo trades too.
  await page.goto('/u/momentum_maya');
  const profileDescription = await page.locator('meta[name="description"]').getAttribute('content');
  expect(profileDescription).toMatch(/^\d+ demo trades? · /);
  expect(profileDescription).not.toMatch(/verified/i);
  // Reviewer fix (POLICY F3a, A1): the card's alt text follows the record state; the card URL is unchanged.
  expect(await page.locator('meta[property="og:image:alt"]').getAttribute('content')).toBe('Trading record card for @momentum_maya on Stock Social: Demo data');
  expect(new URL((await page.locator('meta[property="og:image"]').first().getAttribute('content'))!).pathname).toBe('/u/momentum_maya/opengraph-image');
});

test('monthly recap: signed out, whole record beside the month, every trade listed, 404s, card', async ({ page, request }) => {
  const { sql } = await import('../lib/db.ts');
  const handle = 'mr_owner';
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle}, 'MR Owner', now(), a.id from a
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

  // owner shares the recap from their profile in one click
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  await expect(page.getByRole('button', { name: /^Share \w+ recap$/ })).toBeVisible();

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
    await p.goto('/login/dev');
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

test('share card: each share is one click, no embed code or downloads, owner only', async ({ page, context, baseURL, browser }) => {
  const { sql } = await import('../lib/db.ts');
  const handle = 'share_card_owner';
  await page.addInitScript(() => { delete (Navigator.prototype as { share?: unknown }).share; }); // desktop path: one click copies the link
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  const [u] = await sql`select id from users where handle = ${handle}`;
  await sql`delete from closed_trades where user_id = ${u.id}`;
  await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    values (${u.id}, ${'sc-sell-' + Date.now()}, 'a', 'AMD', now() - interval '3 days', now() - interval '1 day', 0.05, 2, true)`;
  await sql`update users set share_image_saved_at = null where id = ${u.id}`;
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.reload();
  const card = page.getByRole('region', { name: 'Share your record' });
  await expect(card).toBeVisible();
  for (const gone of ['Embed your badge', 'Copy Markdown', 'Copy HTML', 'Save story', 'Save square']) await expect(page.getByText(gone)).toHaveCount(0);
  await expect(page.locator('textarea')).toHaveCount(0);
  await card.getByRole('button', { name: 'Share my record' }).click();
  await expect(card.getByRole('button', { name: 'Link copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}/u/${handle}`);
  await expect.poll(async () => (await sql`select share_image_saved_at s from users where id = ${u.id}`)[0].s).not.toBeNull();

  const anonCtx = await browser.newContext();
  const anon = await anonCtx.newPage();
  await anon.goto(`/u/${handle}`);
  await expect(anon.getByRole('region', { name: 'Share your record' })).toHaveCount(0);
  await anonCtx.close();
});

test('story image: public route formats/404; the share card appears only with trades and only for the owner', async ({ page, request, browser }) => {
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
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  const [u] = await sql`select id from users where handle = ${handle}`;
  await sql`delete from closed_trades where user_id = ${u.id}`;
  await sql`update users set share_image_saved_at = null where id = ${u.id}`;
  expect((await request.get(`/u/${handle}/story`)).status()).toBe(200); // 0 trades
  await page.reload();
  const section = page.getByRole('region', { name: 'Share your record' });
  await expect(section).toHaveCount(0); // 0 trades: hidden

  await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    values (${u.id}, ${'story-sell-' + Date.now()}, 'a', 'TSLA', now() - interval '3 days', now() - interval '1 day', -0.08, 2, true)`;
  await page.reload();
  await expect(section).toBeVisible();
  await expect(section.getByRole('button', { name: 'Share my record' })).toBeVisible(); // shares the square image where the device can
  const anonCtx = await browser.newContext();
  const anon = await anonCtx.newPage();
  await anon.goto(`/u/${handle}`);
  await expect(anon.getByRole('region', { name: 'Share your record' })).toHaveCount(0);
  await anonCtx.close();
});

test('ticker page: seeded symbol, rows newest first, links from feed and profile', async ({ page }) => {
  const res = await page.goto('/t/NVDA');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('NVDA');
  await expect(page.locator('.badge.demo').first()).toHaveText('Demo');
  await expect(page.locator('.ticker-rows a[href^="/u/"]').first()).toBeVisible();
  const dates = await page.locator('.ticker-rows a').evaluateAll((els) => els.map((e) => (e.querySelector('.muted')?.textContent ?? '').split('·')[1]?.trim() ?? ''));
  const times = dates.map((d) => Date.parse(d));
  expect(times.every((t, i) => i === 0 || t <= times[i - 1])).toBe(true);
  await page.goto('/');
  await expect(page.locator('a[href^="/t/"]').first()).toBeAttached();
  await page.goto('/u/momentum_maya');
  await expect(page.locator('a[href^="/t/"]').first()).toBeAttached();
});

test('ticker page: outcome spread chart, caption equals aria-label, median in summary, no h-scroll at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const res = await page.goto('/t/NVDA');
  expect(res?.status()).toBe(200);
  const svg = page.locator('section[aria-label="Outcome spread"] svg[role="img"]');
  await expect(svg).toBeVisible();
  const caption = (await page.getByTestId('spread-caption').innerText()).trim();
  expect(caption).toMatch(/\d+ trades?: \d+ up, \d+ down/);
  expect(await svg.getAttribute('aria-label')).toBe(caption);
  await expect(page.locator('section[aria-label="Summary"]')).toContainText(/median [+-]?\d/);
  await expect(page.locator('section[aria-label="Summary"]')).toContainText('win rate');
  await expect(page.locator('.evidence')).toBeVisible();
  await expect(page.locator('.ticker-rows a').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await expect(page.getByTestId('timeline-caption')).toContainText('closed:');
  await expect(page.getByTestId('timeline-table')).toBeAttached();
  await expect(page.getByTestId('timeline-legend')).toBeVisible();
  await expect(page.getByTestId('timeline-legend')).toContainText('hatched = down');
  const sc = page.getByTestId('timeline-scroll');
  expect(await sc.evaluate((el) => el.getBoundingClientRect().right <= window.innerWidth)).toBe(true);
  // rtl scroller: starts at the newest end, so scrollLeft is ~0 (never scrolled away from it)
  expect(await sc.evaluate((el) => Math.abs(el.scrollLeft) < 2 || el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.goto('/t/ZZZZ');
  await expect(page.locator('section[aria-label="Outcome spread"]')).toHaveCount(0);
  await expect(page.getByTestId('timeline-caption')).toHaveCount(0);
  await expect(page.getByTestId('timeline-table')).toHaveCount(0);
  await expect(page.getByTestId('hold-time')).toHaveCount(0);
  await expect(page.getByTestId('concentration')).toHaveCount(0);
});

test('ticker page: concentration check renders for a seeded symbol', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const res = await page.goto('/t/NVDA');
  expect(res?.status()).toBe(200);
  const sec = page.getByTestId('concentration');
  await expect(sec).toBeVisible();
  await expect(sec).toContainText('This shows how much of the record depends on one trader.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('ticker page: baseline section renders on a seeded symbol, not on an unknown one', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const res = await page.goto('/t/NVDA');
  expect(res?.status()).toBe(200);
  const sec = page.getByTestId('baseline');
  await expect(sec).toBeVisible();
  const kind = await sec.getAttribute('data-kind');
  if (kind === 'too_few_trades' || kind === 'demo_only' || kind === 'empty') await expect(page.getByTestId('baseline-verdict')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.goto('/t/ZZZZ');
  await expect(page.getByTestId('baseline')).toHaveCount(0);
});

test('ticker page: By hold time shows all four rows, no h-scroll at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const res = await page.goto('/t/NVDA');
  expect(res?.status()).toBe(200);
  const sec = page.getByTestId('hold-time');
  await expect(sec).toBeVisible();
  await expect(sec).toContainText('By hold time');
  await expect(sec.locator('tbody tr')).toHaveCount(4);
  await expect(page.getByTestId('hold-caption')).toContainText('by hold time:');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('ticker page: Why they traded it shows the seeded thesis with a Demo badge and a trade link', async ({ page }) => {
  const res = await page.goto('/t/NVDA');
  expect(res?.status()).toBe(200);
  const sec = page.getByTestId('theses');
  await expect(sec).toBeVisible();
  await expect(sec).toContainText('Breakout above the 50-day on volume after earnings beat');
  await expect(sec).toContainText('Demo');
  await expect(sec.locator('a[href*="/u/"][href*="#trade-"]').first()).toBeVisible();
});

test('ticker page: unknown symbol has no theses section', async ({ page }) => {
  await page.goto('/t/ZZZZ');
  await expect(page.getByTestId('theses')).toHaveCount(0);
});

test('ticker page: unknown and invalid symbols are calm 200s', async ({ page }) => {
  let res = await page.goto('/t/ZZZZ');
  expect(res?.status()).toBe(200);
  await expect(page.getByText('No verified closed trades in ZZZZ yet.')).toBeVisible();
  res = await page.goto('/t/%3Cscript%3E');
  expect(res?.status()).toBe(200);
  await expect(page.getByText("doesn't look like a ticker")).toBeVisible();
});

test('ticker index: lists seeded symbols with no performance numbers, sort is safe, nav links to it', async ({ page }) => {
  let res = await page.goto('/t');
  expect(res?.status()).toBe(200);
  await expect(page.locator('.ticker-rows a[href="/t/NVDA"]')).toBeVisible();
  expect(await page.locator('.ticker-rows').innerText()).not.toContain('%');
  res = await page.goto('/t?sort=garbage');
  expect(res?.status()).toBe(200);
  await expect(page.locator('.ticker-rows a').first()).toBeVisible();
  await page.goto('/t?sort=az');
  const syms = await page.locator('.ticker-rows a b').allInnerTexts();
  expect(syms).toEqual([...syms].sort());
  await page.goto('/');
  await page.locator('nav.top').getByRole('link', { name: 'Stocks' }).click();
  await expect(page).toHaveURL(/\/t$/);
  await page.goto('/t/NVDA');
  await expect(page.getByRole('link', { name: /All stocks/ }).first()).toHaveAttribute('href', '/t');
});

test('stock search: exact redirects, no match and hostile input are honest, sort keeps q', async ({ page }) => {
  await page.goto('/t?q=nvda');
  await expect(page).toHaveURL(/\/t\/NVDA$/);
  let res = await page.goto('/t?q=zzz');
  expect(res?.status()).toBe(200);
  await expect(page.getByText('No stock with verified trades matches')).toBeVisible();
  await expect(page.getByRole('link', { name: 'See all stocks' })).toHaveAttribute('href', '/t');
  res = await page.goto('/t?q=%25');
  expect(res?.status()).toBe(200);
  await expect(page.getByText('No stock with verified trades matches')).toBeVisible();
  await page.goto('/t?q=N');
  await expect(page.getByRole('link', { name: 'A–Z' })).toHaveAttribute('href', /q=N/);
});

test('related stocks section appears only when 2+ traders overlap', async ({ page }) => {
  // The demo seed gives each trader a disjoint symbol set, so on seeded data the section must be absent.
  // If the seed ever gains overlapping symbols, this assertion needs updating.
  await page.goto('/t/NVDA');
  await expect(page.getByRole('heading', { name: 'Also closed by these traders' })).toHaveCount(0);
});

test('ticker share card: image for seeded symbol, neutral image for bad or unknown', async ({ request }) => {
  for (const s of ['NVDA', '!!!', 'ZZZZZ']) {
    const res = await request.get(`/t/${encodeURIComponent(s)}/opengraph-image`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  }
});

test('compare page: two seeded symbols in URL order, noindex, honest empty states', async ({ page, request }) => {
  const res = await page.goto('/t/compare?a=NVDA&b=AMD');
  expect(res!.status()).toBe(200);
  const heads = await page.locator('main section h2 a').allTextContents();
  expect(heads.slice(0, 2)).toEqual(['NVDA', 'AMD']);
  expect(await page.locator('meta[name="robots"]').getAttribute('content')).toContain('noindex');
  await expect(page.locator('main section h2 a')).toHaveCount(2);
  await expect(page.locator('main section section')).toHaveCount(0);
  const cases: [string, string][] = [
    ['/t/compare?a=ZZZZ&b=NVDA', 'No verified closed trades in ZZZZ yet.'],
    ['/t/compare?a=NVDA&b=nvda', 'Pick two different stocks. You chose NVDA twice.'],
    ['/t/compare?a=ZZZZ&b=YYYY', 'No verified closed trades in ZZZZ or YYYY yet.'],
    ['/t/compare', 'Pick two stocks to compare.'],
  ];
  for (const [url, text] of cases) {
    const r = await page.goto(url);
    expect(r!.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText(text)).toBeVisible();
  }
  await page.goto('/t/NVDA');
  await expect(page.locator('form[action="/t/compare"]')).toBeAttached();
  // Every related-list Compare link (none on the disjoint demo seed) must point at the compare page with this symbol first.
  const links = await page.locator('a.compare-link').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  const related = await page.getByRole('heading', { name: 'Also closed by these traders' }).count();
  if (related > 0) expect(links.length).toBeGreaterThan(0);
  for (const h of links) expect(h!.startsWith('/t/compare?a=NVDA&b=')).toBe(true);
  const sm = await (await request.get('/sitemap.xml')).text();
  expect(sm).not.toContain('/t/compare');
});

test('sitemap lists /t but no demo-only ticker pages; robots points at it', async ({ request }) => {
  const sm = await request.get('/sitemap.xml');
  expect(sm.status()).toBe(200);
  expect(sm.headers()['content-type']).toContain('xml');
  const body = await sm.text();
  expect(body).toMatch(/\/t<\/loc>/);
  // Other tests insert verified trades, so check the rule itself: demo-only stocks are never listed, and every
  // listed stock has a verified trade.
  const { sql } = await import('../lib/db.ts');
  const rows = await sql`select symbol, bool_or(verified) as real from closed_trades group by symbol`;
  const listed = [...body.matchAll(/\/t\/([A-Z0-9.%-]+)<\/loc>/g)].map((m) => decodeURIComponent(m[1]));
  for (const r of rows.filter((x) => !x.real)) expect(listed).not.toContain(r.symbol);
  for (const sym of listed) expect(rows.find((x) => x.symbol === sym)?.real).toBe(true);
  const rb = await request.get('/robots.txt');
  expect(rb.status()).toBe(200);
  const txt = await rb.text();
  expect(txt).toContain('Sitemap:');
  expect(txt).toContain('Disallow: /api');
  expect(txt).toContain('Disallow: /connect');
  expect(txt).not.toContain('Disallow: /t');
});

test('watchlist: signed-in trader watches a symbol and sees it on /t; signed out sees only a sign-in link', async ({ page, browser }) => {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill('momentum_maya');
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/u\/momentum_maya$/);
  await page.goto('/t/NVDA');
  await page.getByRole('button', { name: 'Watch', exact: true }).click();
  await expect(page.getByRole('button', { name: /Watching NVDA/ })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/t');
  await expect(page.getByRole('region', { name: 'Your watched stocks' }).getByText('NVDA')).toBeVisible();
  // unwatch so reruns start clean
  await page.goto('/t/NVDA');
  await page.getByRole('button', { name: /Watching NVDA/ }).click();

  const ctx = await browser.newContext();
  const anon = await ctx.newPage();
  const res = await anon.goto('/t/NVDA');
  expect(res?.status()).toBe(200);
  await expect(anon.getByRole('link', { name: 'Sign in to watch' })).toBeVisible();
  await expect(anon.getByRole('button', { name: /^Watch/ })).toHaveCount(0);
  await anon.goto('/t');
  await expect(anon.getByText('Your watched stocks')).toHaveCount(0);
  await ctx.close();
});

// F-1 PR-3 fix round 4 (committee). A trader made here, removed after; generic symbols, synthetic returns.
async function makeTrader(handle: string, closes: (i: number) => { closedAt: string; r: number }, n: number) {
  const { sql } = await import('../lib/db.ts');
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle}, ${handle}, now(), a.id from a
    on conflict (handle) do update set handle = excluded.handle returning id`;
  await sql`delete from closed_trades where user_id = ${u.id}`;
  const rows = Array.from({ length: n }, (_, i) => {
    const c = closes(i);
    const closed = new Date(c.closedAt);
    return { user_id: u.id, sell_id: `${handle}-${i}`, account_id: 'a', symbol: ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH'][i % 8],
      opened_at: new Date(closed.getTime() - (1 + (i % 9)) * 86_400_000), closed_at: closed, return_pct: c.r, holding_days: 1 + (i % 9), verified: true };
  });
  for (let i = 0; i < rows.length; i += 1000) await sql`insert into closed_trades ${sql(rows.slice(i, i + 1000))}`;
  const ids = (await sql`select id from closed_trades where user_id = ${u.id} order by closed_at desc, id desc`).map((r) => String(r.id));
  return { sql, id: u.id as number, ids, remove: () => sql`delete from users where id = ${u.id}` };
}

test('fix round 4 (business lead blocker): a close dated 2015 does not break the feed', async ({ page, request }) => {
  const t = await makeTrader('old_close_e2e', (i) => (i < 5 ? { closedAt: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(), r: 0.01 * (i + 1) } : { closedAt: '2015-03-02T15:00:00Z', r: 0.5 }), 6);
  try {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible();
  } finally {
    await t.remove();
  }
});

// F-1 PR-3 fix round 6 (engineer re-sit, Medium): a future-dated close overflowed the feed's score (2031) or topped it.
test('fix round 6: closes dated 2031 and tomorrow do not break the feed', async ({ page, request }) => {
  const t = await makeTrader('future_close_e2e', (i) => (i < 5 ? { closedAt: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(), r: 0.01 * (i + 1) }
    : { closedAt: i === 5 ? '2031-01-02T15:00:00Z' : new Date(Date.now() + 86_400_000).toISOString(), r: 0.5 }), 7);
  try {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible();
  } finally {
    await t.remove();
  }
});

test('fix round 4 (UX lead demand 1, POLICY F3/A1, TR-1): a 2,828-close profile is paged, short, keyboard-reachable to the disclaimer, and every close stays reachable', async ({ page, request, browser }) => {
  test.setTimeout(120_000);
  const N = 2828;
  const t0 = Date.now() - 3_600_000;
  const t = await makeTrader('heavy_e2e', (i) => ({ closedAt: new Date(t0 - i * 7 * 3_600_000).toISOString(), r: (((i * 37) % 200) - 100) / 1000 }), N);
  try {
    // Visitor HTML under 400 KB (it was 3.8 MB).
    const html = await (await request.get('/u/heavy_e2e')).text();
    expect(Buffer.byteLength(html)).toBeLessThan(400_000);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/u/heavy_e2e');
    const rows = page.locator('ul.rows.closes > li');
    await expect(rows).toHaveCount(50);
    await expect(rows.first()).toHaveId(`trade-${t.ids[0]}`);
    await expect(page.getByText('Showing 50 of 2,828 closed trades', { exact: true })).toBeVisible();
    // The stats and the chart cover the whole record; counts are grouped.
    await expect(page.locator('.stat', { hasText: 'closed trades' }).locator('b')).toHaveText('2,828');
    await expect(page.getByRole('img', { name: /^2,828 trades, / })).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(15_000);
    // The footer within 200 Tab presses, with no skip link used.
    let presses = 0;
    for (; presses < 200; presses++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => !!document.activeElement?.closest('footer.site'))) break;
    }
    expect(presses).toBeLessThan(200);
    // The skip link is the first Tab stop and moves focus to the disclaimer.
    await page.goto('/u/heavy_e2e');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to disclaimer and legal links' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('footer.site')).toBeFocused();
    await expect(page.locator('footer.site')).toContainText('Not investment advice. Past performance does not guarantee future results.');

    // Every chart point links to a row its target window renders (no link to a missing anchor).
    await expect(page.locator('.chart-hit a')).toHaveCount(N); // drawn after hydration
    const hrefs = await page.locator('.chart-hit a').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
    expect(hrefs.length).toBe(N);
    const order = new Map(t.ids.map((id, i) => [id, i]));
    for (const h of hrefs) {
      const m = h.match(/^(?:\?closes=(\d+))?#trade-(\d+)$/);
      expect(m, h).not.toBeNull();
      const end = Number(m![1] ?? 50), i = order.get(m![2])!;
      expect(i >= end - 50 && i < end, h).toBe(true);
    }

    // With JS: "Show 50 more" lands on, and focuses, row 51.
    await page.getByRole('link', { name: 'Show 50 more' }).click();
    await expect(page).toHaveURL(new RegExp(`\\?closes=100#trade-${t.ids[50]}$`));
    await expect(page.locator(`#trade-${t.ids[50]}`)).toBeFocused();
    await expect(rows).toHaveCount(50);
    await expect(page.getByText('Showing 51–100 of 2,828 closed trades', { exact: true })).toBeVisible();
    // A chart point in another window opens that window at its row.
    const far = await page.locator(`.chart-hit a[href$="#trade-${t.ids[N - 1]}"]`).getAttribute('href');
    expect(far).toBe(`?closes=2850#trade-${t.ids[N - 1]}`);

    // Without JS: the same link reaches rows 51-100, and walking on reaches the oldest close.
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const nojs = await ctx.newPage();
    await nojs.goto('/u/heavy_e2e');
    await expect(nojs.locator('ul.rows.closes > li')).toHaveCount(50);
    await nojs.getByRole('link', { name: 'Show 50 more' }).click();
    await expect(nojs).toHaveURL(new RegExp(`\\?closes=100#trade-${t.ids[50]}$`));
    const ids = await nojs.locator('ul.rows.closes > li').evaluateAll((ls) => ls.map((l) => l.id));
    expect(ids).toEqual(t.ids.slice(50, 100).map((id) => `trade-${id}`));
    await expect(nojs.locator(`#trade-${t.ids[50]}`)).toBeInViewport();
    await nojs.goto('/u/heavy_e2e?closes=2800');
    await nojs.getByRole('link', { name: 'Show 28 more' }).click();
    const last = await nojs.locator('ul.rows.closes > li').evaluateAll((ls) => ls.map((l) => l.id));
    expect(last).toEqual(t.ids.slice(2800).map((id) => `trade-${id}`));
    expect(last.at(-1)).toBe(`trade-${t.ids[N - 1]}`); // the oldest close
    await expect(nojs.getByText('Showing 2,801–2,828 of 2,828 closed trades', { exact: true })).toBeVisible();
    await expect(nojs.getByRole('link', { name: /^Show \d+ more$/ })).toHaveCount(0);
    await expect(nojs.getByRole('link', { name: 'Back to the newest' })).toHaveAttribute('href', '/u/heavy_e2e');
    // 44 px controls.
    const box = await nojs.getByRole('link', { name: 'Back to the newest' }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await ctx.close();
  } finally {
    await t.remove();
  }
});
