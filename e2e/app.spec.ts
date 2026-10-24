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
  // Fix round 8 (tester re-run 4): the count is pluralized properly (the seed gives each demo trader one orphan sell).
  await expect(page.getByText('1 earlier position excluded: no matching entry in the imported history.', { exact: true })).toBeVisible();
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
async function makeTrader(handle: string, closes: (i: number) => { closedAt: string; r: number; symbol?: string }, n: number) {
  const { sql } = await import('../lib/db.ts');
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle}, ${handle}, now(), a.id from a
    on conflict (handle) do update set handle = excluded.handle returning id`;
  await sql`delete from closed_trades where user_id = ${u.id}`;
  const rows = Array.from({ length: n }, (_, i) => {
    const c = closes(i);
    const closed = new Date(c.closedAt);
    return { user_id: u.id, sell_id: `${handle}-${i}`, account_id: 'a', symbol: c.symbol ?? ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH'][i % 8],
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

// F-1 PR-3 fix round 7 (business lead re-sit, demand 2): the feed draws each card's chart at screen resolution.
// Fix round 8 (tester re-run 4, Medium): the bound held only while the 50 cards fell on 2 traders (about 30 KB of chart
// data per distinct heavy trader). Twelve traders with the heavy-use fixture's record (lib/sync.load.test.ts: 4 accounts
// × 2,500 seeded activities, about 4,700 closes each) now share the 50 cards, at most 5 each, so at least 10 distinct
// heavy records are on the page. Each trader's newest 5 closes are moved into the last 15 minutes with large moves (2 of
// them losses) so they, and only they, make the feed's cards; the rest is the fixture as matched, ending 30 days ago.
// The page carries a stand-in line per trader; a pane loads its full chart on its first swipe-open.
// F-2 PR-1 (plan §1 PR-1, §4): 50 distinct heavy traders in the fixture (was 12) and 30-card pages; pages 1 to 3 are
// each measured. The diversity caps put at most 2 cards of one trader in any 10 (the joins included). The fresh closes carry one symbol per trader and close, so the symbol cap never ends the list early.
test('fix round 8, F-2 PR-1: 30-card pages from 50 distinct heavy traders each weigh under 500 KB; a pane loads its chart on first open and reads like the profile\'s', async ({ page, request, browser }) => {
  test.setTimeout(600_000);
  const { seededActivities } = await import('./fakes/vendor.ts');
  const { matchTrades, confidence, evidenceWeight } = await import('../lib/trades.ts');
  const { FEED_LITE_POINTS } = await import('../lib/downsample.ts');
  const { worstWindow } = await import('../lib/discovery/diversity.ts');
  const { gzipSync } = await import('node:zlib');
  const { feedLock } = await import('./feed-lock.ts');
  const release = await feedLock('exclusive'); // the connect tests that look for their trader in the feed wait meanwhile
  const now = Date.now();
  const made: Awaited<ReturnType<typeof makeTrader>>[] = [];
  const HEAVY = 50;
  const L = (n: number) => String.fromCharCode(65 + (n % 26));
  try {
    for (let h = 0; h < HEAVY; h++) {
      const acts = [];
      for (let a = 0; a < 4; a++) for (const r of seededActivities(`hf${h}-${a}`, 2_500, 1000 + 10 * h + a)) {
        acts.push({ externalId: r.id, accountId: `hf${h}-${a}`, symbol: r.symbol, side: r.type, units: r.units, price: r.price, fee: r.fee ?? 0, executedAt: new Date(r.trade_date), verified: true });
      }
      const closes = matchTrades(acts).trades.sort((x, y) => y.closedAt.getTime() - x.closedAt.getTime());
      const shift = now - 30 * 86_400_000 - closes[0].closedAt.getTime();
      const t = await makeTrader(`heavy_feed_${h}`, (i) => (i < 5
        ? { closedAt: new Date(now - (i + 1 + h * 0.05) * 120_000).toISOString(), r: i % 2 ? -1 / 3 : 0.5, symbol: `Z${L(h)}${L(Math.floor(h / 26))}${L(i)}` }
        : { closedAt: new Date(closes[i].closedAt.getTime() + shift).toISOString(), r: closes[i].returnPct }), closes.length);
      made.push(t);
      // Each ranks with a clear direction (TR-9), as the feed computes it, so its 5 fresh cards outrank every older close.
      const rows = await t.sql`select symbol, opened_at, closed_at, return_pct, holding_days from closed_trades where user_id = ${t.id}`;
      expect(evidenceWeight(confidence(rows.map((r) => ({ symbol: r.symbol, openedAt: r.opened_at, closedAt: r.closed_at, returnPct: r.return_pct, holdingDays: r.holding_days })), new Date()))).toBeGreaterThan(0);
    }
    const total = made.reduce((s, t) => s + t.ids.length, 0);
    expect(total).toBeGreaterThan(HEAVY * 4_500);

    // Pages 1 to 3, each as served (the no-JS link carries the cursor), each under 500 KB raw.
    let url = '/';
    let raw = 0, gz = 0, traders = 0;
    const seen: { handle: string; symbol: string }[] = [];
    for (let p = 1; p <= 3; p++) {
      const res = await request.get(url);
      expect(res.status()).toBe(200);
      const html = await res.text();
      const bytes = Buffer.byteLength(html), zipped = gzipSync(html).length;
      const cards = [...html.matchAll(/<article class="card">[\s\S]*?href="\/u\/(heavy_feed_\d+)"[\s\S]*?href="\/t\/([A-Z]+)"/g)].map((m) => ({ handle: m[1], symbol: m[2] }));
      const distinct = new Set(cards.map((c) => c.handle)).size;
      console.log(`# feed page ${p}: ${cards.length} heavy cards from ${distinct} distinct heavy traders (${HEAVY} in the fixture, ${total} closes) ${(bytes / 1024).toFixed(0)} KB raw, ${(zipped / 1024).toFixed(0)} KB gzipped`);
      test.info().annotations.push({ type: `feed-bytes-page-${p}`, description: `${bytes} raw, ${zipped} gzipped, ${distinct} distinct heavy traders` });
      expect(bytes).toBeLessThan(500_000);
      expect(cards).toHaveLength(30);
      expect(distinct).toBeGreaterThanOrEqual(10); // as before; the caps allow up to 6 cards of a trader in 30 (2 per 10)
      if (p === 1) { raw = bytes; gz = zipped; traders = distinct; }
      seen.push(...cards);
      const next = /href="\/\?after=([A-Za-z0-9_-]+)"/.exec(html)?.[1];
      expect(next).toBeTruthy();
      url = `/?after=${next}`;
    }
    // The caps hold across both page joins; no card repeats.
    const w = worstWindow(seen.map((c, i) => ({ key: String(i), trader: c.handle, symbol: c.symbol })));
    expect(w.trader).toBeLessThanOrEqual(2);
    expect(w.symbol).toBeLessThanOrEqual(2);
    expect(new Set(seen.map((c) => `${c.handle}|${c.symbol}`)).size).toBe(90);

    await page.setViewportSize({ width: 375, height: 667 });
    // Evidence for the log (fix round 8): the measured weight, as an image beside the pane screenshots.
    await page.setContent(`<main style="font:16px/1.5 system-ui;padding:16px"><h1 style="font-size:20px">Feed weight, 30 heavy cards (page 1)</h1><p>${traders} distinct heavy traders on the page, ${HEAVY} in the fixture, ${total.toLocaleString('en-US')} closes in their records</p><p><b>${(raw / 1024).toFixed(0)} KB raw</b> (bound 500 KB), ${(gz / 1024).toFixed(0)} KB gzipped</p><p>Each pane carries a stand-in line; its chart loads on first open.</p></main>`);
    await page.screenshot({ path: test.info().outputPath('fix8-feed-weight-375-light.png') });
    const fetched: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/pane-chart')) fetched.push(new URL(r.url()).pathname); });
    await page.goto('/');
    await expect(page.locator('.feed .row')).toHaveCount(30);
    const who = await page.locator('.feed .row .pane .who .muted').allInnerTexts();
    expect(who).toHaveLength(30);
    for (const w of who) expect(w).toMatch(/^@heavy_feed_\d+$/); // every card is a heavy record
    expect(new Set(who).size).toBeGreaterThanOrEqual(10); // spread over at least 10 distinct heavy traders
    // The name equals the handle here: shown once ("@heavy_feed_3", never "heavy_feed_3@heavy_feed_3").
    for (const t of await page.locator('.feed .row .who').allInnerTexts()) expect(t).toMatch(/^@heavy_feed_\d+$/);
    // Trust rule unchanged: every pane carries its card's badge (all of these are whole, verified records).
    for (const row of await page.locator('.feed .row').all()) {
      await expect(row.locator('.pane header .badge.verified')).toHaveCount(1);
      await expect(row.locator('.card .badge.verified')).toHaveCount(1);
    }

    // The page carries only the stand-in line per card (the ALL range, at most FEED_LITE_POINTS points, no closes).
    const counts = await page.locator('.feed .pane path.curve').evaluateAll((ps) => ps.map((p) => (p.getAttribute('d')!.match(/-?\d+(?:\.\d+)?/g) ?? []).length / 2));
    expect(counts).toHaveLength(30);
    for (const c of counts) expect(c).toBeLessThanOrEqual(FEED_LITE_POINTS + 1); // plus the line to the range end
    await expect(page.locator('.feed .pane figure.chart[data-chart="stand-in"]')).toHaveCount(30);
    expect(fetched).toEqual([]); // nothing is fetched before a pane opens
    const row0 = page.locator('.feed .row').first();
    const pane = row0.locator('.pane');
    await expect(pane.locator('.chart-hit')).toBeAttached(); // hydrated
    expect(await pane.locator('.chart-hit a').count()).toBe(0); // the stand-in links no closes
    const first = (await pane.locator('.who .muted').innerText()).slice(1);
    // Swipe-open (the row scrolls to its pane): the pane fetches its trader's chart once and replaces the stand-in.
    await pane.scrollIntoViewIfNeeded();
    await expect(pane.locator('figure.chart')).toHaveAttribute('data-chart', 'full');
    expect(fetched).toEqual([`/u/${first}/pane-chart`]);
    await expect(pane.locator('.chart-hit a').first()).toBeAttached(); // drawn after hydration
    expect(await pane.locator('.chart-hit a').count()).toBeLessThanOrEqual(400);
    // The pane's scrubbable chart reaches the newest close and the range tabs work within the bound.
    await pane.locator('.chart-stack').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(pane.locator('.chart-head')).toContainText(/\d+\/\d+\/\d{4}/);
    await page.keyboard.press('Escape');
    await pane.getByRole('button', { name: '1Y', exact: true }).click();
    await expect(pane.locator('.chart-head')).toContainText('Past year');
    expect(await pane.locator('path.curve').evaluate((p) => (p.getAttribute('d')!.match(/-?\d+(?:\.\d+)?/g) ?? []).length / 2)).toBeLessThanOrEqual(401);
    await pane.getByRole('button', { name: 'ALL', exact: true }).click();

    // Reads the same: the pane's line spans exactly the box of the profile's full-resolution line (first, last, low and
    // high kept), with the same header and the same label (count, total, drawdown) from the whole record.
    const handle = (await pane.locator('.who .muted').innerText()).slice(1);
    const look = async (fig: ReturnType<typeof page.locator>) => ({
      box: await fig.locator('path.curve').evaluate((p) => { const b = (p as SVGPathElement).getBBox(); return [b.x, b.y, b.width, b.height]; }),
      head: await fig.locator('.chart-head').innerText(),
      label: await fig.locator('svg[role="img"]').getAttribute('aria-label'),
      points: await fig.locator('path.curve').evaluate((p) => (p.getAttribute('d')!.match(/-?\d+(?:\.\d+)?/g) ?? []).length / 2),
    });
    const shot = test.info().outputPath('fix8');
    const capture = async (fig: ReturnType<typeof page.locator>, name: string) => {
      const out = [];
      for (const key of ['ALL', '1Y'] as const) {
        await fig.getByRole('button', { name: key, exact: true }).click();
        out.push(await look(fig));
        for (const colorScheme of ['light', 'dark'] as const) {
          await page.emulateMedia({ colorScheme });
          await fig.screenshot({ path: `${shot}-${name}-${key}-375-${colorScheme}.png` });
        }
        await page.emulateMedia({ colorScheme: 'light' });
      }
      return out;
    };
    const small = await capture(pane.locator('figure.chart'), 'feed-pane');
    await page.goto(`/u/${handle}`);
    const full = await capture(page.locator('figure.chart'), 'profile');
    console.log(`# feed: pane chart ${small.map((s) => s.points).join('/')} path points (ALL/1Y), profile chart ${full.map((s) => s.points).join('/')}`);
    expect(full[0].points).toBeGreaterThan(4_000); // the profile keeps full resolution
    for (const k of [0, 1]) {
      expect(small[k].head).toBe(full[k].head);
      expect(small[k].label).toBe(full[k].label);
      for (let i = 0; i < 4; i++) expect(Math.abs(small[k].box[i] - full[k].box[i])).toBeLessThanOrEqual(0.5);
    }
    // Fix round 8: the keyboard path loads too. A pane not yet opened, reached by Tab focus on its chart, fetches its
    // chart, and the arrows scrub it.
    const other = page.locator('.feed .row').filter({ hasNot: page.locator(`a[href="/u/${first}"]`) }).first();
    await page.goto('/');
    const otherPane = other.locator('.pane');
    await expect(otherPane.locator('.chart-hit')).toBeAttached();
    await expect(otherPane.locator('figure.chart')).toHaveAttribute('data-chart', 'stand-in');
    await otherPane.locator('.chart-stack').focus();
    await expect(otherPane.locator('figure.chart')).toHaveAttribute('data-chart', 'full');
    await page.keyboard.press('ArrowLeft');
    await expect(otherPane.locator('.chart-head')).toContainText(/\d+\/\d+\/\d{4} · [A-Z]+/); // a close, with its symbol
    await page.keyboard.press('Escape');
    // Without JS the pane keeps its stand-in line (0% on the axis), its numbers and its trust badge.
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 667 } });
    const nojs = await ctx.newPage();
    await nojs.goto('/');
    const np = nojs.locator('.feed .row').first().locator('.pane');
    expect(await np.locator('path.curve').evaluate((p) => (p.getAttribute('d')!.match(/-?\d+(?:\.\d+)?/g) ?? []).length / 2)).toBeGreaterThan(FEED_LITE_POINTS / 2);
    await expect(np.locator('.chart .zero-label')).toHaveText('0%');
    expect((await nojs.locator('.feed .row').first().locator('.pane .who .muted').innerText()).slice(1)).toBe(first);
    expect(await np.locator('svg[role="img"]').getAttribute('aria-label')).toBe(small[0].label); // the full chart's numbers
    await expect(np.locator('header .badge.verified')).toHaveCount(1);
    await expect(np.getByText('win rate', { exact: true })).toBeAttached();
    await ctx.close();
  } finally {
    for (const t of made) await t.remove();
    await release();
  }
});

// ---- F-2 PR-1: feed mix and paging (docs/features/logs/F-2/plan.md §1 PR-1) ----
// Fix round 1: this round's screenshots go to their own folder (the PR-1 build's evidence in pr1/ stays as it was).
// Fix round 2: pr1-fix2 (pr1-fix1 keeps fix round 1's evidence).
const PR1_SHOTS = 'docs/features/logs/F-2/screenshots/pr1-fix2';
// 45 traders × 5 fresh closes (large moves, losses included), one symbol per close: enough for three pages.
async function pagingFixture() {
  const now = Date.now();
  const L = (n: number) => String.fromCharCode(65 + (n % 26));
  const made: Awaited<ReturnType<typeof makeTrader>>[] = [];
  for (let h = 0; h < 45; h++) {
    made.push(await makeTrader(`pg_e2e_${h}`, (i) => ({ closedAt: new Date(now - (h * 5 + i + 1) * 20_000).toISOString(), r: (i + h) % 3 ? 0.3 + ((h * 7 + i) % 10) / 40 : -0.25 - ((h + i) % 5) / 40,
      symbol: `Y${L(h)}${L(Math.floor(h / 26))}${L(i)}` }), 5));
  }
  return { made, remove: async () => { for (const t of made) await t.remove(); } };
}
const cardsOf = (page: import('@playwright/test').Page) => page.locator('.feed > .row').evaluateAll((rows) => rows.map((r) => ({
  trade: r.getAttribute('data-trade')!, handle: r.querySelector('.card .who')!.getAttribute('href')!.slice(3), symbol: r.querySelector('.card .symbol')!.textContent!,
})));

test('F-2 PR-1: page 2 appends with no tap at card 25; the 30 → 31 join is seamless; ↓ crosses it; SW-1 works on appended cards; no-JS uses the link', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const { worstWindow } = await import('../lib/discovery/diversity.ts');
  const { feedLock } = await import('./feed-lock.ts');
  const release = await feedLock('exclusive');
  const fx = await pagingFixture();
  try {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const rows = page.locator('.feed > .row');
    await expect(rows).toHaveCount(30);
    await expect(page.locator('.feed .feed-more a')).toHaveAttribute('href', /^\/\?after=[A-Za-z0-9_-]+$/);
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached(); // hydrated
    // Reading down to card 20 fetches nothing.
    const fetched: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST') fetched.push(r.url()); });
    await rows.nth(19).evaluate((el) => el.scrollIntoView());
    await page.waitForTimeout(400);
    await expect(rows).toHaveCount(30);
    expect(fetched).toEqual([]);
    // Card 25 in view: the next 30 append with no tap.
    await rows.nth(24).evaluate((el) => el.scrollIntoView());
    await expect(rows).toHaveCount(60);
    expect(fetched).toHaveLength(1); // one request
    const js = await cardsOf(page);
    expect(new Set(js.map((c) => c.trade)).size).toBe(60); // no card repeats
    const w = worstWindow(js.map((c) => ({ key: c.trade, trader: c.handle, symbol: c.symbol })));
    expect(w.trader).toBeLessThanOrEqual(2); // caps hold across the join
    expect(w.symbol).toBeLessThanOrEqual(2);
    // Keyboard: ↓ from card 30 lands on card 31 (the first appended card).
    await rows.nth(29).locator('.card .who').focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => rows.nth(30).evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(0);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.screenshot({ path: `${PR1_SHOTS}/join-card31-375-${colorScheme}.png` });
    }
    // SW-1 on an appended card: → opens its pane, ← returns.
    const row31 = rows.nth(30);
    await expect.poll(async () => { await page.keyboard.press('ArrowRight'); return row31.evaluate((el) => el.scrollLeft); }).toBeGreaterThan(300);
    await expect(row31.locator('.pane .chart .zero-label')).toHaveText('0%');
    await expect(row31.locator('.pane').getByRole('link', { name: 'See full profile →' })).toHaveAttribute('href', `/u/${js[30].handle}`);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => row31.evaluate((el) => el.scrollLeft)).toBe(0);
    await page.emulateMedia({ colorScheme: 'light' });

    // Without JavaScript: the same first 30, then the link to the next 30, which are cards 31 to 60 above.
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 800 } });
    const nojs = await ctx.newPage();
    await nojs.goto('/');
    expect((await cardsOf(nojs)).map((c) => c.trade)).toEqual(js.slice(0, 30).map((c) => c.trade));
    const more = nojs.getByRole('link', { name: 'Show more' });
    await more.scrollIntoViewIfNeeded();
    for (const colorScheme of ['light', 'dark'] as const) {
      await nojs.emulateMedia({ colorScheme });
      await nojs.screenshot({ path: `${PR1_SHOTS}/nojs-show-more-375-${colorScheme}.png` });
    }
    await more.click();
    await expect(nojs).toHaveURL(/\/\?after=/);
    expect((await cardsOf(nojs)).map((c) => c.trade)).toEqual(js.slice(30, 60).map((c) => c.trade));
    await ctx.close();

    // 1280 wide, light and dark: the join renders the same way.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await rows.nth(24).evaluate((el) => el.scrollIntoView());
    await expect(rows).toHaveCount(60);
    await rows.nth(30).evaluate((el) => el.scrollIntoView());
    expect((await cardsOf(page)).map((c) => c.trade)).toEqual(js.map((c) => c.trade)); // the same list for this day
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.screenshot({ path: `${PR1_SHOTS}/join-card31-1280-${colorScheme}.png` });
    }
  } finally {
    await fx.remove();
    await release();
  }
});

test('F-2 PR-1: a failed page shows one inline "Couldn\'t load more. Retry" (44 px) and Retry appends the page', async ({ page }) => {
  test.setTimeout(120_000);
  const { feedLock } = await import('./feed-lock.ts');
  const release = await feedLock('exclusive');
  const fx = await pagingFixture();
  try {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    const rows = page.locator('.feed > .row');
    await expect(rows).toHaveCount(30);
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached();
    let fail = true;
    await page.route('**/*', (route) => (fail && route.request().method() === 'POST' ? route.abort() : route.continue()));
    await rows.nth(24).evaluate((el) => el.scrollIntoView());
    const status = page.locator('.feed-more [role="status"]');
    await expect(status).toHaveText('Couldn\u2019t load more. Retry');
    const retry = status.getByRole('button', { name: 'Retry' });
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(rows).toHaveCount(30);
    await status.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${PR1_SHOTS}/retry-375-light.png` });
    fail = false;
    await retry.click();
    await expect(rows).toHaveCount(60);
    await expect(status).toHaveCount(0);
  } finally {
    await fx.remove();
    await release();
  }
});

test('F-2 PR-1: the end card renders on the demo fixture, signed out; the feed ends without a completeness claim', async ({ page, browser }) => {
  const { feedLock } = await import('./feed-lock.ts');
  const release = await feedLock('exclusive');
  try {
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      // Follow the pages to the end, appending with no tap (on the demo fixture alone that is page 1: 3 traders, 2 cards
      // each per 10; records other tests leave behind can make it a few pages).
      await expect(page.locator('main.feed')).toBeAttached();
      for (let i = 0; i < 8 && !(await page.locator('.feed-end').count()); i++) {
        const n = await page.locator('.feed > .row').count();
        await page.locator('.feed > .row').last().evaluate((el) => el.scrollIntoView());
        await expect.poll(async () => (await page.locator('.feed-end').count()) || (await page.locator('.feed > .row').count()) > n, { timeout: 15_000 }).toBeTruthy();
      }
      const end = page.locator('.feed-end');
      await expect(end.getByRole('heading', { level: 2 })).toHaveText('End of today\u2019s feed.');
      await expect(end.getByRole('link', { name: 'Publish your trades' })).toHaveAttribute('href', '/login');
      await expect(page.locator('.feed .badge.demo').first()).toHaveText('Demo');
      await expect(page.locator('.feed-more')).toHaveCount(0);
      await end.scrollIntoViewIfNeeded();
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme });
        await page.screenshot({ path: `${PR1_SHOTS}/end-card-${width}-${colorScheme}.png` });
      }
      await page.emulateMedia({ colorScheme: 'light' });
      expect(await end.innerText()).not.toMatch(/\b(all|caught up|every|complete|whole|nothing (more|else))\b/i);
    }
    // The disclaimer is unchanged and in the page.
    await expect(page.locator('#site-footer')).toContainText('Not investment advice. Past performance does not guarantee future results.');
    // No JS: the end card is in the served page too.
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const nojs = await ctx.newPage();
    await nojs.goto('/');
    for (let i = 0; i < 8 && (await nojs.locator('.feed-more a').count()); i++) await nojs.locator('.feed-more a').click();
    await expect(nojs.locator('.feed-end h2')).toHaveText('End of today\u2019s feed.');
    await ctx.close();
  } finally {
    await release();
  }
});

test('F-2 PR-1: a bad or tampered cursor serves page 1 (never a 500); later pages are noindex', async ({ request }) => {
  const { feedLock } = await import('./feed-lock.ts');
  const release = await feedLock('exclusive');
  try {
    const ids = (html: string) => [...html.matchAll(/data-trade="(\d+)"/g)].map((m) => m[1]).join();
    for (const bad of ['x', '%00', 'eyJkIjoxfQ', 'A'.repeat(300), 'eyJkIjoiMjAyNi0xMC0yMyIsImEiOjEsIm8iOjMwfQ']) {
      const first = await (await request.get('/')).text();
      expect(first).not.toMatch(/<meta name="robots" content="noindex"/);
      const res = await request.get(`/?after=${bad}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(ids(html)).toBe(ids(first));
      expect(html).toMatch(/<meta name="robots" content="noindex"/);
    }
  } finally {
    await release();
  }
});

// ---- F-2 PR-1 fix round 1 (blocking, all three reports): the page join from the control ----
// The row whose top sits at the top of the feed (0-based), and the POSTs made since `since`.
const atTop = (page: import('@playwright/test').Page) => page.locator('main.feed').evaluate((feed) => {
  const top = feed.getBoundingClientRect().top;
  return [...feed.querySelectorAll(':scope > .row, :scope > .feed-more, :scope > .feed-end')].findIndex((r) => Math.abs(r.getBoundingClientRect().top - top) < 2);
});
// The reader is at the control: it is in view (at the end of the list, below the lower part of card 30).
const controlInView = (page: import('@playwright/test').Page) => page.locator('main.feed').evaluate((feed) =>
  feed.querySelector(':scope > .feed-more')!.getBoundingClientRect().top < feed.getBoundingClientRect().bottom - 1);

test('F-2 PR-1 fix round 1: Retry from the control makes one request and leaves the reader on card 31, focus on its card; nothing loads at card 24', async ({ page }) => {
  test.setTimeout(180_000);
  const { feedLock } = await import('./feed-lock.ts');
  const release = await feedLock('exclusive');
  const fx = await pagingFixture();
  try {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.emulateMedia({ colorScheme });
      let fail = true;
      const posts: string[] = [];
      await page.route('**/*', (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        posts.push(route.request().url());
        return fail ? route.abort() : route.continue();
      });
      await page.goto('/');
      const rows = page.locator('.feed > .row');
      await expect(rows).toHaveCount(30);
      await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached(); // hydrated
      // Card 24 snapped to the top: card 25 only touches the feed's bottom edge, so nothing loads (it loaded here before).
      await rows.nth(23).evaluate((el) => el.scrollIntoView());
      await page.waitForTimeout(500);
      expect(posts).toEqual([]);
      await rows.nth(24).evaluate((el) => el.scrollIntoView());
      const status = page.locator('.feed-more [role="status"]');
      await expect(status).toHaveText('Couldn\u2019t load more. Retry');
      expect(posts).toHaveLength(1);
      // The reader goes to the control and retries by keyboard.
      await page.locator('main.feed').evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await expect.poll(() => controlInView(page)).toBe(true);
      fail = false;
      await status.getByRole('button', { name: 'Retry' }).focus();
      await page.keyboard.press('Enter');
      await expect(rows).toHaveCount(60);
      await page.waitForTimeout(2_000); // a chain would fire within this
      expect(posts).toHaveLength(2); // the failed one, then exactly one for Retry
      await expect(rows).toHaveCount(60);
      expect(await atTop(page)).toBe(30); // card 31
      await expect(rows.nth(30).locator('.card .who')).toBeFocused();
      // Fix round 2 (UX follow-up 2): the live line names the positions, so every append reads differently.
      await expect(page.locator('.feed > p[aria-live="polite"]')).toHaveText('Trades 31 to 60 loaded');
      await page.screenshot({ path: `${PR1_SHOTS}/after-retry-375-${colorScheme}.png` });
      await page.unroute('**/*');
    }
  } finally {
    await fx.remove();
    await release();
  }
});

// Fix round 2 (tester B, UX follow-up 1): with a fast server, page 2 arrives while End's smooth scroll is still on its way
// (card 25 passed, the control not yet in view), so nothing pins; the scroll then stopped at the old end, between cards
// 30 and 31, unsnapped. Now the reader comes to rest on card 31. The request is not held here (that is the other test).
test('F-2 PR-1 fix round 2: End or a smooth scroll to the end with a fast server comes to rest on card 31, not between 30 and 31; the live line changes per page; page 1 has an h1', async ({ page }) => {
  test.setTimeout(240_000);
  const { feedLock } = await import('./feed-lock.ts');
  const release = await feedLock('exclusive');
  const fx = await pagingFixture();
  try {
    const cases = [[375, 'light', 'end'], [375, 'dark', 'end'], [1280, 'dark', 'end'], [375, 'light', 'smooth'], [1280, 'light', 'smooth']] as const;
    for (const [width, colorScheme, how] of cases) {
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'no-preference' });
      const posts: string[] = [];
      page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });
      await page.goto('/');
      const rows = page.locator('.feed > .row');
      await expect(rows).toHaveCount(30);
      await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached(); // hydrated
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Trade feed');
      await rows.nth(2).evaluate((el) => el.scrollIntoView());
      await rows.nth(2).locator('.card .who').focus({ preventScroll: true } as never);
      if (how === 'end') await page.keyboard.press('End');
      else await page.locator('main.feed').evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
      await expect(rows).toHaveCount(60);
      // At rest: one request, card 31 exactly at the top (never card 30's lower part over card 31's name).
      await expect.poll(() => atTop(page), { timeout: 5_000 }).toBe(30);
      await page.waitForTimeout(1_500);
      expect(await atTop(page)).toBe(30);
      expect(posts).toHaveLength(1);
      await expect(page.locator('.feed > p[aria-live="polite"]')).toHaveText('Trades 31 to 60 loaded');
      await page.screenshot({ path: `${PR1_SHOTS}/end-fast-server-${how}-${width}-${colorScheme}.png` });
      // Reading on: page 3 at its card 25, and the live line changes (the same text twice is not announced again).
      await rows.nth(54).evaluate((el) => el.scrollIntoView());
      await expect(rows).toHaveCount(90);
      await expect(page.locator('.feed > p[aria-live="polite"]')).toHaveText('Trades 61 to 90 loaded');
      expect(posts).toHaveLength(2);
      page.removeAllListeners('request');
    }
  } finally {
    await fx.remove();
    await release();
  }
});

test('F-2 PR-1 fix round 1: a jump to the control while page 2 is on its way makes one request and lands on card 31; "Loading…" shows meanwhile', async ({ page, request }) => {
  test.setTimeout(180_000);
  const { feedLock } = await import('./feed-lock.ts');
  const release = await feedLock('exclusive');
  const fx = await pagingFixture();
  try {
    for (const [width, colorScheme] of [[375, 'light'], [375, 'dark'], [1280, 'dark']] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ colorScheme });
      const posts: string[] = [];
      let hold = true;
      await page.route('**/*', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        posts.push(route.request().url());
        while (hold) await new Promise((r) => setTimeout(r, 50));
        return route.continue();
      });
      await page.goto('/');
      const rows = page.locator('.feed > .row');
      await expect(rows).toHaveCount(30);
      await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached();
      // From card 3 straight to the end (End, a fling): the control comes into view and asks for page 2, once.
      await rows.nth(2).evaluate((el) => el.scrollIntoView());
      await page.locator('main.feed').evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await expect.poll(() => posts.length).toBe(1);
      await expect(page.locator('.feed-more a')).toHaveText('Loading\u2026');
      await expect(page.locator('.feed-more a')).toHaveAttribute('aria-busy', 'true');
      // Fix round 2 (UX follow-up 4): "Loading…" is drawn as a state (no fill), not as a button to press.
      expect(await page.locator('.feed-more a').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
      if (width === 375) await page.screenshot({ path: `${PR1_SHOTS}/loading-375-${colorScheme}.png` });
      expect(await controlInView(page)).toBe(true); // the reader is at the control as the page arrives
      hold = false;
      await expect(rows).toHaveCount(60);
      await page.waitForTimeout(2_000);
      expect(posts).toHaveLength(1);
      await expect(rows).toHaveCount(60);
      expect(await atTop(page)).toBe(30); // card 31, the first new card
      await page.screenshot({ path: `${PR1_SHOTS}/after-jump-${width}-${colorScheme}.png` });
      // Reading on from there loads page 3 at its card 25, once.
      await rows.nth(54).evaluate((el) => el.scrollIntoView());
      await expect(rows).toHaveCount(90);
      expect(posts).toHaveLength(2);
      await page.unroute('**/*');
    }
    // Without JavaScript, page 2 says where it starts (a visually hidden heading).
    const html = await (await request.get('/')).text();
    const next = /href="\/\?after=([A-Za-z0-9_-]+)"/.exec(html)![1];
    expect(await (await request.get(`/?after=${next}`)).text()).toContain('<h1 class="sr-only">Trades 31 to 60</h1>');
  } finally {
    await fx.remove();
    await release();
  }
});
