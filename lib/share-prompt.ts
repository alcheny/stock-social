// The one-time "Your record is live" moment on the owner's profile after the first broker sync.
export type SharePromptUser = {
  snaptrade_user_id: string | null;
  last_synced_at: Date | null;
  share_prompt_seen_at: Date | null;
};

export const SHARE_ACTIONS = ['dismissed', 'copied', 'shared'] as const;
export type ShareAction = (typeof SHARE_ACTIONS)[number];

export const shouldShowSharePrompt = (u: SharePromptUser): boolean =>
  u.snaptrade_user_id !== null && u.last_synced_at !== null && u.share_prompt_seen_at === null;
