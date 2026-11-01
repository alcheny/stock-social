import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/session.ts';
import { exportFor } from '@/lib/record-tools.ts';

// F-3 (committee condition 11): "Download my data" for every signed-in user, paid or not: the disclaimer, the user's
// saved views, notes and subscription status, and nothing else. Private, never cached, never indexed.
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'sign in' }, { status: 401, headers: { 'cache-control': 'private, no-store' } });
  return new NextResponse(JSON.stringify(await exportFor(me.id), null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="stock-social-my-data.json"',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
    },
  });
}
