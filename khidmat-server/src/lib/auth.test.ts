import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, hashPin, verifyPin, verifySessionToken } from './auth';

test('PIN hashing verifies the correct PIN only', async () => {
  const hash = await hashPin('1234');
  assert.equal(await verifyPin('1234', hash), true);
  assert.equal(await verifyPin('9999', hash), false);
  assert.equal(hash.includes('1234'), false);
});

test('signed sessions reject tampering', () => {
  const token = createSessionToken('usr_test', 'customer');
  assert.equal(verifySessionToken(token)?.userId, 'usr_test');
  assert.equal(verifySessionToken(`${token}x`), null);
});
