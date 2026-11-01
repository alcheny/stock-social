import { after } from 'next/server';
import { currentUser } from '@/lib/session.ts';
import { handleBeacon } from '@/lib/views-route.ts';
import { markCapDay, recordDrop, recordView, viewedUserId } from '@/lib/views.ts';

// F-15: the first-party view beacon (app/view-beacon.tsx). Aggregate counts only; see lib/views-route.ts.
export async function POST(req: Request) {
  return handleBeacon(req, { viewer: currentUser, recordView, recordDrop, viewedUserId, markCap: (trusted) => markCapDay(trusted), defer: after });
}
