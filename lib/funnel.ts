// Sign-up funnel events (docs/features/logs/F-1/plan.md §5): per signup_attempts row, method and step only.
// No personal data, ever: names are enumerated, meta keys are allow-listed and values are short scalars.
import { sql } from './db.ts';

export const FUNNEL_EVENTS = ['landed', 'method_chosen', 'attested', 'notice_seen', 'portal_opened', 'link_succeeded',
  'no_real_account', 'consented', 'declined', 'expired', 'abandoned', 'failed', 'import_finished', 'own_profile_viewed'] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export const META_KEYS: Partial<Record<FunnelEvent, readonly string[]>> = {
  landed: ['source'], method_chosen: ['method'], portal_opened: ['mode'], link_succeeded: ['accounts', 'paper'],
  failed: ['reason'], import_finished: ['trades', 'seconds'],
};

export type Meta = Record<string, string | number | boolean>;
// Anything that could be an email, a phone number or an id longer than a step name is refused, not stored.
const PERSONAL = /@|\d{7,}/;

export function funnelEvent(name: string, meta: Record<string, unknown> = {}): { name: FunnelEvent; meta: Meta } {
  if (!(FUNNEL_EVENTS as readonly string[]).includes(name)) throw new Error('unknown funnel event');
  const allowed = META_KEYS[name as FunnelEvent] ?? [];
  const out: Meta = {};
  for (const k of allowed) {
    const v = meta[k];
    if (v === undefined || v === null) continue;
    if (typeof v === 'number' || typeof v === 'boolean') { out[k] = v; continue; }
    if (typeof v !== 'string' || v.length > 40 || PERSONAL.test(v)) throw new Error(`funnel meta ${k} is not a step value`);
    out[k] = v;
  }
  return { name: name as FunnelEvent, meta: out };
}

export async function recordFunnel(attemptId: number, name: FunnelEvent, meta: Record<string, unknown> = {}, at?: Date) {
  const e = funnelEvent(name, meta);
  await sql`insert into funnel_events (attempt_id, name, meta, at) values (${attemptId}, ${e.name}, ${sql.json(e.meta)}, ${at ?? sql`now()`})`;
}
