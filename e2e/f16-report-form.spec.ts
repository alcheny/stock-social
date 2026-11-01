// F-16 engineer C (plan docs/features/logs/F-16-F-17/plan.md §2.2, §8 #15, #20; v2 B8, B9; K18): the profile report
// form, keyboard only from the profile's quiet menu to "Report sent". At 360×740 "Send report" is in view (at most one
// scroll) and at least 44 px tall. Submitting with nothing chosen names the field (role=alert between the legend and
// the first choice, aria-invalid on every radio, focus on the first); choosing with Space and the arrow keys and sending
// announces "Report sent. Thank you." in a focused role=status.
// ponytail: hand-built accessibility checks stand in for an axe scan (no axe package: a new dependency needing the
// owner's pre-authorization and a LICENSE_REVIEWED entry, plan §0.1) — fix: @axe-core/playwright once authorized; the
// axe acceptance box stays unchecked until then (B9).
// Fixture rows are this file's own (tagged handles), removed by id at the end.
import { expect, test, type Page } from '@playwright/test';

const rand = () => Math.random().toString(36).slice(2, 8);
const LABELS = ['Impersonating this trader elsewhere', 'Pretends to be another person or a company', 'May be under 18',
  'Asks for money or offers a paid service', 'Abusive or hateful name or note', 'Shares someone\'s personal information'];

async function signIn(page: Page, handle: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
}
// Tab until the focused element matches (an aria-label prefix inside a container, or the exact text); false after `max`.
type Want = { label?: string; within?: string; text?: string };
async function tabTo(page: Page, want: Want, max = 120): Promise<boolean> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate((w) => {
      const a = document.activeElement;
      if (!a) return false;
      if (w.within && !a.closest(w.within)) return false;
      if (w.label !== undefined && !(a.getAttribute('aria-label') ?? '').startsWith(w.label)) return false;
      if (w.text !== undefined && a.textContent !== w.text) return false;
      return true;
    }, want);
    if (hit) return true;
  }
  return false;
}
const inView = (page: Page, sel: string) => page.locator(sel).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
});

test('F-16 report form, keyboard only: menu → report page → empty send names the field → choose → sent, announced and focused; 44 px; in view at 360×740', async ({ page }) => {
  test.setTimeout(120_000);
  const sql = (await import('postgres')).default(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const tag = `f16k${rand()}`;
  const target = `${tag}t`, reader = `${tag}r`;
  try {
    await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${target}, ${target}, now(), a.id from a`;
    await page.setViewportSize({ width: 360, height: 740 });
    await signIn(page, reader);
    await page.goto(`/u/${target}`);

    // The quiet menu, by keyboard: Tab to "…", Enter opens it, Tab to the item, Enter follows it.
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    expect(await tabTo(page, { label: 'More for @', within: '.f16-block' })).toBe(true);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Report this profile' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/u/${target}/report$`));

    // The page: its own title, one h1, the legend, six labelled radios (K18: "May be under 18" is one of them).
    await expect(page).toHaveTitle(`Report @${target} · Stock Social`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('fieldset legend')).toHaveText('What is wrong with this profile?');
    for (const l of LABELS) await expect(page.getByLabel(l, { exact: true })).toHaveAttribute('type', 'radio');
    await expect(page.locator('input[type="radio"]')).toHaveCount(6);
    await expect(page.locator('main textarea, main input[type="text"]')).toHaveCount(0); // no free text

    // B8: "Send report" in view at 360×740 (one scroll at most) and at least 44 px tall.
    const send = page.getByRole('button', { name: 'Send report' });
    if (!(await inView(page, 'button.report-send'))) await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight / 2)));
    expect(await inView(page, 'button.report-send')).toBe(true);
    expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // Hand-built checks in place of axe (ponytail above): labels, unique ids, no positive tabindex, 44 px rows, focus ring.
    const audit = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
      const inputs = [...document.querySelectorAll('main input:not([type="hidden"])')] as HTMLInputElement[];
      return {
        dupIds: ids.filter((id, i) => ids.indexOf(id) !== i),
        unlabelled: inputs.filter((i) => !i.labels?.length).map((i) => i.id),
        positiveTab: [...document.querySelectorAll('[tabindex]')].filter((e) => Number(e.getAttribute('tabindex')) > 0).length,
        shortRows: [...document.querySelectorAll('.report-choice')].filter((e) => e.getBoundingClientRect().height < 44).length,
      };
    });
    expect(audit).toEqual({ dupIds: [], unlabelled: [], positiveTab: 0, shortRows: 0 });

    // Empty send, keyboard only: Tab to the button, Enter.
    await page.locator('h1').click();
    expect(await tabTo(page, { text: 'Send report' })).toBe(true);
    expect(await send.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none'); // focus ring visible
    await page.keyboard.press('Enter');
    const err = page.locator('#report-err');
    await expect(err).toHaveAttribute('role', 'alert');
    await expect(err).toHaveText('Choose what is wrong with this profile.');
    // Between the legend and the first radio; every radio invalid and described by it; focus on the first.
    expect(await err.evaluate((el) => el.previousElementSibling?.tagName === 'LEGEND' && !!el.nextElementSibling?.querySelector('input[type="radio"]'))).toBe(true);
    const radios = page.locator('input[type="radio"]');
    for (let i = 0; i < 6; i++) {
      await expect(radios.nth(i)).toHaveAttribute('aria-invalid', 'true');
      expect((await radios.nth(i).getAttribute('aria-describedby'))?.split(' ')).toContain('report-err');
    }
    await expect(radios.first()).toBeFocused();

    // Choose by keyboard: Space checks the focused choice, the arrows move along the group; Tab, then Enter sends.
    await page.keyboard.press('Space');
    await expect(radios.first()).toBeChecked();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByLabel('May be under 18', { exact: true })).toBeChecked();
    await expect(page.getByLabel('May be under 18', { exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(send).toBeFocused();
    await page.keyboard.press('Enter');
    const sent = page.getByRole('status').filter({ hasText: 'Report sent. Thank you.' });
    await expect(sent).toBeVisible();
    await expect(sent).toBeFocused();
    await expect(page.locator('main input[type="radio"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: `Back to @${target}` })).toBeVisible();
  } finally {
    const rows = await sql`select id, signup_attempt_id from users where handle like ${`${tag}%`}`;
    const ids = rows.map((r) => r.id as number);
    const attempts = (await sql`select id from signup_attempts where user_id = any(${ids}) union select unnest(${rows.map((r) => r.signup_attempt_id as number)}::int[])`).map((r) => r.id as number);
    await sql`delete from users where id = any(${ids})`; // reports by and on these accounts cascade
    await sql`delete from signup_attempts a where a.id = any(${attempts}) and not exists (select 1 from funnel_events f where f.attempt_id = a.id)`;
    await sql.end({ timeout: 1 });
  }
});

// ---- Fix round 2 (business lead BL4 = tester T4; tester T2; UX lead UX2) ----

test('fix round 2 (BL4/T4, T2, UX2): "Send report" ends by 740 px with and without the error; a second visit shows only "already reported"; signed out, Sign in is 44 px', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const sql = (await import('postgres')).default(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const tag = `f16w${rand()}`;
  const target = `${tag}t`, reader = `${tag}r`;
  const bottom = () => page.locator('button.report-send').evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);
  try {
    await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${target}, ${target}, now(), a.id from a`;
    await page.setViewportSize({ width: 360, height: 740 });
    await signIn(page, reader);
    await page.goto(`/u/${target}/report`);
    expect(await bottom()).toBeLessThanOrEqual(740);
    await page.getByRole('button', { name: 'Send report' }).click();
    await expect(page.locator('#report-err')).toBeVisible();
    expect(await bottom()).toBeLessThanOrEqual(740);
    await page.getByLabel('Abusive or hateful name or note', { exact: true }).check();
    await page.getByRole('button', { name: 'Send report' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Report sent. Thank you.' })).toBeVisible();

    // T2 (plan §2.2): coming back shows only the status line, focused, and no form.
    await page.goto(`/u/${target}/report`);
    const already = page.getByRole('status').filter({ hasText: 'You already reported this profile.' });
    await expect(already).toBeVisible();
    await expect(already).toBeFocused();
    await expect(page.locator('main input[type="radio"], main form')).toHaveCount(0);
    await expect(page.getByRole('link', { name: `Back to @${target}` })).toBeVisible();

    // UX2: signed out, the Sign in button is a 44 px target.
    const ctx = await browser.newContext({ baseURL: 'http://localhost:3000', viewport: { width: 360, height: 740 } });
    try {
      const anon = await ctx.newPage();
      await anon.goto(`/u/${target}/report`);
      const signInLink = anon.locator('main').getByRole('link', { name: 'Sign in', exact: true });
      await expect(signInLink).toHaveAttribute('href', '/login');
      const b = (await signInLink.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
    } finally { await ctx.close(); }
  } finally {
    const rows = await sql`select id, signup_attempt_id from users where handle like ${`${tag}%`}`;
    const ids = rows.map((r) => r.id as number);
    const attempts = (await sql`select id from signup_attempts where user_id = any(${ids}) union select unnest(${rows.map((r) => r.signup_attempt_id as number)}::int[])`).map((r) => r.id as number);
    await sql`delete from users where id = any(${ids})`;
    await sql`delete from signup_attempts a where a.id = any(${attempts}) and not exists (select 1 from funnel_events f where f.attempt_id = a.id)`;
    await sql.end({ timeout: 1 });
  }
});
