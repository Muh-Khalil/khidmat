import { IDatabaseRepository } from '../repository';
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
  JobReviewRecord,
  FavoriteRecord,
  JobComplaintRecord,
} from '../types';
import { haversineKm } from '../../lib/geo';
import { SECTOR_COORDS } from '../../data/sectors';
import * as crypto from 'crypto';

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0.85;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class MemoryDatabaseRepository implements IDatabaseRepository {
  private users: Map<string, User> = new Map();
  private providers: Map<string, ProviderRecord> = new Map();
  private jobs: Map<string, JobRecord> = new Map();
  private dues: Map<string, DueRecord> = new Map();
  private auditLogs: Map<string, AuditLogRecord> = new Map();
  private passwordHashes: Map<string, string> = new Map();
  private serviceRequests: Map<string, ServiceRequestRecord> = new Map();
  private requestDispatches: Map<string, RequestDispatchRecord> = new Map();
  private providerResponses: Map<string, ProviderResponseRecord> = new Map();
  private providerSourceReferences: Map<string, ProviderSourceReference> = new Map();
  private providerCustomers: Map<string, ProviderCustomerRecord> = new Map();
  private providerAppointments: Map<string, ProviderAppointmentRecord> = new Map();
  private reviews: Map<string, JobReviewRecord> = new Map();
  private favorites: Set<string> = new Set();
  private complaints: Map<string, JobComplaintRecord> = new Map();

  constructor() {
    this.seedInitialData();
  }

  async getProviderSourceReference(source: ProviderSourceReference['source'], externalId: string): Promise<ProviderSourceReference | null> {
    return this.providerSourceReferences.get(`${source}:${externalId}`) || null;
  }

  async upsertProviderSourceReference(data: Omit<ProviderSourceReference, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProviderSourceReference> {
    const key = `${data.source}:${data.externalId}`;
    const existing = this.providerSourceReferences.get(key);
    const now = new Date();
    const record: ProviderSourceReference = existing
      ? { ...existing, ...data, updatedAt: now }
      : { ...data, id: `source_${crypto.randomUUID().slice(0, 8)}`, createdAt: now, updatedAt: now };
    this.providerSourceReferences.set(key, record);
    return record;
  }

  async activateProviderSourceReferences(providerId: string): Promise<void> {
    for (const [key, record] of this.providerSourceReferences) {
      if (record.providerId === providerId) this.providerSourceReferences.set(key, { ...record, status: 'ACTIVE', updatedAt: new Date() });
    }
  }

  async createProviderCustomer(data: Omit<ProviderCustomerRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProviderCustomerRecord> {
    const duplicate = Array.from(this.providerCustomers.values()).find((item) =>
      item.providerId === data.providerId && ((!!data.phone && item.phone === data.phone) ||
        (!!data.linkedUserId && item.linkedUserId === data.linkedUserId)));
    if (duplicate) return duplicate;
    const now = new Date();
    const record = { ...data, id: `pc_${crypto.randomUUID().slice(0, 8)}`, createdAt: now, updatedAt: now };
    this.providerCustomers.set(record.id, record);
    return record;
  }

  async listProviderCustomers(providerId: string): Promise<ProviderCustomerRecord[]> {
    return Array.from(this.providerCustomers.values()).filter((item) => item.providerId === providerId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getProviderCustomerById(id: string): Promise<ProviderCustomerRecord | null> {
    return this.providerCustomers.get(id) || null;
  }

  async createProviderAppointment(data: Omit<ProviderAppointmentRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProviderAppointmentRecord> {
    const now = new Date();
    const record = { ...data, id: `appt_${crypto.randomUUID().slice(0, 8)}`, createdAt: now, updatedAt: now };
    this.providerAppointments.set(record.id, record);
    return record;
  }

  async listProviderAppointments(providerId: string): Promise<ProviderAppointmentRecord[]> {
    return Array.from(this.providerAppointments.values()).filter((item) => item.providerId === providerId)
      .sort((a, b) => a.scheduledAt - b.scheduledAt);
  }

  async updateProviderAppointmentStatus(id: string, status: ProviderAppointmentRecord['status'], finalAmount?: number): Promise<ProviderAppointmentRecord | null> {
    const appointment = this.providerAppointments.get(id);
    if (!appointment) return null;
    appointment.status = status; appointment.updatedAt = new Date();
    if (finalAmount !== undefined) appointment.finalAmount = finalAmount;
    return appointment;
  }

  private seedInitialData() {
    // Seed Demo Users
    const customer: User = {
      id: 'usr_demo_customer',
      name: 'Ahmed Hassan',
      phone: '+923001234567',
      email: 'ahmed@example.com',
      role: 'customer',
      sector: 'F-7',
      createdAt: new Date(),
    };
    const providerUser: User = {
      id: 'usr_demo_provider',
      name: 'Tariq Mehmood',
      phone: '+923019876543',
      email: 'tariq@khidmat.pk',
      role: 'provider',
      sector: 'G-13',
      createdAt: new Date(),
    };
    this.users.set(customer.id, customer);
    this.users.set(providerUser.id, providerUser);
    const demoPinHash = 'scrypt$khidmat-demo-salt$1b49961e6e8251fd9e56afa328d95637ea26e382d6cbdda0bd1c3fa473027b966c86d07cb030e7eca77dfe0e480cb19788037b7bc9b9eabd35ea3f3140e8e23f';
    this.passwordHashes.set(customer.id, demoPinHash);
    this.passwordHashes.set(providerUser.id, demoPinHash);

    // Seed Providers
    const initialProviders: ProviderRecord[] = [
      {
        id: 'p_hvac_1',
        userId: 'usr_demo_provider',
        name: 'Tariq Mehmood',
        phone: '+92 301 9876543',
        category: 'ac',
        experienceYears: 8,
        rating: 4.9,
        totalJobs: 142,
        hourlyRate: 1800,
        location: SECTOR_COORDS['G-13'] || { lat: 33.6425, lng: 72.9789 },
        sector: 'G-13',
        isOnline: true,
        skillEmbedding: Array(768).fill(0.05),
        availableSlots: ['10:00 AM', '02:00 PM', '05:00 PM'],
      },
      {
        id: 'p_hvac_2',
        name: 'Kamran Aslam',
        phone: '+92 321 4443322',
        category: 'ac',
        experienceYears: 5,
        rating: 4.7,
        totalJobs: 89,
        hourlyRate: 1500,
        location: SECTOR_COORDS['G-11'] || { lat: 33.6789, lng: 73.0125 },
        sector: 'G-11',
        isOnline: true,
        skillEmbedding: Array(768).fill(0.04),
        availableSlots: ['09:00 AM', '12:00 PM', '03:00 PM'],
      },
      {
        id: 'p_hvac_3',
        name: 'Muhammad Bilal',
        phone: '+92 345 1112233',
        category: 'ac',
        experienceYears: 11,
        rating: 4.95,
        totalJobs: 230,
        hourlyRate: 2000,
        location: SECTOR_COORDS['F-10'] || { lat: 33.7123, lng: 73.0456 },
        sector: 'F-10',
        isOnline: true,
        skillEmbedding: Array(768).fill(0.06),
        availableSlots: ['11:00 AM', '01:00 PM', '04:00 PM'],
      },
      {
        id: 'p_plumb_1',
        name: 'Rashid Khan',
        phone: '+92 333 5551234',
        category: 'plumber',
        experienceYears: 7,
        rating: 4.8,
        totalJobs: 115,
        hourlyRate: 1200,
        location: SECTOR_COORDS['G-12'] || { lat: 33.655, lng: 72.9912 },
        sector: 'G-12',
        isOnline: true,
        skillEmbedding: Array(768).fill(0.05),
        availableSlots: ['09:00 AM', '11:30 AM', '02:30 PM', '04:30 PM'],
      },
      {
        id: 'p_plumb_2',
        name: 'Imran Qureshi',
        phone: '+92 312 9988776',
        category: 'plumber',
        experienceYears: 4,
        rating: 4.6,
        totalJobs: 64,
        hourlyRate: 1000,
        location: SECTOR_COORDS['G-13'] || { lat: 33.639, lng: 72.975 },
        sector: 'G-13',
        isOnline: true,
        skillEmbedding: Array(768).fill(0.03),
        availableSlots: ['10:00 AM', '01:00 PM', '04:00 PM'],
      },
      {
        id: 'p_elec_1',
        name: 'Zahid Hussain',
        phone: '+92 300 7766554',
        category: 'electrician',
        experienceYears: 10,
        rating: 4.85,
        totalJobs: 198,
        hourlyRate: 1400,
        location: SECTOR_COORDS['F-11'] || { lat: 33.69, lng: 73.03 },
        sector: 'F-11',
        isOnline: true,
        skillEmbedding: Array(768).fill(0.05),
        availableSlots: ['09:30 AM', '01:30 PM', '03:30 PM', '06:00 PM'],
      },
      {
        id: 'p_elec_2',
        name: 'Arshad Ali',
        phone: '+92 334 2233445',
        category: 'electrician',
        experienceYears: 6,
        rating: 4.7,
        totalJobs: 92,
        hourlyRate: 1200,
        location: SECTOR_COORDS['G-13'] || { lat: 33.645, lng: 72.98 },
        sector: 'G-13',
        isOnline: true,
        skillEmbedding: Array(768).fill(0.04),
        availableSlots: ['10:00 AM', '12:00 PM', '03:00 PM'],
      },
      {
        id: 'p_tutor_1',
        name: 'Sir Farhan',
        phone: '+92 313 5544332',
        category: 'tutor',
        experienceYears: 6,
        rating: 4.9,
        totalJobs: 75,
        hourlyRate: 2500,
        location: SECTOR_COORDS['F-10'] || { lat: 33.705, lng: 73.018 },
        sector: 'F-10',
        isOnline: true,
        skillEmbedding: Array(768).fill(0.05),
        availableSlots: ['03:00 PM', '04:30 PM', '06:00 PM'],
      },
      {
        id: 'p_beauty_1',
        name: 'Ayesha Malik',
        phone: '+92 322 8877665',
        category: 'beautician',
        experienceYears: 7,
        rating: 4.92,
        totalJobs: 134,
        hourlyRate: 3000,
        location: SECTOR_COORDS['F-7'] || { lat: 33.725, lng: 73.055 },
        sector: 'F-7',
        isOnline: true,
        skillEmbedding: Array(768).fill(0.05),
        availableSlots: ['11:00 AM', '02:00 PM', '05:00 PM'],
      },
    ];

    for (const p of initialProviders) {
      this.providers.set(p.id, p);
    }

    // Seed Dues for Tariq Mehmood
    const initialDues: DueRecord[] = [
      {
        id: 'due_demo_1',
        providerId: 'p_hvac_1',
        customerName: 'Ahmed Hassan',
        customerPhone: '+92 300 1234567',
        serviceCategory: 'ac',
        amount: 1500,
        status: 'pending',
        dueDate: '2026-03-20',
        notes: 'Gas refill balance pending',
        createdAt: new Date(),
      },
      {
        id: 'due_demo_2',
        providerId: 'p_hvac_1',
        customerName: 'Kashif Mehmood',
        customerPhone: '+92 321 8765432',
        serviceCategory: 'ac',
        amount: 2000,
        status: 'pending',
        dueDate: '2026-03-18',
        notes: 'Master bed AC PCB repair',
        createdAt: new Date(),
      },
      {
        id: 'due_demo_3',
        providerId: 'p_hvac_1',
        customerName: 'Usman Butt',
        customerPhone: '+92 333 1122334',
        serviceCategory: 'ac',
        amount: 1200,
        status: 'paid',
        dueDate: '2026-03-15',
        paidAt: new Date(),
        notes: 'General servicing',
        createdAt: new Date(),
      },
    ];

    for (const d of initialDues) {
      this.dues.set(d.id, d);
    }
  }

  // Provider operations
  async getProviderById(id: string): Promise<ProviderRecord | null> {
    return this.providers.get(id) || null;
  }

  async getProviderByUserId(userId: string): Promise<ProviderRecord | null> {
    return Array.from(this.providers.values()).find((provider) => provider.userId === userId) || null;
  }

  async listProvidersByCategory(category: string): Promise<ProviderRecord[]> {
    return Array.from(this.providers.values()).filter((p) => p.category === category);
  }

  async updateProviderStatus(id: string, isOnline: boolean): Promise<boolean> {
    const provider = this.providers.get(id);
    if (!provider) return false;
    provider.isOnline = isOnline;
    this.providers.set(id, provider);
    return true;
  }

  async updateProviderLocation(id: string, lat: number, lng: number): Promise<boolean> {
    const provider = this.providers.get(id);
    if (!provider) return false;
    provider.location = { lat, lng };
    this.providers.set(id, provider);
    return true;
  }

  async upsertProviderProfile(data: ProviderRecord): Promise<ProviderRecord> {
    this.providers.set(data.id, data);
    return data;
  }

  // Spatial-Vector matching (simulates PostGIS ST_DWithin + pgvector cosine similarity)
  async searchAndRankProviders(params: SpatialVectorSearchParams): Promise<RankedCandidate[]> {
    const { category, userCoords, queryEmbedding, radiusMeters = 15000, limit = 5 } = params;
    const radiusKm = radiusMeters / 1000.0;

    const candidates = Array.from(this.providers.values()).filter(
      (p) => p.isOnline && p.category === category
    );

    const ranked: RankedCandidate[] = [];

    for (const provider of candidates) {
      const distanceKm = haversineKm(userCoords, provider.location);
      if (distanceKm > radiusKm) continue;

      const skillSimilarity = queryEmbedding && provider.skillEmbedding
        ? cosineSimilarity(queryEmbedding, provider.skillEmbedding)
        : 0.9;

      // Composite scoring formula: 40% distance proximity, 40% skill similarity, 20% rating
      const distanceScore = Math.max(0, 1 - distanceKm / radiusKm);
      const ratingScore = provider.rating / 5.0;
      const compositeScore = 0.4 * distanceScore + 0.4 * skillSimilarity + 0.2 * ratingScore;

      ranked.push({
        provider,
        distanceKm: parseFloat(distanceKm.toFixed(1)),
        skillSimilarity: parseFloat(skillSimilarity.toFixed(2)),
        compositeScore: parseFloat(compositeScore.toFixed(3)),
      });
    }

    ranked.sort((a, b) => b.compositeScore - a.compositeScore);
    return ranked.slice(0, limit);
  }

  // Jobs
  async createJob(jobData: Omit<JobRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<JobRecord> {
    const id = `job_${crypto.randomUUID().slice(0, 8)}`;
    const job: JobRecord = {
      ...jobData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.jobs.set(id, job);
    return job;
  }

  async getJobById(id: string): Promise<JobRecord | null> {
    return this.jobs.get(id) || null;
  }

  async listJobsByCustomer(customerId: string): Promise<JobRecord[]> {
    return Array.from(this.jobs.values())
      .filter((j) => j.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listPendingJobsForProvider(providerId: string): Promise<JobRecord[]> {
    return Array.from(this.jobs.values()).filter(
      (j) => j.providerId === providerId && (j.status === 'dispatched' || j.status === 'matched')
    );
  }

  async listActiveJobsForProvider(providerId: string): Promise<JobRecord[]> {
    return Array.from(this.jobs.values()).filter(
      (j) => j.providerId === providerId && (j.status === 'accepted' || j.status === 'in_progress')
    );
  }

  async updateJobStatus(
    id: string,
    status: JobRecord['status'],
    details?: { finalFare?: number; explainabilityRationale?: string }
  ): Promise<JobRecord | null> {
    const job = this.jobs.get(id);
    if (!job) return null;
    job.status = status;
    job.updatedAt = new Date();
    if (details?.finalFare !== undefined) job.finalFare = details.finalFare;
    if (details?.explainabilityRationale !== undefined) {
      job.explainabilityRationale = details.explainabilityRationale;
    }
    this.jobs.set(id, job);
    return job;
  }

  // Dues
  async createDue(dueData: Omit<DueRecord, 'id' | 'createdAt'>): Promise<DueRecord> {
    const id = `due_${crypto.randomUUID().slice(0, 8)}`;
    const due: DueRecord = {
      ...dueData,
      id,
      createdAt: new Date(),
    };
    this.dues.set(id, due);
    return due;
  }

  async listDuesByProvider(providerId: string): Promise<{ dues: DueRecord[]; totalPendingAmount: number }> {
    const list = Array.from(this.dues.values())
      .filter((d) => d.providerId === providerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const totalPendingAmount = list
      .filter((d) => d.status === 'pending')
      .reduce((sum, d) => sum + d.amount, 0);

    return { dues: list, totalPendingAmount };
  }

  async markDueAsPaid(id: string): Promise<DueRecord | null> {
    const due = this.dues.get(id);
    if (!due) return null;
    due.status = 'paid';
    due.paidAt = new Date();
    this.dues.set(id, due);
    return due;
  }

  async deleteDue(id: string): Promise<boolean> {
    return this.dues.delete(id);
  }

  // Audit Logs
  async createAuditLog(logData: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<AuditLogRecord> {
    const id = `audit_${crypto.randomUUID().slice(0, 8)}`;
    const log: AuditLogRecord = {
      ...logData,
      id,
      createdAt: new Date(),
    };
    this.auditLogs.set(id, log);
    return log;
  }

  async listAuditLogsForJob(jobId: string): Promise<AuditLogRecord[]> {
    return Array.from(this.auditLogs.values()).filter((l) => l.jobId === jobId);
  }

  // Users
  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByPhone(phone: string): Promise<User | null> {
    return Array.from(this.users.values()).find((u) => u.phone === phone) || null;
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
    const user: User = {
      ...userData,
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserProfile(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getPasswordHash(userId: string): Promise<string | null> {
    return this.passwordHashes.get(userId) || null;
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    this.passwordHashes.set(userId, passwordHash);
  }

  async createServiceRequest(data: Omit<ServiceRequestRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceRequestRecord> {
    const now = new Date();
    const record = { ...data, id: `req_${crypto.randomUUID().slice(0, 8)}`, createdAt: now, updatedAt: now };
    this.serviceRequests.set(record.id, record);
    return record;
  }

  async getServiceRequestById(id: string): Promise<ServiceRequestRecord | null> {
    return this.serviceRequests.get(id) || null;
  }

  async listServiceRequestsByCustomer(customerId: string): Promise<ServiceRequestRecord[]> {
    return Array.from(this.serviceRequests.values())
      .filter((request) => request.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateServiceRequestStatus(id: string, status: ServiceRequestRecord['status']): Promise<ServiceRequestRecord | null> {
    const request = this.serviceRequests.get(id);
    if (!request) return null;
    request.status = status;
    request.updatedAt = new Date();
    this.serviceRequests.set(id, request);
    return request;
  }

  async createRequestDispatch(data: Omit<RequestDispatchRecord, 'id' | 'sentAt'>): Promise<RequestDispatchRecord> {
    const duplicate = Array.from(this.requestDispatches.values()).find(
      (dispatch) => dispatch.requestId === data.requestId && dispatch.providerId === data.providerId,
    );
    if (duplicate) return duplicate;
    const record = { ...data, id: `dispatch_${crypto.randomUUID().slice(0, 8)}`, sentAt: new Date() };
    this.requestDispatches.set(record.id, record);
    return record;
  }

  async listDispatchesForRequest(requestId: string): Promise<RequestDispatchRecord[]> {
    return Array.from(this.requestDispatches.values()).filter((dispatch) => dispatch.requestId === requestId);
  }

  async listPendingDispatchesForProvider(providerId: string): Promise<RequestDispatchRecord[]> {
    return Array.from(this.requestDispatches.values())
      .filter((dispatch) => dispatch.providerId === providerId && dispatch.status === 'pending')
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }

  async getDispatchById(id: string): Promise<RequestDispatchRecord | null> {
    return this.requestDispatches.get(id) || null;
  }

  async createProviderResponse(data: Omit<ProviderResponseRecord, 'id' | 'createdAt'>): Promise<ProviderResponseRecord> {
    const existing = Array.from(this.providerResponses.values()).find((response) => response.dispatchId === data.dispatchId);
    if (existing) throw new Error('DISPATCH_ALREADY_RESPONDED');
    const record = { ...data, id: `response_${crypto.randomUUID().slice(0, 8)}`, createdAt: new Date() };
    this.providerResponses.set(record.id, record);
    const dispatch = this.requestDispatches.get(data.dispatchId);
    if (dispatch) {
      dispatch.status = data.available ? 'responded' : 'declined';
      dispatch.respondedAt = new Date();
    }
    if (data.available) await this.updateServiceRequestStatus(data.requestId, 'ready_to_choose');
    return record;
  }

  async listResponsesForRequest(requestId: string): Promise<ProviderResponseRecord[]> {
    return Array.from(this.providerResponses.values())
      .filter((response) => response.requestId === requestId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async acceptResponseAndCreateJob(responseId: string, customerId: string): Promise<JobRecord | null> {
    const response = this.providerResponses.get(responseId);
    if (!response?.available) return null;
    const request = this.serviceRequests.get(response.requestId);
    if (!request || request.customerId !== customerId || request.status === 'booked') return null;
    request.status = 'booked';
    request.acceptedResponseId = response.id;
    request.updatedAt = new Date();
    response.acceptedAt = new Date();
    for (const dispatch of this.requestDispatches.values()) {
      if (dispatch.requestId === request.id && dispatch.providerId !== response.providerId && dispatch.status === 'pending') {
        dispatch.status = 'withdrawn';
      }
    }
    const provider = this.providers.get(response.providerId);
    const job = await this.createJob({
      customerId: request.customerId,
      customerName: request.customerName,
      customerPhone: request.customerPhone,
      providerId: response.providerId,
      providerName: provider?.name,
      category: request.category,
      status: 'accepted',
      issueDescription: request.issueDescription,
      urgency: request.urgency,
      location: request.location,
      sector: request.sector,
      scheduledFor: response.proposedTimeLabel || request.requestedTimeLabel,
      scheduledTimestamp: response.proposedStartAt || request.requestedStartAt,
      estimatedFare: response.amount || provider?.hourlyRate || 1500,
      explainabilityRationale: 'Customer selected this provider response',
    });
    const crmCustomer = await this.createProviderCustomer({ providerId: response.providerId,
      linkedUserId: request.customerId, name: request.customerName || 'Customer', phone: request.customerPhone,
      sector: request.sector });
    await this.createProviderAppointment({ providerId: response.providerId, providerCustomerId: crmCustomer.id,
      marketplaceJobId: job.id, category: request.category, description: request.issueDescription,
      scheduledAt: job.scheduledTimestamp, scheduledLabel: job.scheduledFor, status: 'scheduled',
      quotedAmount: response.amount });
    return job;
  }

  // Phase 4: Reviews, Favorites, Complaints
  async createJobReview(review: Omit<JobReviewRecord, 'id' | 'createdAt'>): Promise<JobReviewRecord> {
    const record: JobReviewRecord = {
      ...review,
      id: `rev_${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date(),
    };
    this.reviews.set(record.id, record);

    // Update provider's overall rating and totalJobs
    const provider = this.providers.get(review.providerId);
    if (provider) {
      const providerReviews = Array.from(this.reviews.values()).filter((r) => r.providerId === review.providerId);
      const totalScore = providerReviews.reduce((sum, r) => sum + r.rating, 0);
      provider.rating = Number((totalScore / providerReviews.length).toFixed(1));
      this.providers.set(provider.id, provider);
    }

    return record;
  }

  async listReviewsForProvider(providerId: string): Promise<JobReviewRecord[]> {
    return Array.from(this.reviews.values())
      .filter((r) => r.providerId === providerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getReviewByJobId(jobId: string): Promise<JobReviewRecord | null> {
    return Array.from(this.reviews.values()).find((r) => r.jobId === jobId) || null;
  }

  async toggleFavoriteProvider(customerId: string, providerId: string): Promise<boolean> {
    const key = `${customerId}:${providerId}`;
    if (this.favorites.has(key)) {
      this.favorites.delete(key);
      return false; // Removed
    } else {
      this.favorites.add(key);
      return true; // Added
    }
  }

  async listFavoritesByCustomer(customerId: string): Promise<string[]> {
    const prefix = `${customerId}:`;
    const result: string[] = [];
    for (const key of this.favorites) {
      if (key.startsWith(prefix)) {
        result.push(key.slice(prefix.length));
      }
    }
    return result;
  }

  async createJobComplaint(
    complaint: Omit<JobComplaintRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ): Promise<JobComplaintRecord> {
    const record: JobComplaintRecord = {
      ...complaint,
      id: `comp_${crypto.randomUUID().slice(0, 8)}`,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.complaints.set(record.id, record);
    return record;
  }

  async listComplaintsByCustomer(customerId: string): Promise<JobComplaintRecord[]> {
    return Array.from(this.complaints.values())
      .filter((c) => c.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
