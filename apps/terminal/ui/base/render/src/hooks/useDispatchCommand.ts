import {useMemo} from 'react';
import type {CommandDispatchResult, CommandIntent} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {RenderProviderProps} from '../types/props';
import {useRenderContext} from '../contexts/RenderContext';
import {reportRenderCommandDispatchRejection} from '../foundations/diagnostics';

type DispatchCommand = RenderProviderProps['dispatchCommand'];
type DispatchOptions = Parameters<DispatchCommand>[1];

const createObservedDispatchCommand =
  (
    dispatchCommand: DispatchCommand,
    logger: Parameters<typeof reportRenderCommandDispatchRejection>[0],
  ): DispatchCommand =>
  async <TPayload extends StateJsonValue>(
    command: CommandIntent<TPayload>,
    options: DispatchOptions,
  ): Promise<CommandDispatchResult> => {
    try {
      const result = await dispatchCommand(command, options);
      if (result.status === 'partial-failed' || result.status === 'timed-out' || result.status === 'error') {
        reportRenderCommandDispatchRejection(logger, {
          event: 'command-dispatch-rejected',
          commandName: command.definition.commandName,
          requestId: options.requestId,
          failure: result.status,
        });
      }
      return result;
    } catch (error) {
      reportRenderCommandDispatchRejection(logger, {
        event: 'command-dispatch-rejected',
        commandName: command.definition.commandName,
        requestId: options.requestId,
        failure: 'promise-rejected',
      });
      throw error;
    }
  };

export const useDispatchCommand = (): DispatchCommand => {
  const {dispatchCommand, logger} = useRenderContext();
  return useMemo(() => createObservedDispatchCommand(dispatchCommand, logger), [dispatchCommand, logger]);
};
