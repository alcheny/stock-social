'use client';
// F-3 (committee K17): after checkout the page checks the app's own row every 2 s, up to 60 s. Access comes only from
// the webhook-written row, never from the return URL. Text only, no animation; it never offers to pay again.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export function Activating({ waiting, slow, checkAgain }: { waiting: string; slow: string; checkAgain: string }) {
  const router = useRouter();
  const started = useRef(Date.now());
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() - started.current >= 60_000) { setLate(true); clearInterval(t); return; }
      router.refresh();
    }, 2_000);
    return () => clearInterval(t);
  }, [router]);
  return late
    ? <div role="status"><p>{slow}</p><p><a className="button secondary" href="/account?activating=1">{checkAgain}</a></p></div>
    : <p role="status">{waiting}</p>;
}
