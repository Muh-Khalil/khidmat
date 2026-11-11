import { EventEmitter } from 'events';
import { JobRecord, RequestDispatchRecord, ServiceRequestRecord } from '../db/types';
import { logger } from './logger';

class JobDispatchEmitter extends EventEmitter {}

export const dispatchEmitter = new JobDispatchEmitter();

// Increase max listeners for multiple simultaneous mobile client connections
dispatchEmitter.setMaxListeners(100);

export function notifyProviderOfJob(job: JobRecord): void {
  if (!job.providerId) return;

  logger.info(`Dispatching job alert for job ${job.id} to provider ${job.providerId}`);
  dispatchEmitter.emit(`job:dispatched:${job.providerId}`, job);
  // Also emit to a global channel for admins/dashboard monitors
  dispatchEmitter.emit('job:dispatched', job);
}

export function notifyCustomerOfJobUpdate(job: JobRecord): void {
  logger.info(`Job ${job.id} status updated to ${job.status}`);
  dispatchEmitter.emit(`job:updated:${job.id}`, job);
  dispatchEmitter.emit(`customer:job:updated:${job.customerId}`, job);
}

export function notifyProviderOfLead(dispatch: RequestDispatchRecord, request: ServiceRequestRecord): void {
  logger.info(`Dispatching marketplace lead ${dispatch.id} to provider ${dispatch.providerId}`);
  dispatchEmitter.emit(`lead:dispatched:${dispatch.providerId}`, { dispatch, request });
}
