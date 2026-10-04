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
import {
  createRuntime,
  setRuntimeInstanceModeCommand,
  type Runtime,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import {releaseRuntimeForTestAsync, runtimeStateSyncForTest} from '@catering-v2s/kernel-base-runtime/testing';
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
import {serverConfigSliceName} from '../src/features/slices/serverConfig';

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
  failWrites = false;

  async read({
    key,
  }: {
    readonly key: string;
  }): Promise<PortResult<{readonly state: 'found'; readonly value: string} | {readonly state: 'missing'}>> {
    const value = this.values.get(key);
    return successful(value === undefined ? {state: 'missing'} : {state: 'found', value});
  }

  async write({key, value}: {readonly key: string; readonly value: string}): Promise<PortResult<NoOutput>> {
    if (this.failWrites) {
      return {
        status: 'failed',
        port: 'persistKv',
        capability: 'write',
        error: {code: 'FIXTURE_WRITE_FAILED', message: 'fixture write failure', retryable: false},
      };
    }
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
    if (this.failWrites) {
      return {
        status: 'failed',
        port: 'persistKv',
        capability: 'writeMany',
        error: {code: 'FIXTURE_WRITE_FAILED', message: 'fixture write failure', retryable: false},
      };
    }
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
  input: Readonly<{
    plain?: MemoryStorage;
    secure?: MemoryStorage;
    logs?: LogEvent[];
    persistenceKey?: string;
    defaults?: TransportServerConfig;
  }> = {},
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
    createServerConfigModule(input.defaults ?? defaults),
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
  try {
    await runtime.start();
  } catch (error) {
    const failure = runtime.failure;
    const actorFailures = runtime.journal
      .list()
      .flatMap(event => (event.kind === 'actor.error' ? [event.errorKey] : []));
    throw new Error(
      `SERVER_CONFIG_RUNTIME_START_FAILED:${JSON.stringify(actorFailures)}:${failure?.code ?? 'UNKNOWN'}:${failure?.message ?? String(error)}:${failure?.cause instanceof Error ? failure.cause.message : String(failure?.cause ?? error)}`,
    );
  }
};

const dispatch = async <TPayload extends import('@catering-v2s/kernel-base-state').StateJsonValue>(
  runtime: Runtime,
  command: import('@catering-v2s/kernel-base-runtime').CommandDefinition<TPayload>,
  payload: TPayload,
) => runtime.dispatchCommand(command, payload, {requestId: createRequestId()});

const tick = async (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

describe('server-config owner commands, selectors, and required plain proxy persistence', () => {
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
    await tick();
    expect(fixture.plain.values.size).toBeGreaterThan(0);
    expect([...fixture.plain.values.values()].join('\n')).toContain('new-proxy-secret');
    expect(fixture.secure.values.size).toBe(0);
    expect(JSON.stringify(fixture.logs)).not.toContain('new-proxy-secret');

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

  it('rejects every direct configuration mutation on a SLAVE runtime without changing owner state', async () => {
    const fixture = createFixture();
    runtimes.push(fixture.runtime);
    await start(fixture.runtime);
    expect((await dispatch(fixture.runtime, setRuntimeInstanceModeCommand, {instanceMode: 'SLAVE'})).status).toBe(
      'completed',
    );
    const before = fixture.runtime.getState()[serverConfigSliceName];
    const rejected = await Promise.all([
      dispatch(fixture.runtime, selectServerConfigSpaceCommand, {spaceName: 'prod'}),
      dispatch(fixture.runtime, setServerOverrideCommand, {
        serverName: 'business',
        addresses: [{addressName: 'branch', baseUrl: 'https://branch.example.test', timeoutMs: 1000}],
        proxy: null,
      }),
      dispatch(fixture.runtime, clearServerOverrideCommand, {serverName: 'business'}),
      dispatch(fixture.runtime, restoreServerDefaultsCommand, {}),
    ]);

    expect(rejected.map(result => result.status)).toEqual(['error', 'error', 'error', 'error']);
    expect(fixture.runtime.getState()[serverConfigSliceName]).toEqual(before);
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

  it('clears a synchronized host-default projection when the branch becomes MASTER and restores package defaults', async () => {
    const hostDefaults: TransportServerConfig = Object.freeze({
      ...defaults,
      spaces: Object.freeze(
        defaults.spaces.map(space =>
          Object.freeze({
            ...space,
            servers: Object.freeze(
              space.servers.map(server =>
                Object.freeze({
                  ...server,
                  addresses: Object.freeze([{addressName: 'host', baseUrl: 'https://host.example.test'}]),
                }),
              ),
            ),
          }),
        ),
      ),
    });
    const host = createFixture({defaults: hostDefaults, persistenceKey: 'server-config-host-defaults-host'});
    const branch = createFixture({persistenceKey: 'server-config-host-defaults-branch'});
    runtimes.push(host.runtime, branch.runtime);
    await start(host.runtime);
    await start(branch.runtime);
    expect((await dispatch(branch.runtime, setRuntimeInstanceModeCommand, {instanceMode: 'SLAVE'})).status).toBe(
      'completed',
    );
    const payload = runtimeStateSyncForTest(host.runtime).createFullSyncPayload(serverConfigSliceName);
    expect(payload.status).toBe('ready');
    if (payload.status !== 'ready') return;
    expect(
      runtimeStateSyncForTest(branch.runtime).applyAuthoritativeSync(serverConfigSliceName, payload.payload).status,
    ).toBe('applied');
    expect(resolveServerNetworkSnapshot(branch.runtime.getState(), defaults, 'business').addresses[0]?.baseUrl).toBe(
      'https://host.example.test',
    );

    expect((await dispatch(branch.runtime, setRuntimeInstanceModeCommand, {instanceMode: 'MASTER'})).status).toBe(
      'completed',
    );
    const restored = await dispatch(branch.runtime, restoreServerDefaultsCommand, {});
    expect(restored.actorResults[0]?.result).toMatchObject({changed: true});
    expect(branch.runtime.getState()[serverConfigSliceName]).toMatchObject({syncedHostDefaults: null});
    expect(resolveServerNetworkSnapshot(branch.runtime.getState(), defaults, 'business').addresses[0]?.baseUrl).toBe(
      'https://business.dev.example.test',
    );
  });

  it('keeps the newly effective selection when persistence fails and reports the failure from the owner command', async () => {
    const fixture = createFixture();
    runtimes.push(fixture.runtime);
    await start(fixture.runtime);
    fixture.plain.failWrites = true;

    const result = await dispatch(fixture.runtime, selectServerConfigSpaceCommand, {spaceName: 'prod'});

    expect(result.status).toBe('completed');
    expect(result.actorResults[0]?.result).toMatchObject({changed: true, persistence: 'failed'});
    expect(selectServerConfiguration(fixture.runtime.getState(), defaults).selectedSpace).toBe('prod');
  });

  it('discards invalid persisted selection and override while retaining a valid hydrated override', async () => {
    const plain = new MemoryStorage();
    const persistenceKey = 'server-config-invalid-hydration-test';
    const hydrationDefaults: TransportServerConfig = Object.freeze({
      selectedSpace: 'dev',
      spaces: Object.freeze(
        defaults.spaces.map(space =>
          Object.freeze({
            ...space,
            servers: Object.freeze([
              ...space.servers,
              Object.freeze({
                serverName: 'authenticated',
                addresses: Object.freeze([
                  Object.freeze({addressName: 'primary', baseUrl: 'https://authenticated.example.test'}),
                ]),
                proxy: Object.freeze({
                  protocol: 'http' as const,
                  host: 'proxy.example.test',
                  port: 8080,
                  username: 'user',
                  password: 'default-secret',
                }),
              }),
            ]),
          }),
        ),
      ),
    });
    const initial = createFixture({plain, persistenceKey, defaults: hydrationDefaults});
    runtimes.push(initial.runtime);
    await start(initial.runtime);
    expect((await dispatch(initial.runtime, selectServerConfigSpaceCommand, {spaceName: 'prod'})).status).toBe(
      'completed',
    );
    expect(
      (
        await dispatch(initial.runtime, setServerOverrideCommand, {
          serverName: 'business',
          addresses: [{addressName: 'custom', baseUrl: 'https://custom.example.test', timeoutMs: 1700}],
          proxy: null,
        })
      ).status,
    ).toBe('completed');
    expect(
      (
        await dispatch(initial.runtime, setServerOverrideCommand, {
          serverName: 'authenticated',
          addresses: [{addressName: 'custom-auth', baseUrl: 'https://auth.example.test', timeoutMs: 1700}],
          proxy: {
            protocol: 'http',
            host: 'proxy.example.test',
            port: 8081,
            username: 'override-user',
            password: {mode: 'set', value: 'override-secret'},
          },
        })
      ).status,
    ).toBe('completed');
    await tick();
    await releaseRuntimeForTestAsync(initial.runtime);

    const selectedSpaceKey = [...plain.values.keys()].find(key => key.endsWith('/field/selectedSpace'));
    const overridesKey = [...plain.values.keys()].find(key => key.endsWith('/field/overrides'));
    const proxyPasswordKey = [...plain.values.keys()].find(key =>
      key.endsWith('/record/proxy-passwords/entry/authenticated'),
    );
    expect(selectedSpaceKey).toBeDefined();
    expect(overridesKey).toBeDefined();
    expect(proxyPasswordKey).toBeDefined();
    if (selectedSpaceKey === undefined || overridesKey === undefined || proxyPasswordKey === undefined)
      throw new Error('HYDRATION_FIXTURE_KEYS_MISSING');
    plain.values.set(selectedSpaceKey, JSON.stringify('removed-space'));
    plain.values.set(proxyPasswordKey, JSON.stringify(123));
    plain.values.set(
      overridesKey,
      JSON.stringify({
        business: {
          addresses: [{addressName: 'custom', baseUrl: 'https://custom.example.test', timeoutMs: 1700}],
          proxy: null,
        },
        removedService: {
          addresses: [{addressName: 'invalid', baseUrl: 'not-a-url', timeoutMs: -1}],
          proxy: null,
        },
        authenticated: {
          addresses: [{addressName: 'custom-auth', baseUrl: 'https://auth.example.test', timeoutMs: 1700}],
          proxy: {protocol: 'http', host: 'proxy.example.test', port: 8081, username: 'override-user'},
        },
      }),
    );

    const logs: LogEvent[] = [];
    const restored = createFixture({plain, logs, persistenceKey, defaults: hydrationDefaults});
    runtimes.push(restored.runtime);
    await start(restored.runtime);

    expect(logs).toContainEqual(
      expect.objectContaining({
        category: 'server-config.hydration',
        event: 'server-config.hydration.invalid-values-reset',
        data: expect.objectContaining({selectedSpaceReset: true, droppedOverrideCount: 2}),
      }),
    );
    const selected = selectServerConfiguration(restored.runtime.getState(), hydrationDefaults);
    expect(selected.selectedSpace).toBe('dev');
    expect(selected.overriddenServerNames).toEqual(['business']);
    expect(resolveServerNetworkSnapshot(restored.runtime.getState(), hydrationDefaults, 'business').addresses).toEqual([
      {addressName: 'custom', baseUrl: 'https://custom.example.test', timeoutMs: 1700},
    ]);
  });

  it('commits normalization when persisted synchronized defaults are malformed', async () => {
    const plain = new MemoryStorage();
    const persistenceKey = 'server-config-invalid-synced-defaults-test';
    const first = createFixture({plain, persistenceKey});
    runtimes.push(first.runtime);
    await start(first.runtime);
    await dispatch(first.runtime, selectServerConfigSpaceCommand, {spaceName: 'prod'});
    await tick();
    await releaseRuntimeForTestAsync(first.runtime);
    runtimes.splice(runtimes.indexOf(first.runtime), 1);
    const selectedSpaceKey = [...plain.values.keys()].find(key => key.endsWith('/field/selectedSpace'));
    expect(selectedSpaceKey).toBeDefined();
    if (selectedSpaceKey === undefined) throw new Error('SELECTED_SPACE_FIXTURE_KEY_MISSING');
    const syncedDefaultsKey = selectedSpaceKey.replace(/\/field\/selectedSpace$/u, '/field/syncedHostDefaults');
    plain.values.set(syncedDefaultsKey, JSON.stringify({malformed: true}));

    const restored = createFixture({plain, persistenceKey});
    runtimes.push(restored.runtime);
    await start(restored.runtime);
    expect(restored.runtime.getState()[serverConfigSliceName]).toMatchObject({syncedHostDefaults: null});
    expect(selectServerConfiguration(restored.runtime.getState(), defaults).source).toBe('package-defaults');
  });

  it('copies host defaults, selected address, and default proxy password to the branch as plain persisted projection', async () => {
    const host = createFixture({persistenceKey: 'server-config-sync-host'});
    const branchDefaults: TransportServerConfig = Object.freeze({
      selectedSpace: 'branch-local',
      spaces: Object.freeze([
        Object.freeze({
          name: 'branch-local',
          servers: Object.freeze([
            Object.freeze({
              serverName: 'business',
              addresses: Object.freeze([{addressName: 'local', baseUrl: 'http://127.0.0.1:8080/branch'}]),
            }),
          ]),
        }),
      ]),
    });
    const branchFixture = createFixture({persistenceKey: 'server-config-sync-branch', defaults: branchDefaults});
    runtimes.push(host.runtime, branchFixture.runtime);
    await start(host.runtime);
    await start(branchFixture.runtime);

    const payload = runtimeStateSyncForTest(host.runtime).createFullSyncPayload(serverConfigSliceName);
    expect(payload.status).toBe('ready');
    if (payload.status !== 'ready') throw new Error('SERVER_CONFIG_SYNC_FIXTURE_NOT_READY');
    expect(
      runtimeStateSyncForTest(branchFixture.runtime).applyAuthoritativeSync(serverConfigSliceName, payload.payload)
        .status,
    ).toBe('applied');
    const network = resolveServerNetworkSnapshot(branchFixture.runtime.getState(), branchDefaults, 'business');
    expect(network.addresses[0]).toMatchObject({
      addressName: 'primary',
      baseUrl: 'https://business.dev.example.test',
    });
    expect(network.proxy?.password).toBe('default-proxy-secret');
    expect(JSON.stringify(selectServerConfiguration(branchFixture.runtime.getState(), branchDefaults))).not.toContain(
      'default-proxy-secret',
    );
    await tick();
    expect([...branchFixture.plain.values.values()].join('\n')).toContain('default-proxy-secret');
    expect(branchFixture.secure.values.size).toBe(0);

    const restoredBranch = createFixture({
      plain: branchFixture.plain,
      secure: branchFixture.secure,
      persistenceKey: 'server-config-sync-branch',
      defaults: branchDefaults,
    });
    runtimes.push(restoredBranch.runtime);
    await start(restoredBranch.runtime);
    expect(resolveServerNetworkSnapshot(restoredBranch.runtime.getState(), branchDefaults, 'business')).toMatchObject({
      addresses: [{addressName: 'primary', baseUrl: 'https://business.dev.example.test'}],
      proxy: {password: 'default-proxy-secret'},
    });
  });

  it('rejects invalid assembly defaults before runtime registration', () => {
    expect(() => createServerConfigModule({selectedSpace: 'missing', spaces: []})).toThrow(
      'SERVER_CONFIG_DEFAULTS_INVALID',
    );
  });
});
