/**
 * Generate a short, collision-resistant client-side id with a readable prefix,
 * e.g. makeId('agent') -> "agent_1720000000000_k3f9". The timestamp keeps ids
 * roughly ordered; the random suffix avoids collisions within the same
 * millisecond (multiple agent events can be emitted back-to-back).
 */
export function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${Date.now()}_${rand}`;
}
