import { Router, Request, Response } from 'express';
import { db } from '../db';
import { handleSuccess, handleError } from '../lib/responseHandler';
import { ProviderStatusSchema, ProviderLocationSchema, OnboardProviderSchema } from '../schemas/api';
import { requireAuth } from '../lib/auth';

export const providersRouter = Router();

// GET /api/providers
providersRouter.get('/', async (req: Request, res: Response) => {
  const category = req.query.category as string;
  if (category) {
    const list = await db.listProvidersByCategory(category);
    return handleSuccess(res, 200, `Providers for category ${category}`, list);
  }

  // Get sample list across all categories
  const categories = ['ac', 'plumber', 'electrician', 'tutor', 'beautician'];
  const allProviders = (
    await Promise.all(categories.map((cat) => db.listProvidersByCategory(cat)))
  ).flat();

  return handleSuccess(res, 200, 'All registered service providers', allProviders);
});

// GET /api/providers/me
providersRouter.get('/me', requireAuth(['provider']), async (_req: Request, res: Response) => {
  const provider = await db.getProviderByUserId(res.locals.auth.userId);

  if (!provider) {
    return handleError(res, 404, 'Provider profile not found');
  }

  const duesData = await db.listDuesByProvider(provider.id);
  const pendingJobs = await db.listPendingJobsForProvider(provider.id);
  const activeJobs = await db.listActiveJobsForProvider(provider.id);

  return handleSuccess(res, 200, 'Provider profile and metrics retrieved', {
    provider,
    metrics: {
      rating: provider.rating,
      totalJobs: provider.totalJobs,
      isOnline: provider.isOnline,
      pendingJobsCount: pendingJobs.length,
      activeJobsCount: activeJobs.length,
      pendingDuesCount: duesData.dues.filter((d) => d.status === 'pending').length,
      pendingDuesAmount: duesData.totalPendingAmount,
    },
  });
});

// PATCH /api/providers/me/status
providersRouter.patch('/me/status', requireAuth(['provider']), async (req: Request, res: Response) => {
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const providerId = provider.id;
  const parseResult = ProviderStatusSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid status data', parseResult.error.format());
  }

  const success = await db.updateProviderStatus(providerId, parseResult.data.isOnline);
  if (!success) {
    return handleError(res, 404, 'Provider not found', { id: providerId });
  }

  const updated = await db.getProviderById(providerId);
  return handleSuccess(res, 200, 'Provider status updated', updated);
});

// PATCH /api/providers/me/location
providersRouter.patch('/me/location', requireAuth(['provider']), async (req: Request, res: Response) => {
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const providerId = provider.id;
  const parseResult = ProviderLocationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid location coordinates', parseResult.error.format());
  }

  const { lat, lng } = parseResult.data;
  const success = await db.updateProviderLocation(providerId, lat, lng);
  if (!success) {
    return handleError(res, 404, 'Provider not found', { id: providerId });
  }

  const updated = await db.getProviderById(providerId);
  return handleSuccess(res, 200, 'Provider GPS location updated', updated);
});

// GET /api/providers/:id
providersRouter.get('/:id', async (req: Request, res: Response) => {
  const provider = await db.getProviderById(req.params.id);
  if (!provider) {
    return handleError(res, 404, 'Provider not found', { id: req.params.id });
  }

  return handleSuccess(res, 200, 'Provider details', provider);
});

// PATCH /api/providers/:id/status
providersRouter.patch('/:id/status', requireAuth(['provider']), async (req: Request, res: Response) => {
  const owned = await db.getProviderByUserId(res.locals.auth.userId);
  if (!owned || owned.id !== req.params.id) return handleError(res, 403, 'You can only change your own profile');
  const parseResult = ProviderStatusSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid status data', parseResult.error.format());
  }

  const success = await db.updateProviderStatus(req.params.id, parseResult.data.isOnline);
  if (!success) {
    return handleError(res, 404, 'Provider not found', { id: req.params.id });
  }

  const updated = await db.getProviderById(req.params.id);
  return handleSuccess(res, 200, 'Provider status updated', updated);
});

// PATCH /api/providers/:id/location
providersRouter.patch('/:id/location', requireAuth(['provider']), async (req: Request, res: Response) => {
  const owned = await db.getProviderByUserId(res.locals.auth.userId);
  if (!owned || owned.id !== req.params.id) return handleError(res, 403, 'You can only change your own profile');
  const parseResult = ProviderLocationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid location coordinates', parseResult.error.format());
  }

  const { lat, lng } = parseResult.data;
  const success = await db.updateProviderLocation(req.params.id, lat, lng);
  if (!success) {
    return handleError(res, 404, 'Provider not found', { id: req.params.id });
  }

  const updated = await db.getProviderById(req.params.id);
  return handleSuccess(res, 200, 'Provider GPS location updated', updated);
});

// POST /api/providers/onboard
providersRouter.post('/onboard', requireAuth(['provider']), async (req: Request, res: Response) => {
  const parseResult = OnboardProviderSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid provider setup data', parseResult.error.format());
  }

  const {
    userId,
    name,
    phone,
    category,
    experienceYears,
    hourlyRate,
    coverageRadiusKm,
    availableSlots,
    sector,
    coords,
  } = parseResult.data;
  if (userId !== res.locals.auth.userId) return handleError(res, 403, 'You can only create your own profile');

  // Resolve user info if missing
  let providerName = name;
  let providerPhone = phone;

  if (!providerName || !providerPhone) {
    const user = await db.getUserById(userId);
    if (user) {
      providerName = providerName || user.name;
      providerPhone = providerPhone || user.phone;
    }
  }

  const providerRecord = {
    id: `p_${category}_${userId.slice(-6)}`,
    userId,
    name: providerName || 'Karigar Pro',
    phone: providerPhone || '+92 300 0000000',
    category,
    experienceYears,
    rating: 5.0,
    totalJobs: 0,
    hourlyRate,
    serviceRadiusKm: coverageRadiusKm,
    location: coords || { lat: 33.684, lng: 73.048 },
    sector,
    isOnline: true,
    availableSlots,
  };

  const saved = await db.upsertProviderProfile(providerRecord);
  await db.activateProviderSourceReferences(saved.id);
  return handleSuccess(res, 201, 'Provider profile onboarded successfully', saved);
});
