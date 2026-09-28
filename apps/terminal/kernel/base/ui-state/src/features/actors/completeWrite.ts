import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {WorkspaceKey} from '@catering-v2s/kernel-base-state';

type UiStateWriteResult = Readonly<{
  readonly workspace: WorkspaceKey;
  readonly changed: boolean;
}>;

type UiStateWriteFamily = 'content' | 'variables';

export const completeUiStateWrite = async (
  context: ActorExecutionContext,
  result: UiStateWriteResult,
  family: UiStateWriteFamily,
): Promise<StateJsonValue> => {
  if (!result.changed) {
    return Object.freeze({
      changed: false,
      workspace: result.workspace,
      persistenceStatus: 'succeeded',
      persistenceFailureCount: 0,
    });
  }
  try {
    const persistence = await context.flushPersistence();
    if (persistence.status === 'succeeded') {
      return Object.freeze({
        changed: true,
        workspace: result.workspace,
        persistenceStatus: 'succeeded',
        persistenceFailureCount: 0,
      });
    }
    context.platformPorts.logger.error({
      category: 'ui-state',
      event: `ui-state.${family}.persistence-failed`,
      message: `UI ${family} changed in memory but persistence failed`,
      data: {workspace: result.workspace, failureCount: persistence.failures.length},
    });
    return Object.freeze({
      changed: true,
      workspace: result.workspace,
      persistenceStatus: 'failed',
      persistenceFailureCount: persistence.failures.length,
    });
  } catch (error) {
    context.platformPorts.logger.error({
      category: 'ui-state',
      event: `ui-state.${family}.persistence-rejected`,
      message: `UI ${family} changed in memory but persistence was rejected`,
      data: {workspace: result.workspace, errorType: error instanceof Error ? error.name : typeof error},
    });
    return Object.freeze({
      changed: true,
      workspace: result.workspace,
      persistenceStatus: 'failed',
      persistenceFailureCount: 1,
    });
  }
};
