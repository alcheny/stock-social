import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sql } from '@/lib/db.ts';
import { syncAll, syncUser } from '@/lib/sync.ts';

// Hourly cron: POST /api/sync with `Authorization: Bearer $CRON_SECRET`.
export async function POST(req: NextRequest) {
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const users = await sql<{ id: number; snaptrade_user_id: string; snaptrade_secret_enc: string }[]>`select id, snaptrade_user_id, snaptrade_secret_enc from users where snaptrade_user_id is not null order by last_synced_at nulls first`;
  // ponytail: sequential, ~5k traders/hour; shard by user_id % N across cron calls, then a queue (DESIGN §2.7)
  const { ok, failed } = await syncAll(users, (u) => syncUser(u));
  return NextResponse.json({ ok, failed });
}
