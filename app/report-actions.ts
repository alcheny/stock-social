'use server';
// F-16 (plan docs/features/logs/F-16-F-17/plan.md §5.5): the profile report form's server action
// (app/u/[handle]/report/report-form.tsx, useActionState). Signed in only, rate-limited per reporter and per target in
// lib/reports.ts#reportProfile. It reads the signed-in reader the way app/actions.ts#reportNote does; the reported
// trader is never told who reported. Kept out of app/actions.ts on purpose (plan §4).
import { currentUser } from '@/lib/session.ts';
import { submitProfileReport } from '@/lib/reports.ts';
import { PROFILE_REPORT_COPY, type ProfileReportState } from '@/lib/report-copy.ts';
import { logSafe } from '@/lib/privacy-log.ts';

export async function reportProfileAction(_prev: ProfileReportState, formData: FormData): Promise<ProfileReportState> {
  try {
    const user = await currentUser();
    return await submitProfileReport(user?.id ?? null, formData);
  } catch (e) {
    console.error('report profile failed', logSafe(e)); // the one catch: the error's name only, never the handle or the reporter
    return { state: 'error', message: PROFILE_REPORT_COPY.failed };
  }
}
