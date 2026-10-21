'use client';
import { useEffect, useState } from 'react';
import { markSharePromptSeen, recordSharePromptAction } from '../../actions.ts';
import { ShareButton } from '../../share-button.tsx';

type Props = { handle: string; displayName: string; trades: number; range: string | null; isNew: boolean };

const best = (p: Promise<unknown>) => p.catch((e) => console.error('share prompt record failed', e));

export function SharePrompt({ handle, displayName, trades, range, isNew }: Props) {
  const [open, setOpen] = useState(true);
  const [done, setDone] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => { best(markSharePromptSeen()); }, [handle]);

  if (!open) return null;

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
        Public: your win rate, average return and each closed trade as a percentage, losses included. Never sizes, prices or balances. Your broker login stays private.
      </p>
      {isNew && (
        <p className="muted note" style={{ margin: 0 }}>
          {trades === 0
            ? 'You have no closed trades yet. Your card will show an empty record until you close a position.'
            : `A short record means wide uncertainty. You have ${trades} closed trade${trades === 1 ? '' : 's'} so far, and the card is labelled New record.${range ? ` Right now the range is ${range}.` : ''}`}
        </p>
      )}
      <div className="actions">
        <ShareButton url={`/u/${handle}`} title={`${displayName} on Stock Social`} label="Share my record" image={`/u/${handle}/story?format=square`}
          onShared={(how) => { setDone(true); best(recordSharePromptAction(how)); }} />
        <button type="button" className="link" onClick={close}>{done ? 'Done' : 'Not now'}</button>
      </div>
    </section>
  );
}
