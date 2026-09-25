import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REMINDER_LEAD_MS, REMINDER_LEAD_LABEL } from './constants';

test('REMINDER_LEAD_LABEL: reads as one hour before', () => {
  assert.equal(REMINDER_LEAD_LABEL, '1 hour before');
});

test('REMINDER_LEAD_LABEL: matches the millisecond offset', () => {
  const hours = REMINDER_LEAD_MS / (60 * 60 * 1000);
  assert.equal(REMINDER_LEAD_LABEL, `${hours} ${hours === 1 ? 'hour' : 'hours'} before`);
});
