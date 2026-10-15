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
  expect(body).not.toMatch(/\/t\/[A-Z]/);
  const rb = await request.get('/robots.txt');
  expect(rb.status()).toBe(200);
  const txt = await rb.text();
  expect(txt).toContain('Sitemap:');
  expect(txt).toContain('Disallow: /api');
  expect(txt).toContain('Disallow: /connect');
  expect(txt).not.toContain('Disallow: /t');
});

test('watchlist: signed-in trader watches a symbol and sees it on /t; signed out sees only a sign-in link', async ({ page, browser }) => {
  await page.goto('/login');
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
