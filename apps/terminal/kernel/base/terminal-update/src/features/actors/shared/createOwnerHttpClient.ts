import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import type {ActorExecutionContext, CommandDispatchOptions} from '@catering-v2s/kernel-base-runtime';
import {
  executeTerminalHttpCommand,
  selectTerminalHttpContext,
  type TerminalHttpCommandPayload,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  buildTerminalHttpCommandRequest,
  createTerminalApiClient,
  type TerminalExecutionResult,
  type TerminalRequestExecutor,
} from '../../../generated/terminalApi';

export const createOwnerHttpClient = (
  context: ActorExecutionContext,
  requestId: ReturnType<typeof createRequestId> = context.command.requestId ?? createRequestId(),
  dispatchOptions: Pick<CommandDispatchOptions, 'lateOutcome' | 'lateResultTtlMs'> = {},
) => {
  const executeRequest: TerminalRequestExecutor = async (descriptor, request) => {
    const scope = selectTerminalHttpContext(context.getState(), {serviceName: 'business'});
    if (scope === null || !scope.ready)
      return Object.freeze({kind: 'failure', category: 'not-delivered', code: 'TERMINAL_HTTP_CONTEXT_NOT_READY'});
    const payload: TerminalHttpCommandPayload = Object.freeze({
      expectedContext: Object.freeze({runtimeId: context.runtimeId, scope}),
      request: buildTerminalHttpCommandRequest(descriptor, request),
    });
    const dispatched = await context.dispatchCommand(executeTerminalHttpCommand, payload, {
      ...dispatchOptions,
      requestId,
    });
    if (dispatched.status !== 'completed')
      return Object.freeze({
        kind: 'failure',
        category: dispatched.status === 'timed-out' ? 'delivered-failure' : 'not-delivered',
        code:
          dispatched.status === 'timed-out'
            ? 'TERMINAL_HTTP_COMMAND_TIMED_OUT'
            : 'TERMINAL_HTTP_COMMAND_UNAVAILABLE',
      });
    const value = dispatched.actorResults.length === 1 ? dispatched.actorResults[0]?.result : null;
    if (typeof value !== 'object' || value === null || Array.isArray(value) || !('kind' in value))
      return Object.freeze({kind: 'failure', category: 'not-delivered', code: 'TERMINAL_HTTP_COMMAND_UNAVAILABLE'});
    return value as TerminalExecutionResult;
  };
  return createTerminalApiClient(executeRequest);
};
