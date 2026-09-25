/** Shared, dependency-free constants. Names the magic numbers used across the agent. */

/** Mean radius of the Earth in kilometres, used by the haversine distance calc. */
export const EARTH_RADIUS_KM = 6371;

/**
 * Sampling temperature for the agent model. Kept at 0 for deterministic tool
 * routing and structured-output extraction — the flow depends on stable choices.
 */
export const AGENT_TEMPERATURE = 0;

/** How far ahead of a booking a reminder fires (1 hour, in milliseconds). */
export const REMINDER_LEAD_MS = 60 * 60 * 1000;

/**
 * Human-readable reminder lead ("1 hour before"), derived from REMINDER_LEAD_MS
 * so the label and the timestamp offset can never disagree.
 */
export const REMINDER_LEAD_LABEL = (() => {
  const hours = REMINDER_LEAD_MS / (60 * 60 * 1000);
  const unit = hours === 1 ? 'hour' : 'hours';
  return `${hours} ${unit} before`;
})();

/** Idle lifetime of an in-memory session before it is evicted (1 hour). */
export const SESSION_TTL_MS = 60 * 60 * 1000;

/** How often the session sweeper runs to evict stale sessions (15 minutes). */
export const SESSION_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
