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

if (process.env.VERCEL_ENV === 'preview' || process.env.SEED === '1') {
  await import('./seed.ts'); // closes the pool when done
} else {
  await sql.end();
}
