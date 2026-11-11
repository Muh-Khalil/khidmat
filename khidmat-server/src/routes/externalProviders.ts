import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAuth } from '../lib/auth';
import { createClaimProof, externalProviderSource, maskPhone, verifyClaimProof } from '../lib/externalProviders';
import { phoneVerification } from '../lib/phoneVerification';
import { handleError, handleSuccess } from '../lib/responseHandler';
import { CompleteProviderClaimSchema, DiscoverExternalProvidersSchema, StartProviderClaimSchema } from '../schemas/api';

export const externalProvidersRouter = Router();

externalProvidersRouter.get('/discover', requireAuth(), async (req: Request, res: Response) => {
  const parsed = DiscoverExternalProvidersSchema.safeParse(req.query);
  if (!parsed.success) return handleError(res, 400, 'Please check category and location', parsed.error.format());
  try {
    const listings = await externalProviderSource.search({ category: parsed.data.category,
      location: { lat: parsed.data.lat, lng: parsed.data.lng }, radiusMeters: parsed.data.radiusMeters });
    const visible = [];
    for (const listing of listings) {
      const ref = await db.getProviderSourceReference(listing.source, listing.externalId);
      if (!ref?.providerId) visible.push(listing);
    }
    return handleSuccess(res, 200, visible.length ? 'External listings retrieved' : 'No external listings available', {
      listings: visible, dataPolicy: 'Results are fetched live and are not stored by Khidmat', attribution: 'Google Maps',
    });
  } catch {
    return handleError(res, 503, 'External provider search is temporarily unavailable');
  }
});

externalProvidersRouter.post('/claims/start', requireAuth(['provider']), async (req: Request, res: Response) => {
  const parsed = StartProviderClaimSchema.safeParse(req.body);
  if (!parsed.success) return handleError(res, 400, 'Please check the business selection', parsed.error.format());
  try {
    const listing = await externalProviderSource.getById(parsed.data.externalId, parsed.data.category);
    if (!listing) return handleError(res, 404, 'External business listing not found');
    if (!listing.phone) return handleError(res, 409, 'This listing has no public phone number; manual review is required');
    const existing = await db.getProviderSourceReference(listing.source, listing.externalId);
    if (existing?.providerId) return handleError(res, 409, 'This business has already been claimed');
    if (existing?.claimedByUserId && existing.claimedByUserId !== res.locals.auth.userId) {
      return handleError(res, 409, 'A claim for this business is already being verified');
    }
    await phoneVerification.start(listing.phone);
    await db.upsertProviderSourceReference({ source: listing.source, externalId: listing.externalId,
      claimedByUserId: res.locals.auth.userId, status: 'CLAIMED' });
    return handleSuccess(res, 200, 'Code sent to the business phone', {
      claimToken: createClaimProof({ source: listing.source, externalId: listing.externalId, category: listing.category }),
      phone: maskPhone(listing.phone), expiresInSeconds: 600,
    });
  } catch (error: any) {
    if (error?.message === 'WAIT_BEFORE_RESEND') return handleError(res, 429, 'Please wait before requesting another code');
    return handleError(res, 503, 'Could not start business verification');
  }
});

externalProvidersRouter.post('/claims/complete', requireAuth(['provider']), async (req: Request, res: Response) => {
  const parsed = CompleteProviderClaimSchema.safeParse(req.body);
  if (!parsed.success) return handleError(res, 400, 'Please check the verification code', parsed.error.format());
  const proof = verifyClaimProof(parsed.data.claimToken);
  if (!proof) return handleError(res, 400, 'Claim session expired; start again');
  const ref = await db.getProviderSourceReference(proof.source, proof.externalId);
  if (!ref || ref.claimedByUserId !== res.locals.auth.userId || ref.status !== 'CLAIMED') {
    return handleError(res, 403, 'This claim does not belong to your account');
  }
  try {
    const listing = await externalProviderSource.getById(proof.externalId, proof.category);
    if (!listing?.phone) return handleError(res, 409, 'Business phone is no longer available');
    if (!(await phoneVerification.check(listing.phone, parsed.data.code))) return handleError(res, 400, 'Code is incorrect or expired');
    const current = await db.getProviderByUserId(res.locals.auth.userId);
    const provider = await db.upsertProviderProfile({ id: current?.id || `p_${proof.category}_${res.locals.auth.userId.slice(-6)}`,
      userId: res.locals.auth.userId, name: listing.name, phone: listing.phone, category: proof.category,
      experienceYears: current?.experienceYears || 1, rating: current?.rating || 5, totalJobs: current?.totalJobs || 0,
      hourlyRate: current?.hourlyRate || 1000, serviceRadiusKm: current?.serviceRadiusKm || 10,
      location: listing.location, sector: listing.address || current?.sector || 'Pakistan', isOnline: false,
      availableSlots: current?.availableSlots || [] });
    const source = await db.upsertProviderSourceReference({ source: proof.source, externalId: proof.externalId,
      providerId: provider.id, claimedByUserId: res.locals.auth.userId, status: 'VERIFIED' });
    return handleSuccess(res, 201, 'Business ownership verified; complete your profile to go active', { provider, source });
  } catch {
    return handleError(res, 503, 'Could not complete business verification');
  }
});
