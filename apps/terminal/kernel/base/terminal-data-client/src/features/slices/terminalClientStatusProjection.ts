import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {
  defineStateRuntimeSlice,
  type StateJsonValue,
  type StateRuntimeSliceRegistration,
  type SyncRecordState,
} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../../moduleName';
import type {
  TerminalActivationView,
  TerminalClientStatusProjection,
  TerminalClientStatusProjectionState,
  TerminalConnectionCloseReason,
  TerminalConnectionView,
} from '../../types/client';

export const terminalClientStatusProjectionSliceName = `${moduleName}.status-projection` as const;

const initialState: TerminalClientStatusProjectionState = Object.freeze({
  projection: Object.freeze({
    available: false,
    sourceNodeId: null,
    activation: null,
    connection: null,
    lastRttMs: null,
    updatedAt: 0,
  }),
});

const definition = createSlice({
  name: terminalClientStatusProjectionSliceName,
  initialState,
  reducers: {
    replaceProjection: (
      _state,
      action: PayloadAction<TerminalClientStatusProjection>,
    ): TerminalClientStatusProjectionState => Object.freeze({projection: Object.freeze(action.payload)}),
  },
});

const activationStatuses = new Set<TerminalActivationView['status']>([
  'inactive',
  'activating',
  'active',
  'cancelling',
]);
const connectionStatuses = new Set<TerminalConnectionView['status']>([
  'stopped',
  'disconnected',
  'connecting',
  'awaiting-ready',
  'connected',
  'backoff',
]);
const closeReasons = new Set<TerminalConnectionCloseReason>([
  'ACTIVATION_CANCELLED',
  'CREDENTIAL_INVALID',
  'GROUP_WORKSPACE_DISABLED',
  'TERMINAL_DISABLED',
  'SESSION_REPLACED',
  'REDIRECT_TO_NEXT_NODE',
  'NODE_BUSY',
  'AUTHENTICATION_TIMEOUT',
  'HEARTBEAT_TIMEOUT',
  'SERVER_ERROR',
  'NETWORK_ERROR',
  'UNKNOWN',
]);

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isNullableNumber = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value));
const hasExactKeys = (value: object, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
};

const parseProjection = (value: unknown): TerminalClientStatusProjection => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('TDC_STATUS_PROJECTION_INVALID');
  const record = value as Record<string, unknown>;
  if (
    !hasExactKeys(record, ['available', 'sourceNodeId', 'activation', 'connection', 'lastRttMs', 'updatedAt']) ||
    typeof record.available !== 'boolean' ||
    !Number.isSafeInteger(record.updatedAt) ||
    (record.updatedAt as number) < 0
  )
    throw new Error('TDC_STATUS_PROJECTION_INVALID');
  if (!record.available) {
    if (
      record.sourceNodeId !== null ||
      record.activation !== null ||
      record.connection !== null ||
      record.lastRttMs !== null
    )
      throw new Error('TDC_STATUS_PROJECTION_INVALID');
    return Object.freeze({
      available: false,
      sourceNodeId: null,
      activation: null,
      connection: null,
      lastRttMs: null,
      updatedAt: record.updatedAt as number,
    });
  }
  if (
    typeof record.sourceNodeId !== 'string' ||
    record.sourceNodeId.length === 0 ||
    typeof record.activation !== 'object' ||
    record.activation === null ||
    Array.isArray(record.activation) ||
    typeof record.connection !== 'object' ||
    record.connection === null ||
    Array.isArray(record.connection) ||
    typeof record.lastRttMs !== 'number' ||
    !Number.isFinite(record.lastRttMs) ||
    record.lastRttMs < 0
  )
    throw new Error('TDC_STATUS_PROJECTION_INVALID');
  const activation = record.activation as Record<string, unknown>;
  const connection = record.connection as Record<string, unknown>;
  if (
    !hasExactKeys(activation, ['status', 'terminalRef', 'storeRef', 'groupWorkspaceKey', 'bindingGeneration']) ||
    !hasExactKeys(connection, ['status', 'addressName', 'nodeId', 'lastCloseReason']) ||
    !activationStatuses.has(activation.status as TerminalActivationView['status']) ||
    !isNullableString(activation.terminalRef) ||
    !isNullableString(activation.storeRef) ||
    !isNullableString(activation.groupWorkspaceKey) ||
    !isNullableNumber(activation.bindingGeneration) ||
    !connectionStatuses.has(connection.status as TerminalConnectionView['status']) ||
    !isNullableString(connection.addressName) ||
    !isNullableString(connection.nodeId) ||
    !(
      connection.lastCloseReason === null ||
      closeReasons.has(connection.lastCloseReason as TerminalConnectionCloseReason)
    )
  )
    throw new Error('TDC_STATUS_PROJECTION_INVALID');
  return Object.freeze({
    available: true,
    sourceNodeId: record.sourceNodeId,
    activation: Object.freeze({
      status: activation.status as TerminalActivationView['status'],
      terminalRef: activation.terminalRef,
      storeRef: activation.storeRef,
      groupWorkspaceKey: activation.groupWorkspaceKey,
      bindingGeneration: activation.bindingGeneration,
    }),
    connection: Object.freeze({
      status: connection.status as TerminalConnectionView['status'],
      addressName: connection.addressName,
      nodeId: connection.nodeId,
      lastCloseReason: connection.lastCloseReason as TerminalConnectionCloseReason | null,
    }),
    lastRttMs: record.lastRttMs,
    updatedAt: record.updatedAt as number,
  });
};

export const terminalClientStatusProjectionActions = Object.freeze(definition.actions);
export const terminalClientStatusProjectionReducer = definition.reducer;
export const terminalClientStatusProjectionStateSlice: StateRuntimeSliceRegistration = defineStateRuntimeSlice({
  name: terminalClientStatusProjectionSliceName,
  reducer: definition.reducer,
  persistIntent: 'owner-only',
  persistence: [{kind: 'field', stateKey: 'projection', protection: 'plain', flushMode: 'immediate'}],
  syncIntent: 'master-to-slave',
  sync: {
    kind: 'record',
    getEntries: (state: TerminalClientStatusProjectionState): SyncRecordState<'current', StateJsonValue> => ({
      current: {value: state.projection as unknown as StateJsonValue, updatedAt: state.projection.updatedAt},
    }),
    applyEntries: (state: TerminalClientStatusProjectionState, entries): TerminalClientStatusProjectionState => {
      const entry = entries.current;
      if (entry === undefined || entry.tombstone === true) throw new Error('TDC_STATUS_PROJECTION_SYNC_INVALID');
      return Object.freeze({projection: parseProjection(entry.value)});
    },
  },
});
