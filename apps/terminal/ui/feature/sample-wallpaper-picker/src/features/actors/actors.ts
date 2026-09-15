import {closeLayerCommand, openLayerCommand, selectLayers} from '@catering-v2s/kernel-base-ui-state'
import type {ActorDefinition, ActorExecutionContext, CommandDispatchResult} from '@catering-v2s/kernel-base-runtime'
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime'
import {
  confirmWallpaperCommand,
  isWallpaperId,
  selectPendingWallpaperId,
  selectWallpaperCommand,
  selectWallpaperId,
  type WallpaperId,
} from '@catering-v2s/kernel-feature-sample-wallpaper'
import {moduleName} from '../../moduleName'
import {
  confirmWallpaperRequestedCommand,
  wallpaperSystemFailureDismissedCommand,
  wallpaperSystemFailureObservedCommand,
  wallpaperOptionSelectedCommand,
  type WallpaperSystemOperation,
} from '../commands/commands'
import {createChildDispatchFailureError} from '../../foundations/errors'
import {classifyWallpaperWritePhase, type WallpaperSnapshot} from '../../foundations/writePhase'

const wallpaperSnapshot = (context: ActorExecutionContext): WallpaperSnapshot => Object.freeze({
  confirmed: selectWallpaperId(context.getState()),
  pending: selectPendingWallpaperId(context.getState()),
})

const dispatchWallpaperChild = async (
  context: ActorExecutionContext,
  input: Readonly<{
    readonly operation: WallpaperSystemOperation
    readonly requested: WallpaperId
    readonly dispatch: () => Promise<CommandDispatchResult>
  }>,
): Promise<void> => {
  const before = wallpaperSnapshot(context)
  let result: CommandDispatchResult | undefined
  let rejection: unknown
  try {
    result = await input.dispatch()
  } catch (error) {
    rejection = error
  }
  const after = wallpaperSnapshot(context)
  if (rejection !== undefined || result?.status !== 'completed') {
    throw createChildDispatchFailureError(context, {
      operation: input.operation,
      phase: classifyWallpaperWritePhase({
        operation: input.operation,
        requested: input.requested,
        before,
        after,
      }),
      result,
      rejection,
    })
  }
}

const noticeLayerId = 'sample.wallpaper.system-notice'

const effectiveWallpaperId = (context: ActorExecutionContext): WallpaperId =>
  selectPendingWallpaperId(context.getState()) ?? selectWallpaperId(context.getState())

export const createWallpaperPickerActor = (): ActorDefinition => defineActor(moduleName, 'wallpaper-picker', [
  onCommand(wallpaperOptionSelectedCommand, async context => {
    const wallpaperId = context.command.payload.wallpaperId
    if (!isWallpaperId(wallpaperId)) {
      throw new Error('[ui.feature.sample-wallpaper-picker] invalid wallpaper option')
    }
    if (wallpaperId === effectiveWallpaperId(context)) return null
    await dispatchWallpaperChild(context, {
      operation: 'select',
      requested: wallpaperId,
      dispatch: () => context.dispatchCommand(selectWallpaperCommand, {wallpaperId}),
    })
    return null
  }),
  onCommand(confirmWallpaperRequestedCommand, async context => {
    const pending = selectPendingWallpaperId(context.getState())
    const confirmed = selectWallpaperId(context.getState())
    if (pending === undefined || pending === confirmed) return null
    await dispatchWallpaperChild(context, {
      operation: 'confirm',
      requested: pending,
      dispatch: () => context.dispatchCommand(confirmWallpaperCommand, {}),
    })
    return null
  }),
  onCommand(wallpaperSystemFailureObservedCommand, async context => {
    const hasNotice = selectLayers(context.getState(), 'PRIMARY')
      .some(layer => layer.layerId === noticeLayerId)
    if (hasNotice) return null
    await context.dispatchCommand(openLayerCommand, {
      displayMode: 'PRIMARY',
      layerId: noticeLayerId,
      partKey: noticeLayerId,
      props: {
        operation: context.command.payload.operation,
        phase: context.command.payload.phase,
      },
      persistence: 'ephemeral',
    })
    return null
  }),
  onCommand(wallpaperSystemFailureDismissedCommand, async context => {
    await context.dispatchCommand(closeLayerCommand, {
      displayMode: 'PRIMARY',
      layerId: noticeLayerId,
    })
    return null
  }),
])
