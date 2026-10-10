import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice, type StateRuntimeSliceRegistration} from '@catering-v2s/kernel-base-state';
import type {RuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import type {
  PendingTerminalActivation,
  TerminalClientState,
  TerminalConnectionView,
  TerminalCredential,
  TerminalLatencySample,
  RemoteOperationFact,
  TerminalTopicNotification,
  TerminalTopicSubscription,
} from '../../types/client';

export const terminalDataClientSliceName = `${moduleName}.client` as const;

const initialState: TerminalClientState = Object.freeze({
  credential: null,
  credentialRevision: 0,
  credentialReadyRevision: null,
  credentialReadyInstanceMode: null,
  pendingActivations: Object.freeze({}),
  activationStatus: 'inactive',
  connection: Object.freeze({status: 'stopped', addressName: null, nodeId: null, sessionId: null, lastCloseReason: null}),
  heartbeatIntervalMs: null,
  nextPingSequence: 1,
  lastRttMs: 0,
  latencySamples: Object.freeze([]),
  topicSubscriptions: Object.freeze({}),
  acceptedTopicTimes: Object.freeze({}),
  remoteOperations: Object.freeze({}),
});

const credentialEntryKey = 'credential';
const credentialFields = ['bindingGeneration', 'credentialSecret', 'deviceId', 'groupWorkspaceKey', 'storeRef', 'terminalRef'] as const;
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const hasExactKeys = (value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean => {
  const keys = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return keys.length === sorted.length && keys.every((key, index) => key === sorted[index]);
};
const isCanonicalUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isTerminalCredential = (value: unknown): value is TerminalCredential => {
  if (!isRecord(value) || !hasExactKeys(value, credentialFields)) return false;
  return (
    typeof value.groupWorkspaceKey === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value.groupWorkspaceKey) &&
    isCanonicalUuid(value.terminalRef) &&
    isCanonicalUuid(value.storeRef) &&
    typeof value.deviceId === 'string' && value.deviceId.length > 0 && value.deviceId.length <= 128 &&
    Number.isSafeInteger(value.bindingGeneration) && Number(value.bindingGeneration) >= 1 &&
    typeof value.credentialSecret === 'string' && /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value.credentialSecret)
  );
};
const sameCredential = (left: TerminalCredential | null, right: TerminalCredential | null): boolean =>
  left === right || (left !== null && right !== null && credentialFields.every(field => left[field] === right[field]));

export const getTerminalDataClientSyncEntries = (
  state: Readonly<TerminalClientState>,
): Readonly<Record<string, Readonly<{readonly value: TerminalCredential | null; readonly updatedAt: 0}>>> => ({
  [credentialEntryKey]: Object.freeze({
    value:
      state.credential !== null &&
      state.credentialReadyRevision === state.credentialRevision &&
      state.credentialReadyInstanceMode === 'MASTER'
        ? state.credential
        : null,
    updatedAt: 0,
  }),
});

export const applyTerminalDataClientSyncEntries = (
  state: Readonly<TerminalClientState>,
  entries: Readonly<Record<string, unknown>>,
): TerminalClientState => {
  if (!hasExactKeys(entries, [credentialEntryKey])) throw new Error('TDC_SYNC_CREDENTIAL_ENTRY_SET_INVALID');
  const envelope = entries[credentialEntryKey];
  if (
    !isRecord(envelope) ||
    envelope.updatedAt !== 0 ||
    Object.prototype.hasOwnProperty.call(envelope, 'tombstone') ||
    !Object.prototype.hasOwnProperty.call(envelope, 'value')
  ) {
    throw new Error('TDC_SYNC_CREDENTIAL_ENVELOPE_INVALID');
  }
  const value = envelope.value;
  if (value !== null && !isTerminalCredential(value)) throw new Error('TDC_SYNC_CREDENTIAL_INVALID');
  const credential = value === null ? null : Object.freeze({...value});
  const credentialChanged = !sameCredential(state.credential, credential);
  const bindingChanged =
    state.credential?.terminalRef !== credential?.terminalRef ||
    state.credential?.storeRef !== credential?.storeRef ||
    state.credential?.bindingGeneration !== credential?.bindingGeneration ||
    state.credential?.groupWorkspaceKey !== credential?.groupWorkspaceKey;
  return Object.freeze({
    ...state,
    credential,
    credentialRevision: credentialChanged ? state.credentialRevision + 1 : state.credentialRevision,
    credentialReadyRevision: credentialChanged ? null : state.credentialReadyRevision,
    credentialReadyInstanceMode: credentialChanged ? null : state.credentialReadyInstanceMode,
    activationStatus: 'inactive',
    ...(bindingChanged ? {topicSubscriptions: Object.freeze({}), acceptedTopicTimes: Object.freeze({})} : {}),
  });
};

const definition = createSlice({
  name: terminalDataClientSliceName,
  initialState,
  reducers: {
    replaceCredential: (state, action: PayloadAction<TerminalCredential | null>) => {
      const previous = state.credential;
      const next = action.payload;
      const credentialChanged = !sameCredential(previous, next);
      if (
        previous?.terminalRef !== next?.terminalRef ||
        previous?.bindingGeneration !== next?.bindingGeneration ||
        previous?.groupWorkspaceKey !== next?.groupWorkspaceKey
      ) {
        state.topicSubscriptions = {};
        state.acceptedTopicTimes = {};
      }
      state.credential = action.payload;
      if (credentialChanged) {
        state.credentialRevision += 1;
        state.credentialReadyRevision = null;
        state.credentialReadyInstanceMode = null;
      }
      state.activationStatus = action.payload === null ? 'inactive' : 'active';
    },
    markCredentialReady: (
      state,
      action: PayloadAction<Readonly<{credentialRevision: number; instanceMode: RuntimeInstanceMode}>>,
    ) => {
      if (state.credential !== null && state.credentialRevision === action.payload.credentialRevision) {
        state.credentialReadyRevision = action.payload.credentialRevision;
        state.credentialReadyInstanceMode = action.payload.instanceMode;
      }
    },
    setPendingActivation: (state, action: PayloadAction<PendingTerminalActivation>) => {
      state.pendingActivations[action.payload.operationId] = action.payload;
      state.activationStatus = 'activating';
    },
    removePendingActivation: (state, action: PayloadAction<string>) => {
      delete state.pendingActivations[action.payload];
      if (state.credential === null && Object.keys(state.pendingActivations).length === 0) {
        state.activationStatus = 'inactive';
      }
    },
    setActivationStatus: (state, action: PayloadAction<TerminalClientState['activationStatus']>) => {
      state.activationStatus = action.payload;
    },
    setConnection: (state, action: PayloadAction<TerminalConnectionView>) => {
      state.connection = action.payload;
    },
    sessionReady: (
      state,
      action: PayloadAction<Readonly<{sessionId: string; nodeId: string; heartbeatIntervalMs: number; observedAt: number}>>,
    ) => {
      state.connection = {...state.connection, status: 'connected', nodeId: action.payload.nodeId, sessionId: action.payload.sessionId};
      state.heartbeatIntervalMs = action.payload.heartbeatIntervalMs;
      const maxSamples = Math.floor(7_200_000 / action.payload.heartbeatIntervalMs);
      const cutoff = action.payload.observedAt - 7_200_000;
      state.latencySamples = state.latencySamples.filter(sample => sample.observedAt >= cutoff).slice(-maxSamples);
    },
    nextPing: state => {
      state.nextPingSequence += 1;
    },
    recordRtt: (state, action: PayloadAction<TerminalLatencySample>) => {
      state.lastRttMs = action.payload.rttMs;
      const maxSamples = state.heartbeatIntervalMs === null ? 0 : Math.floor(7_200_000 / state.heartbeatIntervalMs);
      const cutoff = action.payload.observedAt - 7_200_000;
      state.latencySamples =
        maxSamples === 0
          ? []
          : [...state.latencySamples.filter(sample => sample.observedAt >= cutoff), action.payload].slice(-maxSamples);
    },
    putTopicSubscription: (
      state,
      action: PayloadAction<Readonly<{subscription: TerminalTopicSubscription; identityKey: string}>>,
    ) => {
      state.topicSubscriptions[action.payload.subscription.subscriptionId] = action.payload.subscription;
      if (state.acceptedTopicTimes[action.payload.identityKey] === undefined) {
        state.acceptedTopicTimes[action.payload.identityKey] = action.payload.subscription.acceptedTimeEpochMillis;
      }
    },
    removeTopicSubscription: (
      state,
      action: PayloadAction<Readonly<{subscriptionId: string; identityKey: string}>>,
    ) => {
      delete state.topicSubscriptions[action.payload.subscriptionId];
      if (!Object.values(state.topicSubscriptions).some(item => item.identityKey === action.payload.identityKey))
        delete state.acceptedTopicTimes[action.payload.identityKey];
    },
    restoreTopicSubscriptionIfAbsent: (
      state,
      action: PayloadAction<Readonly<{subscription: TerminalTopicSubscription; identityKey: string}>>,
    ) => {
      const {subscription, identityKey} = action.payload;
      if (
        Object.values(state.topicSubscriptions).some(
          item =>
            item.subscriberKey === subscription.subscriberKey &&
            item.topicKey === subscription.topicKey &&
            item.ownerRef === subscription.ownerRef,
        )
      )
        return;
      state.topicSubscriptions[subscription.subscriptionId] = subscription;
      if (state.acceptedTopicTimes[identityKey] === undefined)
        state.acceptedTopicTimes[identityKey] = subscription.acceptedTimeEpochMillis;
    },
    clearTopicSubscriptions: state => {
      state.topicSubscriptions = {};
      state.acceptedTopicTimes = {};
    },
    setTopicAcceptedTime: (
      state,
      action: PayloadAction<Readonly<{subscriptionId: string; identityKey: string; acceptedTimeEpochMillis: number}>>,
    ) => {
      const subscription = state.topicSubscriptions[action.payload.subscriptionId];
      if (subscription === undefined) return;
      state.acceptedTopicTimes[action.payload.identityKey] = action.payload.acceptedTimeEpochMillis;
      state.topicSubscriptions[action.payload.subscriptionId] = {
        ...subscription,
        acceptedTimeEpochMillis: action.payload.acceptedTimeEpochMillis,
      };
    },
    restoreTopicAcceptedTimeIfCurrent: (
      state,
      action: PayloadAction<
        Readonly<{
          subscriptionId: string;
          identityKey: string;
          notificationId: string;
          expectedAcceptedTimeEpochMillis: number;
          acceptedTimeEpochMillis: number;
        }>
      >,
    ) => {
      const subscription = state.topicSubscriptions[action.payload.subscriptionId];
      if (
        subscription?.pendingNotification?.notificationId !== action.payload.notificationId ||
        state.acceptedTopicTimes[action.payload.identityKey] !== action.payload.expectedAcceptedTimeEpochMillis
      )
        return;
      state.acceptedTopicTimes[action.payload.identityKey] = action.payload.acceptedTimeEpochMillis;
      state.topicSubscriptions[action.payload.subscriptionId] = {
        ...subscription,
        acceptedTimeEpochMillis: action.payload.acceptedTimeEpochMillis,
      };
    },
    setPendingTopicNotification: (
      state,
      action: PayloadAction<Readonly<{subscriptionId: string; notification: TerminalTopicNotification}>>,
    ) => {
      const subscription = state.topicSubscriptions[action.payload.subscriptionId];
      if (subscription === undefined) return;
      state.topicSubscriptions[action.payload.subscriptionId] = {
        ...subscription,
        pendingNotification: action.payload.notification,
      };
    },
    clearPendingTopicNotifications: state => {
      for (const [subscriptionId, subscription] of Object.entries(state.topicSubscriptions)) {
        if (subscription.pendingNotification !== null) {
          state.topicSubscriptions[subscriptionId] = {...subscription, pendingNotification: null};
        }
      }
    },
    clearPendingTopicNotification: (
      state,
      action: PayloadAction<Readonly<{subscriptionId: string; notificationId: string}>>,
    ) => {
      const subscription = state.topicSubscriptions[action.payload.subscriptionId];
      if (subscription?.pendingNotification?.notificationId === action.payload.notificationId) {
        state.topicSubscriptions[action.payload.subscriptionId] = {...subscription, pendingNotification: null};
      }
    },
    putRemoteOperation: (state, action: PayloadAction<RemoteOperationFact>) => {
      state.remoteOperations[action.payload.remoteOperationId] = action.payload;
    },
    removeRemoteOperation: (state, action: PayloadAction<string>) => {
      delete state.remoteOperations[action.payload];
    },
    clearRemoteOperations: state => {
      state.remoteOperations = {};
    },
    clearConnection: state => {
      state.connection = {...state.connection, status: 'stopped', addressName: null, nodeId: null, sessionId: null};
      state.heartbeatIntervalMs = null;
      state.nextPingSequence = 1;
      state.lastRttMs = 0;
      state.latencySamples = [];
    },
  },
});

export const terminalDataClientActions = Object.freeze(definition.actions);
export const terminalDataClientReducer = definition.reducer;

export const terminalDataClientStateSlice: StateRuntimeSliceRegistration = defineStateRuntimeSlice<TerminalClientState>(
  {
    name: terminalDataClientSliceName,
    reducer: definition.reducer,
    persistIntent: 'owner-only',
    persistence: [
      {kind: 'field', stateKey: 'credential', protection: 'plain', flushMode: 'immediate'},
      {kind: 'field', stateKey: 'acceptedTopicTimes', protection: 'plain', flushMode: 'immediate'},
      {kind: 'field', stateKey: 'remoteOperations', protection: 'plain', flushMode: 'immediate'},
    ],
    syncIntent: 'master-to-slave',
    sync: {
      kind: 'record',
      getEntries: getTerminalDataClientSyncEntries,
      applyEntries: applyTerminalDataClientSyncEntries,
    },
  },
);
