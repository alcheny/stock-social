// Fix #2 (approval council cycle 2, POLICY F3, D20): every route in the app tree is classified here, so a performance
// route or share image can't ship without the disclaimer in plain view. lib/disclaimer-routes.test.ts fails on any route
// in app/ that has no entry (and on any entry with no route); e2e/disclaimer-guard.spec.ts visits every `performance`
// entry at 360 px and fetches every `image` entry. Pure (no DB); node:fs only for the walk.
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// File names that make a route in the App Router (pages, handlers, metadata images and files).
const ROUTE_FILE = /^(page|route|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest)\.(tsx?|jsx?)$/;

// Route patterns from the app directory, e.g. "/u/[handle]/trade/[sellId]" or "/t/[symbol]/opengraph-image".
// Route groups "(x)" and parallel slots "@x" add no segment; private folders "_x" and intercepting routes "(.)x" make none.
export function walkRoutes(appDir: string): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { if (!name.startsWith('_') && !/^\(\.+\)/.test(name)) visit(p); continue; }
      const m = ROUTE_FILE.exec(name);
      if (!m) continue;
      const segs = relative(appDir, dir).split(sep).filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith('@'));
      const kind = m[1];
      const base = `/${segs.join('/')}`;
      if (kind === 'page' || kind === 'route') out.push(base);
      else if (kind === 'sitemap') out.push(`${base === '/' ? '' : base}/sitemap.xml`);
      else if (kind === 'robots') out.push('/robots.txt');
      else if (kind === 'manifest') out.push('/manifest.webmanifest');
      else out.push(`${base === '/' ? '' : base}/${kind}`);
    }
  };
  visit(appDir);
  return [...new Set(out)].sort();
}

export type RouteEntry =
  // A screen that shows performance: the disclaimer in exact text, beside its first figures (anchor), at 360 px.
  | { kind: 'performance'; sample: string; anchor: string; signedIn?: boolean; file: string }
  // A share image that shows performance: 200 + image/png, and its module renders DISCLAIMER from lib/share.ts.
  | { kind: 'image'; sample: string; file: string }
  // Owned by a running feature build that adds the disclaimer; moved to performance/image by that build's PR.
  | { kind: 'pending'; owner: 'F-10' | 'F-12'; sample: string; anchor?: string; image?: boolean; file: string; ponytail: string }
  | { kind: 'notPerformance'; reason: string };

const NO_FIGURES = 'shows no returns, win rates or other performance figures';

export const ROUTES: Record<string, RouteEntry> = {
  // Performance screens (this fix places the line).
  '/u/[handle]': { kind: 'performance', sample: '/u/momentum_maya', anchor: 'section.stats', file: 'app/u/[handle]/page.tsx' },
  '/t/[symbol]': { kind: 'performance', sample: '/t/NVDA', anchor: 'section.stats', file: 'app/t/[symbol]/page.tsx' },
  '/t/compare': { kind: 'performance', sample: '/t/compare?a=NVDA&b=AMD', anchor: '.compare-grid .stats', file: 'app/t/compare/page.tsx' },
  '/me/record': { kind: 'performance', sample: '/me/record', anchor: '.rec-card, .rec-grid', signedIn: true, file: 'app/me/record/page.tsx' },
  '/me/likes': { kind: 'performance', sample: '/me/likes', anchor: 'ul.likes', signedIn: true, file: 'app/me/likes/page.tsx' },
  '/tools': { kind: 'performance', sample: '/tools', anchor: 'main h1', signedIn: true, file: 'app/tools/parts.tsx' },
  // Share images that already carry the disclaimer (lib/record-card.ts renders it).
  '/u/[handle]/opengraph-image': { kind: 'image', sample: '/u/momentum_maya/opengraph-image', file: 'app/u/[handle]/opengraph-image.tsx' },
  '/u/[handle]/story': { kind: 'image', sample: '/u/momentum_maya/story', file: 'app/u/[handle]/story/route.tsx' },
  // Pending: F-10 (feed card, pane) and F-12 (trade/month pages, all three share images). Their ACs add the line.
  // ponytail: these routes are checked as pending, not as passing — fix: the F-10/F-12 PR moves each to performance/image.
  '/': { kind: 'pending', owner: 'F-10', sample: '/', anchor: '.card', file: 'app/page.tsx', ponytail: 'feed card has no disclaimer beside its figures until F-10 merges (F-10 doc AC on fix #2)' },
  '/u/[handle]/pane': { kind: 'pending', owner: 'F-10', sample: '/u/momentum_maya/pane', file: 'app/u/[handle]/pane/route.ts', ponytail: 'JSON for the feed pane; the pane UI (app/pane.tsx) gets the line in F-10' },
  '/u/[handle]/pane-chart': { kind: 'pending', owner: 'F-10', sample: '/u/momentum_maya/pane-chart', file: 'app/u/[handle]/pane-chart/route.ts', ponytail: 'chart data for the feed pane; covered with the pane in F-10' },
  '/u/[handle]/trade/[sellId]': { kind: 'pending', owner: 'F-12', sample: '', anchor: 'main h1', file: 'app/u/[handle]/trade/[sellId]/page.tsx', ponytail: 'trade page disclaimer is F-12 AC; sample needs a seeded sell_id' },
  '/u/[handle]/month/[ym]': { kind: 'pending', owner: 'F-12', sample: '', anchor: 'main h1', file: 'app/u/[handle]/month/[ym]/page.tsx', ponytail: 'month page disclaimer is F-12 AC' },
  '/u/[handle]/trade/[sellId]/opengraph-image': { kind: 'pending', owner: 'F-12', sample: '', image: true, file: 'app/u/[handle]/trade/[sellId]/opengraph-image.tsx', ponytail: 'renders DISCLAIMER at 22 px; F-12 raises it' },
  '/u/[handle]/month/[ym]/opengraph-image': { kind: 'pending', owner: 'F-12', sample: '', image: true, file: 'app/u/[handle]/month/[ym]/opengraph-image.tsx', ponytail: 'renders DISCLAIMER at 22 px (lib/month-card.ts); F-12 raises it' },
  '/t/[symbol]/opengraph-image': { kind: 'pending', owner: 'F-12', sample: '/t/NVDA/opengraph-image', image: true, file: 'app/t/[symbol]/opengraph-image.tsx', ponytail: 'renders DISCLAIMER at 22 px; F-12 raises it with the strip' },
  // No performance figures.
  '/t': { kind: 'notPerformance', reason: 'stock index: trade and trader counts only, no returns' },
  '/how': { kind: 'notPerformance', reason: `explainer; ${NO_FIGURES}` },
  '/terms': { kind: 'notPerformance', reason: 'legal text' },
  '/privacy': { kind: 'notPerformance', reason: 'legal text' },
  '/login': { kind: 'notPerformance', reason: 'sign-in' },
  '/login/sent': { kind: 'notPerformance', reason: 'sign-in' },
  '/login/dev': { kind: 'notPerformance', reason: 'dev sign-in' },
  '/auth/email': { kind: 'notPerformance', reason: 'sign-in handler' },
  '/auth/email/confirm': { kind: 'notPerformance', reason: 'sign-in confirm step' },
  '/auth/callback/[provider]': { kind: 'notPerformance', reason: 'sign-in handler' },
  '/connect': { kind: 'notPerformance', reason: 'connect notice' },
  '/connect/consent': { kind: 'notPerformance', reason: 'connect consent: counts of accounts, no returns' },
  '/connect/continue': { kind: 'notPerformance', reason: 'portal hand-off' },
  '/connect/result': { kind: 'notPerformance', reason: 'connect result' },
  '/connect/done': { kind: 'notPerformance', reason: 'handler (redirect)' },
  '/connect/portal': { kind: 'notPerformance', reason: 'handler (redirect)' },
  '/connect/start': { kind: 'notPerformance', reason: 'handler (redirect)' },
  '/me/following': { kind: 'notPerformance', reason: `followed traders list; ${NO_FIGURES}` },
  '/me/hidden': { kind: 'notPerformance', reason: `hidden traders and trades; ${NO_FIGURES}` },
  '/me/personalize': { kind: 'notPerformance', reason: 'feed settings' },
  '/settings': { kind: 'notPerformance', reason: 'settings' },
  '/account': { kind: 'notPerformance', reason: 'billing account' },
  '/account/export': { kind: 'notPerformance', reason: 'data export download (the owner\'s own data, not a screen)' },
  '/tools/signin': { kind: 'notPerformance', reason: 'handler (redirect)' },
  '/api/billing/reconcile': { kind: 'notPerformance', reason: 'API' },
  '/api/billing/webhook': { kind: 'notPerformance', reason: 'API' },
  '/api/events': { kind: 'notPerformance', reason: 'API' },
  '/api/import/step': { kind: 'notPerformance', reason: 'API' },
  '/api/sync': { kind: 'notPerformance', reason: 'API' },
  '/sitemap.xml': { kind: 'notPerformance', reason: 'sitemap' },
  '/robots.txt': { kind: 'notPerformance', reason: 'robots' },
};

export const routesOf = <K extends RouteEntry['kind']>(kind: K) =>
  Object.entries(ROUTES).filter((e): e is [string, Extract<RouteEntry, { kind: K }>] => e[1].kind === kind);
