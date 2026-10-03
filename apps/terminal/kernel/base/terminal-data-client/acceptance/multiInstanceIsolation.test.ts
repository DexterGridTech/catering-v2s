import {appendFileSync} from 'node:fs';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createNodeId, createRequestId, moduleName as contractsModuleName} from '@catering-v2s/kernel-base-contracts';
import {
  createProcessMemoryStateStoragePort,
  createPlatformPorts,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  moduleName as platformPortsModuleName,
  type DevicePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as stateModuleName} from '@catering-v2s/kernel-base-state';
import {createRuntime, type Runtime, type RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import {releaseRuntimeForTestAsync} from '@catering-v2s/kernel-base-runtime/testing';
import {
  activateTerminalCommand,
  connectTerminalCommand,
  createTerminalDataClientModule,
  selectActivationState,
  selectConnectionState,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  createTransportModule,
  type TransportConnectionEvent,
  type TransportManagedConnection,
  type TransportNetworkAdapter,
} from '@catering-v2s/kernel-base-transport';

type WireSocket = TransportManagedConnection &
  Readonly<{
    readonly sent: string[];
    readonly closeReasons: string[];
    readonly emit: (event: TransportConnectionEvent) => void;
  }>;

const createWireSocket = (): WireSocket => {
  const listeners = new Set<(event: TransportConnectionEvent) => void>();
  const sent: string[] = [];
  const closeReasons: string[] = [];
  return Object.freeze({
    sent,
    closeReasons,
    send: async (raw: string) => {
      sent.push(raw);
    },
    close: async (reason?: string) => {
      closeReasons.push(reason ?? '');
    },
    subscribe: (listener: (event: TransportConnectionEvent) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: (event: TransportConnectionEvent) => {
      for (const listener of [...listeners]) listener(event);
    },
  });
};

const toolkit = (name: string, dependencies: readonly string[]): RuntimeModule => ({
  moduleName: name,
  kind: 'toolkit',
  dependencies: dependencies.map(moduleName => ({moduleName})),
});

const createComposition = (
  input: Readonly<{
    readonly key: 'instance-a' | 'instance-b';
    readonly deviceId: string;
    readonly secret: string;
    readonly terminalRef: string;
    readonly protectedStorage: ReturnType<typeof createProcessMemoryStateStoragePort>;
    readonly plainStorage: ReturnType<typeof createProcessMemoryStateStoragePort>;
  }>,
): Readonly<{readonly runtime: Runtime; readonly socket: WireSocket}> => {
  const socket = createWireSocket();
  const device: DevicePort = {
    ...unavailableDevicePort,
    getDeviceInfo: async () => ({
      status: 'succeeded',
      value: {deviceId: input.deviceId, systemName: 'test', systemVersion: '1', logicalProcessorCount: 1},
      completedAt: 1,
    }),
  };
  const adapter: TransportNetworkAdapter = {
    readSnapshot: async serverName => ({
      serverName,
      revision: 1,
      addresses: [
        {
          addressName: `${input.key}-endpoint`,
          baseUrl: 'https://terminal.example.test/api/terminal/group-workspaces/group-workspace-1',
        },
      ],
    }),
    connect: async () => socket,
    sendHttp: async ({body}) => {
      const request = body as Readonly<{deviceId: string}>;
      expect(request.deviceId).toBe(input.deviceId);
      return {
        kind: 'response',
        status: 200,
        body: {
          terminalRef: input.terminalRef,
          storeRef: `store-${input.key}`,
          groupWorkspaceKey: 'group-workspace-1',
          bindingGeneration: 1,
        },
      };
    },
  };
  const transportModule = createTransportModule({networkAdapter: adapter, now: () => 1_000, random: () => 0});
  const terminalClientModule = createTerminalDataClientModule({
    businessServerName: 'terminal-business-api',
    transport: transportModule.commandGateway,
    createCredentialSecret: () => input.secret,
    now: () => 1_000,
    appVersion: 'acceptance-test',
    surfaceForm: 'laptop',
  });
  const modules: readonly RuntimeModule[] = [
    toolkit(contractsModuleName, []),
    toolkit(platformPortsModuleName, [contractsModuleName]),
    toolkit(stateModuleName, [contractsModuleName, platformPortsModuleName]),
    transportModule,
    terminalClientModule,
  ];
  const platformPorts = createPlatformPorts({
    environmentMode: 'TEST',
    bindings: {
      logger: {kind: 'sink', write: () => undefined},
      persistKv: input.plainStorage,
      persistSecure: input.protectedStorage,
      device,
      appControl: unavailableAppControlPort,
      script: unavailableScriptPort,
      connector: unavailableConnectorPort,
      hotUpdate: unavailableHotUpdatePort,
      logUpload: unavailableLogUploadPort,
      topologyHost: unavailableTopologyHostPort,
    },
  });
  const runtime = createRuntime({
    localNodeId: createNodeId(),
    modules,
    platformPorts,
    state: {
      runtimeName: `terminal-client-${input.key}`,
      environmentMode: 'TEST',
      persistenceKey: `terminal-client-${input.key}`,
      persistenceDebounceMs: 0,
    },
  });
  return Object.freeze({runtime, socket});
};

const requireActorResult = (result: Awaited<ReturnType<Runtime['dispatchCommand']>>) => {
  expect(
    result.status,
    JSON.stringify({
      status: result.status,
      actorStatuses: result.actorResults.map(actor => actor.status),
      actorErrorCodes: result.actorResults.map(actor => actor.error?.code ?? null),
    }),
  ).toBe('completed');
  const actorResult = result.actorResults[0];
  if (actorResult === undefined) throw new Error('terminal client command did not reach its owner actor');
  return actorResult.result as unknown;
};

const waitUntilConnected = (runtime: Runtime): Promise<void> =>
  new Promise(resolve => {
    const unsubscribe = runtime.subscribe(() => {
      if (selectConnectionState(runtime.getState()).status === 'connected') {
        unsubscribe();
        resolve();
      }
    });
    if (selectConnectionState(runtime.getState()).status === 'connected') {
      unsubscribe();
      resolve();
    }
  });

const recordScenarioEvent = (phase: 'SCENARIO_STARTED' | 'SCENARIO_CLEANUP_PASS' | 'SCENARIO_CLEANUP_FAIL'): void => {
  const eventsPath = process.env.V2S_TERMINAL_DEV_ACCEPTANCE_SCENARIO_EVENTS;
  if (eventsPath === undefined) return;
  const runId = process.env.V2S_TERMINAL_DEV_ACCEPTANCE_RUN_ID;
  const scenarioId = process.env.V2S_TERMINAL_DEV_ACCEPTANCE_SCENARIO;
  if (!runId || !scenarioId) throw new Error('TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_EVENT_CONTEXT_MISSING');
  appendFileSync(eventsPath, `${JSON.stringify({at: new Date().toISOString(), runId, scenarioId, phase})}\n`, {
    mode: 0o600,
  });
};

describe('terminal-data-client Node acceptance composition isolation', () => {
  const runtimes: Runtime[] = [];
  beforeEach(() => {
    recordScenarioEvent('SCENARIO_STARTED');
  });
  afterEach(async () => {
    const failures: string[] = [];
    for (const runtime of runtimes.splice(0)) {
      try {
        await releaseRuntimeForTestAsync(runtime);
      } catch {
        failures.push('RUNTIME_RELEASE_FAILED');
      }
    }
    recordScenarioEvent(failures.length === 0 ? 'SCENARIO_CLEANUP_PASS' : 'SCENARIO_CLEANUP_FAIL');
    if (failures.length > 0) throw new Error('TERMINAL_CLIENT_ACCEPTANCE_SCENARIO_CLEANUP_FAILED');
  });

  it('isolates activation identity, secure-storage namespace, WebSocket session and disposal across two compositions', async () => {
    const protectedStorage = createProcessMemoryStateStoragePort();
    const plainStorage = createProcessMemoryStateStoragePort();
    const first = createComposition({
      key: 'instance-a',
      deviceId: 'device-a',
      secret: 'A'.repeat(43),
      terminalRef: 'terminal-a',
      protectedStorage,
      plainStorage,
    });
    const second = createComposition({
      key: 'instance-b',
      deviceId: 'device-b',
      secret: `${'B'.repeat(42)}A`,
      terminalRef: 'terminal-b',
      protectedStorage,
      plainStorage,
    });
    runtimes.push(first.runtime, second.runtime);
    await first.runtime.start();
    await second.runtime.start();

    const activate = (runtime: Runtime, activationCode: string) =>
      runtime.dispatchCommand(
        activateTerminalCommand,
        {
          activationCode,
        },
        {requestId: createRequestId()},
      );
    expect(requireActorResult(await activate(first.runtime, 'code-a'))).toMatchObject({
      status: 'activated',
      terminalRef: 'terminal-a',
    });
    expect(selectActivationState(second.runtime.getState())).toMatchObject({status: 'inactive', terminalRef: null});
    expect(requireActorResult(await activate(second.runtime, 'code-b'))).toMatchObject({
      status: 'activated',
      terminalRef: 'terminal-b',
    });

    const protectedKeys = await protectedStorage.listKeys({});
    if (protectedKeys.status !== 'succeeded') throw new Error('protected storage key listing failed');
    const firstNamespace = 'catering-v2s.terminal.state.v1/terminal-client-instance-a/';
    const secondNamespace = 'catering-v2s.terminal.state.v1/terminal-client-instance-b/';
    const firstKeys = protectedKeys.value.filter(key => key.startsWith(firstNamespace));
    const secondKeys = protectedKeys.value.filter(key => key.startsWith(secondNamespace));
    expect(firstKeys.length).toBeGreaterThan(0);
    expect(secondKeys.length).toBeGreaterThan(0);
    const firstPersisted = await protectedStorage.readMany({keys: firstKeys});
    const secondPersisted = await protectedStorage.readMany({keys: secondKeys});
    expect(JSON.stringify(firstPersisted)).toContain('A'.repeat(43));
    expect(JSON.stringify(firstPersisted)).not.toContain(`${'B'.repeat(42)}A`);
    expect(JSON.stringify(secondPersisted)).toContain(`${'B'.repeat(42)}A`);
    expect(JSON.stringify(secondPersisted)).not.toContain('A'.repeat(43));

    await first.runtime.dispatchCommand(connectTerminalCommand, {}, {requestId: createRequestId()});
    await second.runtime.dispatchCommand(connectTerminalCommand, {}, {requestId: createRequestId()});
    expect(first.socket.sent.map(raw => JSON.parse(raw))).toContainEqual(
      expect.objectContaining({type: 'AUTHENTICATE', terminalRef: 'terminal-a'}),
    );
    expect(second.socket.sent.map(raw => JSON.parse(raw))).toContainEqual(
      expect.objectContaining({type: 'AUTHENTICATE', terminalRef: 'terminal-b'}),
    );

    const firstConnected = waitUntilConnected(first.runtime);
    first.socket.emit({
      type: 'message',
      raw: JSON.stringify({
        type: 'SESSION_READY',
        sessionId: 'session-a',
        nodeId: 'node-a',
        serverTime: '2026-10-01T00:00:00Z',
        heartbeatIntervalMs: 30_000,
        heartbeatTimeoutMs: 90_000,
      }),
    });
    await firstConnected;
    expect(selectConnectionState(second.runtime.getState())).toMatchObject({status: 'awaiting-ready', nodeId: null});

    await releaseRuntimeForTestAsync(first.runtime);
    expect(first.socket.closeReasons).toEqual(['transport module disposed']);
    expect(selectConnectionState(second.runtime.getState())).toMatchObject({status: 'awaiting-ready', nodeId: null});
    const secondConnected = waitUntilConnected(second.runtime);
    second.socket.emit({
      type: 'message',
      raw: JSON.stringify({
        type: 'SESSION_READY',
        sessionId: 'session-b',
        nodeId: 'node-b',
        serverTime: '2026-10-01T00:00:01Z',
        heartbeatIntervalMs: 30_000,
        heartbeatTimeoutMs: 90_000,
      }),
    });
    await secondConnected;
    expect(selectConnectionState(second.runtime.getState())).toMatchObject({status: 'connected', nodeId: 'node-b'});
  });
});
