import type { ReactNode } from 'react';
import type { FeedPage } from '@/lib/feed.ts';
import type { Reason } from '@/lib/discovery/section.ts';
import { SECTION, SECTION_PERSONAL } from '@/lib/copy.ts';
import type { SectionRow } from '@/lib/feed.ts';
import { paneTrust } from '@/lib/pane.ts';
import { DISCLAIMER } from '@/lib/share.ts';
import { RowBadge, WhoName } from './ui.tsx';
import { FollowButton } from './follow-button.tsx';
import { NotInterested } from './not-interested.tsx';
import { SuggestRow } from './suggest-row.tsx';

export const reasonText = (r: Reason) => SECTION.holds[r.bucket];
// F-2 PR-5: the personal reason when one is true, else the holding period (lib/discovery/personal.ts#personalReason).
export const rowReason = (r: SectionRow) => !r.why ? reasonText(r.reason)
  : r.why.kind === 'similarHold' ? SECTION_PERSONAL.similarHold(r.why.handle) : r.why.kind === 'symbolsRead' ? SECTION_PERSONAL.symbolsRead : SECTION_PERSONAL.newToYou;

// F-2 PR-3: the suggestions section, one full-height feed card after the page's 5th card (lib/feed.ts#loadFeedPage
// decides it; lib/discovery/section.ts orders it). The same rows for every viewer; signed in, Follow and the "…" menu
// with "Not interested" on each row. A row shows no performance number: tapping it opens the trader's pane as a sheet
// (the pane carries the record; the sheet covers the page's footer, so it carries POLICY F3's line itself), and "See full profile →" is one step further. Without JavaScript a
// row is a link to the profile. Not a `.row`: the feed's cards, paging and SW-1 keys count only cards.
export function SuggestSection({ page, pane }: { page: FeedPage; pane: (userId: number, disclaimer?: boolean) => ReactNode }) {
  const id = `suggest-${page.offset}`;
  return (
    <section className="suggest" aria-labelledby={id}>
      <div className="suggest-in">
        {/* F-2 PR-5: signed in with personalization On and at least one choice counted: the personal heading. */}
        <h2 id={id}>{page.personal ? SECTION_PERSONAL.heading : SECTION.heading}</h2>
        <p className="muted small">{page.personal ? SECTION_PERSONAL.explain : SECTION.explain}</p>
        <ul>
          {page.section!.map((r) => {
            const trust = paneTrust(page.byUser.get(r.userId) ?? [], page.records.get(r.userId)?.state ?? 'connected');
            return (
              <li key={r.userId} data-handle={r.handle}>
                <SuggestRow handle={r.handle} name={r.name} signedIn={!!page.viewer} pane={<>{pane(r.userId, false /* FIXES-LABELS: the sheet's .sheet-note is its one F3 line */)}<p className="muted small sheet-note" tabIndex={-1}>{DISCLAIMER}</p></>}
                  actions={page.viewer && <>{!trust.badge?.startsWith('public') && <FollowButton handle={r.handle} following={false} signedIn />}<NotInterested handle={r.handle} /></>}>
                  <span className="sname"><WhoName name={r.name} handle={r.handle} /></span>
                  <span className="sfacts"><RowBadge kind={trust.badge} />{trust.incomplete && <span className="badge new">{SECTION.incomplete}</span>}<span className="sreason">{rowReason(r)}</span></span>
                </SuggestRow>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
