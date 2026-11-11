import { Pool } from 'pg';
import { IDatabaseRepository } from '../repository';

function toVectorSql(vector: number[]): string {
  return JSON.stringify(vector.map((v) => Number(v)));
}
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
import * as crypto from 'crypto';

export class PostgresDatabaseRepository implements IDatabaseRepository {
  private inMemoryReviews: Map<string, JobReviewRecord> = new Map();
  private inMemoryFavorites: Set<string> = new Set();
  private inMemoryComplaints: Map<string, JobComplaintRecord> = new Map();

  constructor(private pool: Pool) {}

  async getProviderSourceReference(source: ProviderSourceReference['source'], externalId: string): Promise<ProviderSourceReference | null> {
    const result = await this.pool.query(
      `SELECT * FROM provider_source_references WHERE source = $1 AND external_id = $2`, [source, externalId]
    );
    const row = result.rows[0];
    return row ? { id: row.id, source: row.source, externalId: row.external_id,
      providerId: row.provider_id || undefined, claimedByUserId: row.claimed_by_user_id || undefined,
      status: row.status, createdAt: row.created_at, updatedAt: row.updated_at } : null;
  }

  async upsertProviderSourceReference(data: Omit<ProviderSourceReference, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProviderSourceReference> {
    const id = `source_${crypto.randomUUID().slice(0, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO provider_source_references (id, source, external_id, provider_id, claimed_by_user_id, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (source, external_id) DO UPDATE SET provider_id = EXCLUDED.provider_id,
         claimed_by_user_id = EXCLUDED.claimed_by_user_id, status = EXCLUDED.status, updated_at = NOW()
       RETURNING *`,
      [id, data.source, data.externalId, data.providerId || null, data.claimedByUserId || null, data.status]
    );
    const row = result.rows[0];
    return { id: row.id, source: row.source, externalId: row.external_id, providerId: row.provider_id || undefined,
      claimedByUserId: row.claimed_by_user_id || undefined, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async activateProviderSourceReferences(providerId: string): Promise<void> {
    await this.pool.query(
      `UPDATE provider_source_references SET status = 'ACTIVE', updated_at = NOW()
       WHERE provider_id = $1 AND status IN ('CLAIMED','VERIFIED')`, [providerId]
    );
  }

  async createProviderCustomer(data: Omit<ProviderCustomerRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProviderCustomerRecord> {
    const existing = await this.pool.query(
      `SELECT id FROM provider_customers WHERE provider_id = $1 AND
       (($2::text IS NOT NULL AND phone = $2) OR ($3::text IS NOT NULL AND linked_user_id = $3)) LIMIT 1`,
      [data.providerId, data.phone || null, data.linkedUserId || null]
    );
    if (existing.rows[0]) {
      const updated = await this.pool.query(
        `UPDATE provider_customers SET name = $1, phone = COALESCE($2, phone), sector = COALESCE($3, sector),
         notes = COALESCE($4, notes), linked_user_id = COALESCE($5, linked_user_id), updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [data.name, data.phone || null, data.sector || null, data.notes || null, data.linkedUserId || null, existing.rows[0].id]
      );
      return this.mapProviderCustomer(updated.rows[0]);
    }
    const id = `pc_${crypto.randomUUID().slice(0, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO provider_customers (id, provider_id, linked_user_id, name, phone, sector, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, data.providerId, data.linkedUserId || null, data.name, data.phone || null, data.sector || null, data.notes || null]
    );
    return this.mapProviderCustomer(result.rows[0]);
  }

  async listProviderCustomers(providerId: string): Promise<ProviderCustomerRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM provider_customers WHERE provider_id = $1 ORDER BY updated_at DESC`, [providerId]
    );
    return result.rows.map((row) => this.mapProviderCustomer(row));
  }

  async getProviderCustomerById(id: string): Promise<ProviderCustomerRecord | null> {
    const result = await this.pool.query(`SELECT * FROM provider_customers WHERE id = $1`, [id]);
    return result.rows[0] ? this.mapProviderCustomer(result.rows[0]) : null;
  }

  async createProviderAppointment(data: Omit<ProviderAppointmentRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProviderAppointmentRecord> {
    const id = `appt_${crypto.randomUUID().slice(0, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO provider_appointments (id, provider_id, provider_customer_id, marketplace_job_id, category,
        description, scheduled_at, scheduled_label, status, quoted_amount, final_amount, reminder_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [id, data.providerId, data.providerCustomerId, data.marketplaceJobId || null, data.category, data.description,
        data.scheduledAt, data.scheduledLabel, data.status, data.quotedAmount || null, data.finalAmount || null,
        data.reminderAt || null, data.notes || null]
    );
    return this.mapProviderAppointment(result.rows[0]);
  }

  async listProviderAppointments(providerId: string): Promise<ProviderAppointmentRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM provider_appointments WHERE provider_id = $1 ORDER BY scheduled_at`, [providerId]
    );
    return result.rows.map((row) => this.mapProviderAppointment(row));
  }

  async updateProviderAppointmentStatus(id: string, status: ProviderAppointmentRecord['status'], finalAmount?: number): Promise<ProviderAppointmentRecord | null> {
    const result = await this.pool.query(
      `UPDATE provider_appointments SET status = $1, final_amount = COALESCE($2, final_amount), updated_at = NOW()
       WHERE id = $3 RETURNING *`, [status, finalAmount || null, id]
    );
    return result.rows[0] ? this.mapProviderAppointment(result.rows[0]) : null;
  }

  private mapProviderCustomer(row: any): ProviderCustomerRecord {
    return { id: row.id, providerId: row.provider_id, linkedUserId: row.linked_user_id || undefined,
      name: row.name, phone: row.phone || undefined, sector: row.sector || undefined, notes: row.notes || undefined,
      createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private mapProviderAppointment(row: any): ProviderAppointmentRecord {
    return { id: row.id, providerId: row.provider_id, providerCustomerId: row.provider_customer_id,
      marketplaceJobId: row.marketplace_job_id || undefined, category: row.category, description: row.description,
      scheduledAt: Number(row.scheduled_at), scheduledLabel: row.scheduled_label, status: row.status,
      quotedAmount: row.quoted_amount || undefined, finalAmount: row.final_amount || undefined,
      reminderAt: row.reminder_at || undefined, notes: row.notes || undefined,
      createdAt: row.created_at, updatedAt: row.updated_at };
  }

  // Providers
  async getProviderById(id: string): Promise<ProviderRecord | null> {
    const res = await this.pool.query(
      `SELECT id, user_id, name, phone, category, experience_years, rating, total_jobs, hourly_rate, service_radius_km,
              ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat,
              sector, is_online, available_slots
       FROM providers WHERE id = $1`,
      [id]
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      name: r.name,
      phone: r.phone,
      category: r.category,
      experienceYears: r.experience_years,
      rating: parseFloat(r.rating),
      totalJobs: r.total_jobs,
      hourlyRate: r.hourly_rate,
      serviceRadiusKm: r.service_radius_km,
      location: { lat: r.lat, lng: r.lng },
      sector: r.sector,
      isOnline: r.is_online,
      availableSlots: r.available_slots || [],
    };
  }

  async getProviderByUserId(userId: string): Promise<ProviderRecord | null> {
    const result = await this.pool.query('SELECT id FROM providers WHERE user_id = $1 LIMIT 1', [userId]);
    return result.rows[0]?.id ? this.getProviderById(result.rows[0].id) : null;
  }

  async listProvidersByCategory(category: string): Promise<ProviderRecord[]> {
    const res = await this.pool.query(
      `SELECT id, user_id, name, phone, category, experience_years, rating, total_jobs, hourly_rate, service_radius_km,
              ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat,
              sector, is_online, available_slots
       FROM providers WHERE category = $1`,
      [category]
    );

    return res.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      phone: r.phone,
      category: r.category,
      experienceYears: r.experience_years,
      rating: parseFloat(r.rating),
      totalJobs: r.total_jobs,
      hourlyRate: r.hourly_rate,
      serviceRadiusKm: r.service_radius_km,
      location: { lat: r.lat, lng: r.lng },
      sector: r.sector,
      isOnline: r.is_online,
      availableSlots: r.available_slots || [],
    }));
  }

  async updateProviderStatus(id: string, isOnline: boolean): Promise<boolean> {
    const res = await this.pool.query('UPDATE providers SET is_online = $1 WHERE id = $2', [isOnline, id]);
    return (res.rowCount ?? 0) > 0;
  }

  async updateProviderLocation(id: string, lat: number, lng: number): Promise<boolean> {
    const res = await this.pool.query(
      'UPDATE providers SET location = ST_SetSRID(ST_Point($1, $2), 4326) WHERE id = $3',
      [lng, lat, id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async upsertProviderProfile(data: ProviderRecord): Promise<ProviderRecord> {
    await this.pool.query(
      `INSERT INTO providers (
        id, user_id, name, phone, category, experience_years, rating, total_jobs, hourly_rate, service_radius_km,
        location, sector, is_online, available_slots
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, ST_SetSRID(ST_Point($11, $12), 4326), $13, $14, $15
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        category = EXCLUDED.category,
        experience_years = EXCLUDED.experience_years,
        hourly_rate = EXCLUDED.hourly_rate,
        service_radius_km = EXCLUDED.service_radius_km,
        sector = EXCLUDED.sector,
        available_slots = EXCLUDED.available_slots`,
      [
        data.id,
        data.userId || null,
        data.name,
        data.phone,
        data.category,
        data.experienceYears,
        data.rating,
        data.totalJobs,
        data.hourlyRate,
        data.serviceRadiusKm || 10,
        data.location.lng,
        data.location.lat,
        data.sector,
        data.isOnline,
        JSON.stringify(data.availableSlots),
      ]
    );
    return data;
  }

  // Spatial-Vector matching (PostGIS ST_DWithin + pgvector <=> cosine search)
  async searchAndRankProviders(params: SpatialVectorSearchParams): Promise<RankedCandidate[]> {
    const { category, userCoords, queryEmbedding, radiusMeters = 15000, limit = 5 } = params;

    const dummyEmbedding = Array(768).fill(0.05);
    const vectorParam = toVectorSql(queryEmbedding || dummyEmbedding);

    const query = `
      SELECT id, user_id, name, phone, category, experience_years, rating, total_jobs, hourly_rate, service_radius_km,
             ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat,
             sector, is_online, available_slots,
             ST_Distance(location::geography, ST_SetSRID(ST_Point($1, $2), 4326)::geography) / 1000.0 as distance_km,
             CASE
               WHEN skill_embedding IS NOT NULL THEN (1.0 - (skill_embedding <=> $3))
               ELSE 0.9
             END as skill_similarity,
             (
               0.4 * GREATEST(0.0, 1.0 - (ST_Distance(location::geography, ST_SetSRID(ST_Point($1, $2), 4326)::geography) / $4))
               + 0.4 * CASE WHEN skill_embedding IS NOT NULL THEN (1.0 - (skill_embedding <=> $3)) ELSE 0.9 END
               + 0.2 * (rating / 5.0)
             ) as composite_score
      FROM providers
      WHERE is_online = true
        AND category = $5
        AND ST_DWithin(location::geography, ST_SetSRID(ST_Point($1, $2), 4326)::geography, $6)
      ORDER BY composite_score DESC
      LIMIT $7;
    `;

    const res = await this.pool.query(query, [
      userCoords.lng,
      userCoords.lat,
      vectorParam,
      radiusMeters,
      category,
      radiusMeters,
      limit,
    ]);

    return res.rows.map((r) => ({
      provider: {
        id: r.id,
        userId: r.user_id,
        name: r.name,
        phone: r.phone,
        category: r.category,
        experienceYears: r.experience_years,
        rating: parseFloat(r.rating),
        totalJobs: r.total_jobs,
        hourlyRate: r.hourly_rate,
        serviceRadiusKm: r.service_radius_km,
        location: { lat: r.lat, lng: r.lng },
        sector: r.sector,
        isOnline: r.is_online,
        availableSlots: r.available_slots || [],
      },
      distanceKm: parseFloat(parseFloat(r.distance_km).toFixed(1)),
      skillSimilarity: parseFloat(parseFloat(r.skill_similarity).toFixed(2)),
      compositeScore: parseFloat(parseFloat(r.composite_score).toFixed(3)),
    }));
  }

  // Jobs
  async createJob(jobData: Omit<JobRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<JobRecord> {
    const id = `job_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date();

    await this.pool.query(
      `INSERT INTO jobs (
        id, customer_id, customer_name, customer_phone, provider_id, provider_name,
        category, status, issue_description, urgency, location, sector,
        scheduled_for, scheduled_timestamp, estimated_fare, explainability_rationale,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, ST_SetSRID(ST_Point($11, $12), 4326), $13,
        $14, $15, $16, $17,
        $18, $19
      )`,
      [
        id,
        jobData.customerId,
        jobData.customerName || null,
        jobData.customerPhone || null,
        jobData.providerId || null,
        jobData.providerName || null,
        jobData.category,
        jobData.status,
        jobData.issueDescription,
        jobData.urgency,
        jobData.location.lng,
        jobData.location.lat,
        jobData.sector,
        jobData.scheduledFor,
        jobData.scheduledTimestamp,
        jobData.estimatedFare,
        jobData.explainabilityRationale || null,
        now,
        now,
      ]
    );

    return {
      ...jobData,
      id,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getJobById(id: string): Promise<JobRecord | null> {
    const res = await this.pool.query(
      `SELECT id, customer_id, customer_name, customer_phone, provider_id, provider_name,
              category, status, issue_description, urgency,
              ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat,
              sector, scheduled_for, scheduled_timestamp, estimated_fare, final_fare,
              explainability_rationale, created_at, updated_at
       FROM jobs WHERE id = $1`,
      [id]
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      customerId: r.customer_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      providerId: r.provider_id,
      providerName: r.provider_name,
      category: r.category,
      status: r.status,
      issueDescription: r.issue_description,
      urgency: r.urgency,
      location: { lat: r.lat, lng: r.lng },
      sector: r.sector,
      scheduledFor: r.scheduled_for,
      scheduledTimestamp: Number(r.scheduled_timestamp),
      estimatedFare: r.estimated_fare,
      finalFare: r.final_fare,
      explainabilityRationale: r.explainability_rationale,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async listJobsByCustomer(customerId: string): Promise<JobRecord[]> {
    const res = await this.pool.query(
      `SELECT id, customer_id, customer_name, customer_phone, provider_id, provider_name,
              category, status, issue_description, urgency,
              ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat,
              sector, scheduled_for, scheduled_timestamp, estimated_fare, final_fare,
              explainability_rationale, created_at, updated_at
       FROM jobs WHERE customer_id = $1 ORDER BY created_at DESC`,
      [customerId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      providerId: r.provider_id,
      providerName: r.provider_name,
      category: r.category,
      status: r.status,
      issueDescription: r.issue_description,
      urgency: r.urgency,
      location: { lat: r.lat, lng: r.lng },
      sector: r.sector,
      scheduledFor: r.scheduled_for,
      scheduledTimestamp: Number(r.scheduled_timestamp),
      estimatedFare: r.estimated_fare,
      finalFare: r.final_fare,
      explainabilityRationale: r.explainability_rationale,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async listPendingJobsForProvider(providerId: string): Promise<JobRecord[]> {
    const res = await this.pool.query(
      `SELECT id, customer_id, customer_name, customer_phone, provider_id, provider_name,
              category, status, issue_description, urgency,
              ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat,
              sector, scheduled_for, scheduled_timestamp, estimated_fare, final_fare,
              explainability_rationale, created_at, updated_at
       FROM jobs WHERE provider_id = $1 AND status IN ('dispatched', 'matched') ORDER BY created_at DESC`,
      [providerId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      providerId: r.provider_id,
      providerName: r.provider_name,
      category: r.category,
      status: r.status,
      issueDescription: r.issue_description,
      urgency: r.urgency,
      location: { lat: r.lat, lng: r.lng },
      sector: r.sector,
      scheduledFor: r.scheduled_for,
      scheduledTimestamp: Number(r.scheduled_timestamp),
      estimatedFare: r.estimated_fare,
      finalFare: r.final_fare,
      explainabilityRationale: r.explainability_rationale,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async listActiveJobsForProvider(providerId: string): Promise<JobRecord[]> {
    const res = await this.pool.query(
      `SELECT id, customer_id, customer_name, customer_phone, provider_id, provider_name,
              category, status, issue_description, urgency,
              ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat,
              sector, scheduled_for, scheduled_timestamp, estimated_fare, final_fare,
              explainability_rationale, created_at, updated_at
       FROM jobs WHERE provider_id = $1 AND status IN ('accepted', 'in_progress') ORDER BY created_at DESC`,
      [providerId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      providerId: r.provider_id,
      providerName: r.provider_name,
      category: r.category,
      status: r.status,
      issueDescription: r.issue_description,
      urgency: r.urgency,
      location: { lat: r.lat, lng: r.lng },
      sector: r.sector,
      scheduledFor: r.scheduled_for,
      scheduledTimestamp: Number(r.scheduled_timestamp),
      estimatedFare: r.estimated_fare,
      finalFare: r.final_fare,
      explainabilityRationale: r.explainability_rationale,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async updateJobStatus(
    id: string,
    status: JobRecord['status'],
    details?: { finalFare?: number; explainabilityRationale?: string }
  ): Promise<JobRecord | null> {
    const fields = ['status = $1', 'updated_at = NOW()'];
    const values: any[] = [status];
    let idx = 2;

    if (details?.finalFare !== undefined) {
      fields.push(`final_fare = $${idx++}`);
      values.push(details.finalFare);
    }
    if (details?.explainabilityRationale !== undefined) {
      fields.push(`explainability_rationale = $${idx++}`);
      values.push(details.explainabilityRationale);
    }

    values.push(id);
    await this.pool.query(`UPDATE jobs SET ${fields.join(', ')} WHERE id = $${idx}`, values);

    return this.getJobById(id);
  }

  // Dues
  async createDue(dueData: Omit<DueRecord, 'id' | 'createdAt'>): Promise<DueRecord> {
    const id = `due_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date();

    await this.pool.query(
      `INSERT INTO dues (
        id, provider_id, customer_id, provider_customer_id, customer_name, customer_phone, service_category,
        job_id, amount, status, due_date, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        dueData.providerId,
        dueData.customerId || null,
        dueData.providerCustomerId || null,
        dueData.customerName,
        dueData.customerPhone || null,
        dueData.serviceCategory,
        dueData.jobId || null,
        dueData.amount,
        dueData.status,
        dueData.dueDate,
        dueData.notes || null,
        now,
      ]
    );

    return {
      ...dueData,
      id,
      createdAt: now,
    };
  }

  async listDuesByProvider(providerId: string): Promise<{ dues: DueRecord[]; totalPendingAmount: number }> {
    const res = await this.pool.query(
      `SELECT id, provider_id, customer_id, provider_customer_id, customer_name, customer_phone,
              service_category, job_id, amount, status, due_date, paid_at, notes, created_at
       FROM dues WHERE provider_id = $1 ORDER BY created_at DESC`,
      [providerId]
    );

    const dues: DueRecord[] = res.rows.map((r) => ({
      id: r.id,
      providerId: r.provider_id,
      customerId: r.customer_id,
      providerCustomerId: r.provider_customer_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      serviceCategory: r.service_category,
      jobId: r.job_id,
      amount: r.amount,
      status: r.status,
      dueDate: r.due_date,
      paidAt: r.paid_at,
      notes: r.notes,
      createdAt: r.created_at,
    }));

    const totalPendingAmount = dues
      .filter((d) => d.status === 'pending')
      .reduce((sum, d) => sum + d.amount, 0);

    return { dues, totalPendingAmount };
  }

  async markDueAsPaid(id: string): Promise<DueRecord | null> {
    const now = new Date();
    const res = await this.pool.query(
      'UPDATE dues SET status = $1, paid_at = $2 WHERE id = $3 RETURNING *',
      ['paid', now, id]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      providerId: r.provider_id,
      customerId: r.customer_id,
      providerCustomerId: r.provider_customer_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      serviceCategory: r.service_category,
      jobId: r.job_id,
      amount: r.amount,
      status: r.status,
      dueDate: r.due_date,
      paidAt: r.paid_at,
      notes: r.notes,
      createdAt: r.created_at,
    };
  }

  async deleteDue(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM dues WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // Audit Logs
  async createAuditLog(logData: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<AuditLogRecord> {
    const id = `audit_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date();

    await this.pool.query(
      `INSERT INTO audit_logs (
        id, job_id, session_id, event_type, intent_data, matched_candidates,
        chosen_provider_id, rationale, latency_ms, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        logData.jobId || null,
        logData.sessionId || null,
        logData.eventType,
        logData.intentData ? JSON.stringify(logData.intentData) : null,
        logData.matchedCandidates ? JSON.stringify(logData.matchedCandidates) : null,
        logData.chosenProviderId || null,
        logData.rationale || null,
        logData.latencyMs || null,
        now,
      ]
    );

    return {
      ...logData,
      id,
      createdAt: now,
    };
  }

  async listAuditLogsForJob(jobId: string): Promise<AuditLogRecord[]> {
    const res = await this.pool.query(
      'SELECT * FROM audit_logs WHERE job_id = $1 ORDER BY created_at ASC',
      [jobId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      sessionId: r.session_id,
      eventType: r.event_type,
      intentData: r.intent_data,
      matchedCandidates: r.matched_candidates,
      chosenProviderId: r.chosen_provider_id,
      rationale: r.rationale,
      latencyMs: r.latency_ms,
      createdAt: r.created_at,
    }));
  }

  // Users
  async getUserById(id: string): Promise<User | null> {
    const res = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      role: r.role,
      sector: r.sector,
      avatarUrl: r.avatar_url,
      phoneVerifiedAt: r.phone_verified_at,
      createdAt: r.created_at,
    };
  }

  async getUserByPhone(phone: string): Promise<User | null> {
    const res = await this.pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      role: r.role,
      sector: r.sector,
      avatarUrl: r.avatar_url,
      phoneVerifiedAt: r.phone_verified_at,
      createdAt: r.created_at,
    };
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date();

    await this.pool.query(
      'INSERT INTO users (id, name, phone, email, role, sector, avatar_url, phone_verified_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        id,
        userData.name,
        userData.phone,
        userData.email || null,
        userData.role,
        userData.sector || null,
        userData.avatarUrl || null,
        userData.phoneVerifiedAt || null,
        now,
      ]
    );

    return {
      ...userData,
      id,
      createdAt: now,
    };
  }

  async updateUserProfile(id: string, updates: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(updates.phone);
    }
    if (updates.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(updates.email);
    }
    if (updates.sector !== undefined) {
      fields.push(`sector = $${idx++}`);
      values.push(updates.sector);
    }
    if (updates.avatarUrl !== undefined) {
      fields.push(`avatar_url = $${idx++}`);
      values.push(updates.avatarUrl);
    }

    if (fields.length === 0) return this.getUserById(id);

    values.push(id);
    await this.pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, values);

    return this.getUserById(id);
  }

  async getPasswordHash(userId: string): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT password_hash FROM auth_credentials WHERE user_id = $1',
      [userId]
    );
    return result.rows[0]?.password_hash || null;
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO auth_credentials (user_id, password_hash, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, updated_at = NOW()`,
      [userId, passwordHash]
    );
  }

  async createServiceRequest(data: Omit<ServiceRequestRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceRequestRecord> {
    const id = `req_${crypto.randomUUID().slice(0, 8)}`;
    await this.pool.query(
      `INSERT INTO service_requests (id, customer_id, customer_name, customer_phone, category, issue_description,
        urgency, location, sector, requested_start_at, requested_time_label, status, response_deadline_at,
        accepted_response_id) VALUES ($1,$2,$3,$4,$5,$6,$7,ST_SetSRID(ST_Point($8,$9),4326),$10,$11,$12,$13,$14,$15)`,
      [id, data.customerId, data.customerName || null, data.customerPhone || null, data.category,
        data.issueDescription, data.urgency, data.location.lng, data.location.lat, data.sector,
        data.requestedStartAt, data.requestedTimeLabel, data.status, data.responseDeadlineAt,
        data.acceptedResponseId || null]
    );
    return (await this.getServiceRequestById(id))!;
  }

  async getServiceRequestById(id: string): Promise<ServiceRequestRecord | null> {
    const result = await this.pool.query(
      `SELECT *, ST_X(location) AS lng, ST_Y(location) AS lat FROM service_requests WHERE id = $1`, [id]
    );
    return result.rows[0] ? this.mapServiceRequest(result.rows[0]) : null;
  }

  async listServiceRequestsByCustomer(customerId: string): Promise<ServiceRequestRecord[]> {
    const result = await this.pool.query(
      `SELECT *, ST_X(location) AS lng, ST_Y(location) AS lat FROM service_requests
       WHERE customer_id = $1 ORDER BY created_at DESC`, [customerId]
    );
    return result.rows.map((row) => this.mapServiceRequest(row));
  }

  async updateServiceRequestStatus(id: string, status: ServiceRequestRecord['status']): Promise<ServiceRequestRecord | null> {
    const result = await this.pool.query(
      `UPDATE service_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`, [status, id]
    );
    return result.rowCount ? this.getServiceRequestById(id) : null;
  }

  async createRequestDispatch(data: Omit<RequestDispatchRecord, 'id' | 'sentAt'>): Promise<RequestDispatchRecord> {
    const id = `dispatch_${crypto.randomUUID().slice(0, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO request_dispatches (id, request_id, provider_id, wave, rank, composite_score, distance_km, rationale, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (request_id, provider_id) DO UPDATE SET request_id = EXCLUDED.request_id
       RETURNING *`,
      [id, data.requestId, data.providerId, data.wave, data.rank, data.compositeScore, data.distanceKm, data.rationale, data.status]
    );
    return this.mapDispatch(result.rows[0]);
  }

  async listDispatchesForRequest(requestId: string): Promise<RequestDispatchRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM request_dispatches WHERE request_id = $1 ORDER BY wave, rank`, [requestId]
    );
    return result.rows.map((row) => this.mapDispatch(row));
  }

  async listPendingDispatchesForProvider(providerId: string): Promise<RequestDispatchRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM request_dispatches WHERE provider_id = $1 AND status = 'pending' ORDER BY sent_at DESC`, [providerId]
    );
    return result.rows.map((row) => this.mapDispatch(row));
  }

  async getDispatchById(id: string): Promise<RequestDispatchRecord | null> {
    const result = await this.pool.query(`SELECT * FROM request_dispatches WHERE id = $1`, [id]);
    return result.rows[0] ? this.mapDispatch(result.rows[0]) : null;
  }

  async createProviderResponse(data: Omit<ProviderResponseRecord, 'id' | 'createdAt'>): Promise<ProviderResponseRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const id = `response_${crypto.randomUUID().slice(0, 8)}`;
      const result = await client.query(
        `INSERT INTO provider_responses (id, request_id, dispatch_id, provider_id, available, proposed_start_at,
          proposed_time_label, amount, price_type, message, valid_until, accepted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [id, data.requestId, data.dispatchId, data.providerId, data.available, data.proposedStartAt || null,
          data.proposedTimeLabel || null, data.amount || null, data.priceType || null, data.message || null,
          data.validUntil || null, data.acceptedAt || null]
      );
      await client.query(
        `UPDATE request_dispatches SET status = $1, responded_at = NOW() WHERE id = $2`,
        [data.available ? 'responded' : 'declined', data.dispatchId]
      );
      if (data.available) {
        await client.query(
          `UPDATE service_requests SET status = 'ready_to_choose', updated_at = NOW()
           WHERE id = $1 AND status = 'collecting_responses'`, [data.requestId]
        );
      }
      await client.query('COMMIT');
      return this.mapResponse(result.rows[0]);
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error?.code === '23505') throw new Error('DISPATCH_ALREADY_RESPONDED');
      throw error;
    } finally {
      client.release();
    }
  }

  async listResponsesForRequest(requestId: string): Promise<ProviderResponseRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM provider_responses WHERE request_id = $1 ORDER BY created_at`, [requestId]
    );
    return result.rows.map((row) => this.mapResponse(row));
  }

  async acceptResponseAndCreateJob(responseId: string, customerId: string): Promise<JobRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const selected = await client.query(
        `SELECT pr.*, sr.customer_id, sr.customer_name, sr.customer_phone, sr.category, sr.issue_description,
          sr.urgency, sr.sector, sr.requested_start_at, sr.requested_time_label,
          ST_X(sr.location) AS lng, ST_Y(sr.location) AS lat, p.name AS provider_name, p.hourly_rate
         FROM provider_responses pr JOIN service_requests sr ON sr.id = pr.request_id
         JOIN providers p ON p.id = pr.provider_id WHERE pr.id = $1 FOR UPDATE OF sr`, [responseId]
      );
      const row = selected.rows[0];
      if (!row || !row.available || row.customer_id !== customerId) {
        await client.query('ROLLBACK'); return null;
      }
      const updated = await client.query(
        `UPDATE service_requests SET status = 'booked', accepted_response_id = $1, updated_at = NOW()
         WHERE id = $2 AND status IN ('collecting_responses','ready_to_choose') RETURNING id`,
        [responseId, row.request_id]
      );
      if (!updated.rowCount) { await client.query('ROLLBACK'); return null; }
      await client.query(`UPDATE provider_responses SET accepted_at = NOW() WHERE id = $1`, [responseId]);
      await client.query(
        `UPDATE request_dispatches SET status = 'withdrawn'
         WHERE request_id = $1 AND provider_id <> $2 AND status = 'pending'`, [row.request_id, row.provider_id]
      );
      const jobId = `job_${crypto.randomUUID().slice(0, 8)}`;
      const now = new Date();
      await client.query(
        `INSERT INTO jobs (id, customer_id, customer_name, customer_phone, provider_id, provider_name, category,
          status, issue_description, urgency, location, sector, scheduled_for, scheduled_timestamp,
          estimated_fare, explainability_rationale, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'accepted',$8,$9,ST_SetSRID(ST_Point($10,$11),4326),$12,$13,$14,$15,$16,$17,$17)`,
        [jobId, row.customer_id, row.customer_name, row.customer_phone, row.provider_id, row.provider_name,
          row.category, row.issue_description, row.urgency, row.lng, row.lat, row.sector,
          row.proposed_time_label || row.requested_time_label, Number(row.proposed_start_at || row.requested_start_at),
          row.amount || row.hourly_rate || 1500, 'Customer selected this provider response', now]
      );
      await client.query('COMMIT');
      return this.getJobById(jobId);
    } catch (error) {
      await client.query('ROLLBACK'); throw error;
    } finally {
      client.release();
    }
  }

  private mapServiceRequest(row: any): ServiceRequestRecord {
    return { id: row.id, customerId: row.customer_id, customerName: row.customer_name || undefined,
      customerPhone: row.customer_phone || undefined, category: row.category, issueDescription: row.issue_description,
      urgency: row.urgency, location: { lat: Number(row.lat), lng: Number(row.lng) }, sector: row.sector,
      requestedStartAt: Number(row.requested_start_at), requestedTimeLabel: row.requested_time_label,
      status: row.status, responseDeadlineAt: row.response_deadline_at, acceptedResponseId: row.accepted_response_id || undefined,
      createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private mapDispatch(row: any): RequestDispatchRecord {
    return { id: row.id, requestId: row.request_id, providerId: row.provider_id, wave: row.wave, rank: row.rank,
      compositeScore: Number(row.composite_score), distanceKm: Number(row.distance_km), rationale: row.rationale,
      status: row.status, sentAt: row.sent_at, respondedAt: row.responded_at || undefined };
  }

  private mapResponse(row: any): ProviderResponseRecord {
    return { id: row.id, requestId: row.request_id, dispatchId: row.dispatch_id, providerId: row.provider_id,
      available: row.available, proposedStartAt: row.proposed_start_at ? Number(row.proposed_start_at) : undefined,
      proposedTimeLabel: row.proposed_time_label || undefined, amount: row.amount || undefined,
      priceType: row.price_type || undefined, message: row.message || undefined, validUntil: row.valid_until || undefined,
      acceptedAt: row.accepted_at || undefined, createdAt: row.created_at };
  }

  // Phase 4: Reviews, Favorites, Complaints
  async createJobReview(review: Omit<JobReviewRecord, 'id' | 'createdAt'>): Promise<JobReviewRecord> {
    const id = `rev_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date();
    const record: JobReviewRecord = { ...review, id, createdAt: now };

    try {
      await this.pool.query(
        `INSERT INTO job_reviews (id, job_id, customer_id, provider_id, rating, preset_tags, comment, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, review.jobId, review.customerId, review.providerId, review.rating, JSON.stringify(review.presetTags), review.comment || null, now]
      );
    } catch {
      this.inMemoryReviews.set(id, record);
    }
    return record;
  }

  async listReviewsForProvider(providerId: string): Promise<JobReviewRecord[]> {
    try {
      const res = await this.pool.query(
        `SELECT * FROM job_reviews WHERE provider_id = $1 ORDER BY created_at DESC`,
        [providerId]
      );
      if (res.rows.length > 0) {
        return res.rows.map((r) => ({
          id: r.id,
          jobId: r.job_id,
          customerId: r.customer_id,
          providerId: r.provider_id,
          rating: Number(r.rating),
          presetTags: typeof r.preset_tags === 'string' ? JSON.parse(r.preset_tags) : r.preset_tags || [],
          comment: r.comment || undefined,
          createdAt: r.created_at,
        }));
      }
    } catch {
      // Fallback to in-memory
    }
    return Array.from(this.inMemoryReviews.values()).filter((r) => r.providerId === providerId);
  }

  async getReviewByJobId(jobId: string): Promise<JobReviewRecord | null> {
    try {
      const res = await this.pool.query(`SELECT * FROM job_reviews WHERE job_id = $1`, [jobId]);
      if (res.rows.length > 0) {
        const r = res.rows[0];
        return {
          id: r.id,
          jobId: r.job_id,
          customerId: r.customer_id,
          providerId: r.provider_id,
          rating: Number(r.rating),
          presetTags: typeof r.preset_tags === 'string' ? JSON.parse(r.preset_tags) : r.preset_tags || [],
          comment: r.comment || undefined,
          createdAt: r.created_at,
        };
      }
    } catch {
      // Fallback
    }
    return Array.from(this.inMemoryReviews.values()).find((r) => r.jobId === jobId) || null;
  }

  async toggleFavoriteProvider(customerId: string, providerId: string): Promise<boolean> {
    const key = `${customerId}:${providerId}`;
    try {
      const existing = await this.pool.query(
        `SELECT id FROM favorites WHERE customer_id = $1 AND provider_id = $2`,
        [customerId, providerId]
      );
      if (existing.rows.length > 0) {
        await this.pool.query(`DELETE FROM favorites WHERE customer_id = $1 AND provider_id = $2`, [customerId, providerId]);
        return false;
      } else {
        await this.pool.query(
          `INSERT INTO favorites (id, customer_id, provider_id, created_at) VALUES ($1, $2, $3, NOW())`,
          [`fav_${crypto.randomUUID().slice(0, 8)}`, customerId, providerId]
        );
        return true;
      }
    } catch {
      if (this.inMemoryFavorites.has(key)) {
        this.inMemoryFavorites.delete(key);
        return false;
      } else {
        this.inMemoryFavorites.add(key);
        return true;
      }
    }
  }

  async listFavoritesByCustomer(customerId: string): Promise<string[]> {
    try {
      const res = await this.pool.query(`SELECT provider_id FROM favorites WHERE customer_id = $1`, [customerId]);
      if (res.rows.length > 0) return res.rows.map((r) => r.provider_id);
    } catch {
      // Fallback
    }
    const prefix = `${customerId}:`;
    const result: string[] = [];
    for (const key of this.inMemoryFavorites) {
      if (key.startsWith(prefix)) result.push(key.slice(prefix.length));
    }
    return result;
  }

  async createJobComplaint(
    complaint: Omit<JobComplaintRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<JobComplaintRecord> {
    const id = `comp_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date();
    const record: JobComplaintRecord = { ...complaint, id, status: 'open', createdAt: now, updatedAt: now };

    try {
      await this.pool.query(
        `INSERT INTO complaints (id, job_id, customer_id, provider_id, category, reason, details, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, complaint.jobId, complaint.customerId, complaint.providerId, complaint.category, complaint.reason, complaint.details || null, 'open', now, now]
      );
    } catch {
      this.inMemoryComplaints.set(id, record);
    }
    return record;
  }

  async listComplaintsByCustomer(customerId: string): Promise<JobComplaintRecord[]> {
    try {
      const res = await this.pool.query(
        `SELECT * FROM complaints WHERE customer_id = $1 ORDER BY created_at DESC`,
        [customerId]
      );
      if (res.rows.length > 0) {
        return res.rows.map((r) => ({
          id: r.id,
          jobId: r.job_id,
          customerId: r.customer_id,
          providerId: r.provider_id,
          category: r.category,
          reason: r.reason,
          details: r.details || undefined,
          status: r.status,
          resolution: r.resolution || undefined,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
      }
    } catch {
      // Fallback
    }
    return Array.from(this.inMemoryComplaints.values()).filter((c) => c.customerId === customerId);
  }
}
