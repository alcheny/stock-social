// F-16 engineer C (plan docs/features/logs/F-16-F-17/plan.md §2.1–§2.4, §5.4, §5.7, §8 #10, #13, #14; v2 B1, B4, B6,
// B7; Q9; E16; §R3): the UI slice on the production build at 360×740.
// - Profile: the anti-impersonation line is the last thing in <main> and the footer's F3 disclaimer is in view beside
//   it; the quiet "…" menu leads to the report page, signed out too (B6); your own profile has no menu.
// - Pane: the line and its disclaimer under an open feed pane (B1).
// - /takedown in the sandbox: own title, the draft banner, no address while TAKEDOWN_CONTACT is unset.
// - Hidden trader (Q9, B4): their own 404 carries one private neutral line; a signed-out response lacks it; both are
//   `private, no-store`; neither says "reported" or "review".
// - Rename (E16): the "New handle" label is visible, the 30-day rule is shown, a rejection is beside the field.
// Fixture rows are this file's own (tagged handles), removed by id at the end.
import { expect, test, type Page } from '@playwright/test';
import { feedLock } from './feed-lock.ts';

const TRUST = "Stock Social never messages anyone about a trading record. Anyone who contacts you elsewhere using this profile isn't acting for Stock Social.";
const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
const rand = () => Math.random().toString(36).slice(2, 8);

async function signIn(page: Page, handle: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
}
const inView = (page: Page, sel: string) => page.locator(sel).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
});
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function makeUser(sql: import('postgres').Sql, handle: string, hidden = false): Promise<{ id: number; attempt: number }> {
  const [u] = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id, hidden_at)
    select ${handle}, ${handle}, now(), a.id, ${hidden ? new Date() : null} from a returning id, signup_attempt_id`;
  return { id: u.id as number, attempt: u.signup_attempt_id as number };
}
async function cleanup(sql: import('postgres').Sql, tag: string) {
  const rows = await sql`select id, signup_attempt_id from users where handle like ${`${tag}%`}`;
  const ids = rows.map((r) => r.id as number);
  const attempts = (await sql`select id from signup_attempts where user_id = any(${ids}) union select unnest(${rows.map((r) => r.signup_attempt_id as number)}::int[])`).map((r) => r.id as number);
  await sql`delete from users where id = any(${ids})`;
  await sql`delete from signup_attempts a where a.id = any(${attempts}) and not exists (select 1 from funnel_events f where f.attempt_id = a.id)`;
}

test('F-16 profile and pane: the line with the F3 disclaimer in view at 360 px; the quiet menu reaches the report page signed out; none on your own profile', async ({ page }) => {
  test.setTimeout(120_000);
  const release = await feedLock('shared'); // reads the demo records' feed cards
  const sql = (await import('postgres')).default(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const tag = `f16p${rand()}`;
  try {
    await page.setViewportSize({ width: 360, height: 740 });
    // Signed out, a demo profile.
    await page.goto('/u/momentum_maya');
    const line = page.locator('main [data-trust-line]');
    await expect(line).toHaveText(TRUST);
    await expect(line).toHaveCount(1);
    // The line is the last thing in <main>; the footer's disclaimer follows directly and both are in view together.
    expect(await page.locator('main').evaluate((m) => m.lastElementChild?.lastElementChild?.matches('[data-trust-line]'))).toBe(true);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await inView(page, 'main [data-trust-line]')).toBe(true);
    await expect(page.locator('footer.site')).toContainText(DISCLAIMER);
    expect(await page.locator('footer.site').evaluate((f) => { const r = f.getBoundingClientRect(); return r.top >= 0 && r.top + 40 <= window.innerHeight; })).toBe(true);
    expect(await noSideScroll(page)).toBe(true);
    // The quiet menu (B6): signed out too, at the end of the page, never in the header or beside Follow or Share.
    await expect(page.locator('main .f16-block summary[aria-label="More for @momentum_maya"]')).toHaveCount(1);
    await expect(page.locator('main > h1 ~ p .profile-report, .profile-follow .profile-report')).toHaveCount(0);
    await page.locator('main .f16-block summary').click();
    const item = page.getByRole('link', { name: 'Report this profile' });
    await expect(item).toBeVisible();
    expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await noSideScroll(page)).toBe(true);
    await item.click();
    await expect(page).toHaveURL(/\/u\/momentum_maya\/report$/);
    await expect(page).toHaveTitle('Report @momentum_maya · Stock Social');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Report this profile');
    await expect(page.locator('main')).toContainText('Sign in to report this profile.');
    await expect(page.locator('main input[type="radio"]')).toHaveCount(0);
    // Fix round 2 (UX6, the only change here): scoped to <main>, since the footer now links the page too.
    await expect(page.locator('main').getByRole('link', { name: 'Notices and takedown requests' })).toHaveAttribute('href', '/takedown'); // sandbox: reachable
    expect(await noSideScroll(page)).toBe(true);

    // The pane (B1): the line and its disclaimer under an open feed pane, in view at 360 px.
    // Fix round 2 (T3, the only change here): the foot now flows at the end of the pane's content (it moves into the
    // pane once the page runs), so the row is found by a descendant foot and the pane is scrolled to its end first.
    await page.goto('/');
    const row = page.locator('.feed > .row:has(> .pane > .trust-foot)').first();
    await row.evaluate((el) => el.scrollIntoView());
    await row.evaluate((el) => { el.scrollLeft = el.clientWidth; });
    await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(300);
    await row.locator(':scope > .pane').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(row.locator('.trust-foot [data-trust-line]')).toHaveText(TRUST);
    await expect(row.locator('.trust-foot [data-trust-disclaimer]')).toHaveText(DISCLAIMER);
    for (const sel of ['[data-trust-line]', '[data-trust-disclaimer]']) {
      expect(await row.locator(`.trust-foot ${sel}`).evaluate((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth; }), sel).toBe(true);
    }
    // Still two swipe pages: the card and the pane (the foot sits under the pane, never a third page).
    expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth * 2 + 2)).toBe(true);
    await expect(row.locator(':scope > .pane')).toHaveCount(1);

    // Your own profile: the line, no menu; the report page says so neutrally.
    const own = `${tag}o`;
    await signIn(page, own);
    await expect(page.locator('main [data-trust-line]')).toHaveText(TRUST);
    await expect(page.locator('main .profile-report')).toHaveCount(0);
    await page.goto(`/u/${own}/report`);
    await expect(page.locator('main')).toContainText("This is your profile, so you can't report it.");
    await expect(page.locator('main input[type="radio"]')).toHaveCount(0);
  } finally {
    await cleanup(sql, tag);
    await sql.end({ timeout: 1 });
    await release();
  }
});

test('F-16 /takedown in the sandbox: own title, draft banner, one h1, no address while the contact is unset, no legal-status claim', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const res = await page.goto('/takedown');
  expect(res?.status()).toBe(200);
  expect(await page.locator('head title').allTextContents()).toEqual(['Notices and takedown requests · Stock Social']);
  await expect(page.getByRole('note')).toHaveText('Draft: this wording has not been approved yet.');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText('Notices and takedown requests');
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  const main = await page.locator('main').innerText();
  expect(main).not.toMatch(/safe harbou?r|designated agent|\b512\b|within \d+ (hours?|days?)|business days?/i);
  if (!process.env.TAKEDOWN_CONTACT) {
    await expect(page.locator('[data-contact]')).toHaveText('The contact address is not set yet.');
    await expect(page.locator('main a[href^="mailto:"]')).toHaveCount(0);
  }
  expect(await noSideScroll(page)).toBe(true);
});

test('Q9 / B4: the hidden trader sees one private neutral line on their own 404; a signed-out response lacks it; both are private, no-store; no "reported" or "review"', async ({ page, browser }) => {
  const sql = (await import('postgres')).default(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const tag = `f16q${rand()}`;
  const hidden = `${tag}h`;
  try {
    await makeUser(sql, hidden, true);
    await page.setViewportSize({ width: 360, height: 740 });
    // As the trader (the dev form signs in to an existing handle, then lands on the hidden profile's 404).
    await signIn(page, hidden);
    const res = await page.goto(`/u/${hidden}`);
    expect(res?.status()).toBe(404);
    const cc = (res?.headers()['cache-control'] ?? '').toLowerCase();
    expect(cc).toContain('private');
    expect(cc).toContain('no-store');
    expect(await page.locator('head title').allTextContents()).toEqual(['Profile not available · Stock Social']);
    await expect(page.locator('h1')).toHaveCount(1);
    const own = page.locator('[data-own-line]');
    await expect(own).toContainText('not shown to others right now');
    await expect(own.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    await expect(own.getByRole('link', { name: 'Download my data' })).toHaveAttribute('href', '/account/export');
    // Fix round 2 (BL2): the links sit on their own row, out of the sentence, side by side at 360 px.
    await expect(own.locator('p.muted a')).toHaveCount(0);
    const mid = async (name: string) => { const b = (await own.getByRole('link', { name }).boundingBox())!; return b.y + b.height / 2; };
    expect(Math.abs((await mid('Settings')) - (await mid('Download my data')))).toBeLessThanOrEqual(4);
    // Fix round 2 (UX5): the takedown page is reachable from the line (the sandbox: takedownReachable() is true).
    await expect(own.getByRole('link', { name: 'Notices and takedown requests' })).toHaveAttribute('href', '/takedown');
    for (const name of ['Settings', 'Download my data', 'Notices and takedown requests']) {
      expect((await own.getByRole('link', { name }).boundingBox())!.height, name).toBeGreaterThanOrEqual(44);
    }
    const mine = await page.locator('main').innerText();
    expect(mine).not.toMatch(/report|review/i);
    expect(mine).not.toMatch(/%|Verified|Demo/);
    // Signed out, a fresh browser context (no cookies): the same notice without the private line, also no-store.
    const ctx = await browser.newContext({ baseURL: 'http://localhost:3000' });
    try {
      const anon = await ctx.newPage();
      const out = await anon.goto(`/u/${hidden}`);
      expect(out?.status()).toBe(404);
      const occ = (out?.headers()['cache-control'] ?? '').toLowerCase();
      expect(occ).toContain('private');
      expect(occ).toContain('no-store');
      await expect(anon.locator('h1')).toHaveText('Profile not available');
      await expect(anon.locator('[data-own-line]')).toHaveCount(0);
      await expect(anon.locator('main a[href="/takedown"]')).toHaveCount(0); // UX5: the owner's line only
      const html = await out!.text();
      expect(html).not.toContain('data-own-line');
      expect(html).not.toContain('not shown to others right now');
      expect(await anon.locator('main').innerText()).not.toMatch(/report|review/i);
    } finally { await ctx.close(); }
  } finally {
    await cleanup(sql, tag);
    await sql.end({ timeout: 1 });
  }
});

test('E16 / F-17 rename form: the "New handle" label is visible, the 30-day rule shows, and a rejection is beside the field, announced and focused', async ({ page }) => {
  const sql = (await import('postgres')).default(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const tag = `f16r${rand()}`;
  try {
    await page.setViewportSize({ width: 360, height: 740 });
    await signIn(page, `${tag}o`);
    await page.getByText('Change handle').click();
    const field = page.getByLabel('New handle');
    await expect(page.locator('label[for="new-handle"]')).toBeVisible();
    await expect(page.locator('[data-rename-rule]')).toContainText('once every 30 days');
    await field.fill('admin');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\?handle=/);
    const err = page.locator('#handle-err');
    await expect(err).toHaveAttribute('role', 'alert');
    await expect(err).toBeVisible();
    await expect(page.getByLabel('New handle')).toBeFocused();
    await expect(page.getByLabel('New handle')).toHaveAttribute('aria-invalid', 'true');
    expect((await page.getByLabel('New handle').getAttribute('aria-describedby'))?.split(' ')).toContain('handle-err');
    expect(await page.getByLabel('New handle').evaluate((el) => el.nextElementSibling?.id)).toBe('handle-err');
    expect(await inView(page, '#handle-err')).toBe(true);
    expect(await noSideScroll(page)).toBe(true);
  } finally {
    await cleanup(sql, tag);
    await sql.end({ timeout: 1 });
  }
});

// ---- Fix round 2 (tester T3; business lead BL7; UX lead UX6) ----

test('fix round 2 (T3): an open feed pane shows its headline stats uncovered on the first screen; the foot follows the pane content, line and disclaimer together', async ({ page }) => {
  test.setTimeout(120_000);
  const release = await feedLock('shared');
  try {
    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto('/');
      const row = page.locator('.feed > .row:has(> .pane > .trust-foot)').first();
      await expect(row).toHaveCount(1);
      await expect(page.locator('.feed > .row > .trust-foot')).toHaveCount(0); // none left beside a pane
      await row.evaluate((el) => el.scrollIntoView());
      await row.evaluate((el) => { el.scrollLeft = el.clientWidth; });
      await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(width - 60);
      const pane = row.locator(':scope > .pane');
      // The foot is the pane's last element, after "See full profile" and the pane's own last line.
      expect(await pane.evaluate((el) => el.lastElementChild?.classList.contains('trust-foot'))).toBe(true);
      // First screen: nothing is drawn over a headline figure. At 360 px both figures are in view; at 320 px they stack
      // and the pane's own layout puts the second one lower, so there the first is in view and the visible part of any
      // other is uncovered.
      const stats = pane.locator('.stats .stat');
      expect(await stats.count()).toBeGreaterThan(0);
      for (let i = 0; i < await stats.count(); i++) {
        const s = await stats.nth(i).evaluate((el) => {
          const r = el.getBoundingClientRect();
          const bottom = Math.min(r.bottom, window.innerHeight);
          const hit = r.top < window.innerHeight ? document.elementFromPoint(r.left + r.width / 2, (r.top + bottom) / 2) : null;
          return { inView: r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight, shows: r.top < window.innerHeight, free: !!hit && el.contains(hit) };
        });
        if (width === 360 || i === 0) expect(s.inView, `stat ${i} in view at ${width}`).toBe(true);
        if (s.shows) expect(s.free, `stat ${i} uncovered at ${width}`).toBe(true);
      }
      // At the end of the pane: the line with the F3 disclaimer right under it, both in view.
      await pane.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      const box = async (sel: string) => (await pane.locator(`.trust-foot ${sel}`).boundingBox())!;
      const line = await box('[data-trust-line]');
      const disc = await box('[data-trust-disclaimer]');
      expect(line.y >= 0 && disc.y + disc.height <= 740, `in view at ${width}`).toBe(true);
      expect(disc.y - (line.y + line.height)).toBeLessThanOrEqual(12);
      expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth * 2 + 2)).toBe(true);
    }
  } finally { await release(); }
});

test('fix round 2 (BL7, UX6): the profile\'s "…" sits left, on "← Feed"\'s line; the footer links the takedown page in the sandbox', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/u/momentum_maya');
  const menu = page.locator('main .f16-block summary');
  const feed = page.locator('main .f16-block').getByRole('link', { name: '← Feed' });
  await expect(feed).toHaveAttribute('href', '/');
  const m = (await menu.boundingBox())!, f = (await feed.boundingBox())!;
  expect(Math.abs((m.y + m.height / 2) - (f.y + f.height / 2))).toBeLessThanOrEqual(4);
  expect(m.x).toBeGreaterThanOrEqual(f.x + f.width);
  expect(m.x + m.width).toBeLessThanOrEqual(180); // left half, not pushed to the right edge
  await menu.click();
  const item = page.getByRole('link', { name: 'Report this profile' });
  await expect(item).toBeVisible();
  const ib = (await item.boundingBox())!;
  expect(ib.x).toBeGreaterThanOrEqual(0);
  expect(ib.x + ib.width).toBeLessThanOrEqual(360);
  expect(await noSideScroll(page)).toBe(true);
  // UX6: the footer's legal row carries the takedown page while it is reachable (the e2e build is the sandbox).
  const link = page.locator('footer.site nav.legal a[href="/takedown"]');
  await expect(link).toHaveText('Notices and takedown requests');
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
