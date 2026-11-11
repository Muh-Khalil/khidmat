import { Router, Request, Response } from 'express';
import { db } from '../db';
import { handleSuccess, handleError } from '../lib/responseHandler';
import { CreateDueSchema } from '../schemas/api';
import { requireAuth } from '../lib/auth';

export const duesRouter = Router();

// GET /api/dues
duesRouter.get('/', requireAuth(['provider']), async (_req: Request, res: Response) => {
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const providerId = provider.id;

  const { dues, totalPendingAmount } = await db.listDuesByProvider(providerId);

  return handleSuccess(res, 200, `Dues ledger retrieved for provider ${providerId}`, {
    dues,
    totalPendingAmount,
    totalRecords: dues.length,
  });
});

// POST /api/dues
duesRouter.post('/', requireAuth(['provider']), async (req: Request, res: Response) => {
  const parseResult = CreateDueSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid dues record data', parseResult.error.format());
  }

  const { customerId, providerCustomerId, customerName, customerPhone, serviceCategory, jobId, amount, dueDate, notes } =
    parseResult.data;
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');

  const newDue = await db.createDue({
    providerId: provider.id,
    customerId,
    providerCustomerId,
    customerName,
    customerPhone,
    serviceCategory,
    jobId,
    amount,
    status: 'pending',
    dueDate: dueDate || new Date().toISOString().split('T')[0],
    notes,
  });

  return handleSuccess(res, 201, 'Customer due record created in ledger', newDue);
});

// PATCH /api/dues/:id/pay
duesRouter.patch('/:id/pay', requireAuth(['provider']), async (req: Request, res: Response) => {
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const existing = (await db.listDuesByProvider(provider.id)).dues.find((item) => item.id === req.params.id);
  if (!existing) return handleError(res, 404, 'Due record not found', { id: req.params.id });
  const due = await db.markDueAsPaid(req.params.id);
  if (!due) {
    return handleError(res, 404, 'Due record not found', { id: req.params.id });
  }

  return handleSuccess(res, 200, 'Customer due marked as paid', due);
});

// DELETE /api/dues/:id
duesRouter.delete('/:id', requireAuth(['provider']), async (req: Request, res: Response) => {
  const provider = await db.getProviderByUserId(res.locals.auth.userId);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const existing = (await db.listDuesByProvider(provider.id)).dues.find((item) => item.id === req.params.id);
  if (!existing) return handleError(res, 404, 'Due record not found', { id: req.params.id });
  const success = await db.deleteDue(req.params.id);
  if (!success) {
    return handleError(res, 404, 'Due record not found or already deleted', { id: req.params.id });
  }

  return handleSuccess(res, 200, 'Due record removed successfully', { id: req.params.id });
});
