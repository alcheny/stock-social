'use server';
// seam: placeholder for engineer B's app/report-actions.ts (plan docs/features/logs/F-16-F-17/plan.md §13 B). The lead
// replaces this whole file with B's at merge; it exists only so engineer C's report form compiles and renders.
export type ProfileReportResult = { state: string; message: string; field?: string };

export async function reportProfileAction(_prev: ProfileReportResult, _formData: FormData): Promise<ProfileReportResult> {
  return { state: 'error', message: '' };
}
