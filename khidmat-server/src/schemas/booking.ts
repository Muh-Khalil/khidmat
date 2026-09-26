import { z } from 'zod';
import { ServiceCategoryEnum } from './common';

/** Lifecycle states a booking can be in. Single source for the enum + type. */
export const BOOKING_STATUSES = ['confirmed', 'reminded', 'completed', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BookingSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  category: ServiceCategoryEnum,
  sector: z.string(),
  scheduledFor: z.string(),
  scheduledTimestamp: z.number(),
  status: z.enum(BOOKING_STATUSES as unknown as [string, ...string[]]),
  reminderAt: z.string(),
  agentThread: z.array(z.unknown()),
  createdAt: z.number(),
});

export type Booking = z.infer<typeof BookingSchema>;
