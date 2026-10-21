'use client';
import { useEffect, useRef, useState } from 'react';
import { markBadgeCopied } from '../../actions.ts';
import { snippet, type Format } from '@/lib/badge-snippet.ts';

export function BadgeEmbed({ handle, verified = true }: { handle: string; verified?: boolean }) {
  const [format, setFormat] = useState<Format>('markdown');
  const [origin, setOrigin] = useState('');
  const [status, setStatus] = useState('');
  const counted = useRef(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const text = snippet(format, origin, handle, verified);

  async function copy(f: Format) {
    const value = snippet(f, origin, handle, verified);
    try {
      await navigator.clipboard.writeText(value);
      setStatus('Copied');
    } catch {
      setStatus("Couldn't copy, select the text above");
      return;
    }
    if (!counted.current) {
      counted.current = true;
      markBadgeCopied().catch((e) => console.error('badge copy record failed', e));
    }
  }

  return (
    <details className="badge-embed">
      <summary>Embed your badge</summary>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/u/${handle}/badge.svg`} alt="Your Stock Social badge" width={240} height={56} style={{ display: 'block', width: 240, height: 56, margin: '8px 0' }} />
      <p className="muted small" style={{ margin: 0 }}>Updates itself about once an hour. Shows percentages only: never sizes or prices. Losses show too.</p>
      <div role="group" aria-label="Snippet format" className="actions">
        <button type="button" className={format === 'markdown' ? '' : 'secondary'} aria-pressed={format === 'markdown'} onClick={() => setFormat('markdown')}>Markdown</button>
        <button type="button" className={format === 'html' ? '' : 'secondary'} aria-pressed={format === 'html'} onClick={() => setFormat('html')}>HTML</button>
      </div>
      <textarea readOnly rows={3} value={text} aria-label={`${format === 'markdown' ? 'Markdown' : 'HTML'} snippet`} onFocus={(e) => e.currentTarget.select()} style={{ width: '100%' }} />
      <div className="actions">
        <button type="button" style={{ minHeight: 44 }} onClick={() => copy('markdown')}>Copy Markdown</button>
        <button type="button" style={{ minHeight: 44 }} onClick={() => copy('html')}>Copy HTML</button>
      </div>
      <p role="status" className="muted small" style={{ margin: 0 }}>{status}</p>
    </details>
  );
}
