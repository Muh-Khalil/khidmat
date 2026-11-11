import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedJobTransitions, canTransitionJob } from './jobLifecycle';

test('job lifecycle accepts valid operational progress', () => {
  assert.equal(canTransitionJob('dispatched', 'accepted'), true);
  assert.equal(canTransitionJob('accepted', 'in_progress'), true);
  assert.equal(canTransitionJob('in_progress', 'completed'), true);
});

test('job lifecycle rejects impossible regressions', () => {
  assert.equal(canTransitionJob('completed', 'accepted'), false);
  assert.equal(canTransitionJob('declined', 'completed'), false);
  assert.equal(canTransitionJob('accepted', 'accepted'), false);
  assert.deepEqual(allowedJobTransitions('completed'), []);
});
