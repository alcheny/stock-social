// Test helper for the privacy work's DB-backed tests: applies db/schema.sql, retrying a foreign-key race.
// The schema's one-time backfill (insert into broker_accounts ... from activities) can meet a users row another test
// file deletes at the same moment (node:test runs files in parallel on one database): Postgres then raises 23503 and
// the whole apply rolls back. The apply is idempotent, so it is simply run again (CI review, 2026-11-01).
import { readFileSync } from 'node:fs';

export async function applySchemaForTests(attempts = 5): Promise<void> {
  const { sql } = await import('./db.ts');
  const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  for (let i = 1; ; i++) {
    try {
      await sql.unsafe(schema).simple();
      return;
    } catch (e) {
      if ((e as { code?: string }).code !== '23503' || i >= attempts) throw e;
      await new Promise((r) => setTimeout(r, 50 * i));
    }
  }
}
