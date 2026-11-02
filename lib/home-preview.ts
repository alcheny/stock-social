// CHORES-3 (K20, approval council cycle 2 → cycle 3 chore): what a shared link to "/" unfurls into. Text only: the
// positioning line, split so the title and the description never repeat each other, plus the Demo sentence while any
// demo record exists (the seed is all demo, so the preview must not call demo cards imported).
import { sql } from './db.ts';
import { logSafe } from './privacy-log.ts';
import { CHORES_3 } from './copy.ts';
import { visibleUser } from './visible-users.ts';
import { FIXES_CYCLE4_PART2 } from './copy.ts'; // FIXES-CYCLE4-PART2 (F4-8)

export type HomePreview = { title: string; description: string; cardText: string; metaDescription: string };

// FIXES-CYCLE4-PART2 (F4-8, C4-12): `pub`, the feed can show a public-filing record (lib/public-gate.ts#publicShown): one
// more sentence, before the Demo one, in every text. Title and the K20 line unchanged.
export function homePreview(demo: boolean, pub = false): HomePreview {
  const tail = `${pub ? ` ${FIXES_CYCLE4_PART2.homePublic}` : ''}${demo ? ` ${CHORES_3.demo}` : ''}`;
  return {
    title: CHORES_3.homeTitle,
    description: `${CHORES_3.losses}${tail}`,
    metaDescription: `${CHORES_3.position}${tail}`,
    cardText: `${CHORES_3.position}${tail}`,
  };
}

// Any visible user (not deleted, not hidden: F-16) with a demo activity (public filers are flagged on public_filers, not here). On error: true,
// so the preview errs on saying demo records are marked. Remembered per server instance for DEMO_TTL_MS, so the feed's
// metadata adds no query to most requests (demo data changes only when the seed or a deletion runs).
export const DEMO_TTL_MS = 5 * 60_000;
let memo: { at: number; demo: boolean } | null = null;
export async function demoShown(now = Date.now()): Promise<boolean> {
  if (memo && now - memo.at < DEMO_TTL_MS) return memo.demo;
  try {
    const [r] = await sql`select exists (select 1 from activities a join users u on u.id = a.user_id and ${visibleUser('u')} where a.source = 'demo') as demo`;
    memo = { at: now, demo: r.demo === true };
    return memo.demo;
  } catch (e) {
    console.error('demo check failed', logSafe(e));
    return true; // not remembered: the next request asks again
  }
}
