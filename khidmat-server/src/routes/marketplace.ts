import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAuth } from '../lib/auth';
import { handleError, handleSuccess } from '../lib/responseHandler';
import { CreateServiceRequestSchema, RespondToLeadSchema } from '../schemas/api';
import { createMarketplaceRequest, respondToDispatch } from '../lib/marketplace';
import { notifyProviderOfJob } from '../lib/dispatchEvents';

export const requestsRouter = Router();
export const leadsRouter = Router();

requestsRouter.post('/', requireAuth(['customer']), async (req: Request, res: Response) => {
  const parsed = CreateServiceRequestSchema.safeParse(req.body);
  if (!parsed.success) return handleError(res, 400, 'Please check the service request', parsed.error.format());
  const user = await db.getUserById(res.locals.auth.userId);
  if (!user) return handleError(res, 401, 'Please sign in again');
  const result = await createMarketplaceRequest({
    ...parsed.data,
    customerId: user.id,
    customerName: user.name,
    customerPhone: user.phone,
  });
  return handleSuccess(res, 201,
    result.dispatchedCount > 0 ? `Request sent to ${result.dispatchedCount} nearby providers` : 'Request saved; no available provider found yet',
    result,
  );
});

requestsRouter.get('/', requireAuth(['customer']), async (_req: Request, res: Response) => {
  const requests = await db.listServiceRequestsByCustomer(res.locals.auth.userId);
  const result = await Promise.all(requests.map(async (request) => ({
    ...request,
    responseCount: (await db.listResponsesForRequest(request.id)).filter((response) => response.available).length,
  })));
  return handleSuccess(res, 200, 'Service requests retrieved', result);
});

requestsRouter.get('/:id', requireAuth(['customer']), async (req: Request, res: Response) => {
  const request = await db.getServiceRequestById(req.params.id);
  if (!request) return handleError(res, 404, 'Service request not found');
  if (request.customerId !== res.locals.auth.userId) return handleError(res, 403, 'You cannot view this request');
  const responses = await db.listResponsesForRequest(request.id);
  const offers = await Promise.all(responses.filter((item) => item.available).map(async (response) => ({
    ...response,
    provider: await db.getProviderById(response.providerId),
  })));
  return handleSuccess(res, 200, 'Provider responses retrieved', { request, offers });
});

requestsRouter.post('/:id/responses/:responseId/accept', requireAuth(['customer']), async (req: Request, res: Response) => {
  const request = await db.getServiceRequestById(req.params.id);
  if (!request) return handleError(res, 404, 'Service request not found');
  if (request.customerId !== res.locals.auth.userId) return handleError(res, 403, 'You cannot select for this request');
  const responses = await db.listResponsesForRequest(request.id);
  if (!responses.some((response) => response.id === req.params.responseId)) {
    return handleError(res, 404, 'Provider response not found for this request');
  }
  const job = await db.acceptResponseAndCreateJob(req.params.responseId, res.locals.auth.userId);
  if (!job) return handleError(res, 409, 'This provider response can no longer be selected');
  notifyProviderOfJob(job);
  return handleSuccess(res, 201, 'Provider selected and booking created', job);
});

requestsRouter.post('/:id/cancel', requireAuth(['customer']), async (req: Request, res: Response) => {
  const request = await db.getServiceRequestById(req.params.id);
  if (!request) return handleError(res, 404, 'Service request not found');
  if (request.customerId !== res.locals.auth.userId) return handleError(res, 403, 'You cannot cancel this request');
  if (!['collecting_responses', 'ready_to_choose'].includes(request.status)) {
    return handleError(res, 409, 'This request can no longer be cancelled');
  }
  return handleSuccess(res, 200, 'Request cancelled', await db.updateServiceRequestStatus(request.id, 'cancelled'));
});

leadsRouter.get('/', requireAuth(['provider']), async (_req: Request, res: Response) => {
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const dispatches = await db.listPendingDispatchesForProvider(provider.id);
  const leads = (await Promise.all(dispatches.map(async (dispatch) => ({
    dispatch,
    request: await db.getServiceRequestById(dispatch.requestId),
  })))).filter((lead) => lead.request !== null);
  return handleSuccess(res, 200, 'New customer requests retrieved', leads);
});

leadsRouter.post('/:dispatchId/respond', requireAuth(['provider']), async (req: Request, res: Response) => {
  const parsed = RespondToLeadSchema.safeParse(req.body);
  if (!parsed.success) return handleError(res, 400, 'Please check your response', parsed.error.format());
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  try {
    const response = await respondToDispatch(req.params.dispatchId, provider.id, parsed.data);
    return handleSuccess(res, 201, parsed.data.available ? 'Response sent to customer' : 'Request declined', response);
  } catch (error: any) {
    if (error?.message === 'DISPATCH_NOT_FOUND') return handleError(res, 404, 'Customer request not found');
    if (error?.message === 'DISPATCH_FORBIDDEN') return handleError(res, 403, 'This request was not sent to you');
    return handleError(res, 409, 'This request can no longer be answered');
  }
});
