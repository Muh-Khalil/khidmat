import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRomanUrdu } from './normalizer';

test('Roman Urdu Normalizer - Phonetic Spellings', () => {
  const input = 'Mera beejli ka kam khrab hai, electrisian bhejo';
  const result = normalizeRomanUrdu(input);

  assert.equal(result.dialect, 'roman_urdu');
  assert.ok(result.tokensNormalized >= 3);
  assert.match(result.normalizedText, /bijli/);
  assert.match(result.normalizedText, /kaam/);
  assert.match(result.normalizedText, /kharab/);
  assert.match(result.normalizedText, /electrician/);
});

test('Roman Urdu Normalizer - Repeated Letter Collapse', () => {
  const input = 'AC thandaaaaa nahi kar raha, bohaaaat garmi hai';
  const result = normalizeRomanUrdu(input);

  assert.match(result.normalizedText, /thanda/);
  assert.equal(result.dialect, 'roman_urdu');
});

test('Roman Urdu Normalizer - Sector Code Preservation', () => {
  const input = 'plamber chahiye g-13 mein kl subha';
  const result = normalizeRomanUrdu(input);

  // Sector code must be normalized to uppercase G-13
  assert.match(result.normalizedText, /G-13/);
  assert.match(result.normalizedText, /plumber/);
  assert.match(result.normalizedText, /kal/);
  assert.match(result.normalizedText, /subah/);
});

test('Roman Urdu Normalizer - Script & Dialect Detection', () => {
  // Pure English
  const eng = normalizeRomanUrdu('I need an electrician for AC repair in F-10');
  assert.equal(eng.dialect, 'english');

  // Roman Urdu
  const rUrdu = normalizeRomanUrdu('pani leak ho raha hai fauran mistri bhejo');
  assert.equal(rUrdu.dialect, 'roman_urdu');
  assert.match(rUrdu.normalizedText, /plumber/);
  assert.match(rUrdu.normalizedText, /fauran/);

  // Pure Urdu Script
  const urdu = normalizeRomanUrdu('مجھے اے سی ٹیکنیشن چاہیے');
  assert.equal(urdu.dialect, 'urdu');
});

test('Roman Urdu Normalizer - Extended Informal Trade Vocabulary', () => {
  const input = 'darwaza toot gaya hai carpentr ya badhai bhejdein aur paintar ka kitna ujrat hoga';
  const result = normalizeRomanUrdu(input);

  assert.equal(result.dialect, 'roman_urdu');
  assert.match(result.normalizedText, /carpenter/);
  assert.match(result.normalizedText, /painter/);
  assert.match(result.normalizedText, /bhejo/);
  assert.match(result.normalizedText, /ujrat/);
});

