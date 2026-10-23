'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RECORD_BODY } from '@/lib/copy.ts';
import { counting, headline, initBanner, onPoll, onServer, onTick, onUnauthorized, onVisibility, polls, POLL_MS, slowText, type Banner } from '@/lib/import-banner.ts';

// S5 (plan §2, §8 item 2): the import banner, live. The owner's open tab polls POST /api/import/step every 2 s (each
// poll also advances the import); visitors see the server's line, refreshed with the page. The status line is the only
// live region and is announced at most once per 5 s (lib/import-banner.ts); the activities line (owner only) follows
// every step; the 60 s line tells the owner the import continues without the tab. A hidden tab does not poll (each poll
// advances the import); it resumes on return.
// Fix round 2: on finish the banner keeps only its status line, which reads "Import finished." (announced once) for 5 s,
// then the banner is gone; while "Your record is live." shows (`quiet`), the note is visually hidden but still
// announced, so exactly one of the two is seen. A 429 is "nothing new"; a 401/403 stops polling and says so.
export function ImportBanner({ state, closes, read, owner, quiet = false }: { state: string; closes: number; read: number; owner: boolean; quiet?: boolean }) {
  const router = useRouter();
  const [b, setB] = useState<Banner>(() => initBanner({ state, closes, read, owner }, Date.now()));
  // Sticky: the prompt marks itself seen on mount, and the refresh that follows no longer reports it, though it stays.
  const [hush, setHush] = useState(quiet);
  useEffect(() => { if (quiet) setHush(true); }, [quiet]);
  const refreshed = useRef(b.refreshes);

  // A refresh brings the server's view: fold it in (it can report the end before the next poll does).
  useEffect(() => { setB((x) => onServer(x, { state, closes, read }, Date.now())); }, [state, closes, read]);

  useEffect(() => {
    const sync = () => setB((x) => onVisibility(x, document.visibilityState !== 'hidden', Date.now()));
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  const polling = polls(b);
  const resumed = useRef(false);
  useEffect(() => {
    if (!polling) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const r = await fetch('/api/import/step', { method: 'POST' });
        if (r.status === 401 || r.status === 403) { if (!stopped) setB(onUnauthorized); return; }
        if (r.ok) {
          const j = (await r.json()) as { state: string; closes: number; read: number; waiting?: boolean };
          if (!stopped) setB((x) => onPoll(x, j, Date.now()));
        }
      } catch { /* offline: the count is kept, the next poll retries */ }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    // Back from hidden: poll at once; on mount, after the usual interval.
    timer = setTimeout(poll, resumed.current ? 0 : POLL_MS);
    resumed.current = true;
    return () => { stopped = true; clearTimeout(timer); };
  }, [polling]);

  // Commits a held announcement when its 5 s window ends, the 60 s line, and the end of the finished note.
  useEffect(() => {
    if (b.phase === 'hidden') return;
    const t = setInterval(() => setB((x) => onTick(x, Date.now())), 1_000);
    return () => clearInterval(t);
  }, [b.phase]);

  useEffect(() => {
    if (b.refreshes === refreshed.current) return;
    refreshed.current = b.refreshes;
    router.refresh();
  }, [b.refreshes, router]);

  if (b.phase === 'hidden') return null;
  const finished = b.phase === 'finished';
  const statusClass = finished ? (b.text === RECORD_BODY.finished ? `import-finished${hush ? ' sr-only' : ''}` : 'import-ending') : 'importing';
  return (
    <div className="import-banner" data-phase={b.phase}>
      {/* Fix round 7: before the first close the owner sees the activities read (updated every step, not announced); the
          status line stays the live region, visually hidden meanwhile, so a screen reader hears what it heard before. */}
      <p role="status" aria-live="polite" className={counting(b) ? 'sr-only' : statusClass}>{b.text}</p>
      {counting(b) && <p className="importing import-head" aria-hidden="true">{headline(b)}</p>}
      {!finished && owner && <p className="muted small import-read">{RECORD_BODY.imported(b.read)}</p>}
      {/* PR-3 fix round 4 (UX lead note 1): the same count for a screen reader, throttled with the status line. */}
      {!finished && owner && <p className="sr-only import-read-live" aria-live="polite">{b.readText}</p>}
      {!finished && owner && <p className="muted small import-slow" aria-live="polite">{slowText(b)}</p>}
      {b.signedOut && <p className="small import-signed-out">{RECORD_BODY.signedOut} <a className="tap" href="/login">{RECORD_BODY.signInAgain}</a></p>}
    </div>
  );
}
