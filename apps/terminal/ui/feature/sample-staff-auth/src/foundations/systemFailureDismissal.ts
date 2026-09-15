import {
  dispatchWithRequestId,
  type RenderProviderProps,
} from '@catering-v2s/ui-base-render'
import {authSystemFailureDismissedCommand} from '../features/commands/commands'

export const dispatchAuthSystemFailureDismissal = (
  dispatchCommand: RenderProviderProps['dispatchCommand'],
) => dispatchWithRequestId({
  dispatchCommand,
  definition: authSystemFailureDismissedCommand,
  payload: {},
})
