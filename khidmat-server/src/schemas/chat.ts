import { z } from 'zod';
import { BookingSchema } from './booking';

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty').max(2000),
  sessionId: z.string().optional(),
  defaultLocation: z.string().optional(),
  bookings: z.array(BookingSchema).optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
