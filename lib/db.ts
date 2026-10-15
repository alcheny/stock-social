import postgres from 'postgres';

// Reuse one pool across Next dev hot reloads.
const g = globalThis as unknown as { sql?: postgres.Sql };
export const sql = (g.sql ??= postgres(process.env.DATABASE_URL!, { onnotice: () => {} }));
