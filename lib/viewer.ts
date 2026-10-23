// F-2 PR-2: who is viewing the feed, as an id and nothing else. The feed page and its paging action read the session
// only through this (lib/feed.signed-out.test.ts), and pass the id to lib/feed.ts#loadFeedPage, which reads that
// viewer's own exclusions and follows. Signed out it is undefined and the feed reads no viewer table.
import { currentUser } from './session.ts';

export async function viewerId(): Promise<number | undefined> {
  return (await currentUser())?.id;
}
