import { ServiceCategory } from '../data/providers';

export type UserRole = 'customer' | 'provider';

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  sector?: string;
  avatarUrl?: string;
  phoneVerifiedAt?: Date;
  createdAt: Date;
}

export interface ProviderLocation {
  lat: number;
  lng: number;
}

export interface ProviderRecord {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  category: ServiceCategory;
  experienceYears: number;
  rating: number;
  totalJobs: number;
  hourlyRate: number;
  serviceRadiusKm?: number;
  location: ProviderLocation;
  sector: string;
  isOnline: boolean;
  skillEmbedding?: number[];
  availableSlots: string[];
}

export type ProviderLifecycleStatus = 'EXTERNAL' | 'CLAIMED' | 'VERIFIED' | 'ACTIVE';

/** Only the license-safe source identifier is stored before a profile is claimed. */
export interface ProviderSourceReference {
  id: string;
  source: 'google_places';
  externalId: string;
  providerId?: string;
  claimedByUserId?: string;
  status: ProviderLifecycleStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderCustomerRecord {
  id: string;
  providerId: string;
  linkedUserId?: string;
  name: string;
  phone?: string;
  sector?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProviderAppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface ProviderAppointmentRecord {
  id: string;
  providerId: string;
  providerCustomerId: string;
  marketplaceJobId?: string;
  category: ServiceCategory;
  description: string;
  scheduledAt: number;
  scheduledLabel: string;
  status: ProviderAppointmentStatus;
  quotedAmount?: number;
  finalAmount?: number;
  reminderAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type JobStatus =
  | 'requested'
  | 'matched'
  | 'dispatched'
  | 'accepted'
  | 'on_the_way'
  | 'declined'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type JobUrgency = 'low' | 'medium' | 'urgent';

export interface JobReviewRecord {
  id: string;
  jobId: string;
  customerId: string;
  providerId: string;
  rating: number; // 1-5
  presetTags: string[];
  comment?: string;
  createdAt: Date;
}

export interface FavoriteRecord {
  id: string;
  customerId: string;
  providerId: string;
  createdAt: Date;
}

export type ComplaintStatus = 'open' | 'investigating' | 'resolved';

export interface JobComplaintRecord {
  id: string;
  jobId: string;
  customerId: string;
  providerId: string;
  category: string;
  reason: string;
  details?: string;
  status: ComplaintStatus;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobRecord {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  providerId?: string;
  providerName?: string;
  category: ServiceCategory;
  status: JobStatus;
  issueDescription: string;
  urgency: JobUrgency;
  location: ProviderLocation;
  sector: string;
  scheduledFor: string;
  scheduledTimestamp: number;
  estimatedFare: number;
  finalFare?: number;
  explainabilityRationale?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DueStatus = 'pending' | 'paid';

export interface DueRecord {
  id: string;
  providerId: string;
  customerId?: string;
  providerCustomerId?: string;
  customerName: string;
  customerPhone?: string;
  serviceCategory: ServiceCategory;
  jobId?: string;
  amount: number;
  status: DueStatus;
  dueDate: string;
  paidAt?: Date;
  notes?: string;
  createdAt: Date;
}

export interface AuditLogRecord {
  id: string;
  jobId?: string;
  sessionId?: string;
  eventType: string;
  intentData?: Record<string, unknown>;
  matchedCandidates?: Array<{
    providerId: string;
    distanceKm: number;
    skillSimilarity: number;
    compositeScore: number;
  }>;
  chosenProviderId?: string;
  rationale?: string;
  latencyMs?: number;
  createdAt: Date;
}

export interface SpatialVectorSearchParams {
  category: ServiceCategory;
  userCoords: ProviderLocation;
  queryEmbedding?: number[];
  radiusMeters?: number;
  limit?: number;
}

export interface RankedCandidate {
  provider: ProviderRecord;
  distanceKm: number;
  skillSimilarity: number;
  compositeScore: number;
}

export type ServiceRequestStatus =
  | 'collecting_responses'
  | 'ready_to_choose'
  | 'booked'
  | 'cancelled'
  | 'expired';

export interface ServiceRequestRecord {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  category: ServiceCategory;
  issueDescription: string;
  urgency: JobUrgency;
  location: ProviderLocation;
  sector: string;
  requestedStartAt: number;
  requestedTimeLabel: string;
  status: ServiceRequestStatus;
  responseDeadlineAt: Date;
  acceptedResponseId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DispatchStatus = 'pending' | 'responded' | 'declined' | 'expired' | 'withdrawn';

export interface RequestDispatchRecord {
  id: string;
  requestId: string;
  providerId: string;
  wave: number;
  rank: number;
  compositeScore: number;
  distanceKm: number;
  rationale: string;
  status: DispatchStatus;
  sentAt: Date;
  respondedAt?: Date;
}

export type PriceType = 'visit_fee' | 'estimate' | 'fixed_quote';

export interface ProviderResponseRecord {
  id: string;
  requestId: string;
  dispatchId: string;
  providerId: string;
  available: boolean;
  proposedStartAt?: number;
  proposedTimeLabel?: string;
  amount?: number;
  priceType?: PriceType;
  message?: string;
  validUntil?: Date;
  acceptedAt?: Date;
  createdAt: Date;
}
