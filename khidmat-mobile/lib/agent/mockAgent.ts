import type { ServiceCategory } from '../mock/providers';
import { providers } from '../mock/providers';
import { haversineKm } from '../util/distance';
import { sectorCoords } from '../util/sectors';
import { parseSlotTo24h, format12h } from '../util/time';
import { CATEGORY_NOUN } from '../categories';
import { makeId } from '../util/id';
import type { AgentEvent, ExtractedIntent } from './types';

/** Per-request context the chat screen passes into the mock agent. */
export type AgentContext = {
  defaultLocation: string;
  conversationHistory: AgentEvent[];
};

// ── Keyword tables ──────────────────────────────────────────────

const SERVICE_KEYWORDS: Record<ServiceCategory, string[]> = {
  ac: ['ac', 'air condition', 'cooling'],
  plumber: ['plumb', 'leak', 'tap', 'nal', 'pipe', 'bathroom'],
  electrician: ['electric', 'wiring', 'bijli', 'switch', 'fan'],
  tutor: ['tutor', 'teach', 'tuition', 'math', 'english', 'science', 'ustaad'],
  beautician: [
    'beautician',
    'salon',
    'beauty',
    'makeup',
    'facial',
    'hair',
    'haircut',
  ],
};

const TIME_KEYWORDS: Record<string, string> = {
  kal: 'tomorrow',
  tomorrow: 'tomorrow',
  subah: 'morning',
  morning: 'morning',
  shaam: 'evening',
  evening: 'evening',
  raat: 'night',
  night: 'night',
  abhi: 'now',
  now: 'now',
  asap: 'now',
  aaj: 'today',
  today: 'today',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

// ── Helpers ─────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Simulated "thinking" pauses between streamed stages, so the mock agent feels
// like it's working rather than dumping every event at once.
const STAGE_DELAY_MS = {
  understanding: 500,
  searching: 700,
  ranking: 400,
  booking: 1000,
  confirmed: 300,
} as const;

// Ranking trade-off: how many km one rating star is "worth" when scoring
// candidates. Higher = rating matters more relative to proximity.
const RATING_WEIGHT_KM = 5;

// Fallback reminder label used when a slot time can't be parsed into a
// concrete "before" time. Shared with the chat screen's booking fallback.
export const DEFAULT_REMINDER_LABEL = '1 hour before';

function detectService(msg: string): ServiceCategory | null {
  const lower = msg.toLowerCase();
  for (const [category, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return category as ServiceCategory;
    }
  }
  return null;
}

function detectLocation(msg: string): string | null {
  // Match patterns like G-13, F-10/3, I-8/3, F-7, etc.
  const match = msg.match(/\b([A-Ia-i]-\d{1,2}(?:\/\d)?)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function detectTime(msg: string): string | null {
  const lower = msg.toLowerCase();
  const parts: string[] = [];

  for (const [keyword, label] of Object.entries(TIME_KEYWORDS)) {
    if (lower.includes(keyword)) {
      if (!parts.includes(label)) parts.push(label);
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

function resolveSlotFromTime(
  time: string,
  availableSlots: string[],
): string | null {
  if (!time || availableSlots.length === 0) return availableSlots[0] ?? null;

  const lower = time.toLowerCase();

  if (lower.includes('morning') || lower.includes('subah')) {
    // Prefer morning slots (before 12 PM)
    const morning = availableSlots.find((s) => {
      const hour = parseInt(s.split(':')[0]);
      return s.includes('AM') && hour >= 6 && hour <= 11;
    });
    return morning ?? availableSlots[0];
  }

  if (lower.includes('evening') || lower.includes('shaam')) {
    const evening = availableSlots.find((s) => {
      const hour = parseInt(s.split(':')[0]);
      // 12 PM already satisfies hour >= 4, so no separate noon check is needed.
      return s.includes('PM') && hour >= 4;
    });
    return evening ?? availableSlots[availableSlots.length - 1];
  }

  if (lower.includes('now') || lower.includes('asap')) {
    return availableSlots[0];
  }

  return availableSlots[0];
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function resolveSchedule(
  time: string | null,
): { dayLabel: string; daysOffset: number } {
  if (!time) return { dayLabel: 'Tomorrow', daysOffset: 1 };
  const lower = time.toLowerCase();
  if (/\b(kal|tomorrow)\b/.test(lower)) {
    return { dayLabel: 'Tomorrow', daysOffset: 1 };
  }
  if (/\b(aaj|today|abhi|now|asap)\b/.test(lower)) {
    return { dayLabel: 'Today', daysOffset: 0 };
  }
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (lower.includes(WEEKDAYS[i].toLowerCase())) {
      const today = new Date().getDay();
      const offset = ((i - today + 7) % 7) || 7; // next occurrence (skip today)
      return { dayLabel: WEEKDAYS[i], daysOffset: offset };
    }
  }
  return { dayLabel: 'Tomorrow', daysOffset: 1 };
}

function computeScheduledTimestamp(daysOffset: number, slot: string): number {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const parsed = parseSlotTo24h(slot);
  if (parsed) {
    date.setHours(parsed.hour, parsed.minute, 0, 0);
  }
  return date.getTime();
}

function computeReminderTime(slot: string): string {
  // Parse slot like '10:00 AM' → compute 1 hour before
  const parsed = parseSlotTo24h(slot);
  if (!parsed) return DEFAULT_REMINDER_LABEL;

  const hourBefore = (parsed.hour - 1 + 24) % 24;
  return format12h(hourBefore, parsed.minute);
}

// ── Main agent generator ────────────────────────────────────────

export async function* runAgent(
  userMessage: string,
  context: AgentContext,
): AsyncGenerator<AgentEvent> {
  // Check if this is a follow-up answer to a previous awaiting_user event
  const lastAwaiting = context.conversationHistory
    .filter((e): e is Extract<AgentEvent, { type: 'awaiting_user' }> => e.type === 'awaiting_user')
    .pop();

  let service = detectService(userMessage);
  let location = detectLocation(userMessage);
  let time = detectTime(userMessage);

  // If following up on a previous question, merge with prior context
  if (lastAwaiting) {
    // Try to recover prior extracted data from the last understanding event
    const lastUnderstanding = context.conversationHistory
      .filter(
        (e): e is Extract<AgentEvent, { type: 'understanding' }> =>
          e.type === 'understanding',
      )
      .pop();

    if (lastUnderstanding) {
      if (!service && lastUnderstanding.extracted.service)
        service = lastUnderstanding.extracted.service;
      if (!location && lastUnderstanding.extracted.location)
        location = lastUnderstanding.extracted.location;
      if (!time && lastUnderstanding.extracted.time)
        time = lastUnderstanding.extracted.time;
    }

    // For location follow-up, also try to detect the sector from this message
    if (lastAwaiting.missing === 'location' && !location) {
      location = detectLocation(userMessage);
    }
    // For time follow-up, try to detect time
    if (lastAwaiting.missing === 'time' && !time) {
      time = detectTime(userMessage);
    }
  }

  let usedDefaultLocation = false;

  // If location is still missing, try default
  if (!location && context.defaultLocation) {
    location = context.defaultLocation;
    usedDefaultLocation = true;
  }

  const extracted: ExtractedIntent = {
    service,
    location,
    time,
    resolvedSlot: null,
  };

  // 1. Understanding
  yield {
    type: 'understanding',
    extracted,
    usedDefaultLocation,
  };
  await delay(STAGE_DELAY_MS.understanding);

  // 2. Branching — check for missing info
  if (!service) {
    yield {
      type: 'awaiting_user',
      question:
        'I help with AC repair, plumbing, electrical, tutoring, and beauty services. What do you need?',
      missing: 'service',
    };
    return;
  }

  if (!location) {
    yield {
      type: 'awaiting_user',
      question:
        'Which sector should I look in? For example, G-13, F-10/3, or I-8.',
      missing: 'location',
    };
    return;
  }

  if (!time) {
    yield {
      type: 'awaiting_user',
      question:
        'When do you need this service? For example, "kal subah" or "abhi".',
      missing: 'time',
    };
    return;
  }

  // 3. Searching
  yield {
    type: 'searching',
    near: location,
    category: service,
  };
  await delay(STAGE_DELAY_MS.searching);

  // 4. Filter + rank
  const userCoords = sectorCoords(location);
  const candidates = providers
    .filter((p) => p.category === service)
    .map((p) => ({
      provider: p,
      distanceKm: haversineKm(userCoords, p.coords),
    }))
    .sort((a, b) => {
      // Composite score: lower distance + higher rating = better
      const distScore = a.distanceKm - b.distanceKm; // lower is better
      const ratingScore =
        (b.provider.rating - a.provider.rating) * RATING_WEIGHT_KM; // higher is better
      return distScore + ratingScore;
    });

  yield {
    type: 'ranking',
    candidateCount: candidates.length,
  };
  await delay(STAGE_DELAY_MS.ranking);

  // 5. Recommendation
  const top = candidates[0];
  if (!top) return;

  const suggestedSlot = resolveSlotFromTime(time, top.provider.availableSlots);
  if (!suggestedSlot) return;

  // Build human-friendly reasoning
  const reasoning = `Closest available ${CATEGORY_NOUN[service]} with ${top.provider.rating}★ from ${top.provider.reviewCount} reviews.`;

  const { dayLabel, daysOffset } = resolveSchedule(time);
  const scheduledTimestamp = computeScheduledTimestamp(daysOffset, suggestedSlot);

  yield {
    type: 'recommendation',
    provider: top.provider,
    distanceKm: Math.round(top.distanceKm * 10) / 10,
    reasoning,
    suggestedSlot,
    dayLabel,
    scheduledTimestamp,
  };
}

// ── Booking confirmation generator ──────────────────────────────

export async function* confirmBooking(
  provider: (typeof providers)[number],
  slot: string,
  dayLabel: string,
): AsyncGenerator<AgentEvent> {
  yield {
    type: 'booking',
    provider,
    slot,
  };
  await delay(STAGE_DELAY_MS.booking);

  const bookingId = makeId('b');
  yield {
    type: 'confirmed',
    bookingId,
  };
  await delay(STAGE_DELAY_MS.confirmed);

  const reminderTime = computeReminderTime(slot);
  yield {
    type: 'reminder_scheduled',
    at: `${reminderTime} ${dayLabel}`,
  };
}
