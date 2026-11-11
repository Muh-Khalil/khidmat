import { db, JobUrgency, ServiceCategory, ServiceRequestRecord } from '../db';
import { notifyProviderOfLead } from './dispatchEvents';

const INITIAL_SHORTLIST_SIZE = 3;
const NEXT_WAVE_SIZE = 2;
const MAX_DISPATCHES = 7;

export type NewMarketplaceRequest = {
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  category: ServiceCategory;
  issueDescription: string;
  urgency: JobUrgency;
  location: { lat: number; lng: number };
  sector: string;
  requestedStartAt: number;
  requestedTimeLabel: string;
};

function responseWindowMinutes(urgency: JobUrgency): number {
  return urgency === 'urgent' ? 10 : urgency === 'medium' ? 30 : 60;
}

export async function dispatchWave(request: ServiceRequestRecord, wave: number): Promise<number> {
  const existing = await db.listDispatchesForRequest(request.id);
  if (existing.length >= MAX_DISPATCHES) return 0;
  const excluded = new Set(existing.map((dispatch) => dispatch.providerId));
  const candidates = await db.searchAndRankProviders({
    category: request.category,
    userCoords: request.location,
    radiusMeters: 100_000,
    limit: 30,
  });
  const limit = wave === 1 ? INITIAL_SHORTLIST_SIZE : NEXT_WAVE_SIZE;
  const shortlist = candidates
    .filter(({ provider, distanceKm }) => !excluded.has(provider.id) && distanceKm <= provider.serviceRadiusKm)
    .slice(0, Math.min(limit, MAX_DISPATCHES - existing.length));

  for (let index = 0; index < shortlist.length; index += 1) {
    const candidate = shortlist[index];
    const dispatch = await db.createRequestDispatch({
      requestId: request.id,
      providerId: candidate.provider.id,
      wave,
      rank: existing.length + index + 1,
      compositeScore: candidate.compositeScore,
      distanceKm: candidate.distanceKm,
      rationale: `${candidate.distanceKm} km away • ${candidate.provider.rating.toFixed(1)} rating • Available now`,
      status: 'pending',
    });
    notifyProviderOfLead(dispatch, request);
  }
  return shortlist.length;
}

export async function createMarketplaceRequest(input: NewMarketplaceRequest) {
  const request = await db.createServiceRequest({
    ...input,
    status: 'collecting_responses',
    responseDeadlineAt: new Date(Date.now() + responseWindowMinutes(input.urgency) * 60_000),
  });
  const dispatchedCount = await dispatchWave(request, 1);
  return { request, dispatchedCount };
}

export async function respondToDispatch(
  dispatchId: string,
  providerId: string,
  response: {
    available: boolean;
    proposedStartAt?: number;
    proposedTimeLabel?: string;
    amount?: number;
    priceType?: 'visit_fee' | 'estimate' | 'fixed_quote';
    message?: string;
  },
) {
  const dispatch = await db.getDispatchById(dispatchId);
  if (!dispatch) throw new Error('DISPATCH_NOT_FOUND');
  if (dispatch.providerId !== providerId) throw new Error('DISPATCH_FORBIDDEN');
  if (dispatch.status !== 'pending') throw new Error('DISPATCH_ALREADY_RESPONDED');
  const request = await db.getServiceRequestById(dispatch.requestId);
  if (!request || ['booked', 'cancelled', 'expired'].includes(request.status)) throw new Error('REQUEST_CLOSED');

  const saved = await db.createProviderResponse({
    requestId: dispatch.requestId,
    dispatchId,
    providerId,
    ...response,
    validUntil: response.available ? request.responseDeadlineAt : undefined,
  });

  if (!response.available) {
    const dispatches = await db.listDispatchesForRequest(request.id);
    const currentWave = dispatches.filter((item) => item.wave === dispatch.wave);
    if (currentWave.length > 0 && currentWave.every((item) => item.status !== 'pending')) {
      const responses = await db.listResponsesForRequest(request.id);
      if (!responses.some((item) => item.available)) await dispatchWave(request, dispatch.wave + 1);
    }
  }
  return saved;
}
