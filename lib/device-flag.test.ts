// F-13: device flags (first-visit line dismissed, swipe hint seen). Never throws, whatever storage does; no cookie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { addSeenToken, deviceFlags, FLAGS, SEEN_SCRIPT } from './device-flag.ts';

const store = () => {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const throwing = () => ({
  getItem: () => { throw new DOMException('denied', 'SecurityError'); },
  setItem: () => { throw new DOMException('denied', 'SecurityError'); },
});
// A host whose storage getters themselves throw (a blocked-storage browser throws on `window.localStorage`).
const blockedHost = () => {
  const h = {};
  for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(h, k, { get() { throw new DOMException('denied', 'SecurityError'); } });
  return h as { localStorage: Storage; sessionStorage: Storage };
};

test('F-13 flags: keys and values are constant strings with no identifier', () => {
  assert.deepEqual(FLAGS, {
    line: { key: 'ss.firstVisitLine', value: 'dismissed', token: 'line' },
    hint: { key: 'ss.swipeHint', value: 'seen', token: 'hint' },
  });
});

test('F-13 flags: a working local store keeps the flag there', () => {
  const local = store(), session = store();
  const f = deviceFlags(() => ({ localStorage: local, sessionStorage: session }));
  assert.equal(f.get('ss.swipeHint'), null);
  f.set('ss.swipeHint', 'seen');
  assert.equal(f.get('ss.swipeHint'), 'seen');
  assert.equal(local.m.get('ss.swipeHint'), 'seen');
  assert.equal(session.m.size, 0);
  // A fresh reader (a reload) sees it.
  assert.equal(deviceFlags(() => ({ localStorage: local, sessionStorage: session })).get('ss.swipeHint'), 'seen');
});

test('F-13 flags: local storage throwing falls back to session storage', () => {
  const session = store();
  const f = deviceFlags(() => ({ localStorage: throwing(), sessionStorage: session }));
  f.set('ss.firstVisitLine', 'dismissed');
  assert.equal(session.m.get('ss.firstVisitLine'), 'dismissed');
  assert.equal(deviceFlags(() => ({ localStorage: throwing(), sessionStorage: session })).get('ss.firstVisitLine'), 'dismissed');
});

test('F-13 flags: both stores throwing keep the flag in memory for the page, never throw', () => {
  const f = deviceFlags(() => ({ localStorage: throwing(), sessionStorage: throwing() }));
  assert.doesNotThrow(() => f.set('ss.firstVisitLine', 'dismissed'));
  assert.equal(f.get('ss.firstVisitLine'), 'dismissed');
  // A reload (a new reader) starts clean: shown again.
  assert.equal(deviceFlags(() => ({ localStorage: throwing(), sessionStorage: throwing() })).get('ss.firstVisitLine'), null);
});

test('F-13 flags: storage getters that throw, a missing host and a throwing host are all handled', () => {
  for (const host of [blockedHost, () => undefined, () => { throw new Error('no window'); }]) {
    const f = deviceFlags(host as () => undefined);
    assert.doesNotThrow(() => f.get('ss.swipeHint'));
    assert.doesNotThrow(() => f.set('ss.swipeHint', 'seen'));
    assert.equal(f.get('ss.swipeHint'), 'seen');
  }
});

test('F-13 addSeenToken: adds a token once, keeps the others, never throws', () => {
  const attrs = new Map<string, string>();
  const el = { getAttribute: (k: string) => attrs.get(k) ?? null, setAttribute: (k: string, v: string) => void attrs.set(k, v) };
  addSeenToken(el, 'line');
  addSeenToken(el, 'line');
  addSeenToken(el, 'hint');
  assert.equal(attrs.get('data-ss-seen'), 'line hint');
  assert.doesNotThrow(() => addSeenToken(null, 'line'));
  assert.doesNotThrow(() => addSeenToken({ getAttribute: () => { throw new Error('x'); }, setAttribute: () => {} }, 'line'));
});

// The pre-paint script, run as the browser would, with fake stores.
function runScript(win: Record<string, unknown>) {
  const attrs = new Map<string, string>();
  const documentElement = { getAttribute: (k: string) => attrs.get(k) ?? null, setAttribute: (k: string, v: string) => void attrs.set(k, v) };
  const ctx: Record<string, unknown> = { document: { documentElement } };
  for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(win))) Object.defineProperty(ctx, k, d);
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SEEN_SCRIPT, ctx);
  return attrs.get('data-ss-seen');
}

test('F-13 SEEN_SCRIPT: sets the tokens for the flags present, in local or session storage', () => {
  const local = store(), session = store();
  assert.equal(runScript({ localStorage: local, sessionStorage: session }), undefined);
  local.setItem('ss.firstVisitLine', 'dismissed');
  assert.equal(runScript({ localStorage: local, sessionStorage: session }), 'line');
  session.setItem('ss.swipeHint', 'seen');
  assert.equal(runScript({ localStorage: local, sessionStorage: session }), 'line hint');
  assert.equal(runScript({ localStorage: throwing(), sessionStorage: session }), 'hint');
});

test('F-13 SEEN_SCRIPT: never throws with storage blocked or missing', () => {
  assert.doesNotThrow(() => runScript(blockedHost()));
  assert.equal(runScript(blockedHost()), undefined);
  assert.equal(runScript({}), undefined);
  assert.equal(runScript({ localStorage: throwing(), sessionStorage: throwing() }), undefined);
  assert.doesNotMatch(SEEN_SCRIPT, /cookie|fetch|XMLHttpRequest|sendBeacon/);
});
