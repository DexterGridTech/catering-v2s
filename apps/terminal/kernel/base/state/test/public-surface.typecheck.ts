import type {Reducer} from '@reduxjs/toolkit';
import {
  applySliceSyncDiff,
  createFullSliceSyncPayload,
  createStateRuntime,
  createSyncTombstone,
  createWorkspaceActionDispatcher,
  createWorkspaceStateKeys,
  defineStateRuntimeSlice,
  dependencyModuleNames,
  devDependencyModuleNames,
  moduleName,
  toWorkspaceStateDescriptors,
} from '../src/index';
import type {
  CreateStateRuntimeInput,
  CreateWorkspaceActionDispatcherInput,
  PersistenceFailure,
  PersistenceFailureKind,
  PersistenceFlushMode,
  PersistenceHealth,
  PersistenceHealthListener,
  PersistenceOperationFailed,
  PersistenceOperationResult,
  PersistenceOperationSucceeded,
  PersistencePhase,
  PersistenceProtection,
  PersistenceStorageKind,
  PersistIntent,
  StateJsonObject,
  StateJsonPrimitive,
  StateJsonValue,
  StateResetActor,
  StateRoot,
  StateRuntime,
  StateRuntimePersistenceDescriptor,
  StateRuntimePersistenceFieldDescriptor,
  StateRuntimePersistenceRecordDescriptor,
  StateRuntimeSliceDescriptor,
  StateRuntimeSliceRegistration,
  StateRuntimeSyncDescriptor,
  StateRuntimeSyncRecordDescriptor,
  StateSyncSkipReason,
  StateSyncApplyResult,
  StateSyncPayloadResult,
  SyncIntent,
  SyncRecordState,
  SyncStateDiff,
  SyncStateDiffEntry,
  SyncStateSummary,
  SyncStateSummaryEntry,
  SyncValueEnvelope,
  ToWorkspaceStateDescriptorsInput,
  WorkspaceKey,
  WorkspaceRouteContext,
  WorkspaceStateKeys,
} from '../src/index';

// T-5: root action names are intentionally package-private and absent from the
// public package root. These imports must remain compile errors.
// @ts-expect-error root sync action type is not part of the public surface.
import {applyAuthoritativeSyncActionType} from '../src/index';
// @ts-expect-error root reset action type is not part of the public surface.
import {resetToOwnerInitialStateActionType} from '../src/index';

interface ExampleState {
  readonly enabled: boolean;
  readonly entries: Readonly<Record<string, StateJsonValue>>;
}

const reducer: Reducer<ExampleState> = (state = {enabled: false, entries: {}}) => state;

const syncDescriptor: StateRuntimeSyncRecordDescriptor<ExampleState> = {
  kind: 'record',
  getEntries: (state): SyncRecordState => {
    const entries: Record<string, SyncValueEnvelope> = {};
    for (const [key, value] of Object.entries(state.entries)) {
      entries[key] = {
        value,
        updatedAt: 1,
      };
    }
    return entries;
  },
  applyEntries: (state, entries): ExampleState => ({
    ...state,
    entries: Object.entries(entries).reduce<Record<string, StateJsonValue>>((result, [key, entry]) => {
      if (entry !== undefined && 'value' in entry && entry.value !== undefined) {
        result[key] = entry.value;
      }
      return result;
    }, {}),
  }),
};

const persistence = [
  {
    kind: 'field',
    stateKey: 'enabled',
  },
  {
    kind: 'record',
    getEntries: state => state.entries,
    applyEntries: (state, entries) => {
      const nextEntries: Record<string, StateJsonValue> = {};
      for (const [key, value] of Object.entries(entries)) {
        if (value !== undefined) {
          nextEntries[key] = value;
        }
      }
      return {...state, entries: nextEntries};
    },
  },
] satisfies readonly [
  StateRuntimePersistenceDescriptor<ExampleState>,
  ...StateRuntimePersistenceDescriptor<ExampleState>[],
];

const descriptor: StateRuntimeSliceDescriptor<ExampleState> = {
  name: 'example.state',
  reducer,
  persistIntent: 'owner-only',
  persistence,
  syncIntent: 'master-to-slave',
  sync: syncDescriptor,
};

const registration = defineStateRuntimeSlice(descriptor);
void registration;
const skipReason: StateSyncSkipReason = 'SYNC_NOT_DECLARED';
void skipReason;
void applyAuthoritativeSyncActionType;
void resetToOwnerInitialStateActionType;

// @ts-expect-error owner-only declarations require a non-empty persistence tuple.
const missingPersistence: StateRuntimeSliceDescriptor<ExampleState> = {
  name: 'example.missing-persistence',
  reducer,
  persistIntent: 'owner-only',
};
void missingPersistence;

// @ts-expect-error never declarations cannot contain persistence descriptors.
const forbiddenPersistence: StateRuntimeSliceDescriptor<ExampleState> = {
  name: 'example.forbidden-persistence',
  reducer,
  persistIntent: 'never',
  persistence,
};
void forbiddenPersistence;

// @ts-expect-error a directional sync intent requires a sync descriptor.
const missingSync: StateRuntimeSliceDescriptor<ExampleState> = {
  name: 'example.missing-sync',
  reducer,
  persistIntent: 'never',
  syncIntent: 'master-to-slave',
};
void missingSync;

// @ts-expect-error isolated slices cannot declare a sync descriptor.
const forbiddenSync: StateRuntimeSliceDescriptor<ExampleState> = {
  name: 'example.forbidden-sync',
  reducer,
  persistIntent: 'never',
  syncIntent: 'isolated',
  sync: syncDescriptor,
};
void forbiddenSync;

// @ts-expect-error a sync envelope must contain a value or a tombstone.
const missingSyncValue: SyncValueEnvelope = {
  updatedAt: 1,
};
void missingSyncValue;

const conflictingSyncValue: SyncValueEnvelope = {
  value: true,
  updatedAt: 1,
  // @ts-expect-error a sync envelope cannot contain both a value and a tombstone.
  tombstone: true,
};
void conflictingSyncValue;

// @ts-expect-error the opaque registration brand cannot be supplied by consumers.
const forgedRegistration: StateRuntimeSliceRegistration = {
  name: 'example.forged',
  persistIntent: 'never',
  syncIntent: 'isolated',
  hasPersistence: false,
  hasSync: false,
};
void forgedRegistration;

// @ts-expect-error the only supported workspace keys are MAIN and BRANCH.
const unsupportedWorkspace: WorkspaceKey = 'instanceMode';
void unsupportedWorkspace;

const full = createFullSliceSyncPayload(syncDescriptor, {
  enabled: false,
  entries: {},
});
const applied = applySliceSyncDiff(syncDescriptor, {enabled: false, entries: {}}, full);
void full;
void applied;
