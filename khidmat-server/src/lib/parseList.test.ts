import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseList } from './parseList';

test('parseList: undefined for unset or blank input', () => {
  assert.equal(parseList(undefined), undefined);
  assert.equal(parseList(''), undefined);
  assert.equal(parseList('   '), undefined);
  assert.equal(parseList(',, ,'), undefined);
});

test('parseList: splits, trims, and drops empties', () => {
  assert.deepEqual(parseList('a,b,c'), ['a', 'b', 'c']);
  assert.deepEqual(parseList(' a , b ,, c '), ['a', 'b', 'c']);
});

test('parseList: single value', () => {
  assert.deepEqual(parseList('https://example.com'), ['https://example.com']);
});
