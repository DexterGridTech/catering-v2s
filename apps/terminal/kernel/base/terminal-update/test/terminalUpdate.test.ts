import {afterEach, describe, expect, it, vi} from 'vitest';
import {createNodeId, createRequestId, type TimestampMs} from '@catering-v2s/kernel-base-contracts';
import {createStateRuntime, defineStateRuntimeSlice} from '@catering-v2s/kernel-base-state';
import {
  createPlatformPorts,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type PortResult,
} from '@catering-v2s/kernel-base-platform-ports';
import {
  defaultMaxCommandDepth,
  defaultRequestMaxResidenceMs,
  createRuntime,
  primarySurfaceReadyCommand,
  type Runtime,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import {releaseRuntimeForTestAsync} from '@catering-v2s/kernel-base-runtime/testing';
import {moduleName as contractsModuleName} from '@catering-v2s/kernel-base-contracts';
import {
  moduleName as platformPortsModuleName,
  type UpdateAction,
  type UpdateActualVersions,
  type UpdateFacts,
  type UpdatePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as stateModuleName} from '@catering-v2s/kernel-base-state';
import {
  acceptTerminalUpdateTargetCommand,
  confirmTerminalUpdateBootCommand,
  createTerminalUpdateModule,
  refreshTerminalUpdateRuleSnapshotCommand,
  reconcileTerminalUpdateCommand,
  selectTerminalUpdateRuleSnapshot,
  selectTerminalUpdateRecentStatus,
  selectTerminalUpdateTask,
  type FixedUpdateTarget,
  type UpdateTargetSourceProvider,
} from '../src/index';
import {
  acceptTerminalTopicNotificationCommand,
  moduleName as terminalDataClientModuleName,
  readTerminalDataCommand,
  requestTerminalUpdateDownloadGrantCommand,
  selectActivationState,
  selectConnectionState,
  selectTerminalTopicSubscriptions,
  submitTerminalUpdateReportCommand,
  subscribeTerminalTopicCommand,
  terminalDataHeartbeatCommand,
  terminalTopicChangedCommand,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  terminalDataClientActions,
  terminalDataClientReducer,
  terminalDataClientSliceName,
  terminalDataClientStateSlice,
} from '../../terminal-data-client/src/features/slices/terminalDataClient';
import {
  terminalUpdateActions,
  terminalUpdateRegistration,
  terminalUpdateSliceName,
} from '../src/features/slices/terminalUpdate';
import {createTerminalUpdateActor} from '../src/features/actors/terminalUpdateActor';
import type {TerminalUpdateState, UpdateRuleSnapshotContext} from '../src/types/terminalUpdate';
import {createPersistenceFieldKey, createPersistenceNamespacePrefix} from '../../state/src/foundations/keyspace';

const ok = <TValue>(value: TValue): PortResult<TValue> => ({status: 'succeeded', value, completedAt: 1 as TimestampMs});
const artifact = Object.freeze({
  schemaVersion: 1 as const,
  platform: 'android' as const,
  applicationId: 'com.example.terminal',
  nativeVersion: '1.0.0',
  nativeBuildNumber: 1,
  bundleVersion: '1.0.0',
  runtimeVersion: '1',
  entry: 'index.android.bundle',
  files: Object.freeze([{path: 'index.android.bundle', sizeBytes: 0, sha256: 'a'.repeat(64)}]),
  publicationId: 'b'.repeat(64),
});
const target: FixedUpdateTarget = Object.freeze({
  ruleRef: 'fixture-rule',
  createdAt: 1 as TimestampMs,
  applicationId: artifact.applicationId,
  full: Object.freeze({sourceRef: 'artifact:full', expectedSha256: artifact.publicationId, artifact}),
  hot: Object.freeze({sourceRef: 'artifact:hot', expectedSha256: artifact.publicationId, artifact}),
  strategy: Object.freeze({maxNetworkAttempts: 2, bootTimeoutMs: 60_000}),
  selectionContext: Object.freeze({
    selectedSpace: 'development',
    contextIdentity: 'fixture-context',
    ruleRef: 'fixture-rule',
  }),
});
const newerHotArtifact = Object.freeze({...artifact, bundleVersion: '1.0.1', publicationId: 'c'.repeat(64)});
const fixedResumeTarget: FixedUpdateTarget = Object.freeze({
  ...target,
  hot: Object.freeze({
    sourceRef: 'artifact:hot-next',
    expectedSha256: newerHotArtifact.publicationId,
    artifact: newerHotArtifact,
  }),
});

describe('terminal-update command deadline', () => {
  it('keeps the full-update command and runtime residence limits consistent', () => {
    expect(acceptTerminalUpdateTargetCommand.timeoutMs).toBe(300_000);
    expect(defaultRequestMaxResidenceMs).toBeGreaterThan(
      defaultMaxCommandDepth * acceptTerminalUpdateTargetCommand.timeoutMs,
    );
  });
});

const facts: UpdateFacts = Object.freeze({
  actual: Object.freeze({
    applicationId: artifact.applicationId,
    nativeVersion: artifact.nativeVersion,
    nativeBuildNumber: artifact.nativeBuildNumber,
    runtimeVersion: artifact.runtimeVersion,
    bundleVersion: artifact.bundleVersion,
    publicationId: artifact.publicationId,
    bootId: 'fixture-boot',
    entryKind: 'embedded' as const,
  }),
  embedded: artifact,
  selectedPublicationId: artifact.publicationId,
  previousPublicationId: null,
  candidatePublicationId: null,
  installerActionId: null,
  installerState: 'none',
  selectionResetReason: null,
});
const noAction: UpdateAction = Object.freeze({
  actionId: 'action',
  taskId: 'task',
  state: 'accepted',
  reason: null,
  publicationId: artifact.publicationId,
  bootId: null,
});

let testProtocolUuidSequence = 0;
const createTestProtocolUuid = (): string =>
  `40000000-0000-4000-8000-${String(++testProtocolUuidSequence).padStart(12, '0')}`;
const createTestTerminalUpdateModule = (
  input: Omit<Parameters<typeof createTerminalUpdateModule>[0], 'createProtocolUuid'>,
) => createTerminalUpdateModule({...input, createProtocolUuid: createTestProtocolUuid});
const createTestTerminalUpdateActor = (
  input: Omit<Parameters<typeof createTerminalUpdateActor>[0], 'createProtocolUuid'>,
) => createTerminalUpdateActor({...input, createProtocolUuid: createTestProtocolUuid});

const createFixture = (
  input: Readonly<{
    targetAvailable?: boolean;
    readTarget?: UpdateTargetSourceProvider['readTarget'];
    resolveSourcePath?: UpdateTargetSourceProvider['resolveSourcePath'];
    readNetworkSnapshot?: Parameters<typeof createTerminalUpdateModule>[0]['readNetworkSnapshot'];
    persistKv?: ReturnType<typeof createStorage>;
    persistenceKey?: string;
    port?: UpdatePort;
  }> = {},
) => {
  const persistenceKey = input.persistenceKey ?? `terminal-update-test-${createRequestId()}`;
  const port: UpdatePort = input.port ?? {
    readFacts: async () => ok(facts),
    prepareArtifact: async () => ok({preparedId: 'prepared', artifact}),
    applyPrepared: async () => ok(noAction),
    readAction: async () => ok(noAction),
    confirmBoot: async () => ok({confirmed: true}),
    releasePrepared: async () => ok({released: true}),
  };
  const transportModule: RuntimeModule = {
    moduleName: 'kernel.base.transport',
    kind: 'toolkit',
    dependencies: [{moduleName: 'kernel.base.runtime'}],
  };
  const terminalCommands = [
    subscribeTerminalTopicCommand,
    acceptTerminalTopicNotificationCommand,
    readTerminalDataCommand,
    requestTerminalUpdateDownloadGrantCommand,
    submitTerminalUpdateReportCommand,
    terminalDataHeartbeatCommand,
    terminalTopicChangedCommand,
  ] as const;
  const terminalDataClientModule: RuntimeModule = {
    moduleName: terminalDataClientModuleName,
    kind: 'owner',
    dependencies: [{moduleName: 'kernel.base.runtime'}, {moduleName: 'kernel.base.transport'}],
    commands: terminalCommands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: terminalCommands,
    selectorDefinitions: [selectActivationState, selectConnectionState, selectTerminalTopicSubscriptions],
    slices: [{name: terminalDataClientStateSlice.name, persistIntent: 'owner-only'}],
    stateSlices: [terminalDataClientStateSlice],
  };
  const modules: readonly RuntimeModule[] = [
    {moduleName: contractsModuleName, kind: 'toolkit', dependencies: []},
    {moduleName: platformPortsModuleName, kind: 'toolkit', dependencies: [{moduleName: contractsModuleName}]},
    {
      moduleName: stateModuleName,
      kind: 'toolkit',
      dependencies: [{moduleName: contractsModuleName}, {moduleName: platformPortsModuleName}],
    },
    transportModule,
    terminalDataClientModule,
    createTestTerminalUpdateModule({
      port,
      sourceProvider: {
        readTarget: input.readTarget ?? (async () => (input.targetAvailable === false ? null : target)),
        resolveSourcePath: input.resolveSourcePath ?? (() => '/fixture/unused'),
      },
      readNetworkSnapshot: input.readNetworkSnapshot ?? (() => ({addresses: []})),
    }),
  ];
  const runtime = createRuntime({
    localNodeId: createNodeId(),
    modules,
    platformPorts: createPlatformPorts({
      environmentMode: 'TEST',
      bindings: {
        logger: {kind: 'console'},
        persistKv: input.persistKv ?? createStorage(),
        persistSecure: createStorage(),
        device: unavailableDevicePort,
        appControl: unavailableAppControlPort,
        script: unavailableScriptPort,
        connector: unavailableConnectorPort,
        update: port,
        logUpload: unavailableLogUploadPort,
        topologyHost: unavailableTopologyHostPort,
      },
    }),
    state: {
      runtimeName: persistenceKey,
      environmentMode: 'TEST',
      persistenceKey,
      persistenceDebounceMs: 0,
    },
  });
  return runtime;
};

const createStorage = (input: Readonly<{failWrite?: (key: string) => boolean; failWriteCount?: number}> = {}) => {
  const values = new Map<string, string>();
  const failedWriteKeys: string[] = [];
  let remainingWriteFailures = input.failWriteCount ?? 0;
  const success = <TValue>(value: TValue): PortResult<TValue> => ({
    status: 'succeeded',
    value,
    completedAt: 1 as TimestampMs,
  });
  return {
    values,
    failedWriteKeys,
    read: async ({key}: {key: string}) =>
      success(values.has(key) ? {state: 'found' as const, value: values.get(key)!} : {state: 'missing' as const}),
    write: async ({key, value}: {key: string; value: string}) => {
      if (remainingWriteFailures > 0 && input.failWrite?.(key)) {
        remainingWriteFailures -= 1;
        failedWriteKeys.push(key);
        return {
          status: 'failed' as const,
          port: 'persistKv' as const,
          capability: 'write',
          error: {code: 'FIXTURE_WRITE_FAILED', message: 'fixture write failure', retryable: true},
        };
      }
      values.set(key, value);
      return success({completed: true as const});
    },
    remove: async ({key}: {key: string}) => {
      values.delete(key);
      return success({completed: true as const});
    },
    readMany: async ({keys}: {keys: readonly string[]}) =>
      success(
        keys.map(key => ({
          key,
          result: values.has(key) ? {state: 'found' as const, value: values.get(key)!} : {state: 'missing' as const},
        })),
      ),
    writeMany: async ({entries}: {entries: readonly {key: string; value: string}[]}) => {
      for (const entry of entries) values.set(entry.key, entry.value);
      return success({completed: true as const});
    },
    removeMany: async ({keys}: {keys: readonly string[]}) => {
      for (const key of keys) values.delete(key);
      return success({completed: true as const});
    },
    listKeys: async () => success([...values.keys()]),
    clear: async () => {
      values.clear();
      return success({completed: true as const});
    },
  };
};

describe('terminal-update project rule snapshot', () => {
  it('gives state-triggered rule refresh a request identity for its public child commands', async () => {
    const clientState = terminalDataClientReducer(undefined, {type: 'test/init'});
    const updateState = {
      ruleSnapshot: Object.freeze({
        contextIdentity: null,
        selectedSpace: null,
        projectRef: null,
        collectionHash: null,
        items: Object.freeze([]),
      }),
      ruleSnapshotStatus: Object.freeze({status: 'empty', errorCode: null}),
      reportDescriptor: Object.freeze({
        bindingIdentity: null,
        contextIdentity: null,
        nextReportSequence: 1,
        pendingReports: Object.freeze({}),
        sendPaused: false,
        latestDeliveryFailure: null,
      }),
    };
    const state = {[terminalDataClientSliceName]: clientState, [terminalUpdateSliceName]: updateState};
    const dispatchCalls: Array<
      Readonly<{
        commandName: string;
        options?: Readonly<{requestId?: string}>;
      }>
    > = [];
    const dispatchCommand = async (
      command: Readonly<{commandName: string}>,
      _payload: unknown,
      options?: Readonly<{requestId?: string}>,
    ) => {
      dispatchCalls.push(Object.freeze({commandName: command.commandName, options}));
      return Object.freeze({status: 'completed' as const, actorResults: Object.freeze([])});
    };
    const stateListener: {current?: () => void} = {};
    let ruleContext: UpdateRuleSnapshotContext | null = null;
    const runtimeModule = createTestTerminalUpdateModule({
      port: {} as UpdatePort,
      readRuleSnapshotContext: () => ruleContext as never,
    });
    await runtimeModule.install?.({
      dispatchCommand,
      getState: () => state,
      subscribeState: (next: () => void) => {
        stateListener.current = next;
        return () => undefined;
      },
      registerResource: () => () => undefined,
      platformPorts: {logger: {info: () => undefined, warn: () => undefined, error: () => undefined}},
    } as never);

    ruleContext = {
      terminalRef: '00000000-0000-4000-8000-000000000010',
      bindingGeneration: 4,
      selectedSpace: 'development',
      storeRef: '00000000-0000-4000-8000-000000000011',
      projectRef: '00000000-0000-4000-8000-000000000012',
      projectUpdatedAtEpochMillis: 17,
    };
    if (stateListener.current === undefined) throw new Error('terminal update state listener was not installed');
    stateListener.current();

    await vi.waitFor(() => {
      const refreshCalls = dispatchCalls.filter(
        call => call.commandName === refreshTerminalUpdateRuleSnapshotCommand.commandName,
      );
      expect(refreshCalls).toHaveLength(2);
      expect(
        refreshCalls.every(call => typeof call.options?.requestId === 'string' && call.options.requestId.length > 0),
      ).toBe(true);
    });
  });

  it('uses the persisted CBS snapshot when the module has no local source provider', async () => {
    const projectRef = '00000000-0000-4000-8000-000000000010';
    const terminalRef = '00000000-0000-4000-8000-000000000011';
    const storeRef = '00000000-0000-4000-8000-000000000012';
    const bindingGeneration = 4;
    const projectUpdatedAtEpochMillis = 17;
    const contextIdentity = `${terminalRef}:${bindingGeneration}:development:${storeRef}:${projectRef}:${projectUpdatedAtEpochMillis}`;
    const selectionContext = Object.freeze({selectedSpace: 'development', contextIdentity, ruleRef: 'cbs-rule-1'});
    let clientState = terminalDataClientReducer(undefined, {type: 'test/init'});
    clientState = terminalDataClientReducer(
      clientState,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'development',
        terminalRef,
        storeRef,
        deviceId: 'fixture-device',
        bindingGeneration,
        credentialSecret: 'S'.repeat(43),
      }),
    );
    let updateState: TerminalUpdateState = {
      ruleSnapshot: Object.freeze({
        contextIdentity,
        selectedSpace: 'development',
        projectRef,
        collectionHash: 'a'.repeat(64),
        items: Object.freeze([
          Object.freeze({
            ruleRef: selectionContext.ruleRef,
            targetMode: 'ALL' as const,
            storeRefs: Object.freeze([]),
            applicationId: 'com.example.terminal',
            createdAtEpochMillis: 21,
            full: Object.freeze({
              artifactRef: 'full-artifact',
              kind: 'FULL' as const,
              applicationId: 'com.example.terminal',
              runtimeVersion: '1',
              nativeBuildNumber: 20,
              apkVersion: '1.0.0',
              jsVersion: '1.0.0',
              publicationId: 'full-publication',
              apkSha256: 'c'.repeat(64),
              zipSha256: 'b'.repeat(64),
              byteSize: 100,
              createdAtEpochMillis: 20,
            }),
            hot: null,
            nSeconds: 300,
            hotStrategy: null,
            mSeconds: null,
            description: null,
          }),
        ]),
      }),
      ruleSnapshotStatus: Object.freeze({status: 'ready', errorCode: null}),
      currentTask: null,
      recentStatus: {taskId: null, state: 'idle', reason: null, changedAt: 0 as TimestampMs},
      failedArtifactIds: [],
      actualVersions: null,
      reportDescriptor: {
        bindingIdentity: null,
        contextIdentity: null,
        nextReportSequence: 1,
        pendingReports: {},
        sendPaused: false,
        latestDeliveryFailure: null,
      },
    };
    let readFactsCount = 0;
    const port = {
      readFacts: async () => {
        readFactsCount += 1;
        return readFactsCount === 1
          ? {
              status: 'succeeded',
              value: Object.freeze({...facts, actual: Object.freeze({...facts.actual!, apkSha256: 'd'.repeat(64)})}),
            }
          : {status: 'failed', error: {code: 'FIXTURE_STOP'}};
      },
    } as unknown as UpdatePort;
    const module = createTestTerminalUpdateModule({
      port,
      readRuleSnapshotContext: () =>
        Object.freeze({
          terminalRef,
          bindingGeneration,
          selectedSpace: 'development',
          storeRef,
          projectRef,
          projectUpdatedAtEpochMillis,
        }),
    });
    const actor = module.actorDefinitions?.[0];
    const handler = actor?.handlers.find(item => item.commandName === acceptTerminalUpdateTargetCommand.commandName);
    if (handler === undefined) throw new Error('module target acceptance handler missing');
    const context = {
      runtimeId: 'module-snapshot-test-runtime',
      command: {
        commandName: acceptTerminalUpdateTargetCommand.commandName,
        commandId: 'accept',
        requestId: null,
        payload: {selectionContext},
      },
      actor: {actorKey: 'update-owner', moduleName: 'kernel.base.terminal-update', actorName: 'update-owner'},
      platformPorts: {logger: {info: () => undefined, warn: () => undefined, error: () => undefined}},
      getState: () => ({
        [terminalDataClientSliceName]: clientState,
        [terminalUpdateSliceName]: updateState,
      }),
      dispatchAction: (action: unknown) => {
        const value = action as {type: string; payload: unknown};
        if (value.type === terminalUpdateActions.replaceTask.type)
          updateState = {...updateState, currentTask: value.payload as TerminalUpdateState['currentTask']};
        if (value.type === terminalUpdateActions.replaceRecentStatus.type)
          updateState = {...updateState, recentStatus: value.payload as TerminalUpdateState['recentStatus']};
        if (value.type === terminalUpdateActions.replaceReportDescriptor.type)
          updateState = {...updateState, reportDescriptor: value.payload as TerminalUpdateState['reportDescriptor']};
        if (value.type === terminalUpdateActions.replaceActualVersions.type)
          updateState = {...updateState, actualVersions: value.payload as TerminalUpdateState['actualVersions']};
      },
      flushPersistence: async () => ({status: 'succeeded'}),
      dispatchCommand: async () => ({status: 'rejected'}),
    } as never;

    await expect(handler.handle(context)).resolves.toMatchObject({status: 'unknown', reason: 'failed'});
    expect(updateState.currentTask?.target).toMatchObject({
      ruleRef: selectionContext.ruleRef,
      full: {artifactRef: 'full-artifact'},
      selectionContext,
    });
    const pendingReport = Object.values(updateState.reportDescriptor.pendingReports)[0];
    expect(pendingReport?.idempotencyKey).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/u);
    expect(pendingReport?.body.reportId).toBe(pendingReport?.idempotencyKey);
    expect(pendingReport?.body.actual.apkSha256).toBe('d'.repeat(64));
    expect(pendingReport?.body.recent.state).toBe('UNKNOWN');
  });

  it('reuses the accepted topic time when an existing project subscription is refreshed', async () => {
    const projectRef = '00000000-0000-4000-8000-000000000010';
    const terminalRef = '00000000-0000-4000-8000-000000000011';
    const storeRef = '00000000-0000-4000-8000-000000000012';
    const subscriberKey = 'kernel.base.terminal-update';
    const subscriptionId = '00000000-0000-4000-8000-000000000013';
    const acceptedTimeEpochMillis = 42_000;
    let clientState = terminalDataClientReducer(undefined, {type: 'test/init'});
    clientState = terminalDataClientReducer(
      clientState,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'development',
        terminalRef,
        storeRef,
        deviceId: 'fixture-device',
        bindingGeneration: 4,
        credentialSecret: 'S'.repeat(43),
      }),
    );
    const identityKey = JSON.stringify([
      'development',
      terminalRef,
      storeRef,
      4,
      subscriberKey,
      'TERMINAL_UPDATE_RULES',
      projectRef,
    ]);
    clientState = terminalDataClientReducer(
      clientState,
      terminalDataClientActions.putTopicSubscription({
        identityKey,
        subscription: Object.freeze({
          subscriptionId,
          identityKey,
          subscriberKey,
          topicKey: 'TERMINAL_UPDATE_RULES',
          ownerRef: projectRef,
          acceptedTimeEpochMillis,
          pendingNotification: null,
        }),
      }),
    );
    let updateState: TerminalUpdateState = {
      ruleSnapshot: {contextIdentity: null, selectedSpace: null, projectRef: null, collectionHash: null, items: []},
      ruleSnapshotStatus: {status: 'empty', errorCode: null},
      currentTask: null,
      recentStatus: {taskId: null, state: 'idle', reason: null, changedAt: 0 as TimestampMs},
      failedArtifactIds: [],
      actualVersions: null,
      reportDescriptor: {
        bindingIdentity: `${terminalRef}:4`,
        contextIdentity: 'old-rule-context',
        nextReportSequence: 2,
        pendingReports: {stale: {idempotencyKey: 'stale', body: {} as never}},
        sendPaused: true,
        latestDeliveryFailure: {
          taskId: 'stale-task',
          reportId: 'stale',
          reportSequence: 1,
          reasonCode: 'OLD_CONTEXT',
          observedAt: 1 as TimestampMs,
        },
      },
    };
    const currentState = () => ({
      [terminalDataClientSliceName]: clientState,
      [terminalUpdateSliceName]: updateState,
    });
    const page = Object.freeze({
      items: Object.freeze([
        Object.freeze({
          ruleRef: 'full-only-rule',
          targetMode: 'ALL' as const,
          storeRefs: Object.freeze([]),
          applicationId: 'com.example.terminal',
          createdAtEpochMillis: 21,
          full: Object.freeze({
            artifactRef: 'full-artifact',
            kind: 'FULL' as const,
            applicationId: 'com.example.terminal',
            runtimeVersion: '1',
            nativeBuildNumber: 20,
            apkVersion: '1.0.0',
            jsVersion: '1.0.0',
            publicationId: 'full-publication',
            apkSha256: 'c'.repeat(64),
            zipSha256: 'b'.repeat(64),
            byteSize: 100,
            createdAtEpochMillis: 20,
          }),
          hot: null,
          nSeconds: 300,
          hotStrategy: null,
          mSeconds: null,
          description: null,
        }),
      ]),
      collectionHash: 'a'.repeat(64),
      nextCursor: null,
    });
    const dispatchCommand = vi.fn(async (definition: {commandName: string}, payload: unknown) => {
      if (definition.commandName === 'kernel.base.terminal-data-client.subscribe-topic')
        return {status: 'completed', actorResults: [{status: 'completed', result: {status: 'already-subscribed'}}]};
      if (definition.commandName === 'kernel.base.terminal-data-client.read-terminal-data')
        return {status: 'completed', actorResults: [{status: 'completed', result: {kind: 'success', body: page}}]};
      throw new Error(`Unexpected command: ${definition.commandName} ${String(payload)}`);
    });
    const actor = createTestTerminalUpdateActor({
      port: {} as UpdatePort,
      readRuleSnapshotContext: () =>
        Object.freeze({
          terminalRef,
          bindingGeneration: 4,
          selectedSpace: 'development',
          storeRef,
          projectRef,
          projectUpdatedAtEpochMillis: 17,
        }),
    });
    const handler = actor.handlers.find(
      item => item.commandName === refreshTerminalUpdateRuleSnapshotCommand.commandName,
    );
    if (handler === undefined) throw new Error('rule snapshot refresh handler missing');
    const context = {
      runtimeId: 'snapshot-test-runtime',
      command: {
        commandName: refreshTerminalUpdateRuleSnapshotCommand.commandName,
        commandId: 'refresh',
        requestId: null,
        payload: {},
      },
      actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
      platformPorts: {logger: {info: () => undefined, warn: () => undefined, error: () => undefined}},
      getState: currentState,
      dispatchAction: (action: unknown) => {
        const value = action as {type: string; payload: unknown};
        if (value.type === terminalUpdateActions.replaceRuleSnapshot.type)
          updateState = {...updateState, ruleSnapshot: value.payload as TerminalUpdateState['ruleSnapshot']};
        if (value.type === terminalUpdateActions.replaceRuleSnapshotStatus.type)
          updateState = {
            ...updateState,
            ruleSnapshotStatus: value.payload as TerminalUpdateState['ruleSnapshotStatus'],
          };
        if (value.type === terminalUpdateActions.replaceReportDescriptor.type)
          updateState = {...updateState, reportDescriptor: value.payload as TerminalUpdateState['reportDescriptor']};
      },
      flushPersistence: async () => ({status: 'succeeded'}),
      dispatchCommand,
    } as never;

    await expect(handler.handle(context)).resolves.toMatchObject({status: 'ready'});
    const subscriptionCall = dispatchCommand.mock.calls.find(call => call[0].commandName.endsWith('.subscribe-topic'));
    expect(subscriptionCall?.[1]).toMatchObject({initialTimeEpochMillis: acceptedTimeEpochMillis});
    expect(updateState.ruleSnapshotStatus).toEqual({status: 'ready', errorCode: null});
    expect(updateState.ruleSnapshot).toMatchObject({
      contextIdentity: expect.any(String),
      projectRef,
      collectionHash: page.collectionHash,
    });
    expect(updateState.ruleSnapshot.items).toMatchObject([
      {ruleRef: 'full-only-rule', hot: null, hotStrategy: null, mSeconds: null},
    ]);
    expect(selectTerminalUpdateRuleSnapshot(currentState(), 'full-only-rule').items).toMatchObject([
      {
        ruleRef: 'full-only-rule',
        applicationId: 'com.example.terminal',
        full: {kind: 'FULL', apkSha256: 'c'.repeat(64)},
      },
    ]);
    expect(updateState.reportDescriptor).toMatchObject({
      bindingIdentity: `${terminalRef}:4`,
      contextIdentity: expect.any(String),
      pendingReports: {},
      sendPaused: false,
      latestDeliveryFailure: null,
    });
  });

  it('restores the pending report when a successful receipt cannot be flushed locally', async () => {
    const terminalRef = '00000000-0000-4000-8000-000000000011';
    const storeRef = '00000000-0000-4000-8000-000000000012';
    const bindingGeneration = 4;
    const bindingIdentity = `${terminalRef}:${bindingGeneration}`;
    const reportId = 'report-1';
    const taskId = 'task-1';
    const pendingReport = Object.freeze({
      idempotencyKey: reportId,
      body: Object.freeze({
        reportId,
        reportSequence: 7,
        taskId,
        actual: Object.freeze({
          apkVersion: null,
          nativeBuildNumber: null,
          applicationId: 'com.example.terminal',
          runtimeVersion: 'unknown',
          jsVersion: null,
          publicationId: null,
          apkSha256: null,
          bundleSha256: null,
          entryKind: 'UNKNOWN' as const,
          unknownReason: 'READBACK_UNAVAILABLE' as const,
        }),
        recent: Object.freeze({
          state: 'SUCCEEDED' as const,
          reason: 'NONE' as const,
          changedAtEpochMillis: 1,
          ruleRef: 'rule-1',
          fullArtifactRef: 'full-artifact',
          hotArtifactRef: null,
        }),
      }),
    });
    let clientState = terminalDataClientReducer(undefined, {type: 'test/init'});
    clientState = terminalDataClientReducer(
      clientState,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'development',
        terminalRef,
        storeRef,
        deviceId: 'fixture-device',
        bindingGeneration,
        credentialSecret: 'S'.repeat(43),
      }),
    );
    const sessionId = 'session-report-flush';
    clientState = terminalDataClientReducer(
      clientState,
      terminalDataClientActions.setConnection(
        Object.freeze({
          status: 'connected',
          addressName: 'dev',
          nodeId: 'tds-1',
          sessionId,
          lastCloseReason: null,
        }),
      ),
    );
    let updateState: TerminalUpdateState = {
      ruleSnapshot: {contextIdentity: null, selectedSpace: null, projectRef: null, collectionHash: null, items: []},
      ruleSnapshotStatus: {status: 'empty', errorCode: null},
      currentTask: null,
      recentStatus: {taskId, state: 'succeeded', reason: null, changedAt: 1 as TimestampMs},
      failedArtifactIds: [],
      actualVersions: null,
      reportDescriptor: {
        bindingIdentity,
        contextIdentity: null,
        nextReportSequence: 8,
        pendingReports: {[taskId]: pendingReport},
        sendPaused: false,
        latestDeliveryFailure: null,
      },
    };
    const module = createTestTerminalUpdateModule({port: {} as UpdatePort});
    const actor = module.actorDefinitions?.[0];
    const handler = actor?.handlers.find(item => item.commandName === terminalDataHeartbeatCommand.commandName);
    if (handler === undefined) throw new Error('heartbeat report handler missing');
    const context = {
      runtimeId: 'report-flush-test-runtime',
      command: {
        commandName: terminalDataHeartbeatCommand.commandName,
        commandId: 'heartbeat',
        requestId: null,
        payload: {bindingGeneration, sessionId, sequence: 1, observedAt: 2, rttMs: 1},
      },
      actor: {actorKey: 'update-owner', moduleName: 'kernel.base.terminal-update', actorName: 'update-owner'},
      platformPorts: {logger: {info: () => undefined, warn: () => undefined, error: () => undefined}},
      getState: () => ({
        [terminalDataClientSliceName]: clientState,
        [terminalUpdateSliceName]: updateState,
      }),
      dispatchAction: (action: unknown) => {
        const value = action as {type: string; payload: unknown};
        if (value.type === terminalUpdateActions.replaceReportDescriptor.type)
          updateState = {...updateState, reportDescriptor: value.payload as TerminalUpdateState['reportDescriptor']};
      },
      flushPersistence: async () => ({status: 'failed'}),
      dispatchCommand: async (definition: {commandName: string}, payload: unknown) => {
        expect(definition.commandName).toBe(submitTerminalUpdateReportCommand.commandName);
        expect(payload).toBe(pendingReport);
        return {
          status: 'completed',
          actorResults: [
            {
              status: 'completed',
              result: {
                kind: 'success',
                body: {reportId, taskId, acceptedSequence: 7, outcome: 'ACCEPTED'},
              },
            },
          ],
        };
      },
    } as never;

    await expect(handler.handle(context)).resolves.toEqual({status: 'receipt-flush-failed'});
    expect(updateState.reportDescriptor.pendingReports).toEqual({[taskId]: pendingReport});
  });

  it('releases an expired report wait and ignores an older late outcome after a retry starts', async () => {
    const terminalRef = '00000000-0000-4000-8000-000000000051';
    const storeRef = '00000000-0000-4000-8000-000000000052';
    const bindingGeneration = 7;
    const bindingIdentity = `${terminalRef}:${bindingGeneration}`;
    const sessionId = 'session-report-late';
    const report = Object.freeze({
      idempotencyKey: 'late-report',
      body: Object.freeze({
        reportId: 'late-report',
        reportSequence: 3,
        taskId: 'task-late',
        actual: Object.freeze({
          apkVersion: null,
          nativeBuildNumber: null,
          applicationId: 'com.example.terminal',
          runtimeVersion: 'unknown',
          jsVersion: null,
          publicationId: null,
          apkSha256: null,
          bundleSha256: null,
          entryKind: 'UNKNOWN' as const,
          unknownReason: 'READBACK_UNAVAILABLE' as const,
        }),
        recent: Object.freeze({
          state: 'SUCCEEDED' as const,
          reason: 'NONE' as const,
          changedAtEpochMillis: 3,
          ruleRef: 'rule-late',
          fullArtifactRef: 'full-late',
          hotArtifactRef: null,
        }),
      }),
    });
    let clientState = terminalDataClientReducer(undefined, {type: 'test/init'});
    clientState = terminalDataClientReducer(
      clientState,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'development',
        terminalRef,
        storeRef,
        deviceId: 'fixture-device',
        bindingGeneration,
        credentialSecret: 'S'.repeat(43),
      }),
    );
    clientState = terminalDataClientReducer(
      clientState,
      terminalDataClientActions.setConnection(
        Object.freeze({
          status: 'connected',
          addressName: 'dev',
          nodeId: 'tds-1',
          sessionId,
          lastCloseReason: null,
        }),
      ),
    );
    let updateState: TerminalUpdateState = {
      ruleSnapshot: {contextIdentity: null, selectedSpace: null, projectRef: null, collectionHash: null, items: []},
      ruleSnapshotStatus: {status: 'empty', errorCode: null},
      currentTask: null,
      recentStatus: {taskId: 'task-late', state: 'succeeded', reason: null, changedAt: 3 as TimestampMs},
      failedArtifactIds: [],
      actualVersions: null,
      reportDescriptor: {
        bindingIdentity,
        contextIdentity: null,
        nextReportSequence: 4,
        pendingReports: {'task-late': report},
        sendPaused: false,
        latestDeliveryFailure: null,
      },
    };
    let sendCount = 0;
    const lateOutcomes: Array<((record: unknown) => void) | undefined> = [];
    const actor = createTestTerminalUpdateModule({port: {} as UpdatePort}).actorDefinitions?.[0];
    const handler = actor?.handlers.find(item => item.commandName === terminalDataHeartbeatCommand.commandName);
    if (handler === undefined) throw new Error('heartbeat report handler missing');
    const context = {
      runtimeId: 'report-late-single-flight-test-runtime',
      command: {
        commandName: terminalDataHeartbeatCommand.commandName,
        commandId: 'heartbeat',
        requestId: null,
        payload: {bindingGeneration, sessionId, sequence: 1, observedAt: 3, rttMs: 1},
      },
      actor: {actorKey: 'update-owner', moduleName: 'kernel.base.terminal-update', actorName: 'update-owner'},
      platformPorts: {logger: {info: () => undefined, warn: () => undefined, error: () => undefined}},
      getState: () => ({[terminalDataClientSliceName]: clientState, [terminalUpdateSliceName]: updateState}),
      dispatchAction: (action: unknown) => {
        const value = action as {type: string; payload: unknown};
        if (value.type === terminalUpdateActions.replaceReportDescriptor.type)
          updateState = {...updateState, reportDescriptor: value.payload as TerminalUpdateState['reportDescriptor']};
      },
      flushPersistence: async () => ({status: 'succeeded'}),
      dispatchCommand: async (_definition: unknown, _payload: unknown, options?: unknown) => {
        sendCount += 1;
        if (sendCount <= 2) {
          lateOutcomes[sendCount - 1] = (options as {lateOutcome?: (record: unknown) => void} | undefined)?.lateOutcome;
          expect((options as {lateResultTtlMs?: number} | undefined)?.lateResultTtlMs).toBeGreaterThan(60_000);
          return {status: 'timed-out', actorResults: [{status: 'timed-out', result: null}]};
        }
        return {
          status: 'completed',
          actorResults: [
            {
              status: 'completed',
              result: {
                kind: 'success',
                body: {reportId: 'late-report', taskId: 'task-late', acceptedSequence: 3, outcome: 'ACCEPTED'},
              },
            },
          ],
        };
      },
    } as never;

    vi.useFakeTimers();
    try {
      await expect(handler.handle(context)).resolves.toEqual({status: 'retry-retained'});
      expect(sendCount).toBe(1);
      await expect(handler.handle(context)).resolves.toEqual({status: 'in-flight'});
      expect(sendCount).toBe(1);

      await vi.advanceTimersByTimeAsync(7_200_001);
      await expect(handler.handle(context)).resolves.toEqual({status: 'retry-retained'});
      expect(sendCount).toBe(2);

      lateOutcomes[0]?.({actorKey: 'terminal-data-client', status: 'completed', result: null} as never);
      await expect(handler.handle(context)).resolves.toEqual({status: 'in-flight'});
      expect(sendCount).toBe(2);

      lateOutcomes[1]?.({actorKey: 'terminal-data-client', status: 'completed', result: null} as never);
      await expect(handler.handle(context)).resolves.toEqual({status: 'accepted'});
      expect(sendCount).toBe(3);
      expect(updateState.reportDescriptor.pendingReports).toEqual({});
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops pending reports from a changed rule context before any network send', async () => {
    const terminalRef = '00000000-0000-4000-8000-000000000031';
    const storeRef = '00000000-0000-4000-8000-000000000032';
    const bindingGeneration = 6;
    const bindingIdentity = `${terminalRef}:${bindingGeneration}`;
    const sessionId = 'session-context-change';
    const staleReport = Object.freeze({
      idempotencyKey: 'stale-report',
      body: Object.freeze({
        reportId: 'stale-report',
        reportSequence: 4,
        taskId: 'old-task',
        actual: Object.freeze({
          apkVersion: null,
          nativeBuildNumber: null,
          applicationId: 'com.example.terminal',
          runtimeVersion: 'unknown',
          jsVersion: null,
          publicationId: null,
          apkSha256: null,
          bundleSha256: null,
          entryKind: 'UNKNOWN' as const,
          unknownReason: 'READBACK_UNAVAILABLE' as const,
        }),
        recent: Object.freeze({
          state: 'UNKNOWN' as const,
          reason: 'UNKNOWN' as const,
          changedAtEpochMillis: 4,
          ruleRef: 'old-rule',
          fullArtifactRef: 'old-full',
          hotArtifactRef: null,
        }),
      }),
    });
    let clientState = terminalDataClientReducer(undefined, {type: 'test/init'});
    clientState = terminalDataClientReducer(
      clientState,
      terminalDataClientActions.replaceCredential({
        groupWorkspaceKey: 'development',
        terminalRef,
        storeRef,
        deviceId: 'fixture-device',
        bindingGeneration,
        credentialSecret: 'S'.repeat(43),
      }),
    );
    clientState = terminalDataClientReducer(
      clientState,
      terminalDataClientActions.setConnection(
        Object.freeze({
          status: 'connected',
          addressName: 'dev',
          nodeId: 'tds-1',
          sessionId,
          lastCloseReason: null,
        }),
      ),
    );
    let updateState: TerminalUpdateState = {
      ruleSnapshot: {contextIdentity: null, selectedSpace: null, projectRef: null, collectionHash: null, items: []},
      ruleSnapshotStatus: {status: 'empty', errorCode: null},
      currentTask: null,
      recentStatus: {taskId: 'old-task', state: 'unknown', reason: null, changedAt: 4 as TimestampMs},
      failedArtifactIds: [],
      actualVersions: null,
      reportDescriptor: {
        bindingIdentity,
        contextIdentity: 'old-rule-context',
        nextReportSequence: 5,
        pendingReports: {'old-task': staleReport},
        sendPaused: true,
        latestDeliveryFailure: {
          taskId: 'old-task',
          reportId: 'previous-failure',
          reportSequence: 4,
          reasonCode: 'TEMPORARY',
          observedAt: 3 as TimestampMs,
        },
      },
    };
    const sent: unknown[] = [];
    const actor = createTestTerminalUpdateActor({
      port: {} as UpdatePort,
      readRuleSnapshotContext: () =>
        Object.freeze({
          terminalRef,
          bindingGeneration,
          selectedSpace: 'development',
          storeRef,
          projectRef: '00000000-0000-4000-8000-000000000033',
          projectUpdatedAtEpochMillis: 19,
        }),
    });
    const handler = actor.handlers.find(item => item.commandName === terminalDataHeartbeatCommand.commandName);
    if (handler === undefined) throw new Error('heartbeat report handler missing');
    const context = {
      runtimeId: 'report-context-change-test-runtime',
      command: {
        commandName: terminalDataHeartbeatCommand.commandName,
        commandId: 'heartbeat',
        requestId: null,
        payload: {bindingGeneration, sessionId, sequence: 1, observedAt: 5, rttMs: 1},
      },
      actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
      platformPorts: {logger: {info: () => undefined, warn: () => undefined, error: () => undefined}},
      getState: () => ({[terminalDataClientSliceName]: clientState, [terminalUpdateSliceName]: updateState}),
      dispatchAction: (action: unknown) => {
        const value = action as {type: string; payload: unknown};
        if (value.type === terminalUpdateActions.replaceReportDescriptor.type)
          updateState = {...updateState, reportDescriptor: value.payload as TerminalUpdateState['reportDescriptor']};
      },
      flushPersistence: async () => ({status: 'succeeded'}),
      dispatchCommand: async (_definition: unknown, payload: unknown) => {
        sent.push(payload);
        return {status: 'rejected'};
      },
    } as never;

    await expect(handler.handle(context)).resolves.toEqual({status: 'context-reset'});
    expect(sent).toEqual([]);
    expect(updateState.reportDescriptor).toMatchObject({
      bindingIdentity,
      contextIdentity: `${terminalRef}:${bindingGeneration}:development:${storeRef}:00000000-0000-4000-8000-000000000033:19`,
      nextReportSequence: 1,
      pendingReports: {},
      sendPaused: false,
      latestDeliveryFailure: null,
    });
  });

  it.each([
    {status: 409, errorCode: 'TERMINAL_UPDATE_REPORT_IDENTITY_CONFLICT', nextKey: 'task-2', nextTaskId: 'task-2'},
    {status: 422, errorCode: 'PLATFORM_COMMON_VALIDATION_FAILED', nextKey: 'observation', nextTaskId: null},
  ] as const)(
    'removes a terminal $status report rejection and continues with the next pending record',
    async scenario => {
      const terminalRef = '00000000-0000-4000-8000-000000000021';
      const storeRef = '00000000-0000-4000-8000-000000000022';
      const bindingGeneration = 5;
      const bindingIdentity = `${terminalRef}:${bindingGeneration}`;
      const makeReport = (reportId: string, reportSequence: number, taskId: string | null) =>
        Object.freeze({
          idempotencyKey: reportId,
          body: Object.freeze({
            reportId,
            reportSequence,
            taskId,
            actual: Object.freeze({
              apkVersion: null,
              nativeBuildNumber: null,
              applicationId: 'com.example.terminal',
              runtimeVersion: 'unknown',
              jsVersion: null,
              publicationId: null,
              apkSha256: null,
              bundleSha256: null,
              entryKind: 'UNKNOWN' as const,
              unknownReason: 'READBACK_UNAVAILABLE' as const,
            }),
            recent: Object.freeze({
              state: 'SUCCEEDED' as const,
              reason: 'NONE' as const,
              changedAtEpochMillis: reportSequence,
              ruleRef: 'rule-1',
              fullArtifactRef: 'full-artifact',
              hotArtifactRef: null,
            }),
          }),
        });
      const first = makeReport('report-1', 1, 'task-1');
      const second = makeReport('report-2', 2, scenario.nextTaskId);
      let clientState = terminalDataClientReducer(undefined, {type: 'test/init'});
      clientState = terminalDataClientReducer(
        clientState,
        terminalDataClientActions.replaceCredential({
          groupWorkspaceKey: 'development',
          terminalRef,
          storeRef,
          deviceId: 'fixture-device',
          bindingGeneration,
          credentialSecret: 'S'.repeat(43),
        }),
      );
      const sessionId = 'session-report-conflict';
      clientState = terminalDataClientReducer(
        clientState,
        terminalDataClientActions.setConnection(
          Object.freeze({
            status: 'connected',
            addressName: 'dev',
            nodeId: 'tds-1',
            sessionId,
            lastCloseReason: null,
          }),
        ),
      );
      let updateState: TerminalUpdateState = {
        ruleSnapshot: {contextIdentity: null, selectedSpace: null, projectRef: null, collectionHash: null, items: []},
        ruleSnapshotStatus: {status: 'empty', errorCode: null},
        currentTask: null,
        recentStatus: {taskId: null, state: 'idle', reason: null, changedAt: 0 as TimestampMs},
        failedArtifactIds: [],
        actualVersions: null,
        reportDescriptor: {
          bindingIdentity,
          contextIdentity: null,
          nextReportSequence: 3,
          pendingReports: {'task-1': first, [scenario.nextKey]: second},
          sendPaused: false,
          latestDeliveryFailure: null,
        },
      };
      const sent: string[] = [];
      const actor = createTestTerminalUpdateModule({port: {} as UpdatePort}).actorDefinitions?.[0];
      const handler = actor?.handlers.find(item => item.commandName === terminalDataHeartbeatCommand.commandName);
      if (handler === undefined) throw new Error('heartbeat report handler missing');
      const contextValue = {
        runtimeId: 'report-conflict-test-runtime',
        command: {
          commandName: terminalDataHeartbeatCommand.commandName,
          commandId: 'heartbeat',
          requestId: null,
          payload: {bindingGeneration, sessionId, sequence: 1, observedAt: 2, rttMs: 1},
        },
        actor: {actorKey: 'update-owner', moduleName: 'kernel.base.terminal-update', actorName: 'update-owner'},
        platformPorts: {logger: {info: () => undefined, warn: () => undefined, error: () => undefined}},
        getState: () => ({[terminalDataClientSliceName]: clientState, [terminalUpdateSliceName]: updateState}),
        dispatchAction: (action: unknown) => {
          const value = action as {type: string; payload: unknown};
          if (value.type === terminalUpdateActions.replaceReportDescriptor.type)
            updateState = {...updateState, reportDescriptor: value.payload as TerminalUpdateState['reportDescriptor']};
        },
        flushPersistence: async () => ({status: 'succeeded'}),
        dispatchCommand: async (_definition: unknown, payload: unknown) => {
          const report = payload as typeof first;
          sent.push(report.body.reportId);
          if (report.body.reportId === first.body.reportId)
            return {
              status: 'completed',
              actorResults: [
                {
                  status: 'completed',
                  result: {
                    kind: 'business-rejection',
                    status: scenario.status,
                    errorCode: scenario.errorCode,
                  },
                },
              ],
            };
          return {
            status: 'completed',
            actorResults: [
              {
                status: 'completed',
                result: {
                  kind: 'success',
                  body: {
                    reportId: second.body.reportId,
                    taskId: second.body.taskId,
                    acceptedSequence: second.body.reportSequence,
                    outcome: 'ACCEPTED',
                  },
                },
              },
            ],
          };
        },
      };
      const context = contextValue as never;

      const staleContext = {
        ...contextValue,
        command: {
          ...contextValue.command,
          payload: {bindingGeneration, sessionId: 'old-session', sequence: 1, observedAt: 2, rttMs: 1},
        },
      } as never;
      await expect(handler.handle(staleContext)).resolves.toEqual({status: 'stale-connection'});
      expect(sent).toEqual([]);

      await expect(handler.handle(context)).resolves.toEqual({status: 'terminal-rejection'});
      expect(updateState.reportDescriptor).toMatchObject({
        sendPaused: false,
        pendingReports: {[scenario.nextKey]: second},
        latestDeliveryFailure: {
          taskId: first.body.taskId,
          reportId: first.body.reportId,
          reportSequence: first.body.reportSequence,
          reasonCode: scenario.errorCode,
          observedAt: expect.any(Number),
        },
      });
      await expect(handler.handle(context)).resolves.toEqual({status: 'accepted'});
      expect(sent).toEqual(['report-1', 'report-2']);
      expect(updateState.reportDescriptor.pendingReports).toEqual({});
    },
  );
});

describe('terminal-update local owner', () => {
  const runtimes: Runtime[] = [];
  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map(runtime => releaseRuntimeForTestAsync(runtime)));
  });

  it('releases a terminal task only after a new boot so the next rule can be selected', async () => {
    const persistenceKey = 'terminal-update-next-boot-target-test';
    const persistence = createStorage();
    const nextTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      ruleRef: 'next-boot-rule',
      createdAt: 2 as TimestampMs,
    });
    let offeredTarget = target;
    const firstRuntime = createFixture({
      persistKv: persistence,
      persistenceKey,
      readTarget: async () => offeredTarget,
    });
    runtimes.push(firstRuntime);
    await firstRuntime.start();
    await firstRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );
    const firstTaskId = selectTerminalUpdateTask(firstRuntime.getState())?.taskId;
    expect(firstTaskId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const persistedTaskKey = createPersistenceFieldKey({
      persistenceKey,
      sliceName: terminalUpdateRegistration.name,
      storageKey: 'currentTask',
    });
    expect(JSON.parse(persistence.values.get(persistedTaskKey) ?? 'null')?.taskId).toBe(firstTaskId);
    expect(selectTerminalUpdateTask(firstRuntime.getState())).toMatchObject({
      phase: 'succeeded',
      bootId: facts.actual!.bootId,
    });
    offeredTarget = nextTarget;
    const sameBoot = await firstRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: nextTarget.selectionContext,
      },
      {requestId: createRequestId()},
    );
    expect(sameBoot.actorResults[0]?.result).toMatchObject({status: 'already-fixed'});
    expect(selectTerminalUpdateTask(firstRuntime.getState())?.target).toEqual(target);
    await releaseRuntimeForTestAsync(firstRuntime);
    runtimes.splice(runtimes.indexOf(firstRuntime), 1);

    const nextBootFacts: UpdateFacts = Object.freeze({
      ...facts,
      actual: Object.freeze({...facts.actual!, bootId: 'next-boot'}),
    });
    const secondRuntime = createFixture({
      persistKv: persistence,
      persistenceKey,
      readTarget: async () => nextTarget,
      port: {
        readFacts: async () => ok(nextBootFacts),
        prepareArtifact: async () => ok({preparedId: 'prepared', artifact}),
        applyPrepared: async () => ok(noAction),
        readAction: async () => ok(noAction),
        confirmBoot: async () => ok({confirmed: true}),
        releasePrepared: async () => ok({released: true}),
      },
    });
    runtimes.push(secondRuntime);
    await secondRuntime.start();

    expect(selectTerminalUpdateTask(secondRuntime.getState())).toBeNull();
    expect(selectTerminalUpdateRecentStatus(secondRuntime.getState())).toMatchObject({
      taskId: firstTaskId,
      state: 'succeeded',
    });
    const next = await secondRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: nextTarget.selectionContext,
      },
      {requestId: createRequestId()},
    );

    expect(next.actorResults[0]?.result).toMatchObject({status: 'succeeded'});
    const nextTask = selectTerminalUpdateTask(secondRuntime.getState());
    expect(nextTask).toMatchObject({target: nextTarget, phase: 'succeeded'});
    expect(nextTask?.taskId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(nextTask?.taskId).not.toBe(firstTaskId);
  });

  it('uses the observed boot for FULL-only success and releases it on the next boot', async () => {
    const persistenceKey = 'terminal-update-full-only-success-next-boot-test';
    const persistence = createStorage();
    const fullArtifact = Object.freeze({...artifact, nativeBuildNumber: 2, publicationId: '8'.repeat(64)});
    const fullOnlyTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({
        sourceRef: 'artifact:full-only',
        expectedSha256: fullArtifact.publicationId,
        artifact: fullArtifact,
      }),
      hot: null,
    });
    const nextTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      ruleRef: 'after-full-only-rule',
      createdAt: 2 as TimestampMs,
      full: null,
      hot: Object.freeze({
        sourceRef: 'artifact:after-full-only-hot',
        expectedSha256: newerHotArtifact.publicationId,
        artifact: newerHotArtifact,
      }),
    });
    let offeredTarget = fullOnlyTarget;
    let currentFacts = facts;
    let currentAction: UpdateAction = noAction;
    let preparedPublicationId = fullArtifact.publicationId;
    const port: UpdatePort = {
      readFacts: async () => ok(currentFacts),
      prepareArtifact: async input => {
        preparedPublicationId = input.artifact.publicationId;
        return ok({preparedId: 'full-only-prepared', artifact: input.artifact});
      },
      applyPrepared: async input => {
        currentAction = Object.freeze({
          ...noAction,
          taskId: input.taskId,
          actionId: input.actionId,
          state: 'accepted',
          publicationId: preparedPublicationId,
          bootId: null,
        });
        return ok(currentAction);
      },
      readAction: async () => ok(currentAction),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const firstRuntime = createFixture({
      persistKv: persistence,
      persistenceKey,
      readTarget: async () => offeredTarget,
      port,
    });
    runtimes.push(firstRuntime);
    await firstRuntime.start();

    const acceptedFull = await firstRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: fullOnlyTarget.selectionContext},
      {requestId: createRequestId()},
    );
    expect(acceptedFull.actorResults[0]?.result).toMatchObject({status: 'applying'});
    currentFacts = Object.freeze({
      ...facts,
      actual: Object.freeze({
        ...facts.actual!,
        nativeBuildNumber: fullArtifact.nativeBuildNumber,
        bundleVersion: fullArtifact.bundleVersion,
        publicationId: fullArtifact.publicationId,
        bootId: 'full-only-success-boot',
      }),
      embedded: fullArtifact,
      selectedPublicationId: fullArtifact.publicationId,
    });
    currentAction = Object.freeze({...currentAction, state: 'succeeded', bootId: null});
    const completed = await firstRuntime.dispatchCommand(
      reconcileTerminalUpdateCommand,
      {resumeFixedTask: false},
      {requestId: createRequestId()},
    );
    expect(completed.actorResults[0]?.result).toMatchObject({status: 'succeeded'});
    expect(selectTerminalUpdateTask(firstRuntime.getState())).toMatchObject({
      phase: 'succeeded',
      bootId: 'full-only-success-boot',
    });

    offeredTarget = nextTarget;
    const sameBoot = await firstRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: nextTarget.selectionContext},
      {requestId: createRequestId()},
    );
    expect(sameBoot.actorResults[0]?.result).toMatchObject({status: 'already-fixed'});
    expect(selectTerminalUpdateTask(firstRuntime.getState())?.target).toEqual(fullOnlyTarget);
    await releaseRuntimeForTestAsync(firstRuntime);
    runtimes.splice(runtimes.indexOf(firstRuntime), 1);

    currentFacts = Object.freeze({
      ...currentFacts,
      actual: Object.freeze({...currentFacts.actual!, bootId: 'after-full-only-next-boot'}),
    });
    const secondRuntime = createFixture({
      persistKv: persistence,
      persistenceKey,
      readTarget: async () => nextTarget,
      port,
    });
    runtimes.push(secondRuntime);
    await secondRuntime.start();
    expect(selectTerminalUpdateTask(secondRuntime.getState())).toBeNull();
    const acceptedNext = await secondRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: nextTarget.selectionContext},
      {requestId: createRequestId()},
    );
    expect(acceptedNext.actorResults[0]?.result).toMatchObject({status: 'applying'});
    expect(selectTerminalUpdateTask(secondRuntime.getState())).toMatchObject({target: nextTarget});
  });

  it('releases a failed task only after a new boot and retains the failed artifact identity', async () => {
    const persistenceKey = 'terminal-update-failed-next-boot-target-test';
    const persistence = createStorage();
    const failedArtifact = Object.freeze({...artifact, bundleVersion: '1.0.1', publicationId: 'd'.repeat(64)});
    const failedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: null,
      hot: Object.freeze({
        sourceRef: 'artifact:failed-hot',
        expectedSha256: failedArtifact.publicationId,
        artifact: failedArtifact,
      }),
    });
    const nextTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      ruleRef: 'next-repair-rule',
      createdAt: 3 as TimestampMs,
      full: null,
      hot: Object.freeze({
        sourceRef: 'artifact:repair-hot',
        expectedSha256: newerHotArtifact.publicationId,
        artifact: newerHotArtifact,
      }),
      selectionContext: Object.freeze({
        selectedSpace: 'development',
        contextIdentity: 'next-repair-context',
        ruleRef: 'next-repair-rule',
      }),
    });
    const firstRuntime = createFixture({
      persistKv: persistence,
      persistenceKey,
      readTarget: async () => failedTarget,
      port: {
        readFacts: async () => ok(facts),
        prepareArtifact: async () => ok({preparedId: 'failed-hot-prepared', artifact: failedArtifact}),
        applyPrepared: async input =>
          ok(
            Object.freeze({
              actionId: input.actionId,
              taskId: input.taskId,
              state: 'failed' as const,
              reason: 'HOT_BOOT_UNCONFIRMED',
              publicationId: failedArtifact.publicationId,
              bootId: facts.actual!.bootId,
            }),
          ),
        readAction: async () => ok(noAction),
        confirmBoot: async () => ok({confirmed: true}),
        releasePrepared: async () => ok({released: true}),
      },
    });
    runtimes.push(firstRuntime);
    await firstRuntime.start();

    const failed = await firstRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: failedTarget.selectionContext,
      },
      {requestId: createRequestId()},
    );
    expect(failed.actorResults[0]?.result).toMatchObject({status: 'failed', reason: 'HOT_BOOT_UNCONFIRMED'});
    expect(selectTerminalUpdateTask(firstRuntime.getState())).toMatchObject({
      phase: 'failed',
      bootId: facts.actual!.bootId,
    });
    expect(firstRuntime.getState()['kernel.base.terminal-update.state']).toMatchObject({
      failedArtifactIds: [failedArtifact.publicationId],
      recentStatus: {state: 'failed', reason: 'HOT_BOOT_UNCONFIRMED'},
    });

    const sameBoot = await firstRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: nextTarget.selectionContext,
      },
      {requestId: createRequestId()},
    );
    expect(sameBoot.actorResults[0]?.result).toMatchObject({status: 'rejected', reason: 'IDENTITY_CONFLICT'});
    expect(selectTerminalUpdateTask(firstRuntime.getState())?.target).toEqual(failedTarget);
    await releaseRuntimeForTestAsync(firstRuntime);
    runtimes.splice(runtimes.indexOf(firstRuntime), 1);

    const nextBootFacts: UpdateFacts = Object.freeze({
      ...facts,
      actual: Object.freeze({...facts.actual!, bootId: 'failed-task-next-boot'}),
    });
    const prepareArtifact = vi.fn(async () => ok({preparedId: 'repair-hot-prepared', artifact: newerHotArtifact}));
    const secondRuntime = createFixture({
      persistKv: persistence,
      persistenceKey,
      readTarget: async () => nextTarget,
      port: {
        readFacts: async () => ok(nextBootFacts),
        prepareArtifact,
        applyPrepared: async input =>
          ok(
            Object.freeze({
              actionId: input.actionId,
              taskId: input.taskId,
              state: 'accepted' as const,
              reason: null,
              publicationId: newerHotArtifact.publicationId,
              bootId: nextBootFacts.actual!.bootId,
            }),
          ),
        readAction: async () => ok(noAction),
        confirmBoot: async () => ok({confirmed: true}),
        releasePrepared: async () => ok({released: true}),
      },
    });
    runtimes.push(secondRuntime);
    await secondRuntime.start();

    expect(selectTerminalUpdateTask(secondRuntime.getState())).toBeNull();
    expect(secondRuntime.getState()['kernel.base.terminal-update.state']).toMatchObject({
      failedArtifactIds: [failedArtifact.publicationId],
      recentStatus: {state: 'failed', reason: 'HOT_BOOT_UNCONFIRMED'},
    });
    const next = await secondRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: nextTarget.selectionContext,
      },
      {requestId: createRequestId()},
    );
    expect(next.actorResults[0]?.result).toMatchObject({status: 'applying'});
    expect(prepareArtifact).toHaveBeenCalledWith(expect.objectContaining({artifact: newerHotArtifact}));
    expect(selectTerminalUpdateTask(secondRuntime.getState())).toMatchObject({
      target: nextTarget,
      phase: 'applying-hot',
    });
    expect(secondRuntime.getState()['kernel.base.terminal-update.state']).toMatchObject({
      failedArtifactIds: [failedArtifact.publicationId],
    });
  });

  it('fixes one immutable target before exposing a successful command result', async () => {
    const runtime = createFixture();
    runtimes.push(runtime);
    await runtime.start();
    const result = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );
    expect(result.status).toBe('completed');
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({target, phase: 'succeeded'});
    expect(selectTerminalUpdateRecentStatus(runtime.getState()).state).toBe('succeeded');
  });

  it('rejects a rule for another application before fixing or preparing its target', async () => {
    const wallpaperArtifact = Object.freeze({
      ...artifact,
      applicationId: 'com.example.wallpaper',
      publicationId: 'd'.repeat(64),
    });
    const wallpaperTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      applicationId: wallpaperArtifact.applicationId,
      full: Object.freeze({
        sourceRef: 'artifact:wallpaper-full',
        expectedSha256: wallpaperArtifact.publicationId,
        artifact: wallpaperArtifact,
      }),
      hot: null,
    });
    const prepareArtifact = vi.fn(async () => ok({preparedId: 'prepared', artifact: wallpaperArtifact}));
    const port: UpdatePort = {
      readFacts: async () => ok(facts),
      prepareArtifact,
      applyPrepared: async () => ok(noAction),
      readAction: async () => ok(noAction),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({readTarget: async () => wallpaperTarget, port});
    runtimes.push(runtime);
    await runtime.start();

    const result = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: wallpaperTarget.selectionContext},
      {requestId: createRequestId()},
    );

    expect(result.status).toBe('completed');
    expect(result.actorResults.find(actor => actor.status === 'completed')?.result).toMatchObject({
      status: 'rejected',
      reason: 'APPLICATION_ID_MISMATCH',
    });
    expect(selectTerminalUpdateTask(runtime.getState())).toBeNull();
    expect(prepareArtifact).not.toHaveBeenCalled();
  });

  it('does not expose a target when persistence fails after identity preflight, and allows retry', async () => {
    const persistence = createStorage({failWrite: key => key.endsWith('/field/recentStatus'), failWriteCount: 3});
    let readFactsCount = 0;
    const port: UpdatePort = {
      readFacts: async () => {
        readFactsCount += 1;
        return ok(facts);
      },
      prepareArtifact: async () => ok({preparedId: 'prepared', artifact}),
      applyPrepared: async () => ok(noAction),
      readAction: async () => ok(noAction),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({persistKv: persistence, port});
    runtimes.push(runtime);
    await runtime.start();
    const startupReadFactsCount = readFactsCount;

    const failed = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );

    expect(failed.status).toBe('completed');
    expect(persistence.failedWriteKeys).toHaveLength(3);
    expect(persistence.failedWriteKeys[0]).toMatch(/\/field\/recentStatus$/);
    expect(failed.actorResults[0]?.result).toMatchObject({status: 'persistence-failed'});
    expect(selectTerminalUpdateTask(runtime.getState())).toBeNull();
    expect(selectTerminalUpdateRecentStatus(runtime.getState()).state).toBe('idle');
    expect(readFactsCount).toBe(startupReadFactsCount + 1);
    const taskKey = [...persistence.values.keys()].find(key => key.endsWith('/field/currentTask'));
    const statusKey = [...persistence.values.keys()].find(key => key.endsWith('/field/recentStatus'));
    expect(taskKey).toBeDefined();
    expect(statusKey).toBeDefined();
    expect(persistence.values.get(taskKey!)).toBe('null');
    expect(JSON.parse(persistence.values.get(statusKey!)!).state).toBe('idle');

    const retried = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );
    expect(retried.status).toBe('completed');
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({target, phase: 'succeeded'});
    expect(selectTerminalUpdateRecentStatus(runtime.getState()).state).toBe('succeeded');
    expect(readFactsCount).toBe(startupReadFactsCount + 3);
  });

  it('defers a persisted fixed task until the Runtime is ready to resume its artifact work', async () => {
    const persistenceKey = 'terminal-update-fixed-resume-test';
    const persistence = createStorage();
    const persistedTask = Object.freeze({
      taskId: 'retained-fixed-task',
      target: fixedResumeTarget,
      phase: 'fixed' as const,
      actionId: null,
      actionKind: null,
      preparedId: null,
      bootId: null,
      failureCode: null,
    });
    persistence.values.set(
      createPersistenceFieldKey({
        persistenceKey,
        sliceName: terminalUpdateRegistration.name,
        storageKey: 'currentTask',
      }),
      JSON.stringify(persistedTask),
    );
    const prepareArtifact = vi.fn(async () => ok({preparedId: 'prepared', artifact}));
    const port: UpdatePort = {
      readFacts: async () => ok(facts),
      prepareArtifact,
      applyPrepared: async () => ok(noAction),
      readAction: async () => ok(noAction),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({port, persistKv: persistence, persistenceKey});
    runtimes.push(runtime);

    await runtime.start();

    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({taskId: persistedTask.taskId, phase: 'fixed'});
    expect(prepareArtifact).not.toHaveBeenCalled();

    const resumed = await runtime.dispatchCommand(
      reconcileTerminalUpdateCommand,
      {resumeFixedTask: true},
      {requestId: createRequestId()},
    );

    expect(resumed.status).toBe('completed');
    expect(prepareArtifact).toHaveBeenCalledOnce();
  });

  it('acknowledges primary readiness while resumed update work waits for its artifact', async () => {
    const persistenceKey = 'terminal-update-primary-ready-nonblocking-test';
    const persistence = createStorage();
    const persistedTask = Object.freeze({
      taskId: 'retained-fixed-task',
      target: fixedResumeTarget,
      originalBundleVersion: artifact.bundleVersion,
      phase: 'fixed' as const,
      actionId: null,
      actionKind: null,
      preparedId: null,
      bootId: null,
      failureCode: null,
    });
    persistence.values.set(
      createPersistenceFieldKey({
        persistenceKey,
        sliceName: terminalUpdateRegistration.name,
        storageKey: 'currentTask',
      }),
      JSON.stringify(persistedTask),
    );

    let resolvePrepareStarted!: () => void;
    const prepareStarted = new Promise<void>(resolve => {
      resolvePrepareStarted = resolve;
    });
    type PreparedResult = Awaited<ReturnType<UpdatePort['prepareArtifact']>>;
    let resolvePrepared!: (result: PreparedResult) => void;
    let prepareSettled = false;
    const prepared = new Promise<PreparedResult>(resolve => {
      resolvePrepared = resolve;
    });
    const prepareArtifact = vi.fn(() => {
      resolvePrepareStarted();
      return prepared.then(result => {
        prepareSettled = true;
        return result;
      });
    });
    const port: UpdatePort = {
      readFacts: async () => ok(facts),
      prepareArtifact,
      applyPrepared: async () => ok(noAction),
      readAction: async () => ok(noAction),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({port, persistKv: persistence, persistenceKey});
    runtimes.push(runtime);

    await runtime.start();
    const readiness = runtime.dispatchCommand(
      primarySurfaceReadyCommand,
      {contentReady: true},
      {requestId: createRequestId()},
    );

    try {
      await vi.waitFor(async () => expect((await readiness).status).toBe('completed'), {timeout: 500});
      await prepareStarted;
      expect(prepareArtifact).toHaveBeenCalledOnce();
      expect(prepareSettled).toBe(false);
    } finally {
      resolvePrepared(ok({preparedId: 'resumed-hot-prepared', artifact: newerHotArtifact}));
    }
    await readiness;
    await vi.waitFor(() => expect(prepareSettled).toBe(true));
  });

  it('confirms an ordinary HOT cold boot on PRIMARY ready even without an update task', async () => {
    const actual = Object.freeze({
      ...facts.actual!,
      publicationId: newerHotArtifact.publicationId,
      bundleVersion: newerHotArtifact.bundleVersion,
      bootId: 'ordinary-hot-cold-boot',
      entryKind: 'hot' as const,
    });
    const confirmBoot = vi.fn<UpdatePort['confirmBoot']>().mockResolvedValue(ok({confirmed: true as const}));
    const port: UpdatePort = {
      readFacts: async () => ok(Object.freeze({...facts, actual})),
      prepareArtifact: async () => ok({preparedId: 'unused', artifact}),
      applyPrepared: async () => ok(noAction),
      readAction: async () => ok(null),
      confirmBoot,
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({port});
    runtimes.push(runtime);
    await runtime.start();

    const readiness = await runtime.dispatchCommand(
      primarySurfaceReadyCommand,
      {contentReady: true},
      {requestId: createRequestId()},
    );
    await vi.waitFor(() => expect(confirmBoot).toHaveBeenCalledOnce());

    expect(readiness.status).toBe('completed');
    expect(confirmBoot).toHaveBeenCalledWith({
      timeoutMs: 10_000,
      bootToken: actual.bootId,
      publicationId: actual.publicationId,
    });
    expect(selectTerminalUpdateTask(runtime.getState())).toBeNull();
  });

  it('records a completed FULL action without starting HOT during Runtime installation', async () => {
    const persistenceKey = 'terminal-update-full-readback-resume-test';
    const persistence = createStorage();
    const persistedTask = Object.freeze({
      taskId: 'retained-full-task',
      target: fixedResumeTarget,
      phase: 'applying-full' as const,
      actionId: 'persisted-full-action',
      actionKind: 'full' as const,
      preparedId: 'persisted-full-artifact',
      bootId: null,
      failureCode: null,
      originalBundleVersion: '1.0.0',
    });
    persistence.values.set(
      createPersistenceFieldKey({
        persistenceKey,
        sliceName: terminalUpdateRegistration.name,
        storageKey: 'currentTask',
      }),
      JSON.stringify(persistedTask),
    );
    const prepareArtifact = vi.fn(async () => ok({preparedId: 'prepared', artifact}));
    const releasePrepared = vi
      .fn<UpdatePort['releasePrepared']>()
      .mockResolvedValueOnce({
        status: 'failed',
        port: 'update',
        capability: 'releasePrepared',
        error: {code: 'FILESYSTEM_CLEANUP_FAILED', message: 'cleanup failed', retryable: true},
      })
      .mockResolvedValue(ok({released: true}));
    const port: UpdatePort = {
      readFacts: async () => ok(facts),
      prepareArtifact,
      applyPrepared: async () => ok(noAction),
      readAction: async () =>
        ok(
          Object.freeze({
            ...noAction,
            taskId: persistedTask.taskId,
            actionId: persistedTask.actionId,
            state: 'succeeded' as const,
            publicationId: artifact.publicationId,
            bootId: 'full-boot',
          }),
        ),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared,
    };
    const runtime = createFixture({port, persistKv: persistence, persistenceKey});
    runtimes.push(runtime);

    await runtime.start();

    expect(releasePrepared).toHaveBeenCalledOnce();
    expect(releasePrepared).toHaveBeenCalledWith({timeoutMs: 10_000, preparedId: 'persisted-full-artifact'});
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({
      taskId: persistedTask.taskId,
      phase: 'applying-full',
      actionId: persistedTask.actionId,
      preparedId: 'persisted-full-artifact',
    });

    await runtime.dispatchCommand(
      reconcileTerminalUpdateCommand,
      {resumeFixedTask: false},
      {requestId: createRequestId()},
    );

    expect(releasePrepared).toHaveBeenCalledTimes(2);
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({
      taskId: persistedTask.taskId,
      phase: 'fixed',
      actionId: null,
      preparedId: null,
    });
    expect(prepareArtifact).not.toHaveBeenCalled();
  });

  it('confirms the current primary boot without replacing a pending FULL action', async () => {
    const persistenceKey = 'terminal-update-full-boot-confirmation-guard-test';
    const persistence = createStorage();
    const persistedTask = Object.freeze({
      taskId: 'retained-full-task',
      target: fixedResumeTarget,
      phase: 'applying-full' as const,
      actionId: 'persisted-full-action',
      actionKind: 'full' as const,
      preparedId: 'persisted-full-artifact',
      bootId: null,
      failureCode: null,
      originalBundleVersion: '1.0.0',
    });
    persistence.values.set(
      createPersistenceFieldKey({
        persistenceKey,
        sliceName: terminalUpdateRegistration.name,
        storageKey: 'currentTask',
      }),
      JSON.stringify(persistedTask),
    );
    const confirmBoot = vi.fn<UpdatePort['confirmBoot']>().mockResolvedValue(ok({confirmed: true as const}));
    const port: UpdatePort = {
      readFacts: async () => ok(facts),
      prepareArtifact: async () => ok({preparedId: 'prepared', artifact}),
      applyPrepared: async () => ok(noAction),
      readAction: async input =>
        ok({
          ...noAction,
          taskId: input.taskId,
          actionId: input.actionId,
          state: 'accepted',
        }),
      confirmBoot,
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({port, persistKv: persistence, persistenceKey});
    runtimes.push(runtime);

    await runtime.start();
    const result = await runtime.dispatchCommand(
      confirmTerminalUpdateBootCommand,
      {bootToken: facts.actual!.bootId, publicationId: facts.actual!.publicationId},
      {requestId: createRequestId()},
    );

    expect(result.status).toBe('completed');
    expect(result.actorResults[0]?.result).toMatchObject({status: 'applying'});
    expect(confirmBoot).toHaveBeenCalledWith({
      timeoutMs: 60_000,
      bootToken: facts.actual!.bootId,
      publicationId: facts.actual!.publicationId,
    });
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({
      taskId: persistedTask.taskId,
      phase: 'applying-full',
      actionId: persistedTask.actionId,
    });
  });

  it('does not continue HOT after FULL when a restored task has no original JS version', async () => {
    const persistenceKey = 'terminal-update-missing-original-version-test';
    const persistence = createStorage();
    const persistedTask = Object.freeze({
      taskId: 'retained-full-task-without-baseline',
      target: fixedResumeTarget,
      phase: 'applying-full' as const,
      actionId: 'persisted-full-action',
      actionKind: 'full' as const,
      preparedId: 'persisted-full-artifact',
      bootId: null,
      failureCode: null,
    });
    persistence.values.set(
      createPersistenceFieldKey({
        persistenceKey,
        sliceName: terminalUpdateRegistration.name,
        storageKey: 'currentTask',
      }),
      JSON.stringify(persistedTask),
    );
    const prepareArtifact = vi.fn(async () => ok({preparedId: 'unexpected-hot', artifact: newerHotArtifact}));
    const port: UpdatePort = {
      readFacts: async () =>
        ok(Object.freeze({...facts, actual: Object.freeze({...facts.actual!, bundleVersion: '1.0.0'})})),
      prepareArtifact,
      applyPrepared: async () => ok(noAction),
      readAction: async () =>
        ok(
          Object.freeze({
            ...noAction,
            taskId: persistedTask.taskId,
            actionId: persistedTask.actionId,
            state: 'succeeded' as const,
            publicationId: artifact.publicationId,
          }),
        ),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({port, persistKv: persistence, persistenceKey});
    runtimes.push(runtime);

    await runtime.start();

    expect(prepareArtifact).not.toHaveBeenCalled();
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({
      taskId: persistedTask.taskId,
      phase: 'unknown',
      failureCode: 'ORIGINAL_BUNDLE_VERSION_UNAVAILABLE',
    });
    expect(selectTerminalUpdateRecentStatus(runtime.getState())).toMatchObject({
      state: 'unknown',
      reason: 'ORIGINAL_BUNDLE_VERSION_UNAVAILABLE',
    });
  });

  it('rejects when the source provider has no authorized target', async () => {
    const runtime = createFixture({targetAvailable: false});
    runtimes.push(runtime);
    await runtime.start();
    const result = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );
    expect(result.status).toBe('completed');
    expect(selectTerminalUpdateTask(runtime.getState())).toBeNull();
    expect(selectTerminalUpdateRecentStatus(runtime.getState()).state).toBe('idle');
  });

  it('re-reads the current task after source lookup before claiming a target', async () => {
    const secondTarget: FixedUpdateTarget = Object.freeze({...target, ruleRef: 'later-rule'});
    const pending: Array<(value: FixedUpdateTarget) => void> = [];
    let resolveBothStarted!: () => void;
    const bothStarted = new Promise<void>(resolve => {
      resolveBothStarted = resolve;
    });
    const runtime = createFixture({
      readTarget: () =>
        new Promise(resolve => {
          pending.push(resolve);
          if (pending.length === 2) resolveBothStarted();
        }),
    });
    runtimes.push(runtime);
    await runtime.start();

    const first = runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );
    const second = runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );

    await bothStarted;
    expect(pending).toHaveLength(2);
    pending[0]!(target);
    await first;
    pending[1]!(secondTarget);
    await second;

    expect(selectTerminalUpdateTask(runtime.getState())?.target).toEqual(target);
  });

  it('keeps an identical target idempotent when concurrent source lookups finish', async () => {
    const pending: Array<(value: FixedUpdateTarget) => void> = [];
    let resolveBothStarted!: () => void;
    const bothStarted = new Promise<void>(resolve => {
      resolveBothStarted = resolve;
    });
    const runtime = createFixture({
      readTarget: () =>
        new Promise(resolve => {
          pending.push(resolve);
          if (pending.length === 2) resolveBothStarted();
        }),
    });
    runtimes.push(runtime);
    await runtime.start();

    const first = runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );
    const second = runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );
    await bothStarted;

    pending[0]!(target);
    await first;
    pending[1]!(target);
    await second;

    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({target, phase: 'succeeded'});
    expect(selectTerminalUpdateRecentStatus(runtime.getState()).state).toBe('succeeded');
  });

  it('selects the fixed FULL artifact when the installed native build is below its minimum', async () => {
    const fullArtifact = Object.freeze({...artifact, nativeBuildNumber: 2, publicationId: 'c'.repeat(64)});
    const hotArtifact = Object.freeze({...fullArtifact, bundleVersion: '1.0.1', publicationId: 'd'.repeat(64)});
    const fixedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({
        sourceRef: 'artifact:full-2',
        expectedSha256: fullArtifact.publicationId,
        artifact: fullArtifact,
      }),
      hot: Object.freeze({
        sourceRef: 'artifact:hot-2',
        expectedSha256: hotArtifact.publicationId,
        artifact: hotArtifact,
      }),
    });
    let preparedKind: 'full' | 'hot' | null = null;
    let preparedSourceRef: string | null = null;
    let appliedKind: 'full' | 'hot' | null = null;
    const prepareArtifact: UpdatePort['prepareArtifact'] = async input => {
      preparedKind = input.kind;
      preparedSourceRef = input.sourceRef;
      return ok({preparedId: 'prepared-full-2', artifact: fullArtifact});
    };
    const applyPrepared: UpdatePort['applyPrepared'] = async input => {
      appliedKind = input.kind;
      return ok({
        ...noAction,
        taskId: input.taskId,
        actionId: input.actionId,
        state: 'waiting-user' as const,
        publicationId: fullArtifact.publicationId,
      });
    };
    const port: UpdatePort = {
      readFacts: async () =>
        ok(Object.freeze({...facts, actual: Object.freeze({...facts.actual!, nativeBuildNumber: 1})})),
      prepareArtifact,
      applyPrepared,
      readAction: async () => ok(null),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({readTarget: async () => fixedTarget, port});
    runtimes.push(runtime);
    await runtime.start();

    const result = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );

    expect(result.status).toBe('completed');
    expect(preparedKind).toBe('full');
    expect(preparedSourceRef).toBe('artifact:full-2');
    expect(appliedKind).toBe('full');
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({
      phase: 'waiting-user',
      actionId: expect.any(String),
    });
    expect(selectTerminalUpdateRecentStatus(runtime.getState()).state).toBe('waiting-user');
  });

  it('compares a FULL target with the installed APK publication, not the selected HOT publication', async () => {
    const fullArtifact = Object.freeze({...artifact, nativeBuildNumber: 2, publicationId: 'c'.repeat(64)});
    const hotArtifact = Object.freeze({...fullArtifact, bundleVersion: '1.0.1', publicationId: 'd'.repeat(64)});
    let selectedKind: 'full' | 'hot' | null = null;
    const port: UpdatePort = {
      readFacts: async () =>
        ok(
          Object.freeze({
            ...facts,
            actual: Object.freeze({
              ...facts.actual!,
              nativeBuildNumber: 2,
              bundleVersion: '1.0.0',
              publicationId: 'e'.repeat(64),
              entryKind: 'hot' as const,
            }),
            embedded: fullArtifact,
          }),
        ),
      prepareArtifact: async input => {
        selectedKind = input.kind;
        return ok({preparedId: 'prepared-hot', artifact: hotArtifact});
      },
      applyPrepared: async input =>
        ok({...noAction, taskId: input.taskId, actionId: input.actionId, publicationId: hotArtifact.publicationId}),
      readAction: async () => ok(null),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const fixedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({
        sourceRef: 'artifact:full-2',
        expectedSha256: fullArtifact.publicationId,
        artifact: fullArtifact,
      }),
      hot: Object.freeze({
        sourceRef: 'artifact:hot-2',
        expectedSha256: hotArtifact.publicationId,
        artifact: hotArtifact,
      }),
    });
    const runtime = createFixture({readTarget: async () => fixedTarget, port});
    runtimes.push(runtime);
    await runtime.start();

    await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: target.selectionContext},
      {requestId: createRequestId()},
    );

    expect(selectedKind).toBe('hot');
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({actionKind: 'hot'});
    expect(selectTerminalUpdateRecentStatus(runtime.getState()).state).toBe('applying');
  });

  it('continues the same fixed HOT target when a previously UNKNOWN FULL action later succeeds', async () => {
    const fullArtifact = Object.freeze({...artifact, nativeBuildNumber: 2, publicationId: '8'.repeat(64)});
    const hotArtifact = Object.freeze({...fullArtifact, bundleVersion: '1.0.1', publicationId: '9'.repeat(64)});
    const fixedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({
        sourceRef: 'artifact:full-late',
        expectedSha256: fullArtifact.publicationId,
        artifact: fullArtifact,
      }),
      hot: Object.freeze({
        sourceRef: 'artifact:hot-late',
        expectedSha256: hotArtifact.publicationId,
        artifact: hotArtifact,
      }),
    });
    const actionKinds: Array<'full' | 'hot'> = [];
    let action: UpdateAction | null = null;
    let factsRead = 0;
    const port: UpdatePort = {
      readFacts: async () => {
        factsRead += 1;
        return ok(
          // Startup read, pre-commit application identity read, then the
          // initial artifact-selection read all observe the installed baseline.
          factsRead <= 3
            ? Object.freeze({...facts, actual: Object.freeze({...facts.actual!, nativeBuildNumber: 1})})
            : Object.freeze({
                ...facts,
                actual: Object.freeze({
                  ...facts.actual!,
                  nativeBuildNumber: 2,
                  bundleVersion: fullArtifact.bundleVersion,
                  publicationId: fullArtifact.publicationId,
                  entryKind: 'embedded' as const,
                }),
                embedded: fullArtifact,
              }),
        );
      },
      prepareArtifact: async input => ok({preparedId: `prepared-${input.kind}`, artifact: input.artifact}),
      applyPrepared: async input => {
        actionKinds.push(input.kind);
        const result: UpdateAction = Object.freeze({
          ...noAction,
          taskId: input.taskId,
          actionId: input.actionId,
          state: input.kind === 'full' ? 'unknown' : 'accepted',
          reason: input.kind === 'full' ? 'INSTALLER_STATE_UNAVAILABLE' : null,
          publicationId: input.kind === 'full' ? fullArtifact.publicationId : hotArtifact.publicationId,
        });
        action = result;
        return ok(result);
      },
      readAction: async () => ok(action),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({readTarget: async () => fixedTarget, port});
    runtimes.push(runtime);
    await runtime.start();
    await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: target.selectionContext},
      {requestId: createRequestId()},
    );
    const pendingFull = selectTerminalUpdateTask(runtime.getState());
    expect(pendingFull).toMatchObject({phase: 'unknown', actionKind: 'full', actionId: expect.any(String)});
    action = Object.freeze({...action!, state: 'succeeded', reason: null, bootId: 'full-boot'});

    const resumed = await runtime.dispatchCommand(
      reconcileTerminalUpdateCommand,
      {resumeFixedTask: true},
      {requestId: createRequestId()},
    );

    expect(resumed.actorResults[0]?.result).toMatchObject({status: 'applying'});
    expect(actionKinds).toEqual(['full', 'hot']);
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({
      phase: 'applying-hot',
      actionKind: 'hot',
      actionId: expect.not.stringMatching(pendingFull!.actionId!),
    });
  });

  it('reconciles a pending FULL installer action before retrying after a confirmed user cancellation', async () => {
    const fullArtifact = Object.freeze({...artifact, nativeBuildNumber: 2, publicationId: 'e'.repeat(64)});
    const hotArtifact = Object.freeze({...fullArtifact, bundleVersion: '1.0.1', publicationId: 'f'.repeat(64)});
    const fixedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({
        sourceRef: 'artifact:full-fixed',
        expectedSha256: fullArtifact.publicationId,
        artifact: fullArtifact,
      }),
      hot: Object.freeze({
        sourceRef: 'artifact:hot-fixed',
        expectedSha256: hotArtifact.publicationId,
        artifact: hotArtifact,
      }),
    });
    const actions: UpdateAction[] = [];
    let observedAction: UpdateAction | null = null;
    let applyCount = 0;
    const preparedRefs: string[] = [];
    const releasePrepared = vi
      .fn<UpdatePort['releasePrepared']>()
      .mockResolvedValueOnce({
        status: 'failed',
        port: 'update',
        capability: 'releasePrepared',
        error: {code: 'FILESYSTEM_CLEANUP_FAILED', message: 'cleanup failed', retryable: true},
      })
      .mockResolvedValue(ok({released: true}));
    const port: UpdatePort = {
      readFacts: async () =>
        ok(Object.freeze({...facts, actual: Object.freeze({...facts.actual!, nativeBuildNumber: 1})})),
      prepareArtifact: async input => {
        preparedRefs.push(input.sourceRef);
        return ok({preparedId: `prepared-${preparedRefs.length}`, artifact: fullArtifact});
      },
      applyPrepared: async input => {
        applyCount += 1;
        const action = Object.freeze({
          ...noAction,
          taskId: input.taskId,
          actionId: input.actionId,
          state: applyCount === 1 ? ('unknown' as const) : ('waiting-user' as const),
          reason: applyCount === 1 ? 'INSTALLER_AWAITING_READBACK' : null,
          publicationId: fullArtifact.publicationId,
        });
        actions.push(action);
        observedAction = action;
        return ok(action);
      },
      readAction: async input =>
        ok(
          observedAction?.taskId === input.taskId && observedAction.actionId === input.actionId ? observedAction : null,
        ),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared,
    };
    const runtime = createFixture({readTarget: async () => fixedTarget, port});
    runtimes.push(runtime);
    await runtime.start();

    const accept = () =>
      runtime.dispatchCommand(
        acceptTerminalUpdateTargetCommand,
        {selectionContext: target.selectionContext},
        {requestId: createRequestId()},
      );
    const first = await accept();
    expect(first.actorResults[0]?.result).toMatchObject({status: 'unknown', reason: 'INSTALLER_AWAITING_READBACK'});
    const firstTask = selectTerminalUpdateTask(runtime.getState());
    expect(firstTask).toMatchObject({phase: 'applying-full', actionId: expect.any(String)});
    expect(actions).toHaveLength(1);

    const stillPendingAcceptance = await accept();
    expect(stillPendingAcceptance.actorResults[0]?.result).toMatchObject({status: 'already-fixed'});
    expect(selectTerminalUpdateTask(runtime.getState())?.actionId).toBe(firstTask?.actionId);
    expect(actions).toHaveLength(1);
    expect(releasePrepared).not.toHaveBeenCalled();

    observedAction = Object.freeze({...actions[0]!, state: 'user-cancelled' as const, reason: 'ENDED_NOT_INSTALLED'});
    const failedCleanupAcceptance = await accept();
    expect(failedCleanupAcceptance.actorResults[0]?.result).toMatchObject({
      status: 'cleanup-failed',
      reason: 'PREPARED_RELEASE_FAILED',
    });
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({
      taskId: firstTask?.taskId,
      actionId: firstTask?.actionId,
      preparedId: 'prepared-1',
    });
    expect(selectTerminalUpdateRecentStatus(runtime.getState())).toMatchObject({
      state: 'unknown',
      reason: 'PREPARED_RELEASE_FAILED',
    });

    const cancelledAcceptance = await accept();
    expect(cancelledAcceptance.actorResults[0]?.result).toMatchObject({status: 'waiting-user'});
    const secondTask = selectTerminalUpdateTask(runtime.getState());
    expect(secondTask).toMatchObject({taskId: firstTask?.taskId, target: fixedTarget, phase: 'waiting-user'});
    expect(secondTask?.actionId).not.toBe(firstTask?.actionId);
    expect(preparedRefs).toEqual(['artifact:full-fixed', 'artifact:full-fixed']);
    expect(releasePrepared).toHaveBeenCalledTimes(2);
    expect(releasePrepared).toHaveBeenCalledWith({timeoutMs: 10_000, preparedId: 'prepared-1'});
    expect(actions).toHaveLength(2);

    const pendingAcceptance = await accept();
    expect(pendingAcceptance.actorResults[0]?.result).toMatchObject({status: 'already-fixed'});
    expect(actions).toHaveLength(2);
    expect(preparedRefs).toHaveLength(2);
  });

  it('does not treat cancellation of a non-FULL publication as permission to release the FULL artifact', async () => {
    const fullArtifact = Object.freeze({...artifact, nativeBuildNumber: 2, publicationId: 'e'.repeat(64)});
    const hotArtifact = Object.freeze({...fullArtifact, bundleVersion: '1.0.1', publicationId: 'f'.repeat(64)});
    const fixedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({
        sourceRef: 'artifact:full-fixed',
        expectedSha256: fullArtifact.publicationId,
        artifact: fullArtifact,
      }),
      hot: Object.freeze({
        sourceRef: 'artifact:hot-fixed',
        expectedSha256: hotArtifact.publicationId,
        artifact: hotArtifact,
      }),
    });
    const action: UpdateAction = Object.freeze({
      ...noAction,
      state: 'user-cancelled',
      reason: 'ENDED_NOT_INSTALLED',
      publicationId: hotArtifact.publicationId,
    });
    let observedAction: UpdateAction | null = null;
    const releasePrepared = vi.fn<UpdatePort['releasePrepared']>(async () => ok({released: true}));
    const port: UpdatePort = {
      readFacts: async () => ok(facts),
      prepareArtifact: async () => ok({preparedId: 'prepared-full', artifact: fullArtifact}),
      applyPrepared: async input => {
        observedAction = Object.freeze({...action, taskId: input.taskId, actionId: input.actionId});
        return ok(observedAction);
      },
      readAction: async input =>
        ok(
          observedAction?.taskId === input.taskId && observedAction.actionId === input.actionId ? observedAction : null,
        ),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared,
    };
    const runtime = createFixture({readTarget: async () => fixedTarget, port});
    runtimes.push(runtime);
    await runtime.start();

    await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: target.selectionContext},
      {requestId: createRequestId()},
    );
    const before = selectTerminalUpdateTask(runtime.getState());
    const result = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: target.selectionContext},
      {requestId: createRequestId()},
    );

    expect(result.actorResults[0]?.result).toMatchObject({
      status: 'unknown',
      reason: 'ACTION_ARTIFACT_IDENTITY_MISMATCH',
    });
    expect(selectTerminalUpdateTask(runtime.getState())).toEqual(before);
    expect(selectTerminalUpdateRecentStatus(runtime.getState())).toMatchObject({
      state: 'unknown',
      reason: 'ACTION_ARTIFACT_IDENTITY_MISMATCH',
    });
    expect(releasePrepared).not.toHaveBeenCalled();
  });

  it('keeps the committed action identity when applyPrepared returns another action', async () => {
    const fullArtifact = Object.freeze({...artifact, nativeBuildNumber: 2, publicationId: 'e'.repeat(64)});
    const fixedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      hot: null,
      full: Object.freeze({
        sourceRef: 'artifact:full-fixed',
        expectedSha256: fullArtifact.publicationId,
        artifact: fullArtifact,
      }),
    });
    const wrongAction: UpdateAction = Object.freeze({
      ...noAction,
      taskId: 'another-task',
      actionId: 'another-action',
      state: 'succeeded',
      publicationId: fullArtifact.publicationId,
      bootId: 'wrong-boot',
    });
    const port: UpdatePort = {
      readFacts: async () => ok(facts),
      prepareArtifact: async () => ok({preparedId: 'prepared-full', artifact: fullArtifact}),
      applyPrepared: async () => ok(wrongAction),
      readAction: async () => ok(null),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({readTarget: async () => fixedTarget, port});
    runtimes.push(runtime);
    await runtime.start();

    const result = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: target.selectionContext},
      {requestId: createRequestId()},
    );

    expect(result.actorResults[0]?.result).toMatchObject({status: 'unknown', reason: 'ACTION_IDENTITY_MISMATCH'});
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({
      phase: 'applying-full',
      actionId: expect.any(String),
      preparedId: 'prepared-full',
    });
    expect(selectTerminalUpdateRecentStatus(runtime.getState())).toMatchObject({
      state: 'unknown',
      reason: 'ACTION_IDENTITY_MISMATCH',
    });
  });

  it('continues a fixed FULL-to-HOT pair across a runtime change without downgrading the original JS version', async () => {
    const fullArtifact = Object.freeze({
      ...artifact,
      nativeBuildNumber: 2,
      bundleVersion: '1.0.4',
      runtimeVersion: 'next-runtime',
      publicationId: 'c'.repeat(64),
    });
    const hotArtifact = Object.freeze({...fullArtifact, bundleVersion: '1.0.6', publicationId: 'd'.repeat(64)});
    const fixedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({
        sourceRef: 'artifact:full-next',
        expectedSha256: fullArtifact.publicationId,
        artifact: fullArtifact,
      }),
      hot: Object.freeze({
        sourceRef: 'artifact:hot-next',
        expectedSha256: hotArtifact.publicationId,
        artifact: hotArtifact,
      }),
    });
    let actual: UpdateActualVersions = Object.freeze({
      ...facts.actual!,
      nativeBuildNumber: 1,
      bundleVersion: '1.0.5',
      runtimeVersion: 'old-runtime',
    });
    let fullActionId: string | null = null;
    const preparedKinds: string[] = [];
    const port: UpdatePort = {
      readFacts: async () =>
        ok(
          Object.freeze({
            ...facts,
            actual,
            embedded: actual.nativeBuildNumber === fullArtifact.nativeBuildNumber ? fullArtifact : facts.embedded,
          }),
        ),
      prepareArtifact: async input => {
        preparedKinds.push(input.kind);
        const selectedArtifact = input.kind === 'full' ? fullArtifact : hotArtifact;
        return ok({preparedId: `prepared-${input.kind}`, artifact: selectedArtifact});
      },
      applyPrepared: async input => {
        if (input.kind === 'full') {
          fullActionId = input.actionId;
          return ok(
            Object.freeze({
              ...noAction,
              taskId: input.taskId,
              actionId: input.actionId,
              state: 'unknown' as const,
              reason: 'INSTALLER_AWAITING_READBACK',
              publicationId: fullArtifact.publicationId,
            }),
          );
        }
        return ok(
          Object.freeze({
            ...noAction,
            taskId: input.taskId,
            actionId: input.actionId,
            state: 'waiting-user' as const,
            publicationId: hotArtifact.publicationId,
          }),
        );
      },
      readAction: async input =>
        ok(
          Object.freeze({
            ...noAction,
            taskId: input.taskId,
            actionId: input.actionId,
            state: 'succeeded' as const,
            publicationId: fullArtifact.publicationId,
            bootId: 'full-boot',
          }),
        ),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({readTarget: async () => fixedTarget, port});
    runtimes.push(runtime);
    await runtime.start();

    const accepted = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );
    expect(accepted.actorResults[0]?.result).toMatchObject({status: 'unknown', reason: 'INSTALLER_AWAITING_READBACK'});
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({
      originalBundleVersion: '1.0.5',
      phase: 'applying-full',
    });
    expect(preparedKinds).toEqual(['full']);

    actual = Object.freeze({
      ...facts.actual!,
      nativeBuildNumber: 2,
      bundleVersion: '1.0.4',
      runtimeVersion: 'next-runtime',
      publicationId: fullArtifact.publicationId,
      bootId: 'full-boot',
    });
    const continued = await runtime.dispatchCommand(
      reconcileTerminalUpdateCommand,
      {resumeFixedTask: true},
      {requestId: createRequestId()},
    );

    expect(continued.status).toBe('completed');
    expect(fullActionId).not.toBeNull();
    expect(preparedKinds).toEqual(['full', 'hot']);
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({
      originalBundleVersion: '1.0.5',
      phase: 'waiting-user',
    });
  });

  it('allows HOT on a higher APK with the target runtime and rejects an incompatible runtime', async () => {
    const fullArtifact = Object.freeze({
      ...artifact,
      nativeBuildNumber: 2,
      runtimeVersion: 'target-runtime',
      publicationId: 'c'.repeat(64),
    });
    const hotArtifact = Object.freeze({...fullArtifact, bundleVersion: '1.0.1', publicationId: 'd'.repeat(64)});
    const fixedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({
        sourceRef: 'artifact:full-2',
        expectedSha256: fullArtifact.publicationId,
        artifact: fullArtifact,
      }),
      hot: Object.freeze({
        sourceRef: 'artifact:hot-2',
        expectedSha256: hotArtifact.publicationId,
        artifact: hotArtifact,
      }),
    });
    let preparedKind: string | null = null;
    const prepareArtifact: UpdatePort['prepareArtifact'] = vi.fn(async input => {
      preparedKind = input.kind;
      return ok({preparedId: 'prepared-hot', artifact: hotArtifact});
    });
    const port: UpdatePort = {
      readFacts: async () =>
        ok(
          Object.freeze({
            ...facts,
            actual: Object.freeze({
              ...facts.actual!,
              nativeBuildNumber: 3,
              runtimeVersion: 'target-runtime',
              bundleVersion: '1.0.0',
            }),
          }),
        ),
      prepareArtifact,
      applyPrepared: async input =>
        ok(
          Object.freeze({
            ...noAction,
            taskId: input.taskId,
            actionId: input.actionId,
            state: 'waiting-user' as const,
            publicationId: hotArtifact.publicationId,
          }),
        ),
      readAction: async () => ok(null),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({readTarget: async () => fixedTarget, port});
    runtimes.push(runtime);
    await runtime.start();

    const compatible = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );
    expect(compatible.actorResults[0]?.result).toMatchObject({status: 'waiting-user'});
    expect(prepareArtifact).toHaveBeenCalledOnce();
    expect(preparedKind).toBe('hot');
    const incompatiblePort: UpdatePort = {
      ...port,
      readFacts: async () =>
        ok(
          Object.freeze({
            ...facts,
            actual: Object.freeze({
              ...facts.actual!,
              nativeBuildNumber: 3,
              runtimeVersion: 'unmatched-runtime',
              bundleVersion: '1.0.0',
            }),
          }),
        ),
    };
    const incompatibleRuntime = createFixture({readTarget: async () => fixedTarget, port: incompatiblePort});
    runtimes.push(incompatibleRuntime);
    await incompatibleRuntime.start();
    const incompatible = await incompatibleRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );
    expect(incompatible.actorResults[0]?.result).toMatchObject({status: 'failed', reason: 'HOT_RUNTIME_MISMATCH'});
    expect(selectTerminalUpdateTask(incompatibleRuntime.getState())).toMatchObject({
      phase: 'failed',
      failureCode: 'HOT_RUNTIME_MISMATCH',
    });
  });

  it('rejects HOT when the installed same-build APK does not match the fixed FULL digest', async () => {
    const fullApkSha256 = '1'.repeat(64);
    const fixedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({...target.full!, apkSha256: fullApkSha256}),
      hot: Object.freeze({
        ...target.hot!,
        artifact: Object.freeze({...artifact, bundleVersion: '1.0.1', publicationId: '2'.repeat(64)}),
      }),
    });
    const prepareArtifact = vi.fn(async () => ok({preparedId: 'unexpected', artifact}));
    const runtime = createFixture({
      readTarget: async () => fixedTarget,
      port: {
        readFacts: async () =>
          ok(Object.freeze({...facts, actual: Object.freeze({...facts.actual!, apkSha256: '3'.repeat(64)})})),
        prepareArtifact,
        applyPrepared: async () => ok(noAction),
        readAction: async () => ok(noAction),
        confirmBoot: async () => ok({confirmed: true}),
        releasePrepared: async () => ok({released: true}),
      },
    });
    runtimes.push(runtime);
    await runtime.start();

    const result = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: target.selectionContext},
      {requestId: createRequestId()},
    );

    expect(result.actorResults[0]?.result).toMatchObject({status: 'failed', reason: 'FULL_IDENTITY_CONFLICT'});
    expect(prepareArtifact).not.toHaveBeenCalled();
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({
      phase: 'failed',
      failureCode: 'FULL_IDENTITY_CONFLICT',
    });
  });

  it('rejects a HOT grant whose minimum FULL identity differs from the fixed target', async () => {
    const fullApkSha256 = 'a'.repeat(64);
    const fullPublicationId = 'b'.repeat(64);
    const hotPublicationId = 'c'.repeat(64);
    const selectionContext = Object.freeze({selectedSpace: 'development', contextIdentity: 'context', ruleRef: 'rule'});
    const fixedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({
        sourceRef: 'full',
        expectedSha256: 'd'.repeat(64),
        apkSha256: fullApkSha256,
        artifact: Object.freeze({...artifact, publicationId: fullPublicationId}),
        artifactRef: 'full-ref',
      }),
      hot: Object.freeze({
        sourceRef: 'hot',
        expectedSha256: 'e'.repeat(64),
        artifact: Object.freeze({...artifact, bundleVersion: '1.0.1', publicationId: hotPublicationId}),
        artifactRef: 'hot-ref',
      }),
      selectionContext,
    });
    const prepareArtifact = vi.fn(async () => ok({preparedId: 'unexpected', artifact}));
    let updateState = {
      ruleSnapshot: Object.freeze({
        contextIdentity: null,
        selectedSpace: null,
        projectRef: null,
        collectionHash: null,
        items: Object.freeze([]),
      }),
      ruleSnapshotStatus: Object.freeze({status: 'empty' as const, errorCode: null}),
      currentTask: null,
      recentStatus: Object.freeze({taskId: null, state: 'idle' as const, reason: null, changedAt: 0 as TimestampMs}),
      failedArtifactIds: Object.freeze([] as readonly string[]),
      actualVersions: null,
      reportDescriptor: Object.freeze({
        bindingIdentity: null,
        contextIdentity: null,
        nextReportSequence: 1,
        pendingReports: Object.freeze({}),
        sendPaused: false,
        latestDeliveryFailure: null,
      }),
    } as TerminalUpdateState;
    const clientState = terminalDataClientReducer(undefined, {type: 'test/init'});
    const actor = createTestTerminalUpdateActor({
      port: {
        readFacts: async () =>
          ok(
            Object.freeze({
              ...facts,
              actual: Object.freeze({
                ...facts.actual!,
                apkSha256: fullApkSha256,
                nativeBuildNumber: 1,
                runtimeVersion: '1',
                bundleVersion: '1.0.0',
                publicationId: fullPublicationId,
              }),
              embedded: Object.freeze({...artifact, publicationId: fullPublicationId}),
            }),
          ),
        prepareArtifact,
        applyPrepared: async () => ok(noAction),
        readAction: async () => ok(noAction),
        confirmBoot: async () => ok({confirmed: true}),
        releasePrepared: async () => ok({released: true}),
      },
      sourceProvider: {readTarget: async () => fixedTarget, resolveSourcePath: () => '/unused'},
      readNetworkSnapshot: () => Object.freeze({addresses: Object.freeze([])}),
    });
    const handler = actor.handlers.find(item => item.commandName === acceptTerminalUpdateTargetCommand.commandName);
    if (handler === undefined) throw new Error('accept target handler missing');
    const context = {
      runtimeId: 'grant-minimum-full-test',
      command: {
        commandName: acceptTerminalUpdateTargetCommand.commandName,
        commandId: 'accept',
        requestId: null,
        payload: {selectionContext},
      },
      actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
      platformPorts: {logger: {info: () => undefined, warn: () => undefined, error: () => undefined}},
      getState: () => ({
        [terminalDataClientSliceName]: clientState,
        [terminalUpdateSliceName]: updateState,
      }),
      dispatchAction: (action: unknown) => {
        const value = action as {type: string; payload: unknown};
        if (value.type === terminalUpdateActions.replaceTask.type)
          updateState = {...updateState, currentTask: value.payload as TerminalUpdateState['currentTask']};
        if (value.type === terminalUpdateActions.replaceRecentStatus.type)
          updateState = {...updateState, recentStatus: value.payload as TerminalUpdateState['recentStatus']};
        if (value.type === terminalUpdateActions.replaceReportDescriptor.type)
          updateState = {...updateState, reportDescriptor: value.payload as TerminalUpdateState['reportDescriptor']};
        if (value.type === terminalUpdateActions.replaceActualVersions.type)
          updateState = {...updateState, actualVersions: value.payload as TerminalUpdateState['actualVersions']};
      },
      flushPersistence: async () => ({status: 'succeeded'}),
      dispatchCommand: async (command: {commandName: string}) =>
        command.commandName === requestTerminalUpdateDownloadGrantCommand.commandName
          ? ({
              status: 'completed',
              actorResults: [
                {
                  status: 'completed',
                  result: {
                    kind: 'success',
                    body: {
                      relativeContentPath: 'grant-content',
                      grant: 'g'.repeat(43),
                      expiresAtEpochMillis: Date.now() + 60_000,
                      artifactRef: 'hot-ref',
                      zipSha256: 'e'.repeat(64),
                      byteSize: 100,
                      artifact: Object.freeze({
                        ...artifact,
                        bundleVersion: '1.0.1',
                        publicationId: hotPublicationId,
                        minimumFull: Object.freeze({
                          applicationId: artifact.applicationId,
                          nativeBuildNumber: 1,
                          runtimeVersion: '1',
                          publicationId: fullPublicationId,
                          apkSha256: 'f'.repeat(64),
                        }),
                      }),
                    },
                  },
                },
              ],
            } as never)
          : ({status: 'rejected', actorResults: []} as never),
    } as never;

    await expect(handler.handle(context)).resolves.toMatchObject({
      status: 'failed',
      reason: 'DOWNLOAD_ARTIFACT_IDENTITY_MISMATCH',
    });
    expect(prepareArtifact).not.toHaveBeenCalled();
    expect(updateState.currentTask).toMatchObject({
      phase: 'failed',
      failureCode: 'DOWNLOAD_ARTIFACT_IDENTITY_MISMATCH',
    });
  });

  it('rejects a FULL-only JS downgrade against the version observed before update work', async () => {
    const fullArtifact = Object.freeze({
      ...artifact,
      nativeBuildNumber: 2,
      bundleVersion: '1.0.4',
      publicationId: 'c'.repeat(64),
    });
    const fixedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({
        sourceRef: 'artifact:full-old-js',
        expectedSha256: fullArtifact.publicationId,
        artifact: fullArtifact,
      }),
      hot: null,
    });
    const prepareArtifact = vi.fn(async () => ok({preparedId: 'unexpected', artifact: fullArtifact}));
    const port: UpdatePort = {
      readFacts: async () =>
        ok(
          Object.freeze({
            ...facts,
            actual: Object.freeze({...facts.actual!, nativeBuildNumber: 1, bundleVersion: '1.0.5'}),
          }),
        ),
      prepareArtifact,
      applyPrepared: async () => ok(noAction),
      readAction: async () => ok(null),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({readTarget: async () => fixedTarget, port});
    runtimes.push(runtime);
    await runtime.start();

    const result = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );
    expect(result.actorResults[0]?.result).toMatchObject({status: 'failed', reason: 'FULL_ONLY_VERSION_DOWNGRADE'});
    expect(prepareArtifact).not.toHaveBeenCalled();
  });

  it('records a HOT preparation timeout as unknown without applying or marking the artifact failed', async () => {
    const hotArtifact = Object.freeze({...artifact, bundleVersion: '1.0.1', publicationId: 'e'.repeat(64)});
    const fixedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: null,
      hot: Object.freeze({
        sourceRef: 'artifact:hot-1.0.1',
        expectedSha256: hotArtifact.publicationId,
        artifact: hotArtifact,
      }),
    });
    const applyPrepared = vi.fn(async () => ok(noAction));
    const port: UpdatePort = {
      readFacts: async () => ok(facts),
      prepareArtifact: async () => ({
        status: 'timed-out',
        port: 'update',
        capability: 'prepareArtifact',
        timeoutMs: 120_000,
      }),
      applyPrepared,
      readAction: async () => ok(null),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({readTarget: async () => fixedTarget, port});
    runtimes.push(runtime);
    await runtime.start();

    const result = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );

    expect(result.actorResults[0]?.result).toMatchObject({status: 'unknown', reason: 'PREPARE_TIMED-OUT'});
    expect(applyPrepared).not.toHaveBeenCalled();
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({
      phase: 'unknown',
      failureCode: 'PREPARE_TIMED-OUT',
    });
    expect(selectTerminalUpdateRecentStatus(runtime.getState())).toMatchObject({
      state: 'unknown',
      reason: 'PREPARE_TIMED-OUT',
    });
    expect(runtime.getState()['kernel.base.terminal-update.state']).toMatchObject({failedArtifactIds: []});
  });

  it('persists a terminal FULL preparation failure and will not select that artifact on a later boot', async () => {
    const persistence = createStorage();
    const persistenceKey = 'terminal-update-failed-full-preparation-test';
    const failedFullArtifact = Object.freeze({
      ...artifact,
      nativeBuildNumber: 2,
      publicationId: '9'.repeat(64),
    });
    const fullOnlyTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({
        sourceRef: 'artifact:failed-full',
        expectedSha256: failedFullArtifact.publicationId,
        artifact: failedFullArtifact,
      }),
      hot: null,
    });
    const firstRuntime = createFixture({
      persistKv: persistence,
      persistenceKey,
      readTarget: async () => fullOnlyTarget,
      port: {
        readFacts: async () => ok(facts),
        prepareArtifact: async () => ({
          status: 'failed',
          port: 'update',
          capability: 'prepareArtifact',
          error: {code: 'APK_SIGNER_MISMATCH', message: 'APK signer mismatch', retryable: false},
        }),
        applyPrepared: async () => ok(noAction),
        readAction: async () => ok(noAction),
        confirmBoot: async () => ok({confirmed: true}),
        releasePrepared: async () => ok({released: true}),
      },
    });
    runtimes.push(firstRuntime);
    await firstRuntime.start();

    const failed = await firstRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: fullOnlyTarget.selectionContext},
      {requestId: createRequestId()},
    );
    expect(failed.actorResults[0]?.result).toMatchObject({status: 'failed', reason: 'APK_SIGNER_MISMATCH'});
    expect(firstRuntime.getState()['kernel.base.terminal-update.state']).toMatchObject({
      failedArtifactIds: [failedFullArtifact.publicationId],
      currentTask: {phase: 'failed', target: fullOnlyTarget},
    });
    await releaseRuntimeForTestAsync(firstRuntime);
    runtimes.splice(runtimes.indexOf(firstRuntime), 1);

    const nextBootFacts: UpdateFacts = Object.freeze({
      ...facts,
      actual: Object.freeze({...facts.actual!, bootId: 'failed-full-next-boot'}),
    });
    const prepareArtifact = vi.fn(async () => ok({preparedId: 'must-not-prepare', artifact: failedFullArtifact}));
    const nextRuntime = createFixture({
      persistKv: persistence,
      persistenceKey,
      readTarget: async () => fullOnlyTarget,
      port: {
        readFacts: async () => ok(nextBootFacts),
        prepareArtifact,
        applyPrepared: async () => ok(noAction),
        readAction: async () => ok(noAction),
        confirmBoot: async () => ok({confirmed: true}),
        releasePrepared: async () => ok({released: true}),
      },
    });
    runtimes.push(nextRuntime);
    await nextRuntime.start();

    const retry = await nextRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: fullOnlyTarget.selectionContext},
      {requestId: createRequestId()},
    );
    expect(retry.actorResults[0]?.result).toMatchObject({
      status: 'failed',
      reason: 'FAILED_ARTIFACT_REENTRY_FORBIDDEN',
    });
    expect(prepareArtifact).not.toHaveBeenCalled();
    expect(nextRuntime.getState()['kernel.base.terminal-update.state']).toMatchObject({
      failedArtifactIds: [failedFullArtifact.publicationId],
    });
  });

  it('preserves the task boot through non-success FULL readbacks and releases the failure on the next boot', async () => {
    const persistence = createStorage();
    const persistenceKey = 'terminal-update-failed-full-readback-boot-test';
    const fullArtifact = Object.freeze({...artifact, nativeBuildNumber: 2, publicationId: '8'.repeat(64)});
    const repairArtifact = Object.freeze({...artifact, nativeBuildNumber: 3, publicationId: '7'.repeat(64)});
    const fullOnlyTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({
        sourceRef: 'artifact:full-readback',
        expectedSha256: fullArtifact.publicationId,
        artifact: fullArtifact,
      }),
      hot: null,
    });
    const repairTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      ruleRef: 'failed-full-repair-rule',
      createdAt: 4 as TimestampMs,
      full: Object.freeze({
        sourceRef: 'artifact:full-repair',
        expectedSha256: repairArtifact.publicationId,
        artifact: repairArtifact,
      }),
      hot: null,
    });
    let actionState: UpdateAction['state'] = 'accepted';
    let currentFacts = facts;
    let offeredTarget = fullOnlyTarget;
    const releasePrepared = vi.fn(async () => ok({released: true}));
    const port: UpdatePort = {
      readFacts: async () => ok(currentFacts),
      prepareArtifact: async () => ok({preparedId: 'prepared-full', artifact: fullArtifact}),
      applyPrepared: async input =>
        ok({
          ...noAction,
          taskId: input.taskId,
          actionId: input.actionId,
          publicationId: fullArtifact.publicationId,
          state: 'accepted',
        }),
      readAction: async input =>
        ok({
          ...noAction,
          taskId: input.taskId,
          actionId: input.actionId,
          publicationId: fullArtifact.publicationId,
          state: actionState,
          reason: actionState === 'failed' ? 'APK_INSTALL_FAILED' : null,
        }),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared,
    };
    const runtime = createFixture({
      persistKv: persistence,
      persistenceKey,
      readTarget: async () => offeredTarget,
      port,
    });
    runtimes.push(runtime);
    await runtime.start();

    await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: fullOnlyTarget.selectionContext},
      {requestId: createRequestId()},
    );
    expect(runtime.getState()['kernel.base.terminal-update.state']).toMatchObject({failedArtifactIds: []});

    actionState = 'waiting-user';
    await runtime.dispatchCommand(
      reconcileTerminalUpdateCommand,
      {resumeFixedTask: false},
      {requestId: createRequestId()},
    );
    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({phase: 'waiting-user', bootId: 'fixture-boot'});

    actionState = 'failed';
    await runtime.dispatchCommand(
      reconcileTerminalUpdateCommand,
      {resumeFixedTask: false},
      {requestId: createRequestId()},
    );
    expect(runtime.getState()['kernel.base.terminal-update.state']).toMatchObject({
      failedArtifactIds: [fullArtifact.publicationId],
      recentStatus: {state: 'failed', reason: 'APK_INSTALL_FAILED'},
      currentTask: {phase: 'failed', bootId: 'fixture-boot'},
    });
    expect(releasePrepared).toHaveBeenCalledOnce();
    expect(releasePrepared).toHaveBeenCalledWith({timeoutMs: 10_000, preparedId: 'prepared-full'});

    offeredTarget = repairTarget;
    const sameBoot = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: repairTarget.selectionContext},
      {requestId: createRequestId()},
    );
    expect(sameBoot.actorResults[0]?.result).toMatchObject({status: 'already-fixed'});
    await releaseRuntimeForTestAsync(runtime);
    runtimes.splice(runtimes.indexOf(runtime), 1);

    currentFacts = Object.freeze({
      ...facts,
      actual: Object.freeze({...facts.actual!, bootId: 'failed-full-readback-next-boot'}),
    });
    offeredTarget = fullOnlyTarget;
    const nextRuntime = createFixture({
      persistKv: persistence,
      persistenceKey,
      readTarget: async () => offeredTarget,
      port: {
        ...port,
        prepareArtifact: async input => ok({preparedId: 'prepared-next', artifact: input.artifact}),
        applyPrepared: async input =>
          ok({
            ...noAction,
            taskId: input.taskId,
            actionId: input.actionId,
            publicationId: fullArtifact.publicationId,
            state: 'accepted',
          }),
        readAction: async () => ok(noAction),
      },
    });
    runtimes.push(nextRuntime);
    await nextRuntime.start();
    expect(selectTerminalUpdateTask(nextRuntime.getState())).toBeNull();

    const rejectedOldArtifact = await nextRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: fullOnlyTarget.selectionContext},
      {requestId: createRequestId()},
    );
    expect(rejectedOldArtifact.actorResults[0]?.result).toMatchObject({
      status: 'failed',
      reason: 'FAILED_ARTIFACT_REENTRY_FORBIDDEN',
    });

    await releaseRuntimeForTestAsync(nextRuntime);
    runtimes.splice(runtimes.indexOf(nextRuntime), 1);

    currentFacts = Object.freeze({
      ...currentFacts,
      actual: Object.freeze({...currentFacts.actual!, bootId: 'failed-full-repair-boot'}),
    });
    offeredTarget = repairTarget;
    const repairRuntime = createFixture({
      persistKv: persistence,
      persistenceKey,
      readTarget: async () => offeredTarget,
      port: {
        ...port,
        prepareArtifact: async input => ok({preparedId: 'prepared-repair', artifact: input.artifact}),
        applyPrepared: async input =>
          ok({
            ...noAction,
            taskId: input.taskId,
            actionId: input.actionId,
            publicationId: repairArtifact.publicationId,
            state: 'accepted',
          }),
        readAction: async () => ok(noAction),
      },
    });
    runtimes.push(repairRuntime);
    await repairRuntime.start();
    expect(selectTerminalUpdateTask(repairRuntime.getState())).toBeNull();

    const acceptedRepair = await repairRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: repairTarget.selectionContext},
      {requestId: createRequestId()},
    );
    expect(acceptedRepair.actorResults[0]?.result).toMatchObject({status: 'applying'});
    expect(selectTerminalUpdateTask(repairRuntime.getState())).toMatchObject({
      phase: 'applying-full',
      target: {ruleRef: repairTarget.ruleRef, full: {artifact: {publicationId: repairArtifact.publicationId}}},
    });
    expect(repairRuntime.getState()['kernel.base.terminal-update.state']).toMatchObject({
      failedArtifactIds: [fullArtifact.publicationId],
    });
  });

  it('persists a HOT candidate failure returned by applyPrepared immediately', async () => {
    const hotArtifact = Object.freeze({...artifact, bundleVersion: '1.0.1', publicationId: 'f'.repeat(64)});
    const fixedTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: null,
      hot: Object.freeze({
        sourceRef: 'artifact:hot-1.0.1',
        expectedSha256: hotArtifact.publicationId,
        artifact: hotArtifact,
      }),
    });
    const port: UpdatePort = {
      readFacts: async () => ok(facts),
      prepareArtifact: async () => ok({preparedId: 'prepared-hot', artifact: hotArtifact}),
      applyPrepared: async input =>
        ok({
          ...noAction,
          taskId: input.taskId,
          actionId: input.actionId,
          state: 'failed',
          reason: 'HOT_BOOT_UNCONFIRMED',
          publicationId: hotArtifact.publicationId,
        }),
      readAction: async () => ok(null),
      confirmBoot: async () => ok({confirmed: true}),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({readTarget: async () => fixedTarget, port});
    runtimes.push(runtime);
    await runtime.start();

    const result = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: target.selectionContext,
      },
      {requestId: createRequestId()},
    );

    expect(result.actorResults[0]?.result).toMatchObject({status: 'failed', reason: 'HOT_BOOT_UNCONFIRMED'});
    expect(runtime.getState()['kernel.base.terminal-update.state']).toMatchObject({
      currentTask: {phase: 'failed', failureCode: 'HOT_BOOT_UNCONFIRMED'},
      failedArtifactIds: [hotArtifact.publicationId],
      recentStatus: {state: 'failed', reason: 'HOT_BOOT_UNCONFIRMED'},
    });
  });

  it('records a HOT boot failure and blocks that publication after the task is released', async () => {
    const hotArtifact = Object.freeze({...artifact, bundleVersion: '1.0.1', publicationId: 'd'.repeat(64)});
    const hotOnlyTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: null,
      hot: Object.freeze({
        sourceRef: 'artifact:failed-hot-boot',
        expectedSha256: hotArtifact.publicationId,
        artifact: hotArtifact,
      }),
    });
    let currentFacts = facts;
    let bootFailed = false;
    let hotAction: Readonly<{taskId: string; actionId: string}> | null = null;
    const prepareArtifact = vi.fn(async () => ok({preparedId: 'prepared-hot', artifact: hotArtifact}));
    const applyPrepared = vi.fn<UpdatePort['applyPrepared']>(async input => {
      hotAction = Object.freeze({taskId: input.taskId, actionId: input.actionId});
      return ok({
        taskId: input.taskId,
        actionId: input.actionId,
        publicationId: hotArtifact.publicationId,
        state: 'accepted',
        reason: null,
        bootId: facts.actual!.bootId,
      });
    });
    const runtime = createFixture({
      readTarget: async () => hotOnlyTarget,
      port: {
        readFacts: async () => ok(currentFacts),
        prepareArtifact,
        applyPrepared,
        readAction: async input =>
          hotAction === null
            ? ok(null)
            : ok({
                ...noAction,
                taskId: input.taskId,
                actionId: input.actionId,
                publicationId: hotArtifact.publicationId,
                state: bootFailed ? ('failed' as const) : ('accepted' as const),
                reason: bootFailed ? 'HOT_BOOT_UNCONFIRMED' : null,
                bootId: 'failed-hot-boot',
              }),
        confirmBoot: async () => ok({confirmed: true as const}),
        releasePrepared: async () => ok({released: true}),
      },
    });
    runtimes.push(runtime);
    await runtime.start();

    await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: hotOnlyTarget.selectionContext},
      {requestId: createRequestId()},
    );
    const applying = selectTerminalUpdateTask(runtime.getState());
    expect(applying).toMatchObject({phase: 'applying-hot', actionId: expect.any(String)});

    currentFacts = Object.freeze({
      ...facts,
      actual: Object.freeze({
        ...facts.actual!,
        publicationId: hotArtifact.publicationId,
        bundleVersion: hotArtifact.bundleVersion,
        bootId: 'failed-hot-boot',
        entryKind: 'hot' as const,
      }),
    });
    await runtime.dispatchCommand(
      reconcileTerminalUpdateCommand,
      {resumeFixedTask: false},
      {requestId: createRequestId()},
    );
    bootFailed = true;

    const confirmation = await runtime.dispatchCommand(
      confirmTerminalUpdateBootCommand,
      {bootToken: 'failed-hot-boot', publicationId: hotArtifact.publicationId},
      {requestId: createRequestId()},
    );
    expect(confirmation.actorResults[0]?.result).toMatchObject({status: 'failed'});
    expect(runtime.getState()['kernel.base.terminal-update.state']).toMatchObject({
      failedArtifactIds: [hotArtifact.publicationId],
      currentTask: {phase: 'failed', failureCode: 'HOT_BOOT_UNCONFIRMED'},
    });

    currentFacts = Object.freeze({
      ...facts,
      actual: Object.freeze({...facts.actual!, bootId: 'next-boot-after-hot-failure'}),
    });
    await runtime.dispatchCommand(
      reconcileTerminalUpdateCommand,
      {resumeFixedTask: false},
      {requestId: createRequestId()},
    );
    const retry = await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: hotOnlyTarget.selectionContext},
      {requestId: createRequestId()},
    );

    expect(retry.actorResults[0]?.result).toEqual({status: 'failed', reason: 'FAILED_ARTIFACT_REENTRY_FORBIDDEN'});
    expect(prepareArtifact).toHaveBeenCalledOnce();
    expect(applyPrepared).toHaveBeenCalledOnce();
    expect(runtime.getState()['kernel.base.terminal-update.state']).toMatchObject({
      failedArtifactIds: [hotArtifact.publicationId],
    });
  });

  it('root reset retains only its declared persistent fields and clears transient, other-owner and orphan state', async () => {
    const plainStorage = createStorage();
    const protectedStorage = createStorage();
    const namespace = 'terminal-update-reset-test';
    const otherSliceName = 'kernel.base.test-other-owner.state';
    const otherRegistration = defineStateRuntimeSlice<{enabled: boolean}>({
      name: otherSliceName,
      reducer: (state = {enabled: false}, action) => (action.type === 'test-other/enable' ? {enabled: true} : state),
      persistIntent: 'owner-only',
      persistence: [{kind: 'field', stateKey: 'enabled'}],
      syncIntent: 'isolated',
    });
    const ports = createPlatformPorts({
      environmentMode: 'TEST',
      bindings: {
        logger: {kind: 'console'},
        persistKv: plainStorage,
        persistSecure: protectedStorage,
        device: unavailableDevicePort,
        appControl: unavailableAppControlPort,
        script: unavailableScriptPort,
        connector: unavailableConnectorPort,
        update: {
          readFacts: async () => ok(facts),
          prepareArtifact: async () => ok({preparedId: 'none', artifact}),
          applyPrepared: async () => ok(noAction),
          readAction: async () => ok(noAction),
          confirmBoot: async () => ok({confirmed: true}),
          releasePrepared: async () => ok({released: true}),
        },
        logUpload: unavailableLogUploadPort,
        topologyHost: unavailableTopologyHostPort,
      },
    });
    const stateRuntime = await createStateRuntime({
      runtimeName: 'terminal-update-reset-retention-test',
      environmentMode: 'TEST',
      slices: [terminalUpdateRegistration, otherRegistration],
      logger: ports.logger,
      plainStorage,
      protectedStorage,
      persistenceKey: namespace,
      persistenceDebounceMs: 0,
    });

    const currentTask = Object.freeze({
      taskId: 'retained-task',
      target,
      phase: 'fixed' as const,
      actionId: null,
      actionKind: null,
      preparedId: null,
      bootId: null,
      failureCode: null,
      originalBundleVersion: null,
    });
    const actualVersions = Object.freeze({
      applicationId: artifact.applicationId,
      nativeVersion: artifact.nativeVersion,
      nativeBuildNumber: artifact.nativeBuildNumber,
      runtimeVersion: artifact.runtimeVersion,
      bundleVersion: artifact.bundleVersion,
      publicationId: artifact.publicationId,
      bootId: 'transient-boot',
      entryKind: 'embedded' as const,
    });
    stateRuntime.getStore().dispatch(terminalUpdateActions.replaceTask(currentTask));
    stateRuntime.getStore().dispatch(
      terminalUpdateActions.replaceRecentStatus({
        taskId: currentTask.taskId,
        state: 'fixed',
        reason: null,
        changedAt: 2 as TimestampMs,
      }),
    );
    stateRuntime.getStore().dispatch(terminalUpdateActions.replaceFailedArtifactIds(['failed-publication']));
    stateRuntime.getStore().dispatch(terminalUpdateActions.replaceActualVersions(actualVersions));
    stateRuntime.getStore().dispatch({type: 'test-other/enable'});
    expect((await stateRuntime.flushPersistence()).status).toBe('succeeded');

    const retainedKeys = ['ruleSnapshot', 'currentTask', 'recentStatus', 'failedArtifactIds', 'reportDescriptor'].map(
      storageKey =>
        createPersistenceFieldKey({persistenceKey: namespace, sliceName: terminalUpdateRegistration.name, storageKey}),
    );
    const protectedCredentialKey = createPersistenceFieldKey({
      persistenceKey: namespace,
      sliceName: 'kernel.base.terminal-data-client.client',
      storageKey: 'credential',
    });
    const otherKey = createPersistenceFieldKey({
      persistenceKey: namespace,
      sliceName: otherSliceName,
      storageKey: 'enabled',
    });
    const orphanKey = `${createPersistenceNamespacePrefix(namespace)}unregistered/orphan`;
    plainStorage.values.set(otherKey, 'true');
    plainStorage.values.set(orphanKey, '"orphan"');
    protectedStorage.values.set(
      protectedCredentialKey,
      JSON.stringify({
        groupWorkspaceKey: 'fixture-workspace',
        terminalRef: 'fixture-terminal',
        storeRef: 'fixture-store',
        deviceId: 'fixture-device',
        bindingGeneration: 1,
        credentialSecret: 'fixture-secret',
      }),
    );

    const result = await stateRuntime.getResetActor().handleResetCommand();

    expect(result.status).toBe('succeeded');
    expect(stateRuntime.getState()[terminalUpdateRegistration.name]).toMatchObject({
      currentTask,
      recentStatus: {taskId: currentTask.taskId, state: 'fixed'},
      failedArtifactIds: ['failed-publication'],
      actualVersions: null,
    });
    expect(stateRuntime.getState()[otherSliceName]).toEqual({enabled: false});
    expect(
      [...plainStorage.values.keys()].filter(key => key.startsWith(createPersistenceNamespacePrefix(namespace))),
    ).toEqual(expect.arrayContaining(retainedKeys));
    expect(
      [...plainStorage.values.keys()].filter(key => key.startsWith(createPersistenceNamespacePrefix(namespace))),
    ).toHaveLength(5);
    expect(plainStorage.values.has(otherKey)).toBe(false);
    expect(plainStorage.values.has(orphanKey)).toBe(false);
    expect(protectedStorage.values.has(protectedCredentialKey)).toBe(false);
  });
});
