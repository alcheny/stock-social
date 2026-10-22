import { NextResponse } from 'next/server';
import { currentUser, origin } from '@/lib/session.ts';
import { AccountClaimedError } from '@/lib/claims.ts';
import { syncUser } from '@/lib/sync.ts';

// SnapTrade returns here after connecting. Sync immediately so the trader sees their record
// in the same session — first-session activation is the Phase 1 supply metric.
export async function GET() {
  const base = await origin();
  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${base}/login`);
  try {
    await syncUser(user);
  } catch (e) {
    if (e instanceof AccountClaimedError) return NextResponse.redirect(`${base}/u/${user.handle}?connect=account-claimed`);
    throw e;
  }
  return NextResponse.redirect(`${base}/u/${user.handle}`);
}
