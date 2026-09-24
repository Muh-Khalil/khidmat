import type { ServiceCategory } from './mock/providers';

/**
 * Single source of truth for how service categories are presented in the UI.
 * Previously each screen re-declared these maps (and drifted — the chat screen
 * used role labels like "Plumber" while cards used service labels like
 * "Plumbing"), so both variants live here explicitly.
 */

export const CATEGORY_EMOJI: Record<ServiceCategory, string> = {
  ac: '❄️',
  plumber: '🔧',
  electrician: '⚡',
  tutor: '📚',
  beautician: '💅',
};

/** Service-oriented labels, e.g. shown on provider/booking cards. */
export const CATEGORY_SERVICE_LABEL: Record<ServiceCategory, string> = {
  ac: 'AC Repair',
  plumber: 'Plumbing',
  electrician: 'Electrical',
  tutor: 'Tutoring',
  beautician: 'Beauty',
};

/** Person-oriented labels, e.g. shown in the chat flow ("finding a Plumber"). */
export const CATEGORY_ROLE_LABEL: Record<ServiceCategory, string> = {
  ac: 'AC Technician',
  plumber: 'Plumber',
  electrician: 'Electrician',
  tutor: 'Tutor',
  beautician: 'Beautician',
};

/** Lowercase noun for inline sentences, e.g. "Closest available technician". */
export const CATEGORY_NOUN: Record<ServiceCategory, string> = {
  ac: 'technician',
  plumber: 'plumber',
  electrician: 'electrician',
  tutor: 'tutor',
  beautician: 'beautician',
};

const FALLBACK_EMOJI = '🛠';

/** Emoji for a category, tolerant of unknown/loosely-typed values. */
export function categoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category as ServiceCategory] ?? FALLBACK_EMOJI;
}

/** Service label for a category, falling back to the raw value if unknown. */
export function categoryServiceLabel(category: string): string {
  return CATEGORY_SERVICE_LABEL[category as ServiceCategory] ?? category;
}

/** Role label for a category, falling back to the raw value if unknown. */
export function categoryRoleLabel(category: string): string {
  return CATEGORY_ROLE_LABEL[category as ServiceCategory] ?? category;
}
