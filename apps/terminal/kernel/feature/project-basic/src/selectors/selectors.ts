import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {projectBasicContextIdentity, projectBasicSliceName} from '../features/slices/slice';
import type {ProjectBasicState, ProjectTerminalUpdateCandidate, StoredTerminalUpdateRule} from '../types/types';
import type {FixedUpdateTarget} from '@catering-v2s/kernel-base-terminal-update';
import type {TerminalUpdateContextFacts} from '@catering-v2s/kernel-base-terminal-update';
import {selectActivationState} from '@catering-v2s/kernel-base-terminal-data-client';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {selectTopologyRequiredProjectionsReady, selectTopologyState} from '@catering-v2s/kernel-base-topology';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {selectStore, selectStoreBasicBinding, selectStoreBasicLoadReadiness} from '@catering-v2s/kernel-feature-store-basic';
import {storeBasicSliceName} from '@catering-v2s/kernel-feature-store-basic';

const readState = (root: StateRoot): ProjectBasicState => {
  const value = root[projectBasicSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('PROJECT_BASIC_STATE_MISSING');
  return value as ProjectBasicState;
};

export const selectProjectBasicState = defineStateSelector(moduleName, 'selectProjectBasicState', {
  parameters: [],
  selector: readState,
});

const uuidSortKey = (value: string): string | null => {
  const normalized = value.toLowerCase().replaceAll('-', '');
  return /^[0-9a-f]{32}$/u.test(normalized) ? normalized : null;
};

const compareRulesDescending = (left: StoredTerminalUpdateRule, right: StoredTerminalUpdateRule): number => {
  if (left.createdAtEpochMillis !== right.createdAtEpochMillis)
    return left.createdAtEpochMillis > right.createdAtEpochMillis ? -1 : 1;
  const leftId = uuidSortKey(left.ruleRef);
  const rightId = uuidSortKey(right.ruleRef);
  if (leftId === null || rightId === null) return 0;
  return leftId === rightId ? 0 : leftId > rightId ? -1 : 1;
};

const requiredPeerProjectionSliceNames = [serverConfigSliceName, storeBasicSliceName, projectBasicSliceName] as const;

const selectReadyUpdateContext = (root: StateRoot): Readonly<{
  readonly binding: NonNullable<ProjectBasicState['binding']>;
  readonly path: NonNullable<ProjectBasicState['organizationPath']>;
  readonly contextFacts: TerminalUpdateContextFacts;
}> | null => {
  const state = readState(root);
  const binding = selectStoreBasicBinding(root);
  const store = selectStore(root);
  const storeReadiness = selectStoreBasicLoadReadiness(root);
  const path = state.organizationPath?.value;
  const mode = selectRuntimeInstanceMode(root);
  if (binding === null || store === null || path === undefined || state.ruleSnapshotStatus.status !== 'ready') return null;
  const pathFact = state.organizationPath;
  if (pathFact === null || store.value.id !== binding.storeRef || store.value.groupWorkspaceKey !== binding.groupWorkspaceKey ||
      path.projectRef !== store.value.project.id || path.projectRef.length === 0) return null;

  if (mode === 'MASTER') {
    const activation = selectActivationState(root);
    if (activation.status !== 'active' || activation.terminalRef !== binding.terminalRef ||
        activation.bindingGeneration !== binding.bindingGeneration || activation.storeRef !== binding.storeRef ||
        activation.groupWorkspaceKey !== binding.groupWorkspaceKey ||
        state.loadReadiness.runtimeId === null || state.loadReadiness.status !== 'flushed' ||
        state.loadReadiness.projectRef !== path.projectRef || state.loadReadiness.binding === null ||
        state.loadReadiness.binding.terminalRef !== binding.terminalRef ||
        state.loadReadiness.binding.bindingGeneration !== binding.bindingGeneration ||
        state.loadReadiness.binding.storeRef !== binding.storeRef ||
        state.loadReadiness.binding.groupWorkspaceKey !== binding.groupWorkspaceKey ||
        storeReadiness.runtimeId !== state.loadReadiness.runtimeId || storeReadiness.storeStatus !== 'flushed' ||
        storeReadiness.binding?.terminalRef !== binding.terminalRef ||
        storeReadiness.binding?.bindingGeneration !== binding.bindingGeneration ||
        storeReadiness.binding?.storeRef !== binding.storeRef ||
        storeReadiness.binding?.groupWorkspaceKey !== binding.groupWorkspaceKey) return null;
  } else if (mode === 'SLAVE') {
    const topology = selectTopologyState(root);
    if (topology.peerIdentity?.instanceMode !== 'MASTER' || topology.peerIdentity.moduleName.length === 0 ||
        !selectTopologyRequiredProjectionsReady(root, requiredPeerProjectionSliceNames)) return null;
  } else return null;

  const serverConfig = root[serverConfigSliceName] as Readonly<{selectedSpace?: unknown}> | undefined;
  if (serverConfig?.selectedSpace !== binding.groupWorkspaceKey) return null;
  const contextIdentity = projectBasicContextIdentity(binding, path);
  if (
    state.ruleSnapshot.contextIdentity !== contextIdentity ||
    state.ruleSnapshot.selectedSpace !== binding.groupWorkspaceKey ||
    state.ruleSnapshot.projectRef !== path.projectRef ||
    state.ruleSnapshot.collectionHash === null ||
    !/^[a-f0-9]{64}$/u.test(state.ruleSnapshot.collectionHash)
  ) return null;

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

const selectCandidate = (root: StateRoot, applicationId: string, requestedStoreRef: string): ProjectTerminalUpdateCandidate | null => {
  const state = readState(root);
  const context = selectReadyUpdateContext(root);
  if (context === null || context.binding.storeRef !== requestedStoreRef) return null;
  const {binding, path} = context;
  const contextIdentity = projectBasicContextIdentity(binding, path.value);
  const collectionHash = state.ruleSnapshot.collectionHash;
  if (collectionHash === null) return null;

  const selected = state.ruleSnapshot.items
    .filter(rule => rule.applicationId === applicationId && (rule.targetMode === 'ALL' || rule.storeRefs.includes(requestedStoreRef)))
    .sort(compareRulesDescending)[0];
  if (selected === undefined) return null;
  return Object.freeze({
    collectionHash,
    contextIdentity,
    selectedSpace: binding.groupWorkspaceKey,
    projectRef: path.value.projectRef,
    storeRef: requestedStoreRef,
    rule: selected,
  });
};

export const selectProjectTerminalUpdateContextFacts = defineStateSelector(moduleName, 'selectProjectTerminalUpdateContextFacts', {
  parameters: [],
  selector: (root: StateRoot) => selectReadyUpdateContext(root)?.contextFacts ?? null,
});

export const fixedTargetFromProjectCandidate = (candidate: ProjectTerminalUpdateCandidate): FixedUpdateTarget => {
  const source = (artifact: ProjectTerminalUpdateCandidate['rule']['full']): NonNullable<FixedUpdateTarget['full']> =>
    Object.freeze({
      sourceRef: `terminal-update-artifact:${artifact.artifactRef}`,
      expectedSha256: artifact.zipSha256,
      apkSha256: artifact.apkSha256,
      artifactRef: artifact.artifactRef,
      artifact: Object.freeze({
        applicationId: artifact.applicationId,
        nativeVersion: artifact.apkVersion,
        nativeBuildNumber: artifact.nativeBuildNumber,
        bundleVersion: artifact.jsVersion,
        runtimeVersion: artifact.runtimeVersion,
        publicationId: artifact.publicationId,
      }),
    });
  return Object.freeze({
    ruleRef: candidate.rule.ruleRef,
    collectionHash: candidate.collectionHash,
    createdAt: candidate.rule.createdAtEpochMillis as FixedUpdateTarget['createdAt'],
    applicationId: candidate.rule.applicationId,
    full: source(candidate.rule.full),
    hot: candidate.rule.hot === null ? null : source(candidate.rule.hot),
    policy: Object.freeze({
      nSeconds: candidate.rule.nSeconds,
      hotStrategy: candidate.rule.hotStrategy,
      mSeconds: candidate.rule.mSeconds,
    }),
    strategy: Object.freeze({maxNetworkAttempts: 2, bootTimeoutMs: 60_000}),
    selectionContext: Object.freeze({
      selectedSpace: candidate.selectedSpace,
      contextIdentity: candidate.contextIdentity,
      ruleRef: candidate.rule.ruleRef,
    }),
  });
};

export const selectProjectOrganizationPath = defineStateSelector(moduleName, 'selectProjectOrganizationPath', {
  parameters: [], selector: (root: StateRoot) => readState(root).organizationPath,
});
export const selectProject = defineStateSelector(moduleName, 'selectProject', {
  parameters: [], selector: (root: StateRoot) => {
    const fact = readState(root).organizationPath;
    return fact === null ? null : Object.freeze({value: Object.freeze({projectRef: fact.value.projectRef, name: fact.value.projectName}), updatedAtEpochMillis: fact.value.projectUpdatedAtEpochMillis});
  },
});
export const selectRegion = defineStateSelector(moduleName, 'selectRegion', {
  parameters: [], selector: (root: StateRoot) => {
    const fact = readState(root).organizationPath;
    return fact === null ? null : Object.freeze({value: Object.freeze({regionRef: fact.value.regionRef, name: fact.value.regionName}), updatedAtEpochMillis: fact.value.regionUpdatedAtEpochMillis});
  },
});
export const selectCommercialGroup = defineStateSelector(moduleName, 'selectCommercialGroup', {
  parameters: [], selector: (root: StateRoot) => {
    const fact = readState(root).organizationPath;
    return fact === null ? null : Object.freeze({value: Object.freeze({commercialGroupRef: fact.value.commercialGroupRef, name: fact.value.commercialGroupName}), updatedAtEpochMillis: fact.value.commercialGroupUpdatedAtEpochMillis});
  },
});
export const selectProjectBasicLoadReadiness = defineStateSelector(moduleName, 'selectProjectBasicLoadReadiness', {
  parameters: [], selector: (root: StateRoot) => readState(root).loadReadiness,
});
export const selectProjectBasicTopicState = defineStateSelector(moduleName, 'selectProjectBasicTopicState', {
  parameters: [{kind: 'enum', values: ['PROJECT', 'REGION', 'COMMERCIAL_GROUP', 'TERMINAL_UPDATE_RULES']}],
  selector: (root: StateRoot, topicKey: keyof ProjectBasicState['readStates']) => {
    const state = readState(root);
    return Object.freeze({status: state.readStates[topicKey] ?? 'idle', errorCode: state.failures[topicKey] ?? null});
  },
});
export const selectProjectTerminalUpdateRules = defineStateSelector(moduleName, 'selectProjectTerminalUpdateRules', {
  parameters: [], selector: (root: StateRoot) => Object.freeze({...readState(root).ruleSnapshot, ...readState(root).ruleSnapshotStatus}),
});
export const selectProjectTerminalUpdateCandidate = defineStateSelector(moduleName, 'selectProjectTerminalUpdateCandidate', {
  parameters: [{kind: 'string'}, {kind: 'string'}], selector: selectCandidate,
});
