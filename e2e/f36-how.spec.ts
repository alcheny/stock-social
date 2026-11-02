// F-36 AC7 (plan Round 2 changes, R2-9, R2-11): /how states the return formula and one fictional worked example as text
// that reflows at 360 and 320 px (no horizontal scroll), with the Disclaimer right after the math list and the dated
// "Changes to the math" note at the end. Signed out; static page, no fixture rows.
import { test, expect } from '@playwright/test';

const FORMULA = 'Return = (sale proceeds − purchase cost − purchase fees − sale fees) ÷ (purchase cost + purchase fees)';
const EXAMPLE = '(165 − 100 − 10) ÷ (100 + 10) = 55 ÷ 110 = +50%';
const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';

for (const width of [360, 320]) {
  test(`F-36 AC7: /how at ${width} px shows the formula and the example as text, with no horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/how');
    const math = page.locator('h2:text-is("The math") + ul');
    await expect(math).toContainText(FORMULA);
    await expect(math).toContainText(EXAMPLE);
    await expect(math.locator('img, svg, math, canvas')).toHaveCount(0);
    await expect(page.locator('h2:text-is("The math") + ul + p[data-disclaimer]')).toHaveText(DISCLAIMER);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Every math line fits the column (it wraps at spaces, never overflows).
    const wide = await math.locator('li').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
    expect(wide).toBe(0);
    const changes = page.locator('h2#changes');
    await expect(changes).toHaveText('Changes to the math');
    await expect(page.locator('h2#changes + ul time[datetime="2026-11-02"]')).toHaveText('November 2, 2026');
    await expect(page.locator('h2#changes + ul')).toContainText('returns of trades with a purchase fee were recalculated');
    const levels = await page.locator('main h1, main h2, main h3, main h4').evaluateAll((els) => els.map((e) => Number(e.tagName[1])));
    expect(levels[0]).toBe(1);
    expect([...new Set(levels.slice(1))]).toEqual([2]);
  });
}
