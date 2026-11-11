import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotMatchesPreference, parseSlotTo24h, dayLabelToOffset } from './time';

test('slotMatchesPreference: morning matches 6-11 AM only', () => {
  assert.equal(slotMatchesPreference('9:00 AM', 'morning'), true);
  assert.equal(slotMatchesPreference('11:00 AM', 'morning'), true);
  assert.equal(slotMatchesPreference('5:00 AM', 'morning'), false); // before 6
  assert.equal(slotMatchesPreference('2:00 PM', 'morning'), false);
});

test('slotMatchesPreference: afternoon matches 12-4 PM', () => {
  assert.equal(slotMatchesPreference('12:00 PM', 'afternoon'), true);
  assert.equal(slotMatchesPreference('4:00 PM', 'afternoon'), true);
  assert.equal(slotMatchesPreference('5:00 PM', 'afternoon'), false);
  assert.equal(slotMatchesPreference('11:00 AM', 'afternoon'), false);
});

test('slotMatchesPreference: evening matches 5-11 PM', () => {
  assert.equal(slotMatchesPreference('6:00 PM', 'evening'), true);
  assert.equal(slotMatchesPreference('4:00 PM', 'evening'), false);
  assert.equal(slotMatchesPreference('12:00 PM', 'evening'), false);
});

test("slotMatchesPreference: 'any' never forces a match", () => {
  assert.equal(slotMatchesPreference('10:00 AM', 'any'), false);
});

test('slotMatchesPreference: hour boundaries around 12', () => {
  // 12:00 AM is not morning (morning is 6-11 AM).
  assert.equal(slotMatchesPreference('12:00 AM', 'morning'), false);
  // Noon counts as afternoon, not morning.
  assert.equal(slotMatchesPreference('12:00 PM', 'morning'), false);
  assert.equal(slotMatchesPreference('12:00 PM', 'afternoon'), true);
  // 11 PM is the top of the evening window.
  assert.equal(slotMatchesPreference('11:00 PM', 'evening'), true);
  // 1 PM is afternoon.
  assert.equal(slotMatchesPreference('1:00 PM', 'afternoon'), true);
});

test('parseSlotTo24h: converts 12h to 24h', () => {
  assert.deepEqual(parseSlotTo24h('10:00 AM'), { hour: 10, minute: 0 });
  assert.deepEqual(parseSlotTo24h('12:00 PM'), { hour: 12, minute: 0 });
  assert.deepEqual(parseSlotTo24h('12:30 AM'), { hour: 0, minute: 30 });
  assert.deepEqual(parseSlotTo24h('6:15 PM'), { hour: 18, minute: 15 });
});

test('parseSlotTo24h: returns null on malformed input', () => {
  assert.equal(parseSlotTo24h('sometime'), null);
  assert.equal(parseSlotTo24h('10 AM'), null);
});

test('dayLabelToOffset: Today/Tomorrow', () => {
  assert.equal(dayLabelToOffset('Today', 3), 0);
  assert.equal(dayLabelToOffset('Tomorrow', 3), 1);
});

test('dayLabelToOffset: named weekday resolves to next occurrence', () => {
  // today is Wednesday (3). Friday (5) is 2 days out.
  assert.equal(dayLabelToOffset('Friday', 3), 2);
  // today is Wednesday (3). Wednesday resolves to next week (7), never 0.
  assert.equal(dayLabelToOffset('Wednesday', 3), 7);
  // wrap-around: today Friday (5), Monday (1) is 3 days out.
  assert.equal(dayLabelToOffset('Monday', 5), 3);
});

test('dayLabelToOffset: unknown label defaults to tomorrow', () => {
  assert.equal(dayLabelToOffset('Someday', 3), 1);
});
