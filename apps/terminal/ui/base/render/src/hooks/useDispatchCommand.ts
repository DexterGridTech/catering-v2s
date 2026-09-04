import {useMemo} from 'react'
import type {
  CommandDispatchOptions,
  CommandDispatchResult,
  CommandIntent,
} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import type {RenderProviderProps} from '../types/props'
import {useRenderContext} from '../contexts/RenderContext'
import {reportRenderCommandDispatchRejection} from '../foundations/diagnostics'

type DispatchCommand = RenderProviderProps['dispatchCommand']
type DispatchOptions = Readonly<{
  readonly requestId: NonNullable<CommandDispatchOptions['requestId']>
}>

const createObservedDispatchCommand = (
  dispatchCommand: DispatchCommand,
  logger: Parameters<typeof reportRenderCommandDispatchRejection>[0],
): DispatchCommand => async <TPayload extends StateJsonValue>(
  command: CommandIntent<TPayload>,
  options: DispatchOptions,
): Promise<CommandDispatchResult> => {
  try {
    return await dispatchCommand(command, options)
  } catch (error) {
    reportRenderCommandDispatchRejection(logger, {
      event: 'command-dispatch-rejected',
      commandName: command.definition.commandName,
      requestId: options.requestId,
    })
    throw error
  }
}

export const useDispatchCommand = (): DispatchCommand => {
  const {dispatchCommand, logger} = useRenderContext()
  return useMemo(
    () => createObservedDispatchCommand(dispatchCommand, logger),
    [dispatchCommand, logger],
  )
}
