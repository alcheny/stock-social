import type { Similar } from '@/lib/similar.ts';
import { feedPaneChart } from '@/lib/chart-series.ts';
import { SIMILAR } from '@/lib/copy.ts';
import { paneTrust } from '@/lib/pane.ts';
import { DISCLAIMER } from '@/lib/share.ts';
import { ProfilePane } from '../../pane.tsx';
import { RowBadge, WhoName } from '../../ui.tsx';
import { NotInterested } from '../../not-interested.tsx';
import { SuggestRow } from '../../suggest-row.tsx';
import { FeedHides } from '../../feed-hides.tsx';

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// F-2 PR-3b (owner decision O2): "Similar trades", after the trader's own trades and visually secondary (business lead,
// committee PR-3 round 1: a shared-link visitor stays with the trader). Three trades by other traders, no performance
// number on a row (the sheet carries the record and POLICY F3's line). A tap opens that trader's pane as a sheet, the
// profile one step further; without JavaScript a row is a link to that trade's page. Signed in, the "…" menu with
// "Not interested" (and the row's reject swipe) hides the trader here as in the feed.
export function SimilarSection({ handle, similar, signedIn }: { handle: string; similar: Similar; signedIn: boolean }) {
  const now = new Date();
  return (
    <section className="suggest similar" aria-labelledby="similar-h">
      {signedIn && <FeedHides scope=".similar" />}
      <div className="suggest-in">
        <h2 id="similar-h">{SIMILAR.heading}</h2>
        <p className="muted small">{SIMILAR.explain(handle)}</p>
        <ul>
          {similar.rows.map((r) => {
            const trades = similar.byUser.get(r.trader) ?? [];
            const state = similar.states.get(r.trader)?.state ?? 'connected';
            const trust = paneTrust(trades, state);
            const pane = ProfilePane({ handle: r.handle, name: r.name, trades, chart: feedPaneChart(trades, now), now, state });
            return (
              <li key={r.trader} data-handle={r.handle}>
                <SuggestRow lazy handle={r.handle} name={r.name} signedIn={signedIn} href={`/u/${r.handle}/trade/${encodeURIComponent(r.sellId)}`}
                  pane={<>{pane}<p className="muted small sheet-note" tabIndex={-1}>{DISCLAIMER}</p></>}
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
  );
}
