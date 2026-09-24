import type { AgentEvent } from './types';

/**
 * Find the first event of a given type, narrowed to that variant of the
 * AgentEvent union — so callers get e.g. a `confirmed` event with its
 * `bookingId` typed, without hand-writing the type-guard predicate.
 */
export function findEventOfType<T extends AgentEvent['type']>(
  events: AgentEvent[],
  type: T,
): Extract<AgentEvent, { type: T }> | undefined {
  return events.find(
    (e): e is Extract<AgentEvent, { type: T }> => e.type === type,
  );
}
