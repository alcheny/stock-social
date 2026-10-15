import { NextResponse, type NextRequest } from 'next/server';
import { currentUser } from '@/lib/session.ts';
import { AccountClaimedError } from '@/lib/claims.ts';
import { syncUser } from '@/lib/sync.ts';

// SnapTrade returns here after connecting. Sync immediately so the trader sees their record
// in the same session — first-session activation is the Phase 1 supply metric.
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));
  try {
    await syncUser(user);
  } catch (e) {
    if (e instanceof AccountClaimedError) return NextResponse.redirect(new URL(`/u/${user.handle}?connect=account-claimed`, req.url));
    throw e;
  }
  return NextResponse.redirect(new URL(`/u/${user.handle}`, req.url));
}
