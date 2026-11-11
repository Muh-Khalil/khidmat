import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingsSummary } from './bookings';
import { Booking } from '../schemas/booking';

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1',
  providerId: 'p001',
  providerName: 'Ali AC Services',
  category: 'ac',
  sector: 'G-13',
  scheduledFor: 'Tomorrow, 10:00 AM',
  scheduledTimestamp: 0,
  status: 'confirmed',
  reminderAt: '1 hour before',
  agentThread: [],
  createdAt: 0,
  ...over,
});

test('bookingsSummary: placeholder when empty', () => {
  assert.equal(bookingsSummary([]), '(no bookings)');
});

test('bookingsSummary: one numbered line per booking', () => {
  const out = bookingsSummary([booking(), booking({ id: 'b2', status: 'cancelled' })]);
  const lines = out.split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^1\. id=b1 .* status=confirmed$/);
  assert.match(lines[1], /^2\. id=b2 .* status=cancelled$/);
});
