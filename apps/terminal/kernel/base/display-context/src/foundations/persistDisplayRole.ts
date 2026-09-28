import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {logDisplayError} from './displayErrors';

export type DisplayPersistenceStatus = 'succeeded' | 'failed';

export const persistDisplayRole = async (
  context: ActorExecutionContext,
): Promise<
  Readonly<{
    persistenceStatus: DisplayPersistenceStatus;
    persistenceFailureCount: number;
  }>
> => {
  try {
    const result = await context.flushPersistence();
    if (result.status === 'succeeded') {
      return Object.freeze({persistenceStatus: 'succeeded', persistenceFailureCount: 0});
    }
    logDisplayError({
      context,
      event: 'display-role.persistence-failed',
      message: 'Display role changed in memory but persistence failed',
      data: {failureCount: result.failures.length},
    });
    return Object.freeze({
      persistenceStatus: 'failed' as const,
      persistenceFailureCount: result.failures.length,
    });
  } catch (error) {
    logDisplayError({
      context,
      event: 'display-role.persistence-rejected',
      message: 'Display role changed in memory but persistence rejected',
      data: {errorType: error instanceof Error ? error.name : typeof error},
    });
    return Object.freeze({persistenceStatus: 'failed' as const, persistenceFailureCount: 1});
  }
};
