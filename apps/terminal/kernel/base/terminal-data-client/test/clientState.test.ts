import {describe, expect, it} from 'vitest';
import {createStateRuntime, defineStateRuntimeSlice} from '@catering-v2s/kernel-base-state';
import {createFakeLogger, createFakeStorage} from '../../state/test/testSupport';
import {
  selectActivationState,
  selectConnectionLatency,
  selectConnectionState,
} from '../src/selectors/selectTerminalDataClientState';
import {
  terminalDataClientSliceName,
  terminalDataClientActions,
  terminalDataClientReducer,
  terminalDataClientStateSlice,
  getTerminalDataClientSyncEntries,
  applyTerminalDataClientSyncEntries,
} from '../src/features/slices/terminalDataClient';
import type {TerminalClientState} from '../src/types/client';
import {
  terminalClientStatusProjectionActions,
  terminalClientStatusProjectionSliceName,
  terminalClientStatusProjectionStateSlice,
} from '../src/features/slices/terminalClientStatusProjection';
import {selectTerminalClientStatusProjection} from '../src/selectors/selectTerminalDataClientStatusProjection';

const initial = () => terminalDataClientReducer(undefined, {type: 'test/init'});
const runtimeInstanceModeSliceName = 'kernel.base.runtime.instance-mode' as const;
const runtimeInstanceModeTestSlice = defineStateRuntimeSlice({
  name: runtimeInstanceModeSliceName,
  reducer: (state: Readonly<{instanceMode: 'MASTER'}> | undefined = {instanceMode: 'MASTER'}) => state,
  persistIntent: 'never',
});
const root = (client: object) => ({
  [runtimeInstanceModeSliceName]: {instanceMode: 'MASTER'},
  [terminalDataClientStateSlice.name]: client,
});
const createPersistenceTestRuntime = (
  plainStorage: ReturnType<typeof createFakeStorage>,
  protectedStorage: ReturnType<typeof createFakeStorage>,
) =>
  createStateRuntime({
    runtimeName: 'terminal-data-client-persistence-boundary-test',
    environmentMode: 'TEST',
    slices: [runtimeInstanceModeTestSlice, terminalDataClientStateSlice],
    logger: createFakeLogger(),
    plainStorage,
    protectedStorage,
    persistenceKey: 'terminal-data-client-persistence-boundary-test',
    persistenceDebounceMs: 0,
  });

describe('terminal-data-client selectors', () => {
  it('reads activation, connection and latency after owner actions without exposing credential fields', () => {
    const secret = 'A'.repeat(43);
    let state = initial();
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 4,
        credentialSecret: secret,
      }),
    );
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.sessionReady({
        sessionId: 'tds-session-1',
        nodeId: 'tds-1',
        heartbeatIntervalMs: 10_000,
        observedAt: 100,
      }),
    );
    state = terminalDataClientReducer(state, terminalDataClientActions.recordRtt({rttMs: 23, observedAt: 110}));
    const selectors = {
      activation: selectActivationState(root(state)),
      connection: selectConnectionState(root(state)),
      latency: selectConnectionLatency(root(state), 120),
    };
    expect(selectors.activation.status).toBe('active');
    expect(selectors.connection).toMatchObject({status: 'connected', nodeId: 'tds-1', sessionId: 'tds-session-1'});
    expect(selectors.latency).toEqual({lastRttMs: 23, samples: [{rttMs: 23, observedAt: 110}]});
    expect(JSON.stringify(selectors).includes(secret)).toBe(false);
    expect(JSON.stringify(selectors).includes('credentialSecret')).toBe(false);
  });

  it('keeps samples only within two hours and the current heartbeat-derived count', () => {
    let state = initial();
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.sessionReady({
        sessionId: 'tds-session-2',
        nodeId: 'tds-1',
        heartbeatIntervalMs: 3_600_000,
        observedAt: 7_200_002,
      }),
    );
    state = terminalDataClientReducer(state, terminalDataClientActions.recordRtt({rttMs: 1, observedAt: 1}));
    state = terminalDataClientReducer(state, terminalDataClientActions.recordRtt({rttMs: 2, observedAt: 7_200_002}));
    const view = selectConnectionLatency(root(state), 7_200_002);
    expect(view.samples).toEqual([{rttMs: 2, observedAt: 7_200_002}]);
  });

  it('restores the active credential and derives the activation selector after a runtime restart', async () => {
    const plainStorage = createFakeStorage();
    const protectedStorage = createFakeStorage();
    const activeSecret = 'A'.repeat(43);
    const firstRuntime = await createPersistenceTestRuntime(plainStorage, protectedStorage);
    firstRuntime.getStore().dispatch(
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 2,
        credentialSecret: activeSecret,
      }),
    );
    expect((await firstRuntime.flushPersistence()).status).toBe('succeeded');
    expect([...plainStorage.values.values()].join('\n')).toContain(activeSecret);
    expect([...protectedStorage.values.values()].join('\n')).not.toContain(activeSecret);

    const restartedRuntime = await createPersistenceTestRuntime(plainStorage, protectedStorage);
    const restartedState = restartedRuntime.getState()[terminalDataClientStateSlice.name];
    expect(restartedState).toMatchObject({
      credential: {
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 2,
        credentialSecret: activeSecret,
      },
      pendingActivations: {},
    });
    expect(selectActivationState(restartedRuntime.getState()).status).toBe('active');
  });

  it('moves an existing protected credential to the same plain key before removing the protected copy', async () => {
    const plainStorage = createFakeStorage();
    const protectedStorage = createFakeStorage();
    const legacyProtectedSlice = defineStateRuntimeSlice<TerminalClientState>({
      name: terminalDataClientSliceName,
      reducer: terminalDataClientReducer,
      persistIntent: 'owner-only',
      persistence: [{kind: 'field', stateKey: 'credential', protection: 'protected', flushMode: 'immediate'}],
      syncIntent: 'isolated',
    });
    const legacyRuntime = await createStateRuntime({
      runtimeName: 'terminal-data-client-legacy-protected-test',
      environmentMode: 'TEST',
      slices: [runtimeInstanceModeTestSlice, legacyProtectedSlice],
      logger: createFakeLogger(),
      plainStorage,
      protectedStorage,
      persistenceKey: 'terminal-data-client-persistence-boundary-test',
      persistenceDebounceMs: 0,
    });
    const secret = 'A'.repeat(43);
    legacyRuntime.getStore().dispatch(
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: '00000000-0000-4000-8000-000000000001',
        storeRef: '00000000-0000-4000-8000-000000000002',
        deviceId: 'device-1',
        bindingGeneration: 3,
        credentialSecret: secret,
      }),
    );
    expect((await legacyRuntime.flushPersistence()).status).toBe('succeeded');
    expect([...protectedStorage.values.values()].join('\n')).toContain(secret);
    expect([...plainStorage.values.values()].join('\n')).not.toContain(secret);

    const currentRuntime = await createPersistenceTestRuntime(plainStorage, protectedStorage);
    expect((await currentRuntime.flushPersistence()).status).toBe('succeeded');
    expect([...plainStorage.values.values()].join('\n')).toContain(secret);
    expect([...protectedStorage.values.values()].join('\n')).not.toContain(secret);
  });

  it('keeps a protected credential intact when the new plain write fails', async () => {
    const credential = {
      groupWorkspaceKey: 'workspace-1',
      terminalRef: '00000000-0000-4000-8000-000000000001',
      storeRef: '00000000-0000-4000-8000-000000000002',
      deviceId: 'device-1',
      bindingGeneration: 3,
      credentialSecret: 'A'.repeat(43),
    };
    const plainStorage = createFakeStorage();
    const protectedStorage = createFakeStorage();
    const legacyProtectedSlice = defineStateRuntimeSlice<TerminalClientState>({
      name: terminalDataClientSliceName,
      reducer: terminalDataClientReducer,
      persistIntent: 'owner-only',
      persistence: [{kind: 'field', stateKey: 'credential', protection: 'protected', flushMode: 'immediate'}],
      syncIntent: 'isolated',
    });
    const legacyRuntime = await createStateRuntime({
      runtimeName: 'terminal-data-client-legacy-protected-failure-test',
      environmentMode: 'TEST',
      slices: [runtimeInstanceModeTestSlice, legacyProtectedSlice],
      logger: createFakeLogger(),
      plainStorage,
      protectedStorage,
      persistenceKey: 'terminal-data-client-persistence-boundary-test',
      persistenceDebounceMs: 0,
    });
    legacyRuntime.getStore().dispatch(terminalDataClientActions.replaceCredential(credential));
    expect((await legacyRuntime.flushPersistence()).status).toBe('succeeded');
    const protectedValue = [...protectedStorage.values.values()][0];
    if (protectedValue === undefined) throw new Error('TDC_LEGACY_PROTECTED_CREDENTIAL_MISSING');

    const key = [...protectedStorage.values.keys()][0];
    if (key === undefined) throw new Error('TDC_LEGACY_PROTECTED_KEY_MISSING');
    plainStorage.setOptions({failWrites: [key]});
    const currentRuntime = await createPersistenceTestRuntime(plainStorage, protectedStorage);
    expect((await currentRuntime.flushPersistence()).status).toBe('failed');
    expect(protectedStorage.values.get(key)).toBe(protectedValue);
    expect(plainStorage.values.has(key)).toBe(false);
  });

  it('persists accepted topic times but rebuilds active registrations after a runtime restart', async () => {
    const plainStorage = createFakeStorage();
    const protectedStorage = createFakeStorage();
    const firstRuntime = await createPersistenceTestRuntime(plainStorage, protectedStorage);
    firstRuntime.getStore().dispatch(
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        bindingGeneration: 2,
        credentialSecret: 'A'.repeat(43),
      }),
    );
    const identityKey =
      '["workspace-1","terminal-1","store-1",2,"feature.store-basic","STORE","00000000-0000-0000-0000-000000000001"]';
    const subscriptionId = '8b81d930-f455-407c-88b6-e777934e54c2';
    firstRuntime.getStore().dispatch(
      terminalDataClientActions.putTopicSubscription({
        identityKey,
        subscription: {
          subscriptionId,
          identityKey,
          subscriberKey: 'feature.store-basic',
          topicKey: 'STORE',
          ownerRef: '00000000-0000-0000-0000-000000000001',
          acceptedTimeEpochMillis: 100,
          pendingNotification: null,
        },
      }),
    );
    firstRuntime.getStore().dispatch(
      terminalDataClientActions.setTopicAcceptedTime({
        subscriptionId,
        identityKey,
        acceptedTimeEpochMillis: 200,
      }),
    );
    expect((await firstRuntime.flushPersistence()).status).toBe('succeeded');

    const restartedRuntime = await createPersistenceTestRuntime(plainStorage, protectedStorage);
    expect(restartedRuntime.getState()[terminalDataClientStateSlice.name]).toMatchObject({
      topicSubscriptions: {},
      acceptedTopicTimes: {[identityKey]: 200},
    });
  });

  it('does not persist an unfinished activation operation and drops it after a runtime restart', async () => {
    const plainStorage = createFakeStorage();
    const protectedStorage = createFakeStorage();
    const pendingSecret = 'B'.repeat(43);
    const pendingActivationCode = '12345678';
    const firstRuntime = await createPersistenceTestRuntime(plainStorage, protectedStorage);
    firstRuntime.getStore().dispatch(
      terminalDataClientActions.setPendingActivation({
        operationId: 'operation-1',
        activationCode: pendingActivationCode,
        deviceId: 'device-1',
        surfaceForm: 'laptop',
        appVersion: '1.0.0',
        credentialSecret: pendingSecret,
      }),
    );
    expect((await firstRuntime.flushPersistence()).status).toBe('succeeded');
    const protectedValues = [...protectedStorage.values.values()].join('\n');
    expect(protectedValues).not.toContain(pendingSecret);
    expect(protectedValues).not.toContain(pendingActivationCode);

    const restartedRuntime = await createPersistenceTestRuntime(plainStorage, protectedStorage);
    expect(restartedRuntime.getState()[terminalDataClientStateSlice.name]).toMatchObject({
      credential: null,
      pendingActivations: {},
    });
    expect(selectActivationState(restartedRuntime.getState()).status).toBe('inactive');
  });

  it('syncs a safe status projection without the local credential or pending secrets', async () => {
    const createProjectionRuntime = (
      key: string,
      plainStorage: ReturnType<typeof createFakeStorage> = createFakeStorage(),
      protectedStorage: ReturnType<typeof createFakeStorage> = createFakeStorage(),
    ) =>
      createStateRuntime({
        runtimeName: key,
        environmentMode: 'TEST',
        slices: [runtimeInstanceModeTestSlice, terminalDataClientStateSlice, terminalClientStatusProjectionStateSlice],
        logger: createFakeLogger(),
        plainStorage,
        protectedStorage,
        persistenceKey: key,
        persistenceDebounceMs: 0,
      });
    const host = await createProjectionRuntime('terminal-status-projection-host');
    const branchPlainStorage = createFakeStorage();
    const branchProtectedStorage = createFakeStorage();
    const branch = await createProjectionRuntime(
      'terminal-status-projection-branch',
      branchPlainStorage,
      branchProtectedStorage,
    );
    const secret = 'A'.repeat(43);
    const terminalRef = '00000000-0000-4000-8000-000000000001';
    const storeRef = '00000000-0000-4000-8000-000000000002';
    host.getStore().dispatch(
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'workspace-1',
        terminalRef,
        storeRef,
        deviceId: 'device-1',
        bindingGeneration: 3,
        credentialSecret: secret,
      }),
    );
    host.getStore().dispatch(
      terminalDataClientActions.setPendingActivation({
        operationId: 'operation-1',
        activationCode: '12345678',
        deviceId: 'device-1',
        surfaceForm: 'laptop',
        appVersion: '1.0.0',
        credentialSecret: secret,
      }),
    );
    host.getStore().dispatch(
      terminalClientStatusProjectionActions.replaceProjection({
        available: true,
        sourceNodeId: 'host-node-1',
        activation: {
          status: 'active',
          terminalRef,
          storeRef,
          groupWorkspaceKey: 'workspace-1',
          bindingGeneration: 3,
        },
        connection: {status: 'connected', addressName: 'primary', nodeId: 'tds-1', lastCloseReason: null},
        lastRttMs: 21,
        updatedAt: 100,
      }),
    );
    host.getStore().dispatch(
      terminalDataClientActions.markCredentialReady({credentialRevision: 1, instanceMode: 'MASTER'}),
    );
    const payload = host.createFullSyncPayload(terminalClientStatusProjectionSliceName);
    expect(payload.status).toBe('ready');
    if (payload.status !== 'ready') throw new Error('TDC_STATUS_PROJECTION_SYNC_NOT_READY');
    expect(JSON.stringify(payload.payload)).not.toContain(secret);
    expect(JSON.stringify(payload.payload)).not.toContain('credentialSecret');
    const credentialPayload = host.createFullSyncPayload(terminalDataClientSliceName);
    expect(credentialPayload.status).toBe('ready');
    if (credentialPayload.status !== 'ready') throw new Error('TDC_CREDENTIAL_SYNC_NOT_READY');
    expect(credentialPayload.payload).toEqual({
      mode: 'authoritative',
      replaceMissing: true,
      entries: [
        {
          key: 'credential',
          value: {
            value: {
              groupWorkspaceKey: 'workspace-1',
              terminalRef,
              storeRef,
              deviceId: 'device-1',
              bindingGeneration: 3,
              credentialSecret: secret,
            },
            updatedAt: 0,
          },
        },
      ],
    });
    expect(branch.applyAuthoritativeSync(terminalDataClientSliceName, credentialPayload.payload).status).toBe(
      'applied',
    );
    expect(branch.applyAuthoritativeSync(terminalClientStatusProjectionSliceName, payload.payload).status).toBe(
      'applied',
    );
    expect(selectTerminalClientStatusProjection(branch.getState())).toMatchObject({
      available: true,
      sourceNodeId: 'host-node-1',
      activation: {status: 'active', terminalRef},
      connection: {status: 'connected', nodeId: 'tds-1'},
      lastRttMs: 21,
      updatedAt: 100,
    });
    expect(branch.getState()[terminalDataClientSliceName]).toMatchObject({
      credential: {terminalRef, credentialSecret: secret},
      activationStatus: 'inactive',
      connection: {status: 'stopped'},
      pendingActivations: {},
      remoteOperations: {},
    });
    expect((await branch.flushPersistence()).status).toBe('succeeded');
    expect([...branchPlainStorage.values.values()].join('\n')).toContain(secret);
    expect([...branchProtectedStorage.values.values()].join('\n')).not.toContain(secret);
    const restartedBranch = await createProjectionRuntime(
      'terminal-status-projection-branch',
      branchPlainStorage,
      branchProtectedStorage,
    );
    expect(selectTerminalClientStatusProjection(restartedBranch.getState())).toMatchObject({
      available: true,
      sourceNodeId: 'host-node-1',
      activation: {status: 'active', terminalRef},
      lastRttMs: 21,
    });
    expect(restartedBranch.getState()[terminalDataClientSliceName]).toMatchObject({
      credential: {terminalRef, credentialSecret: secret},
      activationStatus: 'inactive',
    });
  });

  it('withholds sync until MASTER persistence readiness and rejects malformed projection records', () => {
    const credential = {
      groupWorkspaceKey: 'workspace-1',
      terminalRef: '00000000-0000-4000-8000-000000000001',
      storeRef: '00000000-0000-4000-8000-000000000002',
      deviceId: 'device-1',
      bindingGeneration: 1,
      credentialSecret: 'A'.repeat(43),
    };
    let state = initial();
    state = terminalDataClientReducer(state, terminalDataClientActions.replaceCredential(credential));
    expect(getTerminalDataClientSyncEntries(state).credential).toEqual({value: null, updatedAt: 0});
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.markCredentialReady({credentialRevision: state.credentialRevision, instanceMode: 'MASTER'}),
    );
    expect(getTerminalDataClientSyncEntries(state).credential).toEqual({value: credential, updatedAt: 0});
    expect(() => applyTerminalDataClientSyncEntries(state, {credential: {value: credential, updatedAt: 1}})).toThrow(
      'TDC_SYNC_CREDENTIAL_ENVELOPE_INVALID',
    );
    expect(() =>
      applyTerminalDataClientSyncEntries(state, {
        credential: {value: {...credential, credentialSecret: 'not-a-base64url-secret'}, updatedAt: 0},
      }),
    ).toThrow('TDC_SYNC_CREDENTIAL_INVALID');
    expect(() => applyTerminalDataClientSyncEntries(state, {credential: {value: credential, updatedAt: 0}, extra: {}})).toThrow(
      'TDC_SYNC_CREDENTIAL_ENTRY_SET_INVALID',
    );
    const applied = applyTerminalDataClientSyncEntries(initial(), {credential: {value: credential, updatedAt: 0}});
    expect(applied).toMatchObject({credential, activationStatus: 'inactive'});
    expect(applied.credentialReadyRevision).toBeNull();
  });
});
