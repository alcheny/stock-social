import type { Similar } from '@/lib/similar.ts';
import { SIMILAR } from '@/lib/copy.ts';
import { paneTrust } from '@/lib/pane.ts';
import { pct } from '@/lib/trades.ts';
import { DISCLAIMER } from '@/lib/share.ts';
import { LazyPane } from '../../lazy-pane.tsx';
import { RowBadge, WhoName } from '../../ui.tsx';
import { NotInterested } from '../../not-interested.tsx';
import { SuggestRow } from '../../suggest-row.tsx';
import { FeedHides } from '../../feed-hides.tsx';

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// F-2 PR-3b (owner decision O2): "Similar trades", after the trader's own trades and visually secondary (business lead,
// committee PR-3 round 1: a shared-link visitor stays with the trader). Three trades by other traders, no performance
// number on a row (the sheet carries the record and POLICY F3's line). A tap opens a sheet on that trade with its trader's pane
// below (fix round 1), the profile one step further; without JavaScript a row is a link to that trade's page. Signed in, the "…" menu with
// "Not interested" (and the row's reject swipe) hides the trader here as in the feed.
export function SimilarSection({ handle, similar, signedIn }: { handle: string; similar: Similar; signedIn: boolean }) {
  return (
    <>
    {/* Fix round 1 (UX blocker): outside the section, so its "Hidden for 90 days." bar stays when every row is hidden. */}
    {signedIn && <FeedHides scope=".similar" />}
    <section className="suggest similar" aria-labelledby="similar-h">
      <div className="suggest-in">
        <h2 id="similar-h">{SIMILAR.heading}</h2>
        <p className="muted small">{SIMILAR.explain(handle)}</p>
        <ul>
          {similar.rows.map((r) => {
            const state = similar.states.get(r.trader)?.state ?? 'connected';
            const trust = paneTrust([{ verified: r.verified }], state);
            const trade = `/u/${r.handle}/trade/${encodeURIComponent(r.sellId)}`;
            // Fix round 1 (D1, owner decision O2): the sheet opens on the row's trade (as the no-JS link does), with the
            // trader's pane below it (loaded on first open, D2) and the profile one step further.
            const lead = (
              <header className="sheet-trade">
                <button type="button" className="back" data-back>← Back</button>
                <h3 tabIndex={-1}>{SIMILAR.closed(r.symbol, DAY.format(r.closedAt))}</h3>
                <p><b className={r.returnPct > 0 ? 'up' : 'down'}>{pct(r.returnPct)}</b> <span className="muted">{SIMILAR.held[r.bucket]}</span> <a href={trade}>{SIMILAR.trade}</a></p>
              </header>
            );
            return (
              <li key={r.trader} data-handle={r.handle}>
                <SuggestRow lazy label={SIMILAR.closed(r.symbol, DAY.format(r.closedAt))} handle={r.handle} name={r.name} signedIn={signedIn} href={trade}
                  pane={<>{lead}<LazyPane handle={r.handle} name={r.name} highlight={r.tradeId} /><p className="muted small sheet-note" tabIndex={-1}>{DISCLAIMER}</p></>}
                  actions={signedIn && <NotInterested handle={r.handle} />}>
                  <span className="sname"><WhoName name={r.name} handle={r.handle} /></span>
                  <span className="strade">{SIMILAR.closed(r.symbol, DAY.format(r.closedAt))}</span>
                  <span className="sfacts"><RowBadge kind={trust.badge} /><span className="sreason">{SIMILAR.held[r.bucket]}</span></span>
                </SuggestRow>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
    </>
  );
}
