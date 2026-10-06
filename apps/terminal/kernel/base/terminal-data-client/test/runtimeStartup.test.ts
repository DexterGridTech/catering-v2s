import {describe, expect, it} from 'vitest';
import {createNodeId, createRequestId, moduleName as contractsModuleName} from '@catering-v2s/kernel-base-contracts';
import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
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
import {
  createRuntime,
  selectRuntimeInstanceMode,
  setRuntimeInstanceModeCommand,
  type Runtime,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import {releaseRuntimeForTestAsync} from '@catering-v2s/kernel-base-runtime/testing';
import {createTerminalDataClientModule} from '../src/application/createTerminalDataClientModule';
import {selectActivationState, selectConnectionState} from '../src/selectors/selectTerminalDataClientState';
import {activateTerminalCommand} from '../src/features/commands/terminalDataClientCommands';
import {
  createTransportModule,
  type TransportManagedConnection,
  type TransportNetworkAdapter,
} from '@catering-v2s/kernel-base-transport';

const toolkit = (name: string, dependencies: readonly string[]): RuntimeModule => ({
  moduleName: name,
  kind: 'toolkit',
  dependencies: dependencies.map(moduleName => ({moduleName})),
});

const createComposition = (
  input: Readonly<{
    readonly protectedStorage: ReturnType<typeof createProcessMemoryStateStoragePort>;
    readonly plainStorage: ReturnType<typeof createProcessMemoryStateStoragePort>;
    readonly device?: DevicePort;
  }>,
): Readonly<{readonly runtime: Runtime; readonly getConnectionAttempts: () => number}> => {
  let connectionAttempts = 0;
  const connection: TransportManagedConnection = {
    send: async () => undefined,
    close: async () => undefined,
    subscribe: () => () => undefined,
  };
  const adapter: TransportNetworkAdapter = {
    readSnapshot: async serverName => ({
      serverName,
      revision: 1,
      addresses: [{addressName: 'primary', baseUrl: 'https://terminal.example.test'}],
    }),
    connect: async () => {
      connectionAttempts += 1;
      return connection;
    },
    sendHttp: async () => ({
      kind: 'response',
      status: 200,
      body: {
        terminalRef: '00000000-0000-4000-8000-000000000001',
        storeRef: '00000000-0000-4000-8000-000000000002',
        groupWorkspaceKey: 'workspace-1',
        bindingGeneration: 4,
      },
    }),
  };
  const transportModule = createTransportModule({networkAdapter: adapter, now: () => 1_000, random: () => 0});
  const terminalDataClientModule = createTerminalDataClientModule({
    businessServerName: 'terminal-business-api',
    transport: transportModule.commandGateway,
    createCredentialSecret: () => 'A'.repeat(43),
    createProtocolUuid: () => '00000000-0000-4000-8000-000000000006',
    now: () => 1_000,
    appVersion: 'runtime-startup-test',
    surfaceForm: 'laptop',
  });
  const modules: readonly RuntimeModule[] = [
    toolkit(contractsModuleName, []),
    toolkit(platformPortsModuleName, [contractsModuleName]),
    toolkit(stateModuleName, [contractsModuleName, platformPortsModuleName]),
    transportModule,
    terminalDataClientModule,
  ];
  const platformPorts = createPlatformPorts({
    environmentMode: 'TEST',
    bindings: {
      logger: {kind: 'sink', write: () => undefined},
      persistKv: input.plainStorage,
      persistSecure: input.protectedStorage,
      device: input.device ?? unavailableDevicePort,
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
      runtimeName: 'terminal-client-startup-test',
      environmentMode: 'TEST',
      persistenceKey: 'terminal-client-startup-test',
      persistenceDebounceMs: 0,
    },
  });
  return Object.freeze({runtime, getConnectionAttempts: () => connectionAttempts});
};

const startRuntime = async (runtime: Runtime, label: string): Promise<void> => {
  try {
    await runtime.start();
  } catch (error) {
    const failure = runtime.failure;
    const actorErrors = runtime.journal
      .list()
      .flatMap(event => (event.kind === 'actor.error' ? [`${event.commandName}:${event.errorKey}`] : []));
    throw new Error(
      `${label} runtime start failed: ${failure?.code ?? 'NO_FAILURE_CODE'} ` +
        `cause=${String(failure?.cause ?? error)} actorErrors=${actorErrors.join(',') || 'none'}`,
      {cause: error},
    );
  }
};

describe('terminal-data-client runtime startup', () => {
  it('does not connect without identity and connects after a persisted credential is restored', async () => {
    const protectedStorage = createProcessMemoryStateStoragePort();
    const plainStorage = createProcessMemoryStateStoragePort();
    const first = createComposition({
      protectedStorage,
      plainStorage,
      device: {
        ...unavailableDevicePort,
        getDeviceInfo: async () => ({
          status: 'succeeded',
          value: {
            deviceId: 'device-1',
            systemName: 'test',
            systemVersion: 'test',
            logicalProcessorCount: 1,
          },
          completedAt: 1,
        }),
      },
    });
    let firstStarted = false;
    try {
      await startRuntime(first.runtime, 'initial');
      firstStarted = true;
      expect(first.getConnectionAttempts()).toBe(0);

      const activation = await first.runtime.dispatchCommand(
        activateTerminalCommand,
        {
          activationCode: '12345678',
        },
        {requestId: createRequestId()},
      );
      expect(activation.status).toBe('completed');
      await releaseRuntimeForTestAsync(first.runtime);
      firstStarted = false;

      const restored = createComposition({protectedStorage, plainStorage});
      let restoredStarted = false;
      try {
        await startRuntime(restored.runtime, 'restored');
        restoredStarted = true;
        expect(restored.getConnectionAttempts()).toBe(1);
        expect(selectConnectionState(restored.runtime.getState()).status).toBe('awaiting-ready');
      } finally {
        if (restoredStarted) await releaseRuntimeForTestAsync(restored.runtime);
      }
    } finally {
      if (firstStarted) await releaseRuntimeForTestAsync(first.runtime);
    }
  });

  it('retains but never uses a conflicting local credential when SLAVE mode is restored', async () => {
    const protectedStorage = createProcessMemoryStateStoragePort();
    const plainStorage = createProcessMemoryStateStoragePort();
    const first = createComposition({
      protectedStorage,
      plainStorage,
      device: {
        ...unavailableDevicePort,
        getDeviceInfo: async () => ({
          status: 'succeeded',
          value: {
            deviceId: 'device-1',
            systemName: 'test',
            systemVersion: 'test',
            logicalProcessorCount: 1,
          },
          completedAt: 1,
        }),
      },
    });
    let firstStarted = false;
    try {
      await startRuntime(first.runtime, 'seed-conflicting-local-credential');
      firstStarted = true;
      const activation = await first.runtime.dispatchCommand(
        activateTerminalCommand,
        {activationCode: '12345678'},
        {requestId: createRequestId()},
      );
      expect(activation.status).toBe('completed');
      const roleChange = await first.runtime.dispatchCommand(setRuntimeInstanceModeCommand, {instanceMode: 'SLAVE'});
      expect(roleChange.status).toBe('completed');
      await releaseRuntimeForTestAsync(first.runtime);
      firstStarted = false;

      const restoredSlave = createComposition({protectedStorage, plainStorage});
      let slaveStarted = false;
      try {
        await startRuntime(restoredSlave.runtime, 'restore-conflicting-local-credential-as-slave');
        slaveStarted = true;
        expect(selectRuntimeInstanceMode(restoredSlave.runtime.getState())).toBe('SLAVE');
        expect(restoredSlave.getConnectionAttempts()).toBe(0);
        expect(selectConnectionState(restoredSlave.runtime.getState()).status).not.toBe('awaiting-ready');
        expect(selectActivationState(restoredSlave.runtime.getState())).toMatchObject({
          status: 'active',
          terminalRef: '00000000-0000-4000-8000-000000000001',
        });
      } finally {
        if (slaveStarted) await releaseRuntimeForTestAsync(restoredSlave.runtime);
      }
    } finally {
      if (firstStarted) await releaseRuntimeForTestAsync(first.runtime);
    }
  });
});
