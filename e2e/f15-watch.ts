// F-15 e2e helper: every request the page sends to the view beacon route, with its time and body.
import type { Page, Request } from '@playwright/test';

export type Seen = { at: number; body: Record<string, unknown>; req: Request };
export function watch(page: Page): Seen[] {
  const seen: Seen[] = [];
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/api/views') seen.push({ at: Date.now(), body: JSON.parse(req.postData() ?? '{}'), req });
  });
  return seen;
}
