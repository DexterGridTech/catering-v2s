import {
  dispatchWithRequestId,
  type RenderProviderProps,
} from '@catering-v2s/ui-base-render'
import {wallpaperSystemFailureDismissedCommand} from '../features/commands/commands'

export const dispatchWallpaperSystemFailureDismissal = (
  dispatchCommand: RenderProviderProps['dispatchCommand'],
) => dispatchWithRequestId({
  dispatchCommand,
  definition: wallpaperSystemFailureDismissedCommand,
  payload: {},
})
