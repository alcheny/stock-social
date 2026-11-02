// F-29 (e2e/f29-gated-wording.spec.ts): renders the pane and the /how paragraph as static markup in a plain Node process,
// the way lib/f27-colour-follow-ups.test.ts does (Next's own SWC for .tsx, a stand-in for next/link), because the pane's
// client parts import Next subpaths the Playwright loader cannot resolve. Run: node e2e/f29-render.ts → JSON on stdout,
// one markup per named case. Fictional records only; no database.
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
    if (/^next\/(navigation|cache|headers|server)$/.test(spec)) return next(`${spec}.js`, ctx);
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

const mod = (p: string) => import(pathToFileURL(new URL(p, ROOT).pathname).href);
const { renderToStaticMarkup } = await import('react-dom/server' as string) as { renderToStaticMarkup: (e: unknown) => string };
const { createElement: h } = await import('react');
const { ProfilePane } = await mod('app/pane.tsx') as typeof import('../app/pane.tsx');
const { HowOptionsParagraph } = await mod('app/how/options-paragraph.tsx') as typeof import('../app/how/options-paragraph.tsx');
const { paneView } = await import('../lib/options-view.ts');
const { optionsPublic, OPTION_PUBLIC_COLUMNS } = await import('../lib/options-gate.ts');
const { PUBLIC_FIELDS } = await import('../lib/privacy-fields.ts');

const DAY = 86_400_000;
const now = new Date('2026-11-01T12:00:00Z');
const trades = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1), symbol: ['ABC', 'DEFG', 'HIJ'][i % 3], returnPct: [0.12, -0.04, 0.03, -0.09][i % 4], holdingDays: 5 + i,
  openedAt: new Date(now.getTime() - (60 - i * 3) * DAY), closedAt: new Date(now.getTime() - (50 - i * 3) * DAY), thesis: null, verified: true,
}));
const counts = { shown: 3, short: 1, other: 0, openLong: 1, openShort: 0, openOther: 0, unsupported: 0, exerciseShares: 0 };
const OPEN_FIELDS = [...PUBLIC_FIELDS, { words: 'option results', columns: [...OPTION_PUBLIC_COLUMNS] }];
const closed = optionsPublic(PUBLIC_FIELDS), open = optionsPublic(OPEN_FIELDS);
const view = (gateOpen: boolean) => paneView(gateOpen
  ? { gate: 'open', counts, summary: { n: 3, winRate: 2 / 3, avg: 0.04, range: { low: -0.2, high: 0.3 }, bets: 3 } }
  : { gate: 'closed', counts });
const pane = (o: { gateOpen?: boolean; positions?: boolean; options?: boolean }) => renderToStaticMarkup(h(ProfilePane, {
  handle: 'f29_fiction', name: 'Fiction Trader', trades, now, state: 'connected',
  ...(o.positions ? { open: [0.05, -0.03, 0.1], openAsOf: new Date(now.getTime() - DAY) } : {}),
  ...(o.options === false ? {} : { options: view(!!o.gateOpen) }),
}));

const out = {
  gates: { closed, open },
  howClosed: renderToStaticMarkup(h(HowOptionsParagraph, { open: closed })),
  howOpen: renderToStaticMarkup(h(HowOptionsParagraph, { open })),
  pane: pane({}),
  paneOpenPositions: pane({ positions: true }),
  paneGateOpen: pane({ gateOpen: open }),
  paneNoOptions: pane({ options: false }),
};
process.stdout.write(JSON.stringify(out));
