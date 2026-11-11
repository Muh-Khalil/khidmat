import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'express';
import { writeEvent, writeError } from './sse';

/** Minimal fake Response that records everything written. */
function fakeRes() {
  const chunks: string[] = [];
  const res = { write: (c: string) => chunks.push(c) } as unknown as Response;
  return { res, chunks };
}

test('writeEvent: emits a single data frame with the JSON event', () => {
  const { res, chunks } = fakeRes();
  writeEvent(res, { type: 'ranking', candidateCount: 3 });
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], 'data: {"type":"ranking","candidateCount":3}\n\n');
});

test('writeError: emits a typed error frame', () => {
  const { res, chunks } = fakeRes();
  writeError(res, 'boom');
  assert.equal(chunks[0], 'data: {"type":"error","message":"boom"}\n\n');
});

test('SSE frames end with a blank line', () => {
  const { res, chunks } = fakeRes();
  writeEvent(res, { type: 'confirmed', bookingId: 'b1' });
  assert.ok(chunks[0].endsWith('\n\n'));
});
