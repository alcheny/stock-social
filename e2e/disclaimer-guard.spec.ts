// Fix #2 (approval council cycle 2, POLICY F3, D20): every performance route in the app tree (lib/disclaimer-routes.ts,
// whose unit test fails on any unclassified route) shows the exact disclaimer in plain view at 360 px: every line marked
// data-disclaimer has the exact text, the one nearest the route's first figures shares one screen with them between the
// fixed bars, and no element covers any of them. Every share image returns a PNG. Routes still owned by F-10/F-12 run
// under test.fail(): when their PR adds the line the test passes unexpectedly and CI makes that PR move the entry.
// Fixtures are this file's own (a dev user, its like, a trader with an open position); nothing else is touched.
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { routesOf } from '../lib/disclaimer-routes.ts';
import { DISCLAIMER } from '../lib/share.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const tag = `dg${Math.random().toString(36).slice(2, 8)}`;
const viewer = `${tag}v`, openTrader = `${tag}o`;
const DAY = 86_400_000;

let releaseFeed: (() => Promise<void>) | null = null;
test.beforeAll(async () => {
  releaseFeed = await feedLock('shared'); // the open-positions trader is feed-eligible
  const [u] = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${openTrader}, 'Guard Open', now(), a.id from a
    returning id, signup_attempt_id`;
  await sql`insert into closed_trades ${sql([0.12, -0.08, 0.05].map((r, i) => ({
    user_id: u.id, sell_id: `${tag}-${i}`, account_id: 'a', symbol: `DG${i}`, opened_at: new Date(Date.now() - (40 + i) * DAY),
    closed_at: new Date(Date.now() - (30 + i) * DAY), return_pct: r, holding_days: 10, verified: true })))}`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now())`;
  await sql`insert into open_positions (user_id, account_id, symbol, unrealized_pct, fetched_at) values (${u.id}, 'a', 'DGO', 0.07, now())`;
});
test.afterAll(async () => {
  await sql`delete from users where handle in (${viewer}, ${openTrader})`;
  await sql.end({ timeout: 1 });
  await releaseFeed?.();
});

async function signIn(page: Page) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(viewer);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${viewer}$`));
  // One like of a seeded trade, so /me/likes has figures.
  await sql`insert into trade_likes (viewer_id, trade_key, trader_id)
    select v.id, t.trade_key, t.user_id from users v, closed_trades t join users u on u.id = t.user_id
    where v.handle = ${viewer} and u.handle = 'momentum_maya' order by t.closed_at desc limit 1 on conflict do nothing`;
}

// Geometry of the disclaimer nearest the anchor: the span both take, the room between fixed bars, and what covers any line.
async function geometry(page: Page, anchor: string) {
  return page.evaluate(({ anchor }) => {
    const a = document.querySelector(anchor)!.getBoundingClientRect();
    const lines = [...document.querySelectorAll('[data-disclaimer]')];
    const dist = (r: DOMRect) => Math.max(0, r.top - a.bottom, a.top - r.bottom);
    const near = lines.map((el) => el.getBoundingClientRect()).sort((x, y) => dist(x) - dist(y))[0];
    const bars = [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el);
      return ['fixed', 'sticky'].includes(cs.position) && cs.visibility !== 'hidden' && cs.display !== 'none' && !lines.some((l) => el.contains(l));
    }).map((el) => ({ el: `${el.tagName.toLowerCase()}.${String(el.className)}`, r: el.getBoundingClientRect() })).filter((b) => b.r.width > 0 && b.r.height > 0);
    const top = Math.max(0, ...bars.filter((b) => b.r.top <= 0 && b.r.bottom < innerHeight / 2).map((b) => b.r.bottom));
    const bottom = Math.max(0, ...bars.filter((b) => b.r.bottom >= innerHeight && b.r.top > innerHeight / 2).map((b) => innerHeight - b.r.top));
    return { span: Math.max(a.bottom, near.bottom) - Math.min(a.top, near.top), room: innerHeight - top - bottom };
  }, { anchor });
}

// Each line, centred on screen: in view and the top element at five points of its box is the line itself (no cover).
async function uncovered(page: Page) {
  const lines = page.locator('[data-disclaimer]');
  for (let i = 0; i < await lines.count(); i++) {
    const line = lines.nth(i);
    await line.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(line).toBeInViewport({ ratio: 1 });
    const covers = await line.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const pts = [[0.5, 0.5], [0.1, 0.25], [0.9, 0.25], [0.1, 0.75], [0.9, 0.75]].map(([x, y]) => [r.left + r.width * x, r.top + r.height * y]);
      return pts.map(([x, y]) => document.elementFromPoint(x, y)).filter((hit) => !hit || !el.contains(hit)).map((hit) => hit?.outerHTML.slice(0, 80) ?? 'nothing');
    });
    expect(covers, `disclaimer ${i} is covered`).toEqual([]);
  }
}

async function check(page: Page, url: string, anchor: string) {
  const res = await page.goto(url);
  expect(res?.status(), url).toBe(200);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  const lines = page.locator('[data-disclaimer]');
  expect(await lines.count(), `${url}: no disclaimer line`).toBeGreaterThan(0);
  for (const t of await lines.allTextContents()) expect(t.trim()).toBe(DISCLAIMER); // the footer's longer copy is unmarked
  await expect(page.locator(anchor).first()).toBeVisible();
  const g = await geometry(page, anchor);
  expect(g.span, `${url}: figures and disclaimer take ${g.span}px, screen has ${g.room}px`).toBeLessThanOrEqual(g.room);
  await uncovered(page);
}

test.describe('disclaimer guard at 360 px', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const [pattern, r] of routesOf('performance')) {
    test(`${pattern}: exact disclaimer beside the first figures, uncovered`, async ({ page }) => {
      if (r.signedIn) await signIn(page);
      await check(page, r.sample, r.anchor);
    });
  }

  // The profile with open positions: the longest headline group (realized, unrealized, combined, evidence).
  test('/u/[handle] with open positions: disclaimer still beside the figures', async ({ page }) => {
    await check(page, `/u/${openTrader}`, 'section.stats');
    await expect(page.locator('[data-open]').first()).toBeVisible();
  });

  for (const [pattern, r] of routesOf('image')) {
    test(`${pattern}: share image renders`, async ({ request }) => {
      const res = await request.get(r.sample);
      expect(res.status(), r.sample).toBe(200);
      expect(res.headers()['content-type']).toContain('image/png');
    });
  }

  // Pending pages (F-10, F-12): expected to fail until their PR adds the line, then CI forces the entry to move.
  for (const [pattern, r] of routesOf('pending').filter(([, r]) => r.anchor)) {
    test(`pending ${r.owner} ${pattern}: no disclaimer beside the figures yet`, async ({ page }) => {
      test.fail(true, `ponytail: ${r.ponytail}`);
      let url = r.sample;
      if (!url) {
        const [t] = await sql`select t.sell_id, to_char(t.closed_at at time zone 'UTC', 'YYYY-MM') as ym from closed_trades t join users u on u.id = t.user_id
          where u.handle = 'momentum_maya' order by t.closed_at desc limit 1`;
        url = pattern.includes('/trade/') ? `/u/momentum_maya/trade/${encodeURIComponent(t.sell_id)}` : `/u/momentum_maya/month/${t.ym}`;
      }
      await check(page, url, r.anchor!);
    });
  }
});
