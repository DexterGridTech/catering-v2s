import type {StateRoot} from '@catering-v2s/kernel-base-state';
import type {TerminalUpdateContextFacts} from '@catering-v2s/kernel-base-terminal-update';
import {selectActivationState} from '@catering-v2s/kernel-base-terminal-data-client';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {selectTopologyRequiredProjectionsReady, selectTopologyState} from '@catering-v2s/kernel-base-topology';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {
  selectStore,
  selectStoreBasicBinding,
  selectStoreBasicLoadReadiness,
  storeBasicSliceName,
} from '@catering-v2s/kernel-feature-store-basic';
import {projectBasicContextIdentity, projectBasicSliceName} from '../../features/slices/projectBasicState';
import type {ProjectBasicState} from '../../types/types';
import {readProjectBasicState} from '../readProjectBasicState';

const requiredPeerProjectionSliceNames = [serverConfigSliceName, storeBasicSliceName, projectBasicSliceName] as const;

export const selectReadyUpdateContext = (
  root: StateRoot,
  allowDisconnectedSlave = false,
): Readonly<{
  readonly binding: NonNullable<ProjectBasicState['binding']>;
  readonly path: NonNullable<ProjectBasicState['organizationPath']>;
  readonly contextFacts: TerminalUpdateContextFacts;
}> | null => {
  const state = readProjectBasicState(root);
  const binding = selectStoreBasicBinding(root);
  const store = selectStore(root);
  const storeReadiness = selectStoreBasicLoadReadiness(root);
  const path = state.organizationPath?.value;
  const mode = selectRuntimeInstanceMode(root);
  if (binding === null || store === null || path === undefined || state.ruleSnapshotStatus.status !== 'ready')
    return null;
  const pathFact = state.organizationPath;
  if (
    pathFact === null ||
    store.value.id !== binding.storeRef ||
    store.value.groupWorkspaceKey !== binding.groupWorkspaceKey ||
    path.projectRef !== store.value.project.id ||
    path.projectRef.length === 0
  )
    return null;

  if (mode === 'MASTER') {
    const activation = selectActivationState(root);
    if (
      activation.status !== 'active' ||
      activation.terminalRef !== binding.terminalRef ||
      activation.bindingGeneration !== binding.bindingGeneration ||
      activation.storeRef !== binding.storeRef ||
      activation.groupWorkspaceKey !== binding.groupWorkspaceKey ||
      state.loadReadiness.runtimeId === null ||
      state.loadReadiness.status !== 'flushed' ||
      state.loadReadiness.projectRef !== path.projectRef ||
      state.loadReadiness.binding === null ||
      state.loadReadiness.binding.terminalRef !== binding.terminalRef ||
      state.loadReadiness.binding.bindingGeneration !== binding.bindingGeneration ||
      state.loadReadiness.binding.storeRef !== binding.storeRef ||
      state.loadReadiness.binding.groupWorkspaceKey !== binding.groupWorkspaceKey ||
      storeReadiness.runtimeId !== state.loadReadiness.runtimeId ||
      storeReadiness.storeStatus !== 'flushed' ||
      storeReadiness.binding?.terminalRef !== binding.terminalRef ||
      storeReadiness.binding?.bindingGeneration !== binding.bindingGeneration ||
      storeReadiness.binding?.storeRef !== binding.storeRef ||
      storeReadiness.binding?.groupWorkspaceKey !== binding.groupWorkspaceKey
    )
      return null;
  } else if (mode === 'SLAVE') {
    const topology = selectTopologyState(root);
    const activation = selectActivationState(root);
    if (
      topology.peerIdentity?.instanceMode !== 'MASTER' ||
      topology.peerIdentity.moduleName.length === 0 ||
      activation.terminalRef !== binding.terminalRef ||
      activation.bindingGeneration !== binding.bindingGeneration ||
      activation.storeRef !== binding.storeRef ||
      activation.groupWorkspaceKey !== binding.groupWorkspaceKey ||
      (!allowDisconnectedSlave && !selectTopologyRequiredProjectionsReady(root, requiredPeerProjectionSliceNames))
    )
      return null;
  } else return null;

  const contextIdentity = projectBasicContextIdentity(binding, path);
  if (
    state.ruleSnapshot.contextIdentity !== contextIdentity ||
    state.ruleSnapshot.selectedSpace !== binding.groupWorkspaceKey ||
    state.ruleSnapshot.projectRef !== path.projectRef ||
    state.ruleSnapshot.collectionHash === null ||
    !/^[a-f0-9]{64}$/u.test(state.ruleSnapshot.collectionHash)
  )
    return null;

  return Object.freeze({
    binding,
    path: pathFact,
    contextFacts: Object.freeze({
      terminalRef: binding.terminalRef,
      bindingGeneration: binding.bindingGeneration,
      selectedSpace: binding.groupWorkspaceKey,
      storeRef: binding.storeRef,
      projectRef: path.projectRef,
      projectUpdatedAtEpochMillis: path.projectUpdatedAtEpochMillis,
    }),
  });
};
