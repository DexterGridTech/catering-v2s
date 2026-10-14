import {useSyncExternalStore} from 'react';
import type {RuntimeStatus} from '@catering-v2s/kernel-base-runtime';
import {useRenderSubscriptionContext} from './useRenderSubscriptionContext';

export const useRenderStatus = (): RuntimeStatus => {
  const {stateSource} = useRenderSubscriptionContext();
  return useSyncExternalStore(stateSource.subscribe, stateSource.getStatus, stateSource.getStatus);
};
