import {afterEach, describe, expect, it} from 'vitest';
import {
  createNodeId,
  createRequestId,
  type TimestampMs,
  type TransportServerConfig,
} from '@catering-v2s/kernel-base-contracts';
import {
  createPlatformPorts,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type LogEvent,
  type NoOutput,
  type PortResult,
  type StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {createRuntime, type Runtime, type RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import {moduleName as contractsModuleName} from '@catering-v2s/kernel-base-contracts';
import {moduleName as platformPortsModuleName} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as stateModuleName} from '@catering-v2s/kernel-base-state';
import {
  clearServerOverrideCommand,
  createServerConfigModule,
  restoreServerDefaultsCommand,
  selectServerConfigSpaceCommand,
  selectServerConfiguration,
  setServerOverrideCommand,
} from '../src/index';
import {resolveServerNetworkSnapshot} from '../src/foundations/networkAdapter';

const defaults: TransportServerConfig = Object.freeze({
  selectedSpace: 'dev',
  spaces: Object.freeze([
    Object.freeze({
      name: 'dev',
      servers: Object.freeze([
        Object.freeze({
          serverName: 'business',
          addresses: Object.freeze([{addressName: 'primary', baseUrl: 'https://business.dev.example.test'}]),
          proxy: Object.freeze({
            protocol: 'http' as const,
            host: 'proxy.dev.example.test',
            port: 8080,
            username: 'dev-user',
            password: 'default-proxy-secret',
          }),
        }),
      ]),
    }),
    Object.freeze({
      name: 'prod',
      servers: Object.freeze([
        Object.freeze({
          serverName: 'business',
          addresses: Object.freeze([{addressName: 'primary', baseUrl: 'https://business.example.test'}]),
        }),
      ]),
    }),
  ]),
});

const successful = <TValue>(value: TValue): PortResult<TValue> => ({
  status: 'succeeded',
  value,
  completedAt: 1 as TimestampMs,
});

class MemoryStorage implements StateStoragePort {
  readonly values = new Map<string, string>();

  async read({
    key,
  }: {
    readonly key: string;
  }): Promise<PortResult<{readonly state: 'found'; readonly value: string} | {readonly state: 'missing'}>> {
    const value = this.values.get(key);
    return successful(value === undefined ? {state: 'missing'} : {state: 'found', value});
  }

  async write({key, value}: {readonly key: string; readonly value: string}): Promise<PortResult<NoOutput>> {
    this.values.set(key, value);
    return successful({completed: true});
  }

  async remove({key}: {readonly key: string}): Promise<PortResult<NoOutput>> {
    this.values.delete(key);
    return successful({completed: true});
  }

  async readMany({keys}: {readonly keys: readonly string[]}): Promise<
    PortResult<
      readonly {
        readonly key: string;
        readonly result: {readonly state: 'found'; readonly value: string} | {readonly state: 'missing'};
      }[]
    >
  > {
    return successful(
      keys.map(key => {
        const value = this.values.get(key);
        return {key, result: value === undefined ? {state: 'missing' as const} : {state: 'found' as const, value}};
      }),
    );
  }

  async writeMany({
    entries,
  }: {
    readonly entries: readonly {readonly key: string; readonly value: string}[];
  }): Promise<PortResult<NoOutput>> {
    for (const entry of entries) this.values.set(entry.key, entry.value);
    return successful({completed: true});
  }

  async removeMany({keys}: {readonly keys: readonly string[]}): Promise<PortResult<NoOutput>> {
    for (const key of keys) this.values.delete(key);
    return successful({completed: true});
  }

  async listKeys(): Promise<PortResult<readonly string[]>> {
    return successful([...this.values.keys()]);
  }

  async clear(): Promise<PortResult<NoOutput>> {
    this.values.clear();
    return successful({completed: true});
  }
}

const createFixture = (
  input: Readonly<{plain?: MemoryStorage; secure?: MemoryStorage; logs?: LogEvent[]; persistenceKey?: string}> = {},
) => {
  const plain = input.plain ?? new MemoryStorage();
  const secure = input.secure ?? new MemoryStorage();
  const logs = input.logs ?? [];
  const modules: readonly RuntimeModule[] = [
    {moduleName: contractsModuleName, kind: 'toolkit', dependencies: []},
    {moduleName: platformPortsModuleName, kind: 'toolkit', dependencies: [{moduleName: contractsModuleName}]},
    {
      moduleName: stateModuleName,
      kind: 'toolkit',
      dependencies: [{moduleName: contractsModuleName}, {moduleName: platformPortsModuleName}],
    },
    createServerConfigModule(defaults),
  ];
  const runtime = createRuntime({
    localNodeId: createNodeId(),
    modules,
    platformPorts: createPlatformPorts({
      environmentMode: 'TEST',
      bindings: {
        logger: {kind: 'sink', write: event => logs.push(event)},
        persistKv: plain,
        persistSecure: secure,
        device: unavailableDevicePort,
        appControl: unavailableAppControlPort,
        script: unavailableScriptPort,
        connector: unavailableConnectorPort,
        hotUpdate: unavailableHotUpdatePort,
        logUpload: unavailableLogUploadPort,
        topologyHost: unavailableTopologyHostPort,
      },
    }),
    state: {
      runtimeName: `server-config-test-${Math.random().toString(36).slice(2)}`,
      environmentMode: 'TEST',
      persistenceKey: input.persistenceKey ?? 'server-config-test',
      persistenceDebounceMs: 0,
    },
  });
  return {runtime, plain, secure, logs};
};

const start = async (runtime: Runtime): Promise<void> => {
  await runtime.start();
};

const dispatch = async <TPayload extends import('@catering-v2s/kernel-base-state').StateJsonValue>(
  runtime: Runtime,
  command: import('@catering-v2s/kernel-base-runtime').CommandDefinition<TPayload>,
  payload: TPayload,
) => runtime.dispatchCommand(command, payload, {requestId: createRequestId()});

const tick = async (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

describe('server-config owner commands, selectors, and protected persistence', () => {
  const runtimes: Runtime[] = [];
  afterEach(() => {
    runtimes.length = 0;
  });

  it('updates a full service override atomically, masks its password, and never inherits the default proxy secret', async () => {
    const fixture = createFixture();
    runtimes.push(fixture.runtime);
    await start(fixture.runtime);
    const payload = {
      serverName: 'business',
      addresses: [{addressName: 'edge', baseUrl: 'https://edge.example.test', timeoutMs: 2500}],
      proxy: {
        protocol: 'http' as const,
        host: 'proxy.edge.example.test',
        port: 8888,
        username: 'edge-user',
        password: {mode: 'set' as const, value: 'new-proxy-secret'},
      },
    };

    expect((await dispatch(fixture.runtime, setServerOverrideCommand, payload)).status).toBe('completed');
    const selected = selectServerConfiguration(fixture.runtime.getState(), defaults);
    expect(selected.spaces[0]?.servers[0]).toMatchObject({
      addresses: payload.addresses,
      proxy: {host: 'proxy.edge.example.test', username: 'edge-user', passwordConfigured: true},
      overridden: true,
    });
    expect(JSON.stringify(selected)).not.toContain('new-proxy-secret');
    const snapshot = resolveServerNetworkSnapshot(fixture.runtime.getState(), defaults, 'business');
    expect(snapshot.proxy?.password).toBe('new-proxy-secret');
    expect(fixture.plain.values.size).toBeGreaterThan(0);
    expect([...fixture.plain.values.values()].join('\n')).not.toContain('new-proxy-secret');
    expect([...fixture.secure.values.values()].join('\n')).toContain('new-proxy-secret');
    expect(JSON.stringify(fixture.logs)).not.toContain('new-proxy-secret');

    await tick();
    const restoredFixture = createFixture({
      plain: fixture.plain,
      secure: fixture.secure,
      persistenceKey: 'server-config-test',
    });
    runtimes.push(restoredFixture.runtime);
    await start(restoredFixture.runtime);
    expect(resolveServerNetworkSnapshot(restoredFixture.runtime.getState(), defaults, 'business').proxy?.password).toBe(
      'new-proxy-secret',
    );
    expect(JSON.stringify(selectServerConfiguration(restoredFixture.runtime.getState(), defaults))).not.toContain(
      'new-proxy-secret',
    );

    expect((await dispatch(fixture.runtime, clearServerOverrideCommand, {serverName: 'business'})).status).toBe(
      'completed',
    );
    const restored = resolveServerNetworkSnapshot(fixture.runtime.getState(), defaults, 'business');
    expect(restored.addresses[0]?.addressName).toBe('primary');
    expect(restored.proxy?.password).toBe('default-proxy-secret');
    expect(JSON.stringify(selectServerConfiguration(fixture.runtime.getState(), defaults))).not.toContain(
      'default-proxy-secret',
    );
  });

  it('rejects incomplete address and proxy settings without changing the current configuration', async () => {
    const fixture = createFixture();
    runtimes.push(fixture.runtime);
    await start(fixture.runtime);
    const before = selectServerConfiguration(fixture.runtime.getState(), defaults);
    const duplicateAddressNames = await dispatch(fixture.runtime, setServerOverrideCommand, {
      serverName: 'business',
      addresses: [
        {addressName: 'edge', baseUrl: 'https://one.example.test', timeoutMs: 1000},
        {addressName: 'edge', baseUrl: 'https://two.example.test', timeoutMs: 1000},
      ],
      proxy: null,
    });
    const keepMissingPassword = await dispatch(fixture.runtime, setServerOverrideCommand, {
      serverName: 'business',
      addresses: [{addressName: 'edge', baseUrl: 'https://edge.example.test', timeoutMs: 1000}],
      proxy: {protocol: 'http', host: 'proxy.example.test', port: 8888, username: 'user', password: {mode: 'keep'}},
    });
    expect(duplicateAddressNames.status).toBe('error');
    expect(keepMissingPassword.status).toBe('error');
    expect(selectServerConfiguration(fixture.runtime.getState(), defaults)).toEqual(before);
  });

  it('persists environment and override across runtime restart and restores defaults through one command', async () => {
    const plain = new MemoryStorage();
    const secure = new MemoryStorage();
    const first = createFixture({plain, secure, persistenceKey: 'server-config-restart-test'});
    runtimes.push(first.runtime);
    await start(first.runtime);
    expect((await dispatch(first.runtime, selectServerConfigSpaceCommand, {spaceName: 'prod'})).status).toBe(
      'completed',
    );
    expect(
      (
        await dispatch(first.runtime, setServerOverrideCommand, {
          serverName: 'business',
          addresses: [{addressName: 'custom', baseUrl: 'https://custom.example.test', timeoutMs: 1700}],
          proxy: null,
        })
      ).status,
    ).toBe('completed');
    await tick();

    const second = createFixture({plain, secure, persistenceKey: 'server-config-restart-test'});
    runtimes.push(second.runtime);
    await start(second.runtime);
    expect(selectServerConfiguration(second.runtime.getState(), defaults)).toMatchObject({selectedSpace: 'prod'});
    const custom = resolveServerNetworkSnapshot(second.runtime.getState(), defaults, 'business');
    expect(custom.addresses[0]?.addressName).toBe('custom');
    expect(custom).not.toHaveProperty('proxy');
    expect((await dispatch(second.runtime, restoreServerDefaultsCommand, {})).status).toBe('completed');
    expect(selectServerConfiguration(second.runtime.getState(), defaults)).toMatchObject({
      selectedSpace: 'dev',
      overriddenServerNames: [],
    });
  });

  it('rejects invalid assembly defaults before runtime registration', () => {
    expect(() => createServerConfigModule({selectedSpace: 'missing', spaces: []})).toThrow(
      'SERVER_CONFIG_DEFAULTS_INVALID',
    );
  });
});
