// F-2 PR-5: the viewer's inputs for personal ordering (lib/discovery/personal.ts), read at the feed session's asOf by
// lib/discovery/personal-feed.ts and passed into lib/feed.ts#loadFeedPage, which on its own reads none of them. Every
// query is in lib/follows.ts, lib/likes.ts or lib/discovery/activity.ts and keyed by the viewer's own id.
// - "Personalize my feed" Off: only the setting and the viewer's running hides are read; the viewer gets the order
//   everyone gets minus their own hides.
// - Events are read only while "Personalize with my activity" is On.
// - Only choices made at or before asOf and within FADE_DAYS of it are read (a follow: made by asOf), so a page built
//   later on another server rebuilds the same list; lib/feed.ts keeps the list itself for the cursor's lifetime.
// - The watchlist is never read (owner 2026-11-01).
import { eventsFor, settingsFor } from './activity.ts';
import { exclusionsAt, followsAt, hiddenTraders } from '../follows.ts';
import { likesAt, rejectsAt } from '../likes.ts';
import { FADE_DAYS, viewerProfile, type Profile } from './personal.ts';
import { sql } from '../db.ts';

export type Personal = { personalize: false; hidden: number[] } | { personalize: true; profile: Profile; handles: Map<number, string> };
export type PersonalLoader = (asOf: Date) => Promise<Personal>;

export async function loadPersonal(viewer: number, asOf: Date): Promise<Personal> {
  const s = await settingsFor(viewer);
  if (!s.personalize) return { personalize: false, hidden: await hiddenTraders(viewer) };
  const since = new Date(asOf.getTime() - FADE_DAYS * 86_400_000);
  const [follows, likes, rejects, excl, events] = await Promise.all([
    followsAt(viewer, asOf), likesAt(viewer, since, asOf), rejectsAt(viewer, since, asOf), exclusionsAt(viewer, since, asOf),
    s.activity ? eventsFor(viewer, asOf) : [],
  ]);
  const profile = viewerProfile({
    follows: follows.map((f) => f.trader), likes, rejects,
    hidden: excl.filter((r) => r.reason === 'not_interested'),
    unfollows: excl.filter((r) => r.reason === 'unfollow'),
    events, activity: s.activity,
  }, asOf.getTime());
  // Handles for "Similar holding period to @x": followed traders and traders of liked trades.
  const handles = new Map(follows.map((f) => [f.trader, f.handle]));
  const more = profile.liked.filter((t) => !handles.has(t));
  if (more.length) for (const r of await sql`select id, handle from users where id = any(${more}) and deleted_at is null`) handles.set(r.id as number, r.handle as string);
  return { personalize: true, profile, handles };
}

export const personalFor = (viewer: number): PersonalLoader => (asOf) => loadPersonal(viewer, asOf);
