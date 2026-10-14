import {createAppError, type AppError} from '@catering-v2s/kernel-base-contracts';
import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {invalidMemberPayloadErrorDefinition, noPendingMemberErrorDefinition} from '../declarations/errors';

const errorContext = (context: ActorExecutionContext) => ({
  commandName: context.command.commandName,
  commandId: context.command.commandId,
  requestId: context.command.requestId ?? undefined,
  nodeId: context.localNodeId,
});

export const createNoPendingMemberError = (context: ActorExecutionContext): AppError =>
  createAppError(noPendingMemberErrorDefinition, {
    args: {},
    context: errorContext(context),
    details: {reasonCode: 'no-pending-member'},
  });

export const createInvalidMemberPayloadError = (context: ActorExecutionContext): AppError =>
  createAppError(invalidMemberPayloadErrorDefinition, {
    args: {},
    context: errorContext(context),
    details: {reasonCode: 'invalid-member-payload'},
  });
