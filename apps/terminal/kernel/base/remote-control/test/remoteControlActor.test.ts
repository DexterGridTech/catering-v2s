import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ActorExecutionContext, CommandDefinition} from '@catering-v2s/kernel-base-runtime';
import {moduleName as terminalDataClientModuleName} from '@catering-v2s/kernel-base-terminal-data-client';
import {moduleName as topologyModuleName, topologySliceName} from '@catering-v2s/kernel-base-topology';
import type {RemoteControlPort} from '@catering-v2s/kernel-base-platform-ports';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {createRemoteControlActor} from '../src/features/actors/remoteControlActor';
import {remoteControlActions, remoteControlSliceName, type RemoteControlState} from '../src/features/slices/remoteControl';
import {joinRemoteControlCommand, remoteControlPortEventCommand, startRemoteControlCommand, stopRemoteControlCommand} from '../src/features/commands/commands';
import {selectRemoteControlStatus} from '../src/selectors/selectors';
import {registerTerminalRemoteControlCommand, reportTerminalRemoteControlCommand} from '@catering-v2s/kernel-base-terminal-data-client';

const sessionId = '00000000-0000-4000-8000-000000000019';
const endpointId = '00000000-0000-4000-8000-000000000020';

it('uses the exact Runtime command names carried by TDP remote operations', () => {
  expect(startRemoteControlCommand.commandName).toBe('kernel.base.remote-control.start-remote-control');
  expect(stopRemoteControlCommand.commandName).toBe('kernel.base.remote-control.stop-remote-control');
});

const registerResponse = {
  description: {
    sessionId,
    roomName: `rc_${sessionId}`,
    controllerIdentity: 'controller-1',
    topologyKind: 'MOBILE_SINGLE',
    masterEndpointId: endpointId,
    endpoints: [{endpointId, participantIdentity: 'terminal-1'}],
    screens: [{screen: 'main', endpointId}],
  },
  remainingLeaseMs: 30_000,
  grants: [{endpointId, roomName: `rc_${sessionId}`, participantIdentity: 'terminal-1', token: 'temporary-token', expiresAtEpochMillis: 1_800_000_030_000}],
} as const;

const makeDeferred = <TValue,>() => {
  let resolve!: (value: TValue) => void;
  const promise = new Promise<TValue>(accept => { resolve = accept; });
  return {promise, resolve};
};

const fixture = (portOverrides: Partial<RemoteControlPort> = {}) => {
  let state: Record<string, unknown> = {
    'kernel.base.runtime.instance-mode': {instanceMode: 'MASTER'},
    [`${terminalDataClientModuleName}.client`]: {
      credential: {bindingGeneration: 7, terminalRef: 'terminal-ref'},
      activationStatus: 'active',
      connection: {status: 'connected', sessionId: 'target-session'},
    },
    [topologySliceName]: {
      nodeId: 'node-master', displayName: 'Master', surfaceForm: 'mobile', displayCount: 1,
      masterLocator: null, peerIdentity: null, hostAddress: null, peerReachable: false,
      peerConnectionRevision: 0, peerStateSyncConnectionId: null,
      peerAppliedStateSyncRevisions: {}, peerFailedStateSyncRevisions: {},
      hostDesired: false, hostReconcileRevision: 0, hostActual: 'stopped', hostErrorCode: null,
      payloadFailure: null, revision: 0, repairPending: false,
    },
    'kernel.base.display-context.display-role': {displayRole: 'CHIEF', powerConfirmation: null},
    [remoteControlSliceName]: {sessionId: null, phase: 'idle', topologyKind: null, description: null, localEndpointId: null, readyScreens: [], reason: null, cleanup: null},
  };
  const events: Array<Readonly<Record<string, unknown>>> = [];
  const port: RemoteControlPort = {
    subscribeEvents: vi.fn(() => () => undefined),
    readLocalScreens: vi.fn(async (screens: Parameters<RemoteControlPort['readLocalScreens']>[0]) => ({
      status: 'succeeded' as const,
      value: screens.map(screen => ({...screen, windowIdentity: `window-${screen.surfaceKey}`, generation: 1})),
      completedAt: 1,
    })),
    begin: vi.fn(async () => ({status: 'succeeded' as const, value: {started: true as const}, completedAt: 1})),
    sendData: vi.fn(async () => ({status: 'succeeded' as const, value: {sent: true as const}, completedAt: 1})),
    dispatchPointer: vi.fn(async () => ({status: 'succeeded' as const, value: {dispatched: true}, completedAt: 1})),
    end: vi.fn(async () => ({status: 'succeeded' as const, value: {roomLeft: true, tracksReleased: 1, inputCancelled: true}, completedAt: 1})),
    ...portOverrides,
  };
  const logs: unknown[] = [];
  const scopedLogger = {
    info: vi.fn((event: unknown) => { logs.push(event); return {status: 'succeeded'}; }),
    warn: vi.fn((event: unknown) => { logs.push(event); return {status: 'succeeded'}; }),
    error: vi.fn((event: unknown) => { logs.push(event); return {status: 'succeeded'}; }),
  };
  const logger = {scope: () => scopedLogger};
  const actorRuntime = createRemoteControlActor({
    applicationId: 'sample-console',
    port,
    readSignalConfiguration: () => ({url: 'ws://127.0.0.1:7880', identity: 'development:1'}),
    now: () => 100,
  });
  const context = (commandName: string, payload: unknown): ActorExecutionContext => ({
    runtimeId: 'test-runtime',
    localNodeId: 'test-node',
    platformPorts: {logger} as never,
    command: {commandName, payload, commandId: 'test-command', requestId: 'test-request'} as never,
    actor: {actorKey: actorRuntime.actor.actorKey, moduleName: actorRuntime.actor.moduleName, actorName: actorRuntime.actor.actorName},
    getState: () => state as never,
    dispatchAction: (action: Parameters<ActorExecutionContext['dispatchAction']>[0]) => {
      const payloadValue = (action as {payload?: RemoteControlState}).payload;
      if (payloadValue !== undefined && action.type === remoteControlActions.replaceSession.type) state = {...state, [remoteControlSliceName]: payloadValue};
      return action;
    },
    flushPersistence: async () => ({status: 'succeeded'}),
    subscribeState: () => () => undefined,
    dispatchCommand: async (definition: CommandDefinition | string, payload: StateJsonValue) => {
      const commandNameValue = typeof definition === 'string' ? definition : definition.commandName;
      events.push({commandName: commandNameValue, payload});
      const body = commandNameValue === registerTerminalRemoteControlCommand.commandName
        ? {kind: 'success', body: registerResponse}
        : {kind: 'success', body: {remainingLeaseMs: 30_000}};
      return {
        requestId: 'child-request', commandId: 'child-command', status: 'completed',
        actorResults: [{actorKey: 'test.owner', status: 'completed', startedAt: 1, completedAt: 2, result: body, error: null}],
      } as never;
    },
    requestApplicationReset: () => undefined,
  } as unknown as ActorExecutionContext);
  const handler = (commandName: string) => actorRuntime.actor.handlers.find(item => item.commandName === commandName)!;
  return {actorRuntime, context, events, handler, port, logs, getState: () => state as never, setState: (next: Record<string, unknown>) => { state = next; }};
};

describe('remote-control owner lifecycle', () => {
  beforeEach(() => vi.useRealTimers());

  const activateFixtureSession = (remote: ReturnType<typeof fixture>) => {
    const current = selectRemoteControlStatus(remote.getState());
    remote.setState({
      ...remote.getState() as Record<string, unknown>,
      [remoteControlSliceName]: {
        ...current,
        sessionId,
        phase: 'active',
        description: registerResponse.description,
        localEndpointId: endpointId,
        readyScreens: [],
      },
    });
  };

  const sendDataEvent = async (remote: ReturnType<typeof fixture>, senderIdentity: string, message: unknown) =>
    remote.handler(remoteControlPortEventCommand.commandName).handle(remote.context(remoteControlPortEventCommand.commandName, {
      type: 'data', sessionId, senderIdentity, payload: Array.from(new TextEncoder().encode(JSON.stringify(message))),
    }));

  it('logs the precise endpoint stage when local screen discovery rejects the session', async () => {
    const remote = fixture({
      readLocalScreens: vi.fn(async () => ({
        status: 'failed' as const,
        port: 'remoteControl' as const,
        capability: 'android-window-screens',
        error: {code: 'WEB_REMOTE_CONTROL_SURFACE_UNAVAILABLE', message: 'fixture failure', retryable: false},
      })),
    });
    const result = await remote.handler(startRemoteControlCommand.commandName).handle(
      remote.context(startRemoteControlCommand.commandName, {sessionId, bindingGeneration: 7, targetSessionId: 'target-session'}),
    );

    expect(result).toMatchObject({status: 'rejected', reason: 'WEB_REMOTE_CONTROL_SURFACE_UNAVAILABLE'});
    expect(remote.logs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: 'remote-control.endpoint-preparation-rejected',
        data: expect.objectContaining({stage: 'local-screen-read', reason: 'WEB_REMOTE_CONTROL_SURFACE_UNAVAILABLE'}),
      }),
      expect.objectContaining({
        event: 'remote-control.session-endpoint-preparation-failed',
        data: expect.objectContaining({reason: 'WEB_REMOTE_CONTROL_SURFACE_UNAVAILABLE'}),
      }),
    ]));
    expect(JSON.stringify(remote.logs)).not.toContain('temporary-token');
    await remote.actorRuntime.dispose();
  });

  it('resends only its current ready screen to the controller and MASTER before acknowledging keepalive', async () => {
    const remote = fixture();
    const masterEndpointId = '00000000-0000-4000-8000-000000000024';
    const ready = {endpointId, screen: 'secondary', streamId: '00000000-0000-4000-8000-000000000025', trackSid: 'track-secondary', widthPx: 1920, heightPx: 1080};
    const description = {
      ...registerResponse.description,
      topologyKind: 'LAPTOP_PAIRED',
      masterEndpointId,
      endpoints: [
        {endpointId: masterEndpointId, participantIdentity: 'terminal-master'},
        {endpointId, participantIdentity: 'terminal-slave'},
      ],
      screens: [{screen: 'main', endpointId: masterEndpointId}, {screen: 'secondary', endpointId}],
    };
    remote.setState({
      ...remote.getState() as Record<string, unknown>,
      'kernel.base.runtime.instance-mode': {instanceMode: 'SLAVE'},
      [remoteControlSliceName]: {
        ...selectRemoteControlStatus(remote.getState()),
        sessionId,
        phase: 'active',
        description,
        localEndpointId: endpointId,
        readyScreens: [ready],
      },
    });
    const probeId = '00000000-0000-4000-8000-000000000026';

    await sendDataEvent(remote, 'controller-1', {v: 1, type: 'KEEPALIVE', sessionId, seq: 1, body: {probeId}});

    const calls = vi.mocked(remote.port.sendData).mock.calls.map(call => ({
      destinations: call[0].destinationIdentities,
      message: JSON.parse(new TextDecoder().decode(call[0].payload)),
    }));
    expect(calls).toEqual([
      {destinations: ['controller-1', 'terminal-master'], message: {v: 1, type: 'SCREEN_READY', sessionId, seq: 1, body: ready}},
      {destinations: ['controller-1'], message: {v: 1, type: 'KEEPALIVE_ACK', sessionId, seq: 2, body: {probeId}}},
    ]);
    await remote.actorRuntime.dispose();
  });

  it('does not invent a screen-ready declaration before local capture is ready', async () => {
    const remote = fixture();
    activateFixtureSession(remote);
    const probeId = '00000000-0000-4000-8000-000000000027';

    await sendDataEvent(remote, 'controller-1', {v: 1, type: 'KEEPALIVE', sessionId, seq: 1, body: {probeId}});

    expect(remote.port.sendData).toHaveBeenCalledTimes(1);
    expect(JSON.parse(new TextDecoder().decode(vi.mocked(remote.port.sendData).mock.calls[0]?.[0].payload))).toMatchObject({
      type: 'KEEPALIVE_ACK', body: {probeId},
    });
    await remote.actorRuntime.dispose();
  });

  it('treats a same-session start as idempotent while the first start is preparing its local window', async () => {
    const screensRead = makeDeferred<Awaited<ReturnType<RemoteControlPort['readLocalScreens']>>>();
    const readStarted = makeDeferred<void>();
    const remote = fixture({readLocalScreens: vi.fn(() => { readStarted.resolve(); return screensRead.promise; })});
    const payload = {sessionId, bindingGeneration: 7, targetSessionId: 'target-session'};
    const first = remote.handler(startRemoteControlCommand.commandName).handle(remote.context(startRemoteControlCommand.commandName, payload));
    await readStarted.promise;
    const second = await remote.handler(startRemoteControlCommand.commandName).handle(remote.context(startRemoteControlCommand.commandName, payload));
    expect(second).toEqual({sessionId, status: 'STARTING', reason: null});
    expect(remote.events.filter(item => item.commandName === registerTerminalRemoteControlCommand.commandName)).toHaveLength(1);
    expect(remote.port.begin).not.toHaveBeenCalled();
    screensRead.resolve({status: 'succeeded', value: [{screen: 'main', surfaceKey: 'PRIMARY', windowIdentity: 'window-primary', generation: 1}], completedAt: 1});
    await expect(first).resolves.toMatchObject({sessionId, status: 'STARTING'});
    expect(remote.port.begin).toHaveBeenCalledTimes(1);
    await remote.actorRuntime.dispose();
  });

  it('does not begin after the binding connection changes while a local window read is pending', async () => {
    const screensRead = makeDeferred<Awaited<ReturnType<RemoteControlPort['readLocalScreens']>>>();
    const readStarted = makeDeferred<void>();
    const remote = fixture({readLocalScreens: vi.fn(() => { readStarted.resolve(); return screensRead.promise; })});
    const payload = {sessionId, bindingGeneration: 7, targetSessionId: 'target-session'};
    const starting = remote.handler(startRemoteControlCommand.commandName).handle(remote.context(startRemoteControlCommand.commandName, payload));
    await readStarted.promise;
    remote.setState({...remote.getState() as Record<string, unknown>, [`${terminalDataClientModuleName}.client`]: {
      credential: {bindingGeneration: 7, terminalRef: 'terminal-ref'}, activationStatus: 'active',
      connection: {status: 'disconnected', sessionId: 'target-session'},
    }});
    await remote.handler(remoteControlPortEventCommand.commandName).handle(remote.context(remoteControlPortEventCommand.commandName, {type: 'state-changed'}));
    screensRead.resolve({status: 'succeeded', value: [{screen: 'main', surfaceKey: 'PRIMARY', windowIdentity: 'window-primary', generation: 1}], completedAt: 1});
    await expect(starting).resolves.toMatchObject({status: 'rejected'});
    expect(remote.port.begin).not.toHaveBeenCalled();
    expect(selectRemoteControlStatus(remote.getState()).phase).toBe('ended');
    expect(selectRemoteControlStatus(remote.getState()).reason).toBe('TDP_DISCONNECTED');
    await remote.actorRuntime.dispose();
  });

  it('clears lease, renewal, and watchdog timers when the runtime disposes an active endpoint', async () => {
    vi.useFakeTimers();
    const remote = fixture();
    const payload = {sessionId, bindingGeneration: 7, targetSessionId: 'target-session'};

    try {
      await expect(remote.handler(startRemoteControlCommand.commandName).handle(remote.context(startRemoteControlCommand.commandName, payload)))
        .resolves.toMatchObject({sessionId, status: 'STARTING'});
      expect(vi.getTimerCount()).toBe(3);

      await remote.actorRuntime.dispose();

      expect(remote.port.end).toHaveBeenCalledWith({sessionId});
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets a paired slave join with the shared active projection while its TDS connection remains stopped', async () => {
    const remote = fixture();
    const slaveEndpointId = '00000000-0000-4000-8000-000000000021';
    const roomName = `rc_${sessionId}`;
    const description = {
      sessionId,
      roomName,
      controllerIdentity: 'controller-1',
      topologyKind: 'LAPTOP_PAIRED',
      masterEndpointId: endpointId,
      endpoints: [
        {endpointId, participantIdentity: 'terminal-master'},
        {endpointId: slaveEndpointId, participantIdentity: 'terminal-slave'},
      ],
      screens: [
        {screen: 'main', endpointId},
        {screen: 'secondary', endpointId: slaveEndpointId},
      ],
    } as const;
    const grant = {
      endpointId: slaveEndpointId,
      roomName,
      participantIdentity: 'terminal-slave',
      token: 'temporary-peer-token',
      expiresAtEpochMillis: 1_800_000_030_000,
    } as const;
    remote.setState({
      ...remote.getState() as Record<string, unknown>,
      'kernel.base.runtime.instance-mode': {instanceMode: 'SLAVE'},
      [`${terminalDataClientModuleName}.status-projection`]: {
        projection: {
          available: true,
          sourceNodeId: 'node-master',
          activation: {
            status: 'active', terminalRef: 'terminal-ref', storeRef: 'store-ref',
            groupWorkspaceKey: 'workspace-key', bindingGeneration: 7,
          },
          connection: {status: 'stopped', addressName: null, nodeId: null, lastCloseReason: null},
          lastRttMs: null,
          updatedAt: 1,
        },
      },
      [topologySliceName]: {
        ...(remote.getState()[topologySliceName] as Record<string, unknown>),
        masterLocator: {
          host: '127.0.0.1', port: 7800, basePath: '/',
          identity: {
            protocolVersion: 1, moduleName: 'sample-console', nodeId: 'node-master',
            displayName: 'Master', instanceMode: 'MASTER', displayRole: 'CHIEF',
          },
        },
        peerReachable: true,
        peerStateSyncConnectionId: 'accepted-pair-connection',
      },
    });

    await expect(remote.handler(joinRemoteControlCommand.commandName).handle(
      remote.context(joinRemoteControlCommand.commandName, {description, grant}),
    )).resolves.toEqual({status: 'started', sessionId});

    expect(remote.port.readLocalScreens).toHaveBeenCalledWith([{screen: 'secondary', surfaceKey: 'PRIMARY'}]);
    expect(remote.port.begin).toHaveBeenCalledWith(expect.objectContaining({
      sessionId, roomName, participantIdentity: 'terminal-slave', token: 'temporary-peer-token',
    }));
    await remote.actorRuntime.dispose();
  });

  it.each([
    {label: 'inactive shared credential', activationStatus: 'inactive', masterApplicationId: 'sample-console', grantEndpointId: '00000000-0000-4000-8000-000000000021', screens: [{screen: 'main', endpointId}, {screen: 'secondary', endpointId: '00000000-0000-4000-8000-000000000021'}], reason: 'PAIR_NOT_READY'},
    {label: 'different application master', activationStatus: 'active', masterApplicationId: 'sample-wallpaper-console', grantEndpointId: '00000000-0000-4000-8000-000000000021', screens: [{screen: 'main', endpointId}, {screen: 'secondary', endpointId: '00000000-0000-4000-8000-000000000021'}], reason: 'PAIR_NOT_READY'},
    {label: 'grant for the master endpoint', activationStatus: 'active', masterApplicationId: 'sample-console', grantEndpointId: endpointId, screens: [{screen: 'main', endpointId}, {screen: 'secondary', endpointId: '00000000-0000-4000-8000-000000000021'}], reason: 'GRANT_INVALID'},
    {label: 'missing secondary screen mapping', activationStatus: 'active', masterApplicationId: 'sample-console', grantEndpointId: '00000000-0000-4000-8000-000000000021', screens: [{screen: 'main', endpointId}], reason: 'GRANT_INVALID'},
    {label: 'secondary screen mapped to the master endpoint', activationStatus: 'active', masterApplicationId: 'sample-console', grantEndpointId: '00000000-0000-4000-8000-000000000021', screens: [{screen: 'main', endpointId}, {screen: 'secondary', endpointId}], reason: 'GRANT_INVALID'},
    {label: 'slave grant mapped to the wrong screen', activationStatus: 'active', masterApplicationId: 'sample-console', grantEndpointId: '00000000-0000-4000-8000-000000000021', screens: [{screen: 'main', endpointId}, {screen: 'main', endpointId: '00000000-0000-4000-8000-000000000021'}], reason: 'GRANT_INVALID'},
  ])('rejects a paired slave join when $label', async invalidation => {
    const remote = fixture();
    const slaveEndpointId = '00000000-0000-4000-8000-000000000021';
    const description = {
      ...registerResponse.description,
      topologyKind: 'LAPTOP_PAIRED',
      endpoints: [
        {endpointId, participantIdentity: 'terminal-master'},
        {endpointId: slaveEndpointId, participantIdentity: 'terminal-slave'},
      ],
      screens: invalidation.screens,
    } as const;
    const masterApplicationId = invalidation.masterApplicationId;
    const activationStatus = invalidation.activationStatus;
    remote.setState({
      ...remote.getState() as Record<string, unknown>,
      'kernel.base.runtime.instance-mode': {instanceMode: 'SLAVE'},
      [`${terminalDataClientModuleName}.status-projection`]: {
        projection: {
          available: true, sourceNodeId: 'node-master',
          activation: {status: activationStatus, terminalRef: 'terminal-ref', storeRef: 'store-ref', groupWorkspaceKey: 'workspace-key', bindingGeneration: 7},
          connection: {status: 'stopped', addressName: null, nodeId: null, lastCloseReason: null},
          lastRttMs: null, updatedAt: 1,
        },
      },
      [topologySliceName]: {
        ...(remote.getState()[topologySliceName] as Record<string, unknown>),
        masterLocator: {
          host: '127.0.0.1', port: 7800, basePath: '/',
          identity: {protocolVersion: 1, moduleName: masterApplicationId, nodeId: 'node-master', displayName: 'Master', instanceMode: 'MASTER', displayRole: 'CHIEF'},
        },
        peerReachable: true,
        peerStateSyncConnectionId: 'accepted-pair-connection',
      },
    });

    await expect(remote.handler(joinRemoteControlCommand.commandName).handle(
      remote.context(joinRemoteControlCommand.commandName, {
        description,
        grant: {endpointId: invalidation.grantEndpointId, roomName: description.roomName, participantIdentity: invalidation.grantEndpointId === endpointId ? 'terminal-master' : 'terminal-slave', token: 'temporary-peer-token', expiresAtEpochMillis: 1_800_000_030_000},
      }),
    )).resolves.toMatchObject({status: 'rejected', reason: invalidation.reason});
    expect(remote.port.begin).not.toHaveBeenCalled();
    await remote.actorRuntime.dispose();
  });

  it('ends only the current session when an authorized member sends an unknown protocol message', async () => {
    const remote = fixture();
    activateFixtureSession(remote);

    await sendDataEvent(remote, 'controller-1', {
      v: 2, type: 'NEWER_PROTOCOL_MESSAGE', sessionId, seq: 1, body: {},
    });

    expect(selectRemoteControlStatus(remote.getState())).toMatchObject({phase: 'ended', reason: 'UNSUPPORTED_PROTOCOL'});
    const endPayload = vi.mocked(remote.port.sendData).mock.calls[0]?.[0].payload;
    expect(JSON.parse(new TextDecoder().decode(endPayload))).toMatchObject({type: 'SESSION_END', body: {reason: 'UNSUPPORTED_PROTOCOL'}});
    await remote.actorRuntime.dispose();
  });

  it('ignores unknown protocol messages from a participant outside the frozen session', async () => {
    const remote = fixture();
    activateFixtureSession(remote);

    await sendDataEvent(remote, 'unlisted-participant', {
      v: 2, type: 'NEWER_PROTOCOL_MESSAGE', sessionId, seq: 1, body: {},
    });

    expect(selectRemoteControlStatus(remote.getState()).phase).toBe('active');
    expect(remote.port.sendData).not.toHaveBeenCalled();
    await remote.actorRuntime.dispose();
  });

  it('preserves a valid peer SESSION_END reason instead of relabeling it as an admin action', async () => {
    const remote = fixture();
    activateFixtureSession(remote);

    await sendDataEvent(remote, 'terminal-1', {
      v: 1, type: 'SESSION_END', sessionId, seq: 1, body: {reason: 'SCREEN_DISCONNECTED'},
    });

    expect(selectRemoteControlStatus(remote.getState())).toMatchObject({phase: 'ended', reason: 'SCREEN_DISCONNECTED'});
    await remote.actorRuntime.dispose();
  });

  it('returns a correlated INVALID_MESSAGE for a malformed controller pointer without dispatching it', async () => {
    const remote = fixture();
    activateFixtureSession(remote);

    await sendDataEvent(remote, 'controller-1', {
      v: 1, type: 'POINTER', sessionId, seq: 9,
      body: {endpointId, screen: 'main', streamId: '00000000-0000-4000-8000-000000000021', gestureId: '00000000-0000-4000-8000-000000000022', phase: 'down'},
    });

    expect(remote.port.dispatchPointer).not.toHaveBeenCalled();
    const responsePayload = vi.mocked(remote.port.sendData).mock.calls[0]?.[0].payload;
    expect(JSON.parse(new TextDecoder().decode(responsePayload))).toMatchObject({
      type: 'INPUT_RESULT', body: {forSeq: 9, gestureId: '00000000-0000-4000-8000-000000000022', status: 'REJECTED', reason: 'INVALID_MESSAGE'},
    });
    expect(selectRemoteControlStatus(remote.getState()).phase).toBe('active');
    await remote.actorRuntime.dispose();
  });

  it('returns the accepted DOWN identity when local input cancels a gesture and accepts the next gesture', async () => {
    const remote = fixture();
    activateFixtureSession(remote);
    const streamId = '00000000-0000-4000-8000-000000000021';
    const firstGestureId = '00000000-0000-4000-8000-000000000022';
    const currentSession = remote.getState()[remoteControlSliceName] as RemoteControlState;
    remote.setState({
      ...remote.getState() as Record<string, unknown>,
      [remoteControlSliceName]: {
        ...currentSession,
        readyScreens: [{endpointId, screen: 'main', streamId, trackSid: 'track-main', widthPx: 1080, heightPx: 1920}],
      },
    });
    const pointer = (seq: number, gestureId: string) => ({
      v: 1,
      type: 'POINTER',
      sessionId,
      seq,
      body: {endpointId, screen: 'main', streamId, gestureId, phase: 'down', u: 0.5, v: 0.5},
    });

    await sendDataEvent(remote, 'controller-1', pointer(9, firstGestureId));
    await remote.handler(remoteControlPortEventCommand.commandName).handle(remote.context(remoteControlPortEventCommand.commandName, {
      type: 'local-input-conflict', sessionId, screen: 'main',
    }));

    const cancelled = JSON.parse(new TextDecoder().decode(vi.mocked(remote.port.sendData).mock.calls[1]?.[0].payload ?? new Uint8Array()));
    expect(cancelled).toMatchObject({
      type: 'INPUT_RESULT',
      body: {forSeq: 9, gestureId: firstGestureId, status: 'CANCELLED', reason: 'INPUT_CONFLICT'},
    });
    expect(remote.port.dispatchPointer).toHaveBeenNthCalledWith(2, {
      sessionId, screen: 'main', streamId, gestureId: firstGestureId, phase: 'cancel',
    });

    const nextGestureId = '00000000-0000-4000-8000-000000000023';
    await sendDataEvent(remote, 'controller-1', pointer(10, nextGestureId));
    const nextResult = JSON.parse(new TextDecoder().decode(vi.mocked(remote.port.sendData).mock.calls[2]?.[0].payload ?? new Uint8Array()));
    expect(nextResult).toMatchObject({type: 'INPUT_RESULT', body: {forSeq: 10, gestureId: nextGestureId, status: 'DISPATCHED', reason: null}});
    expect(remote.port.dispatchPointer).toHaveBeenNthCalledWith(3, {
      sessionId, screen: 'main', streamId, gestureId: nextGestureId, phase: 'down', u: 0.5, v: 0.5,
    });
    await remote.actorRuntime.dispose();
  });
});
