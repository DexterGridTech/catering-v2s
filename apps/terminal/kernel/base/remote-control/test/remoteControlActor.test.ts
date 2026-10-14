import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ActorDispatchOptions, ActorExecutionContext, CommandDefinition} from '@catering-v2s/kernel-base-runtime';
import {
  moduleName as terminalDataClientModuleName,
  executeTerminalHttpCommand,
  terminalClientStatusProjectionSliceName,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {topologySliceName} from '@catering-v2s/kernel-base-topology';
import type {RemoteControlPort} from '@catering-v2s/kernel-base-platform-ports';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {createRemoteControlActor} from '../src/features/actors/remoteControlActor';
import {
  remoteControlActions,
  remoteControlSliceName,
  type RemoteControlState,
} from '../src/features/slices/remoteControl';
import {
  joinRemoteControlCommand,
  remoteControlPortEventCommand,
  startRemoteControlCommand,
  stopRemoteControlCommand,
} from '../src/declarations/commands';
import {selectRemoteControlStatus} from '../src/selectors/selectRemoteControlStatus';

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
  grants: [
    {
      endpointId,
      roomName: `rc_${sessionId}`,
      participantIdentity: 'terminal-1',
      token: 'temporary-token',
      expiresAtEpochMillis: 1_800_000_030_000,
    },
  ],
} as const;

const makeDeferred = <TValue>() => {
  let resolve!: (value: TValue) => void;
  const promise = new Promise<TValue>(accept => {
    resolve = accept;
  });
  return {promise, resolve};
};

const fixture = (portOverrides: Partial<RemoteControlPort> = {}, registrationResponse: unknown = registerResponse) => {
  let state: Record<string, unknown> = {
    'kernel.base.runtime.instance-mode': {instanceMode: 'MASTER'},
    [`${terminalDataClientModuleName}.client`]: {
      credential: {
        groupWorkspaceKey: 'development',
        bindingGeneration: 7,
        terminalRef: 'terminal-ref',
        storeRef: 'store-ref',
        deviceId: 'fixture-device',
        credentialSecret: 'S'.repeat(43),
      },
      credentialRevision: 1,
      credentialReadyRevision: 1,
      credentialReadyInstanceMode: 'MASTER',
      activationStatus: 'active',
      connection: {status: 'connected', sessionId: 'target-session'},
    },
    [serverConfigSliceName]: {
      selectedSpace: 'development',
      overrides: {},
      proxyPasswords: {},
      syncedHostDefaults: null,
      serviceRevisions: {business: 1},
    },
    [topologySliceName]: {
      nodeId: 'node-master',
      displayName: 'Master',
      surfaceForm: 'mobile',
      displayCount: 1,
      masterLocator: null,
      peerIdentity: null,
      hostAddress: null,
      peerReachable: false,
      peerConnectionRevision: 0,
      peerStateSyncConnectionId: null,
      peerAppliedStateSyncRevisions: {},
      peerFailedStateSyncRevisions: {},
      hostDesired: false,
      hostReconcileRevision: 0,
      hostActual: 'stopped',
      hostErrorCode: null,
      payloadFailure: null,
      revision: 0,
      repairPending: false,
    },
    'kernel.base.display-context.display-role': {displayRole: 'CHIEF', powerConfirmation: null},
    [remoteControlSliceName]: {
      sessionId: null,
      phase: 'idle',
      topologyKind: null,
      description: null,
      localEndpointId: null,
      readyScreens: [],
      reason: null,
      cleanup: null,
    },
  };
  const events: Array<Readonly<Record<string, unknown>>> = [];
  const dispatchCalls: Array<Readonly<{commandName: string; pathAndQuery?: string; requestId?: string}>> = [];
  const throwingHttpPaths = new Set<string>();
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
    end: vi.fn(async () => ({
      status: 'succeeded' as const,
      value: {roomLeft: true, tracksReleased: 1, inputCancelled: true},
      completedAt: 1,
    })),
    ...portOverrides,
  };
  const logs: unknown[] = [];
  const scopedLogger = {
    info: vi.fn((event: unknown) => {
      logs.push(event);
      return {status: 'succeeded'};
    }),
    warn: vi.fn((event: unknown) => {
      logs.push(event);
      return {status: 'succeeded'};
    }),
    error: vi.fn((event: unknown) => {
      logs.push(event);
      return {status: 'succeeded'};
    }),
  };
  const logger = {scope: () => scopedLogger};
  const actorRuntime = createRemoteControlActor({
    topologyModuleName: 'ui.integration.sample-console',
    port,
    readSignalConfiguration: () => ({url: 'ws://127.0.0.1:7880', identity: 'development:1'}),
    now: () => 100,
  });
  const context = (
    commandName: string,
    payload: unknown,
    requestId: string | null = 'test-request',
  ): ActorExecutionContext =>
    ({
      runtimeId: 'test-runtime',
      localNodeId: 'test-node',
      platformPorts: {logger} as never,
      command: {commandName, payload, commandId: 'test-command', requestId} as never,
      actor: {
        actorKey: actorRuntime.actor.actorKey,
        moduleName: actorRuntime.actor.moduleName,
        actorName: actorRuntime.actor.actorName,
      },
      getState: () => state as never,
      dispatchAction: (action: Parameters<ActorExecutionContext['dispatchAction']>[0]) => {
        const payloadValue = (action as {payload?: RemoteControlState}).payload;
        if (payloadValue !== undefined && action.type === remoteControlActions.replaceSession.type)
          state = {...state, [remoteControlSliceName]: payloadValue};
        return action;
      },
      flushPersistence: async () => ({status: 'succeeded'}),
      subscribeState: () => () => undefined,
      dispatchCommand: async (
        definition: CommandDefinition | string,
        payload: StateJsonValue,
        options: ActorDispatchOptions = {},
      ) => {
        const commandNameValue = typeof definition === 'string' ? definition : definition.commandName;
        events.push({commandName: commandNameValue, payload});
        const httpRequest =
          commandNameValue === executeTerminalHttpCommand.commandName &&
          typeof payload === 'object' &&
          payload !== null &&
          'request' in payload
            ? (payload as {request?: {pathAndQuery?: string; body?: {kind?: string; value?: unknown}}}).request
            : undefined;
        const pathAndQuery = httpRequest?.pathAndQuery;
        dispatchCalls.push({
          commandName: commandNameValue,
          ...(pathAndQuery === undefined ? {} : {pathAndQuery}),
          ...(options.requestId === undefined ? {} : {requestId: String(options.requestId)}),
        });
        if (pathAndQuery !== undefined && throwingHttpPaths.has(pathAndQuery))
          throw new Error('fixture dispatch failure');
        const reportBody =
          httpRequest?.body?.kind === 'json' &&
          typeof httpRequest.body.value === 'object' &&
          httpRequest.body.value !== null
            ? (httpRequest.body.value as Record<string, unknown>)
            : {};
        const result =
          commandNameValue === executeTerminalHttpCommand.commandName && pathAndQuery?.endsWith('/registration')
            ? {kind: 'response', status: 200, body: registrationResponse}
            : commandNameValue === executeTerminalHttpCommand.commandName
              ? {
                  kind: 'response',
                  status: 200,
                  body: {
                    sessionId: typeof reportBody.sessionId === 'string' ? reportBody.sessionId : sessionId,
                    state: typeof reportBody.state === 'string' ? reportBody.state : 'ACTIVE',
                    reason: typeof reportBody.reason === 'string' ? reportBody.reason : null,
                    remainingLeaseMs: 30_000,
                  },
                }
              : commandNameValue === joinRemoteControlCommand.commandName
                ? {status: 'started', sessionId}
                : {status: 'completed'};
        const actorResults =
          commandNameValue === joinRemoteControlCommand.commandName && options.target === 'peer'
            ? [
                {
                  actorKey: 'kernel.base.runtime.peer-dispatch',
                  status: 'completed',
                  startedAt: 1,
                  completedAt: 2,
                  result: {
                    actorResults: [
                      {
                        actorKey: 'ui.integration.sample-console.kernel.base.remote-control.actor',
                        status: 'completed',
                        startedAt: 1,
                        completedAt: 2,
                        result,
                        error: null,
                      },
                    ],
                  },
                  error: null,
                },
              ]
            : [{actorKey: 'test.owner', status: 'completed', startedAt: 1, completedAt: 2, result, error: null}];
        return {
          requestId: 'child-request',
          commandId: 'child-command',
          status: 'completed',
          actorResults,
        } as never;
      },
      requestApplicationReset: () => undefined,
    }) as unknown as ActorExecutionContext;
  const handler = (commandName: string) => actorRuntime.actor.handlers.find(item => item.commandName === commandName)!;
  return {
    actorRuntime,
    context,
    events,
    dispatchCalls,
    handler,
    port,
    logs,
    throwingHttpPaths,
    getState: () => state as never,
    setState: (next: Record<string, unknown>) => {
      state = next;
    },
  };
};

describe('remote-control owner lifecycle', () => {
  beforeEach(() => vi.useRealTimers());

  it('starts paired control when the accepted peer carries this integration module identity', async () => {
    const peerEndpointId = '00000000-0000-4000-8000-000000000021';
    const pairedResponse = {
      ...registerResponse,
      description: {
        ...registerResponse.description,
        topologyKind: 'LAPTOP_PAIRED',
        endpoints: [
          {endpointId, participantIdentity: 'terminal-master'},
          {endpointId: peerEndpointId, participantIdentity: 'terminal-peer'},
        ],
        screens: [
          {screen: 'main', endpointId},
          {screen: 'secondary', endpointId: peerEndpointId},
        ],
      },
      grants: [
        {...registerResponse.grants[0], participantIdentity: 'terminal-master'},
        {
          endpointId: peerEndpointId,
          roomName: `rc_${sessionId}`,
          participantIdentity: 'terminal-peer',
          token: 'temporary-peer-token',
          expiresAtEpochMillis: 1_800_000_030_000,
        },
      ],
    } as const;
    const remote = fixture({}, pairedResponse);
    remote.setState({
      ...(remote.getState() as Record<string, unknown>),
      [topologySliceName]: {
        ...(remote.getState()[topologySliceName] as Record<string, unknown>),
        surfaceForm: 'laptop',
        peerIdentity: {
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          nodeId: 'node-peer',
          displayName: 'Peer',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        },
        peerReachable: true,
        peerStateSyncConnectionId: 'accepted-peer-connection',
      },
    });

    const startResult = await remote.handler(startRemoteControlCommand.commandName).handle(
      remote.context(startRemoteControlCommand.commandName, {
        sessionId,
        bindingGeneration: 7,
        targetSessionId: 'target-session',
      }),
    );
    expect(startResult).toMatchObject({sessionId, status: 'STARTING'});
    expect(remote.events).toContainEqual(
      expect.objectContaining({
        commandName: executeTerminalHttpCommand.commandName,
        payload: expect.objectContaining({
          request: expect.objectContaining({
            pathAndQuery: `/remote-control-sessions/${sessionId}/registration`,
            body: expect.objectContaining({
              kind: 'json',
              value: expect.objectContaining({
                topologyKind: 'LAPTOP_PAIRED',
                peerIdentity: expect.objectContaining({moduleName: 'ui.integration.sample-console'}),
              }),
            }),
          }),
        }),
      }),
    );
    expect(remote.events).toContainEqual(expect.objectContaining({commandName: joinRemoteControlCommand.commandName}));
    expect(remote.logs).toContainEqual(
      expect.objectContaining({
        event: 'remote-control.peer-endpoint-join-completed',
        data: expect.objectContaining({
          dispatchStatus: 'completed',
          actorStatus: 'completed',
          actorResultCount: 1,
          resultStatus: 'started',
        }),
      }),
    );
    expect(remote.logs).toContainEqual(
      expect.objectContaining({event: 'remote-control.session-started', data: expect.objectContaining({paired: true})}),
    );
    expect(remote.logs).toContainEqual(
      expect.objectContaining({
        event: 'remote-control.start-command-received',
        data: expect.objectContaining({
          topologyKind: 'LAPTOP_PAIRED',
          paired: true,
          peerModuleName: 'ui.integration.sample-console',
          peerReachable: true,
          stateSyncConnectionReady: true,
        }),
      }),
    );
    await remote.actorRuntime.dispose();
  });

  it('rejects paired control when the accepted peer belongs to a different integration module', async () => {
    const remote = fixture();
    remote.setState({
      ...(remote.getState() as Record<string, unknown>),
      [topologySliceName]: {
        ...(remote.getState()[topologySliceName] as Record<string, unknown>),
        surfaceForm: 'laptop',
        peerIdentity: {
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-wallpaper-console',
          nodeId: 'node-peer',
          displayName: 'Peer',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        },
        peerReachable: true,
        peerStateSyncConnectionId: 'accepted-peer-connection',
      },
    });

    await expect(
      remote.handler(startRemoteControlCommand.commandName).handle(
        remote.context(startRemoteControlCommand.commandName, {
          sessionId,
          bindingGeneration: 7,
          targetSessionId: 'target-session',
        }),
      ),
    ).resolves.toMatchObject({status: 'rejected', reason: 'PAIR_NOT_READY'});
    expect(remote.events).not.toContainEqual(
      expect.objectContaining({
        commandName: executeTerminalHttpCommand.commandName,
        payload: expect.objectContaining({
          request: expect.objectContaining({pathAndQuery: `/remote-control-sessions/${sessionId}/registration`}),
        }),
      }),
    );
    await remote.actorRuntime.dispose();
  });

  const activateFixtureSession = (remote: ReturnType<typeof fixture>) => {
    const current = selectRemoteControlStatus(remote.getState());
    remote.setState({
      ...(remote.getState() as Record<string, unknown>),
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

  const dispatchDataEvent = (remote: ReturnType<typeof fixture>, senderIdentity: string, message: unknown) =>
    remote.handler(remoteControlPortEventCommand.commandName).handle(
      remote.context(remoteControlPortEventCommand.commandName, {
        type: 'data',
        sessionId,
        senderIdentity,
        payload: Array.from(new TextEncoder().encode(JSON.stringify(message))),
      }),
    );
  const sendDataEvent = async (remote: ReturnType<typeof fixture>, senderIdentity: string, message: unknown) =>
    dispatchDataEvent(remote, senderIdentity, message);

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
      remote.context(startRemoteControlCommand.commandName, {
        sessionId,
        bindingGeneration: 7,
        targetSessionId: 'target-session',
      }),
    );

    expect(result).toMatchObject({status: 'rejected', reason: 'WEB_REMOTE_CONTROL_SURFACE_UNAVAILABLE'});
    expect(remote.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'remote-control.endpoint-preparation-rejected',
          data: expect.objectContaining({stage: 'local-screen-read', reason: 'WEB_REMOTE_CONTROL_SURFACE_UNAVAILABLE'}),
        }),
        expect.objectContaining({
          event: 'remote-control.session-endpoint-preparation-failed',
          data: expect.objectContaining({reason: 'WEB_REMOTE_CONTROL_SURFACE_UNAVAILABLE'}),
        }),
      ]),
    );
    expect(JSON.stringify(remote.logs)).not.toContain('temporary-token');
    await remote.actorRuntime.dispose();
  });

  it('resends only its current ready screen to the controller and MASTER before acknowledging keepalive', async () => {
    const remote = fixture();
    const masterEndpointId = '00000000-0000-4000-8000-000000000024';
    const ready = {
      endpointId,
      screen: 'secondary',
      streamId: '00000000-0000-4000-8000-000000000025',
      trackSid: 'track-secondary',
      widthPx: 1920,
      heightPx: 1080,
    };
    const description = {
      ...registerResponse.description,
      topologyKind: 'LAPTOP_PAIRED',
      masterEndpointId,
      endpoints: [
        {endpointId: masterEndpointId, participantIdentity: 'terminal-master'},
        {endpointId, participantIdentity: 'terminal-slave'},
      ],
      screens: [
        {screen: 'main', endpointId: masterEndpointId},
        {screen: 'secondary', endpointId},
      ],
    };
    remote.setState({
      ...(remote.getState() as Record<string, unknown>),
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
      {
        destinations: ['controller-1', 'terminal-master'],
        message: {v: 1, type: 'SCREEN_READY', sessionId, seq: 1, body: ready},
      },
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
    expect(
      JSON.parse(new TextDecoder().decode(vi.mocked(remote.port.sendData).mock.calls[0]?.[0].payload)),
    ).toMatchObject({
      type: 'KEEPALIVE_ACK',
      body: {probeId},
    });
    await remote.actorRuntime.dispose();
  });

  it('logs a thrown ACTIVE report dispatch before ending the session', async () => {
    const remote = fixture();
    remote.throwingHttpPaths.add(`/remote-control-sessions/${sessionId}/status`);
    await remote.handler(startRemoteControlCommand.commandName).handle(
      remote.context(startRemoteControlCommand.commandName, {
        sessionId,
        bindingGeneration: 7,
        targetSessionId: 'target-session',
      }),
    );

    await remote.handler(remoteControlPortEventCommand.commandName).handle(
      remote.context(remoteControlPortEventCommand.commandName, {
        type: 'screen-ready',
        sessionId,
        screen: 'main',
        streamId: endpointId,
        trackSid: 'track-main',
        widthPx: 1920,
        heightPx: 1080,
      }),
    );

    const reportRequestId = remote.dispatchCalls.find(
      item =>
        item.commandName === executeTerminalHttpCommand.commandName &&
        item.pathAndQuery === `/remote-control-sessions/${sessionId}/status`,
    )?.requestId;
    expect(reportRequestId).toEqual(expect.any(String));
    expect(remote.logs).toContainEqual(
      expect.objectContaining({
        event: 'remote-control.status-report-dispatch-started',
        data: expect.objectContaining({sessionId, requestId: reportRequestId, state: 'ACTIVE', readyScreenCount: 1}),
      }),
    );
    expect(remote.logs).toContainEqual(
      expect.objectContaining({
        event: 'remote-control.status-report-dispatch-threw',
        data: expect.objectContaining({sessionId, requestId: reportRequestId, state: 'ACTIVE', errorName: 'Error'}),
      }),
    );
    expect(selectRemoteControlStatus(remote.getState())).toMatchObject({phase: 'ended', reason: 'START_FAILED'});
    expect(JSON.stringify(remote.logs)).not.toContain('fixture dispatch failure');
    await remote.actorRuntime.dispose();
  });

  it('assigns a request identity when ACTIVE status reporting follows a requestless port event', async () => {
    const remote = fixture();
    await remote.handler(startRemoteControlCommand.commandName).handle(
      remote.context(startRemoteControlCommand.commandName, {
        sessionId,
        bindingGeneration: 7,
        targetSessionId: 'target-session',
      }),
    );
    await remote.handler(remoteControlPortEventCommand.commandName).handle(
      remote.context(
        remoteControlPortEventCommand.commandName,
        {
          type: 'screen-ready',
          sessionId,
          screen: 'main',
          streamId: endpointId,
          trackSid: 'track-main',
          widthPx: 1920,
          heightPx: 1080,
        },
        null,
      ),
    );

    const reportRequestId = remote.dispatchCalls.find(
      item =>
        item.commandName === executeTerminalHttpCommand.commandName &&
        item.pathAndQuery === `/remote-control-sessions/${sessionId}/status`,
    )?.requestId;
    expect(reportRequestId).toEqual(expect.any(String));
    expect(remote.logs).toContainEqual(
      expect.objectContaining({
        event: 'remote-control.status-report-dispatch-started',
        data: expect.objectContaining({sessionId, requestId: reportRequestId}),
      }),
    );
    expect(remote.logs).toContainEqual(
      expect.objectContaining({
        event: 'remote-control.status-report-dispatch-completed',
        data: expect.objectContaining({sessionId, requestId: reportRequestId}),
      }),
    );
    await remote.actorRuntime.dispose();
  });

  it('preserves the current request identity when ACTIVE status reporting has a parent request', async () => {
    const remote = fixture();
    await remote.handler(startRemoteControlCommand.commandName).handle(
      remote.context(startRemoteControlCommand.commandName, {
        sessionId,
        bindingGeneration: 7,
        targetSessionId: 'target-session',
      }),
    );
    await remote.handler(remoteControlPortEventCommand.commandName).handle(
      remote.context(
        remoteControlPortEventCommand.commandName,
        {
          type: 'screen-ready',
          sessionId,
          screen: 'main',
          streamId: endpointId,
          trackSid: 'track-main',
          widthPx: 1920,
          heightPx: 1080,
        },
        'port-event-request',
      ),
    );

    expect(
      remote.dispatchCalls.find(
        item =>
          item.commandName === executeTerminalHttpCommand.commandName &&
          item.pathAndQuery === `/remote-control-sessions/${sessionId}/status`,
      )?.requestId,
    ).toBe('port-event-request');
    await remote.actorRuntime.dispose();
  });

  it('assigns a request identity to lease-expiry stop dispatched from a requestless timer', async () => {
    vi.useFakeTimers();
    const remote = fixture();
    try {
      await remote.handler(startRemoteControlCommand.commandName).handle(
        remote.context(startRemoteControlCommand.commandName, {
          sessionId,
          bindingGeneration: 7,
          targetSessionId: 'target-session',
        }),
      );
      await remote.handler(remoteControlPortEventCommand.commandName).handle(
        remote.context(
          remoteControlPortEventCommand.commandName,
          {
            type: 'screen-ready',
            sessionId,
            screen: 'main',
            streamId: endpointId,
            trackSid: 'track-main',
            widthPx: 1920,
            heightPx: 1080,
          },
          null,
        ),
      );

      await vi.advanceTimersByTimeAsync(30_000);

      expect(
        remote.dispatchCalls.find(item => item.commandName === stopRemoteControlCommand.commandName)?.requestId,
      ).toEqual(expect.any(String));
    } finally {
      await remote.actorRuntime.dispose();
      vi.useRealTimers();
    }
  });

  it('assigns a request identity to peer stop dispatched from a requestless topology event', async () => {
    const remote = fixture();
    await remote.handler(startRemoteControlCommand.commandName).handle(
      remote.context(startRemoteControlCommand.commandName, {
        sessionId,
        bindingGeneration: 7,
        targetSessionId: 'target-session',
      }),
    );
    remote.setState({
      ...(remote.getState() as Record<string, unknown>),
      [topologySliceName]: {
        ...(remote.getState()[topologySliceName] as Record<string, unknown>),
        peerIdentity: {
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          nodeId: 'node-peer',
          displayName: 'Peer',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        },
        peerReachable: true,
        peerStateSyncConnectionId: 'accepted-peer-connection',
      },
    });
    await remote
      .handler(remoteControlPortEventCommand.commandName)
      .handle(remote.context(remoteControlPortEventCommand.commandName, {type: 'state-changed'}, null));

    const peerStop = remote.dispatchCalls.find(item => item.commandName === stopRemoteControlCommand.commandName);
    expect(peerStop?.requestId).toEqual(expect.any(String));
    expect(selectRemoteControlStatus(remote.getState())).toMatchObject({phase: 'ended', reason: 'PAIR_DISCONNECTED'});
    await remote.actorRuntime.dispose();
  });

  it('ends a session as lease-expired when an ACTIVE renewal report cannot be dispatched', async () => {
    const remote = fixture();
    await remote.handler(startRemoteControlCommand.commandName).handle(
      remote.context(startRemoteControlCommand.commandName, {
        sessionId,
        bindingGeneration: 7,
        targetSessionId: 'target-session',
      }),
    );
    await remote.handler(remoteControlPortEventCommand.commandName).handle(
      remote.context(remoteControlPortEventCommand.commandName, {
        type: 'screen-ready',
        sessionId,
        screen: 'main',
        streamId: endpointId,
        trackSid: 'track-main',
        widthPx: 1920,
        heightPx: 1080,
      }),
    );
    expect(selectRemoteControlStatus(remote.getState()).phase).toBe('active');

    remote.throwingHttpPaths.add(`/remote-control-sessions/${sessionId}/status`);
    await remote.handler(remoteControlPortEventCommand.commandName).handle(
      remote.context(remoteControlPortEventCommand.commandName, {
        type: 'lease-tick',
        sessionId,
      }),
    );

    expect(selectRemoteControlStatus(remote.getState())).toMatchObject({phase: 'ended', reason: 'LEASE_EXPIRED'});
    expect(remote.logs).toContainEqual(
      expect.objectContaining({
        event: 'remote-control.status-report-dispatch-threw',
        data: expect.objectContaining({sessionId, state: 'ACTIVE', errorName: 'Error'}),
      }),
    );
    await remote.actorRuntime.dispose();
  });

  it('treats a same-session start as idempotent while the first start is preparing its local window', async () => {
    const screensRead = makeDeferred<Awaited<ReturnType<RemoteControlPort['readLocalScreens']>>>();
    const readStarted = makeDeferred<void>();
    const remote = fixture({
      readLocalScreens: vi.fn(() => {
        readStarted.resolve();
        return screensRead.promise;
      }),
    });
    const payload = {sessionId, bindingGeneration: 7, targetSessionId: 'target-session'};
    const first = remote
      .handler(startRemoteControlCommand.commandName)
      .handle(remote.context(startRemoteControlCommand.commandName, payload));
    await readStarted.promise;
    const second = await remote
      .handler(startRemoteControlCommand.commandName)
      .handle(remote.context(startRemoteControlCommand.commandName, payload));
    expect(second).toEqual({sessionId, status: 'STARTING', reason: null});
    expect(
      remote.events.filter(
        item =>
          item.commandName === executeTerminalHttpCommand.commandName &&
          (item.payload as {request?: {pathAndQuery?: string}})?.request?.pathAndQuery ===
            `/remote-control-sessions/${sessionId}/registration`,
      ),
    ).toHaveLength(1);
    expect(remote.port.begin).not.toHaveBeenCalled();
    screensRead.resolve({
      status: 'succeeded',
      value: [{screen: 'main', surfaceKey: 'PRIMARY', windowIdentity: 'window-primary', generation: 1}],
      completedAt: 1,
    });
    await expect(first).resolves.toMatchObject({sessionId, status: 'STARTING'});
    expect(remote.port.begin).toHaveBeenCalledTimes(1);
    await remote.actorRuntime.dispose();
  });

  it('does not begin after the binding connection changes while a local window read is pending', async () => {
    const screensRead = makeDeferred<Awaited<ReturnType<RemoteControlPort['readLocalScreens']>>>();
    const readStarted = makeDeferred<void>();
    const remote = fixture({
      readLocalScreens: vi.fn(() => {
        readStarted.resolve();
        return screensRead.promise;
      }),
    });
    const payload = {sessionId, bindingGeneration: 7, targetSessionId: 'target-session'};
    const starting = remote
      .handler(startRemoteControlCommand.commandName)
      .handle(remote.context(startRemoteControlCommand.commandName, payload));
    await readStarted.promise;
    remote.setState({
      ...(remote.getState() as Record<string, unknown>),
      [`${terminalDataClientModuleName}.client`]: {
        credential: {bindingGeneration: 7, terminalRef: 'terminal-ref'},
        activationStatus: 'active',
        connection: {status: 'disconnected', sessionId: 'target-session'},
      },
    });
    await remote
      .handler(remoteControlPortEventCommand.commandName)
      .handle(remote.context(remoteControlPortEventCommand.commandName, {type: 'state-changed'}));
    screensRead.resolve({
      status: 'succeeded',
      value: [{screen: 'main', surfaceKey: 'PRIMARY', windowIdentity: 'window-primary', generation: 1}],
      completedAt: 1,
    });
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
      await expect(
        remote
          .handler(startRemoteControlCommand.commandName)
          .handle(remote.context(startRemoteControlCommand.commandName, payload)),
      ).resolves.toMatchObject({sessionId, status: 'STARTING'});
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
      ...(remote.getState() as Record<string, unknown>),
      'kernel.base.runtime.instance-mode': {instanceMode: 'SLAVE'},
      [`${terminalDataClientModuleName}.status-projection`]: {
        projection: {
          available: true,
          sourceNodeId: 'node-master',
          activation: {
            status: 'active',
            terminalRef: 'terminal-ref',
            storeRef: 'store-ref',
            groupWorkspaceKey: 'workspace-key',
            bindingGeneration: 7,
          },
          connection: {status: 'stopped', addressName: null, nodeId: null, lastCloseReason: null},
          lastRttMs: null,
          updatedAt: 1,
        },
      },
      [topologySliceName]: {
        ...(remote.getState()[topologySliceName] as Record<string, unknown>),
        masterLocator: {
          host: '127.0.0.1',
          port: 7800,
          basePath: '/',
          identity: {
            protocolVersion: 1,
            moduleName: 'ui.integration.sample-console',
            nodeId: 'node-master',
            displayName: 'Master',
            instanceMode: 'MASTER',
            displayRole: 'CHIEF',
          },
        },
        peerIdentity: {
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          nodeId: 'node-master',
          displayName: 'Master',
          instanceMode: 'MASTER',
          displayRole: 'CHIEF',
        },
        peerReachable: true,
        peerStateSyncConnectionId: 'accepted-pair-connection',
        peerAppliedStateSyncRevisions: {[terminalClientStatusProjectionSliceName]: 1},
      },
    });

    await expect(
      remote
        .handler(joinRemoteControlCommand.commandName)
        .handle(remote.context(joinRemoteControlCommand.commandName, {description, grant})),
    ).resolves.toEqual({status: 'started', sessionId});

    expect(remote.port.readLocalScreens).toHaveBeenCalledWith([{screen: 'secondary', surfaceKey: 'PRIMARY'}]);
    expect(remote.port.begin).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        roomName,
        participantIdentity: 'terminal-slave',
        token: 'temporary-peer-token',
      }),
    );
    expect(remote.logs).toContainEqual(
      expect.objectContaining({
        event: 'remote-control.peer-join-command-received',
        data: expect.objectContaining({sessionId, mode: 'SLAVE', topologyKind: 'LAPTOP_PAIRED'}),
      }),
    );
    await remote.actorRuntime.dispose();
  });

  it.each([
    {
      label: 'inactive shared credential',
      activationStatus: 'inactive',
      masterApplicationId: 'ui.integration.sample-console',
      grantEndpointId: '00000000-0000-4000-8000-000000000021',
      screens: [
        {screen: 'main', endpointId},
        {screen: 'secondary', endpointId: '00000000-0000-4000-8000-000000000021'},
      ],
      reason: 'PAIR_NOT_READY',
    },
    {
      label: 'different application master',
      activationStatus: 'active',
      masterApplicationId: 'ui.integration.sample-wallpaper-console',
      grantEndpointId: '00000000-0000-4000-8000-000000000021',
      screens: [
        {screen: 'main', endpointId},
        {screen: 'secondary', endpointId: '00000000-0000-4000-8000-000000000021'},
      ],
      reason: 'PAIR_NOT_READY',
    },
    {
      label: 'status projection from a previous master',
      activationStatus: 'active',
      masterApplicationId: 'ui.integration.sample-console',
      projectionSourceNodeId: 'node-previous-master',
      grantEndpointId: '00000000-0000-4000-8000-000000000021',
      screens: [
        {screen: 'main', endpointId},
        {screen: 'secondary', endpointId: '00000000-0000-4000-8000-000000000021'},
      ],
      reason: 'PAIR_NOT_READY',
    },
    {
      label: 'matching master projection not applied on the current connection',
      activationStatus: 'active',
      masterApplicationId: 'ui.integration.sample-console',
      projectionApplied: false,
      grantEndpointId: '00000000-0000-4000-8000-000000000021',
      screens: [
        {screen: 'main', endpointId},
        {screen: 'secondary', endpointId: '00000000-0000-4000-8000-000000000021'},
      ],
      reason: 'PAIR_NOT_READY',
    },
    {
      label: 'grant for the master endpoint',
      activationStatus: 'active',
      masterApplicationId: 'ui.integration.sample-console',
      grantEndpointId: endpointId,
      screens: [
        {screen: 'main', endpointId},
        {screen: 'secondary', endpointId: '00000000-0000-4000-8000-000000000021'},
      ],
      reason: 'GRANT_INVALID',
    },
    {
      label: 'missing secondary screen mapping',
      activationStatus: 'active',
      masterApplicationId: 'ui.integration.sample-console',
      grantEndpointId: '00000000-0000-4000-8000-000000000021',
      screens: [{screen: 'main', endpointId}],
      reason: 'GRANT_INVALID',
    },
    {
      label: 'secondary screen mapped to the master endpoint',
      activationStatus: 'active',
      masterApplicationId: 'ui.integration.sample-console',
      grantEndpointId: '00000000-0000-4000-8000-000000000021',
      screens: [
        {screen: 'main', endpointId},
        {screen: 'secondary', endpointId},
      ],
      reason: 'GRANT_INVALID',
    },
    {
      label: 'slave grant mapped to the wrong screen',
      activationStatus: 'active',
      masterApplicationId: 'ui.integration.sample-console',
      grantEndpointId: '00000000-0000-4000-8000-000000000021',
      screens: [
        {screen: 'main', endpointId},
        {screen: 'main', endpointId: '00000000-0000-4000-8000-000000000021'},
      ],
      reason: 'GRANT_INVALID',
    },
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
      ...(remote.getState() as Record<string, unknown>),
      'kernel.base.runtime.instance-mode': {instanceMode: 'SLAVE'},
      [`${terminalDataClientModuleName}.status-projection`]: {
        projection: {
          available: true,
          sourceNodeId: 'projectionSourceNodeId' in invalidation ? invalidation.projectionSourceNodeId : 'node-master',
          activation: {
            status: activationStatus,
            terminalRef: 'terminal-ref',
            storeRef: 'store-ref',
            groupWorkspaceKey: 'workspace-key',
            bindingGeneration: 7,
          },
          connection: {status: 'stopped', addressName: null, nodeId: null, lastCloseReason: null},
          lastRttMs: null,
          updatedAt: 1,
        },
      },
      [topologySliceName]: {
        ...(remote.getState()[topologySliceName] as Record<string, unknown>),
        masterLocator: {
          host: '127.0.0.1',
          port: 7800,
          basePath: '/',
          identity: {
            protocolVersion: 1,
            moduleName: masterApplicationId,
            nodeId: 'node-master',
            displayName: 'Master',
            instanceMode: 'MASTER',
            displayRole: 'CHIEF',
          },
        },
        peerIdentity: {
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          nodeId: 'node-master',
          displayName: 'Master',
          instanceMode: 'MASTER',
          displayRole: 'CHIEF',
        },
        peerReachable: true,
        peerStateSyncConnectionId: 'accepted-pair-connection',
        peerAppliedStateSyncRevisions:
          'projectionApplied' in invalidation && !invalidation.projectionApplied
            ? {}
            : {[terminalClientStatusProjectionSliceName]: 1},
      },
    });

    await expect(
      remote.handler(joinRemoteControlCommand.commandName).handle(
        remote.context(joinRemoteControlCommand.commandName, {
          description,
          grant: {
            endpointId: invalidation.grantEndpointId,
            roomName: description.roomName,
            participantIdentity: invalidation.grantEndpointId === endpointId ? 'terminal-master' : 'terminal-slave',
            token: 'temporary-peer-token',
            expiresAtEpochMillis: 1_800_000_030_000,
          },
        }),
      ),
    ).resolves.toMatchObject({status: 'rejected', reason: invalidation.reason});
    if (invalidation.label === 'matching master projection not applied on the current connection') {
      expect(remote.logs).toContainEqual(
        expect.objectContaining({
          event: 'remote-control.peer-join-command-rejected',
          data: expect.objectContaining({sessionId, reason: 'STATUS_PROJECTION_NOT_READY', resultStatus: 'rejected'}),
        }),
      );
    }
    expect(remote.port.begin).not.toHaveBeenCalled();
    await remote.actorRuntime.dispose();
  });

  it('ends only the current session when an authorized member sends an unknown protocol message', async () => {
    const remote = fixture();
    activateFixtureSession(remote);

    await sendDataEvent(remote, 'controller-1', {
      v: 2,
      type: 'NEWER_PROTOCOL_MESSAGE',
      sessionId,
      seq: 1,
      body: {},
    });

    expect(selectRemoteControlStatus(remote.getState())).toMatchObject({
      phase: 'ended',
      reason: 'UNSUPPORTED_PROTOCOL',
    });
    const endPayload = vi.mocked(remote.port.sendData).mock.calls[0]?.[0].payload;
    expect(JSON.parse(new TextDecoder().decode(endPayload))).toMatchObject({
      type: 'SESSION_END',
      body: {reason: 'UNSUPPORTED_PROTOCOL'},
    });
    await remote.actorRuntime.dispose();
  });

  it('ignores unknown protocol messages from a participant outside the frozen session', async () => {
    const remote = fixture();
    activateFixtureSession(remote);

    await sendDataEvent(remote, 'unlisted-participant', {
      v: 2,
      type: 'NEWER_PROTOCOL_MESSAGE',
      sessionId,
      seq: 1,
      body: {},
    });

    expect(selectRemoteControlStatus(remote.getState()).phase).toBe('active');
    expect(remote.port.sendData).not.toHaveBeenCalled();
    await remote.actorRuntime.dispose();
  });

  it('preserves a valid peer SESSION_END reason instead of relabeling it as an admin action', async () => {
    const remote = fixture();
    activateFixtureSession(remote);

    await sendDataEvent(remote, 'terminal-1', {
      v: 1,
      type: 'SESSION_END',
      sessionId,
      seq: 1,
      body: {reason: 'SCREEN_DISCONNECTED'},
    });

    expect(selectRemoteControlStatus(remote.getState())).toMatchObject({phase: 'ended', reason: 'SCREEN_DISCONNECTED'});
    await remote.actorRuntime.dispose();
  });

  it('returns a correlated INVALID_MESSAGE for a malformed controller pointer without dispatching it', async () => {
    const remote = fixture();
    activateFixtureSession(remote);

    await sendDataEvent(remote, 'controller-1', {
      v: 1,
      type: 'POINTER',
      sessionId,
      seq: 9,
      body: {
        endpointId,
        screen: 'main',
        streamId: '00000000-0000-4000-8000-000000000021',
        gestureId: '00000000-0000-4000-8000-000000000022',
        phase: 'down',
      },
    });

    expect(remote.port.dispatchPointer).not.toHaveBeenCalled();
    const responsePayload = vi.mocked(remote.port.sendData).mock.calls[0]?.[0].payload;
    expect(JSON.parse(new TextDecoder().decode(responsePayload))).toMatchObject({
      type: 'INPUT_RESULT',
      body: {
        forSeq: 9,
        gestureId: '00000000-0000-4000-8000-000000000022',
        status: 'REJECTED',
        reason: 'INVALID_MESSAGE',
      },
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
      ...(remote.getState() as Record<string, unknown>),
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
    await remote.handler(remoteControlPortEventCommand.commandName).handle(
      remote.context(remoteControlPortEventCommand.commandName, {
        type: 'local-input-conflict',
        sessionId,
        screen: 'main',
      }),
    );

    const cancelled = JSON.parse(
      new TextDecoder().decode(vi.mocked(remote.port.sendData).mock.calls[1]?.[0].payload ?? new Uint8Array()),
    );
    expect(cancelled).toMatchObject({
      type: 'INPUT_RESULT',
      body: {forSeq: 9, gestureId: firstGestureId, status: 'CANCELLED', reason: 'INPUT_CONFLICT'},
    });
    expect(remote.port.dispatchPointer).toHaveBeenNthCalledWith(2, {
      sessionId,
      screen: 'main',
      streamId,
      gestureId: firstGestureId,
      phase: 'cancel',
    });

    const nextGestureId = '00000000-0000-4000-8000-000000000023';
    await sendDataEvent(remote, 'controller-1', pointer(10, nextGestureId));
    const nextResult = JSON.parse(
      new TextDecoder().decode(vi.mocked(remote.port.sendData).mock.calls[2]?.[0].payload ?? new Uint8Array()),
    );
    expect(nextResult).toMatchObject({
      type: 'INPUT_RESULT',
      body: {forSeq: 10, gestureId: nextGestureId, status: 'DISPATCHED', reason: null},
    });
    expect(remote.port.dispatchPointer).toHaveBeenNthCalledWith(3, {
      sessionId,
      screen: 'main',
      streamId,
      gestureId: nextGestureId,
      phase: 'down',
      u: 0.5,
      v: 0.5,
    });
    await remote.actorRuntime.dispose();
  });

  it('processes ordered pointer DOWN and UP events sequentially when native dispatch is asynchronous', async () => {
    const downStarted = makeDeferred<void>();
    const releaseDown = makeDeferred<Awaited<ReturnType<RemoteControlPort['dispatchPointer']>>>();
    const remote = fixture({
      dispatchPointer: vi.fn(async input => {
        if (input.phase === 'down') {
          downStarted.resolve();
          return releaseDown.promise;
        }
        return {status: 'succeeded' as const, value: {dispatched: true}, completedAt: 2};
      }),
    });
    activateFixtureSession(remote);
    const streamId = '00000000-0000-4000-8000-000000000021';
    const gestureId = '00000000-0000-4000-8000-000000000022';
    const currentSession = remote.getState()[remoteControlSliceName] as RemoteControlState;
    remote.setState({
      ...(remote.getState() as Record<string, unknown>),
      [remoteControlSliceName]: {
        ...currentSession,
        readyScreens: [{endpointId, screen: 'main', streamId, trackSid: 'track-main', widthPx: 1080, heightPx: 1920}],
      },
    });
    const pointer = (seq: number, phase: 'down' | 'up') => ({
      v: 1,
      type: 'POINTER',
      sessionId,
      seq,
      body: {endpointId, screen: 'main', streamId, gestureId, phase, u: 0.5, v: 0.5},
    });

    const down = dispatchDataEvent(remote, 'controller-1', pointer(1, 'down'));
    await downStarted.promise;
    const up = dispatchDataEvent(remote, 'controller-1', pointer(2, 'up'));
    await Promise.resolve();

    expect(remote.port.dispatchPointer).toHaveBeenCalledTimes(1);
    expect(remote.port.sendData).not.toHaveBeenCalled();

    releaseDown.resolve({status: 'succeeded', value: {dispatched: true}, completedAt: 1});
    await Promise.all([down, up]);

    expect(remote.port.dispatchPointer).toHaveBeenNthCalledWith(1, {
      sessionId,
      screen: 'main',
      streamId,
      gestureId,
      phase: 'down',
      u: 0.5,
      v: 0.5,
    });
    expect(remote.port.dispatchPointer).toHaveBeenNthCalledWith(2, {
      sessionId,
      screen: 'main',
      streamId,
      gestureId,
      phase: 'up',
      u: 0.5,
      v: 0.5,
    });
    const results = vi
      .mocked(remote.port.sendData)
      .mock.calls.map(([request]) => JSON.parse(new TextDecoder().decode(request.payload)));
    expect(results).toEqual([
      expect.objectContaining({type: 'INPUT_RESULT', body: {forSeq: 1, gestureId, status: 'DISPATCHED', reason: null}}),
      expect.objectContaining({type: 'INPUT_RESULT', body: {forSeq: 2, gestureId, status: 'DISPATCHED', reason: null}}),
    ]);
    expect(
      remote.logs
        .filter(
          (entry): entry is {event: string; data: Record<string, unknown>} =>
            typeof entry === 'object' &&
            entry !== null &&
            'event' in entry &&
            typeof entry.event === 'string' &&
            entry.event.startsWith('remote-control.pointer-input-'),
        )
        .map(entry => entry.event),
    ).toEqual([
      'remote-control.pointer-input-dispatch-started',
      'remote-control.pointer-input-dispatch-completed',
      'remote-control.pointer-input-result-sent',
      'remote-control.pointer-input-dispatch-started',
      'remote-control.pointer-input-dispatch-completed',
      'remote-control.pointer-input-result-sent',
    ]);
    expect(
      remote.logs
        .filter(
          (entry): entry is {event: string; data: Record<string, unknown>} =>
            typeof entry === 'object' &&
            entry !== null &&
            'event' in entry &&
            typeof entry.event === 'string' &&
            entry.event.startsWith('remote-control.port-event-'),
        )
        .map(entry => entry.event),
    ).toEqual(expect.arrayContaining(['remote-control.port-event-queued', 'remote-control.port-event-started']));
    expect(
      remote.logs
        .filter(
          (entry): entry is {event: string; data: Record<string, unknown>} =>
            typeof entry === 'object' &&
            entry !== null &&
            'event' in entry &&
            entry.event === 'remote-control.port-event-started',
        )
        .every(entry => typeof entry.data.queueWaitMs === 'number' && entry.data.eventType === 'data'),
    ).toBe(true);
    await remote.actorRuntime.dispose();
  });

  it('waits for an in-flight pointer event before stopping and releasing its session', async () => {
    const downStarted = makeDeferred<void>();
    const releaseDown = makeDeferred<Awaited<ReturnType<RemoteControlPort['dispatchPointer']>>>();
    const remote = fixture({
      dispatchPointer: vi.fn(async input => {
        if (input.phase === 'down') {
          downStarted.resolve();
          return releaseDown.promise;
        }
        return {status: 'succeeded' as const, value: {dispatched: true}, completedAt: 2};
      }),
    });
    activateFixtureSession(remote);
    const streamId = '00000000-0000-4000-8000-000000000031';
    const gestureId = '00000000-0000-4000-8000-000000000032';
    remote.setState({
      ...(remote.getState() as Record<string, unknown>),
      [remoteControlSliceName]: {
        ...(remote.getState()[remoteControlSliceName] as RemoteControlState),
        readyScreens: [{endpointId, screen: 'main', streamId, trackSid: 'track-main', widthPx: 1080, heightPx: 1920}],
      },
    });
    const down = dispatchDataEvent(remote, 'controller-1', {
      v: 1,
      type: 'POINTER',
      sessionId,
      seq: 1,
      body: {endpointId, screen: 'main', streamId, gestureId, phase: 'down', u: 0.5, v: 0.5},
    });
    await downStarted.promise;
    const stop = remote
      .handler(stopRemoteControlCommand.commandName)
      .handle(remote.context(stopRemoteControlCommand.commandName, {sessionId, reason: 'ADMIN_ENDED'}));
    await Promise.resolve();

    expect(remote.port.end).not.toHaveBeenCalled();
    expect((remote.getState()[remoteControlSliceName] as RemoteControlState).phase).toBe('active');

    releaseDown.resolve({status: 'succeeded', value: {dispatched: true}, completedAt: 1});
    await Promise.all([down, stop]);

    expect(remote.port.sendData).toHaveBeenCalledTimes(2);
    const sentMessages = vi
      .mocked(remote.port.sendData)
      .mock.calls.map(([request]) => JSON.parse(new TextDecoder().decode(request.payload)));
    expect(sentMessages.map(message => message.type)).toEqual(['INPUT_RESULT', 'SESSION_END']);
    expect(remote.port.end).toHaveBeenCalledWith({sessionId});
    expect((remote.getState()[remoteControlSliceName] as RemoteControlState).phase).toBe('ended');
    await remote.actorRuntime.dispose();
  });

  it('allows only one active gesture across screens owned by the same endpoint', async () => {
    const remote = fixture();
    activateFixtureSession(remote);
    const mainStreamId = '00000000-0000-4000-8000-000000000041';
    const secondaryStreamId = '00000000-0000-4000-8000-000000000042';
    const mainGestureId = '00000000-0000-4000-8000-000000000043';
    const secondaryGestureId = '00000000-0000-4000-8000-000000000044';
    remote.setState({
      ...(remote.getState() as Record<string, unknown>),
      [remoteControlSliceName]: {
        ...(remote.getState()[remoteControlSliceName] as RemoteControlState),
        description: {
          ...registerResponse.description,
          topologyKind: 'LAPTOP_DUAL',
          screens: [
            {screen: 'main', endpointId},
            {screen: 'secondary', endpointId},
          ],
        },
        readyScreens: [
          {endpointId, screen: 'main', streamId: mainStreamId, trackSid: 'track-main', widthPx: 1080, heightPx: 1920},
          {
            endpointId,
            screen: 'secondary',
            streamId: secondaryStreamId,
            trackSid: 'track-secondary',
            widthPx: 1920,
            heightPx: 1080,
          },
        ],
      },
    });
    const pointer = (
      seq: number,
      screen: 'main' | 'secondary',
      streamId: string,
      gestureId: string,
      phase: 'down' | 'up',
    ) => ({
      v: 1,
      type: 'POINTER',
      sessionId,
      seq,
      body: {endpointId, screen, streamId, gestureId, phase, u: 0.5, v: 0.5},
    });

    await sendDataEvent(remote, 'controller-1', pointer(1, 'main', mainStreamId, mainGestureId, 'down'));
    await sendDataEvent(remote, 'controller-1', pointer(2, 'secondary', secondaryStreamId, secondaryGestureId, 'down'));
    await sendDataEvent(remote, 'controller-1', pointer(3, 'main', mainStreamId, mainGestureId, 'up'));
    await sendDataEvent(remote, 'controller-1', pointer(4, 'secondary', secondaryStreamId, secondaryGestureId, 'down'));

    const results = vi
      .mocked(remote.port.sendData)
      .mock.calls.map(([request]) => JSON.parse(new TextDecoder().decode(request.payload)));
    expect(results.map(result => result.body)).toEqual([
      {forSeq: 1, gestureId: mainGestureId, status: 'DISPATCHED', reason: null},
      {forSeq: 2, gestureId: secondaryGestureId, status: 'REJECTED', reason: 'INPUT_CONFLICT'},
      {forSeq: 3, gestureId: mainGestureId, status: 'DISPATCHED', reason: null},
      {forSeq: 4, gestureId: secondaryGestureId, status: 'DISPATCHED', reason: null},
    ]);
    expect(remote.port.dispatchPointer).toHaveBeenCalledTimes(3);
    await remote.actorRuntime.dispose();
  });

  it('omits receipts for dispatched moves but reports a rejected move', async () => {
    const remote = fixture();
    activateFixtureSession(remote);
    const streamId = '00000000-0000-4000-8000-000000000051';
    const gestureId = '00000000-0000-4000-8000-000000000052';
    remote.setState({
      ...(remote.getState() as Record<string, unknown>),
      [remoteControlSliceName]: {
        ...(remote.getState()[remoteControlSliceName] as RemoteControlState),
        readyScreens: [{endpointId, screen: 'main', streamId, trackSid: 'track-main', widthPx: 1080, heightPx: 1920}],
      },
    });
    const pointer = (seq: number, phase: 'down' | 'move' | 'up', id = gestureId) => ({
      v: 1,
      type: 'POINTER',
      sessionId,
      seq,
      body: {endpointId, screen: 'main', streamId, gestureId: id, phase, u: 0.5, v: 0.5},
    });

    await sendDataEvent(remote, 'controller-1', pointer(1, 'down'));
    await sendDataEvent(remote, 'controller-1', pointer(2, 'move'));
    await sendDataEvent(remote, 'controller-1', pointer(3, 'up'));
    await sendDataEvent(remote, 'controller-1', pointer(4, 'move'));

    const results = vi
      .mocked(remote.port.sendData)
      .mock.calls.map(([request]) => JSON.parse(new TextDecoder().decode(request.payload)));
    expect(results.map(result => result.body)).toEqual([
      {forSeq: 1, gestureId, status: 'DISPATCHED', reason: null},
      {forSeq: 3, gestureId, status: 'DISPATCHED', reason: null},
      {forSeq: 4, gestureId, status: 'REJECTED', reason: 'INVALID_GESTURE'},
    ]);
    await remote.actorRuntime.dispose();
  });
});
