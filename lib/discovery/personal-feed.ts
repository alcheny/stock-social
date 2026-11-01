// F-2 PR-5: the feed page's loader for a viewer: lib/feed.ts#loadFeedPage plus, signed in, that viewer's own profile at
// the cursor's asOf (lib/discovery/personal-load.ts) and their two switches. Same arguments as loadFeedPage, so the page
// and its paging action still read who is viewing only through lib/viewer.ts#viewerId and pass the id here
// (lib/feed.signed-out.test.ts). Signed out it is exactly loadFeedPage: nothing personal is read.
import { loadFeedPage as loadPage, type FeedPage } from '../feed.ts';
import { personalFor } from './personal-load.ts';
import { settingsFor, type Settings } from './activity.ts';

export type PersonalFeedPage = FeedPage & { settings?: Settings };
export async function loadFeedPage(after: unknown, opts: { viewer?: number } = {}): Promise<PersonalFeedPage> {
  if (!opts.viewer) return loadPage(after, opts);
  const [page, settings] = await Promise.all([loadPage(after, { viewer: opts.viewer, personal: personalFor(opts.viewer) }), settingsFor(opts.viewer)]);
  return { ...page, settings };
}
