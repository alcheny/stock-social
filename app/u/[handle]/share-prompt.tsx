'use client';
import { useEffect, useState } from 'react';
import { markSharePromptSeen, recordShareAction, recordSharePromptAction } from '../../actions.ts';
import { ShareButton } from '../../share-button.tsx';
import { SharePreview } from './share-preview.tsx'; // FIXES-CYCLE5 part 2 (C5-34)
import { shareImagePath } from '@/lib/share-image.ts';
import { counted } from '@/lib/format.ts';
import { PUBLIC_SHORT } from '@/lib/copy.ts';
import { PUBLIC_FIELDS } from '@/lib/privacy-fields.ts';

// range: the card's own "likely between" text (F-4 rework: the range around the average the card prints).
// previewAlt: the card in words, from the card's own model (lib/record-card.ts#cardAlt; F-4 committee round 1, demand
// 9). The old alt said "N verified trades" whatever the record's state.
type Props = { handle: string; displayName: string; trades: number; range: string | null; isNew: boolean; previewAlt: string };

const best = (p: Promise<unknown>) => p.catch((e) => console.error('share prompt record failed', e));

export function SharePrompt({ handle, displayName, trades, range, isNew, previewAlt }: Props) {
  const [open, setOpen] = useState(true);
  const [done, setDone] = useState(false);

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
      {/* FIXES-CYCLE5 part 2 (C5-34): the preview is the picture Share attaches (lib/share-image.ts) */}
      <SharePreview src={shareImagePath(handle)} alt={previewAlt} lazy={false} />
      <p style={{ margin: 0 }}>{PUBLIC_SHORT.sharePrompt(PUBLIC_FIELDS.map((f) => f.words))}</p>
      {isNew && (
        <p className="muted note" style={{ margin: 0 }}>
          {trades === 0
            ? 'You have no closed trades yet. Your card will show an empty record until you close a position.'
            : `A short record means wide uncertainty. You have ${counted(trades, 'closed trade')} so far, and the card is labelled New record.${range ? ` Right now your average per trade is ${range}.` : ''}`}
        </p>
      )}
      <div className="actions">
        <ShareButton url={`/u/${handle}`} title={`${displayName} on Stock Social`} label="Share my record" image={shareImagePath(handle)}
          onShared={(how, picture) => { setDone(true); best(recordSharePromptAction(how)); best(recordShareAction(`/u/${handle}`, how, picture)); }} />
        <button type="button" className="link" onClick={close}>{done ? 'Done' : 'Not now'}</button>
      </div>
    </section>
  );
}
