import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'express';
import { handleSuccess, handleError } from './responseHandler';

/** Fake Response capturing the status code and JSON body. */
function fakeRes() {
  const captured: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;
  return { res, captured };
}

test('handleSuccess: wraps data in a success envelope', () => {
  const { res, captured } = fakeRes();
  handleSuccess(res, 200, 'ok', { a: 1 });
  assert.equal(captured.status, 200);
  assert.deepEqual(captured.body, { success: true, message: 'ok', data: { a: 1 } });
});

test('handleSuccess: data defaults to null', () => {
  const { res, captured } = fakeRes();
  handleSuccess(res, 201, 'created');
  assert.deepEqual(captured.body, { success: true, message: 'created', data: null });
});

test('handleError: wraps in a failure envelope with the status', () => {
  const { res, captured } = fakeRes();
  handleError(res, 404, 'not found');
  assert.equal(captured.status, 404);
  assert.deepEqual(captured.body, { success: false, message: 'not found', data: null });
});
