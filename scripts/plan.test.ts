import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outcome, renderDiscussion, type Turn } from './plan.ts';

const iss = (title: string) => [{ title, body: 'b', single: false }];
const t = (who: Turn['who'], agree: boolean, title: string): Turn => ({ who, agree, critique: `${who} says`, issues: iss(title), costUsd: 0.5 });

test('agreement adopts the plan the agreeing side accepted', () => {
  const r = outcome([t('lead', false, 'draft'), t('engineer', false, 'rev1'), t('lead', true, 'ignored')]);
  assert.deepEqual(r, { issues: iss('rev1'), agreed: true });
});

test('a draft alone, or no agreement, uses the latest plan unagreed', () => {
  assert.deepEqual(outcome([t('lead', true, 'draft')]), { issues: iss('draft'), agreed: false });
  assert.deepEqual(outcome([t('lead', false, 'draft'), t('engineer', false, 'rev1')]), { issues: iss('rev1'), agreed: false });
  assert.deepEqual(outcome([]), { issues: [], agreed: false });
});

test('discussion names each turn and the total cost', () => {
  const md = renderDiscussion([t('lead', false, 'draft'), t('engineer', true, 'draft')], true);
  assert.match(md, /agreed by business lead and engineer, 2 turns, \$1\.00/);
  assert.match(md, /1\. Business lead \(draft\)/);
  assert.match(md, /2\. Engineer \(agrees\)/);
});
