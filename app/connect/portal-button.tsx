'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { PORTAL } from '@/lib/copy.ts';
import { parsePortalMessage, prefersRedirect, PORTAL_LINK_MS, PORTAL_SLOW_MS } from '@/lib/portal.ts';

// S3 (docs/features/logs/F-1/plan.md §2, §8 item 1): the vendor's portal in a modal dialog over S2. The primary is a
// plain link to the redirect flow, so without script, in an in-app browser or installed to the home screen it simply
// navigates. Otherwise it opens a native modal <dialog> (the page behind is inert; focus moves to Close, Tab wraps
// inside, Escape or Close returns focus to the primary while nothing has loaded, and after load means "closed without
// a link" → /connect/done, which shows consent if a link did happen and S7a otherwise). The portal URL comes only from
// POST /connect/portal; messages count only from that URL's origin and that frame. SUCCESS / CLOSED / ABANDONED go to
// /connect/done?m=embedded; ERROR (a blocked broker popup reports itself this way) falls back to the redirect flow on
// the same attempt, as does the persistent "Open in a new page instead" link, promoted to a button after 8 s of loading.
const REDIRECT = '/connect/start';
const DONE = '/connect/done?m=embedded';
const FRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';

export function PortalButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const [portal, setPortal] = useState<{ url: string; origin: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const primary = useRef<HTMLAnchorElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const live = useRef({ open: false, loaded: false, leaving: false, seq: 0 });

  const leave = (href: string) => {
    if (live.current.leaving) return;
    live.current.leaving = true;
    window.location.assign(href);
  };
  const reset = () => {
    live.current = { ...live.current, open: false, loaded: false, seq: live.current.seq + 1 };
    if (dialog.current?.open) dialog.current.close();
    document.documentElement.classList.remove('portal-open');
    setOpen(false); setPortal(null); setLoaded(false); setSlow(false); setPromoted(false);
    primary.current?.focus();
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
    if (live.current.open) return;
    const seq = live.current.seq + 1;
    live.current = { open: true, loaded: false, leaving: false, seq };
    setOpen(true);
    try {
      const r = await fetch('/connect/portal', { method: 'POST', headers: { accept: 'application/json' } });
      const j = r.ok ? ((await r.json()) as { url?: unknown; origin?: unknown }) : null;
      if (live.current.seq !== seq) return; // closed meanwhile
      if (typeof j?.url !== 'string' || typeof j?.origin !== 'string') return leave(REDIRECT);
      setPortal({ url: j.url, origin: j.origin });
    } catch {
      if (live.current.seq === seq) leave(REDIRECT);
    }
  }

  useEffect(() => {
    if (!open || !dialog.current) return;
    if (!dialog.current.open) dialog.current.showModal();
    document.documentElement.classList.add('portal-open');
    closeButton.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || loaded) return;
    const a = setTimeout(() => setSlow(true), PORTAL_SLOW_MS);
    const b = setTimeout(() => setPromoted(true), PORTAL_LINK_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [open, loaded]);

  useEffect(() => {
    if (!portal) return;
    const onMessage = (ev: MessageEvent) => {
      if (!frame.current || ev.source !== frame.current.contentWindow) return;
      const m = parsePortalMessage({ origin: ev.origin, data: ev.data }, portal.origin);
      if (m) leave(m.kind === 'error' ? REDIRECT : DONE);
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

  return (
    <>
      <p>
        <a ref={primary} className="button wide" href={REDIRECT} onClick={start} aria-busy={open || undefined} aria-disabled={open || undefined} data-testid="connect-primary">
          {open ? PORTAL.opening : label}
        </a>
      </p>
      <dialog ref={dialog} className="portal" aria-labelledby="portal-title" onKeyDown={trap}
        onCancel={(e) => { e.preventDefault(); dismiss(); }} onClose={() => { if (live.current.open && !live.current.leaving) dismiss(); }}>
        {open && <>
          <header>
            <h2 id="portal-title">{PORTAL.title}</h2>
            <button ref={closeButton} type="button" className="secondary" onClick={dismiss}>{PORTAL.close}</button>
          </header>
          <div className="portal-body" aria-busy={!loaded}>
            {!loaded && <p className="portal-status" role="status">{PORTAL.opening}{slow && <> {PORTAL.slow}</>}</p>}
            {portal && (
              <iframe ref={frame} className={loaded ? undefined : 'loading'} title={PORTAL.frameTitle} src={portal.url} sandbox={FRAME_SANDBOX}
                referrerPolicy="strict-origin-when-cross-origin" onLoad={() => { live.current.loaded = true; setLoaded(true); }} />
            )}
          </div>
          <p className="portal-alt">
            <a href={REDIRECT} className={promoted ? 'button wide' : undefined} onClick={() => { live.current.leaving = true; }}>{PORTAL.newPage}</a>
          </p>
        </>}
      </dialog>
    </>
  );
}
