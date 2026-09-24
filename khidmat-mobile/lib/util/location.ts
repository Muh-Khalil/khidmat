/**
 * Label a sector for display, annotating it as the user's saved default when
 * the agent fell back to it (rather than the user naming a sector explicitly).
 * Passes null through so callers can render their own "unknown" placeholder.
 */
export function formatLocationLabel(
  location: string | null,
  usedDefault: boolean,
): string | null {
  if (!location) return location;
  return usedDefault ? `${location} (your home)` : location;
}
