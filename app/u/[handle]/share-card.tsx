'use client';
import { markShareImageSaved, recordShareAction } from '../../actions.ts';
import { ShareButton } from '../../share-button.tsx';
import { SharePreview } from './share-preview.tsx'; // FIXES-CYCLE5 part 2 (C5-34)
import { shareImagePath } from '@/lib/share-image.ts';

const best = (p: Promise<unknown>) => p.catch((e) => console.error('share record failed', e));

// The owner's one place to share: each action is a single click (share sheet with the record image, or the
// link copied on desktop). Replaces the old snippet, image-download and embed panels.
// FIXES-CYCLE5 part 2 (C5-34): previewAlt is the square card in words; the preview is the picture Share attaches.
export function ShareCard({ handle, recapYm, recapLabel, previewAlt }: { handle: string; recapYm: string | null; recapLabel: string | null; previewAlt: string }) {
  return (
    <section className="share-prompt share-card" aria-labelledby="share-card-h">
      <h2 id="share-card-h" style={{ margin: 0 }}>Share your record</h2>
      <p className="muted small" style={{ margin: 0 }}>Percentages only, losses included. Never sizes, prices or balances.</p>
      <SharePreview src={shareImagePath(handle)} alt={previewAlt} lazy />
      <div className="actions">
        <ShareButton url={`/u/${handle}`} title={`@${handle} on Stock Social`} label="Share my record"
          image={shareImagePath(handle)}
          onShared={(how, picture) => { best(markShareImageSaved()); best(recordShareAction(`/u/${handle}`, how, picture)); }} />
        {recapYm && recapLabel && (
          <ShareButton className="secondary" url={`/u/${handle}/month/${recapYm}`} title={`${recapLabel} · @${handle} on Stock Social`}
            label={`Share ${recapLabel.split(' ')[0]} recap`}
            onShared={(how) => best(recordShareAction(`/u/${handle}/month/${recapYm}`, how, false))} />
        )}
      </div>
    </section>
  );
}
