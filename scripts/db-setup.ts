// Applies db/schema.sql (idempotent) without needing psql. On Vercel preview deployments it also seeds
// demo data, so every PR's preview link has something to look at. Production is never seeded.
// Run by `npm run vercel-build`; locally: `node --env-file=.env scripts/db-setup.ts`.
import { readFileSync } from 'node:fs';
import { sql } from '../lib/db.ts';

// Without this, the driver silently falls back to localhost:5432 and fails with ECONNREFUSED.
if (!process.env.DATABASE_URL) {
  const where = process.env.VERCEL_ENV ? ` for the Vercel "${process.env.VERCEL_ENV}" environment` : '';
  console.error(`db-setup: DATABASE_URL is not set${where}.\n` +
    'Connect a database: Vercel project → Storage → Neon, enabled for Production and Preview (docs/AUTOPILOT.md → Reviewing).');
  process.exit(1);
}

await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
console.log('db-setup: schema applied');
// OPTIONS (docs/features/logs/options/plan.md D7): option contract symbols stored in open_positions before the fix are
// removed here, which reaches frozen traders who never sync again (schema.sql may not delete). A count only.
const { purgeOccPositions, repairOptionShareCloses } = await import('../lib/options-sync.ts');
console.log(`db-setup: ${await purgeOccPositions()} option contract positions removed`);
// OPTIONS fix round 6: records rebuilt before options were routed (frozen ones never sync again) are rebuilt once with
// rebuildRecord, so no option row stays a public share close. Idempotent; a count only.
console.log(`db-setup: ${await repairOptionShareCloses()} records rebuilt without option rows on the share path`);
// Fixes cycle 4 (C4-1, C4-2): every record (frozen ones included) is rebuilt once per share-matcher version, so no
// figure the old same-instant order or a short's cover produced stays published. Null when this version already ran.
const { rebuildAllForMatcher } = await import('../lib/matcher-rebuild.ts');
const rebuilt = await rebuildAllForMatcher();
console.log(rebuilt === null ? 'db-setup: records already rebuilt for this matcher version' : `db-setup: ${rebuilt} records rebuilt for the share matcher`);

// fix-user-text (F-9, D-08): re-check stored user text against the current rules after every schema apply. Theses:
// published → held only, owner-released ones skipped (lib/thesis-review.ts). Display names: lib/handles.ts#recheckDisplayNames
// (a name that now fails falls back to the handle). Counts only, never the text or an id.
const { remoderateAll } = await import('../lib/thesis-review.ts');
console.log(`db-setup: theses re-checked ${JSON.stringify(await remoderateAll())}`);
const { recheckDisplayNames } = await import('../lib/handles.ts');
console.log(`db-setup: display names re-checked ${JSON.stringify(await recheckDisplayNames())}`);

if (process.env.VERCEL_ENV === 'preview' || process.env.SEED === '1') {
  await import('./seed.ts'); // closes the pool when done
} else {
  await sql.end();
}
