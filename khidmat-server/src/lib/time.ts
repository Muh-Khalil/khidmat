/**
 * Helpers for the human-readable slot/day strings used throughout the booking
 * flow (e.g. "10:00 AM", "Tomorrow", "Monday"). Pure functions, no I/O — the
 * one place that needs "now" passes it in, which keeps these unit-testable.
 */

export type SlotPreference = 'morning' | 'afternoon' | 'evening' | 'any';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Decide whether a 12-hour slot string ("2:00 PM") satisfies a rough
 * time-of-day preference. Morning = 6–11 AM, afternoon = 12–4 PM,
 * evening = 5–11 PM. Returns false for the 'any' preference so callers fall
 * back to their default pick.
 */
export function slotMatchesPreference(slot: string, preference: SlotPreference): boolean {
  const lower = slot.toLowerCase();
  const isPM = lower.includes('pm');
  const isAM = lower.includes('am');
  const match = slot.match(/(\d+)/);
  const hour = match ? parseInt(match[1]) : 12;

  if (preference === 'morning') return isAM && hour >= 6 && hour < 12;
  if (preference === 'afternoon') return isPM && (hour === 12 || hour < 5);
  if (preference === 'evening') return isPM && hour >= 5 && hour < 12;
  return false;
}

/**
 * Parse a 12-hour slot string into 24-hour components, or null if it doesn't
 * match the expected "H:MM AM/PM" shape.
 */
export function parseSlotTo24h(slot: string): { hour: number; minute: number } | null {
  const m = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;

  let hour = parseInt(m[1]);
  const minute = parseInt(m[2]);
  const meridiem = m[3].toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  return { hour, minute };
}

/**
 * Convert a day label ("Today", "Tomorrow", or a weekday name) into a number of
 * days from `todayDow` (0–6, Sunday-indexed). A named weekday always resolves to
 * the *next* such day (1–7 days out); anything unrecognized defaults to tomorrow.
 */
export function dayLabelToOffset(dayLabel: string, todayDow: number): number {
  if (dayLabel === 'Today') return 0;
  if (dayLabel === 'Tomorrow') return 1;

  const idx = DAY_NAMES.indexOf(dayLabel);
  if (idx !== -1) {
    return ((idx - todayDow + 7) % 7) || 7;
  }
  return 1;
}
