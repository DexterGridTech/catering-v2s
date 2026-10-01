import {describe, expect, it} from 'vitest';
import {createStateRuntime} from '@catering-v2s/kernel-base-state';
import {createFakeLogger, createFakeStorage} from '../../state/test/testSupport';
import {
  selectActivationState,
  selectConnectionLatency,
  selectConnectionState,
} from '../src/selectors/selectTerminalDataClientState';
import {
  terminalDataClientActions,
  terminalDataClientReducer,
  terminalDataClientStateSlice,
} from '../src/features/slices/terminalDataClient';

const initial = () => terminalDataClientReducer(undefined, {type: 'test/init'});
const root = (client: object) => ({[terminalDataClientStateSlice.name]: client});
const createPersistenceTestRuntime = (
  plainStorage: ReturnType<typeof createFakeStorage>,
  protectedStorage: ReturnType<typeof createFakeStorage>,
) =>
  createStateRuntime({
    runtimeName: 'terminal-data-client-persistence-boundary-test',
    environmentMode: 'TEST',
    slices: [terminalDataClientStateSlice],
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
    expect(selectors.connection).toMatchObject({status: 'connected', nodeId: 'tds-1'});
    expect(selectors.latency).toEqual({lastRttMs: 23, samples: [{rttMs: 23, observedAt: 110}]});
    expect(JSON.stringify(selectors).includes(secret)).toBe(false);
    expect(JSON.stringify(selectors).includes('credentialSecret')).toBe(false);
  });

  it('keeps samples only within two hours and the current heartbeat-derived count', () => {
    let state = initial();
    state = terminalDataClientReducer(
      state,
      terminalDataClientActions.sessionReady({
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
    expect([...protectedStorage.values.values()].join('\n')).toContain(activeSecret);

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

  it('does not persist an unfinished activation operation and drops it after a runtime restart', async () => {
    const plainStorage = createFakeStorage();
    const protectedStorage = createFakeStorage();
    const pendingSecret = 'B'.repeat(43);
    const pendingActivationCode = '12345678';
    const firstRuntime = await createPersistenceTestRuntime(plainStorage, protectedStorage);
    firstRuntime.getStore().dispatch(
      terminalDataClientActions.setPendingActivation({
        operationId: 'operation-1',
        groupWorkspaceKey: 'workspace-1',
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
});
