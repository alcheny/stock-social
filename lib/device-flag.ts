// F-13: two device flags for UI state the viewer asked for (the first-visit line dismissed, the swipe hint seen).
// Constant values, no identifier, no timestamp, never sent to the server, no cookie (POLICY P6). Every storage access,
// including reading `window.localStorage` itself (it throws SecurityError when site data is blocked), is wrapped:
// localStorage, then sessionStorage, then memory for the page's lifetime. Nothing here throws.

export const FLAGS = {
  line: { key: 'ss.firstVisitLine', value: 'dismissed', token: 'line' },
  hint: { key: 'ss.swipeHint', value: 'seen', token: 'hint' },
} as const;
export type FlagName = keyof typeof FLAGS;

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };
type Host = { localStorage?: Store; sessionStorage?: Store };
const STORES = ['localStorage', 'sessionStorage'] as const;

export function deviceFlags(host: () => Host | undefined) {
  const memory = new Map<string, string>();
  const store = (name: (typeof STORES)[number]): Store | null => {
    try { return host()?.[name] ?? null; } catch { return null; }
  };
  return {
    get(key: string): string | null {
      for (const n of STORES) {
        try { const v = store(n)?.getItem(key); if (v != null) return v; } catch { /* blocked: try the next */ }
      }
      return memory.get(key) ?? null;
    },
    set(key: string, value: string): void {
      memory.set(key, value);
      for (const n of STORES) {
        try { const s = store(n); if (s) { s.setItem(key, value); return; } } catch { /* blocked or full: try the next */ }
      }
    },
  };
}

type Attrs = { getAttribute(k: string): string | null; setAttribute(k: string, v: string): void };

// `<html data-ss-seen="line hint">`: the stylesheet hides what the viewer already dismissed or used.
export function addSeenToken(el: Attrs | null | undefined, token: string): void {
  try {
    if (!el) return;
    const now = (el.getAttribute('data-ss-seen') ?? '').split(' ').filter(Boolean);
    if (!now.includes(token)) el.setAttribute('data-ss-seen', [...now, token].join(' '));
  } catch { /* never throws */ }
}

// The pre-paint script (app/layout.tsx, with the request nonce): sets the tokens before the first paint, so a returning
// visitor never sees the line or the hint flash. Same try/catch chain as deviceFlags; reads only, writes no storage.
const KEYS = Object.fromEntries(Object.values(FLAGS).map((f) => [f.key, f.token]));
export const SEEN_SCRIPT = `(function(){try{var k=${JSON.stringify(KEYS)},t=[];function g(n,x){try{var s=window[n];return s?s.getItem(x):null}catch(e){return null}}for(var x in k){if(g("localStorage",x)!=null||g("sessionStorage",x)!=null)t.push(k[x])}if(t.length)document.documentElement.setAttribute("data-ss-seen",t.join(" "))}catch(e){}})()`;
