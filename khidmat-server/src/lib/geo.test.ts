import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm } from './geo';

test('haversineKm: zero distance for identical points', () => {
  const p = { lat: 33.7, lng: 73.05 };
  assert.equal(haversineKm(p, p), 0);
});

test('haversineKm: is symmetric', () => {
  const a = { lat: 33.648, lng: 72.952 };
  const b = { lat: 33.717, lng: 73.071 };
  assert.ok(Math.abs(haversineKm(a, b) - haversineKm(b, a)) < 1e-9);
});

test('haversineKm: known Islamabad sectors ~ expected km', () => {
  // G-13 to F-7, roughly 13 km apart.
  const g13 = { lat: 33.647, lng: 72.951 };
  const f7 = { lat: 33.717, lng: 73.0707 };
  const d = haversineKm(g13, f7);
  assert.ok(d > 11 && d < 15, `expected ~13km, got ${d}`);
});

test('haversineKm: one degree of latitude ~ 111 km', () => {
  const d = haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  assert.ok(Math.abs(d - 111) < 2, `expected ~111km, got ${d}`);
});
