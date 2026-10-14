import {createAppError, isAppError, type AppError, type ErrorCategory} from '@catering-v2s/kernel-base-contracts';
import type {ActorExecutionContext, CommandDispatchResult} from '@catering-v2s/kernel-base-runtime';
import {isBusinessErrorCategory} from '@catering-v2s/ui-base-render';
import type {WallpaperSystemFailurePhase, WallpaperSystemOperation} from '../declarations/commands';
import {childDispatchFailureDefinition} from '../declarations/errors';

const childCategory = (result: CommandDispatchResult | undefined, rejection: unknown): ErrorCategory => {
  const resultCategories = result?.actorResults
    .map(actor => actor.error?.category)
    .filter((category): category is ErrorCategory => category !== undefined);
  const firstSystemCategory = resultCategories?.find(category => !isBusinessErrorCategory(category));
  if (firstSystemCategory !== undefined) return firstSystemCategory;
  const firstResultCategory = resultCategories?.[0];
  if (firstResultCategory !== undefined) return firstResultCategory;
  if (isAppError(rejection)) return rejection.category;
  return 'SYSTEM';
};

const definitionForCategory = (category: ErrorCategory) =>
  category === 'SYSTEM' ? childDispatchFailureDefinition : Object.freeze({...childDispatchFailureDefinition, category});

export const createChildDispatchFailureError = (
  context: ActorExecutionContext,
  input: Readonly<{
    readonly operation: WallpaperSystemOperation;
    readonly phase: WallpaperSystemFailurePhase;
    readonly result?: CommandDispatchResult;
    readonly rejection?: unknown;
  }>,
): AppError => {
  const category = childCategory(input.result, input.rejection);
  const safeChildErrorCode =
    input.result?.actorResults.map(actor => actor.error?.code).find(code => typeof code === 'string') ??
    (isAppError(input.rejection) ? input.rejection.code : null);
  return createAppError(definitionForCategory(category), {
    context: {
      commandName: context.command.commandName,
      commandId: context.command.commandId,
      requestId: context.command.requestId ?? undefined,
      nodeId: context.localNodeId,
    },
    details: {
      operation: input.operation,
      phase: input.phase,
      childStatus: input.result?.status ?? 'rejected',
      childErrorCode: safeChildErrorCode,
      categoryWasBusiness: isBusinessErrorCategory(category),
    },
  });
};
