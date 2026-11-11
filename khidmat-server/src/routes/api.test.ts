import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { authRouter } from './auth';
import { providersRouter } from './providers';
import { duesRouter } from './dues';
import { jobsRouter } from './jobs';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/providers', providersRouter);
  app.use('/api/dues', duesRouter);
  app.use('/api/jobs', jobsRouter);
  return app;
}

// Simple request helper against express app without spinning external network ports
async function makeRequest(
  app: express.Express,
  method: string,
  url: string,
  body?: Record<string, unknown>,
  token?: string
) {
  return new Promise<{ status: number; body: any }>((resolve) => {
    const server = app.listen(0, async () => {
      const address = server.address() as { port: number };
      const res = await fetch(`http://127.0.0.1:${address.port}${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      server.close(() => {
        resolve({ status: res.status, body: data });
      });
    });
  });
}

async function createAccount(app: express.Express, role: 'customer' | 'provider') {
  const phone = `+923${Math.floor(100000000 + Math.random() * 900000000)}`;
  const requestCode = await makeRequest(app, 'POST', '/api/auth/phone/request', { phone });
  assert.equal(requestCode.status, 200);
  const checkCode = await makeRequest(app, 'POST', '/api/auth/phone/verify', { phone, code: '1234' });
  assert.equal(checkCode.status, 200);
  const response = await makeRequest(app, 'POST', '/api/auth/signup', {
    name: role === 'provider' ? 'Test Karigar' : 'Test Customer',
    phone,
    password: '1234',
    role,
    sector: 'G-13',
    phoneVerificationToken: checkCode.body.data.phoneVerificationToken,
  });
  assert.equal(response.status, 201);
  return response.body.data as { user: { id: string }; token: string };
}

async function createProviderAccount(app: express.Express) {
  const account = await createAccount(app, 'provider');
  const onboard = await makeRequest(app, 'POST', '/api/providers/onboard', {
    userId: account.user.id,
    category: 'ac',
    experienceYears: 4,
    hourlyRate: 1200,
    coverageRadiusKm: 12,
    availableSlots: ['morning'],
    sector: 'G-13',
  }, account.token);
  assert.equal(onboard.status, 201);
  return { ...account, provider: onboard.body.data as { id: string } };
}

test('REST API - Auth Endpoints', async () => {
  const app = createTestApp();

  // 1. Signup
  const phone = `+92300${Math.floor(1000000 + Math.random() * 9000000)}`;
  const requestCode = await makeRequest(app, 'POST', '/api/auth/phone/request', { phone });
  assert.equal(requestCode.status, 200);
  const checkCode = await makeRequest(app, 'POST', '/api/auth/phone/verify', { phone, code: '1234' });
  assert.equal(checkCode.status, 200);
  const signupRes = await makeRequest(app, 'POST', '/api/auth/signup', {
    name: 'Test Customer',
    phone,
    password: '1234',
    role: 'customer',
    sector: 'G-13',
    phoneVerificationToken: checkCode.body.data.phoneVerificationToken,
  });

  assert.equal(signupRes.status, 201);
  assert.ok(signupRes.body.success);
  assert.ok(signupRes.body.data.user.id);
  assert.ok(signupRes.body.data.token);
  assert.ok(signupRes.body.data.user.phoneVerifiedAt);

  const unverifiedSignup = await makeRequest(app, 'POST', '/api/auth/signup', {
    name: 'Unverified User',
    phone: '+923009999998',
    password: '1234',
    role: 'customer',
    phoneVerificationToken: signupRes.body.data.token,
  });
  assert.equal(unverifiedSignup.status, 400);

  // 2. Login
  const loginRes = await makeRequest(app, 'POST', '/api/auth/login', {
    phone,
    password: '1234',
  });
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.data.user.phone, phone);

  const wrongPinRes = await makeRequest(app, 'POST', '/api/auth/login', {
    phone,
    password: '9999',
  });
  assert.equal(wrongPinRes.status, 401);

  const anonymousMeRes = await makeRequest(app, 'GET', '/api/auth/me');
  assert.equal(anonymousMeRes.status, 401);

  // 3. Me profile
  const meRes = await makeRequest(app, 'GET', '/api/auth/me', undefined, signupRes.body.data.token);
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.data.user.name, 'Test Customer');
});

test('REST API - Provider Endpoints', async () => {
  const app = createTestApp();
  const account = await createProviderAccount(app);

  // List all providers
  const listRes = await makeRequest(app, 'GET', '/api/providers');
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.data.length > 0);

  // Filter by category
  const hvacRes = await makeRequest(app, 'GET', '/api/providers?category=ac');
  assert.equal(hvacRes.status, 200);
  assert.ok(hvacRes.body.data.every((p: any) => p.category === 'ac'));

  // Get single provider
  const singleRes = await makeRequest(app, 'GET', '/api/providers/p_hvac_1');
  assert.equal(singleRes.status, 200);
  assert.equal(singleRes.body.data.name, 'Tariq Mehmood');

  // Toggle status
  const statusRes = await makeRequest(app, 'PATCH', `/api/providers/${account.provider.id}/status`, {
    isOnline: false,
  }, account.token);
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.body.data.isOnline, false);

  // Toggle back to online
  await makeRequest(app, 'PATCH', `/api/providers/${account.provider.id}/status`, {
    isOnline: true,
  }, account.token);
});

test('REST API - Dues Ledger Endpoints', async () => {
  const app = createTestApp();
  const account = await createProviderAccount(app);

  // Get dues
  const duesRes = await makeRequest(app, 'GET', '/api/dues', undefined, account.token);
  assert.equal(duesRes.status, 200);
  assert.ok(Array.isArray(duesRes.body.data.dues));
  const initialPending = duesRes.body.data.totalPendingAmount;

  // Add new due
  const createRes = await makeRequest(app, 'POST', '/api/dues', {
    providerId: account.provider.id,
    customerName: 'Haris Mehmood',
    customerPhone: '+92 312 3344556',
    serviceCategory: 'ac',
    amount: 3200,
    dueDate: '2026-04-01',
    notes: 'Inverter AC capacitor repair',
  }, account.token);
  assert.equal(createRes.status, 201);
  const newDueId = createRes.body.data.id;

  // Verify total pending increased
  const afterAdd = await makeRequest(app, 'GET', '/api/dues', undefined, account.token);
  assert.equal(afterAdd.body.data.totalPendingAmount, initialPending + 3200);

  // Mark as paid
  const payRes = await makeRequest(app, 'PATCH', `/api/dues/${newDueId}/pay`, undefined, account.token);
  assert.equal(payRes.status, 200);
  assert.equal(payRes.body.data.status, 'paid');

  // Verify total pending returned to initial
  const afterPay = await makeRequest(app, 'GET', '/api/dues', undefined, account.token);
  assert.equal(afterPay.body.data.totalPendingAmount, initialPending);
});

test('REST API - Job Queue & Lifecycle Endpoints', async () => {
  const app = createTestApp();
  const customer = await createAccount(app, 'customer');
  const unrelatedCustomer = await createAccount(app, 'customer');
  const providerAccount = await createProviderAccount(app);

  // Create job
  const createJobRes = await makeRequest(app, 'POST', '/api/jobs', {
    customerId: customer.user.id,
    customerName: 'Ahmed Hassan',
    providerId: providerAccount.provider.id,
    providerName: 'Tariq Mehmood',
    category: 'ac',
    status: 'dispatched',
    issueDescription: 'AC blowing warm air in lounge',
    urgency: 'urgent',
    location: { lat: 33.647, lng: 72.951 },
    sector: 'G-13',
    scheduledFor: 'Tomorrow, 11:00 AM',
    scheduledTimestamp: Date.now() + 86400000,
    estimatedFare: 2000,
  }, customer.token);

  assert.equal(createJobRes.status, 201);
  assert.equal(createJobRes.body.data.status, 'dispatched');
  const jobId = createJobRes.body.data.id;

  // Verify pending jobs for Tariq Mehmood
  const pendingRes = await makeRequest(app, 'GET', '/api/jobs/pending', undefined, providerAccount.token);
  assert.equal(pendingRes.status, 200);
  assert.ok(pendingRes.body.data.some((j: any) => j.id === jobId));

  // Provider accepts job
  const acceptRes = await makeRequest(app, 'POST', `/api/jobs/${jobId}/accept`, {
    reason: 'Karigar confirmed available slot and accepted',
  }, providerAccount.token);
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.body.data.status, 'accepted');

  const duplicateAcceptRes = await makeRequest(app, 'POST', `/api/jobs/${jobId}/accept`, {}, providerAccount.token);
  assert.equal(duplicateAcceptRes.status, 409);

  const customerStartRes = await makeRequest(app, 'PATCH', `/api/jobs/${jobId}/status`, {
    status: 'in_progress',
  }, customer.token);
  assert.equal(customerStartRes.status, 403);

  // A job cannot skip the in-progress state or be accepted twice.
  const invalidCompleteRes = await makeRequest(app, 'PATCH', `/api/jobs/${jobId}/status`, {
    status: 'completed',
  }, providerAccount.token);
  assert.equal(invalidCompleteRes.status, 409);
  assert.deepEqual(invalidCompleteRes.body.data.allowedStatuses, ['on_the_way', 'in_progress', 'cancelled']);

  const startRes = await makeRequest(app, 'PATCH', `/api/jobs/${jobId}/status`, {
    status: 'in_progress',
  }, providerAccount.token);
  assert.equal(startRes.status, 200);
  assert.equal(startRes.body.data.status, 'in_progress');

  const completeRes = await makeRequest(app, 'PATCH', `/api/jobs/${jobId}/status`, {
    status: 'completed',
  }, providerAccount.token);
  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.body.data.status, 'completed');

  const reviewRes = await makeRequest(app, 'POST', `/api/jobs/${jobId}/review`, {
    rating: 5,
    comment: 'Completed through the valid lifecycle',
  }, customer.token);
  assert.equal(reviewRes.status, 201);

  const unrelatedReviewRes = await makeRequest(
    app,
    'GET',
    `/api/jobs/${jobId}/review`,
    undefined,
    unrelatedCustomer.token,
  );
  assert.equal(unrelatedReviewRes.status, 403);

  const favoritesRes = await makeRequest(app, 'GET', '/api/jobs/favorites', undefined, customer.token);
  assert.equal(favoritesRes.status, 200);
  assert.deepEqual(favoritesRes.body.data, []);

  const missingFavoriteRes = await makeRequest(app, 'POST', '/api/jobs/favorites/toggle', {
    providerId: 'provider-does-not-exist',
  }, customer.token);
  assert.equal(missingFavoriteRes.status, 404);

  // Verify job moves to active queue
  const activeRes = await makeRequest(app, 'GET', '/api/jobs/active', undefined, providerAccount.token);
  assert.equal(activeRes.status, 200);
  assert.ok(!activeRes.body.data.some((j: any) => j.id === jobId));
});

test('REST API - Customer Cannot Forge Job Lifecycle State', async () => {
  const app = createTestApp();
  const customer = await createAccount(app, 'customer');
  const providerAccount = await createProviderAccount(app);

  const response = await makeRequest(app, 'POST', '/api/jobs', {
    customerId: customer.user.id,
    providerId: providerAccount.provider.id,
    category: 'ac',
    status: 'completed',
    issueDescription: 'Attempt to bypass provider lifecycle',
    location: { lat: 33.647, lng: 72.951 },
    sector: 'G-13',
    scheduledFor: 'Tomorrow',
    scheduledTimestamp: Date.now() + 86_400_000,
    estimatedFare: 1500,
  }, customer.token);

  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, 'dispatched');

  const review = await makeRequest(app, 'POST', `/api/jobs/${response.body.data.id}/review`, {
    rating: 5,
  }, customer.token);
  assert.equal(review.status, 409);
});

test('REST API - Live Job Dispatch SSE Stream', async () => {
  const app = createTestApp();
  const account = await createProviderAccount(app);

  await new Promise<void>((resolve) => {
    const server = app.listen(0, async () => {
      const address = server.address() as { port: number };
      const controller = new AbortController();

      const res = await fetch(`http://127.0.0.1:${address.port}/api/jobs/stream`, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${account.token}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'text/event-stream');

      // Abort connection and close
      controller.abort();
      server.close(() => {
        resolve();
      });
    });
  });
});
