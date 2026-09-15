import {
  dispatchWithRequestId,
  type RenderProviderProps,
} from '@catering-v2s/ui-base-render'
import {deskSystemFailureDismissedCommand} from '../features/commands/commands'

export const dispatchDeskSystemFailureDismissal = (
  dispatchCommand: RenderProviderProps['dispatchCommand'],
) => dispatchWithRequestId({
  dispatchCommand,
  definition: deskSystemFailureDismissedCommand,
  payload: {},
})
