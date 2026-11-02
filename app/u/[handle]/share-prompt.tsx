'use client';
import { useEffect, useState } from 'react';
import { markSharePromptSeen, recordShareAction, recordSharePromptAction } from '../../actions.ts';
import { ShareButton } from '../../share-button.tsx';
import { counted } from '@/lib/format.ts';
import { PUBLIC_SHORT } from '@/lib/copy.ts';
import { PUBLIC_FIELDS } from '@/lib/privacy-fields.ts';
import { withGate } from '@/lib/gate-key.ts'; // F-29 (D3): URL-keyed caches carry the gate state

// range: the card's own "likely between" text (F-4 rework: the range around the average the card prints).
// previewAlt: the card in words, from the card's own model (lib/record-card.ts#cardAlt; F-4 committee round 1, demand
// 9). The old alt said "N verified trades" whatever the record's state.
type Props = { handle: string; displayName: string; trades: number; range: string | null; isNew: boolean; previewAlt: string };

const best = (p: Promise<unknown>) => p.catch((e) => console.error('share prompt record failed', e));

export function SharePrompt({ handle, displayName, trades, range, isNew, previewAlt }: Props) {
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
        <img className="preview" src={withGate(`/u/${handle}/opengraph-image`)} width={1200} height={630} loading="eager" onError={() => setImgFailed(true)}
          alt={previewAlt} />
      )}
      <p style={{ margin: 0 }}>{PUBLIC_SHORT.sharePrompt(PUBLIC_FIELDS.map((f) => f.words))}</p>
      {isNew && (
        <p className="muted note" style={{ margin: 0 }}>
          {trades === 0
            ? 'You have no closed trades yet. Your card will show an empty record until you close a position.'
            : `A short record means wide uncertainty. You have ${counted(trades, 'closed trade')} so far, and the card is labelled New record.${range ? ` Right now your average per trade is ${range}.` : ''}`}
        </p>
      )}
      <div className="actions">
        <ShareButton url={`/u/${handle}`} title={`${displayName} on Stock Social`} label="Share my record" image={withGate(`/u/${handle}/story?format=square`)}
          onShared={(how, picture) => { setDone(true); best(recordSharePromptAction(how)); best(recordShareAction(`/u/${handle}`, how, picture)); }} />
        <button type="button" className="link" onClick={close}>{done ? 'Done' : 'Not now'}</button>
      </div>
    </section>
  );
}
