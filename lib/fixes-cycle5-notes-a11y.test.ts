// FIXES-CYCLE5 (F5-24, F5-25, F5-26, F5-2 alert): the note field's label, size, name and counter; the trade page's edit
// link names that field; static failed-import notices carry no live role; the handle field autocompletes as a username;
// the profile's "changed" alert. Source pins plus server renders of the client parts (SWC, as lib/f27-colour-follow-ups).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { FC5 } from './copy.ts';

const ROOT = new URL('..', import.meta.url);
const require = createRequire(import.meta.url);
const swc = require('next/dist/build/swc') as { loadBindings: () => Promise<unknown>; transformSync: (src: string, o: object) => { code: string } };
await swc.loadBindings();
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) return next(new URL(spec.slice(2), ROOT).href, ctx);
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
const mod = (p: string) => import(pathToFileURL(new URL(p, ROOT).pathname).href);
const read = (p: string) => readFileSync(new URL(p, ROOT), 'utf8');
const page = read('app/u/[handle]/page.tsx');
const lineWith = (s: string, needle: string) => s.split('\n').find((l) => l.includes(needle)) ?? '';

test('F5-24: the note field is a 3-row textarea with a visible label "Your note", named for its symbol, described by its count', () => {
  assert.doesNotMatch(page, /<input type="text" name="thesis"/);
  const field = lineWith(page, 'name="thesis"');
  assert.match(field, /^\s*<textarea id=\{`note-\$\{t\.trade_key\}`\} name="thesis" rows=\{3\} /);
  assert.match(field, / maxLength=\{280\} defaultValue=\{t\.thesis \?\? ''\} /);
  assert.match(field, / aria-label=\{FC5\.noteName\(t\.symbol\)\} /);
  // The count describes the field; a held note's reason replaces it (#100's spread, after ours, byte-for-byte).
  assert.match(field, / aria-describedby=\{`count-\$\{t\.trade_key\}`\} \{\.\.\.\(t\.thesis_status === 'held' && !!t\.thesis \? \{ 'aria-describedby': `held-\$\{t\.id\}`, 'aria-invalid': true \} : \{\}\)\} \/>/);
  assert.match(page, /<label htmlFor=\{`note-\$\{t\.trade_key\}`\} className="note-label"[^>]*>\{FC5\.noteLabel\}<\/label>/);
  assert.match(page, /<HeldNote rule=\{t\.thesis_hold_rule\} id=\{`held-\$\{t\.id\}`\} \/>/);
  assert.match(page, /<NoteField id=\{`note-\$\{t\.trade_key\}`\} countId=\{`count-\$\{t\.trade_key\}`\} initial=\{\(t\.thesis \?\? ''\)\.length\}/);
  // The accessible name starts with the visible label and never says "thesis" (committee round 3 item 8).
  assert.equal(FC5.noteName('ACME'), 'Your note on ACME');
  assert.ok(FC5.noteName('ACME').startsWith(FC5.noteLabel));
  assert.doesNotMatch(FC5.noteName('ACME'), /thesis/i);
});

test('F5-24: the counter is rendered on the server from the saved note\'s length; the spoken line starts empty', async () => {
  const { NoteField } = await mod('app/u/[handle]/note-field.tsx') as typeof import('../app/u/[handle]/note-field.tsx');
  const html = renderToStaticMarkup(createElement(NoteField, { id: 'note-k', countId: 'count-k', initial: 37 }));
  assert.match(html, /<span id="count-k" class="muted small note-count">37 of 280<\/span>/);
  assert.match(html, /<span aria-live="polite" class="muted small note-say" data-note-say="" style="order:1;flex-basis:100%"><\/span>/);
  assert.doesNotMatch(html.match(/<span id="count-k"[^>]*>/)![0], /aria-live|role=/, 'the count is not a live region');
  assert.equal(FC5.noteCount(0), '0 of 280');
  // The three spoken lines, and nothing else is spoken (source: the only setSay values).
  const src = read('app/u/[handle]/note-field.tsx');
  const said = [...src.matchAll(/setSay\(([^)]*)\)/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(said)], ["''", 'FC5.noteFull', 'FC5.noteNear', 'FC5.notePasteCut'].sort());
});

test('F5-24: "Edit it on your profile" names the note field by trade key, built from the window part (never by rewriting tradeHref)', () => {
  const own = read('lib/own-note.ts');
  assert.match(own, /const noteHref = \(linkBase: string, key: string, index: number\) => `\$\{linkBase\}\?closes=\$\{windowOf\(index\)\}#note-\$\{key\}`;/);
  assert.doesNotMatch(own.replace(/\/\/[^\n]*/g, ''), /tradeHref|\.replace\(/);
  assert.match(own, /select t\.trade_key, /);
  const focus = read('app/u/[handle]/row-focus.tsx');
  assert.match(focus, /\/\^note-\[0-9a-f\]\{64\}\$\/\.test\(id\)/);
  assert.match(focus, /\/\^trade-\\d\+\$\/\.test\(id\)/, 'the row anchor still focuses its row');
});

test('F5-26: the change-handle field autocompletes as a username', () => {
  assert.match(lineWith(page, 'id="new-handle"'), /<input id="new-handle" [^>]*autoComplete="username"/);
});

test('F5-25: WarnNotice renders a role only when given; no static site passes one', async () => {
  const { WarnNotice } = await mod('app/warn-notice.tsx') as typeof import('../app/warn-notice.tsx');
  const plain = renderToStaticMarkup(createElement(WarnNotice, { children: 'Words.' }));
  assert.match(plain, /^<p class="warn-notice record-failed">/);
  assert.doesNotMatch(plain, /role=/);
  assert.match(renderToStaticMarkup(createElement(WarnNotice, { role: 'status', children: 'Words.' })), /^<p role="status" class="warn-notice record-failed">/);
  assert.match(renderToStaticMarkup(createElement(WarnNotice, { role: 'alert', children: 'Words.' })), /^<p role="alert" class="warn-notice record-failed">/);
  for (const f of ['app/record-strip.tsx', 'app/ui.tsx', 'app/pane.tsx', 'app/u/[handle]/page.tsx']) assert.doesNotMatch(read(f), /<WarnNotice role=/, f);
});

test('F5-2: the "changed" alert is the author\'s only, focused, above the list; the recovery box renders nothing on the server', async () => {
  assert.match(page, /const noteChanged = isMe && \(await searchParams\)\?\.note === 'changed';/);
  const at = page.indexOf('<div id="note-changed"');
  assert.ok(at > 0 && at < page.indexOf('<ul className="rows closes">'), 'the alert sits before the closed-trades list');
  assert.match(page, /<div id="note-changed" role="alert" tabIndex=\{-1\}[^>]*>\s*<p>\{FC5\.noteChanged\}<\/p>\s*<NoteRecovery shownKey=\{changedKey\} \/>\s*<FocusHeading id="note-changed" \/>/);
  assert.match(page, /\{isMe && !noteChanged && <NoteRecovery shownKey=\{null\} \/>\}/);
  assert.doesNotMatch(page.slice(0, at), /FC5\.noteUnsaved\b/, 'the "below" sentence is never on the page itself');
  const { NoteRecovery } = await mod('app/u/[handle]/note-recovery.tsx') as typeof import('../app/u/[handle]/note-recovery.tsx');
  assert.equal(renderToStaticMarkup(createElement(NoteRecovery, { shownKey: 'a'.repeat(64) })), '', 'nothing until the stash is read in the browser');
  const rec = read('app/u/[handle]/note-recovery.tsx');
  assert.doesNotMatch(rec.replace(/\/\/[^\n]*/g, ''), /console\.|localStorage|location|fetch\(/, 'never logged, never sent, never in a URL');
  assert.match(rec, /got\.key === shownKey/);
  assert.equal(FC5.noteChanged, 'Your note was not saved because this trade changed.');
});
