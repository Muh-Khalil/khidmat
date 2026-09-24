/**
 * Named colors for the JS-side color props that Tailwind classes can't reach
 * (Ionicons `color`, navigator `tabBarStyle`, etc.). Values mirror the brand
 * scale in tailwind.config.js and the default Tailwind grays used across the
 * UI, so the raw hex strings live in one place instead of being copy-pasted.
 */
export const colors = {
  primary: '#F97316', // primary.DEFAULT / 500
  primaryActive: '#EA580C', // primary.600
  white: '#FFFFFF',
  gray100: '#F3F4F6',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  red600: '#DC2626',
  // Extracted-field chip icon colors (the -800 shades of each accent).
  primary800: '#9A3412',
  blue800: '#1E40AF',
  purple800: '#6B21A8',
} as const;
