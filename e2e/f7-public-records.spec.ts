// F-7: the /public-records page and the /how section (legal C12, C24; plan-round2-engineer.md §4.3 AC 15, 26): what these
// profiles are, the source, what is excluded, that the person has not joined, and the contact (a deploy setting; unset:
// "Requests open before launch"). Promises a review and a reply only. No filer is named. 360 px, 44 px links.
import { test, expect, type Page } from '@playwright/test';

const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
const BANNED = /insider (buying|trading)|smart money|\bsignals?\b|\bcopy\b|follow their trades|trade like|\bevery trade\b|\bany broker\b|\bguarantee/i;
test.use({ viewport: { width: 360, height: 800 } });

async function common(page: Page) {
  await expect(page.locator('footer#site-footer')).toContainText(DISCLAIMER);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(BANNED);
  expect(text).not.toMatch(/pf_/);
  for (const h of await page.locator('main a').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
}

test('AC 15 (C12): /public-records says what these profiles are and how to ask; a reply is promised, never an outcome', async ({ page }) => {
  const res = await page.goto('/public-records');
  expect(res!.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Public filing records');
  const main = page.locator('main');
  await expect(main).toContainText('company insiders’ transaction reports');
  await expect(main).toContainText('has not joined Stock Social');
  await expect(main).toContainText('does not endorse it');
  await expect(main).toContainText('excluded and counted');
  await expect(main).toContainText('Filings can be late, amended or missing');
  await expect(main).toContainText('We will review your request and reply.');
  const contact = page.locator('[data-contact]');
  if (process.env.PUBLIC_RECORDS_CONTACT) await expect(contact).toContainText(process.env.PUBLIC_RECORDS_CONTACT);
  else await expect(contact).toHaveText('Requests open before launch.');
  expect(await main.innerText()).not.toMatch(/\bwithin \d|\bwill (remove|delete|correct)/i);
  await common(page);
});

test('AC 26 (C24): /how has the Public filing records section and links to /public-records', async ({ page }) => {
  await page.goto('/how');
  const h = page.locator('h2#public-filings');
  await expect(h).toHaveText('Public filing records');
  const list = page.locator('h2#public-filings + ul');
  await expect(list).toContainText('Filings can be late, amended or missing');
  await expect(list).toContainText('not Verified');
  await expect(list).toContainText('before fees');
  await page.getByRole('link', { name: 'Corrections and removal requests' }).click();
  await expect(page).toHaveURL(/\/public-records$/);
  await common(page);
});
