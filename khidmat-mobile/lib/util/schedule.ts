/**
 * Format a day label and slot into the app's canonical "Day, Slot" string,
 * e.g. "Tomorrow, 10:00 AM" — used both for the stored booking's scheduledFor
 * and the provider card's time chip so they read identically.
 */
export function formatSchedule(dayLabel: string, slot: string): string {
  return `${dayLabel}, ${slot}`;
}
