import test from 'node:test';
import assert from 'node:assert/strict';
import { createClaimProof, maskPhone, verifyClaimProof } from './externalProviders';

test('external claim proof is signed and tamper-resistant', () => {
  const token = createClaimProof({ source: 'google_places', externalId: 'place_123', category: 'plumber' });
  assert.equal(verifyClaimProof(token)?.externalId, 'place_123');
  assert.equal(verifyClaimProof(`${token}x`), null);
});

test('external phone is masked before returning a claim challenge', () => {
  assert.equal(maskPhone('+92 300 1234567'), '••••••4567');
});
