// CHORES-3 (K20, approval council cycle 2 → cycle 3 chore): what a shared link to "/" unfurls into. Text only: the
// positioning line, split so the title and the description never repeat each other, plus the Demo sentence while any
// demo record exists (the seed is all demo, so the preview must not call demo cards imported).
import { sql } from './db.ts';
import { logSafe } from './privacy-log.ts';
import { CHORES_3 } from './copy.ts';

export type HomePreview = { title: string; description: string; cardText: string; metaDescription: string };

export function homePreview(demo: boolean): HomePreview {
  const tail = demo ? ` ${CHORES_3.demo}` : '';
  return {
    title: CHORES_3.homeTitle,
    description: `${CHORES_3.losses}${tail}`,
    metaDescription: `${CHORES_3.position}${tail}`,
    cardText: `${CHORES_3.position}${tail}`,
  };
}

// Any non-deleted user with a demo activity (public filers are flagged on public_filers, not here). On error: true,
// so the preview errs on saying demo records are marked.
export async function demoShown(): Promise<boolean> {
  try {
    const [r] = await sql`select exists (select 1 from activities a join users u on u.id = a.user_id and u.deleted_at is null where a.source = 'demo') as demo`;
    return r.demo === true;
  } catch (e) {
    console.error('demo check failed', logSafe(e));
    return true;
  }
}
