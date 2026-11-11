import {
  User,
  ProviderRecord,
  JobRecord,
  DueRecord,
  AuditLogRecord,
  SpatialVectorSearchParams,
  RankedCandidate,
  ServiceRequestRecord,
  RequestDispatchRecord,
  ProviderResponseRecord,
  ProviderSourceReference,
  ProviderCustomerRecord,
  ProviderAppointmentRecord,
} from './types';

export interface IDatabaseRepository {
  // Provider operations
  getProviderById(id: string): Promise<ProviderRecord | null>;
  getProviderByUserId(userId: string): Promise<ProviderRecord | null>;
  listProvidersByCategory(category: string): Promise<ProviderRecord[]>;
  updateProviderStatus(id: string, isOnline: boolean): Promise<boolean>;
  updateProviderLocation(id: string, lat: number, lng: number): Promise<boolean>;
  upsertProviderProfile(data: ProviderRecord): Promise<ProviderRecord>;
  getProviderSourceReference(source: ProviderSourceReference['source'], externalId: string): Promise<ProviderSourceReference | null>;
  upsertProviderSourceReference(data: Omit<ProviderSourceReference, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProviderSourceReference>;
  activateProviderSourceReferences(providerId: string): Promise<void>;

  // Provider mini-CRM (provider-owned offline and marketplace relationships)
  createProviderCustomer(data: Omit<ProviderCustomerRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProviderCustomerRecord>;
  listProviderCustomers(providerId: string): Promise<ProviderCustomerRecord[]>;
  getProviderCustomerById(id: string): Promise<ProviderCustomerRecord | null>;
  createProviderAppointment(data: Omit<ProviderAppointmentRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProviderAppointmentRecord>;
  listProviderAppointments(providerId: string): Promise<ProviderAppointmentRecord[]>;
  updateProviderAppointmentStatus(id: string, status: ProviderAppointmentRecord['status'], finalAmount?: number): Promise<ProviderAppointmentRecord | null>;

  // Spatial-Vector matching
  searchAndRankProviders(params: SpatialVectorSearchParams): Promise<RankedCandidate[]>;

  // Jobs / Bookings
  createJob(job: Omit<JobRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<JobRecord>;
  getJobById(id: string): Promise<JobRecord | null>;
  listJobsByCustomer(customerId: string): Promise<JobRecord[]>;
  listPendingJobsForProvider(providerId: string): Promise<JobRecord[]>;
  listActiveJobsForProvider(providerId: string): Promise<JobRecord[]>;
  updateJobStatus(
    id: string,
    status: JobRecord['status'],
    details?: { finalFare?: number; explainabilityRationale?: string }
  ): Promise<JobRecord | null>;

  // Customer Dues & Micro-ERP Ledger
  createDue(due: Omit<DueRecord, 'id' | 'createdAt'>): Promise<DueRecord>;
  listDuesByProvider(providerId: string): Promise<{ dues: DueRecord[]; totalPendingAmount: number }>;
  markDueAsPaid(id: string): Promise<DueRecord | null>;
  deleteDue(id: string): Promise<boolean>;

  // Audit Logs & Explainability
  createAuditLog(log: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<AuditLogRecord>;
  listAuditLogsForJob(jobId: string): Promise<AuditLogRecord[]>;

  // Users / Auth
  getUserById(id: string): Promise<User | null>;
  getUserByPhone(phone: string): Promise<User | null>;
  createUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User>;
  updateUserProfile(id: string, updates: Partial<User>): Promise<User | null>;
  getPasswordHash(userId: string): Promise<string | null>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;

  // Marketplace fulfillment
  createServiceRequest(data: Omit<ServiceRequestRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceRequestRecord>;
  getServiceRequestById(id: string): Promise<ServiceRequestRecord | null>;
  listServiceRequestsByCustomer(customerId: string): Promise<ServiceRequestRecord[]>;
  updateServiceRequestStatus(id: string, status: ServiceRequestRecord['status']): Promise<ServiceRequestRecord | null>;
  createRequestDispatch(data: Omit<RequestDispatchRecord, 'id' | 'sentAt'>): Promise<RequestDispatchRecord>;
  listDispatchesForRequest(requestId: string): Promise<RequestDispatchRecord[]>;
  listPendingDispatchesForProvider(providerId: string): Promise<RequestDispatchRecord[]>;
  getDispatchById(id: string): Promise<RequestDispatchRecord | null>;
  createProviderResponse(data: Omit<ProviderResponseRecord, 'id' | 'createdAt'>): Promise<ProviderResponseRecord>;
  listResponsesForRequest(requestId: string): Promise<ProviderResponseRecord[]>;
  acceptResponseAndCreateJob(responseId: string, customerId: string): Promise<JobRecord | null>;

  // Phase 4: Trust, Reviews, Favorites & Complaints
  createJobReview(review: Omit<import('./types').JobReviewRecord, 'id' | 'createdAt'>): Promise<import('./types').JobReviewRecord>;
  listReviewsForProvider(providerId: string): Promise<import('./types').JobReviewRecord[]>;
  getReviewByJobId(jobId: string): Promise<import('./types').JobReviewRecord | null>;
  toggleFavoriteProvider(customerId: string, providerId: string): Promise<boolean>;
  listFavoritesByCustomer(customerId: string): Promise<string[]>;
  createJobComplaint(complaint: Omit<import('./types').JobComplaintRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<import('./types').JobComplaintRecord>;
  listComplaintsByCustomer(customerId: string): Promise<import('./types').JobComplaintRecord[]>;

  // Lifecycle
  initialize?(): Promise<void>;
  close?(): Promise<void>;
}
