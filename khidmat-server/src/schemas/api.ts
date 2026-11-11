import { z } from 'zod';
import { ServiceCategoryEnum } from './common';

export const SignupRequestSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(4, 'PIN must be at least 4 digits').max(64),
  role: z.enum(['customer', 'provider']),
  sector: z.string().optional(),
  phoneVerificationToken: z.string().min(20),
});

export const RequestPhoneVerificationSchema = z.object({
  phone: z.string().min(10, 'Valid phone number is required'),
});

export const CheckPhoneVerificationSchema = RequestPhoneVerificationSchema.extend({
  code: z.string().regex(/^\d{4,8}$/, 'Enter the code sent to your phone'),
});

export const LoginRequestSchema = z.object({
  phone: z.string().min(10, 'Valid phone number is required'),
  password: z.string().min(4, 'PIN must be at least 4 digits').max(64),
  role: z.enum(['customer', 'provider']).optional(),
});

export const ResetPasswordSchema = z.object({
  phone: z.string().min(10, 'Valid phone number is required'),
  newPassword: z.string().min(4, 'PIN must be at least 4 digits').max(64),
  phoneVerificationToken: z.string().min(20, 'Phone verification token is required'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(4, 'Current PIN is required'),
  newPassword: z.string().min(4, 'New PIN must be at least 4 digits').max(64),
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

export const OnboardProviderSchema = z.object({
  userId: z.string(),
  name: z.string().optional(),
  phone: z.string().optional(),
  category: ServiceCategoryEnum,
  experienceYears: z.number().int().min(1).max(50).default(3),
  hourlyRate: z.number().int().min(300).max(20000).default(1200),
  coverageRadiusKm: z.number().int().min(1).max(100).default(10),
  availableSlots: z.array(z.string()).default(['09:00 AM', '11:00 AM', '02:00 PM', '04:00 PM']),
  sector: z.string().default('G-11'),
  coords: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

export const CreateDueSchema = z.object({
  providerId: z.string().optional(),
  customerId: z.string().optional(),
  providerCustomerId: z.string().optional(),
  customerName: z.string().min(2),
  customerPhone: z.string().optional(),
  serviceCategory: ServiceCategoryEnum,
  jobId: z.string().optional(),
  amount: z.number().positive(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

export const CreateJobSchema = z.object({
  customerId: z.string(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  providerId: z.string().optional(),
  providerName: z.string().optional(),
  category: ServiceCategoryEnum,
  issueDescription: z.string().min(3),
  urgency: z.enum(['low', 'medium', 'urgent']).default('medium'),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  sector: z.string(),
  scheduledFor: z.string().default('Today, ASAP'),
  scheduledTimestamp: z.number().default(() => Date.now()),
  estimatedFare: z.number().positive().default(1500),
  explainabilityRationale: z.string().optional(),
});

export const UpdateJobStatusSchema = z.object({
  status: z.enum(['accepted', 'on_the_way', 'declined', 'in_progress', 'completed', 'cancelled']),
  finalFare: z.number().positive().optional(),
  explainabilityRationale: z.string().optional(),
});

export const CreateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  presetTags: z.array(z.string()).default([]),
  comment: z.string().max(500).optional(),
});

export const CreateComplaintSchema = z.object({
  category: z.string().default('service_quality'),
  reason: z.string().min(3),
  details: z.string().max(1000).optional(),
});

export const CreateServiceRequestSchema = z.object({
  category: ServiceCategoryEnum,
  issueDescription: z.string().trim().min(3).max(1000),
  urgency: z.enum(['low', 'medium', 'urgent']).default('medium'),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  sector: z.string().trim().min(2).max(100),
  requestedStartAt: z.number().int().positive(),
  requestedTimeLabel: z.string().trim().min(2).max(128),
});

export const RespondToLeadSchema = z.object({
  available: z.boolean(),
  proposedStartAt: z.number().int().positive().optional(),
  proposedTimeLabel: z.string().trim().min(2).max(128).optional(),
  amount: z.number().int().positive().max(1_000_000).optional(),
  priceType: z.enum(['visit_fee', 'estimate', 'fixed_quote']).optional(),
  message: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (!value.available) return;
  if (!value.proposedStartAt || !value.proposedTimeLabel) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Available providers must propose a time' });
  }
  if ((value.amount === undefined) !== (value.priceType === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Price and price type must be provided together' });
  }
});

export const DiscoverExternalProvidersSchema = z.object({
  category: ServiceCategoryEnum,
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(500).max(50_000).default(15_000),
});

export const StartProviderClaimSchema = z.object({
  source: z.literal('google_places'),
  externalId: z.string().min(3).max(512),
  category: ServiceCategoryEnum,
});

export const CompleteProviderClaimSchema = z.object({
  claimToken: z.string().min(20),
  code: z.string().regex(/^\d{4,8}$/),
});

export const CreateProviderCustomerSchema = z.object({
  name: z.string().trim().min(2).max(128),
  phone: z.string().trim().min(7).max(32).optional(),
  sector: z.string().trim().max(64).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const CreateProviderAppointmentSchema = z.object({
  providerCustomerId: z.string().min(3),
  category: ServiceCategoryEnum,
  description: z.string().trim().min(3).max(1000),
  scheduledAt: z.number().int().positive(),
  scheduledLabel: z.string().trim().min(2).max(128),
  quotedAmount: z.number().int().positive().max(1_000_000).optional(),
  reminderAt: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
  dueAmount: z.number().int().positive().max(1_000_000).optional(),
});

export const UpdateProviderAppointmentSchema = z.object({
  status: z.enum(['completed', 'cancelled']),
  finalAmount: z.number().int().positive().max(1_000_000).optional(),
});
