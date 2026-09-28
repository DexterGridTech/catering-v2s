import {useMemo, useState} from 'react';
import {createRequestId, type RequestId} from '@catering-v2s/kernel-base-contracts';
import {selectRequestExecutionView} from '@catering-v2s/kernel-base-runtime';
import {useUiStateSelector} from './useUiStateSelector';
import type {RenderProviderProps} from '../types/props';

type RuntimeStateRoot = ReturnType<RenderProviderProps['stateSource']['getState']>;

export const useRequestInFlight = (requestId: RequestId | null): boolean => {
  const selector = useMemo(
    () => (root: RuntimeStateRoot) => (requestId === null ? null : selectRequestExecutionView(root, requestId)),
    [requestId],
  );
  const request = useUiStateSelector(selector);
  return requestId !== null && (request === undefined || request === null || request.status === 'started');
};

export const useTrackedRequest = (): Readonly<{
  readonly requestId: RequestId | null;
  readonly start: () => RequestId;
  readonly finish: (requestId: RequestId) => void;
}> => {
  const [requestId, setRequestId] = useState<RequestId | null>(null);
  const start = (): RequestId => {
    const next = createRequestId();
    setRequestId(next);
    return next;
  };
  const finish = (finishedRequestId: RequestId): void => {
    setRequestId(current => (current === finishedRequestId ? null : current));
  };
  return Object.freeze({requestId, start, finish});
};
