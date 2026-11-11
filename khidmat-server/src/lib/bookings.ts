import { Booking } from '../schemas/booking';

/**
 * Render the user's bookings as a compact, numbered list for the booking-flow
 * system prompts, so the model can refer to them when resolving which booking
 * the user means.
 */
export function bookingsSummary(bookings: Booking[]): string {
  if (!bookings.length) return '(no bookings)';
  return bookings
    .map(
      (b, i) =>
        `${i + 1}. id=${b.id} | ${b.category} with ${b.providerName} | ${b.scheduledFor} | status=${b.status}`,
    )
    .join('\n');
}
