// CHORES-3 (C3-34): GET /api/health for an uptime monitor. Public body: {"status":"ok"} (200) or {"status":"degraded"}
// (503). With `Authorization: Bearer $CRON_SECRET` (constant time) it adds the details in lib/health.ts: booleans,
// times and hours only. Never cached. A wrong bearer here gets the public body and is not logged (the endpoint is
// public; logging it would let anyone fill the log). Linked from no page.
import { healthResponse } from '@/lib/health.ts';

export async function GET(req: Request) {
  return healthResponse(req);
}
