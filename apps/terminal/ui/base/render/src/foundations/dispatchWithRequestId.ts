import {createRequestId, type RequestId} from '@catering-v2s/kernel-base-contracts';
import {createCommand, type CommandDefinition} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {RenderProviderProps} from '../types/props';

type DispatchCommand = RenderProviderProps['dispatchCommand'];

export const dispatchWithRequestId = <TPayload extends StateJsonValue>(
  input: Readonly<{
    dispatchCommand: DispatchCommand;
    definition: CommandDefinition<TPayload>;
    payload: TPayload;
    requestId?: RequestId;
    routeIntent?: Parameters<DispatchCommand>[1]['routeIntent'];
  }>,
) =>
  input.dispatchCommand(createCommand(input.definition, input.payload), {
    requestId: input.requestId ?? createRequestId(),
    ...(input.routeIntent === undefined ? {} : {routeIntent: input.routeIntent}),
  });
