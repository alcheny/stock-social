// F-1 PR-2b, S5: the live import banner as a pure state machine (app/u/[handle]/import-banner.tsx renders it). The
// owner's tab polls POST /api/import/step every POLL_MS, which also advances the import; the hourly tick advances it
// when no tab is open. The status line (role="status", aria-live="polite") is announced at most once per ANNOUNCE_MS:
// a change inside the window waits and the latest value goes out when it ends. The imported-rows line is not a live
// region and follows every step. After SLOW_MS with no new rows the owner is told the import continues without them.
// "Import finished." replaces the status line as one static line until the next navigation; a failed import hands
// over to the profile's own failed line. Fix round 1 (tester note): each poll advances the import, so a hidden tab
// (visibilitychange) does not poll; on return it polls again at once, and the 60 s clock restarts from the return.
// Fix round 2 (business lead 4, acceptance criterion: the banner disappears): on finish the banner keeps only its status
// line, which says "Import finished." once (the same live region, so it is announced once) and is removed FINISHED_MS
// after it went out; nothing reserves an empty box. A 401/403 poll (signed out in another tab) stops polling for good.
import { RECORD_BODY } from './copy.ts';

export const POLL_MS = 2_000;
export const ANNOUNCE_MS = 5_000;
export const SLOW_MS = 60_000;
export const FINISHED_MS = 5_000;

type Snapshot = { state: string; closes: number; read: number };
export type Banner = {
  phase: 'importing' | 'finished' | 'hidden';
  owner: boolean;
  closes: number;
  read: number;
  changedAt: number; // the last time a new row arrived (or the banner mounted)
  text: string; // the status line as announced
  want: string; // the status line as it should read; committed when the window allows
  announcedAt: number;
  slow: boolean;
  refreshes: number; // bumped when the page's server data should be re-read (the list under the banner, the end state)
  visible: boolean; // the tab is shown (document.visibilityState)
  signedOut: boolean; // a poll was answered 401/403: no more polls, the banner says so
};

const textFor = (phase: Banner['phase'], closes: number, owner: boolean) => (phase === 'finished' ? RECORD_BODY.finished : RECORD_BODY.banner(closes, owner));

export function initBanner(x: Snapshot & { owner: boolean; visible?: boolean }, now: number): Banner {
  const phase = x.state === 'importing' ? 'importing' : 'hidden';
  const text = textFor(phase, x.closes, x.owner);
  return { phase, owner: x.owner, closes: x.closes, read: x.read, changedAt: now, text, want: text, announcedAt: -Infinity, slow: false, refreshes: 0, visible: x.visible ?? true, signedOut: false };
}

function commit(b: Banner, now: number): Banner {
  // The finished note has been out for FINISHED_MS: the banner is gone (no refresh: the page already has the record).
  if (b.phase === 'finished' && b.text === RECORD_BODY.finished && now - b.announcedAt >= FINISHED_MS) return { ...b, phase: 'hidden' };
  const slow = b.owner && !b.signedOut && b.phase === 'importing' && now - b.changedAt >= SLOW_MS;
  if (b.want === b.text || now - b.announcedAt < ANNOUNCE_MS) return slow === b.slow ? b : { ...b, slow };
  return { ...b, slow, text: b.want, announcedAt: now, refreshes: b.refreshes + 1 };
}

// A poll answer (or the server's state after a refresh): fold in the counts and the state, then commit if allowed.
export function onPoll(b: Banner, r: Snapshot, now: number): Banner {
  if (b.phase !== 'importing') return b; // finished or handed over: nothing brings the importing line back
  if (r.state === 'failed') return { ...b, phase: 'hidden', slow: false, refreshes: b.refreshes + 1 };
  const moved = r.read !== b.read || r.closes !== b.closes;
  const phase: Banner['phase'] = r.state === 'importing' ? 'importing' : 'finished';
  const next = { ...b, phase, closes: r.closes, read: r.read, changedAt: moved ? now : b.changedAt, want: textFor(phase, r.closes, b.owner) };
  return commit(phase === 'finished' ? { ...next, slow: false } : next, now);
}
export const onServer = onPoll;
export const onTick = (b: Banner, now: number): Banner => (b.phase === 'hidden' ? b : commit(b, now));

// Only the owner's shown tab on an importing record polls; the hourly tick advances the import otherwise.
export const polls = (b: Banner): boolean => b.owner && b.phase === 'importing' && b.visible && !b.signedOut;
// A poll answered 401 or 403: the session ended (signed out in another tab). Polling stops; the banner says so.
export const onUnauthorized = (b: Banner): Banner => (b.signedOut ? b : { ...b, signedOut: true, slow: false });
// Hidden: polling stops (the 60 s line is not counted against a tab nobody watches). Shown again: polling resumes and
// the 60 s clock restarts, so the leave-line never appears just because the trader was away.
export function onVisibility(b: Banner, visible: boolean, now: number): Banner {
  if (visible === b.visible) return b;
  return visible ? { ...b, visible, changedAt: now, slow: false } : { ...b, visible };
}
