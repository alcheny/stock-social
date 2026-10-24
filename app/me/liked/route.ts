import { currentUser } from '@/lib/session.ts';
import { KEY, likedAmong } from '@/lib/likes.ts';

// F-2 PR-4: which of the feed's cards on screen this viewer liked (?k=key,key…, at most 60), for the like buttons'
// pressed state. Private: signed in only, read for the session's own id, never cached or shared. The feed's own read
// (lib/feed.ts#loadFeedPage) never reads likes, so the feed stays the same list for every viewer.
export async function GET(req: Request): Promise<Response> {
  const me = await currentUser();
  const keys = (new URL(req.url).searchParams.get('k') ?? '').split(',').filter((k) => KEY.test(k)).slice(0, 60);
  const liked = me && keys.length ? [...await likedAmong(me.id, keys)] : [];
  return Response.json({ liked }, { headers: { 'Cache-Control': 'private, no-store' } });
}
