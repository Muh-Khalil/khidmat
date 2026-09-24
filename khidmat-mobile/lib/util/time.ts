/**
 * Slot-string time helpers. The mock agent works with 12-hour slot strings like
 * "10:00 AM"; these centralize the parsing so the AM/PM regex lives in one place.
 */

/** Parse a "H:MM AM/PM" slot into 24-hour components, or null if malformed. */
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

/** Format 24-hour components back into a "H:MM AM/PM" slot string. Takes a
 *  numeric minute (matching parseSlotTo24h's output) and zero-pads it. */
export function format12h(hour24: number, minute: number): string {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  let hour = hour24 % 12;
  if (hour === 0) hour = 12;
  const mm = String(minute).padStart(2, '0');
  return `${hour}:${mm} ${period}`;
}
