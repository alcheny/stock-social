import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db.ts';
import { connectUrl, registerUser } from '@/lib/broker.ts';
import { currentUser } from '@/lib/session.ts';

// Sends the signed-in trader to SnapTrade's read-only connection portal.
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));

  let bu = user.snaptrade_user_id && user.snaptrade_secret_enc ? { snaptradeUserId: user.snaptrade_user_id, secretEnc: user.snaptrade_secret_enc } : null;
  if (!bu) {
    bu = await registerUser(user.id);
    await sql`update users set snaptrade_user_id = ${bu.snaptradeUserId}, snaptrade_secret_enc = ${bu.secretEnc} where id = ${user.id}`;
  }
  return NextResponse.redirect(await connectUrl(bu, new URL('/connect/done', req.url).toString()));
}
