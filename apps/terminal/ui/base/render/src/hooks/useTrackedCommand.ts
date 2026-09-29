import {useCallback, useEffect, useRef} from 'react';
import type {RequestId} from '@catering-v2s/kernel-base-contracts';
import type {CommandDefinition, CommandDispatchResult} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {classifyRequestResult, type RequestOutcome} from '../foundations/requestOutcome';
import {dispatchWithRequestId} from '../foundations/dispatchWithRequestId';
import {useDispatchCommand} from './useDispatchCommand';
import {useRequestInFlight, useTrackedRequest} from './useRequest';
import type {RenderProviderProps} from '../types/props';

type DispatchCommand = RenderProviderProps['dispatchCommand'];
type RouteIntent = Parameters<DispatchCommand>[1]['routeIntent'];

export type TrackedCommandRejectionPolicy = 'RETHROW' | 'CONSUME';

export type TrackedCommandRunInput<TPayload extends StateJsonValue> = Readonly<{
  readonly definition: CommandDefinition<TPayload>;
  readonly payload: TPayload;
  readonly routeIntent?: RouteIntent;
  readonly onOutcome?: (result: CommandDispatchResult, outcome: RequestOutcome) => void | PromiseLike<void>;
  readonly onRejected?: (error: unknown) => void | PromiseLike<void>;
  readonly rejectionPolicy: TrackedCommandRejectionPolicy;
}>;

export type TrackedCommand = Readonly<{
  readonly requestInFlight: boolean;
  readonly run: <TPayload extends StateJsonValue>(
    input: TrackedCommandRunInput<TPayload>,
  ) => Promise<CommandDispatchResult | undefined>;
}>;

export const useTrackedCommand = (): TrackedCommand => {
  const dispatchCommand = useDispatchCommand();
  const trackedRequest = useTrackedRequest();
  const requestInFlight = useRequestInFlight(trackedRequest.requestId);
  const activeRequestIdRef = useRef<RequestId | null>(null);
  const run = useCallback(
    async <TPayload extends StateJsonValue>(
      input: TrackedCommandRunInput<TPayload>,
    ): Promise<CommandDispatchResult | undefined> => {
      if (activeRequestIdRef.current !== null || trackedRequest.requestId !== null) return undefined;

      const requestId = trackedRequest.start();
      activeRequestIdRef.current = requestId;
      let result: CommandDispatchResult;
      try {
        result = await dispatchWithRequestId({
          dispatchCommand,
          definition: input.definition,
          payload: input.payload,
          requestId,
          routeIntent: input.routeIntent,
        });
      } catch (error) {
        trackedRequest.finish(requestId);
        activeRequestIdRef.current = null;
        if (input.rejectionPolicy === 'RETHROW') {
          try {
            await input.onRejected?.(error);
          } finally {
            throw error;
          }
        }
        try {
          await input.onRejected?.(error);
        } catch {
          // Rejection observers are best-effort and must not change CONSUME semantics.
        }
        return undefined;
      }

      const outcome = classifyRequestResult(result);
      if (outcome !== 'running') {
        trackedRequest.finish(requestId);
        activeRequestIdRef.current = null;
      }
      await input.onOutcome?.(result, outcome);
      return result;
    },
    [dispatchCommand, trackedRequest],
  );

  useEffect(() => {
    const currentRequestId = trackedRequest.requestId;
    if (currentRequestId !== null && !requestInFlight) {
      trackedRequest.finish(currentRequestId);
      if (activeRequestIdRef.current === currentRequestId) activeRequestIdRef.current = null;
    }
  }, [requestInFlight, trackedRequest]);

  return Object.freeze({requestInFlight, run});
};
