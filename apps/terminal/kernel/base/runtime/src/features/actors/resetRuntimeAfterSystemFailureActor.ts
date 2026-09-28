import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {defineActor, onCommand} from '../../foundations/defineActor';
import {moduleName} from '../../moduleName';
import {defaultCommandTimeoutMs} from '../../types/limits';
import {resetRuntimeAfterSystemFailureCommand} from '../commands/resetRuntimeAfterSystemFailure';

export type ResetRuntimeAfterSystemFailureOutcome = Readonly<{
  readonly status: 'accepted' | 'unavailable' | 'failed' | 'timed-out';
}>;

export const createResetRuntimeAfterSystemFailureActor = () =>
  defineActor(moduleName, 'reset-runtime-after-system-failure', [
    onCommand(resetRuntimeAfterSystemFailureCommand, async context => {
      const requestId = context.command.requestId ?? createRequestId();
      const logger = context.platformPorts.logger.withContext({
        commandId: context.command.commandId,
        commandName: context.command.commandName,
        nodeId: context.localNodeId,
        requestId,
      });

      try {
        const result = await context.platformPorts.appControl.resetRuntime({
          requestId,
          timeoutMs: defaultCommandTimeoutMs,
        });
        if (result.status === 'accepted') {
          logger.info({
            category: 'runtime.system-failure',
            event: 'runtime.system-failure.reset-accepted',
            message: 'JavaScript runtime reset was accepted',
            data: {portStatus: result.status},
          });
          return Object.freeze({status: 'accepted'} satisfies ResetRuntimeAfterSystemFailureOutcome);
        }

        const status = result.status === 'unavailable' || result.status === 'timed-out' ? result.status : 'failed';
        logger.error({
          category: 'runtime.system-failure',
          event:
            status === 'unavailable'
              ? 'runtime.system-failure.reset-unavailable'
              : 'runtime.system-failure.reset-failed',
          message: 'JavaScript runtime reset was not accepted',
          data: {portStatus: result.status},
        });
        return Object.freeze({status} satisfies ResetRuntimeAfterSystemFailureOutcome);
      } catch {
        logger.error({
          category: 'runtime.system-failure',
          event: 'runtime.system-failure.reset-failed',
          message: 'JavaScript runtime reset request failed',
          data: {portStatus: 'failed'},
        });
        return Object.freeze({status: 'failed'} satisfies ResetRuntimeAfterSystemFailureOutcome);
      }
    }),
  ]);
