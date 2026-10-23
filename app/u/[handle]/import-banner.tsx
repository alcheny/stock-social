'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RECORD_BODY } from '@/lib/copy.ts';
import { initBanner, onPoll, onServer, onTick, onVisibility, polls, POLL_MS, type Banner } from '@/lib/import-banner.ts';

// S5 (plan §2, §8 item 2): the import banner, live. The owner's open tab polls POST /api/import/step every 2 s (each
// poll also advances the import); visitors see the server's line, refreshed with the page. The status line is the only
// live region and is announced at most once per 5 s (lib/import-banner.ts); the imported-rows line follows every step;
// the 60 s line tells the owner the import continues without the tab. On the end, "Import finished." replaces the
// status line as one static line until the next navigation, and the page's server data is re-read. Every line keeps its
// box (globals.css), so nothing moves. A hidden tab does not poll (each poll advances the import); it resumes on return.
export function ImportBanner({ state, closes, read, owner }: { state: string; closes: number; read: number; owner: boolean }) {
  const router = useRouter();
  const [b, setB] = useState<Banner>(() => initBanner({ state, closes, read, owner }, Date.now()));
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
        if (r.ok) {
          const j = (await r.json()) as { state: string; closes: number; read: number };
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

  // Commits a held announcement when its 5 s window ends, and the 60 s line.
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
  const finished = b.text === RECORD_BODY.finished;
  return (
    <div className="import-banner" data-phase={b.phase}>
      <p role="status" aria-live="polite" className={finished ? 'import-finished' : 'importing'}>{b.text}</p>
      <p className="muted small import-read">{b.phase === 'finished' ? '' : RECORD_BODY.imported(b.read)}</p>
      {owner && <p className="muted small import-slow" aria-live="polite">{b.slow ? RECORD_BODY.stillSending : ''}</p>}
    </div>
  );
}
