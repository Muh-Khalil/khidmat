import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAuth } from '../lib/auth';
import { handleError, handleSuccess } from '../lib/responseHandler';
import { CreateProviderAppointmentSchema, CreateProviderCustomerSchema, UpdateProviderAppointmentSchema } from '../schemas/api';

export const crmRouter = Router();
crmRouter.use(requireAuth(['provider']));

async function ownedProvider(res: Response) {
  return db.getProviderByUserId(res.locals.auth.userId);
}

crmRouter.get('/customers', async (_req: Request, res: Response) => {
  const provider = await ownedProvider(res);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const [customers, dues, appointments] = await Promise.all([
    db.listProviderCustomers(provider.id), db.listDuesByProvider(provider.id), db.listProviderAppointments(provider.id),
  ]);
  const enriched = customers.map((customer) => ({ ...customer,
    pendingAmount: dues.dues.filter((due) => due.providerCustomerId === customer.id && due.status === 'pending').reduce((sum, due) => sum + due.amount, 0),
    appointmentCount: appointments.filter((appointment) => appointment.providerCustomerId === customer.id).length,
  }));
  return handleSuccess(res, 200, 'Provider customers retrieved', enriched);
});

crmRouter.post('/customers', async (req: Request, res: Response) => {
  const parsed = CreateProviderCustomerSchema.safeParse(req.body);
  if (!parsed.success) return handleError(res, 400, 'Please check customer details', parsed.error.format());
  const provider = await ownedProvider(res);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  return handleSuccess(res, 201, 'Customer saved', await db.createProviderCustomer({ providerId: provider.id, ...parsed.data }));
});

crmRouter.get('/appointments', async (_req: Request, res: Response) => {
  const provider = await ownedProvider(res);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const appointments = await db.listProviderAppointments(provider.id);
  const enriched = await Promise.all(appointments.map(async (appointment) => ({
    ...appointment, customer: await db.getProviderCustomerById(appointment.providerCustomerId),
  })));
  return handleSuccess(res, 200, 'Appointments retrieved', enriched);
});

crmRouter.post('/appointments', async (req: Request, res: Response) => {
  const parsed = CreateProviderAppointmentSchema.safeParse(req.body);
  if (!parsed.success) return handleError(res, 400, 'Please check job details', parsed.error.format());
  const provider = await ownedProvider(res);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const customer = await db.getProviderCustomerById(parsed.data.providerCustomerId);
  if (!customer || customer.providerId !== provider.id) return handleError(res, 404, 'Customer not found in your records');
  const { dueAmount, ...appointmentInput } = parsed.data;
  const appointment = await db.createProviderAppointment({ providerId: provider.id, ...appointmentInput,
    status: 'scheduled' });
  const due = dueAmount ? await db.createDue({ providerId: provider.id, providerCustomerId: customer.id,
    customerName: customer.name, customerPhone: customer.phone, serviceCategory: parsed.data.category,
    amount: dueAmount, status: 'pending', dueDate: new Date().toISOString().slice(0, 10),
    notes: parsed.data.description }) : null;
  return handleSuccess(res, 201, 'Offline job saved', { appointment, due });
});

crmRouter.patch('/appointments/:id', async (req: Request, res: Response) => {
  const parsed = UpdateProviderAppointmentSchema.safeParse(req.body);
  if (!parsed.success) return handleError(res, 400, 'Please check job status', parsed.error.format());
  const provider = await ownedProvider(res);
  if (!provider) return handleError(res, 404, 'Complete provider setup first');
  const appointment = (await db.listProviderAppointments(provider.id)).find((item) => item.id === req.params.id);
  if (!appointment) return handleError(res, 404, 'Appointment not found');
  if (appointment.status !== 'scheduled') return handleError(res, 409, 'This appointment is already closed');
  return handleSuccess(res, 200, 'Appointment updated',
    await db.updateProviderAppointmentStatus(appointment.id, parsed.data.status, parsed.data.finalAmount));
});
