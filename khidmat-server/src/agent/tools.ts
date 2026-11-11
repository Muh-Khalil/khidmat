import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { db } from '../db';
import { sectorCoords } from '../data/sectors';
import { ServiceCategoryEnum } from '../schemas/common';
import { getEventQueue, getBookings, getCustomerInfo, getCoordinates, getOriginalRequest } from './config';
import { gemini } from '../lib/gemini';
import { BOOKING_STATUSES } from '../schemas/booking';
import { REMINDER_LEAD_MS, REMINDER_LEAD_LABEL } from '../config/constants';
import { slotMatchesPreference, parseSlotTo24h, dayLabelToOffset } from '../lib/time';
import { haversineKm } from '../lib/geo';
import { disambiguationPrompt } from './prompts';

// Search Provider tools
export const searchProviders = tool(
  async ({ category, sector }, config) => {
    const queue = getEventQueue(config);
    queue.push({ type: 'searching', near: sector, category: category as any });

    const providers = await db.listProvidersByCategory(category);
    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      sector: p.sector,
      coords: p.location,
      rating: p.rating,
      totalJobs: p.totalJobs,
      experienceYears: p.experienceYears,
      phone: p.phone,
      availableSlots: p.availableSlots,
    }));
  },
  {
    name: 'searchProviders',
    description: 'Find providers in the dataset matching the service category.',
    schema: z.object({
      category: ServiceCategoryEnum,
      sector: z.string(),
    }),
  }
);

// Rank by Distance tool
export const rankByDistance = tool(
  async ({ providers: inputProviders, fromSector }, config) => {
    const queue = getEventQueue(config);
    const liveCoords = getCoordinates(config);
    const userCoords = liveCoords || sectorCoords(fromSector);
    if (!userCoords) return { error: 'unknown_sector', sector: fromSector };

    const category = (inputProviders[0]?.category as any) || 'ac';
    const ranked = await db.searchAndRankProviders({
      category,
      userCoords,
      radiusMeters: 15000,
      limit: 5,
    });

    const formatted = ranked.map((r) => ({
      provider: {
        id: r.provider.id,
        name: r.provider.name,
        category: r.provider.category,
        sector: r.provider.sector,
        coords: r.provider.location,
        rating: r.provider.rating,
        totalJobs: r.provider.totalJobs,
        experienceYears: r.provider.experienceYears,
        phone: r.provider.phone,
        availableSlots: r.provider.availableSlots,
      },
      distanceKm: r.distanceKm,
      skillSimilarity: r.skillSimilarity,
      compositeScore: r.compositeScore,
    }));

    queue.push({ type: 'ranking', candidateCount: formatted.length });
    return formatted;
  },
  {
    name: 'rankByDistance',
    description: 'Rank candidates by distance, skill vector similarity, and rating.',
    schema: z.object({
      providers: z.array(z.record(z.string(), z.any())).describe('The array of providers returned by searchProviders'),
      fromSector: z.string().describe('The user sector'),
    }),
  }
);

// Check availability Tool used for booking a service
export const checkAvailability = tool(
  async ({ providerId, dayLabel, slotPreference }, config) => {
    const provider = await db.getProviderById(providerId);
    if (!provider) return null;

    const pickedSlot =
      provider.availableSlots.find((slot) => slotMatchesPreference(slot, slotPreference)) ??
      provider.availableSlots[0];

    const d = new Date();
    d.setDate(d.getDate() + dayLabelToOffset(dayLabel, d.getDay()));

    const parsed = parseSlotTo24h(pickedSlot);
    if (parsed) {
      d.setHours(parsed.hour, parsed.minute, 0, 0);
    }

    return { slot: pickedSlot, scheduledTimestamp: d.getTime() };
  },
  {
    name: 'checkAvailability',
    description: 'Check availability of a provider and get the resolved slot and timestamp.',
    schema: z.object({
      providerId: z.string(),
      dayLabel: z.string(),
      slotPreference: z.enum(['morning', 'afternoon', 'evening', 'any']),
    }),
  }
);

// Confirm Booking Tool used for booking a service
export const confirmBooking = tool(
  async ({ providerId, slot, dayLabel, scheduledTimestamp, distanceKm, reasoning }, config) => {
    const queue = getEventQueue(config);
    const provider = await db.getProviderById(providerId);
    if (!provider) return { error: 'unknown_provider', providerId };

    const cust = getCustomerInfo(config);
    const liveCoords = getCoordinates(config);
    const originalRequest = getOriginalRequest(config);

    // Record the recommendation only. A marketplace request is created after
    // the customer taps the explicit "Request bhejein" action.
    await db
      .createAuditLog({
        eventType: 'PROVIDER_RECOMMENDATION_SHOWN',
        chosenProviderId: provider.id,
        rationale: reasoning,
        intentData: { providerId, slot, dayLabel, distanceKm, originalRequest, location: liveCoords, customerId: cust.customerId },
      })
      .catch(() => {});

    const providerView = {
      id: provider.id,
      name: provider.name,
      category: provider.category,
      sector: provider.sector,
      coords: provider.location,
      rating: provider.rating,
      reviewCount: provider.totalJobs,
      yearsExperience: provider.experienceYears,
      priceRange: `Rs ${provider.hourlyRate}`,
      phone: provider.phone,
      availableSlots: provider.availableSlots,
    };

    queue.push({
      type: 'recommendation',
      provider: providerView as any,
      distanceKm: parseFloat(distanceKm.toFixed(1)),
      reasoning,
      suggestedSlot: slot,
      dayLabel,
      scheduledTimestamp,
    });

    return { recommendationPrepared: true, providerId: provider.id };
  },
  {
    name: 'confirmBooking',
    description:
      'Prepare the best provider recommendation for customer review. This does not book automatically. MUST provide a 2-3 sentence reasoning comparing the top pick against alternatives.',
    schema: z.object({
      providerId: z.string(),
      slot: z.string(),
      dayLabel: z.string(),
      scheduledTimestamp: z.number(),
      distanceKm: z.number(),
      reasoning: z.string().describe('A 2-3 sentence narrative comparing the top picks. Required.'),
    }),
  }
);

// Schedule Reminder Tool used for confirming bookings
export const scheduleReminder = tool(
  async ({ bookingId, scheduledTimestamp }, config) => {
    const queue = getEventQueue(config);
    
    const at = REMINDER_LEAD_LABEL;
    const atTimestamp = scheduledTimestamp - REMINDER_LEAD_MS;
    
    queue.push({
      type: 'reminder_scheduled',
      at,
    });

    return { at, atTimestamp };
  },
  {
    name: 'scheduleReminder',
    description: 'Schedule a reminder for the confirmed booking.',
    schema: z.object({
      bookingId: z.string(),
      scheduledTimestamp: z.number()
    })
  }
);

// Resolve Booking target tool used for modifying or canceling bookings
export const resolveBookingTarget = tool(
  async ({ userPhrase }, config) => {
    const bookings = getBookings(config);
    if (!bookings || bookings.length === 0) return { bookingId: '', summary: 'No bookings available.' };
    
    const structuredModel = gemini.withStructuredOutput(z.object({
      bookingId: z.string().describe("The ID of the matching booking, or empty string if ambiguous/no match"),
      summary: z.string().describe("A brief summary of the matched booking, or explanation of why it's ambiguous")
    }));

    return await structuredModel.invoke(disambiguationPrompt(userPhrase, bookings));
  },
  {
    name: 'resolveBookingTarget',
    description: 'Disambiguate which booking the user is referring to based on their phrasing. The active bookings list is available implicitly from session context.',
    schema: z.object({
      userPhrase: z.string()
    })
  }
);

// Propose booking change tool used for modifying bookings
export const proposeBookingChange = tool(
  async ({ bookingId, changes, reason }, config) => {
    const queue = getEventQueue(config);
    queue.push({ type: 'booking_update', bookingId, changes, reason });
    return { ok: true };
  },
  {
    name: 'proposeBookingChange',
    description: 'Propose a change to an existing booking (e.g. rescheduling).',
    schema: z.object({
      bookingId: z.string(),
      changes: z.object({
        dayLabel: z.string().optional(),
        slot: z.string().optional(),
        scheduledTimestamp: z.number().optional(),
        status: z.enum(BOOKING_STATUSES as unknown as [string, ...string[]]).optional()
      }).strict(),
      reason: z.string()
    })
  }
);

// Propose booking cancellation tool used for canceling bookings
export const proposeBookingCancellation = tool(
  async ({ bookingId, reason }, config) => {
    const queue = getEventQueue(config);
    queue.push({ type: 'booking_cancel', bookingId, reason });
    return { ok: true };
  },
  {
    name: 'proposeBookingCancellation',
    description: 'Cancel an existing booking.',
    schema: z.object({
      bookingId: z.string(),
      reason: z.string()
    })
  }
);

// Answer booking query tool used for querying bookings
export const answerBookingQuery = tool(
  async ({ bookingId, summary }, config) => {
    const queue = getEventQueue(config);
    queue.push({ type: 'booking_query', bookingId, summary });
    return { ok: true };
  },
  {
    name: 'answerBookingQuery',
    description: 'Answer a user query about an existing booking.',
    schema: z.object({
      bookingId: z.string(),
      summary: z.string()
    })
  }
);
