import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sql } from '@/lib/db.ts';
import { syncAll, syncUser, usersToSync } from '@/lib/sync.ts';
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
  // Only traders with a connected (consented) connection and no import in progress (lib/sync.ts#usersToSync).
  const users = await usersToSync();
  // ponytail: sequential, ~5k traders/hour; shard by user_id % N across cron calls, then a queue (DESIGN §2.7)
  const { ok, failed } = await syncAll(users, (u) => syncUser(u));
  return NextResponse.json({ ok, failed, purgedLinks, connections, deletions });
}
