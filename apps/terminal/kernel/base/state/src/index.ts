export {moduleName} from './moduleName';
export {dependencyModuleNames, devDependencyModuleNames} from './dependencies';

export type {
  StateJsonPrimitive,
  StateJsonValue,
  StateJsonObject,
} from './types/value';

export type {
  PersistIntent,
  PersistenceProtection,
  PersistenceFlushMode,
  PersistenceStorageKind,
  PersistencePhase,
  StateStorageTimeoutPolicy,
  StateRuntimePersistenceFieldDescriptor,
  StateRuntimePersistenceRecordDescriptor,
  StateRuntimePersistenceDescriptor,
  PersistenceFailureKind,
  PersistenceFailure,
  PersistenceHealth,
  PersistenceHealthListener,
  PersistenceOperationSucceeded,
  PersistenceOperationFailed,
  PersistenceOperationResult,
} from './types/persistence';

export type {
  SyncIntent,
  SyncValueEnvelope,
  SyncRecordState,
  SyncStateSummaryEntry,
  SyncStateSummary,
  SyncStateDiffEntry,
  SyncStateDiff,
  SyncDiffOptions,
  StateRuntimeSyncRecordDescriptor,
  StateRuntimeSyncDescriptor,
} from './types/sync';
export {
  createFullSliceSyncPayload,
  applySliceSyncDiff,
  createSyncTombstone,
} from './foundations/sync';

export type {
  StateRuntimeSliceDescriptor,
  StateRuntimeSliceRegistration,
} from './types/slice';
export {defineStateRuntimeSlice} from './foundations/defineStateRuntimeSlice';

export type {PartitionedStateKeys} from './types/partitioned';
export {
  createPartitionedActionDispatcher,
  createPartitionedStateKeys,
  readPartitionedState,
  toPartitionedStateDescriptors,
} from './foundations/partitioned';

export type {
  StateResetActor,
  StateSyncSkipReason,
  StateSyncPayloadResult,
  StateSyncApplyResult,
  CreateStateRuntimeInput,
  StateRoot,
  StateRuntime,
} from './types/runtime';
export {createStateRuntime} from './foundations/createStateRuntime';

export type {
  WorkspaceKey,
  WorkspaceStateKeys,
  WorkspaceRouteContext,
  CreateWorkspaceActionDispatcherInput,
  ToWorkspaceStateDescriptorsInput,
} from './types/workspace';
export {
  createWorkspaceStateKeys,
  createWorkspaceActionDispatcher,
  toWorkspaceStateDescriptors,
} from './foundations/workspace';
