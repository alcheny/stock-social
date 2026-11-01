import { notFound } from 'next/navigation';
import { cache } from 'react';
import { sql } from '@/lib/db.ts';
import { routeHandle } from '@/lib/params.ts';
import { filerVisibleSql } from '@/lib/public-gate.ts';
import { visibleUser } from '@/lib/visible-users.ts';

// F-16 Step 0 stub (plan §13): the report route exists so /u/<handle>/report resolves under the [handle] segment and its
// not-found.tsx (hidden / retired / generic). Engineer C replaces the page body with the report page (plan §2.2); until
// then every handle answers 404 here. The target lookup is the real one: a visible user (lib/visible-users.ts) whose
// F-7 filer record, if any, is shown (lib/public-gate.ts, lib/f7-routes.test.ts AC 9).
// Spike finding: Next 16.4.3 takes the 404 head from ../not-found.tsx only when generateMetadata itself calls
// notFound(); a notFound() thrown only while rendering leaves the layout's title ("Stock Social"). So the real page's
// generateMetadata must call notFound() for a hidden, retired or unknown handle too.

type Params = { params: Promise<{ handle: string }> };

const target = cache(async (handle: string) => {
  if (!routeHandle(handle)) return null;
  const [u] = await sql`select u.id, u.handle from users u where u.handle = ${handle} and ${visibleUser('u')} and ${filerVisibleSql('u')}`;
  return u ? { id: u.id as number, handle: u.handle as string } : null;
});

export async function generateMetadata({ params }: Params): Promise<never> {
  if (!(await target((await params).handle))) notFound();
  notFound(); // Step 0: no report page yet (engineer C)
}

export default async function ReportPage({ params }: Params): Promise<never> {
  if (!(await target((await params).handle))) notFound();
  notFound(); // Step 0: no report page yet (engineer C)
}
