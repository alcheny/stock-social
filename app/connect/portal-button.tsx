'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { PORTAL } from '@/lib/copy.ts';
import { parsePortalMessage, portalTarget, portalView, prefersRedirect, PORTAL_BLANK_MS, PORTAL_DONE, PORTAL_LINK_MS, PORTAL_MINT_GRACE_MS, PORTAL_REDIRECT, PORTAL_SLOW_MS } from '@/lib/portal.ts';

// S3 (docs/features/logs/F-1/plan.md §2, §8 item 1): the vendor's portal in a modal dialog over S2. The primary is a
// plain link to the redirect flow, so without script, in an in-app browser or installed to the home screen it simply
// navigates. Otherwise the tap asks POST /connect/portal for a URL minted for this trader, and the server says how to
// open it (fix round 2): 'redirect' when the vendor's headers refuse framing (the browser goes to the minted URL; no
// dialog), 'embedded' otherwise. Embedded opens a native modal <dialog> (the page behind is inert; focus moves to
// Close, Tab wraps inside, Escape or Close returns focus to the primary while nothing has loaded, and after load means
// "closed without a link" → /connect/done, which shows consent if a link did happen and S7a otherwise). The dialog also
// opens if the mint takes longer than PORTAL_MINT_GRACE_MS, so the loading rules have somewhere to show. Messages count
// only from the minted URL's origin and that frame. SUCCESS / CLOSED / ABANDONED go to /connect/done?m=embedded; ERROR
// (a blocked broker popup reports itself this way) goes to /connect/continue, which says so and continues by redirect.
// What the dialog shows is lib/portal.ts#portalView: before load "Opening…", the 3 s line, the link promoted to the
// primary at 8 s; after load never a slow line or a filled primary, and after 8 s of silence "Page blank? Open it in a
// new page." beside the secondary button. The primary behind the dialog says "Opening…" only while the mint runs.
const REDIRECT = PORTAL_REDIRECT;
const DONE = PORTAL_DONE;
const FRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';
type Phase = 'idle' | 'minting' | 'open';

export function PortalButton({ label }: { label: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [portal, setPortal] = useState<{ url: string; origin: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [handshake, setHandshake] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [errored, setErrored] = useState(false);
  const [limited, setLimited] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const primary = useRef<HTMLAnchorElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const live = useRef({ started: false, open: false, loaded: false, leaving: false, seq: 0 });

  const leave = (href: string) => {
    if (live.current.leaving) return;
    live.current.leaving = true;
    window.location.assign(href);
  };
  const reset = () => {
    live.current = { ...live.current, started: false, open: false, loaded: false, seq: live.current.seq + 1 };
    if (dialog.current?.open) dialog.current.close();
    document.documentElement.classList.remove('portal-open');
    setPhase('idle'); setPortal(null); setLoaded(false); setSlow(false); setPromoted(false); setHandshake(false); setStuck(false); setErrored(false);
    primary.current?.focus();
  };
  const show = () => {
    if (live.current.open) return;
    live.current.open = true;
    setPhase('open');
  };
  // Escape or Close: before the portal has loaded nothing has started, so the dialog closes and focus returns; after,
  // the server decides between consent (a link happened) and S7a.
  const dismiss = () => {
    if (live.current.leaving || !live.current.open) return;
    if (live.current.loaded) leave(DONE);
    else reset();
  };

  async function start(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
    if (prefersRedirect(navigator.userAgent, standalone)) return; // the link's own navigation: the redirect flow
    e.preventDefault();
    if (live.current.started) return;
    const seq = live.current.seq + 1;
    live.current = { started: true, open: false, loaded: false, leaving: false, seq };
    setLimited(false);
    setPhase('minting');
    const grace = setTimeout(() => { if (live.current.seq === seq) show(); }, PORTAL_MINT_GRACE_MS);
    try {
      const r = await fetch('/connect/portal', { method: 'POST', headers: { accept: 'application/json' } });
      if (live.current.seq !== seq) return; // closed meanwhile
      if (r.status === 429) { clearTimeout(grace); reset(); setLimited(true); return; }
      const j = r.ok ? ((await r.json()) as { url?: unknown; origin?: unknown; mode?: unknown }) : null;
      if (live.current.seq !== seq) return;
      clearTimeout(grace);
      if (typeof j?.url !== 'string' || typeof j?.origin !== 'string') return leave(REDIRECT);
      // The vendor refuses to be framed (the server read its headers): go to the minted page itself, no dialog.
      if (j.mode === 'redirect') return leave(sameOrigin(j.url, j.origin) ? j.url : REDIRECT);
      setPortal({ url: j.url, origin: j.origin });
      show();
    } catch {
      clearTimeout(grace);
      if (live.current.seq === seq) leave(REDIRECT);
    }
  }

  useEffect(() => {
    if (phase !== 'open' || !dialog.current) return;
    if (!dialog.current.open) dialog.current.showModal();
    document.documentElement.classList.add('portal-open');
    closeButton.current?.focus();
  }, [phase]);

  // The before-load rules count from the tap.
  const started = phase !== 'idle';
  useEffect(() => {
    if (!started || loaded) return;
    const a = setTimeout(() => setSlow(true), PORTAL_SLOW_MS);
    const b = setTimeout(() => setPromoted(true), PORTAL_LINK_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [started, loaded]);

  // Loaded but silent: no message from the portal within 8 s of the load (a working portal may wait for the trader; a
  // refused frame loads blank). Only the quiet footer line follows, never an alarm.
  useEffect(() => {
    if (!started || !loaded || handshake) return;
    const t = setTimeout(() => setStuck(true), PORTAL_BLANK_MS);
    return () => clearTimeout(t);
  }, [started, loaded, handshake]);

  useEffect(() => {
    if (!portal) return;
    const onMessage = (ev: MessageEvent) => {
      if (!frame.current || ev.source !== frame.current.contentWindow || ev.origin !== portal.origin) return;
      setHandshake(true); // the portal has spoken: it is working, whatever it said
      const m = parsePortalMessage({ origin: ev.origin, data: ev.data }, portal.origin);
      if (m) leave(portalTarget(m));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [portal]);

  // Tab and Shift+Tab wrap inside the dialog (the browser already makes the page behind it inert).
  const trap = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Tab' || !dialog.current) return;
    const els = [...dialog.current.querySelectorAll<HTMLElement>('button, a[href], iframe')].filter((x) => x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden');
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const view = portalView({ loaded, handshake, slow, promoted, stuck, errored });
  const minting = phase === 'minting';
  return (
    <>
      <p>
        <a ref={primary} className="button wide" href={REDIRECT} onClick={start} aria-busy={minting || undefined} aria-disabled={minting || undefined} data-testid="connect-primary">
          {minting ? PORTAL.opening : label}
        </a>
      </p>
      {limited && <p role="alert" className="small">{PORTAL.tooMany}</p>}
      <dialog ref={dialog} className="portal" aria-labelledby="portal-title" onKeyDown={trap}
        onCancel={(e) => { e.preventDefault(); dismiss(); }} onClose={() => { if (live.current.open && !live.current.leaving) dismiss(); }}>
        {phase === 'open' && <>
          <header>
            <h2 id="portal-title">{PORTAL.title}</h2>
            <button ref={closeButton} type="button" className="secondary" onClick={dismiss}>{PORTAL.close}</button>
          </header>
          <div className="portal-body">
            {view.line === 'opening' || view.line === 'opening-slow'
              ? <p className="portal-status" role="status">{PORTAL.opening}{view.line === 'opening-slow' && <> {PORTAL.slow}</>}</p>
              : null}
            {portal && (
              <iframe ref={frame} className={loaded ? undefined : 'loading'} title={PORTAL.frameTitle} src={portal.url} sandbox={FRAME_SANDBOX} aria-busy={!loaded}
                referrerPolicy="strict-origin-when-cross-origin" onLoad={() => { live.current.loaded = true; setLoaded(true); }} onError={() => setErrored(true)} />
            )}
          </div>
          <div className="portal-alt">
            {view.line === 'blank' && <p className="portal-blank" role="status">{PORTAL.blank}</p>}
            <a href={REDIRECT} data-control={view.control} className={view.control === 'primary' ? 'button wide' : view.control === 'secondary' ? 'button secondary' : undefined}
              onClick={() => { live.current.leaving = true; }}>{PORTAL.newPage}</a>
          </div>
        </>}
      </dialog>
    </>
  );
}

// The minted URL is navigated to only when it is on the origin the server vouched for.
function sameOrigin(url: string, origin: string): boolean {
  try { return new URL(url).origin === origin; } catch { return false; }
}
