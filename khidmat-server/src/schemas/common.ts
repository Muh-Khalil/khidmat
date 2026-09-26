import { z } from 'zod';
import { SERVICE_CATEGORIES } from '../data/providers';

/**
 * Zod enum over the service categories. Centralizes the readonly-tuple cast
 * that Zod requires (`z.enum` wants a mutable `[string, ...string[]]`) so the
 * assertion isn't repeated at every validation site.
 */
export const ServiceCategoryEnum = z.enum(SERVICE_CATEGORIES);
export type ServiceCategoryType = z.infer<typeof ServiceCategoryEnum>;
