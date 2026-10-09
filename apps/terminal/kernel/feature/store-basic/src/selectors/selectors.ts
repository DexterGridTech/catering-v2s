import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {storeBasicSliceName} from '../features/slices/slice';
import type {StoreBasicState, StoreFact} from '../types/types';
import type {TerminalTopicKey} from '@catering-v2s/kernel-base-terminal-data-client';

const selectStoreBasicStateImplementation = (root: StateRoot): StoreBasicState => {
  const value = root[storeBasicSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`Missing store-basic state: ${storeBasicSliceName}`);
  return value as StoreBasicState;
};

const selectStoreBasicBindingImplementation = (root: StateRoot) => selectStoreBasicState(root).binding;
const selectStoreImplementation = (root: StateRoot) => selectStoreBasicState(root).store;
const selectStoreOperatingRulesImplementation = (root: StateRoot) => selectStoreBasicState(root).operatingRules;
const selectStoreOrganizationPathImplementation = (root: StateRoot) => selectStoreBasicState(root).organizationPath;
const selectStoreProjectImplementation = (
  root: StateRoot,
): StoreFact<Readonly<{projectRef: string; name: string}>> | null => {
  const value = selectStoreOrganizationPath(root);
  return value === null
    ? null
    : Object.freeze({
        value: Object.freeze({projectRef: value.projectRef, name: value.projectName}),
        updatedAtEpochMillis: value.projectUpdatedAtEpochMillis,
      });
};
const selectStoreRegionImplementation = (
  root: StateRoot,
): StoreFact<Readonly<{regionRef: string; name: string}>> | null => {
  const value = selectStoreOrganizationPath(root);
  return value === null
    ? null
    : Object.freeze({
        value: Object.freeze({regionRef: value.regionRef, name: value.regionName}),
        updatedAtEpochMillis: value.regionUpdatedAtEpochMillis,
      });
};
const selectStoreCommercialGroupImplementation = (
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
const selectActiveContractsImplementation = (root: StateRoot) => selectStoreBasicState(root).activeContracts;
const selectServicePointAreasImplementation = (root: StateRoot) => selectStoreBasicState(root).areas;
const selectServicePointsImplementation = (root: StateRoot) => selectStoreBasicState(root).servicePoints;
const selectStoreBasicTopicStateImplementation = (root: StateRoot, topicKey: TerminalTopicKey) => {
  const state = selectStoreBasicState(root);
  return Object.freeze({status: state.readStates[topicKey] ?? 'idle', errorCode: state.failures[topicKey] ?? null});
};
const selectStoreBasicLoadReadinessImplementation = (root: StateRoot) => selectStoreBasicState(root).loadReadiness;

export const selectActiveContracts = defineStateSelector(moduleName, 'selectActiveContracts', {
  parameters: [],
  selector: selectActiveContractsImplementation,
});
export const selectServicePointAreas = defineStateSelector(moduleName, 'selectServicePointAreas', {
  parameters: [],
  selector: selectServicePointAreasImplementation,
});
export const selectServicePoints = defineStateSelector(moduleName, 'selectServicePoints', {
  parameters: [],
  selector: selectServicePointsImplementation,
});
export const selectStore = defineStateSelector(moduleName, 'selectStore', {
  parameters: [],
  selector: selectStoreImplementation,
});
export const selectStoreBasicBinding = defineStateSelector(moduleName, 'selectStoreBasicBinding', {
  parameters: [],
  selector: selectStoreBasicBindingImplementation,
});
export const selectStoreBasicState = defineStateSelector(moduleName, 'selectStoreBasicState', {
  parameters: [],
  selector: selectStoreBasicStateImplementation,
});
export const selectStoreBasicLoadReadiness = defineStateSelector(moduleName, 'selectStoreBasicLoadReadiness', {
  parameters: [],
  selector: selectStoreBasicLoadReadinessImplementation,
});
export const selectStoreBasicTopicState = defineStateSelector(moduleName, 'selectStoreBasicTopicState', {
  parameters: [
    {kind: 'enum', values: ['STORE', 'PROJECT', 'REGION', 'COMMERCIAL_GROUP', 'SERVICE_POINT_AREA', 'SERVICE_POINT']},
  ],
  selector: selectStoreBasicTopicStateImplementation,
});
export const selectStoreCommercialGroup = defineStateSelector(moduleName, 'selectStoreCommercialGroup', {
  parameters: [],
  selector: selectStoreCommercialGroupImplementation,
});
export const selectStoreOperatingRules = defineStateSelector(moduleName, 'selectStoreOperatingRules', {
  parameters: [],
  selector: selectStoreOperatingRulesImplementation,
});
export const selectStoreOrganizationPath = defineStateSelector(moduleName, 'selectStoreOrganizationPath', {
  parameters: [],
  selector: selectStoreOrganizationPathImplementation,
});
export const selectStoreProject = defineStateSelector(moduleName, 'selectStoreProject', {
  parameters: [],
  selector: selectStoreProjectImplementation,
});
export const selectStoreRegion = defineStateSelector(moduleName, 'selectStoreRegion', {
  parameters: [],
  selector: selectStoreRegionImplementation,
});
