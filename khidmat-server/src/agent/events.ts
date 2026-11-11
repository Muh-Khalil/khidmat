import type { Provider, ServiceCategory } from '../data/providers';

/**
 * Wire contract between server and mobile.
 * MUST stay in lockstep with `mobile/lib/agent/types.ts`.
 *
 * The first eight events mirror the FE's existing event vocabulary (new-booking flow).
 * The last three are intents the agent emits to mutate bookings the FE already holds
 * in AsyncStorage — the FE is the source of truth, the server never persists them.
 */

export type ExtractedIntent = {
  service: ServiceCategory | null;
  location: string | null; // sector like 'G-13' or null
  time: string | null; // human-readable: 'tomorrow morning' or null
  resolvedSlot: string | null; // concrete: '10:00 AM' after resolution
};

export type AgentEvent =
  // ── Agent reasoning (interleaved across flow) ────────────────────
  | { type: 'thought'; text: string }

  // ── New-booking flow ─────────────────────────────────────────────
  | {
      type: 'understanding';
      extracted: ExtractedIntent;
      usedDefaultLocation: boolean;
    }
  | { type: 'searching'; near: string; category: ServiceCategory }
  | { type: 'ranking'; candidateCount: number }
  | {
      type: 'recommendation';
      provider: Provider;
      distanceKm: number;
      reasoning: string;
      suggestedSlot: string;
      dayLabel: string; // 'Today' | 'Tomorrow' | 'Monday' | ...
      scheduledTimestamp: number;
    }
  | {
      type: 'awaiting_user';
      question: string;
      missing: 'location' | 'time' | 'service';
    }
  | { type: 'booking'; provider: Provider; slot: string }
  | { type: 'confirmed'; bookingId: string }
  | { type: 'reminder_scheduled'; at: string }

  // ── Modify / cancel / query existing booking ─────────────────────
  | {
      type: 'booking_update';
      bookingId: string;
      changes: Record<string, unknown>; // narrowed once Booking shape is locked
      reason: string;
    }
  | {
      type: 'booking_cancel';
      bookingId: string;
      reason: string;
    }
  | {
      type: 'booking_query';
      bookingId: string;
      summary: string;
    };
