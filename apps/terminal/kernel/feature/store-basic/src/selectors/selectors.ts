import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {storeBasicSliceName} from '../features/slices/slice';
import type {StoreBasicState, StoreFact} from '../types/types';
import type {TerminalTopicKey} from '@catering-v2s/kernel-base-terminal-data-client';

export const selectStoreBasicState = (root: StateRoot): StoreBasicState => {
  const value = root[storeBasicSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`Missing store-basic state: ${storeBasicSliceName}`);
  return value as StoreBasicState;
};

export const selectStoreBasicBinding = (root: StateRoot) => selectStoreBasicState(root).binding;
export const selectStore = (root: StateRoot) => selectStoreBasicState(root).store;
export const selectStoreOperatingRules = (root: StateRoot) => selectStoreBasicState(root).operatingRules;
export const selectStoreOrganizationPath = (root: StateRoot) => selectStoreBasicState(root).organizationPath;
export const selectStoreProject = (root: StateRoot): StoreFact<Readonly<{projectRef: string; name: string}>> | null => {
  const value = selectStoreOrganizationPath(root);
  return value === null
    ? null
    : Object.freeze({
        value: Object.freeze({projectRef: value.projectRef, name: value.projectName}),
        updatedAtEpochMillis: value.projectUpdatedAtEpochMillis,
      });
};
export const selectStoreRegion = (root: StateRoot): StoreFact<Readonly<{regionRef: string; name: string}>> | null => {
  const value = selectStoreOrganizationPath(root);
  return value === null
    ? null
    : Object.freeze({
        value: Object.freeze({regionRef: value.regionRef, name: value.regionName}),
        updatedAtEpochMillis: value.regionUpdatedAtEpochMillis,
      });
};
export const selectStoreCommercialGroup = (
  root: StateRoot,
): StoreFact<Readonly<{commercialGroupRef: string; name: string}>> | null => {
  const value = selectStoreOrganizationPath(root);
  return value === null
    ? null
    : Object.freeze({
        value: Object.freeze({commercialGroupRef: value.commercialGroupRef, name: value.commercialGroupName}),
        updatedAtEpochMillis: value.commercialGroupUpdatedAtEpochMillis,
      });
};
export const selectActiveContracts = (root: StateRoot) => selectStoreBasicState(root).activeContracts;
export const selectServicePointAreas = (root: StateRoot) => selectStoreBasicState(root).areas;
export const selectServicePoints = (root: StateRoot) => selectStoreBasicState(root).servicePoints;
export const selectStoreBasicTopicState = (root: StateRoot, topicKey: TerminalTopicKey) => {
  const state = selectStoreBasicState(root);
  return Object.freeze({status: state.readStates[topicKey] ?? 'idle', errorCode: state.failures[topicKey] ?? null});
};
