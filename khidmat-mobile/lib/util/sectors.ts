import { SECTOR_COORDS, DEFAULT_SECTOR } from '../mock/providers';

type Coords = { lat: number; lng: number };

/**
 * Resolve a sector to its center coordinates. Tries an exact match, then any
 * sector sharing the same base (e.g. "F-10/3" → an "F-10" sub-sector), and
 * finally the default sector — so the agent always has a point to rank from.
 */
export function sectorCoords(sector: string): Coords {
  if (SECTOR_COORDS[sector]) return SECTOR_COORDS[sector];

  const base = sector.split('/')[0];
  for (const [name, coords] of Object.entries(SECTOR_COORDS)) {
    if (name.startsWith(base)) return coords;
  }

  return SECTOR_COORDS[DEFAULT_SECTOR];
}
