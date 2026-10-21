'use client';
import { useEffect, useRef, useState } from 'react';
import { absoluteUrl, shareMode } from '@/lib/share.ts';

type Props = {
  url: string; // path, e.g. /u/maya
  title: string;
  label: string;
  image?: string; // path of a PNG to share as a picture where the device supports it
  className?: string;
  onShared?: (how: 'copied' | 'shared') => void; // best-effort tracking; never blocks the share
};

// The product's only share control: one click. Opens the system share sheet (with the image when possible),
// or copies the link where there is no share sheet. Generic label, no platform names (docs/POLICY.md T5).
export function ShareButton({ url, title, label, image, className, onShared }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [link, setLink] = useState(url);
  const field = useRef<HTMLInputElement>(null);
  const file = useRef<File | null>(null);
  useEffect(() => setLink(absoluteUrl(window.location.origin, url)), [url]);
  // Fetch the image ahead of time: some browsers only open the share sheet straight from the click.
  useEffect(() => {
    if (!image || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return;
    let live = true;
    fetch(image).then((r) => (r.ok ? r.blob() : null)).then((blob) => {
      if (!live || !blob) return;
      const f = new File([blob], 'stock-social-record.png', { type: blob.type || 'image/png' });
      if (navigator.canShare({ files: [f] })) file.current = f;
    }).catch(() => { /* share the link instead */ });
    return () => { live = false; };
  }, [image]);

  const done = (how: 'copied' | 'shared') => { try { onShared?.(how); } catch { /* tracking is best-effort */ } };

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
      done('copied');
    } catch {
      setState('failed');
    }
  }

  async function click() {
    const canShare = typeof navigator.share === 'function';
    const mode = shareMode({ canShareFiles: !!file.current, canShare, hasImage: !!image });
    if (mode === 'copy') return copy();
    try {
      await navigator.share(mode === 'files' ? { title, url: link, files: [file.current!] } : { title, url: link });
      done('shared');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') await copy(); // a share sheet that fails still leaves the link copied
    }
  }

  return (
    <span className="share-button">
      <button type="button" className={className} onClick={click}>{state === 'copied' ? 'Link copied' : label}</button>
      <span aria-live="polite" className="sr-only">{state === 'copied' ? 'Link copied' : ''}</span>
      {state === 'failed' && (
        <input ref={field} readOnly value={link} aria-label="Link to share" onFocus={(e) => e.currentTarget.select()} autoFocus />
      )}
    </span>
  );
}
