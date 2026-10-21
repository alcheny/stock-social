'use client';
import { useState } from 'react';
import { markShareImageSaved } from '../../actions.ts';

const best = (p: Promise<unknown>) => p.catch((e) => console.error('share image record failed', e));

export function SaveImage({ handle, displayName, trades }: { handle: string; displayName: string; trades: number }) {
  const [saved, setSaved] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const onSave = () => {
    setSaved(true);
    best(markShareImageSaved());
  };

  return (
    <section className="share-prompt" aria-labelledby="save-h">
      <h2 id="save-h" style={{ margin: 0 }}>Save your record as an image</h2>
      <p style={{ margin: 0 }}>
        Public on the image: your win rate, average return, closed trade count and worst trade, all as percentages. Never sizes, prices or balances. Losses are included. The image is labelled &quot;Imported read-only from the broker&quot; and carries your profile link.
      </p>
      {imgFailed ? (
        <p className="muted">Preview unavailable. The download still works.</p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="preview" src={`/u/${handle}/story?format=square`} width={160} height={160} loading="lazy" style={{ aspectRatio: '1 / 1' }} onError={() => setImgFailed(true)}
          alt={`Preview of your square record image: ${displayName}, ${trades} verified trade${trades === 1 ? '' : 's'}`} />
      )}
      <div className="actions">
        <a className="button" href={`/u/${handle}/story?format=story`} download={`stock-social-${handle}-story.png`} onClick={onSave}>Save story (1080×1920)</a>
        <a className="button" href={`/u/${handle}/story?format=square`} download={`stock-social-${handle}-square.png`} onClick={onSave}>Save square (1080×1080)</a>
      </div>
      <p className="muted" style={{ margin: 0 }} aria-live="polite">{saved ? 'Saved. Post it wherever your friends are.' : ''}</p>
    </section>
  );
}
