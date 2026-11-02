// FIXES-CYCLE5 (F5-13, C5-23): an empty stock page's title says it is empty ("No closed trades in ‹TICKER› yet"), with
// no "verified" claim; it still answers 200 and stays out of search indexes. A stock with trades keeps its title.
// Runs against the seeded app (NVDA is a seeded Demo stock); creates nothing.
import { test, expect } from '@playwright/test';
import { FC5, FIXES_LABELS as FL } from '../lib/copy.ts';

test.use({ viewport: { width: 360, height: 740 } });

test('F5-13: /t/ZZZZQ (no closed trades) is titled as empty, answers 200 and stays noindex', async ({ page }) => {
  const res = await page.goto('/t/ZZZZQ');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(`${FC5.tickerEmptyTitle('ZZZZQ')} · Stock Social`);
  expect(await page.title()).not.toMatch(/verified/i);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('F5-13: a stock with closed trades keeps its title', async ({ page }) => {
  const res = await page.goto('/t/NVDA');
  expect(res?.status()).toBe(200);
  const title = await page.title();
  // Demo-only when seeded; mixed or verified if other fixtures added rows meanwhile: always one of today's three titles.
  expect([FL.tickerTitle.demo('NVDA'), FL.tickerTitle.mixed('NVDA'), FL.tickerTitle.verified('NVDA')]).toContain(title);
});
