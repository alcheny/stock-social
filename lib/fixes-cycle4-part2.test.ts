// FIXES-CYCLE4-PART2: unit tests for F4-14 (badge space), F4-15 (the share card's head row never clips the @handle),
// F4-16 (the chart sheet's note dates) and the pure halves of F4-4 (month qualifier) and F4-8 (home preview).
// Renders .tsx with the module hook lib/bdi-names.test.ts uses (Next's own SWC binding, `@/` to the repo root).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { GEIST_ADVANCE, textWidth, unfurlHeadRows, whoMinWidth, HEAD_HEADROOM, HEAD_PILL_ROW } from './card-head.ts';
import { CARD_LAYOUT } from './record-card.ts';
import { SHARE_CARD } from './copy.ts';
import { fromNoteDay, noteDays, packPoints, toNoteDay, unpackPoints } from './paging.ts';
import { packChart, paneChart, unpackChart } from './chart-series.ts';
import { noteDateLine, UserNote } from './user-note.ts';

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
const { Badge } = await import(pathToFileURL(new URL('app/ui.tsx', ROOT).pathname).href) as typeof import('../app/ui.tsx');
const text = (html: string) => html.replace(/<[^>]+>/g, '');

// ---- F4-14 (C4-15) ----
test('F4-14: the Demo and Public filing badges read as two words, "Demo Public filing"', () => {
  const html = renderToStaticMarkup(createElement(Badge, { kind: 'public_demo' }));
  assert.equal(text(html), 'Demo Public filing');
  assert.equal((html.match(/class="badge demo"/g) ?? []).length, 1, 'one Demo badge');
  assert.equal(text(renderToStaticMarkup(createElement(Badge, { kind: 'public' }))), 'Public filing', 'no stray space without Demo');
});

// ---- F4-15 (C4-16) ----
// The table is the bundled font's own advance widths: re-read from the TTF (cmap format 4 + hmtx), so a font swap fails here.
function fontAdvances(file: string): Map<string, number> {
  const b = readFileSync(file);
  const u16 = (o: number) => b.readUInt16BE(o), u32 = (o: number) => b.readUInt32BE(o), i16 = (o: number) => b.readInt16BE(o);
  const t: Record<string, number> = {};
  for (let i = 0; i < u16(4); i++) { const o = 12 + 16 * i; t[b.toString('latin1', o, o + 4)] = u32(o + 8); }
  assert.equal(u16(t.head + 18), 1000, 'units per em');
  const nH = u16(t.hhea + 34);
  let sub = 0;
  for (let i = 0; i < u16(t.cmap + 2); i++) if (u16(t.cmap + 4 + 8 * i) === 3 && u16(t.cmap + 6 + 8 * i) === 1) sub = t.cmap + u32(t.cmap + 8 + 8 * i);
  assert.ok(sub, 'a Unicode BMP cmap');
  const seg = u16(sub + 6), ends = sub + 14, starts = ends + seg + 2, deltas = starts + seg, ro = deltas + seg;
  const gid = (c: number) => {
    for (let s = 0; s < seg / 2; s++) {
      if (c > u16(ends + 2 * s)) continue;
      const st = u16(starts + 2 * s); if (c < st) return 0;
      const r = u16(ro + 2 * s), d = i16(deltas + 2 * s);
      if (!r) return (c + d) & 0xffff;
      const g = u16(ro + 2 * s + r + 2 * (c - st)); return g ? (g + d) & 0xffff : 0;
    }
    return 0;
  };
  const out = new Map<string, number>();
  for (const ch of Object.keys(GEIST_ADVANCE)) out.set(ch, u16(t.hmtx + 4 * Math.min(gid(ch.codePointAt(0)!), nH - 1)));
  return out;
}

test('F4-15: the width table is the bundled next/og font\'s own advance widths', () => {
  const file = require.resolve('next/dist/compiled/@vercel/og/Geist-Regular.ttf');
  // next/og draws every card with this one font (its index.node.js registers only Geist Regular).
  assert.match(readFileSync(require.resolve('next/dist/compiled/@vercel/og/index.node.js'), 'utf8'), /Geist-Regular\.ttf/);
  for (const [ch, w] of fontAdvances(file)) assert.equal(GEIST_ADVANCE[ch], w, `advance of ${JSON.stringify(ch)}`);
});

const card = (o: { handle: string; name?: string; label?: string; newRecord?: boolean; shareLabel?: boolean }) =>
  ({ kind: 'unfurl' as const, handle: o.handle, name: o.name ?? `@${o.handle}`, label: o.label ?? '✓ Verified', newRecord: o.newRecord ?? false, shareLabel: o.shareLabel });
const room = CARD_LAYOUT.unfurl.width - 2 * CARD_LAYOUT.unfurl.padX;

test('F4-15: the longest pill set and a 20-character handle: the handle fits whole and no pill is dropped', () => {
  for (const handle of ['w'.repeat(20), 'm'.repeat(20), 'w_m0'.repeat(5)]) {
    for (const name of [`@${handle}`, 'A display name that is very long']) {
      const m = card({ handle, name, label: SHARE_CARD.demoImage, newRecord: true, shareLabel: true });
      const r = unfurlHeadRows(m);
      assert.deepEqual([...r.head, ...r.column.flat(), ...r.second].sort(), ['badge', 'newRecord', 'options'], handle);
      assert.ok(whoMinWidth(m) * HEAD_HEADROOM <= room, 'the handle alone always fits the row');
    }
  }
  // The longest set with the widest 20-letter handle and no display name: every pill under the head (the fallback).
  assert.deepEqual(unfurlHeadRows(card({ handle: 'w'.repeat(20), label: SHARE_CARD.demoImage, newRecord: true, shareLabel: true })),
    { head: [], column: [], second: ['badge', 'options', 'newRecord'] });
});

test('F4-15: moved pills go to the chart column first (no added height); the badge stays beside the handle', () => {
  assert.deepEqual(unfurlHeadRows(card({ handle: 'abc', newRecord: true, shareLabel: true })), { head: ['newRecord', 'options', 'badge'], column: [], second: [] });
  assert.deepEqual(unfurlHeadRows(card({ handle: 'abc' })), { head: ['badge'], column: [], second: [] });
  // The seeded demo options trader's shape: name + short handle, Demo label, "Excluding options" moves to the column.
  assert.deepEqual(unfurlHeadRows(card({ handle: 'yolo_yuki', name: 'Yuki', label: SHARE_CARD.demoImage, shareLabel: true })),
    { head: ['badge'], column: [['options']], second: [] });
  // A wide card's narrower column still takes the pill.
  assert.deepEqual(unfurlHeadRows(card({ handle: 'yolo_yuki', name: 'Yuki', label: SHARE_CARD.demoImage, shareLabel: true }), CARD_LAYOUT.unfurl.chart.w - 100).column, [['options']]);
  // Verified + Excluding options + a handle long enough that both pills don't fit but the badge alone does.
  const mid = Array.from({ length: 18 }, (_, n) => 'w'.repeat(n + 3)).map((h) => [h, unfurlHeadRows(card({ handle: h, shareLabel: true }))] as const)
    .find(([, r]) => r.column.length === 1);
  assert.ok(mid, 'some handle length moves only the options pill');
  assert.deepEqual(mid![1], { head: ['badge'], column: [['options']], second: [] });
  assert.equal(HEAD_PILL_ROW, CARD_LAYOUT.unfurl.font.label + 2 * 2 + 2 * 3 + CARD_LAYOUT.unfurl.gap, 'a pill row is the drawn pill plus the gap');
});

test('F4-15: every trust label: the head row holds the full handle, only the Demo label ever needs the row under it, nothing dropped', () => {
  const labels = ['✓ Verified', SHARE_CARD.notVerified, SHARE_CARD.noBroker, SHARE_CARD.failed, SHARE_CARD.importing, SHARE_CARD.demoImage];
  const f = CARD_LAYOUT.unfurl.font;
  for (let n = 3; n <= 20; n++) for (const label of labels) for (const newRecord of [false, true]) for (const shareLabel of [false, true]) for (const named of [false, true]) for (const colW of [556, 456]) {
    const handle = 'w'.repeat(n);
    const m = card({ handle, name: named ? 'Name' : undefined, label, newRecord, shareLabel });
    const r = unfurlHeadRows(m, colW);
    const pw = (p: string) => textWidth(p === 'newRecord' ? 'New record' : p === 'options' ? 'Excluding options' : label, p === 'newRecord' ? f.newRecord : f.label) + 38;
    const used = whoMinWidth(m) + (r.head.length ? 16 + r.head.reduce((a, p) => a + pw(p), 0) + 12 * (r.head.length - 1) : 0);
    const at = `${n} ${label} ${newRecord} ${shareLabel} ${named} ${colW}`;
    assert.ok(used <= room, at);
    for (const rowPills of r.column) assert.ok(rowPills.reduce((a, p) => a + pw(p), 0) + 12 * (rowPills.length - 1) <= colW, at);
    assert.ok(r.column.length <= 3 && CARD_LAYOUT.unfurl.chart.h - 2 * 41 - r.column.length * HEAD_PILL_ROW > 120, `${at}: the chart keeps a usable height`);
    if (label !== SHARE_CARD.demoImage) assert.deepEqual(r.second, [], `${at}: only the Demo label ever needs the row under the head`);
    assert.deepEqual([...r.head, ...r.column.flat(), ...r.second].sort(), [...(newRecord ? ['newRecord'] : []), ...(shareLabel ? ['options'] : []), 'badge'].sort(), 'no pill is dropped');
  }
});

test('F4-15: the model\'s chart gives up one pill row per column row', () => {
  const src = readFileSync(new URL('lib/record-card.ts', ROOT), 'utf8');
  assert.match(src, /box\.h -= headRows\.column\.length \* HEAD_PILL_ROW/);
});

test('F4-15: the image draws the head from unfurlHeadRows (no pill group beside the handle that ignores it)', () => {
  const src = readFileSync(new URL('app/u/[handle]/record-card-image.tsx', ROOT), 'utf8');
  assert.match(src, /unfurlHeadRows\(m, colW\)/);
  assert.doesNotMatch(src, /\{newRecord\}\{shareOnly\}\{badge\}/);
  assert.match(src, /columnPills\(headRows\.column\)/);
  // User test: the moved pills right-align in the chart column, clear of the text column's "average per trade".
  assert.match(src, /gap: 12, justifyContent: 'flex-end'/);
});

// ---- F4-16 (C4-17) ----
const W = new Date('2026-10-05T15:00:00Z'), E = new Date('2026-10-07T01:00:00Z');
const base = { symbol: 'XYZ', returnPct: 0.1, holdingDays: 3, closedAt: new Date('2026-10-04T20:00:00Z') };

test('F4-16: note days are UTC days; the caption from day numbers equals the caption from the stored times', () => {
  assert.equal(toNoteDay(null), null);
  assert.deepEqual(noteDays(null, undefined), null);
  assert.equal(noteDateLine(fromNoteDay(toNoteDay(W)), fromNoteDay(toNoteDay(E))), noteDateLine(W, E));
  const late = new Date('2026-10-05T23:59:59.999Z');
  assert.equal(noteDateLine(fromNoteDay(toNoteDay(late)), null), noteDateLine(late, null));
});

test('F4-16: profile points round-trip: the chart sheet renders the profile row\'s caption', () => {
  const pts = unpackPoints(packPoints([
    { id: 'a', ...base, thesis: 'Dated note', writtenAt: W, editedAt: E },
    { id: 'b', ...base, closedAt: new Date('2026-10-03T20:00:00Z'), thesis: 'Undated note' },
    { id: 'c', ...base, closedAt: new Date('2026-10-02T20:00:00Z'), thesis: null, writtenAt: W, editedAt: E },
  ]));
  const sheet = (p: (typeof pts)[number]) => renderToStaticMarkup(createElement(UserNote, { text: p.thesis!, handle: 'trader_one', writtenAt: fromNoteDay(p.writtenDay), editedAt: fromNoteDay(p.editedDay) }));
  const row = renderToStaticMarkup(createElement(UserNote, { text: 'Dated note', handle: 'trader_one', writtenAt: W, editedAt: E }));
  assert.equal(sheet(pts[0]), row);
  assert.match(row, /Written Oct 5, 2026, after the trade closed · edited Oct 7, 2026/);
  assert.doesNotMatch(sheet(pts[1]), /Written|Edited/, 'no recorded date: no date');
  assert.equal(pts[2].writtenDay, undefined, 'no note: no dates travel');
  assert.equal(packPoints([{ id: 'c', ...base, thesis: null, writtenAt: W }])[0].length, 6, 'no note: the tuple keeps its six fields');
  assert.equal(packPoints([{ id: 'b', ...base, thesis: 'x' }])[0].length, 6, 'undated note: six fields');
});

test('F4-16: the pane chart (eager and fetched) carries the dates to the sheet', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  const chart = paneChart([{ id: 'a', ...base, thesis: 'Dated note', writtenAt: W, editedAt: null }, { id: 'b', ...base, closedAt: new Date('2026-10-01T00:00:00Z'), thesis: 'Plain' }], now);
  const json = JSON.parse(JSON.stringify(chart)) as typeof chart; // the wire
  const trades = unpackChart(json).ALL.pts.map((p) => p.trade).filter(Boolean);
  const a = trades.find((t) => t!.id === 'a')!, b = trades.find((t) => t!.id === 'b')!;
  assert.equal(noteDateLine(fromNoteDay(a.writtenDay), fromNoteDay(a.editedDay)), 'Written Oct 5, 2026, after the trade closed');
  assert.equal(b.writtenDay, undefined);
  assert.equal(json.trades.find((t) => t[0] === 'b')!.length, 6, 'an undated note adds no fields to the wire');
  // The lite stand-in ships no closes at all, so no dates either.
  assert.equal(packChart(unpackPoints(packPoints([{ id: 'a', ...base, thesis: 'n', writtenAt: W }])), now, 10, true).trades.length, 0);
});

test('F4-16: the sheet passes the dates to UserNote; the eager pane rows and the pane-chart route read them, published only', () => {
  assert.match(readFileSync(new URL('app/u/[handle]/chart.tsx', ROOT), 'utf8'), /<UserNote text=\{chosen\.thesis\} handle=\{noteBy\} writtenAt=\{fromNoteDay\(chosen\.writtenDay\)\} editedAt=\{fromNoteDay\(chosen\.editedDay\)\} \/>/);
  const route = readFileSync(new URL('app/u/[handle]/pane-chart/route.ts', ROOT), 'utf8');
  assert.match(route, /case when thesis_status = 'published' then thesis_written_at end/);
  assert.match(route, /case when thesis_status = 'published' then thesis_edited_at end/);
  const feed = readFileSync(new URL('lib/feed.ts', ROOT), 'utf8');
  assert.match(feed, /case when thesis_status = 'published' then date_part\('epoch', thesis_written_at\)/);
  assert.match(feed, /case when thesis_status = 'published' then date_part\('epoch', thesis_edited_at\)/);
});

// ---- F4-8 (C4-12) ----
test('F4-8: homePreview(demo, pub): four texts; only pub names public filings, before the Demo sentence; title unchanged', async () => {
  const { homePreview } = await import('./home-preview.ts');
  const { CHORES_3, FIXES_CYCLE4_PART2 } = await import('./copy.ts');
  const P = FIXES_CYCLE4_PART2.homePublic;
  assert.equal(P, 'Records built from public filings are marked Public filing.');
  for (const demo of [false, true]) for (const pub of [false, true]) {
    const h = homePreview(demo, pub);
    assert.equal(h.title, CHORES_3.homeTitle);
    const tail = `${pub ? ` ${P}` : ''}${demo ? ` ${CHORES_3.demo}` : ''}`;
    assert.equal(h.description, `${CHORES_3.losses}${tail}`);
    assert.equal(h.metaDescription, `${CHORES_3.position}${tail}`);
    assert.equal(h.cardText, `${CHORES_3.position}${tail}`);
    for (const s of [h.description, h.metaDescription, h.cardText]) assert.equal(s.includes('public filings'), pub);
  }
  assert.deepEqual(homePreview(true), homePreview(true, false), 'the one-argument form is unchanged');
});

test('F4-8: the home card reads p=1 only; the page names both states in the card URL', () => {
  const route = readFileSync(new URL('app/home-card/route.tsx', ROOT), 'utf8');
  assert.match(route, /const pub = q\.get\('p'\) === '1';/);
  assert.match(route, /homePreview\(q\.get\('d'\) !== '0', pub\)/);
  const page = readFileSync(new URL('app/page.tsx', ROOT), 'utf8');
  assert.match(page, /\/home-card\?d=\$\{demo \? 1 : 0\}&p=\$\{pub\.shown \? 1 : 0\}/);
  assert.match(page, /const demo = demoRecords \|\| pub\.demo;/);
});

test('F4-8: the home card with both sentences still fits its 630 px card (measured in the drawn font, 15% headroom)', async () => {
  const { homePreview } = await import('./home-preview.ts');
  const words = homePreview(true, true).cardText.split(' ');
  const src = readFileSync(new URL('app/home-card/route.tsx', ROOT), 'utf8');
  assert.match(src, /export const homeCardPx = \(pub: boolean\) => \(pub \? 52 : 60\);/);
  assert.match(src, /fontSize: homeCardPx\(pub\)/);
  const width = 1200 - 2 * 80, px = 52, lineH = px * 1.25;
  let lines = 1, cur = 0;
  for (const w of words) {
    const ww = textWidth(w, px) * HEAD_HEADROOM, sp = textWidth(' ', px);
    if (cur && cur + sp + ww > width) { lines++; cur = ww; } else cur += (cur ? sp : 0) + ww;
  }
  assert.ok(lines * lineH <= 630 - 2 * 80, `${lines} lines`);
});
