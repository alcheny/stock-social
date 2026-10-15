import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowSharePrompt } from './share-prompt.ts';

const base = { snaptrade_user_id: 'st_1', last_synced_at: new Date(), share_prompt_seen_at: null };

test('first sync shows the prompt', () => assert.equal(shouldShowSharePrompt(base), true));
test('a second visit does not (seen_at set)', () => assert.equal(shouldShowSharePrompt({ ...base, share_prompt_seen_at: new Date() }), false));
test('a dismissal does not show it again', () => assert.equal(shouldShowSharePrompt({ ...base, share_prompt_seen_at: new Date() }), false));
test('demo / never-connected users never see it', () => assert.equal(shouldShowSharePrompt({ ...base, snaptrade_user_id: null }), false));
test('no sync yet means no prompt', () => assert.equal(shouldShowSharePrompt({ ...base, last_synced_at: null }), false));
