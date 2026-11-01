// Known-limits sweep (lists): the owner-only referral line (app/u/[handle]/referral-feedback.tsx) past MAX_SHOWN.
// Renders the component with react-dom/server through the same module hook as lib/f10-feed-card.test.ts.
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
const { ReferralFeedback } = await import(pathToFileURL(new URL('app/u/[handle]/referral-feedback.tsx', ROOT).pathname).href) as typeof import('../app/u/[handle]/referral-feedback.tsx');
const handles = (n: number) => Array.from({ length: n }, (_, i) => `ref_${String(i).padStart(2, '0')}`);
const render = (n: number) => renderToStaticMarkup(createElement(ReferralFeedback, { handles: handles(n), byVia: { profile: n } }));
const text = (html: string) => { let prev: string; do { prev = html; html = html.replace(/<[^>]*>/g, ''); } while (html !== prev); return html; };

test('lists: past 20 referred traders the owner line names 20 and says "and N more" in the same muted line, unlinked', () => {
  const html = render(25);
  const line = html.match(/<p class="muted small">([\s\S]*?)<\/p>/)?.[1] ?? '';
  assert.equal((line.match(/<a /g) ?? []).length, 20);
  assert.match(text(line), /@ref_19 and 5 more$/);
  assert.doesNotMatch(line, /<a [^>]*>[^<]*more/);
  assert.match(text(render(21)), /@ref_19 and 1 more/);
});

test('lists: at 20 or fewer every handle is named and nothing says "more"', () => {
  for (const n of [1, 20]) {
    const t = text(render(n));
    assert.doesNotMatch(t, /more/);
    assert.equal((render(n).match(/<a /g) ?? []).length, n);
  }
});
