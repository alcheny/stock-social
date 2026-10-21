'use client';
import { markShareImageSaved } from '../../actions.ts';
import { ShareButton } from '../../share-button.tsx';

const best = (p: Promise<unknown>) => p.catch((e) => console.error('share record failed', e));

// The owner's one place to share: each action is a single click (share sheet with the record image, or the
// link copied on desktop). Replaces the old snippet, image-download and embed panels.
export function ShareCard({ handle, recapYm, recapLabel }: { handle: string; recapYm: string | null; recapLabel: string | null }) {
  return (
    <section className="share-prompt share-card" aria-labelledby="share-card-h">
      <h2 id="share-card-h" style={{ margin: 0 }}>Share your record</h2>
      <p className="muted small" style={{ margin: 0 }}>Percentages only, losses included. Never sizes, prices or balances.</p>
      <div className="actions">
        <ShareButton url={`/u/${handle}`} title={`@${handle} on Stock Social`} label="Share my record"
          image={`/u/${handle}/story?format=square`} onShared={() => best(markShareImageSaved())} />
        {recapYm && recapLabel && (
          <ShareButton className="secondary" url={`/u/${handle}/month/${recapYm}`} title={`${recapLabel} · @${handle} on Stock Social`}
            label={`Share ${recapLabel.split(' ')[0]} recap`} />
        )}
      </div>
    </section>
  );
}
