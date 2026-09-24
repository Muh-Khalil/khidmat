/**
 * Pick the singular or plural form of a noun for a count. Defaults the plural
 * to the singular + "s"; pass an explicit plural for irregular nouns.
 */
export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return count === 1 ? singular : plural;
}
