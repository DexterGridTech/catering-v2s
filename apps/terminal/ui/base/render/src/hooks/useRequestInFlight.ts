import {useMemo} from 'react';
import type {RequestId} from '@catering-v2s/kernel-base-contracts';
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
