import { EventQueue } from './eventQueue';
import { Booking } from '../schemas/booking';

/**
 * Typed accessors for the values runAgent injects into the LangGraph
 * `configurable` bag. Centralizes the `as` casts that would otherwise be
 * repeated at every node and tool that reads the queue, bookings, or default
 * location off an untyped config.
 */

export function getEventQueue(config: any): EventQueue {
  return config.configurable?.eventQueue as EventQueue;
}

export function getBookings(config: any): Booking[] {
  return (config.configurable?.bookings as Booking[]) || [];
}

export function getDefaultLocation(config: any): string | undefined {
  return config.configurable?.defaultLocation as string | undefined;
}

export function getCustomerInfo(config: any): { customerId?: string; customerName?: string; customerPhone?: string } {
  return {
    customerId: config.configurable?.customerId,
    customerName: config.configurable?.customerName,
    customerPhone: config.configurable?.customerPhone,
  };
}

export function getCoordinates(config: any): { lat: number; lng: number } | undefined {
  return config.configurable?.coordinates as { lat: number; lng: number } | undefined;
}

/** Original customer wording. Keep it separate from AI summaries and matching reasons. */
export function getOriginalRequest(config: any): string {
  return (config.configurable?.originalRequest as string | undefined)?.trim() || 'Service requested';
}
