import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryDatabaseRepository } from './repositories/memoryRepository';
import { SpatialVectorSearchParams } from './types';

test('Database Repository - Provider Retrieval', async () => {
  const repo = new MemoryDatabaseRepository();
  const provider = await repo.getProviderById('p_hvac_1');

  assert.ok(provider, 'Provider p_hvac_1 should exist');
  assert.equal(provider.name, 'Tariq Mehmood');
  assert.equal(provider.category, 'ac');
  assert.equal(provider.sector, 'G-13');
  assert.equal(provider.isOnline, true);
});

test('Database Repository - Spatial-Vector Search & Ranking', async () => {
  const repo = new MemoryDatabaseRepository();

  // Search from G-13 user coordinates
  const params: SpatialVectorSearchParams = {
    category: 'ac',
    userCoords: { lat: 33.647, lng: 72.951 }, // G-13 center
    radiusMeters: 10000, // 10 km
    limit: 3,
  };

  const results = await repo.searchAndRankProviders(params);

  assert.ok(results.length > 0, 'Should return matching candidates');
  assert.ok(results[0].compositeScore >= results[results.length - 1].compositeScore, 'Candidates should be sorted descending by composite score');
  assert.equal(results[0].provider.id, 'p_hvac_1', 'Closest AC provider to G-13 should rank #1');
  assert.ok(results[0].distanceKm <= 1.0, 'Top candidate should be close to G-13');
  assert.ok(results[0].compositeScore > 0, 'Composite score should be positive');
});

test('Database Repository - Job Lifecycle Operations', async () => {
  const repo = new MemoryDatabaseRepository();

  // Create job
  const job = await repo.createJob({
    customerId: 'usr_demo_customer',
    customerName: 'Ahmed Hassan',
    customerPhone: '+92 300 1234567',
    providerId: 'p_hvac_1',
    providerName: 'Tariq Mehmood',
    category: 'ac',
    status: 'dispatched',
    issueDescription: 'AC is not cooling properly in master bedroom',
    urgency: 'urgent',
    location: { lat: 33.6425, lng: 72.9789 },
    sector: 'G-13',
    scheduledFor: 'Tomorrow, 10:00 AM',
    scheduledTimestamp: Date.now() + 86400000,
    estimatedFare: 1800,
  });

  assert.ok(job.id, 'Job should receive generated ID');
  assert.equal(job.status, 'dispatched');

  // Verify pending jobs for provider
  const pendingJobs = await repo.listPendingJobsForProvider('p_hvac_1');
  assert.ok(pendingJobs.some((j) => j.id === job.id), 'Job should appear in pending jobs');

  // Update status to accepted
  const updatedJob = await repo.updateJobStatus(job.id, 'accepted', {
    explainabilityRationale: 'Matched via 0.2km distance & 4.9 rating on AC repair',
  });

  assert.ok(updatedJob);
  assert.equal(updatedJob.status, 'accepted');
  assert.ok(updatedJob.explainabilityRationale);

  // Active jobs check
  const activeJobs = await repo.listActiveJobsForProvider('p_hvac_1');
  assert.ok(activeJobs.some((j) => j.id === job.id), 'Job should appear in active jobs');
});

test('Database Repository - Customer Dues & Micro-ERP Ledger', async () => {
  const repo = new MemoryDatabaseRepository();

  // Get initial dues for Tariq Mehmood
  const initial = await repo.listDuesByProvider('p_hvac_1');
  assert.ok(initial.dues.length >= 2, 'Should have initial seed dues');
  assert.ok(initial.totalPendingAmount > 0, 'Should have pending amount');

  // Create new due
  const newDue = await repo.createDue({
    providerId: 'p_hvac_1',
    customerName: 'Zubair Shah',
    customerPhone: '+92 300 9998877',
    serviceCategory: 'ac',
    amount: 2500,
    status: 'pending',
    dueDate: '2026-03-25',
    notes: 'Compressor capacitor replacement',
  });

  assert.ok(newDue.id);
  assert.equal(newDue.amount, 2500);

  // Verify list & pending total increment
  const updated = await repo.listDuesByProvider('p_hvac_1');
  assert.equal(updated.totalPendingAmount, initial.totalPendingAmount + 2500);

  // Mark as paid
  const paidDue = await repo.markDueAsPaid(newDue.id);
  assert.ok(paidDue);
  assert.equal(paidDue.status, 'paid');
  assert.ok(paidDue.paidAt instanceof Date);

  // Total pending should return to initial
  const finalState = await repo.listDuesByProvider('p_hvac_1');
  assert.equal(finalState.totalPendingAmount, initial.totalPendingAmount);
});

test('Database Repository - Audit Logs', async () => {
  const repo = new MemoryDatabaseRepository();

  const log = await repo.createAuditLog({
    jobId: 'job_test_101',
    sessionId: 'sess_123',
    eventType: 'MATCH_COMPLETED',
    intentData: { service: 'ac', urgency: 'urgent' },
    chosenProviderId: 'p_hvac_1',
    rationale: 'Top candidate selected by spatial proximity and 4.9 rating',
    latencyMs: 42,
  });

  assert.ok(log.id);
  const logs = await repo.listAuditLogsForJob('job_test_101');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].eventType, 'MATCH_COMPLETED');
});

test('Marketplace request - provider response becomes one customer-selected booking', async () => {
  const repo = new MemoryDatabaseRepository();
  const request = await repo.createServiceRequest({
    customerId: 'usr_demo_customer', customerName: 'Ahmed Hassan', customerPhone: '+923001234567',
    category: 'ac', issueDescription: 'AC chal raha hai lekin thanda nahi kar raha', urgency: 'urgent',
    location: { lat: 33.647, lng: 72.951 }, sector: 'G-13', requestedStartAt: Date.now() + 3_600_000,
    requestedTimeLabel: 'Aaj 6 baje', status: 'collecting_responses', responseDeadlineAt: new Date(Date.now() + 600_000),
  });
  const dispatch = await repo.createRequestDispatch({ requestId: request.id, providerId: 'p_hvac_1', wave: 1,
    rank: 1, compositeScore: 0.95, distanceKm: 0.2, rationale: 'Nearby and available', status: 'pending' });
  const response = await repo.createProviderResponse({ requestId: request.id, dispatchId: dispatch.id,
    providerId: 'p_hvac_1', available: true, proposedStartAt: Date.now() + 3_600_000,
    proposedTimeLabel: 'Aaj 6 baje', amount: 1800, priceType: 'estimate', message: 'Pehle check karunga' });

  assert.equal((await repo.getServiceRequestById(request.id))?.status, 'ready_to_choose');
  const job = await repo.acceptResponseAndCreateJob(response.id, 'usr_demo_customer');
  assert.ok(job);
  assert.equal(job.providerId, 'p_hvac_1');
  assert.equal(job.estimatedFare, 1800);
  assert.equal((await repo.getServiceRequestById(request.id))?.status, 'booked');
  assert.equal(await repo.acceptResponseAndCreateJob(response.id, 'usr_demo_customer'), null, 'a request cannot create two bookings');
});

test('External provider reference advances to ACTIVE without storing listing content', async () => {
  const repo = new MemoryDatabaseRepository();
  const claimed = await repo.upsertProviderSourceReference({ source: 'google_places', externalId: 'place_test_1',
    providerId: 'p_hvac_1', claimedByUserId: 'usr_demo_provider', status: 'VERIFIED' });
  assert.equal(claimed.status, 'VERIFIED');
  assert.equal('name' in claimed, false);
  await repo.activateProviderSourceReferences('p_hvac_1');
  assert.equal((await repo.getProviderSourceReference('google_places', 'place_test_1'))?.status, 'ACTIVE');
});

test('Provider mini-CRM links an offline customer, appointment, and due', async () => {
  const repo = new MemoryDatabaseRepository();
  const customer = await repo.createProviderCustomer({ providerId: 'p_hvac_1', name: 'Nadeem',
    phone: '+923001112233', sector: 'G-11', notes: 'Purana customer' });
  const appointment = await repo.createProviderAppointment({ providerId: 'p_hvac_1', providerCustomerId: customer.id,
    category: 'ac', description: 'AC service', scheduledAt: Date.now() + 86_400_000,
    scheduledLabel: 'Kal 10 baje', status: 'scheduled', quotedAmount: 2000 });
  const due = await repo.createDue({ providerId: 'p_hvac_1', providerCustomerId: customer.id,
    customerName: customer.name, customerPhone: customer.phone, serviceCategory: 'ac', amount: 2000,
    status: 'pending', dueDate: '2026-09-27', notes: appointment.description });

  assert.equal((await repo.listProviderCustomers('p_hvac_1'))[0].id, customer.id);
  assert.equal((await repo.listProviderAppointments('p_hvac_1'))[0].providerCustomerId, customer.id);
  assert.equal((await repo.listDuesByProvider('p_hvac_1')).dues.find((item) => item.id === due.id)?.providerCustomerId, customer.id);
  assert.equal((await repo.updateProviderAppointmentStatus(appointment.id, 'completed', 2200))?.finalAmount, 2200);
});
