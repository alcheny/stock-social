// The accessibility rule engine (owner decision 2026-11-01, item 2.46; dev dependency only, MPL-2.0, licence review in
// scripts/compliance.ts). One helper so every spec checks the same WCAG 2.1 A and AA rule set the same way: F-16's report
// form and F-8's reveal use it when they are built.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Fails with each violated rule, its impact and the first offending selectors, so a failure names what to fix.
export async function expectNoAxeViolations(page: Page, opts: { include?: string } = {}) {
  let b = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (opts.include) b = b.include(opts.include);
  const { violations } = await b.analyze();
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(summary, `axe violations on ${page.url()}`).toEqual([]);
}
