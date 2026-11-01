// A11Y-FIXES group 3 (approval council "Fixes to build now" #5, #10, #20, #21) against the running app. Its own fixture
// trader (`a11y_share`), deleted before and after; its closes are 40+ days old and fewer than five, so it never takes
// a feed card and needs no feed lock.
import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { PUBLIC_SCOPE, TITLES } from '../lib/copy.ts';

const DAY = 86_400_000;
const HANDLE = 'a11y_share';
const NAME = 'Ally Share';
const THESIS = 'Margins widened two quarters in a row.';
// Own pool (as app.spec.ts and connect.spec.ts).
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 360, height: 800 } });

test.beforeAll(async () => { await sql`delete from users where handle = ${HANDLE}`; });
test.afterAll(async () => {
  await sql`delete from users where handle = ${HANDLE}`;
  await sql.end({ timeout: 1 });
});

test('#5 (committee B2): the share prompt\'s "Public:" list names everything a signed-out profile renders', async ({ page, context }) => {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(HANDLE);
  await page.getByLabel('Display name').fill(NAME);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${HANDLE}$`));
  const [u] = await sql`select id, signup_attempt_id from users where handle = ${HANDLE}`;
  await sql`insert into closed_trades ${sql([0.12, -0.07].map((r, i) => ({
    user_id: u.id, sell_id: `${HANDLE}-${i}`, account_id: 'a', symbol: i ? 'A11B' : 'A11A', opened_at: new Date(Date.now() - (42 + i) * DAY),
    closed_at: new Date(Date.now() - (40 + i) * DAY), return_pct: r, holding_days: 2, verified: true,
    thesis: i ? null : THESIS, thesis_status: i ? null : 'published',
  })))}`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now())`;
  await sql`insert into open_positions (user_id, account_id, symbol, unrealized_pct, fetched_at) values (${u.id}, 'a', 'A11C', 0.05, now())`;
  await sql`update users set snaptrade_user_id = ${'e2e-' + Date.now()}, last_synced_at = now(), share_prompt_seen_at = null where id = ${u.id}`;

  await page.goto(`/u/${HANDLE}`);
  const prompt = page.locator('section.share-prompt');
  await expect(prompt.getByText(PUBLIC_SCOPE.share, { exact: true })).toBeVisible();
  const list = PUBLIC_SCOPE.share;
  await expect(prompt).not.toContainText('each closed trade');

  // What a signed-out visitor sees on the same profile; each kind of public fact is named in the prompt's list.
  await context.clearCookies();
  await page.goto(`/u/${HANDLE}`);
  await expect(page.locator('section.share-prompt')).toHaveCount(0);
  const main = page.locator('main');
  const seen: [string, () => Promise<void>][] = [
    ['handle', () => expect(main).toContainText(`@${HANDLE}`)],
    ['name', () => expect(main.getByRole('heading', { level: 1 })).toContainText(NAME)],
    ['symbol', () => expect(main).toContainText('A11A')],
    ['dates', () => expect(main.getByText(/Record since [A-Z][a-z]{2} \d{1,2}, \d{4}/)).toBeVisible()],
    ['percent return', () => expect(main).toContainText('+12.0%')],
    ['losses included', () => expect(main).toContainText('-7.0%')],
    ['open positions', () => expect(main).toContainText('A11C')],
    ['thesis', () => expect(main).toContainText(THESIS)],
  ];
  for (const [word, check] of seen) {
    expect(list, word).toContain(word);
    await check();
  }
  // And no amount is on the page (the list says quantities, prices, fees and balances are never public).
  expect(await main.innerText()).not.toMatch(/\$\s?\d/);
});

test('#5 (committee B1): the join call to action on a signed-out profile, verbatim', async ({ page }) => {
  await page.goto(`/u/${HANDLE}`);
  const join = page.getByRole('complementary', { name: 'Publish your own record' });
  await expect(join).toContainText(`${PUBLIC_SCOPE.joinLead} ${PUBLIC_SCOPE.join}`);
  await expect(join).not.toContainText(/only percentages/i);
});

test('#10: a demo profile says demo data and never mentions connected accounts', async ({ page }) => {
  await page.goto('/u/momentum_maya');
  await expect(page.getByText(/Demo data, not a real broker record\./)).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/connected accounts/i);
});

test('#20: the routes that inherited "Stock Social" each have their own title', async ({ page }) => {
  const routes: [string, string][] = [
    ['/login', TITLES.login], ['/login/sent', TITLES.loginSent], ['/login/dev', TITLES.loginDev], ['/connect', TITLES.connect],
    ['/connect/continue', TITLES.continue], ['/terms', TITLES.terms], ['/privacy', TITLES.privacy], ['/no-such-page', TITLES.notFound],
  ];
  const seen = new Set<string>();
  for (const [path, title] of routes) {
    await page.goto(path);
    await expect(page, path).toHaveTitle(title);
    seen.add(await page.title());
  }
  expect(seen.size).toBe(routes.length);
  expect(seen.has('Stock Social')).toBe(false);
});

test('#21: an unknown URL is a real 404 with a main landmark, one h1 and links to Feed, Trades by stock and How', async ({ page, request }) => {
  expect((await request.get('/no-such-page')).status()).toBe(404);
  expect((await request.get('/t/%3Cscript%3E')).status()).toBe(404);
  await page.goto('/no-such-page');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(main.getByRole('link', { name: 'Feed', exact: true })).toHaveAttribute('href', '/');
  await expect(main.getByRole('link', { name: 'Trades by stock', exact: true })).toHaveAttribute('href', '/t');
  await expect(main.getByRole('link', { name: 'How records are calculated', exact: true })).toHaveAttribute('href', '/how');
});
