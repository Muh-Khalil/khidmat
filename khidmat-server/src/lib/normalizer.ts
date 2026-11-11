/**
 * Roman Urdu Phonetic & Dialect Normalizer
 * Standardizes noisy colloquial Pakistani speech and text variations before intent parsing.
 * References: Siddiqui et al. (2023) - Phonetic normalization for Roman Urdu.
 */

// Phonetic token mapping dictionary
const PHONETIC_MAP: Record<string, string> = {
  // Service category variations
  beejli: 'bijli',
  bijlee: 'bijli',
  bijli: 'bijli',
  electrisian: 'electrician',
  electrican: 'electrician',
  electrition: 'electrician',
  plumberr: 'plumber',
  plamber: 'plumber',
  plmbr: 'plumber',
  mistri: 'plumber',
  mistry: 'plumber',
  nal: 'plumber',
  tautor: 'tutor',
  totur: 'tutor',
  beautishun: 'beautician',
  beautision: 'beautician',
  carpentr: 'carpenter',
  carpentar: 'carpenter',
  carpintar: 'carpenter',
  badhai: 'carpenter',
  tarkhan: 'carpenter',
  paintr: 'painter',
  paintar: 'painter',
  rang: 'painter',
  safedi: 'painter',
  safai: 'cleaning',
  cleanr: 'cleaning',
  sweepr: 'cleaning',

  // Problem / Issue variations
  khrab: 'kharab',
  khrb: 'kharab',
  kharab: 'kharab',
  thanda: 'thanda',
  thnda: 'thanda',
  cooling: 'cooling',
  leek: 'leak',
  leakg: 'leakage',
  leack: 'leak',
  leakege: 'leakage',
  tapak: 'tapak',
  toot: 'toot',
  jhalka: 'jhatka',
  chahiye: 'chahiye',
  chaheye: 'chahiye',
  chahye: 'chahiye',
  chaye: 'chahiye',
  masla: 'masla',
  problem: 'problem',
  kaam: 'kaam',
  kam: 'kaam',
  banda: 'banda',
  karigar: 'karigar',
  bhejo: 'bhejo',
  bhejdo: 'bhejo',
  bhejdein: 'bhejo',
  madad: 'madad',

  // Rates & Booking
  kitna: 'kitna',
  kitne: 'kitne',
  pese: 'paise',
  paise: 'paise',
  rupay: 'rupaye',
  rupaye: 'rupaye',
  ujrat: 'ujrat',
  krna: 'karna',
  karna: 'karna',
  karein: 'karein',
  karo: 'karo',

  // Urgency & Time variations
  abhi: 'abhi',
  abh: 'abhi',
  urgnt: 'urgent',
  ergent: 'urgent',
  fauran: 'fauran',
  foran: 'fauran',
  jaldi: 'jaldi',
  jldi: 'jaldi',
  subha: 'subah',
  subah: 'subah',
  sham: 'shaam',
  shaam: 'shaam',
  dopahar: 'dopahar',
  dophr: 'dopahar',
  raat: 'raat',
  kl: 'kal',
  kal: 'kal',
  aj: 'aaj',
  aaj: 'aaj',
  itwar: 'sunday',
  sunday: 'sunday',
  peer: 'monday',
  mangal: 'tuesday',
  budh: 'wednesday',
  jumeraat: 'thursday',
  juma: 'friday',
  hafta: 'saturday',
};

// Regex to collapse >2 repeated characters (e.g., "bohaaaat" -> "bohat", "thandaaaa" -> "thanda")
function collapseRepeatedLetters(word: string): string {
  return word.replace(/(.)\1{2,}/g, '$1$1');
}

export type DialectType = 'roman_urdu' | 'urdu' | 'english' | 'mixed';

export interface NormalizationResult {
  rawText: string;
  normalizedText: string;
  dialect: DialectType;
  tokensNormalized: number;
}

export function normalizeRomanUrdu(text: string): NormalizationResult {
  if (!text || !text.trim()) {
    return {
      rawText: text || '',
      normalizedText: '',
      dialect: 'english',
      tokensNormalized: 0,
    };
  }

  const raw = text.trim();

  // Detect script (contains Urdu / Arabic Unicode range U+0600 - U+06FF)
  const containsUrduScript = /[\u0600-\u06FF]/.test(raw);
  const containsLatinScript = /[a-zA-Z]/.test(raw);

  let dialect: DialectType = 'english';
  if (containsUrduScript && containsLatinScript) {
    dialect = 'mixed';
  } else if (containsUrduScript) {
    dialect = 'urdu';
  }

  // Tokenize preserving sector tags like "G-13", "F-10/3"
  const tokens = raw.split(/\s+/);
  let normalizedCount = 0;
  let romanUrduTokenCount = 0;

  const processed = tokens.map((tok) => {
    // Preserve sector codes (e.g. G-13, F-10, I-8)
    if (/^[A-Za-z]-\d+(\/\d+)?$/i.test(tok)) {
      return tok.toUpperCase();
    }

    // Strip edge punctuation for dictionary check
    const clean = tok.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
    const collapsed = collapseRepeatedLetters(clean);

    if (PHONETIC_MAP[collapsed]) {
      normalizedCount++;
      romanUrduTokenCount++;
      const replacement = PHONETIC_MAP[collapsed];
      return tok.toLowerCase().replace(clean, replacement);
    }

    // Check if word has typical Roman Urdu characteristics
    if (/^(mein|hai|hoon|ho|ko|ka|ki|ke|se|par|ye|wo|mera|meri|karo|bhejo)$/i.test(clean)) {
      romanUrduTokenCount++;
    }

    return tok;
  });

  if (dialect !== 'urdu' && dialect !== 'mixed') {
    if (romanUrduTokenCount > 0) {
      dialect = 'roman_urdu';
    }
  }

  return {
    rawText: raw,
    normalizedText: processed.join(' '),
    dialect,
    tokensNormalized: normalizedCount,
  };
}
