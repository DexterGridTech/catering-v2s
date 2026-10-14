import {createAppError, type AppError} from '@catering-v2s/kernel-base-contracts';
import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {confirmWithoutPendingErrorDefinition, invalidWallpaperIdErrorDefinition} from '../declarations/errors';

const errorContext = (context: ActorExecutionContext) => ({
  commandName: context.command.commandName,
  commandId: context.command.commandId,
  requestId: context.command.requestId ?? undefined,
  nodeId: context.localNodeId,
});

export const createInvalidWallpaperIdError = (context: ActorExecutionContext): AppError =>
  createAppError(invalidWallpaperIdErrorDefinition, {
    args: {},
    context: errorContext(context),
    details: {reasonCode: 'invalid-wallpaper-id'},
  });

export const createConfirmWithoutPendingError = (context: ActorExecutionContext): AppError =>
  createAppError(confirmWithoutPendingErrorDefinition, {
    args: {},
    context: errorContext(context),
    details: {reasonCode: 'confirm-without-pending'},
  });
