// fix-user-text fix round 5 (item 5): a display name renders isolated in <bdi>, so a right-to-left name never reorders
// the handle after it. Renders app/ui.tsx with react-dom/server, with the module hook lib/f10-feed-card.test.ts uses
// (.tsx through Next's own SWC binding, `@/` to the repo root, next/link as a plain <a>).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url);
const require = createRequire(import.meta.url);
const swc = require('next/dist/build/swc') as { loadBindings: () => Promise<unknown>; transformSync: (src: string, o: object) => { code: string } };
await swc.loadBindings();
const LINK = `data:text/javascript,${encodeURIComponent("import { createElement } from 'react'; export default function Link({ href, children, prefetch: _p, ...rest }) { return createElement('a', { href, ...rest }, children); }")}`;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/link') return { url: LINK, shortCircuit: true };
    if (spec.startsWith('@/')) return next(new URL(spec.slice(2), ROOT).href, ctx);
    if (ctx.parentURL?.startsWith('data:')) return next(spec, { ...ctx, parentURL: import.meta.url });
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (!url.endsWith('.tsx')) return next(url, ctx);
    const file = new URL(url);
    const { code } = swc.transformSync(readFileSync(file, 'utf8'), {
      filename: file.pathname, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' }, module: { type: 'es6' },
    });
    return { format: 'module', source: code, shortCircuit: true };
  },
});

const { renderToStaticMarkup } = await import('react-dom/server' as string) as { renderToStaticMarkup: (e: unknown) => string };
const { createElement } = await import('react');
const { WhoName } = await import(pathToFileURL(new URL('app/ui.tsx', ROOT).pathname).href) as typeof import('../app/ui.tsx');

test('a Hebrew display name is isolated in <bdi>; the handle after it stays whole, outside the isolate', () => {
  const html = renderToStaticMarkup(createElement(WhoName, { name: 'דני לוי', handle: 'trader_2024' }));
  assert.equal(html, '<strong><bdi>דני לוי</bdi></strong> <span class="muted">@trader_2024</span>');
  // The handle is one text run after the isolate closes: nothing of it is inside the right-to-left name.
  const bdi = html.slice(html.indexOf('<bdi>'), html.indexOf('</bdi>'));
  assert.ok(!bdi.includes('trader_2024'));
  assert.match(html, /<\/bdi><\/strong> <span class="muted">@trader_2024<\/span>$/);
});

test('a name equal to the handle shows the handle once, with no empty isolate', () => {
  assert.equal(renderToStaticMarkup(createElement(WhoName, { name: 'calm_trader', handle: 'calm_trader' })), '<span class="muted">@calm_trader</span>');
});

test('the profile heading and the pane loading line isolate the display name too', () => {
  const page = readFileSync(new URL('../app/u/[handle]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /<h1 style=\{\{ marginBottom: 4 \}\}>\{provisional \? `@\$\{user\.handle\}` : <bdi>\{user\.display_name\}<\/bdi>\}<\/h1>/);
  const lazy = readFileSync(new URL('../app/lazy-pane.tsx', import.meta.url), 'utf8');
  assert.match(lazy, /Loading <bdi>\{name\}<\/bdi>’s record…/);
});
