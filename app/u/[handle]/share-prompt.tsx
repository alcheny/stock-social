'use client';
import { useEffect, useRef, useState } from 'react';
import { markSharePromptSeen, recordSharePromptAction } from '../../actions.ts';

type Props = { handle: string; displayName: string; trades: number; range: string | null; isNew: boolean };

const best = (p: Promise<unknown>) => p.catch((e) => console.error('share prompt record failed', e));

export function SharePrompt({ handle, displayName, trades, range, isNew }: Props) {
  const [open, setOpen] = useState(true);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [url, setUrl] = useState(`/u/${handle}`);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}/u/${handle}`);
    setCanShare(typeof navigator.share === 'function');
    best(markSharePromptSeen());
  }, [handle]);

  if (!open) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      field.current?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setDone(true);
    setTimeout(() => setCopied(false), 2000);
    best(recordSharePromptAction('copied'));
  }

  async function share() {
    try {
      await navigator.share({ title: `${displayName} on Stock Social`, text: 'My verified trading record on Stock Social', url });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') console.error(e);
      return;
    }
    setDone(true);
    best(recordSharePromptAction('shared'));
  }

  function close() {
    if (!done) best(recordSharePromptAction('dismissed'));
    setOpen(false);
  }

  return (
    <section className="share-prompt" aria-labelledby="share-h">
      <h2 id="share-h" style={{ margin: 0 }}>Your record is live.</h2>
      <p className="muted" style={{ margin: 0 }}>Anyone with your link can see it, signed in or not.</p>
      {imgFailed ? (
        <p className="muted">Preview unavailable. Your link still works.</p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="preview" src={`/u/${handle}/opengraph-image`} width={1200} height={630} loading="eager" onError={() => setImgFailed(true)}
          alt={`Preview of your share card: ${displayName}, ${trades} verified trade${trades === 1 ? '' : 's'}`} />
      )}
      <p style={{ margin: 0 }}>
        Public: your win rate, average return and each closed trade as a percentage. Never share sizes, prices or balances. Your broker login stays private. Losses show alongside gains.
      </p>
      {isNew && (
        <p className="muted note" style={{ margin: 0 }}>
          {trades === 0
            ? 'You have no closed trades yet. Your card will show an empty record until you close a position.'
            : `A short record means wide uncertainty. You have ${trades} closed trade${trades === 1 ? '' : 's'} so far, and the card is labelled New record.${range ? ` Right now the range is ${range}.` : ''}`}
        </p>
      )}
      <div className="actions">
        <button type="button" onClick={copy}>{copied ? 'Link copied' : 'Copy link'}</button>
        {canShare && <button type="button" className="secondary" onClick={share}>Share…</button>}
        <button type="button" className="link" onClick={close}>{done ? 'Done' : 'Not now'}</button>
      </div>
      <span aria-live="polite" className="sr-only">{copied ? 'Link copied' : ''}</span>
      <input ref={field} readOnly value={url} aria-label="Your profile link" onFocus={(e) => e.currentTarget.select()} />
    </section>
  );
}
