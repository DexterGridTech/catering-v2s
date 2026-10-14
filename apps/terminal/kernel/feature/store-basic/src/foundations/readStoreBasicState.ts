import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {storeBasicSliceName} from '../features/slices/storeBasicState';
import type {StoreBasicState} from '../types/types';

export const readStoreBasicState = (root: StateRoot): StoreBasicState => {
  const value = root[storeBasicSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`Missing store-basic state: ${storeBasicSliceName}`);
  return value as StoreBasicState;
};
