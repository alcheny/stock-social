import postgres from 'postgres';

// Sharded sync (docs/SYNC.md): the pool size, from DATABASE_POOL_MAX (default 10, the driver's own default). A sync holds
// one connection for its whole transaction, so a shard's workers are clamped to POOL_MAX − 2 (lib/sync-shard.ts).
export const POOL_MAX = (() => { const n = Number(process.env.DATABASE_POOL_MAX); return Number.isInteger(n) && n >= 3 && n <= 500 ? n : 10; })();

// Reuse one pool across Next dev hot reloads.
const g = globalThis as unknown as { sql?: postgres.Sql };
export const sql = (g.sql ??= postgres(process.env.DATABASE_URL!, { onnotice: () => {}, max: POOL_MAX }));
