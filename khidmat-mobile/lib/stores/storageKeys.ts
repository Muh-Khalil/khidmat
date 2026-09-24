/**
 * AsyncStorage keys for persisted Zustand stores. Centralized so the names are
 * declared once and can't silently diverge from what's already on disk.
 */
export const STORAGE_KEYS = {
  bookings: 'khidmat-bookings',
  settings: 'khidmat-settings',
  auth: 'khidmat-auth',
  dues: 'khidmat-dues',
} as const;
