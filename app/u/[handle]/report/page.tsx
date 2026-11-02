import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { sql } from '@/lib/db.ts';
import { routeHandle } from '@/lib/params.ts';
import { filerVisibleSql } from '@/lib/public-gate.ts';
import { visibleUser } from '@/lib/visible-users.ts';
import { currentUser } from '@/lib/session.ts';
import { PROFILE_REPORT_COPY as C } from '@/lib/report-copy.ts';
import { PRODUCT_NAME, TAKEDOWN } from '@/lib/copy.ts';
import { takedownReachable } from '@/lib/takedown.ts';
import { hasReportedProfile } from '@/lib/reports.ts';
import { FocusHeading } from '../../../connect/result/focus-heading.tsx';
import { ReportForm } from './report-form.tsx';
import { generateMetadata as notFoundMetadata } from '../not-found.tsx';

// F-16 (plan docs/features/logs/F-16-F-17/plan.md §2.2; v2 B6, B8; K18): /u/<handle>/report, reached from the profile's
// quiet "…" menu. Signed out: one line asking to sign in (and the takedown page when it is reachable); the trader's own
// profile: a neutral line; anyone else: the form (./report-form.tsx). Own title, one h1, noindex, never cached.
// A hidden, retired or unknown handle answers the segment's 404 (../not-found.tsx). Next 16.4.3 takes that 404's head
// from not-found.tsx: generateMetadata returns that module's head (never notFound(), which can leave two <title>s;
// orchestrator review item 2) and the page body calls notFound().
// The target lookup: a visible user (lib/visible-users.ts) whose F-7 filer record, if any, is shown (lib/public-gate.ts).

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ handle: string }> };

const target = cache(async (handle: string) => {
  if (!routeHandle(handle)) return null;
  const [u] = await sql`select u.id, u.handle from users u where u.handle = ${handle} and ${visibleUser('u')} and ${filerVisibleSql('u')}`;
  return u ? { id: u.id as number, handle: u.handle as string } : null;
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await target((await params).handle);
  if (!t) return notFoundMetadata({ params });
  return { title: `${C.title(t.handle)} · ${PRODUCT_NAME}`, robots: { index: false, follow: false } };
}

export default async function ReportPage({ params }: Params) {
  const t = await target((await params).handle);
  if (!t) notFound();
  const me = await currentUser();
  // Fix round 2 (T2, plan §2.2): a reader who already reported this profile sees only the status line, never the form.
  const already = me && me.id !== t.id ? await hasReportedProfile(me.id, t.id) : false;
  const back = <p><Link className="tap44" href={`/u/${t.handle}`}>{C.back(t.handle)}</Link></p>;
  const takedown = takedownReachable() && <p className="muted small">{C.other} <Link className="tap44" href="/takedown">{TAKEDOWN.link}</Link></p>;
  return (
    <main className="page report-page">
      <h1>{C.h1}</h1>
      <p className="muted" style={{ marginTop: 0 }}><bdi>@{t.handle}</bdi></p>
      {!me ? <>
        <p>{C.signedOut}</p>
        {/* Fix round 2 (UX2): a 44 px target. ponytail: sign-in returns to the profile or /connect, not here (BL3/UX3) —
            /login has no general return path (only F-3's fixed after_signin cookie); add a same-origin, path-only one
            for every sign-in method in lib/auth/landing.ts, then link /login?next=/u/<h>/report. */}
        <p><Link className="button report-signin" href="/login">{C.signIn}</Link></p>
        {back}
        {takedown}
      </> : me.id === t.id ? <>
        <p>{C.own}</p>
        {back}
      </> : already ? <>
        <p role="status" tabIndex={-1} id="report-already" className="report-done">{C.already}</p><FocusHeading id="report-already" />
        {back}
      </> : <>
        <ReportForm handle={t.handle} />
        {back}
        {takedown}
      </>}
    </main>
  );
}
