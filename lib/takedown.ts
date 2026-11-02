// F-16 (plan docs/features/logs/F-16-F-17/plan.md §2.4, §5.4, §5.7, §11): where the draft trust copy may render.
// Code-gated, not env-gated: the owner approves a wording by flipping its constant in lib/copy.ts (TAKEDOWN.approved,
// TRUST_LINE.approved). Until then both render only in the sandbox (lib/launch-gate.ts), where nothing real can enter.
// A deploy that admits real users is 'open' or 'closed' (closed admits allowlisted real accounts), so it counts as real.
// Pure and env-driven; read-only use of the launch gate.
import { gateState } from './launch-gate.ts';
import type { Env } from './vendor-env.ts';
import { TAKEDOWN, TRUST_LINE } from './copy.ts';

/** The role mailbox the takedown page shows (env TAKEDOWN_CONTACT, never committed); null when unset or not an address. */
export function takedownContact(env: Env = process.env): string | null {
  const c = env.TAKEDOWN_CONTACT?.trim();
  return c && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) ? c : null;
}

/**
 * Whether /takedown renders (and the report page links to it). Sandbox: always, draft banner on. Any other deploy: only
 * once the owner approved the wording and set the contact; otherwise the page is a 404.
 */
export function takedownReachable(env: Env = process.env, approved: boolean = TAKEDOWN.approved): boolean {
  if (gateState(env) === 'sandbox') return true;
  return approved && takedownContact(env) !== null;
}

/** Whether the anti-impersonation line renders (profile and pane): approved, or the sandbox while it is a draft. */
export function impersonationLineShown(env: Env = process.env, approved: boolean = TRUST_LINE.approved): boolean {
  return approved || gateState(env) === 'sandbox';
}
