import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sql } from '@/lib/db.ts';
import { syncAll, syncUser } from '@/lib/sync.ts';
import { purgeExpiredLinks } from '@/lib/auth/links.ts';
import { tick } from '@/lib/connections.ts';
import { deleteProfile, type DeletableUser } from '@/lib/delete.ts';

// Hourly cron: POST /api/sync with `Authorization: Bearer $CRON_SECRET`.
export async function POST(req: NextRequest) {
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const purgedLinks = await purgeExpiredLinks(); // expired sign-in links go with their address (COMPLIANCE §3)
  // F-1: clocks (pending → expired, stale importing → failed), every importing row advanced, cleanups retried.
  const connections = await tick();
  // Deletions a failed vendor call left marked (lib/delete.ts) are finished here.
  const pendingDeletes = await sql<DeletableUser[]>`select id, handle, snaptrade_user_id, snaptrade_secret_enc from users where deleted_at is not null`;
  const deletions = await syncAll(pendingDeletes, (u) => deleteProfile(u));
  const users = await sql<{ id: number; snaptrade_user_id: string; snaptrade_secret_enc: string }[]>`select id, snaptrade_user_id, snaptrade_secret_enc from users
    where snaptrade_user_id is not null and deleted_at is null
    and not exists (select 1 from connections c where c.user_id = users.id and c.state = 'importing') order by last_synced_at nulls first`;
  // ponytail: sequential, ~5k traders/hour; shard by user_id % N across cron calls, then a queue (DESIGN §2.7)
  const { ok, failed } = await syncAll(users, (u) => syncUser(u));
  return NextResponse.json({ ok, failed, purgedLinks, connections, deletions });
}
