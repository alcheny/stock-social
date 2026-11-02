// FIXES-CYCLE5 part 2 against the running app (docs/features/logs/fixes-cycle5/plan-part2-round1.md, committee round 2):
// MK-P6 (/how sentence), C5-41 (Record tools pitch and cards), C5-4 (zero-width "Too early to tell" on every surface)
// and C5-34 (the owner's preview is the picture Share attaches). Two fictional traders, ten non-overlapping closes each
// of +1.0% (ZWGN) and -1.0% (ZWLS), deleted before and after. Their closes are feed-eligible, so the spec holds the
// shared feed lock (e2e/feed-lock.ts). The /t parts read app/t/ticker-sql.ts, which WP3 rewrites: re-run them after it.
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const DAY = 86_400_000;
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const tag = `zw${Date.now().toString(36).slice(-5)}`;
const GAIN = `${tag}_g`, LOSS = `${tag}_l`, VIEWER = `${tag}_v`;
const HANDLES = [GAIN, LOSS, VIEWER];
// Ten closes in October 2026, one every 2 days, each held one day: ten independent bets.
const START = Date.UTC(2026, 9, 2);
const YM = '2026-10';
const VERDICT = /Past results:|above zero|below zero|\bunclear\b/;
const HISTORY = "Trades from before the earliest date the trader's broker provides: they are not imported, so a record can start later than the trader's first trade, and a sell of shares bought before that date is excluded and counted as a sell with no recorded entry.";
const PITCH = "Compare whole public records side by side: closed trades imported from connected accounts, losses and ranges included. Traders can't remove single trades.";
const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
let release: (() => Promise<void>) | null = null;

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 360, height: 740 } });

async function signIn(page: Page, h: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(h);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${h}$`));
  return (await sql`select id, signup_attempt_id from users where handle = ${h}`)[0] as { id: number; signup_attempt_id: number };
}
async function seedTrader(page: Page, h: string, symbol: string, r: number) {
  const u = await signIn(page, h);
  await sql`insert into closed_trades ${sql(Array.from({ length: 10 }, (_, i) => ({
    user_id: u.id, sell_id: `${h}-${i}`, account_id: 'zw', symbol, opened_at: new Date(START + i * 2 * DAY), closed_at: new Date(START + (i * 2 + 1) * DAY),
    return_pct: r, holding_days: 1, verified: true,
  })))}`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now(), now())`;
  await sql`update users set snaptrade_user_id = ${`e2e-${h}`}, last_synced_at = now(), share_prompt_seen_at = now(), trades_prompt_seen_at = now() where id = ${u.id}`;
  return u;
}
const textOf = async (page: Page) => (await page.locator('main').innerText()).replace(/\s+/g, ' ');

test.beforeAll(async ({ browser }) => {
  release = await feedLock('shared');
  await sql`delete from users where handle in ${sql(HANDLES)}`;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await seedTrader(page, GAIN, 'ZWGN', 0.01);
  await ctx.clearCookies();
  await seedTrader(page, LOSS, 'ZWLS', -0.01);
  await ctx.close();
});
test.afterAll(async () => {
  await sql`delete from users where handle in ${sql(HANDLES)}`;
  await sql.end({ timeout: 1 });
  await release?.();
});

test('MK-P6: signed out, /how lists the history sentence under "What is excluded, and counted"', async ({ page }) => {
  await page.goto('/how');
  const list = page.locator('h2', { hasText: 'What is excluded, and counted' }).locator('xpath=following-sibling::ul[1]');
  await expect(list.locator('li', { hasText: HISTORY })).toHaveCount(1);
  await expect(list.locator('li', { hasText: HISTORY })).toHaveText(HISTORY);
});

test('C5-41: signed out, /tools shows the pitch, the disclaimer and the /how link', async ({ page }) => {
  await page.goto('/tools');
  const main = page.locator('main');
  // The pitch shows while checkout is closed (plan D8); with billing on it is the Subscribe screen.
  if (await main.getByText(PITCH).count()) await expect(main.getByText(PITCH)).toBeVisible();
  else test.info().annotations.push({ type: 'note', description: 'billing on: the pitch is not shown beside checkout (D8)' });
  await expect(main.locator('.rt-disclaimer')).toContainText(DISCLAIMER);
  await expect(main.locator('.rt-disclaimer').getByRole('link', { name: 'How records are calculated' })).toHaveAttribute('href', '/how');
});

test('C5-41 C7: Record tools cards: the zero-width record says "Too early to tell", no verdict, no blank range; a demo card is badged; every card shows its losses', async ({ page }) => {
  const v = await signIn(page, VIEWER);
  await sql`insert into connections (attempt_id, user_id, state, consent_at) values (${v.signup_attempt_id}, ${v.id}, 'connected', now())`; // a trader: Record tools included
  const [demo] = await sql`select u.id, u.handle from users u where exists (select 1 from activities a where a.user_id = u.id and a.source = 'demo') and u.deleted_at is null order by u.handle limit 1`;
  const ids = (await sql`select id, handle from users where handle in ${sql([GAIN, LOSS])} order by handle`).map((r) => r.id as number);
  const [view] = await sql`insert into record_views (owner_id, name) values (${v.id}, 'Zero width') returning id`;
  const members = [...ids, ...(demo ? [demo.id as number] : [])];
  await sql`insert into record_view_traders ${sql(members.map((id, i) => ({ view_id: view.id, trader_id: id, position: i })))}`;
  await page.goto(`/tools?view=${view.id}`);
  const cards = page.locator('li.rt-card');
  await expect(cards).toHaveCount(members.length);
  for (const h of [GAIN, LOSS]) {
    const card = cards.filter({ has: page.locator(`a[href="/u/${h}"]`) });
    const t = (await card.innerText()).replace(/\s+/g, ' ');
    expect(t).toContain('Too early to tell');
    expect(t).not.toMatch(VERDICT);
    expect(t).not.toMatch(/of 5 bets|\(\s*\)|\+1\.0% to \+1\.0%|-1\.0% to -1\.0%/);
    await expect(card.locator('dt', { hasText: '95% range' })).toHaveCount(0); // omitted, not blank
    await expect(card.locator('dt', { hasText: 'Win rate' })).toHaveCount(1);
    await expect(card.locator('dt', { hasText: 'Evidence' }).locator('xpath=following-sibling::dd[1]')).toHaveText(/^Too early to tell \(10 bets\)$/);
  }
  if (demo) {
    const card = cards.filter({ has: page.locator(`a[href="/u/${demo.handle}"]`) });
    await expect(card.getByText('Demo', { exact: true }).first()).toBeVisible();
    await expect(card.locator('dt', { hasText: 'Win rate' })).toHaveCount(1);
    await expect(card.locator('dt', { hasText: 'Max drawdown' })).toHaveCount(1); // the loss figure
  }
  await page.context().clearCookies();
});

for (const [h, symbol] of [[GAIN, 'ZWGN'], [LOSS, 'ZWLS']] as const) {
  test(`C5-4 (${symbol}): profile, pane, trade and month pages read "Too early to tell" and carry no verdict`, async ({ page, request }) => {
    await page.goto(`/u/${h}`);
    const main = await textOf(page);
    expect(main.match(/Too early to tell/g)?.length, main).toBe(1);
    expect(main).not.toMatch(VERDICT);
    expect(main).not.toMatch(/\+1\.0% to \+1\.0%|-1\.0% to -1\.0%|of 5 bets/);
    const desc = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
    expect(desc).not.toMatch(VERDICT);
    const pane = await (await request.get(`/u/${h}/pane?v=2`)).json();
    expect(pane.model.rangeLine).toBe('Too early to tell');
    expect(JSON.stringify(pane)).not.toMatch(VERDICT);

    for (const path of [`/u/${h}/trade/${h}-9`, `/u/${h}/month/${YM}`]) {
      await page.goto(path);
      const strip = page.locator('[data-strip]').first();
      await expect(strip).toContainText('Too early to tell');
      const t = await textOf(page);
      expect(t, path).not.toMatch(VERDICT);
      expect(t, path).not.toMatch(/\+1\.0% to \+1\.0%|-1\.0% to -1\.0%/);
      for (const sel of ['meta[name="description"]', 'meta[property="og:description"]']) {
        const d = (await page.locator(sel).first().getAttribute('content')) ?? '';
        expect(d, `${path} ${sel}`).not.toMatch(VERDICT);
      }
    }
    for (const path of [`/u/${h}/opengraph-image`, `/u/${h}/story?format=square`, `/u/${h}/trade/${h}-9/opengraph-image`, `/u/${h}/month/${YM}/opengraph-image`]) {
      const r = await request.get(path);
      expect(r.status(), path).toBe(200);
      expect(r.headers()['content-type'], path).toContain('image/png');
    }
  });
}

test('C5-4 /t (re-run after WP3): /t/ZWGN and /t/compare print "Too early to tell" in the range slot, never "of 5 bets"', async ({ page }) => {
  await page.goto('/t/ZWGN');
  await expect(page.locator('.ticker-stats .range')).toHaveText('Too early to tell');
  let t = await textOf(page);
  expect(t).not.toMatch(/of 5 bets|Past results:|\+1\.0% to \+1\.0%/);
  const d = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
  expect(d).toMatch(/Evidence: too early$/);
  await page.goto('/t/compare?a=ZWGN&b=ZWLS');
  await expect(page.locator('.stat .range')).toHaveText(['Too early to tell', 'Too early to tell']);
  t = await textOf(page);
  expect(t).not.toMatch(/of 5 bets|Past results:|\+1\.0% to \+1\.0%|-1\.0% to -1\.0%/);
});

// ---- C5-34: the owner's preview is the picture Share attaches ----

const stubShare = (page: Page) => page.addInitScript(() => {
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} });
});
const storyRequests = (page: Page) => {
  const urls: string[] = [];
  page.on('request', (r) => { if (/\/story\b/.test(new URL(r.url()).pathname)) urls.push(r.url()); });
  return urls;
};

test('C5-34 Share box: the preview src is the image the Share button attaches; lazy, sized, described; no layout shift', async ({ page, baseURL }) => {
  await signIn(page, GAIN);
  await stubShare(page);
  const urls = storyRequests(page);
  await page.goto(`/u/${GAIN}`);
  const box = page.getByRole('region', { name: 'Share your record' });
  const img = box.locator('img.preview');
  await expect(img).toHaveAttribute('src', `/u/${GAIN}/story?format=square`);
  await expect(img).toHaveAttribute('loading', 'lazy');
  await expect(img).toHaveAttribute('width', '1080');
  await expect(img).toHaveAttribute('height', '1080');
  const alt = (await img.getAttribute('alt'))!;
  expect(alt).toMatch(/^Preview of your share card\. Trading record card for @/);
  expect(alt).toContain('Too early to tell');
  expect(alt).not.toMatch(VERDICT);
  // The Share button prefetches its picture on mount: the same URL as the preview's src.
  await expect.poll(() => urls.length).toBeGreaterThan(0);
  expect(urls[0]).toBe(new URL(`/u/${GAIN}/story?format=square`, baseURL).href);
  const before = (await box.boundingBox())!.height;
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth)).toBeGreaterThan(0);
  expect(Math.round((await box.boundingBox())!.height)).toBe(Math.round(before));
  expect(urls.every((u) => u === urls[0])).toBe(true);
});

for (const width of [360, 320]) {
  test(`C5-34 at ${width} px: the preview is at most 343 px, inside its box, no page scroll sideways; Tab reaches Share, the image is not focusable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await signIn(page, GAIN);
    await page.goto(`/u/${GAIN}`);
    const box = page.getByRole('region', { name: 'Share your record' });
    const img = box.locator('img.preview');
    await img.scrollIntoViewIfNeeded();
    const b = (await box.boundingBox())!, i = (await img.boundingBox())!;
    expect(i.width).toBeLessThanOrEqual(343);
    expect(i.x).toBeGreaterThanOrEqual(b.x);
    expect(i.x + i.width).toBeLessThanOrEqual(b.x + b.width + 0.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(await img.evaluate((e) => e.tabIndex)).toBe(-1);
    const share = box.getByRole('button', { name: 'Share my record' });
    let reached = false;
    for (let k = 0; k < 80 && !reached; k++) {
      await page.keyboard.press('Tab');
      reached = await share.evaluate((e) => e === document.activeElement);
      expect(await img.evaluate((e) => e === document.activeElement)).toBe(false);
    }
    expect(reached).toBe(true);
    expect(await share.evaluate((e) => e.matches(':focus-visible'))).toBe(true);
  });
}

test('C5-34 post-connect prompt: the same src, eager, the same request; at 360 x 640 "Share my record" is in view with the heading', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await signIn(page, GAIN);
  await sql`update users set share_prompt_seen_at = null where handle = ${GAIN}`;
  await stubShare(page);
  const urls = storyRequests(page);
  await page.goto(`/u/${GAIN}`);
  const prompt = page.locator('section.share-prompt', { has: page.getByRole('heading', { name: 'Your record is live.' }) });
  const img = prompt.locator('img.preview');
  await expect(img).toHaveAttribute('src', `/u/${GAIN}/story?format=square`);
  await expect(img).toHaveAttribute('loading', 'eager');
  await expect.poll(() => urls.length).toBeGreaterThan(0);
  expect(new Set(urls)).toEqual(new Set([new URL(`/u/${GAIN}/story?format=square`, baseURL).href]));
  await prompt.getByRole('heading', { name: 'Your record is live.' }).evaluate((e) => e.scrollIntoView({ block: 'start' }));
  const share = prompt.getByRole('button', { name: 'Share my record' });
  const s = (await share.boundingBox())!;
  expect(s.y).toBeGreaterThanOrEqual(0);
  expect(s.y + s.height).toBeLessThanOrEqual(640);
  await sql`update users set share_prompt_seen_at = now() where handle = ${GAIN}`;
});

test('C5-34 signed out: no preview on the profile and no request for the picture', async ({ page }) => {
  const urls = storyRequests(page);
  await page.goto(`/u/${GAIN}`);
  await expect(page.locator('img.preview')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(urls).toEqual([]);
});

test('C5-34 fallback: when the picture fails, the box says so and Share still works', async ({ page }) => {
  await signIn(page, GAIN);
  await page.route('**/story?format=square', (r) => r.fulfill({ status: 500, body: 'no' }));
  await page.goto(`/u/${GAIN}`);
  const box = page.getByRole('region', { name: 'Share your record' });
  await box.scrollIntoViewIfNeeded();
  await expect(box.getByText('Preview unavailable. Your link still works.')).toBeVisible();
  await expect(box.getByRole('button', { name: 'Share my record' })).toBeEnabled();
});
