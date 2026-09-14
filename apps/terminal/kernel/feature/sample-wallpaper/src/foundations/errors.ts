import {
  createAppError,
  createModuleErrorFactory,
  type AppError,
} from '@catering-v2s/kernel-base-contracts'
import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from '../moduleName'

const defineError = createModuleErrorFactory(moduleName)

const invalidWallpaperIdErrorDefinition = defineError('invalid-wallpaper-id', {
  name: 'Sample wallpaper id is invalid',
  defaultTemplate: 'Sample wallpaper id is invalid',
  category: 'VALIDATION',
  severity: 'LOW',
  code: 'ERR_TER_SAMPLE_WALLPAPER_INVALID_ID',
})

const confirmWithoutPendingErrorDefinition = defineError('confirm-without-pending', {
  name: 'Sample wallpaper has no pending selection',
  defaultTemplate: 'Sample wallpaper has no pending selection to confirm',
  category: 'BUSINESS',
  severity: 'LOW',
  code: 'ERR_TER_SAMPLE_WALLPAPER_CONFIRM_WITHOUT_PENDING',
})

const errorContext = (context: ActorExecutionContext) => ({
  commandName: context.command.commandName,
  commandId: context.command.commandId,
  requestId: context.command.requestId ?? undefined,
  nodeId: context.localNodeId,
})

export const createInvalidWallpaperIdError = (
  context: ActorExecutionContext,
): AppError => createAppError(invalidWallpaperIdErrorDefinition, {
  args: {},
  context: errorContext(context),
  details: {reasonCode: 'invalid-wallpaper-id'},
})

export const createConfirmWithoutPendingError = (
  context: ActorExecutionContext,
): AppError => createAppError(confirmWithoutPendingErrorDefinition, {
  args: {},
  context: errorContext(context),
  details: {reasonCode: 'confirm-without-pending'},
})

export const wallpaperErrorDefinitions = [
  invalidWallpaperIdErrorDefinition,
  confirmWithoutPendingErrorDefinition,
] as const
