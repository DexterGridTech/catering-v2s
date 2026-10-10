import {createAction, type UnknownAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice, type SyncValueEnvelope} from '@catering-v2s/kernel-base-state';
import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../../moduleName';
import type {ProjectBasicState} from '../../types/types';

export const projectBasicSliceName = `${moduleName}.state` as const;

export const initialProjectBasicState: ProjectBasicState = Object.freeze({
  binding: null,
  organizationPath: null,
  ruleSnapshot: Object.freeze({contextIdentity: null, selectedSpace: null, projectRef: null, collectionHash: null, items: Object.freeze([])}),
  ruleSnapshotStatus: Object.freeze({status: 'empty', errorCode: null}),
  loadReadiness: Object.freeze({runtimeId: null, binding: null, status: 'idle', projectRef: null}),
  readStates: Object.freeze({}),
  failures: Object.freeze({}),
});

const setBinding = createAction<ProjectBasicState['binding']>(`${projectBasicSliceName}/setBinding`);
const setOrganizationPath = createAction<NonNullable<ProjectBasicState['organizationPath']>>(`${projectBasicSliceName}/setOrganizationPath`);
const setRuleSnapshot = createAction<ProjectBasicState['ruleSnapshot']>(`${projectBasicSliceName}/setRuleSnapshot`);
const setRuleSnapshotStatus = createAction<ProjectBasicState['ruleSnapshotStatus']>(`${projectBasicSliceName}/setRuleSnapshotStatus`);
const setLoadReadiness = createAction<ProjectBasicState['loadReadiness']>(`${projectBasicSliceName}/setLoadReadiness`);
const setTopicState = createAction<Readonly<{topicKey: keyof ProjectBasicState['readStates']; status: 'idle' | 'loading' | 'loaded' | 'failed'; errorCode?: string | null}>>(`${projectBasicSliceName}/setTopicState`);
const reset = createAction(`${projectBasicSliceName}/reset`);

export const projectBasicReducer = (state: ProjectBasicState = initialProjectBasicState, action: UnknownAction): ProjectBasicState => {
  if (setBinding.match(action)) return Object.freeze({...initialProjectBasicState, binding: action.payload});
  if (setOrganizationPath.match(action)) return Object.freeze({...state, organizationPath: action.payload});
  if (setRuleSnapshot.match(action)) return Object.freeze({...state, ruleSnapshot: action.payload});
  if (setRuleSnapshotStatus.match(action)) return Object.freeze({...state, ruleSnapshotStatus: action.payload});
  if (setLoadReadiness.match(action)) return Object.freeze({...state, loadReadiness: action.payload});
  if (setTopicState.match(action)) {
    const readStates = {...state.readStates, [action.payload.topicKey]: action.payload.status};
    const failures = {...state.failures};
    if (action.payload.status === 'loaded' || action.payload.errorCode == null) delete failures[action.payload.topicKey];
    else failures[action.payload.topicKey] = action.payload.errorCode;
    return Object.freeze({...state, readStates: Object.freeze(readStates), failures: Object.freeze(failures)});
  }
  if (reset.match(action)) return initialProjectBasicState;
  return state;
};

const orgEntryKey = 'organization';
const rulesEntryKey = 'rules';
const asSyncEntry = <TValue>(value: TValue): SyncValueEnvelope => ({value: value as never, updatedAt: nowTimestampMs()});
const tombstone = (): SyncValueEnvelope => ({tombstone: true, updatedAt: nowTimestampMs()});
export const projectBasicContextIdentity = (
  binding: NonNullable<ProjectBasicState['binding']>,
  path: NonNullable<ProjectBasicState['organizationPath']>['value'],
): string => `${binding.terminalRef}:${binding.bindingGeneration}:${binding.groupWorkspaceKey}:${binding.storeRef}:${path.projectRef}:${path.projectUpdatedAtEpochMillis}`;
const sameBinding = (left: ProjectBasicState['binding'], right: ProjectBasicState['binding']): boolean =>
  left !== null && right !== null && left.terminalRef === right.terminalRef && left.storeRef === right.storeRef &&
  left.groupWorkspaceKey === right.groupWorkspaceKey && left.bindingGeneration === right.bindingGeneration;
const organizationIsReady = (state: ProjectBasicState): boolean => {
  const path = state.organizationPath?.value;
  const readiness = state.loadReadiness;
  return path !== undefined && state.binding !== null && readiness.runtimeId !== null && readiness.status === 'flushed' &&
    sameBinding(readiness.binding, state.binding) && readiness.projectRef === path.projectRef;
};
const rulesAreReady = (state: ProjectBasicState): boolean => {
  const path = state.organizationPath?.value;
  const binding = state.binding;
  const rules = state.ruleSnapshot;
  if (!organizationIsReady(state) || path === undefined || binding === null || state.ruleSnapshotStatus.status !== 'ready') return false;
  return rules.contextIdentity === projectBasicContextIdentity(binding, path) && rules.selectedSpace === binding.groupWorkspaceKey &&
    rules.projectRef === path.projectRef && rules.collectionHash !== null;
};
export const getProjectBasicSyncEntries = (state: ProjectBasicState): Readonly<Record<string, SyncValueEnvelope>> => ({
  [orgEntryKey]: organizationIsReady(state) ? asSyncEntry(state.organizationPath) : tombstone(),
  [rulesEntryKey]: rulesAreReady(state) ? asSyncEntry(state.ruleSnapshot) : tombstone(),
});

export const projectBasicStateRegistration = defineStateRuntimeSlice<ProjectBasicState>({
  name: projectBasicSliceName,
  reducer: projectBasicReducer,
  persistIntent: 'owner-only',
  persistence: [
    {kind: 'field', stateKey: 'organizationPath', protection: 'plain', flushMode: 'immediate'},
    {kind: 'field', stateKey: 'ruleSnapshot', protection: 'plain', flushMode: 'immediate'},
  ],
  syncIntent: 'master-to-slave',
  sync: {
    kind: 'record',
    getEntries: getProjectBasicSyncEntries,
    applyEntries: (state, entries: Readonly<Partial<Record<string, SyncValueEnvelope>>>) => {
      const organization = entries[orgEntryKey];
      const rules = entries[rulesEntryKey];
      const organizationPath = organization?.value === undefined ? null : organization.value as ProjectBasicState['organizationPath'];
      const ruleSnapshot = rules?.value === undefined
        ? initialProjectBasicState.ruleSnapshot
        : rules.value as ProjectBasicState['ruleSnapshot'];
      return Object.freeze({
        ...state,
        organizationPath,
        ruleSnapshot,
        ruleSnapshotStatus: Object.freeze({status: rules?.value === undefined ? 'empty' : 'ready', errorCode: null}),
        loadReadiness: initialProjectBasicState.loadReadiness,
      });
    },
  },
});

export const projectBasicActions = Object.freeze({setBinding, setOrganizationPath, setRuleSnapshot, setRuleSnapshotStatus, setLoadReadiness, setTopicState, reset});
