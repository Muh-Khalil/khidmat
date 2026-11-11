import { Router, Request, Response } from 'express';
import { db } from '../db';
import { handleSuccess, handleError } from '../lib/responseHandler';
import { CreateJobSchema, UpdateJobStatusSchema } from '../schemas/api';
import { dispatchEmitter, notifyProviderOfJob, notifyCustomerOfJobUpdate } from '../lib/dispatchEvents';
import { initSSE, writeRawEvent } from '../lib/sse';
import { allowedJobTransitions, canTransitionJob } from '../lib/jobLifecycle';
import { requireAuth } from '../lib/auth';

export const jobsRouter = Router();

// Static routes must be registered before /:id so Express does not interpret
// "favorites" as a job ID.
jobsRouter.get('/favorites', requireAuth(['customer']), async (_req: Request, res: Response) => {
  const favorites = await db.listFavoritesByCustomer(res.locals.auth.userId);
  return handleSuccess(res, 200, 'Favorites retrieved', favorites);
});

// GET /api/jobs/stream - Live real-time SSE stream for Provider Dashboard
jobsRouter.get('/stream', requireAuth(['provider']), async (req: Request, res: Response) => {
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const providerId = provider.id;

  initSSE(res);

  // Send initial connection heartbeat
  writeRawEvent(res, { type: 'connected', providerId, timestamp: Date.now() });

  const onJobDispatched = (job: any) => {
    writeRawEvent(res, {
      type: 'new_job_alert',
      job,
      timestamp: Date.now(),
    });
  };

  const onLeadDispatched = (lead: any) => {
    writeRawEvent(res, { type: 'new_lead_alert', ...lead, timestamp: Date.now() });
  };

  const channel = `job:dispatched:${providerId}`;
  dispatchEmitter.on(channel, onJobDispatched);
  const leadChannel = `lead:dispatched:${providerId}`;
  dispatchEmitter.on(leadChannel, onLeadDispatched);

  req.on('close', () => {
    dispatchEmitter.off(channel, onJobDispatched);
    dispatchEmitter.off(leadChannel, onLeadDispatched);
    res.end();
  });
});

// GET /api/jobs/pending (must come before /:id)
jobsRouter.get('/pending', requireAuth(['provider']), async (_req: Request, res: Response) => {
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const providerId = provider.id;
  const jobs = await db.listPendingJobsForProvider(providerId);
  return handleSuccess(res, 200, `Pending jobs awaiting provider response`, jobs);
});

// GET /api/jobs/active (must come before /:id)
jobsRouter.get('/active', requireAuth(['provider']), async (_req: Request, res: Response) => {
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const providerId = provider.id;
  const jobs = await db.listActiveJobsForProvider(providerId);
  return handleSuccess(res, 200, `Active jobs in progress`, jobs);
});

// GET /api/jobs
jobsRouter.get('/', requireAuth(), async (_req: Request, res: Response) => {
  const auth = res.locals.auth;
  if (auth.role === 'customer') {
    const customerJobs = await db.listJobsByCustomer(auth.userId);
    return handleSuccess(res, 200, 'Customer jobs retrieved', customerJobs);
  }
  const provider = await db.getProviderByUserId(auth.userId);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const activeJobs = await db.listActiveJobsForProvider(provider.id);
  const pendingJobs = await db.listPendingJobsForProvider(provider.id);
  return handleSuccess(res, 200, 'Provider jobs retrieved', [...activeJobs, ...pendingJobs]);
});

// GET /api/jobs/:id
jobsRouter.get('/:id', requireAuth(), async (req: Request, res: Response) => {
  const job = await db.getJobById(req.params.id);
  if (!job) {
    return handleError(res, 404, 'Job not found', { id: req.params.id });
  }
  const auth = res.locals.auth;
  const provider = auth.role === 'provider' ? await db.getProviderByUserId(auth.userId) : null;
  if (job.customerId !== auth.userId && job.providerId !== provider?.id) {
    return handleError(res, 403, 'You cannot view this job');
  }
  const auditLogs = await db.listAuditLogsForJob(req.params.id);

  return handleSuccess(res, 200, 'Job details retrieved', {
    job,
    auditLogs,
  });
});

// POST /api/jobs
jobsRouter.post('/', requireAuth(['customer']), async (req: Request, res: Response) => {
  const parseResult = CreateJobSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid job request data', parseResult.error.format());
  }

  const provider = parseResult.data.providerId
    ? await db.getProviderById(parseResult.data.providerId)
    : null;
  if (parseResult.data.providerId && !provider) {
    return handleError(res, 400, 'Selected provider does not exist');
  }

  // Lifecycle state is server-owned. A direct assignment is dispatched;
  // an unassigned request starts in the requested state.
  const newJob = await db.createJob({
    ...parseResult.data,
    customerId: res.locals.auth.userId,
    status: provider ? 'dispatched' : 'requested',
  });
  notifyProviderOfJob(newJob);

  return handleSuccess(res, 201, 'Job created successfully', newJob);
});

// POST /api/jobs/:id/accept
jobsRouter.post('/:id/accept', requireAuth(['provider']), async (req: Request, res: Response) => {
  const job = await db.getJobById(req.params.id);
  if (!job) {
    return handleError(res, 404, 'Job not found', { id: req.params.id });
  }
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider || job.providerId !== provider.id) return handleError(res, 403, 'This job was not sent to you');
  if (!canTransitionJob(job.status, 'accepted')) {
    return handleError(res, 409, 'This request can no longer be accepted', {
      currentStatus: job.status,
      allowedStatuses: allowedJobTransitions(job.status),
    });
  }

  const updated = await db.updateJobStatus(req.params.id, 'accepted', {
    explainabilityRationale: req.body.reason || 'Provider accepted incoming service request',
  });

  if (updated) {
    notifyCustomerOfJobUpdate(updated);
  }

  return handleSuccess(res, 200, 'Job accepted by service provider', updated);
});

// POST /api/jobs/:id/decline
jobsRouter.post('/:id/decline', requireAuth(['provider']), async (req: Request, res: Response) => {
  const job = await db.getJobById(req.params.id);
  if (!job) {
    return handleError(res, 404, 'Job not found', { id: req.params.id });
  }
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider || job.providerId !== provider.id) return handleError(res, 403, 'This job was not sent to you');
  if (!canTransitionJob(job.status, 'declined')) {
    return handleError(res, 409, 'This request can no longer be declined', {
      currentStatus: job.status,
      allowedStatuses: allowedJobTransitions(job.status),
    });
  }

  const updated = await db.updateJobStatus(req.params.id, 'declined', {
    explainabilityRationale: req.body.reason || 'Provider unavailable for requested slot',
  });

  if (updated) {
    notifyCustomerOfJobUpdate(updated);
  }

  return handleSuccess(res, 200, 'Job declined by service provider', updated);
});

// PATCH /api/jobs/:id/status
jobsRouter.patch('/:id/status', requireAuth(), async (req: Request, res: Response) => {
  const parseResult = UpdateJobStatusSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid status update', parseResult.error.format());
  }

  const { status, finalFare, explainabilityRationale } = parseResult.data;
  const current = await db.getJobById(req.params.id);
  if (!current) {
    return handleError(res, 404, 'Job not found', { id: req.params.id });
  }
  const auth = res.locals.auth;
  const provider = auth.role === 'provider' ? await db.getProviderByUserId(auth.userId) : null;
  const isCustomerOwner = current.customerId === auth.userId;
  const isProviderOwner = current.providerId === provider?.id;
  if (!isCustomerOwner && !isProviderOwner) return handleError(res, 403, 'You cannot change this job');
  if (isCustomerOwner && status !== 'cancelled') {
    return handleError(res, 403, 'Customers can only cancel a booking');
  }
  if (!canTransitionJob(current.status, status)) {
    return handleError(res, 409, 'This job cannot move to that status', {
      currentStatus: current.status,
      requestedStatus: status,
      allowedStatuses: allowedJobTransitions(current.status),
    });
  }
  const updated = await db.updateJobStatus(req.params.id, status, {
    finalFare,
    explainabilityRationale,
  });

  if (!updated) {
    return handleError(res, 404, 'Job not found', { id: req.params.id });
  }

  notifyCustomerOfJobUpdate(updated);

  return handleSuccess(res, 200, `Job status updated to ${status}`, updated);
});

// POST /api/jobs/:id/on_the_way - Provider marks that they are en route
jobsRouter.post('/:id/on_the_way', requireAuth(['provider']), async (req: Request, res: Response) => {
  const current = await db.getJobById(req.params.id);
  if (!current) return handleError(res, 404, 'Job not found');
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider || current.providerId !== provider.id) return handleError(res, 403, 'This job is not assigned to you');

  if (!canTransitionJob(current.status, 'on_the_way')) {
    return handleError(res, 409, 'Cannot transition to on_the_way from current status', { currentStatus: current.status });
  }

  const updated = await db.updateJobStatus(req.params.id, 'on_the_way', {
    explainabilityRationale: 'Karigar raste mein hai (En route)',
  });
  if (updated) notifyCustomerOfJobUpdate(updated);
  return handleSuccess(res, 200, 'Customer notified: Karigar raste mein hai', updated);
});

// POST /api/jobs/:id/review - Customer submits 1-5 star review with 1-tap preset chips
jobsRouter.post('/:id/review', requireAuth(['customer']), async (req: Request, res: Response) => {
  const { CreateReviewSchema } = await import('../schemas/api');
  const parsed = CreateReviewSchema.safeParse(req.body);
  if (!parsed.success) return handleError(res, 400, 'Invalid review payload', parsed.error.format());

  const job = await db.getJobById(req.params.id);
  if (!job) return handleError(res, 404, 'Job not found');
  if (job.customerId !== res.locals.auth.userId) return handleError(res, 403, 'Only the customer can review this job');
  if (job.status !== 'completed') return handleError(res, 409, 'Only completed jobs can be reviewed');
  if (!job.providerId) return handleError(res, 400, 'No provider associated with this job');

  const existingReview = await db.getReviewByJobId(job.id);
  if (existingReview) return handleError(res, 409, 'This job has already been reviewed');

  const review = await db.createJobReview({
    jobId: job.id,
    customerId: res.locals.auth.userId,
    providerId: job.providerId,
    rating: parsed.data.rating,
    presetTags: parsed.data.presetTags,
    comment: parsed.data.comment,
  });

  return handleSuccess(res, 201, 'Review submitted successfully! Shukriya!', review);
});

// GET /api/jobs/:id/review
jobsRouter.get('/:id/review', requireAuth(), async (req: Request, res: Response) => {
  const job = await db.getJobById(req.params.id);
  if (!job) return handleError(res, 404, 'Job not found');
  const auth = res.locals.auth;
  const provider = auth.role === 'provider' ? await db.getProviderByUserId(auth.userId) : null;
  if (job.customerId !== auth.userId && job.providerId !== provider?.id) {
    return handleError(res, 403, 'You cannot view this review');
  }
  const review = await db.getReviewByJobId(req.params.id);
  return handleSuccess(res, 200, review ? 'Review retrieved' : 'No review for this job', review);
});

// POST /api/jobs/:id/complaint - Customer reports issue or requests rework
jobsRouter.post('/:id/complaint', requireAuth(['customer']), async (req: Request, res: Response) => {
  const { CreateComplaintSchema } = await import('../schemas/api');
  const parsed = CreateComplaintSchema.safeParse(req.body);
  if (!parsed.success) return handleError(res, 400, 'Invalid complaint payload', parsed.error.format());

  const job = await db.getJobById(req.params.id);
  if (!job) return handleError(res, 404, 'Job not found');
  if (job.customerId !== res.locals.auth.userId) return handleError(res, 403, 'Only the customer can raise an issue for this job');
  if (!job.providerId) return handleError(res, 400, 'No provider associated with this job');

  const complaint = await db.createJobComplaint({
    jobId: job.id,
    customerId: res.locals.auth.userId,
    providerId: job.providerId,
    category: parsed.data.category,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });

  return handleSuccess(res, 201, 'Shikayat darj kar li gayi hai. Khidmat support jald rabta karegi.', complaint);
});

// POST /api/jobs/favorites/toggle - Toggle favorite provider
jobsRouter.post('/favorites/toggle', requireAuth(['customer']), async (req: Request, res: Response) => {
  const providerId = req.body.providerId;
  if (!providerId) return handleError(res, 400, 'providerId is required');
  const provider = await db.getProviderById(providerId);
  if (!provider) return handleError(res, 404, 'Provider not found');

  const isFavorited = await db.toggleFavoriteProvider(res.locals.auth.userId, providerId);
  return handleSuccess(res, 200, isFavorited ? 'Favorite karigar shamil ho gaya ❤️' : 'Favorite se hata diya gaya', {
    providerId,
    isFavorited,
  });
});
