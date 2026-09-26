import { z } from 'zod';
import { ServiceCategoryEnum } from './common';

export const SignupRequestSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email().optional(),
  role: z.enum(['customer', 'provider']),
  sector: z.string().optional(),
});

export const LoginRequestSchema = z.object({
  phone: z.string().min(10, 'Valid phone number is required'),
  password: z.string().optional(),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional(),
  sector: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export const ProviderStatusSchema = z.object({
  isOnline: z.boolean(),
});

export const ProviderLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const CreateDueSchema = z.object({
  providerId: z.string(),
  customerId: z.string().optional(),
  customerName: z.string().min(2),
  customerPhone: z.string().optional(),
  serviceCategory: ServiceCategoryEnum,
  jobId: z.string().optional(),
  amount: z.number().positive(),
  dueDate: z.string(),
  notes: z.string().optional(),
});

export const CreateJobSchema = z.object({
  customerId: z.string(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  providerId: z.string().optional(),
  providerName: z.string().optional(),
  category: ServiceCategoryEnum,
  status: z
    .enum(['requested', 'matched', 'dispatched', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled'])
    .default('requested'),
  issueDescription: z.string().min(3),
  urgency: z.enum(['low', 'medium', 'urgent']).default('medium'),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  sector: z.string(),
  scheduledFor: z.string(),
  scheduledTimestamp: z.number(),
  estimatedFare: z.number().positive().default(1500),
  explainabilityRationale: z.string().optional(),
});

export const UpdateJobStatusSchema = z.object({
  status: z.enum(['accepted', 'declined', 'in_progress', 'completed', 'cancelled']),
  finalFare: z.number().positive().optional(),
  explainabilityRationale: z.string().optional(),
});
