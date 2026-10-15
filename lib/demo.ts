import { sql } from './db.ts';

// One definition of "demo profile" (any source='demo' activity) for the profile page and login.
export async function isDemoUser(userId: number): Promise<boolean> {
  const [r] = await sql`select exists(select 1 from activities where user_id = ${userId} and source = 'demo') as d`;
  return r.d as boolean;
}
