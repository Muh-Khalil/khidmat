const base = 'http://127.0.0.1:5101';
const results = [];
let sequence = 0;

async function request(method, path, body, token, rawBody) {
  const started = performance.now();
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, ms: Math.round(performance.now() - started), headers: Object.fromEntries(response.headers) };
}

async function check(id, feature, expected, action, severity = 'Medium') {
  sequence += 1;
  try {
    const actual = await action();
    const pass = expected(actual);
    results.push({ id, feature, pass, severity, actual });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${feature} :: ${JSON.stringify(actual)}`);
    return actual;
  } catch (error) {
    results.push({ id, feature, pass: false, severity, actual: { error: String(error) } });
    console.log(`FAIL ${id} ${feature} :: ${String(error)}`);
  }
}

async function account(role, suffix) {
  const phone = `+92310${suffix.padStart(7, '0')}`;
  await request('POST', '/api/auth/phone/request', { phone });
  const verification = await request('POST', '/api/auth/phone/verify', { phone, code: '1234' });
  const signup = await request('POST', '/api/auth/signup', {
    name: role === 'provider' ? `QA Provider ${suffix}` : `QA Customer ${suffix}`,
    phone, password: '1234', role, sector: 'G-11',
    phoneVerificationToken: verification.data?.data?.phoneVerificationToken,
  });
  return signup.data.data;
}

await check('API-001', 'Health', x => x.status === 200 && x.data?.data?.status === 'ok', () => request('GET', '/health'));
await check('API-002', 'Unknown route JSON 404', x => x.status === 404 && x.data?.success === false, () => request('GET', '/does-not-exist'));
await check('AUTH-001', 'Protected endpoint without token', x => x.status === 401, () => request('GET', '/api/auth/me'));
await check('AUTH-002', 'Protected endpoint malformed token', x => x.status === 401, () => request('GET', '/api/auth/me', undefined, 'broken.token'));
await check('AUTH-003', 'Login missing fields', x => x.status === 400, () => request('POST', '/api/auth/login', {}));
await check('AUTH-004', 'Malformed JSON handling', x => x.status === 400 && !String(x.data).includes('<html'), () => request('POST', '/api/auth/login', undefined, undefined, '{bad json'));
await check('AUTH-005', 'Phone request invalid short number', x => x.status === 400, () => request('POST', '/api/auth/phone/request', { phone: '123' }));

const run = String(Date.now()).slice(-3);
const customerA = await account('customer', `2000${run}`);
const customerB = await account('customer', `3000${run}`);
const providerA = await account('provider', `4000${run}`);
const providerB = await account('provider', `5000${run}`);

const spoofedOnboard = await request('POST', '/api/providers/onboard', { userId: 'spoofed-user', category: 'ac', experienceYears: 1, hourlyRate: 300, coverageRadiusKm: 1, sector: 'G-11' }, providerA.token);
const onboardA = await request('POST', '/api/providers/onboard', { userId: providerA.user.id, category: 'ac', experienceYears: 1, hourlyRate: 300, coverageRadiusKm: 1, sector: 'G-11' }, providerA.token);
const onboardB = await request('POST', '/api/providers/onboard', { userId: providerB.user.id, category: 'ac', experienceYears: 50, hourlyRate: 20000, coverageRadiusKm: 100, sector: 'G-11' }, providerB.token);
await check('AUTHZ-001', 'Provider onboarding rejects spoofed userId', x => x.status === 403, async () => spoofedOnboard, 'High');
await check('VAL-001', 'Provider onboarding rejects boundary overflow', x => x.status === 400, () => request('POST', '/api/providers/onboard', { userId: providerA.user.id, category: 'ac', experienceYears: 51, hourlyRate: 20001, coverageRadiusKm: 101, sector: 'G-11' }, providerA.token));
await check('AUTHZ-002', 'Customer cannot access provider dues', x => x.status === 403, () => request('GET', '/api/dues', undefined, customerA.token));
await check('AUTHZ-003', 'Provider cannot create customer job', x => x.status === 403, () => request('POST', '/api/jobs', {}, providerA.token));

const jobPayload = { customerId: customerB.user.id, providerId: onboardA.data.data.id, category: 'ac', issueDescription: 'AC is not cooling', urgency: 'medium', location: { lat: 33.68, lng: 73.04 }, sector: 'G-11', scheduledFor: 'Tomorrow', scheduledTimestamp: Date.now() + 86400000, estimatedFare: 1500 };
const createdJob = await request('POST', '/api/jobs', jobPayload, customerA.token);
await check('AUTHZ-004', 'Job creation binds authenticated customer', x => x.status === 201 && x.data?.data?.customerId === customerA.user.id, async () => createdJob, 'High');
await check('AUTHZ-005', 'Other customer cannot read job', x => x.status === 403, () => request('GET', `/api/jobs/${createdJob.data.data.id}`, undefined, customerB.token), 'High');
await check('AUTHZ-006', 'Unassigned provider cannot accept job', x => x.status === 403, () => request('POST', `/api/jobs/${createdJob.data.data.id}/accept`, {}, providerB.token), 'High');
await check('STATE-001', 'Assigned provider accepts dispatched job', x => x.status === 200 && x.data?.data?.status === 'accepted', () => request('POST', `/api/jobs/${createdJob.data.data.id}/accept`, {}, providerA.token));
await check('STATE-002', 'Duplicate acceptance conflicts', x => x.status === 409, () => request('POST', `/api/jobs/${createdJob.data.data.id}/accept`, {}, providerA.token));
await check('AUTHZ-007', 'Customer cannot progress job', x => x.status === 403, () => request('PATCH', `/api/jobs/${createdJob.data.data.id}/status`, { status: 'in_progress' }, customerA.token), 'High');

const forgedCompleted = await request('POST', '/api/jobs', { ...jobPayload, status: 'completed' }, customerA.token);
await check('STATE-003', 'Server overrides forged completed state', x => x.status === 201 && x.data?.data?.status === 'dispatched', async () => forgedCompleted, 'High');
const forgedReview = forgedCompleted.status === 201 ? await request('POST', `/api/jobs/${forgedCompleted.data.data.id}/review`, { rating: 5, comment: 'Forged lifecycle review' }, customerA.token) : null;
await check('STATE-004', 'Forged completed job cannot create review', x => x === null || x.status !== 201, async () => forgedReview, 'High');
await check('AUTHZ-010', 'Unrelated customer cannot read another job review', x => x.status === 403 || x.status === 404, () => request('GET', `/api/jobs/${createdJob.data.data.id}/review`, undefined, customerB.token), 'Medium');

await check('ROUTE-001', 'Favorites list route reachable', x => x.status === 200 && Array.isArray(x.data?.data), () => request('GET', '/api/jobs/favorites', undefined, customerA.token), 'High');
await check('VAL-002', 'Favorite requires providerId', x => x.status === 400, () => request('POST', '/api/jobs/favorites/toggle', {}, customerA.token));
await check('VAL-003', 'Favorite rejects nonexistent provider', x => x.status === 404 || x.status === 400, () => request('POST', '/api/jobs/favorites/toggle', { providerId: 'does-not-exist' }, customerA.token), 'Medium');

const due = await request('POST', '/api/dues', { customerName: 'Unicode آزمائش 🔧', serviceCategory: 'ac', amount: 1 }, providerA.token);
await check('DUES-001', 'Due accepts minimum positive and Unicode', x => x.status === 201 && x.data?.data?.amount === 1, async () => due);
await check('DUES-002', 'Due rejects zero amount', x => x.status === 400, () => request('POST', '/api/dues', { customerName: 'AB', serviceCategory: 'ac', amount: 0 }, providerA.token));
await check('AUTHZ-008', 'Other provider cannot pay due', x => x.status === 404, () => request('PATCH', `/api/dues/${due.data.data.id}/pay`, {}, providerB.token), 'High');

await check('VAL-004', 'Service request rejects invalid coordinates', x => x.status === 400, () => request('POST', '/api/requests', { category: 'ac', issueDescription: 'broken ac', location: { lat: 91, lng: 181 }, sector: 'G-11', requestedStartAt: Date.now(), requestedTimeLabel: 'Now' }, customerA.token));
await check('VAL-005', 'Chat rejects empty message', x => x.status === 400, () => request('POST', '/chat', { message: '   ' }, customerA.token));
await check('AUTHZ-009', 'Provider cannot use customer chat', x => x.status === 403, () => request('POST', '/chat', { message: 'Need AC repair' }, providerA.token));
await check('SEC-001', 'CORS arbitrary origin behavior', x => !x.headers['access-control-allow-origin'] || x.headers['access-control-allow-origin'] !== '*', () => fetch(base + '/health', { headers: { Origin: 'https://evil.example' } }).then(async r => ({ status: r.status, headers: Object.fromEntries(r.headers), data: await r.json() })), 'Medium');

console.log('SUMMARY ' + JSON.stringify({ total: results.length, passed: results.filter(x => x.pass).length, failed: results.filter(x => !x.pass).length, maxMs: Math.max(...results.map(x => x.actual?.ms || 0)) }));
