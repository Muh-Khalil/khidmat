import type { JobStatus } from '../db/types';

const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  requested: ['matched', 'cancelled'],
  matched: ['dispatched', 'cancelled'],
  dispatched: ['accepted', 'declined', 'cancelled'],
  accepted: ['on_the_way', 'in_progress', 'cancelled'],
  on_the_way: ['in_progress', 'cancelled'],
  declined: [],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function allowedJobTransitions(from: JobStatus): readonly JobStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
