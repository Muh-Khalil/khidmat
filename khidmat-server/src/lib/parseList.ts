/**
 * Parse a comma-separated env value into a trimmed, non-empty string list, or
 * undefined when unset/blank. Kept separate from config/env so it can be unit
 * tested without triggering env's fail-fast validation on import.
 */
export function parseList(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}
