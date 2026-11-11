import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectorCoords, SECTOR_COORDS } from './sectors';

test('sectorCoords: exact match returns the table entry', () => {
  assert.deepEqual(sectorCoords('F-10/3'), SECTOR_COORDS['F-10/3']);
});

test('sectorCoords: is case-insensitive', () => {
  assert.deepEqual(sectorCoords('g-13'), SECTOR_COORDS['G-13']);
});

test('sectorCoords: falls back to a sector sharing the base', () => {
  // 'F-10/9' isn't in the table, but 'F-10/1'/'F-10/3' share the F-10 base.
  const coords = sectorCoords('F-10/9');
  assert.ok(coords, 'expected a base-sector fallback');
  const bases = ['F-10/1', 'F-10/3'].map((k) => SECTOR_COORDS[k]);
  assert.ok(bases.includes(coords!), 'fallback should be an F-10 sub-sector');
});

test('sectorCoords: returns undefined when nothing shares the base', () => {
  assert.equal(sectorCoords('Z-99'), undefined);
});
