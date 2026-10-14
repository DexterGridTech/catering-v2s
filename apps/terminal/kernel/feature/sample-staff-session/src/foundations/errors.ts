import {createAppError, type AppError} from '@catering-v2s/kernel-base-contracts';
import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {invalidCredentialsErrorDefinition} from '../declarations/errors';

export const createInvalidCredentialsError = (context: ActorExecutionContext): AppError =>
  createAppError(invalidCredentialsErrorDefinition, {
    args: {},
    context: {
      commandName: context.command.commandName,
      commandId: context.command.commandId,
      requestId: context.command.requestId ?? undefined,
      nodeId: context.localNodeId,
    },
    details: {reasonCode: 'invalid-credentials'},
  });
