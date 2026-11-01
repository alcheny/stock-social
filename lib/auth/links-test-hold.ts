// Test helper: keeps other test files' purges off a test's own login_links rows while it backdates and reads them.
// node:test runs files in parallel on one database, and purgeExpiredLinks (lib/auth/links.ts: issueLink's lazy purge,
// the tick) deletes every expired row there, so a row a test has just made expired can vanish before the test reads it
// (seen in a full parallel npm test: links.test.ts read 0 rows for an expired, unclaimed link that keeps its address
// until a purge).
// A second connection takes FOR KEY SHARE on the rows while they are still live: a delete needs FOR UPDATE and waits
// for it, while the backdating update (no key column changes), plain reads and the claim's read do not. release()
// commits; a waiting purge then deletes the rows as usual. Only lock rows the test itself made and must see survive.
export async function holdLinks(hashes: string[]): Promise<{ held: number; release: () => Promise<void> }> {
  const { sql } = await import('../db.ts');
  const conn = await sql.reserve();
  try {
    await conn`begin`;
    const rows = await conn`select token_hash from login_links where token_hash in ${conn(hashes)} for key share`;
    let released = false;
    return {
      held: rows.length,
      release: async () => {
        if (released) return;
        released = true;
        try { await conn`commit`; } finally { conn.release(); }
      },
    };
  } catch (e) {
    await conn`rollback`.catch(() => {});
    conn.release();
    throw e;
  }
}
