'use client';
// FIXES-CYCLE5 part 2 (C5-34): the owner's preview of the picture the Share button attaches, at the one path both use
// (lib/share-image.ts#shareImagePath, passed as `src` by the two owner boxes beside their Share button's `image`).
// Width and height are set, so the box never shifts while it loads; the image is not focusable; its alt is the square
// card in words (lib/record-card.ts#cardAlt). If it fails, the line below shows and sharing still works.
import { useEffect, useRef, useState } from 'react';

export const PREVIEW_FAILED = 'Preview unavailable. Your link still works.';

export function SharePreview({ src, alt, lazy }: { src: string; alt: string; lazy: boolean }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // An error that fired before hydration never reaches onError: a finished image with no pixels is a failure too.
  useEffect(() => { const el = img.current; if (el && el.complete && el.naturalWidth === 0) setFailed(true); }, []);
  if (failed) return <p className="muted">{PREVIEW_FAILED}</p>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={img} className="preview" src={src} width={1080} height={1080} loading={lazy ? 'lazy' : 'eager'} decoding="async"
    onError={() => setFailed(true)} alt={alt} />;
}
