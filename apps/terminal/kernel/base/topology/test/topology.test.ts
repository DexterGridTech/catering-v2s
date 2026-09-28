import {describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  createNodeId,
  createRequestId,
  type SurfaceForm,
  type TopologyIdentity,
  type TopologyLocator,
} from '@catering-v2s/kernel-base-contracts';
import {
  createRuntime,
  defineActor,
  defineCommand,
  onCommand,
  selectRuntimeInstanceMode,
  type Runtime,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import {releaseRuntimeForTest, runtimeStateSyncForTest} from '@catering-v2s/kernel-base-runtime/testing';
import {defineStateRuntimeSlice, type StateJsonValue, type SyncValueEnvelope} from '@catering-v2s/kernel-base-state';
import {
  createDisplayContextModule,
  selectDisplayRole,
  switchDisplayRoleCommand,
  switchInstanceModeCommand,
} from '@catering-v2s/kernel-base-display-context';
import {createTransportModule} from '@catering-v2s/kernel-base-transport';
import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  type AppControlPort,
  type DevicePort,
  type DisplayInfo,
  type LogEvent,
  type NoOutput,
  type PortResult,
  type TopologyHostAddress,
  type TopologyHostConfig,
  type TopologyHostDiagnostics,
  type TopologyHostPort,
  type TopologyHostStatus,
} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as contractsModuleName} from '@catering-v2s/kernel-base-contracts';
import {moduleName as platformPortsModuleName} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as stateModuleName} from '@catering-v2s/kernel-base-state';
import {
  createTopologyModule,
  createTopologyAdminCapability,
  refreshTopologyDisplayCommand,
  resolveTopologyCommandTarget,
  areTopologyFactsEqual,
  selectTopologyFacts,
  setTopologyHostEnabledCommand,
  topologySliceName,
  topologyActions,
  topologyDisplayChangedCommand,
  topologyHostEventCommand,
  unpairTopologyCommand,
  topologyReasonMessages,
} from '../src/index';
import {pairTopologyCommand} from '../src/features/commands/commands';
import {moduleName as topologyModuleName} from '../src/moduleName';
import {
  createTopologySession,
  createTopologyStateTransferPlan,
  moduleName as transportModuleName,
} from '@catering-v2s/kernel-base-transport';
import {moduleName as displayContextModuleName} from '@catering-v2s/kernel-base-display-context';
import type {
  TopologyIdentityClient,
  TopologyPeerChannel,
  TopologyPeerChannelEvent,
} from '@catering-v2s/kernel-base-transport';
import {evaluateTopologyOperation, hasTopologySecondarySurface} from '../src/foundations/evaluateTopologyOperation';
import {serializeTopologyWireMessage} from '@catering-v2s/kernel-base-contracts';

const base = {
  surfaceForm: 'laptop' as const,
  displayCount: 1,
  instanceMode: 'MASTER' as const,
  displayRole: 'CHIEF' as const,
  paired: false,
  peerReachable: false,
};

const completedAt = 1 as never;

const membersSyncSliceName = 'kernel.feature.sample-member-registry.members' as const;
type TestMembersState = Readonly<{
  readonly members: readonly Readonly<{readonly memberId: string; readonly name: string}>[];
  readonly pending: null;
}>;

const createTestMembersModule = (): RuntimeModule => {
  const initialState: TestMembersState = Object.freeze({members: Object.freeze([]), pending: null});
  let syncBuildCount = 0;
  const registration = defineStateRuntimeSlice<TestMembersState>({
    name: membersSyncSliceName,
    reducer: (state = initialState, action) =>
      action.type === 'test/set-members'
        ? Object.freeze({
            members: Object.freeze((action as unknown as {readonly payload: TestMembersState}).payload.members),
            pending: null,
          })
        : state,
    persistIntent: 'owner-only',
    persistence: [{kind: 'field', stateKey: 'members'}],
    syncIntent: 'master-to-slave',
    sync: {
      kind: 'record',
      getEntries: (state: TestMembersState) => {
        syncBuildCount += 1;
        return {state: {value: state as unknown as StateJsonValue, updatedAt: 0 as never}};
      },
      applyEntries: (_state: TestMembersState, entries: Readonly<Partial<Record<string, SyncValueEnvelope>>>) => {
        const value = entries.state?.tombstone === true ? undefined : entries.state?.value;
        return value === undefined ? initialState : (value as unknown as TestMembersState);
      },
    },
  });
  return Object.freeze({
    moduleName: 'kernel.feature.sample-member-registry',
    kind: 'owner' as const,
    dependencies: [{moduleName: 'kernel.base.runtime'}],
    slices: [{name: membersSyncSliceName, persistIntent: registration.persistIntent}],
    stateSlices: [registration],
    getSyncBuildCount: (): number => syncBuildCount,
  }) as RuntimeModule & Readonly<{readonly getSyncBuildCount: () => number}>;
};

const readMultiChunkMembers = (): TestMembersState =>
  JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        '../../../../../doc/plans/platform/fixtures/ter-dual-machine-members-multi-chunk-stress-fixture.json',
      ),
      'utf8',
    ),
  ) as TestMembersState;

const randomText = (length: number, seed = 90_210): string => {
  let value = seed >>> 0;
  let output = '';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (let index = 0; index < length; index += 1) {
    value = Math.imul(value ^ (value >>> 13), 0x5bd1e995) >>> 0;
    value = (value + 0x6d2b79f5) >>> 0;
    output += alphabet[value & 63];
  }
  return output;
};

const succeeded = <TValue>(value: TValue): PortResult<TValue> =>
  Object.freeze({
    status: 'succeeded' as const,
    value,
    completedAt,
  });

const noOutput = (): PortResult<NoOutput> => succeeded(Object.freeze({completed: true}));

const identity: TopologyIdentity = Object.freeze({
  protocolVersion: 1,
  moduleName: 'ui.integration.sample-console',
  nodeId: 'node-master',
  displayName: '主机',
  instanceMode: 'MASTER',
  displayRole: 'CHIEF',
});

const address: TopologyHostAddress = Object.freeze({
  host: '192.0.2.10',
  port: 43172,
  basePath: '/terminal-topology',
  httpBaseUrl: 'http://192.0.2.10:43172/terminal-topology',
  wsUrl: 'ws://192.0.2.10:43172/terminal-topology/ws',
  localHttpBaseUrl: 'http://127.0.0.1:43172/terminal-topology',
  localWsUrl: 'ws://127.0.0.1:43172/terminal-topology/ws',
});

const hostConfig: TopologyHostConfig = Object.freeze({
  port: 43172,
  basePath: '/terminal-topology',
  heartbeatIntervalMs: 10_000,
  heartbeatTimeoutMs: 30_000,
  timeoutMs: 5_000,
  identity,
});

class FakeTopologyHost implements TopologyHostPort {
  readonly startCalls: TopologyHostConfig[] = [];
  readonly stopCalls: number[] = [];
  state: TopologyHostStatus['state'] = 'stopped';
  currentAddress: TopologyHostAddress | undefined;
  startFailureCode: string | undefined;

  async start(input: TopologyHostConfig): Promise<PortResult<TopologyHostAddress>> {
    this.startCalls.push(input);
    if (this.startFailureCode !== undefined) {
      return Object.freeze({
        status: 'failed' as const,
        port: 'topologyHost' as const,
        capability: 'start',
        error: Object.freeze({code: this.startFailureCode, message: 'test host failure', retryable: true}),
      });
    }
    this.state = 'running';
    this.currentAddress = address;
    return succeeded(address);
  }

  async stop(input: {readonly timeoutMs: number}): Promise<PortResult<NoOutput>> {
    this.stopCalls.push(input.timeoutMs);
    this.state = 'stopped';
    this.currentAddress = undefined;
    return noOutput();
  }

  async getStatus(_input: {readonly timeoutMs: number}): Promise<PortResult<TopologyHostStatus>> {
    return succeeded(
      Object.freeze({
        state: this.state,
        config: hostConfig,
        ...(this.currentAddress === undefined ? {} : {address: this.currentAddress}),
      }),
    );
  }

  async getDiagnosticsSnapshot(_input: {readonly timeoutMs: number}): Promise<PortResult<TopologyHostDiagnostics>> {
    return succeeded(
      Object.freeze({
        status: Object.freeze({
          state: this.state,
          config: hostConfig,
          ...(this.currentAddress === undefined ? {} : {address: this.currentAddress}),
        }),
        stats: Object.freeze({sessionCount: 0, peerCount: 0, stalePeerCount: 0}),
        capturedAt: completedAt,
      }),
    );
  }
}

class FakePeerChannel implements TopologyPeerChannel {
  readonly connectCalls: string[] = [];
  readonly sentFrames: string[] = [];
  readonly closeCalls: Array<string | undefined> = [];
  disposeCalls = 0;
  listenCalls = 0;
  sendFailure: Error | undefined;
  private connectionSequence = 0;
  private activeConnectionId: string | undefined;
  private readonly listeners = new Set<(event: TopologyPeerChannelEvent) => void>();

  subscribe(listener: (event: TopologyPeerChannelEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  listen(): void {
    this.listenCalls += 1;
  }

  async connect(url: string): Promise<void> {
    this.connectCalls.push(url);
    const connectionId = `fake-topology-connection-${++this.connectionSequence}`;
    this.activeConnectionId = connectionId;
    for (const listener of this.listeners) listener({type: 'open', connectionId});
  }

  async send(raw: string): Promise<void> {
    if (this.sendFailure !== undefined) throw this.sendFailure;
    this.sentFrames.push(raw);
  }

  async close(reason?: string): Promise<void> {
    this.closeCalls.push(reason);
    const connectionId = this.activeConnectionId;
    this.activeConnectionId = undefined;
    for (const listener of this.listeners) listener({type: 'close', reason, connectionId});
  }

  async dispose(): Promise<void> {
    this.disposeCalls += 1;
    this.listeners.clear();
  }

  emit(event: TopologyPeerChannelEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

const createTestDevice = (): DevicePort & {displayCount: number} => {
  const device = {
    ...unavailableDevicePort,
    displayCount: 1,
    getDisplayInfo: async (_input: {readonly timeoutMs: number}): Promise<PortResult<DisplayInfo>> =>
      succeeded({displayCount: device.displayCount}),
  };
  return device;
};

const createDisplayChangedObserverModule = (observed: number[]): RuntimeModule => {
  const actor = defineActor('test.topology.display-observer', 'observer', [
    onCommand(topologyDisplayChangedCommand, context => {
      observed.push(context.command.payload.displayCount ?? -1);
      return null;
    }),
  ]);
  return Object.freeze({
    moduleName: 'test.topology.display-observer',
    kind: 'owner' as const,
    dependencies: [{moduleName: 'kernel.base.runtime'}],
    commands: [],
    commandDefinitions: [],
    actors: [{name: actor.actorName}],
    actorDefinitions: [actor],
  });
};

const toolkit = (moduleName: string, dependencies: readonly string[] = []): RuntimeModule =>
  Object.freeze({
    moduleName,
    kind: 'toolkit' as const,
    dependencies: dependencies.map(name => ({moduleName: name})),
  });

const waitForReconciliation = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  await Promise.resolve();
};

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
};

const createTopologyRuntime = (
  input: Readonly<{
    readonly host: FakeTopologyHost;
    readonly peer?: FakePeerChannel;
    readonly device?: DevicePort;
    readonly plainStorage?: ReturnType<typeof createProcessMemoryStateStoragePort>;
    readonly protectedStorage?: ReturnType<typeof createProcessMemoryStateStoragePort>;
    readonly runtimeName?: string;
    readonly appControl?: AppControlPort;
    readonly identityClient?: TopologyIdentityClient;
    readonly surfaceForm?: SurfaceForm;
    readonly extraModules?: readonly RuntimeModule[];
    readonly persistenceKey?: string;
    readonly persistenceDebounceMs?: number;
  }>,
): Readonly<{runtime: Runtime; device: DevicePort; events: readonly LogEvent[]}> => {
  const events: LogEvent[] = [];
  const device = input.device ?? createTestDevice();
  const plainStorage = input.plainStorage ?? createProcessMemoryStateStoragePort();
  const protectedStorage = input.protectedStorage ?? createProcessMemoryStateStoragePort();
  const topologyModule = createTopologyModule({
    displayName: 'TER test',
    surfaceForm: input.surfaceForm ?? 'laptop',
    moduleName: 'ui.integration.sample-console',
    nodeId: 'node-master',
    identityClient: input.identityClient,
    peerChannel: input.peer,
    stateSyncSlices: [{name: membersSyncSliceName, syncIntent: 'master-to-slave'}],
  });
  const runtime = createRuntime({
    localNodeId: createNodeId(),
    modules: [
      ...(input.extraModules ?? []),
      toolkit(contractsModuleName),
      toolkit(platformPortsModuleName, [contractsModuleName]),
      toolkit(stateModuleName, [contractsModuleName, platformPortsModuleName]),
      createDisplayContextModule(),
      createTransportModule(),
      topologyModule,
    ],
    platformPorts: createPlatformPorts({
      environmentMode: 'TEST',
      bindings: {
        logger: {
          kind: 'sink',
          write: event => {
            events.push(event);
          },
        },
        persistKv: plainStorage,
        persistSecure: protectedStorage,
        device,
        appControl: input.appControl ?? unavailableAppControlPort,
        script: unavailableScriptPort,
        connector: unavailableConnectorPort,
        hotUpdate: unavailableHotUpdatePort,
        logUpload: unavailableLogUploadPort,
        topologyHost: input.host,
      },
    }),
    state: {
      runtimeName: input.runtimeName ?? 'topology-test',
      environmentMode: 'TEST',
      persistenceKey: input.persistenceKey ?? 'topology-test',
      persistenceDebounceMs: input.persistenceDebounceMs ?? 0,
    },
  });
  return Object.freeze({runtime, device, events});
};

describe('topology operation eligibility', () => {
  it('keeps pairing and unpairing operation-specific', () => {
    expect(evaluateTopologyOperation({...base, operation: 'pair'})).toMatchObject({
      allowed: true,
      reasonCode: 'allowed',
    });
    expect(evaluateTopologyOperation({...base, operation: 'unpair'})).toMatchObject({
      allowed: false,
      reasonCode: 'TOPOLOGY_NOT_PAIRED',
    });
    expect(evaluateTopologyOperation({...base, paired: true, operation: 'pair'})).toMatchObject({
      allowed: false,
      reasonCode: 'TOPOLOGY_ALREADY_PAIRED',
    });
    expect(evaluateTopologyOperation({...base, paired: true, operation: 'unpair'})).toMatchObject({
      allowed: true,
      reasonCode: 'allowed',
    });
  });

  it('does not use reachability as the secondary-surface predicate', () => {
    expect(hasTopologySecondarySurface({displayCount: 1, instanceMode: 'MASTER', paired: true})).toBe(true);
    expect(hasTopologySecondarySurface({displayCount: 1, instanceMode: 'MASTER', paired: false})).toBe(false);
    expect(hasTopologySecondarySurface({displayCount: 2, instanceMode: 'SLAVE', paired: false})).toBe(true);
  });

  it('rejects mobile and physical multi-screen topology', () => {
    expect(evaluateTopologyOperation({...base, surfaceForm: 'mobile', operation: 'pair'}).reasonCode).toBe(
      'TOPOLOGY_UNSUPPORTED_FORM',
    );
    expect(evaluateTopologyOperation({...base, displayCount: 2, operation: 'pair'}).reasonCode).toBe(
      'TOPOLOGY_REQUIRES_SINGLE_SCREEN',
    );
  });

  it('uses the same operation gate for role switching and fails closed without a form', () => {
    expect(evaluateTopologyOperation({...base, operation: 'switch-role'})).toMatchObject({
      allowed: true,
      reasonCode: 'allowed',
    });
    expect(evaluateTopologyOperation({...base, surfaceForm: 'mobile', operation: 'switch-role'}).reasonCode).toBe(
      'TOPOLOGY_UNSUPPORTED_FORM',
    );
    expect(evaluateTopologyOperation({...base, surfaceForm: undefined, operation: 'switch-role'}).reasonCode).toBe(
      'TOPOLOGY_UNSUPPORTED_FORM',
    );
  });
});

describe('topology pairing facts', () => {
  it('projects typed payload failure diagnostics without changing peer lifecycle facts', async () => {
    const host = new FakeTopologyHost();
    const {runtime} = createTopologyRuntime({host});
    await runtime.start();
    try {
      await runtime.dispatchCommand(
        topologyHostEventCommand,
        {
          event: 'state-transfer-failed',
          payloadFailure: {
            code: 'TOPOLOGY_REASSEMBLY_OVERFLOW',
            sliceName: 'kernel.feature.sample-member-registry.members',
            revision: 4,
            transferId: 'diagnostic-transfer',
            deterministic: true,
          },
        },
        {requestId: createRequestId()},
      );
      await waitForReconciliation();
      expect(selectTopologyFacts(runtime.getState())).toMatchObject({
        paired: false,
        peerReachable: false,
        payloadFailure: {
          code: 'TOPOLOGY_REASSEMBLY_OVERFLOW',
          revision: 4,
          deterministic: true,
        },
      });

      await runtime.dispatchCommand(
        topologyHostEventCommand,
        {event: 'state-transfer-recovered'},
        {requestId: createRequestId()},
      );
      await waitForReconciliation();
      expect(selectTopologyFacts(runtime.getState())?.payloadFailure).toBeNull();
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('does not apply a partial state transfer and applies the complete transfer into the real sync slice', async () => {
    const host = new FakeTopologyHost();
    const {runtime} = createTopologyRuntime({host, extraModules: [createTestMembersModule()]});
    await runtime.start();
    const stateSync = runtimeStateSyncForTest(runtime);
    const session = createTopologySession({
      write: vi.fn(),
      onMessage: message => {
        if (message.type !== 'state-full') return;
        stateSync.applyAuthoritativeSync(membersSyncSliceName, message.value as never);
      },
      onProtocolError: vi.fn(),
      closeTransport: vi.fn(),
      reassembly: {schedule: () => () => {}},
    });
    session.markOpen();
    try {
      const members = readMultiChunkMembers();
      const plan = createTopologyStateTransferPlan({
        sliceName: membersSyncSliceName,
        direction: 'master-to-slave',
        revision: 21,
        value: {
          mode: 'authoritative',
          replaceMissing: true,
          entries: [{key: 'state', value: {updatedAt: 0, value: members}}],
        },
        createTransferId: () => 'topology-apply-transfer',
      });
      expect(plan.status).toBe('ready');
      if (plan.status !== 'ready') return;
      expect(plan.frames.length).toBeGreaterThan(1);
      expect((runtime.getState()[membersSyncSliceName] as TestMembersState).members).toHaveLength(0);
      for (const frame of plan.frames.slice(0, -1)) session.receive(serializeTopologyWireMessage(frame));
      expect((runtime.getState()[membersSyncSliceName] as TestMembersState).members).toHaveLength(0);
      session.receive(serializeTopologyWireMessage(plan.frames.at(-1)!));
      expect((runtime.getState()[membersSyncSliceName] as TestMembersState).members).toHaveLength(
        members.members.length,
      );
    } finally {
      session.close('test-done');
      releaseRuntimeForTest(runtime);
    }
  });

  it('sends a complete members slice when the owned members reference changes', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const membersModule = createTestMembersModule();
    const {runtime} = createTopologyRuntime({host, peer, extraModules: [membersModule]});
    await runtime.start();
    try {
      peer.emit({type: 'open', connectionId: 'members-change-1'});
      peer.emit({
        type: 'message',
        connectionId: 'members-change-1',
        raw: JSON.stringify({
          type: 'hello',
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          wireId: 'members-change-peer-hello',
          nodeId: 'node-slave',
          displayName: '副机',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        }),
      });
      await waitForReconciliation();
      const initialRevisions = peer.sentFrames
        .map(raw => JSON.parse(raw) as {type?: string; revision?: number})
        .filter(frame => frame.type === 'state-full-chunk')
        .map(frame => frame.revision);
      expect(initialRevisions).toEqual([1]);
      peer.sentFrames.splice(0);
      runtime.getStore().dispatch({
        type: 'test/set-members',
        payload: {
          members: [{memberId: 'M1', name: '成员一'}],
          pending: null,
        },
      });
      await waitForReconciliation();
      const frames = peer.sentFrames
        .map(raw => JSON.parse(raw) as {type?: string; sliceName?: string; revision?: number; total?: number})
        .filter(frame => frame.type === 'state-full-chunk');
      expect(frames).toHaveLength(1);
      expect(frames[0]).toMatchObject({
        sliceName: membersSyncSliceName,
        revision: 2,
        total: 1,
      });
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('does not build or send a members payload for an unrelated topology slice change', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const membersModule = createTestMembersModule();
    const {runtime} = createTopologyRuntime({host, peer, extraModules: [membersModule]});
    await runtime.start();
    try {
      peer.emit({type: 'open', connectionId: 'members-unrelated-1'});
      peer.emit({
        type: 'message',
        connectionId: 'members-unrelated-1',
        raw: JSON.stringify({
          type: 'hello',
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          wireId: 'members-unrelated-peer-hello',
          nodeId: 'node-slave',
          displayName: '副机',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        }),
      });
      await waitForReconciliation();
      peer.sentFrames.splice(0);
      runtime.getStore().dispatch(topologyActions.setDisplayCount(1));
      await waitForReconciliation();
      expect(peer.sentFrames.some(raw => JSON.parse(raw).type === 'state-full-chunk')).toBe(false);
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('locks a deterministic sender payload failure until the members reference changes', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const membersModule = createTestMembersModule() as RuntimeModule &
      Readonly<{readonly getSyncBuildCount: () => number}>;
    const {runtime} = createTopologyRuntime({host, peer, extraModules: [membersModule]});
    await runtime.start();
    try {
      const members = Array.from({length: 43_000}, (_, index) => ({
        memberId: `MOV${String(index).padStart(8, '0')}`,
        name: randomText(256, 90_210 + index),
      }));
      runtime.getStore().dispatch({type: 'test/set-members', payload: {members, pending: null}});
      peer.emit({type: 'open', connectionId: 'deterministic-lock-1'});
      peer.emit({
        type: 'message',
        connectionId: 'deterministic-lock-1',
        raw: JSON.stringify({
          type: 'hello',
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          wireId: 'deterministic-lock-peer-hello',
          nodeId: 'node-slave',
          displayName: '副机',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        }),
      });
      await waitForReconciliation();
      expect(selectTopologyFacts(runtime.getState())).toMatchObject({
        payloadFailure: {code: 'TOPOLOGY_REASSEMBLY_OVERFLOW', deterministic: true},
        peerReachable: true,
      });
      const buildsAfterFailure = membersModule.getSyncBuildCount();
      runtime.getStore().dispatch(topologyActions.setDisplayCount(1));
      await waitForReconciliation();
      expect(membersModule.getSyncBuildCount()).toBe(buildsAfterFailure);
      expect(peer.sentFrames.some(raw => JSON.parse(raw).type === 'state-full-chunk')).toBe(false);
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('keeps membersSyncRevision unchanged when a transfer write fails and retries the same revision after reconnect', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const {runtime} = createTopologyRuntime({host, peer, extraModules: [createTestMembersModule()]});
    await runtime.start();
    try {
      const accept = (connectionId: string, wireId: string) => {
        peer.emit({type: 'open', connectionId});
        peer.emit({
          type: 'message',
          connectionId,
          raw: JSON.stringify({
            type: 'hello',
            protocolVersion: 1,
            moduleName: 'ui.integration.sample-console',
            wireId,
            nodeId: 'node-slave',
            displayName: '副机',
            instanceMode: 'SLAVE',
            displayRole: 'VICE',
          }),
        });
      };
      accept('send-failure-1', 'send-failure-peer-hello-1');
      await waitForReconciliation();
      peer.sentFrames.splice(0);
      peer.sendFailure = new Error('test write failure');
      runtime.getStore().dispatch({
        type: 'test/set-members',
        payload: {
          members: [{memberId: 'M2', name: '写入失败后仍可重试'}],
          pending: null,
        },
      });
      await waitForReconciliation();
      expect(selectTopologyFacts(runtime.getState())).toMatchObject({peerReachable: false});

      peer.sendFailure = undefined;
      accept('send-failure-2', 'send-failure-peer-hello-2');
      await waitForReconciliation();
      const revisions = peer.sentFrames
        .map(raw => JSON.parse(raw) as {type?: string; revision?: number})
        .filter(frame => frame.type === 'state-full-chunk')
        .map(frame => frame.revision);
      expect(revisions).toEqual([2]);
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('treats freshly projected equivalent facts as one subscription value', async () => {
    const host = new FakeTopologyHost();
    const {runtime} = createTopologyRuntime({host});
    await runtime.start();
    try {
      const previous = selectTopologyFacts(runtime.getState());
      const next = selectTopologyFacts(runtime.getState());
      expect(next).not.toBe(previous);
      expect(areTopologyFactsEqual(previous, next)).toBe(true);
      expect(areTopologyFactsEqual(previous, Object.freeze({...next!, peerReachable: true}))).toBe(false);
      expect(areTopologyFactsEqual(undefined, next)).toBe(false);
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('fails closed when the topology slice is not hydrated yet', async () => {
    const host = new FakeTopologyHost();
    const {runtime} = createTopologyRuntime({host});
    await runtime.start();
    try {
      const stateWithoutTopology = {
        ...runtime.getState(),
        [topologySliceName]: undefined,
      } as Parameters<typeof selectTopologyFacts>[0];

      expect(selectTopologyFacts(stateWithoutTopology)).toBeUndefined();
      expect(
        resolveTopologyCommandTarget({
          state: stateWithoutTopology,
          payload: {displayMode: 'SECONDARY'},
          routeContext: null,
        }),
      ).toBeUndefined();
      expect(
        createTopologyAdminCapability({
          getState: () => stateWithoutTopology,
          dispatchCommand: runtime.dispatchCommand,
        }).getOperationEligibility('pair'),
      ).toMatchObject({
        allowed: false,
        reasonCode: 'TOPOLOGY_UNAVAILABLE',
      });
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('uses the accepted master peer identity for paired semantics and preserves it through transient loss', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const {runtime} = createTopologyRuntime({host, peer});
    await runtime.start();
    try {
      peer.emit({type: 'open', connectionId: 'master-peer-1'});
      peer.emit({
        type: 'message',
        connectionId: 'master-peer-1',
        raw: JSON.stringify({
          type: 'hello',
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          wireId: 'peer-hello-1',
          nodeId: 'node-slave',
          displayName: '副机',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        }),
      });
      await waitForReconciliation();

      expect(selectTopologyFacts(runtime.getState())).toMatchObject({
        paired: true,
        peerReachable: true,
        hasTopologySecondarySurface: true,
      });
      expect(
        runtime.journal
          .list()
          .some(
            event =>
              event.kind === 'command.started' &&
              event.commandName === 'kernel.base.topology.host-event' &&
              event.requestId !== null,
          ),
      ).toBe(true);

      // Both endpoints send hello.  The MASTER must accept the SLAVE's
      // hello-accepted acknowledgement on the same connection rather than
      // treating its already-accepted peer identity as an identity mismatch.
      peer.emit({
        type: 'message',
        connectionId: 'master-peer-1',
        raw: JSON.stringify({
          type: 'hello-accepted',
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          wireId: 'peer-hello-accepted-1',
          nodeId: 'node-slave',
        }),
      });
      await waitForReconciliation();
      expect(selectTopologyFacts(runtime.getState())).toMatchObject({
        paired: true,
        peerReachable: true,
      });

      peer.emit({type: 'close', connectionId: 'master-peer-1', reason: 'TOPOLOGY_PEER_UNREACHABLE'});
      await waitForReconciliation();

      expect(selectTopologyFacts(runtime.getState())).toMatchObject({
        paired: true,
        peerReachable: false,
        hasTopologySecondarySurface: true,
      });
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('clears the master pairing fact only after an explicit slave unpair close', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const {runtime} = createTopologyRuntime({host, peer});
    await runtime.start();
    try {
      runtime.getStore().dispatch(
        topologyActions.setPeerIdentity(
          Object.freeze({
            ...identity,
            nodeId: 'node-slave',
            displayName: '副机',
            instanceMode: 'SLAVE',
            displayRole: 'VICE',
          }),
        ),
      );
      expect(selectTopologyFacts(runtime.getState())?.paired).toBe(true);

      peer.emit({type: 'open', connectionId: 'master-peer-2'});
      peer.emit({type: 'close', connectionId: 'master-peer-2', reason: 'TOPOLOGY_UNPAIRED'});
      await waitForReconciliation();

      expect(selectTopologyFacts(runtime.getState())).toMatchObject({
        paired: false,
        peerReachable: false,
        hasTopologySecondarySurface: false,
      });
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('clears the master pairing fact from an explicit slave unpair wire notice', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const {runtime} = createTopologyRuntime({host, peer});
    await runtime.start();
    try {
      peer.emit({type: 'open', connectionId: 'master-peer-wire-unpair'});
      peer.emit({
        type: 'message',
        connectionId: 'master-peer-wire-unpair',
        raw: JSON.stringify({
          type: 'hello',
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          wireId: 'peer-wire-unpair-hello',
          nodeId: 'node-slave-wire-unpair',
          displayName: '副机',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        }),
      });
      await waitForReconciliation();
      expect(selectTopologyFacts(runtime.getState())?.paired).toBe(true);

      peer.emit({
        type: 'message',
        connectionId: 'master-peer-wire-unpair',
        raw: JSON.stringify({
          type: 'closed-error',
          protocolVersion: 1,
          wireId: 'peer-wire-unpair-notice',
          error: {code: 'TOPOLOGY_UNPAIRED', retryable: false},
        }),
      });
      await waitForReconciliation();

      expect(selectTopologyFacts(runtime.getState())).toMatchObject({
        paired: false,
        peerReachable: false,
        hasTopologySecondarySurface: false,
      });
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });
});

describe('topology unpair peer cleanup', () => {
  it('clears the slave locator from an explicit master unpair notice', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const {runtime} = createTopologyRuntime({host, peer});
    await runtime.start();
    try {
      const locator: TopologyLocator = Object.freeze({
        host: '192.0.2.46',
        port: 43172,
        basePath: '/terminal-topology',
        identity,
      });
      runtime.getStore().dispatch(topologyActions.setMasterLocator(locator));
      runtime.getStore().dispatch(topologyActions.setPeerIdentity(identity));
      runtime.getStore().dispatch(topologyActions.setPeerReachable(true));
      await runtime.dispatchCommand(
        switchInstanceModeCommand,
        {instanceMode: 'SLAVE'},
        {requestId: createRequestId(), routeContext: {displayMode: 'PRIMARY', workspace: 'MAIN'}},
      );
      await runtime.dispatchCommand(
        switchDisplayRoleCommand,
        {displayRole: 'VICE'},
        {requestId: createRequestId(), routeContext: {displayMode: 'PRIMARY', workspace: 'MAIN'}},
      );

      await runtime.dispatchCommand(
        topologyHostEventCommand,
        {event: 'peer-unreachable', reason: 'TOPOLOGY_UNPAIRED'},
        {requestId: createRequestId()},
      );
      await waitForReconciliation();

      expect(runtime.getState()[topologySliceName]).toMatchObject({
        masterLocator: null,
        peerIdentity: null,
        peerReachable: false,
        repairPending: false,
      });
      expect(selectTopologyFacts(runtime.getState())).toMatchObject({paired: false});
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });
});

describe('topology runtime target resolution', () => {
  it('uses each payload and peer intent independently of peer reachability', async () => {
    const host = new FakeTopologyHost();
    const {runtime} = createTopologyRuntime({host});
    await runtime.start();
    try {
      const locator: TopologyLocator = Object.freeze({
        host: '192.0.2.30',
        port: 43172,
        basePath: '/terminal-topology',
        identity: Object.freeze({...identity, nodeId: 'node-master-3'}),
      });
      const currentTopology = runtime.getState()[topologySliceName]!;
      const stateWith = (
        overrides: Readonly<Record<string, unknown>>,
        instanceMode: 'MASTER' | 'SLAVE' = 'MASTER',
      ): Parameters<typeof resolveTopologyCommandTarget>[0]['state'] =>
        Object.freeze({
          ...runtime.getState(),
          [topologySliceName]: Object.freeze({...currentTopology, ...overrides}),
          'kernel.base.runtime.instance-mode': Object.freeze({instanceMode}),
        }) as Parameters<typeof resolveTopologyCommandTarget>[0]['state'];

      const paired = stateWith({masterLocator: locator, peerReachable: false});
      expect(
        resolveTopologyCommandTarget({
          state: paired,
          payload: {displayMode: 'SECONDARY'},
          routeContext: null,
        }),
      ).toBeUndefined();
      expect(
        resolveTopologyCommandTarget({
          state: stateWith({masterLocator: locator, displayCount: 2, peerReachable: false}),
          payload: {displayMode: 'SECONDARY'},
          routeContext: null,
        }),
      ).toBeUndefined();
      expect(
        resolveTopologyCommandTarget({
          state: stateWith({masterLocator: null}),
          payload: {displayMode: 'SECONDARY'},
          routeContext: null,
        }),
      ).toBeUndefined();
      expect(
        resolveTopologyCommandTarget({
          state: stateWith({masterLocator: locator, peerReachable: false}, 'SLAVE'),
          payload: {operation: 'member-intent', displayMode: 'SECONDARY'},
          routeContext: null,
          routeIntent: 'peer-intent',
        }),
      ).toBe('peer');
      expect(
        resolveTopologyCommandTarget({
          state: stateWith({masterLocator: locator, peerReachable: false}, 'SLAVE'),
          payload: {
            displayMode: 'SECONDARY',
            layerId: 'admin.console.layer',
            partKey: 'admin.console',
          },
          routeContext: null,
          routeIntent: 'peer-intent',
        }),
      ).toBe('peer');
      expect(
        resolveTopologyCommandTarget({
          state: stateWith({masterLocator: locator, peerReachable: true}, 'SLAVE'),
          payload: {operation: 'member-intent', displayMode: 'PRIMARY'},
          routeContext: null,
          routeIntent: 'peer-intent',
        }),
      ).toBeUndefined();
      expect(
        resolveTopologyCommandTarget({
          state: paired,
          payload: {operation: 'member-intent'},
          routeContext: null,
          routeIntent: 'peer-intent',
        }),
      ).toBeUndefined();
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });
});

describe('topology module identity admission', () => {
  it('rejects a peer from a different integration moduleName before pairing', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const {runtime, events} = createTopologyRuntime({host, peer});
    await runtime.start();
    try {
      peer.emit({type: 'open', connectionId: 'module-mismatch-1'});
      peer.emit({
        type: 'message',
        connectionId: 'module-mismatch-1',
        raw: JSON.stringify({
          type: 'hello',
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-wallpaper-console',
          wireId: 'module-mismatch-peer-hello',
          nodeId: 'node-slave',
          displayName: '副机',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        }),
      });
      await waitForReconciliation();

      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'info',
            category: 'topology.peer',
            event: 'topology.peer.hello-rejected',
            data: expect.objectContaining({reason: 'module-mismatch'}),
          }),
        ]),
      );
      expect(selectTopologyFacts(runtime.getState())).toMatchObject({
        paired: false,
        peerReachable: false,
      });
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });
});

describe('topology admin capability', () => {
  it('computes page availability from the owner facts instead of an operation gate', async () => {
    const host = new FakeTopologyHost();
    const {runtime} = createTopologyRuntime({host});
    await runtime.start();
    try {
      const capability = createTopologyAdminCapability(runtime);
      expect(capability.getPageAvailability()).toEqual({available: true, reasonCode: 'allowed'});

      runtime.getStore().dispatch(topologyActions.setDisplayCount(2));
      expect(capability.getPageAvailability()).toEqual({
        available: false,
        reasonCode: 'TOPOLOGY_REQUIRES_SINGLE_SCREEN',
      });
    } finally {
      releaseRuntimeForTest(runtime);
    }

    const mobile = createTopologyRuntime({host: new FakeTopologyHost(), surfaceForm: 'mobile'});
    await mobile.runtime.start();
    try {
      expect(createTopologyAdminCapability(mobile.runtime).getPageAvailability()).toEqual({
        available: false,
        reasonCode: 'TOPOLOGY_UNSUPPORTED_FORM',
      });
      expect(topologyReasonMessages.TOPOLOGY_UNSUPPORTED_FORM).toBe('mobile 形态不支持双机拓扑');
      expect(topologyReasonMessages.TOPOLOGY_REQUIRES_SINGLE_SCREEN).toBe('双机拓扑要求本机只有一个物理屏');
    } finally {
      releaseRuntimeForTest(mobile.runtime);
    }
  });

  it('pairs by host through one owner command boundary and stamps the current local route', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const queriedHosts: string[] = [];
    const identityClient: TopologyIdentityClient = Object.freeze({
      query: async queriedHost => {
        queriedHosts.push(queriedHost);
        return Object.freeze({type: 'identity' as const, ...identity});
      },
    });
    const appControl: AppControlPort = {
      ...unavailableAppControlPort,
      resetRuntime: async input =>
        Object.freeze({
          status: 'accepted' as const,
          requestId: input.requestId,
          acceptedAt: completedAt,
          terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
        }),
    };
    const {runtime} = createTopologyRuntime({host, peer, appControl, identityClient});
    await runtime.start();
    try {
      const capability = createTopologyAdminCapability(runtime);

      const paired = await capability.pairByHost({host: ' 192.0.2.40 '});
      expect(paired.status).toBe('completed');
      expect(paired.identity).toEqual(identity);
      expect(queriedHosts).toEqual(['192.0.2.40']);
      expect(selectRuntimeInstanceMode(runtime.getState())).toBe('SLAVE');
      expect(selectDisplayRole(runtime.getState())).toBe('VICE');
      expect(
        runtime.journal
          .list()
          .some(
            event =>
              event.kind === 'command.started' &&
              event.commandName === 'kernel.base.topology.pair-by-host' &&
              event.requestId !== null,
          ),
      ).toBe(true);
      expect(runtime.journal.list().some(event => event.commandName === 'kernel.base.topology.query-host')).toBe(false);

      const occupied = await capability.pairByHost({host: '192.0.2.41'});
      expect(occupied).toMatchObject({status: 'error', reasonCode: 'TOPOLOGY_ALREADY_PAIRED'});

      const unpaired = await capability.unpair();
      expect(unpaired.status).toBe('completed');
      expect(selectRuntimeInstanceMode(runtime.getState())).toBe('MASTER');
      expect(selectDisplayRole(runtime.getState())).toBe('CHIEF');
      expect(runtime.getState()[topologySliceName]).toMatchObject({
        masterLocator: null,
        peerIdentity: null,
        peerReachable: false,
        repairPending: false,
      });
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('returns typed direct-pair failures and rolls back every prepared fact', async () => {
    const invalid = createTopologyRuntime({host: new FakeTopologyHost()});
    await invalid.runtime.start();
    try {
      await expect(
        createTopologyAdminCapability(invalid.runtime).pairByHost({host: 'http://192.0.2.42'}),
      ).resolves.toMatchObject({status: 'error', reasonCode: 'TOPOLOGY_INVALID_LOCATOR'});
    } finally {
      releaseRuntimeForTest(invalid.runtime);
    }

    const identityFailure = createTopologyRuntime({
      host: new FakeTopologyHost(),
      identityClient: {
        query: async () => {
          throw new Error('identity unavailable');
        },
      },
    });
    await identityFailure.runtime.start();
    try {
      await expect(
        createTopologyAdminCapability(identityFailure.runtime).pairByHost({host: '192.0.2.43'}),
      ).resolves.toMatchObject({status: 'error', reasonCode: 'TOPOLOGY_IDENTITY_FAILED'});
    } finally {
      releaseRuntimeForTest(identityFailure.runtime);
    }

    const moduleMismatch = createTopologyRuntime({
      host: new FakeTopologyHost(),
      identityClient: {
        query: async () =>
          Object.freeze({
            type: 'identity' as const,
            ...identity,
            moduleName: 'ui.integration.sample-wallpaper-console',
          }),
      },
    });
    await moduleMismatch.runtime.start();
    try {
      const result = await createTopologyAdminCapability(moduleMismatch.runtime).pairByHost({host: '192.0.2.44'});
      expect(result).toMatchObject({status: 'error', reasonCode: 'TOPOLOGY_PROTOCOL_REJECTED'});
      expect(moduleMismatch.runtime.getState()[topologySliceName]).toMatchObject({
        masterLocator: null,
        peerIdentity: null,
        peerReachable: false,
        repairPending: false,
      });
    } finally {
      releaseRuntimeForTest(moduleMismatch.runtime);
    }

    const rollback = createTopologyRuntime({
      host: new FakeTopologyHost(),
      identityClient: {query: async () => Object.freeze({type: 'identity' as const, ...identity})},
    });
    await rollback.runtime.start();
    try {
      const result = await createTopologyAdminCapability(rollback.runtime).pairByHost({host: '192.0.2.45'});
      expect(result).toMatchObject({status: 'error', reasonCode: 'TOPOLOGY_UNAVAILABLE'});
      expect(rollback.runtime.getState()[topologySliceName]).toMatchObject({
        masterLocator: null,
        peerIdentity: null,
        peerReachable: false,
        repairPending: false,
      });
      expect(selectRuntimeInstanceMode(rollback.runtime.getState())).toBe('MASTER');
      expect(selectDisplayRole(rollback.runtime.getState())).toBe('CHIEF');
    } finally {
      releaseRuntimeForTest(rollback.runtime);
    }
  });

  it('unpairs a MASTER using peerIdentity when masterLocator is absent and clears all pairing facts', async () => {
    const peer = new FakePeerChannel();
    const {runtime} = createTopologyRuntime({host: new FakeTopologyHost(), peer});
    await runtime.start();
    try {
      runtime.getStore().dispatch(topologyActions.setPeerIdentity(identity));
      runtime.getStore().dispatch(topologyActions.setPeerReachable(true));
      expect(selectTopologyFacts(runtime.getState())).toMatchObject({
        paired: true,
        masterLocator: null,
        peerIdentity: identity,
        peerReachable: true,
      });

      const result = await createTopologyAdminCapability(runtime).unpair();

      expect(result.status).toBe('completed');
      expect(runtime.getState()[topologySliceName]).toMatchObject({
        masterLocator: null,
        peerIdentity: null,
        peerReachable: false,
        repairPending: false,
      });
      expect(selectTopologyFacts(runtime.getState())).toMatchObject({paired: false});
      expect(
        peer.sentFrames.some(raw => {
          const frame = JSON.parse(raw) as {type?: string; error?: {code?: string; retryable?: boolean}};
          return (
            frame.type === 'closed-error' &&
            frame.error?.code === 'TOPOLOGY_UNPAIRED' &&
            frame.error.retryable === false
          );
        }),
      ).toBe(true);
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('stops an active MASTER host before returning from unpair to role choice', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const {runtime} = createTopologyRuntime({host, peer});
    await runtime.start();
    try {
      const enabled = await runtime.dispatchCommand(
        setTopologyHostEnabledCommand,
        {enabled: true},
        {requestId: createRequestId()},
      );
      expect(enabled.status).toBe('completed');
      await waitForReconciliation();
      runtime.getStore().dispatch(topologyActions.setPeerIdentity(identity));
      runtime.getStore().dispatch(topologyActions.setPeerReachable(true));

      const result = await createTopologyAdminCapability(runtime).unpair();

      expect(result.status).toBe('completed');
      expect(host.stopCalls.length).toBeGreaterThanOrEqual(1);
      expect(runtime.getState()[topologySliceName]).toMatchObject({
        hostDesired: false,
        hostActual: 'stopped',
        hostAddress: null,
        masterLocator: null,
        peerIdentity: null,
        peerReachable: false,
        repairPending: false,
      });
      expect(selectTopologyFacts(runtime.getState())).toMatchObject({paired: false});
      expect(
        peer.sentFrames.some(raw => {
          const frame = JSON.parse(raw) as {type?: string; error?: {code?: string; retryable?: boolean}};
          return (
            frame.type === 'closed-error' &&
            frame.error?.code === 'TOPOLOGY_UNPAIRED' &&
            frame.error.retryable === false
          );
        }),
      ).toBe(true);
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });
});

describe('topology lifecycle integration', () => {
  it('writes structured diagnostics for a peer channel close with transport metadata', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const {runtime, events} = createTopologyRuntime({host, peer});
    await runtime.start();
    try {
      peer.emit({type: 'open', connectionId: 'diagnostic-close-1'});
      peer.emit({
        type: 'close',
        connectionId: 'diagnostic-close-1',
        reason: 'TOPOLOGY_PEER_UNREACHABLE',
        code: 1006,
        readyState: 3,
      });
      await waitForReconciliation();
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'warn',
            category: 'topology.peer',
            event: 'topology.peer.channel-anomaly',
            data: expect.objectContaining({
              channelEvent: 'close',
              reason: 'TOPOLOGY_PEER_UNREACHABLE',
              code: 1006,
              readyState: 3,
              connectionId: 'diagnostic-close-1',
            }),
          }),
        ]),
      );
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('normalizes an inbound peer command to local execution without routing it back', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const observed: Array<Readonly<{readonly target: string; readonly routeContext: unknown}>> = [];
    const command = defineCommand<Readonly<{readonly value: string}>>('test.topology.receiver', {
      name: 'run',
      visibility: 'internal',
    });
    const actor = defineActor('test.topology.receiver', 'worker', [
      onCommand(command, context => {
        observed.push({target: context.command.target, routeContext: context.command.routeContext});
        return {handled: context.command.payload.value};
      }),
    ]);
    const receiverModule: RuntimeModule = Object.freeze({
      moduleName: 'test.topology.receiver',
      kind: 'owner',
      dependencies: [{moduleName: 'kernel.base.runtime'}],
      commands: [{name: command.commandName, visibility: command.visibility}],
      commandDefinitions: [command],
      actors: [{name: actor.actorName}],
      actorDefinitions: [actor],
    });
    const appControl: AppControlPort = {
      ...unavailableAppControlPort,
      resetRuntime: async input =>
        Object.freeze({
          status: 'accepted' as const,
          requestId: input.requestId,
          acceptedAt: completedAt,
          terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
        }),
    };
    const {runtime} = createTopologyRuntime({host, peer, appControl, extraModules: [receiverModule]});
    await runtime.start();
    try {
      const locator: TopologyLocator = Object.freeze({
        host: '192.0.2.40',
        port: 43172,
        basePath: '/terminal-topology',
        identity: Object.freeze({...identity, nodeId: 'node-master-4'}),
      });
      const paired = await runtime.dispatchCommand(
        pairTopologyCommand,
        {locator},
        {
          requestId: createRequestId(),
          routeContext: {displayMode: 'PRIMARY', workspace: 'MAIN'},
        },
      );
      expect(paired.status).toBe('completed');
      runtime.getStore().dispatch(topologyActions.setRepairPending(false));
      await waitForReconciliation();
      peer.emit({
        type: 'message',
        raw: JSON.stringify({
          type: 'hello-accepted',
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          wireId: 'receiver-accepted',
          nodeId: 'node-master-4',
        }),
      });
      await waitForReconciliation();
      expect(runtime.getState()[topologySliceName]).toMatchObject({peerReachable: true});

      peer.emit({
        type: 'message',
        raw: JSON.stringify({
          type: 'command-request',
          protocolVersion: 1,
          wireId: 'receiver-command',
          requestId: null,
          commandId: 'receiver-command-id',
          parentCommandId: null,
          commandName: command.commandName,
          payload: {value: 'local-only'},
        }),
      });
      await waitForReconciliation();
      await new Promise<void>(resolve => setTimeout(resolve, 0));

      expect(observed).toEqual([{target: 'local', routeContext: null}]);
      expect(peer.sentFrames.map(frame => JSON.parse(frame) as {type?: string})).toEqual(
        expect.arrayContaining([expect.objectContaining({type: 'command-result'})]),
      );
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('tracks concurrent remote cancellations by command id and leaves unknown cancels as no-ops', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const command = defineCommand<Readonly<{readonly id: string}>>('test.topology.concurrent', {
      name: 'run',
      visibility: 'internal',
      timeoutMs: 1_000,
    });
    const gates = new Map<string, ReturnType<typeof deferred<StateJsonValue>>>();
    const actor = defineActor('test.topology.concurrent', 'worker', [
      onCommand(command, context => {
        const id = String((context.command.payload as Readonly<{readonly id: string}>).id);
        const gate = deferred<StateJsonValue>();
        gates.set(id, gate);
        return gate.promise;
      }),
    ]);
    const module: RuntimeModule = Object.freeze({
      moduleName: 'test.topology.concurrent',
      kind: 'owner',
      dependencies: [{moduleName: 'kernel.base.runtime'}],
      commands: [{name: command.commandName, visibility: command.visibility}],
      commandDefinitions: [command],
      actors: [{name: actor.actorName}],
      actorDefinitions: [actor],
    });
    const {runtime} = createTopologyRuntime({host, peer, extraModules: [module]});
    await runtime.start();
    try {
      peer.emit({type: 'open', connectionId: 'concurrent-cancel-1'});
      peer.emit({
        type: 'message',
        connectionId: 'concurrent-cancel-1',
        raw: JSON.stringify({
          type: 'hello',
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          wireId: 'concurrent-cancel-peer-hello',
          nodeId: 'node-slave',
          displayName: '副机',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        }),
      });
      await waitForReconciliation();
      const request = (id: string) => ({
        type: 'command-request' as const,
        protocolVersion: 1 as const,
        wireId: `concurrent-request-${id}`,
        requestId: null,
        commandId: id,
        parentCommandId: null,
        commandName: command.commandName,
        payload: {id},
      });
      peer.emit({type: 'message', connectionId: 'concurrent-cancel-1', raw: JSON.stringify(request('command-a'))});
      peer.emit({type: 'message', connectionId: 'concurrent-cancel-1', raw: JSON.stringify(request('command-b'))});
      await waitForReconciliation();
      peer.emit({
        type: 'message',
        connectionId: 'concurrent-cancel-1',
        raw: JSON.stringify({
          type: 'command-cancel',
          protocolVersion: 1,
          wireId: 'concurrent-cancel-a',
          requestId: null,
          commandId: 'command-a',
        }),
      });
      peer.emit({
        type: 'message',
        connectionId: 'concurrent-cancel-1',
        raw: JSON.stringify({
          type: 'command-cancel',
          protocolVersion: 1,
          wireId: 'concurrent-cancel-unknown',
          requestId: null,
          commandId: 'command-unknown',
        }),
      });
      gates.get('command-a')?.resolve({completed: true});
      gates.get('command-b')?.resolve({completed: true});
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      const results = peer.sentFrames
        .map(raw => JSON.parse(raw) as {type?: string; commandId?: string; status?: string})
        .filter(frame => frame.type === 'command-result');
      expect(results).toEqual([expect.objectContaining({commandId: 'command-b', status: 'completed'})]);
      expect(results.some(frame => frame.commandId === 'command-a')).toBe(false);
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('returns all four real remote command statuses without duplicating a settled command', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const completed = defineCommand<Readonly<{}>>('test.topology.statuses', {
      name: 'completed',
      visibility: 'internal',
    });
    const partial = defineCommand<Readonly<{}>>('test.topology.statuses', {name: 'partial', visibility: 'internal'});
    const timedOut = defineCommand<Readonly<{}>>('test.topology.statuses', {
      name: 'timed-out',
      visibility: 'internal',
      timeoutMs: 5,
    });
    const errored = defineCommand<Readonly<{}>>('test.topology.statuses', {name: 'error', visibility: 'internal'});
    const completedActor = defineActor('test.topology.statuses', 'completed-actor', [
      onCommand(completed, () => ({ok: true})),
    ]);
    const partialSuccessActor = defineActor('test.topology.statuses', 'partial-success', [
      onCommand(partial, () => ({ok: true})),
    ]);
    const partialErrorActor = defineActor('test.topology.statuses', 'partial-error', [
      onCommand(partial, () => {
        throw new Error('partial failure');
      }),
    ]);
    const timedOutActor = defineActor('test.topology.statuses', 'timed-out-actor', [
      onCommand(timedOut, () => new Promise<StateJsonValue>(() => undefined)),
    ]);
    const errorActor = defineActor('test.topology.statuses', 'error-actor', [
      onCommand(errored, () => {
        throw new Error('command failure');
      }),
    ]);
    const module: RuntimeModule = Object.freeze({
      moduleName: 'test.topology.statuses',
      kind: 'owner',
      dependencies: [{moduleName: 'kernel.base.runtime'}],
      commands: [completed, partial, timedOut, errored].map(item => ({
        name: item.commandName,
        visibility: item.visibility,
      })),
      commandDefinitions: [completed, partial, timedOut, errored],
      actors: [completedActor, partialSuccessActor, partialErrorActor, timedOutActor, errorActor].map(item => ({
        name: item.actorName,
      })),
      actorDefinitions: [completedActor, partialSuccessActor, partialErrorActor, timedOutActor, errorActor],
    });
    const {runtime} = createTopologyRuntime({host, peer, extraModules: [module]});
    await runtime.start();
    try {
      peer.emit({type: 'open', connectionId: 'status-1'});
      peer.emit({
        type: 'message',
        connectionId: 'status-1',
        raw: JSON.stringify({
          type: 'hello',
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          wireId: 'status-peer-hello',
          nodeId: 'node-slave',
          displayName: '副机',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        }),
      });
      await waitForReconciliation();
      const request = (commandDefinition: {readonly commandName: string}, id: string) => ({
        type: 'command-request' as const,
        protocolVersion: 1 as const,
        wireId: `status-request-${id}`,
        requestId: null,
        commandId: id,
        parentCommandId: null,
        commandName: commandDefinition.commandName,
        payload: {},
      });
      peer.emit({
        type: 'message',
        connectionId: 'status-1',
        raw: JSON.stringify(request(completed, 'status-completed')),
      });
      peer.emit({type: 'message', connectionId: 'status-1', raw: JSON.stringify(request(partial, 'status-partial'))});
      peer.emit({
        type: 'message',
        connectionId: 'status-1',
        raw: JSON.stringify(request(timedOut, 'status-timed-out')),
      });
      peer.emit({type: 'message', connectionId: 'status-1', raw: JSON.stringify(request(errored, 'status-error'))});
      await new Promise<void>(resolve => setTimeout(resolve, 25));
      const statuses = peer.sentFrames
        .map(raw => JSON.parse(raw) as {type?: string; commandId?: string; status?: string})
        .filter(frame => frame.type === 'command-result')
        .filter(frame => frame.commandId?.startsWith('status-'));
      expect(statuses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({commandId: 'status-completed', status: 'completed'}),
          expect.objectContaining({commandId: 'status-partial', status: 'partial-failed'}),
          expect.objectContaining({commandId: 'status-timed-out', status: 'timed-out'}),
          expect.objectContaining({commandId: 'status-error', status: 'error'}),
        ]),
      );
      expect(statuses).toHaveLength(4);
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('bounds outbound peer commands before the gateway can grow without limit', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const command = defineCommand<Readonly<{}>>('test.topology.peer-pressure', {
      name: 'run',
      visibility: 'internal',
      allowNoActor: true,
    });
    const module: RuntimeModule = Object.freeze({
      moduleName: 'test.topology.peer-pressure',
      kind: 'owner',
      dependencies: [{moduleName: 'kernel.base.runtime'}],
      commands: [{name: command.commandName, visibility: command.visibility}],
      commandDefinitions: [command],
    });
    const {runtime} = createTopologyRuntime({host, peer, extraModules: [module]});
    await runtime.start();
    try {
      peer.emit({type: 'open', connectionId: 'peer-pressure-1'});
      peer.emit({
        type: 'message',
        connectionId: 'peer-pressure-1',
        raw: JSON.stringify({
          type: 'hello',
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          wireId: 'peer-pressure-peer-hello',
          nodeId: 'node-slave',
          displayName: '副机',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        }),
      });
      await waitForReconciliation();
      const pending = Array.from({length: 256}, () => runtime.dispatchCommand(command, {}, {target: 'peer'}));
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      const overflow = await runtime.dispatchCommand(command, {}, {target: 'peer'});
      expect(overflow.status).toBe('error');
      expect(
        peer.sentFrames
          .map(raw => JSON.parse(raw) as {type?: string})
          .filter(frame => frame.type === 'command-request'),
      ).toHaveLength(256);
      releaseRuntimeForTest(runtime);
      await expect(Promise.all(pending)).resolves.toHaveLength(256);
    } finally {
      if (runtime.status === 'started') releaseRuntimeForTest(runtime);
    }
  });

  it('rejects every pending peer command when the connection is lost instead of leaving promises resident', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const command = defineCommand<Readonly<{}>>('test.topology.disconnect', {
      name: 'run',
      visibility: 'internal',
      allowNoActor: true,
    });
    const module: RuntimeModule = Object.freeze({
      moduleName: 'test.topology.disconnect',
      kind: 'owner',
      dependencies: [{moduleName: 'kernel.base.runtime'}],
      commands: [{name: command.commandName, visibility: command.visibility}],
      commandDefinitions: [command],
    });
    const {runtime} = createTopologyRuntime({host, peer, extraModules: [module]});
    await runtime.start();
    try {
      peer.emit({type: 'open', connectionId: 'disconnect-pending-1'});
      peer.emit({
        type: 'message',
        connectionId: 'disconnect-pending-1',
        raw: JSON.stringify({
          type: 'hello',
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-console',
          wireId: 'disconnect-pending-peer-hello',
          nodeId: 'node-slave',
          displayName: '副机',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        }),
      });
      await waitForReconciliation();
      const pending = runtime.dispatchCommand(command, {}, {target: 'peer'});
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      peer.emit({type: 'close', connectionId: 'disconnect-pending-1', reason: 'test-disconnect'});
      const settled = await Promise.race([
        pending,
        new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 50)),
      ]);
      expect(settled).not.toBe('timeout');
      expect(settled).toMatchObject({status: 'error'});
    } finally {
      if (runtime.status === 'started') releaseRuntimeForTest(runtime);
    }
  });

  it('unsubscribes the topology module before later store changes can send peer frames', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const {runtime} = createTopologyRuntime({host, peer, extraModules: [createTestMembersModule()]});
    await runtime.start();
    const store = runtime.getStore();
    peer.emit({type: 'open', connectionId: 'cleanup-1'});
    peer.emit({
      type: 'message',
      connectionId: 'cleanup-1',
      raw: JSON.stringify({
        type: 'hello',
        protocolVersion: 1,
        moduleName: 'ui.integration.sample-console',
        wireId: 'cleanup-peer-hello',
        nodeId: 'node-slave',
        displayName: '副机',
        instanceMode: 'SLAVE',
        displayRole: 'VICE',
      }),
    });
    await waitForReconciliation();
    const frameCount = peer.sentFrames.length;
    releaseRuntimeForTest(runtime);
    store.dispatch({
      type: 'test/set-members',
      payload: {
        members: [{memberId: 'AFTER', name: '释放后不应发送'}],
        pending: null,
      },
    });
    await waitForReconciliation();
    expect(peer.sentFrames).toHaveLength(frameCount);
  });

  it('drives the host through desired/actual reconciliation and stops on unsupported display topology', async () => {
    const host = new FakeTopologyHost();
    const device = createTestDevice();
    const {runtime} = createTopologyRuntime({host, device});
    await runtime.start();

    const enabled = await runtime.dispatchCommand(
      setTopologyHostEnabledCommand,
      {enabled: true},
      {requestId: createRequestId()},
    );
    expect(enabled.status).toBe('completed');
    await waitForReconciliation();

    expect(host.startCalls).toHaveLength(1);
    expect(host.startCalls[0]).toMatchObject({
      port: 43172,
      basePath: '/terminal-topology',
      heartbeatIntervalMs: 10_000,
      heartbeatTimeoutMs: 30_000,
      identity: expect.objectContaining({instanceMode: 'MASTER'}),
    });
    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({
      displayCount: 1,
      hostDesired: true,
      hostActual: 'running',
      hostAddress: {host: '192.0.2.10', port: 43172, basePath: '/terminal-topology'},
    });

    device.displayCount = 2;
    const refreshed = await runtime.dispatchCommand(refreshTopologyDisplayCommand, {});
    expect(refreshed.status).toBe('completed');
    await waitForReconciliation();
    expect(host.stopCalls).toHaveLength(1);
    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({
      displayCount: 2,
      hostDesired: true,
      hostActual: 'stopped',
      hostAddress: null,
    });
  });

  it('notifies display-scoped owners after the topology display fact is committed', async () => {
    const host = new FakeTopologyHost();
    const device = createTestDevice();
    const observed: number[] = [];
    const {runtime} = createTopologyRuntime({
      host,
      device,
      extraModules: [createDisplayChangedObserverModule(observed)],
    });
    await runtime.start();
    try {
      observed.length = 0;
      device.displayCount = 2;
      const refreshed = await runtime.dispatchCommand(refreshTopologyDisplayCommand, {});
      expect(refreshed.status).toBe('completed');
      expect(observed).toEqual([2]);
      expect(selectTopologyFacts(runtime.getState())?.displayCount).toBe(2);
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('hydrates hostDesired after a JS runtime restart without starting an already-running native host again', async () => {
    const host = new FakeTopologyHost();
    const plainStorage = createProcessMemoryStateStoragePort();
    const protectedStorage = createProcessMemoryStateStoragePort();
    const first = createTopologyRuntime({host, plainStorage, protectedStorage, runtimeName: 'topology-first'});
    await first.runtime.start();
    await first.runtime.dispatchCommand(setTopologyHostEnabledCommand, {enabled: true}, {requestId: createRequestId()});
    await waitForReconciliation();
    await new Promise<void>(resolve => setTimeout(resolve, 10));
    expect(host.startCalls).toHaveLength(1);

    const second = createTopologyRuntime({host, plainStorage, protectedStorage, runtimeName: 'topology-second'});
    await second.runtime.start();
    await waitForReconciliation();

    expect(host.startCalls).toHaveLength(1);
    expect(second.runtime.getState()['kernel.base.topology.state']).toMatchObject({
      hostDesired: true,
      hostActual: 'running',
    });
  });

  it('pairs through the ordered reset sequence and reconnects only after protocol acceptance', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const resetCalls: string[] = [];
    const appControl: AppControlPort = {
      ...unavailableAppControlPort,
      resetRuntime: async input => {
        resetCalls.push(String(input.requestId));
        return Object.freeze({
          status: 'accepted' as const,
          requestId: input.requestId,
          acceptedAt: completedAt,
          terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
        });
      },
    };
    const {runtime} = createTopologyRuntime({host, peer, appControl});
    await runtime.start();
    expect(peer.listenCalls).toBe(1);
    await waitForReconciliation();
    const locator: TopologyLocator = Object.freeze({
      host: '192.0.2.20',
      port: 43172,
      basePath: '/terminal-topology',
      identity: Object.freeze({...identity, nodeId: 'node-master-2'}),
    });
    const paired = await runtime.dispatchCommand(
      pairTopologyCommand,
      {locator},
      {
        requestId: createRequestId(),
        routeContext: {displayMode: 'PRIMARY', workspace: 'MAIN'},
      },
    );
    expect(paired).toMatchObject({status: 'completed'});
    expect(resetCalls).toHaveLength(1);
    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({
      masterLocator: locator,
      peerReachable: false,
      repairPending: true,
    });
    expect(selectRuntimeInstanceMode(runtime.getState())).toBe('SLAVE');
    expect(selectDisplayRole(runtime.getState())).toBe('VICE');

    runtime.getStore().dispatch(topologyActions.setRepairPending(false));
    await waitForReconciliation();

    expect(peer.connectCalls).toEqual(['ws://192.0.2.20:43172/terminal-topology/ws']);
    expect(host.startCalls).toHaveLength(0);
    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({peerReachable: false});

    peer.emit({
      type: 'message',
      raw: JSON.stringify({
        type: 'hello-accepted',
        protocolVersion: 1,
        moduleName: 'ui.integration.sample-console',
        wireId: 'accepted-1',
        nodeId: 'node-master-2',
      }),
    });
    await waitForReconciliation();
    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({peerReachable: true});

    peer.emit({type: 'close', reason: 'test-disconnect'});
    await waitForReconciliation();
    await new Promise<void>(resolve => setTimeout(resolve, 10));
    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({
      masterLocator: locator,
      peerReachable: false,
      hostDesired: false,
    });
    expect(peer.connectCalls).toHaveLength(2);
  });

  it('unpairs in CHIEF then MASTER order before clearing the locator', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const appControl: AppControlPort = {
      ...unavailableAppControlPort,
      resetRuntime: async input =>
        Object.freeze({
          status: 'accepted' as const,
          requestId: input.requestId,
          acceptedAt: completedAt,
          terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
        }),
    };
    const {runtime} = createTopologyRuntime({host, peer, appControl});
    await runtime.start();
    const locator: TopologyLocator = Object.freeze({
      host: '192.0.2.21',
      port: 43172,
      basePath: '/terminal-topology',
      identity: Object.freeze({...identity, nodeId: 'node-master-unpair'}),
    });
    const paired = await runtime.dispatchCommand(
      pairTopologyCommand,
      {locator},
      {requestId: createRequestId(), routeContext: {displayMode: 'PRIMARY', workspace: 'MAIN'}},
    );
    expect(paired.status).toBe('completed');
    runtime.getStore().dispatch(topologyActions.setRepairPending(false));
    await waitForReconciliation();

    const unpairRequestId = createRequestId();
    const unpaired = await runtime.dispatchCommand(
      unpairTopologyCommand,
      {},
      {requestId: unpairRequestId, routeContext: {displayMode: 'PRIMARY', workspace: 'MAIN'}},
    );
    expect(unpaired.status).toBe('completed');
    const commandNames = runtime.journal
      .list()
      .filter(event => String(event.requestId) === String(unpairRequestId) && event.kind === 'command.started')
      .map(event => event.commandName);
    expect(commandNames.indexOf(switchDisplayRoleCommand.commandName)).toBeGreaterThanOrEqual(0);
    expect(commandNames.indexOf(switchInstanceModeCommand.commandName)).toBeGreaterThan(
      commandNames.indexOf(switchDisplayRoleCommand.commandName),
    );
    expect(runtime.getState()[topologySliceName]).toMatchObject({masterLocator: null, repairPending: false});
    expect(selectRuntimeInstanceMode(runtime.getState())).toBe('MASTER');
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF');
    expect(peer.closeCalls).toContain('TOPOLOGY_UNPAIRED');
    expect(
      peer.sentFrames.some(raw => {
        const frame = JSON.parse(raw) as {type?: string; error?: {code?: string; retryable?: boolean}};
        return (
          frame.type === 'closed-error' && frame.error?.code === 'TOPOLOGY_UNPAIRED' && frame.error.retryable === false
        );
      }),
    ).toBe(true);
  });

  it('flushes final unpair facts before a successor runtime can hydrate stale pairing', async () => {
    const plainStorage = createProcessMemoryStateStoragePort();
    const protectedStorage = createProcessMemoryStateStoragePort();
    const first = createTopologyRuntime({
      host: new FakeTopologyHost(),
      plainStorage,
      protectedStorage,
      persistenceKey: 'topology-unpair-hydrate-recovery',
      persistenceDebounceMs: 300,
      appControl: {
        ...unavailableAppControlPort,
        resetRuntime: async input =>
          Object.freeze({
            status: 'accepted' as const,
            requestId: input.requestId,
            acceptedAt: completedAt,
            terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
          }),
      },
    });
    await first.runtime.start();
    try {
      const paired = await first.runtime.dispatchCommand(
        pairTopologyCommand,
        {
          locator: Object.freeze({
            host: '192.0.2.22',
            port: 43172,
            basePath: '/terminal-topology',
            identity: Object.freeze({...identity, nodeId: 'node-hydrate-peer'}),
          }),
        },
        {requestId: createRequestId(), routeContext: {displayMode: 'PRIMARY', workspace: 'MAIN'}},
      );
      expect(paired.status).toBe('completed');
      first.runtime.getStore().dispatch(topologyActions.setRepairPending(false));

      const unpaired = await createTopologyAdminCapability(first.runtime).unpair();
      expect(unpaired.status).toBe('completed');
      expect(selectTopologyFacts(first.runtime.getState())).toMatchObject({paired: false});
    } finally {
      releaseRuntimeForTest(first.runtime);
    }

    const successor = createTopologyRuntime({
      host: new FakeTopologyHost(),
      plainStorage,
      protectedStorage,
      persistenceKey: 'topology-unpair-hydrate-recovery',
      persistenceDebounceMs: 300,
    });
    await successor.runtime.start();
    try {
      expect(selectRuntimeInstanceMode(successor.runtime.getState())).toBe('MASTER');
      expect(selectDisplayRole(successor.runtime.getState())).toBe('CHIEF');
      expect(successor.runtime.getState()[topologySliceName]).toMatchObject({
        masterLocator: null,
        peerIdentity: null,
        peerReachable: false,
        repairPending: false,
      });
      expect(selectTopologyFacts(successor.runtime.getState())).toMatchObject({paired: false});
    } finally {
      releaseRuntimeForTest(successor.runtime);
    }
  });

  it('closes the active peer transport when a received frame fails protocol parsing', async () => {
    const host = new FakeTopologyHost();
    const peer = new FakePeerChannel();
    const appControl: AppControlPort = {
      ...unavailableAppControlPort,
      resetRuntime: async input =>
        Object.freeze({
          status: 'accepted' as const,
          requestId: input.requestId,
          acceptedAt: completedAt,
          terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
        }),
    };
    const {runtime} = createTopologyRuntime({host, peer, appControl});
    await runtime.start();
    const locator: TopologyLocator = Object.freeze({
      host: '192.0.2.20',
      port: 43172,
      basePath: '/terminal-topology',
      identity: Object.freeze({...identity, nodeId: 'node-master-2'}),
    });
    const paired = await runtime.dispatchCommand(
      pairTopologyCommand,
      {locator},
      {requestId: createRequestId(), routeContext: {displayMode: 'PRIMARY', workspace: 'MAIN'}},
    );
    expect(paired.status).toBe('completed');
    runtime.getStore().dispatch(topologyActions.setRepairPending(false));
    await waitForReconciliation();
    expect(peer.connectCalls).toHaveLength(1);

    peer.emit({type: 'message', connectionId: 'fake-topology-connection-1', raw: '{not-json'});
    await waitForReconciliation();

    expect(peer.closeCalls).toHaveLength(1);
    expect(peer.closeCalls[0]).toBeTruthy();
    releaseRuntimeForTest(runtime);
  });

  it('preserves a typed port-occupied error at the host lifecycle boundary', async () => {
    const host = new FakeTopologyHost();
    host.startFailureCode = 'TOPOLOGY_HOST_PORT_OCCUPIED';
    const {runtime} = createTopologyRuntime({host});
    await runtime.start();
    await runtime.dispatchCommand(setTopologyHostEnabledCommand, {enabled: true}, {requestId: createRequestId()});
    await waitForReconciliation();

    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({
      hostDesired: true,
      hostActual: 'error',
      hostErrorCode: 'TOPOLOGY_HOST_PORT_OCCUPIED',
    });

    host.startFailureCode = undefined;
    const retried = await runtime.dispatchCommand(
      setTopologyHostEnabledCommand,
      {enabled: true},
      {requestId: createRequestId()},
    );
    expect(retried.status).toBe('completed');
    await waitForReconciliation();

    expect(host.startCalls).toHaveLength(2);
    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({
      hostDesired: true,
      hostActual: 'running',
      hostErrorCode: null,
      hostAddress: {host: '192.0.2.10', port: 43172, basePath: '/terminal-topology'},
    });
  });
});
