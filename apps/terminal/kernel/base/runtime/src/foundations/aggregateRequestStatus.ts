import type {RequestLifecycleStatus} from '@catering-v2s/kernel-base-contracts';
import type {CommandAggregateStatus} from '../types/execution';

export const aggregateRequestStatus = (commandStatuses: readonly CommandAggregateStatus[]): RequestLifecycleStatus => {
  if (commandStatuses.some(status => status === 'running')) return 'started';
  if (commandStatuses.length === 0) return 'started';
  if (commandStatuses.some(status => status === 'partial-failed')) return 'partial-failed';
  if (
    commandStatuses.some(status => status === 'completed') &&
    commandStatuses.some(status => status === 'error' || status === 'timed-out')
  ) {
    return 'partial-failed';
  }
  if (commandStatuses.every(status => status === 'timed-out')) return 'timed-out';
  if (commandStatuses.some(status => status === 'error' || status === 'timed-out')) return 'error';
  return 'completed';
};
