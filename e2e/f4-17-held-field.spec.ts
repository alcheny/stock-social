// F4-17 (docs/direction/cycle4-2026-11-01.md, C4-18; WCAG 1.3.1): the author's thesis field on a held row is described
// by the held line (heldLine(rule)) and is aria-invalid; a published row's field has neither. A fictional trader made
// here, removed at the end; not feed-eligible (no verified source activities), so no feed lock.
import { expect, test } from '@playwright/test';
import { heldLine } from '../lib/report-copy.ts';

const rand = () => Math.random().toString(36).slice(2, 8);

test('F4-17: the held row\'s thesis input has the held line as its description and is aria-invalid; a published row is not', async ({ page }) => {
  test.setTimeout(90_000);
  const sql = (await import('postgres')).default(process.env.DATABASE_URL!, { onnotice: () => {} });
  const tag = rand();
  const trader = `f417${tag}`;
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${trader}, ${trader}, now(), a.id from a returning id`;
  try {
    const [held] = await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, thesis, thesis_status, thesis_hold_rule)
      values (${u.id}, ${`f417-h-${tag}`}, 'a', 'HELDF', now() - interval '3 days', now() - interval '1 day', 0.02, 2, true, ${`see example.com ${tag}`}, 'held', 'link') returning id`;
    const [pub] = await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, thesis, thesis_status)
      values (${u.id}, ${`f417-p-${tag}`}, 'a', 'PUBF', now() - interval '4 days', now() - interval '2 days', 0.01, 2, true, ${`plain note ${tag}`}, 'published') returning id`;
    await page.goto('/login/dev');
    await page.getByLabel('Handle').fill(trader);
    await page.getByLabel('I am 18 or older').check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(new RegExp(`/u/${trader}$`));

    const line = page.locator(`#trade-${held.id} p.thesis-held`);
    await expect(line).toHaveAttribute('id', `held-${held.id}`);
    const field = page.getByLabel('Thesis for HELDF');
    await expect(field).toHaveAttribute('aria-describedby', `held-${held.id}`);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(heldLine('link'));

    const plain = page.getByLabel('Thesis for PUBF');
    await expect(plain).not.toHaveAttribute('aria-describedby', /./);
    await expect(plain).not.toHaveAttribute('aria-invalid', /./);
    expect(pub.id).toBeTruthy();
  } finally {
    await sql`delete from users where handle = ${trader}`;
    await sql.end({ timeout: 1 });
  }
});
