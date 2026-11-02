// The rule engine over the public pages a shared link lands on, signed out, light and dark (needs `npm run db:seed`):
// no WCAG 2.1 A or AA violation (POLICY A; owner decision 2026-11-01, item 2.46). The dependency-free contrast-token and
// Tab-walk tests stay; this adds the automated rules on the rendered pages.
import { test } from '@playwright/test';
import { expectNoAxeViolations } from './axe.ts';

const ROUTES = ['/', '/u/momentum_maya', '/how', '/login', '/privacy', '/terms', '/t'];

for (const scheme of ['light', 'dark'] as const) {
  for (const route of ROUTES) {
    test(`axe (${scheme}): ${route} has no WCAG 2.1 A or AA violation, signed out`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expectNoAxeViolations(page);
    });
  }
}
