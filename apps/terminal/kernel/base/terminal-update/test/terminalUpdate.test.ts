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
import {createRuntime, type Runtime, type RuntimeModule} from '@catering-v2s/kernel-base-runtime';
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
    confirmBoot: async () => ok(noAction),
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
        confirmBoot: async () => ok(noAction),
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
        confirmBoot: async () => ok(noAction),
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
        confirmBoot: async () => ok(noAction),
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
      confirmBoot: async () => ok(noAction),
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
      confirmBoot: async () => ok(noAction),
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

  it('records a completed FULL action without starting HOT during Runtime installation', async () => {
    const persistenceKey = 'terminal-update-full-readback-resume-test';
    const persistence = createStorage();
    const persistedTask = Object.freeze({
      taskId: 'retained-full-task',
      target: fixedResumeTarget,
      phase: 'applying-full' as const,
      actionId: 'persisted-full-action',
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
      confirmBoot: async () => ok(noAction),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({port, persistKv: persistence, persistenceKey});
    runtimes.push(runtime);

    await runtime.start();

    expect(selectTerminalUpdateTask(runtime.getState())).toMatchObject({
      taskId: persistedTask.taskId,
      phase: 'fixed',
      actionId: null,
    });
    expect(prepareArtifact).not.toHaveBeenCalled();
  });

  it('does not continue HOT after FULL when a restored task has no original JS version', async () => {
    const persistenceKey = 'terminal-update-missing-original-version-test';
    const persistence = createStorage();
    const persistedTask = Object.freeze({
      taskId: 'retained-full-task-without-baseline',
      target: fixedResumeTarget,
      phase: 'applying-full' as const,
      actionId: 'persisted-full-action',
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
      confirmBoot: async () => ok(noAction),
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
      confirmBoot: async () => ok(noAction),
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
      confirmBoot: async () => ok(noAction),
      releasePrepared: async () => ok({released: true}),
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

    observedAction = Object.freeze({...actions[0]!, state: 'user-cancelled' as const, reason: 'ENDED_NOT_INSTALLED'});
    const cancelledAcceptance = await accept();
    expect(cancelledAcceptance.actorResults[0]?.result).toMatchObject({status: 'waiting-user'});
    const secondTask = selectTerminalUpdateTask(runtime.getState());
    expect(secondTask).toMatchObject({taskId: firstTask?.taskId, target: fixedTarget, phase: 'waiting-user'});
    expect(secondTask?.actionId).not.toBe(firstTask?.actionId);
    expect(preparedRefs).toEqual(['artifact:full-fixed', 'artifact:full-fixed']);
    expect(actions).toHaveLength(2);

    const pendingAcceptance = await accept();
    expect(pendingAcceptance.actorResults[0]?.result).toMatchObject({status: 'already-fixed'});
    expect(actions).toHaveLength(2);
    expect(preparedRefs).toHaveLength(2);
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
      readFacts: async () => ok(Object.freeze({...facts, actual})),
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
      confirmBoot: async () => ok(noAction),
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
      confirmBoot: async () => ok(noAction),
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
      confirmBoot: async () => ok(noAction),
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
      confirmBoot: async () => ok(noAction),
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
        confirmBoot: async () => ok(noAction),
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
        confirmBoot: async () => ok(noAction),
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
    expect(retry.actorResults[0]?.result).toMatchObject({status: 'failed', reason: 'FAILED_ARTIFACT_REENTRY_FORBIDDEN'});
    expect(prepareArtifact).not.toHaveBeenCalled();
    expect(nextRuntime.getState()['kernel.base.terminal-update.state']).toMatchObject({
      failedArtifactIds: [failedFullArtifact.publicationId],
    });
  });

  it('records a failed FULL action readback without marking an unknown action as failed', async () => {
    const fullArtifact = Object.freeze({...artifact, nativeBuildNumber: 2, publicationId: '8'.repeat(64)});
    const fullOnlyTarget: FixedUpdateTarget = Object.freeze({
      ...target,
      full: Object.freeze({sourceRef: 'artifact:full-readback', expectedSha256: fullArtifact.publicationId, artifact: fullArtifact}),
      hot: null,
    });
    let actionState: UpdateAction['state'] = 'accepted';
    const port: UpdatePort = {
      readFacts: async () => ok(facts),
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
      confirmBoot: async () => ok(noAction),
      releasePrepared: async () => ok({released: true}),
    };
    const runtime = createFixture({readTarget: async () => fullOnlyTarget, port});
    runtimes.push(runtime);
    await runtime.start();

    await runtime.dispatchCommand(
      acceptTerminalUpdateTargetCommand,
      {selectionContext: fullOnlyTarget.selectionContext},
      {requestId: createRequestId()},
    );
    expect(runtime.getState()['kernel.base.terminal-update.state']).toMatchObject({failedArtifactIds: []});

    actionState = 'failed';
    await runtime.dispatchCommand(
      reconcileTerminalUpdateCommand,
      {resumeFixedTask: false},
      {requestId: createRequestId()},
    );
    expect(runtime.getState()['kernel.base.terminal-update.state']).toMatchObject({
      failedArtifactIds: [fullArtifact.publicationId],
      recentStatus: {state: 'failed', reason: 'APK_INSTALL_FAILED'},
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
      confirmBoot: async () => ok(noAction),
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
          confirmBoot: async () => ok(noAction),
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
