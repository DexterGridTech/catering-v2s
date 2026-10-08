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
  reconcileTerminalUpdateCommand,
  selectTerminalUpdateRecentStatus,
  selectTerminalUpdateTask,
  type FixedUpdateTarget,
  type UpdateTargetSourceProvider,
} from '../src/index';
import {terminalUpdateActions, terminalUpdateRegistration} from '../src/features/slices/terminalUpdate';
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
  selectionContext: Object.freeze({selectedSpace: 'development', contextIdentity: 'fixture-context'}),
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
  const modules: readonly RuntimeModule[] = [
    {moduleName: contractsModuleName, kind: 'toolkit', dependencies: []},
    {moduleName: platformPortsModuleName, kind: 'toolkit', dependencies: [{moduleName: contractsModuleName}]},
    {
      moduleName: stateModuleName,
      kind: 'toolkit',
      dependencies: [{moduleName: contractsModuleName}, {moduleName: platformPortsModuleName}],
    },
    createTerminalUpdateModule({
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
    expect(selectTerminalUpdateRecentStatus(secondRuntime.getState())).toMatchObject({state: 'succeeded'});
    const next = await secondRuntime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {
        selectionContext: nextTarget.selectionContext,
      },
      {requestId: createRequestId()},
    );

    expect(next.actorResults[0]?.result).toMatchObject({status: 'succeeded'});
    expect(selectTerminalUpdateTask(secondRuntime.getState())).toMatchObject({target: nextTarget, phase: 'succeeded'});
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
      selectionContext: Object.freeze({selectedSpace: 'development', contextIdentity: 'next-repair-context'}),
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

  it('does not expose a target or call the update port when persistence fails, and allows retry', async () => {
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
    expect(readFactsCount).toBe(startupReadFactsCount);
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
    expect(readFactsCount).toBe(startupReadFactsCount + 1);
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
          factsRead <= 2
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
    const runtime = createFixture({persistKv: persistence, persistenceKey, readTarget: async () => offeredTarget, port});
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

    const retainedKeys = ['currentTask', 'recentStatus', 'failedArtifactIds'].map(storageKey =>
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
    ).toHaveLength(3);
    expect(plainStorage.values.has(otherKey)).toBe(false);
    expect(plainStorage.values.has(orphanKey)).toBe(false);
    expect(protectedStorage.values.has(protectedCredentialKey)).toBe(false);
  });
});
