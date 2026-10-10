import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createRequestId, type TimestampMs, type TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {
  createProcessMemoryStateStoragePort,
  unavailableUpdatePort,
  type PortResult,
  type LogEvent,
  type TerminalUpdateArtifact,
  type UpdateFacts,
  type UpdatePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {selectScreen} from '@catering-v2s/kernel-base-ui-state';
import {releaseRuntimeForTestAsync} from '@catering-v2s/kernel-base-runtime/testing';
import {selectSessionState, loginCommand, sessionSliceName} from '@catering-v2s/kernel-feature-sample-staff-session';
import {activateTerminalCommand} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  selectProjectBasicLoadReadiness,
  selectProjectOrganizationPath,
  selectProjectTerminalUpdateCandidate,
  selectProjectTerminalUpdateRules,
} from '@catering-v2s/kernel-feature-project-basic';
import {
  selectTerminalUpdateTask,
  type FixedUpdateTarget,
} from '@catering-v2s/kernel-base-terminal-update';
import {createPersistenceFieldKey} from '../../../../kernel/base/state/src/foundations/keyspace';
import {terminalUpdateRegistration} from '../../../../kernel/base/terminal-update/src/features/slices/terminalUpdate';
import {terminalDataClientActions} from '../../../../../terminal/kernel/base/terminal-data-client/src/features/slices/terminalDataClient';
import {createSampleAssembly, createSurfaceForDisplayIndex} from '../src';
import {startupReadyCommand} from '../src/application/module';
import {createReadyTerminalNetworkAdapter, createTestPlatformPorts, type TestPlatformPorts} from './support';
import {adminTestIds} from '@catering-v2s/ui-base-admin-shell';
import {
  resetNativeTestRefFactory,
  setNativeTestRefFactory,
  type NativeTestHostProps,
} from '../../../../../../tools/terminal-shared/rntl-native-test-host';
import {sampleMemberDeskTestId} from '../../../feature/sample-member-desk/src/foundations/sampleMemberDeskTestIds';

vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  const [{withNativeTestHosts: installHosts}, reactRuntime] = await Promise.all([
    import('../../../../../../tools/terminal-shared/rntl-native-test-host'),
    import('react'),
  ]);
  return installHosts(actual, reactRuntime);
});

vi.mock('expo-crypto', () => {
  let sequence = 0;
  return {
    getRandomBytesAsync: vi.fn(async (length: number) => new Uint8Array(length)),
    randomUUID: vi.fn(() => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`),
  };
});

const DEVICE_INFO = Object.freeze({
  deviceId: 'DEVICE-OWNER-STAGE-REGRESSION',
  systemName: 'TEST',
  systemVersion: '1',
  logicalProcessorCount: 8,
});

const stageServerSpaces: TransportServerConfig = Object.freeze({
  selectedSpace: 'workspace-stage-test',
  spaces: Object.freeze([
    Object.freeze({
      name: 'workspace-stage-test',
      servers: Object.freeze([
        Object.freeze({
          serverName: 'business',
          addresses: Object.freeze([
            Object.freeze({
              addressName: 'primary',
              baseUrl: 'https://stage-test.invalid/api/terminal/group-workspaces/workspace-stage-test',
              timeoutMs: 10_000,
            }),
          ]),
        }),
        Object.freeze({
          serverName: 'terminal-data-server',
          addresses: Object.freeze([
            Object.freeze({addressName: 'primary', baseUrl: 'ws://127.0.0.1:28180', timeoutMs: 10_000}),
          ]),
        }),
      ]),
    }),
  ]),
});

const dispatchOptions = () => ({requestId: createRequestId()});

const waitForPersistedSession = async (storage: ReturnType<typeof createProcessMemoryStateStoragePort>) => {
  await waitFor(async () => {
    const result = await storage.listKeys({});
    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') return;
    const sessionKeys = result.value.filter(key => key.includes(`/${encodeURIComponent(sessionSliceName)}/field/`));
    expect(sessionKeys).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/field/status'),
        expect.stringContaining('/field/operatorName'),
      ]),
    );
  });
};

type TestAssemblyInput = Omit<Parameters<typeof createSampleAssembly>[0], 'platformPorts' | 'nativeLoadingCapability'> &
  Readonly<{readonly platformPorts: TestPlatformPorts}>;

const createAssembly = (input: TestAssemblyInput) =>
  createSampleAssembly({
    ...input,
    nativeLoadingCapability: input.platformPorts.nativeLoadingCapability,
    transportNetworkAdapterFactory:
      input.transportNetworkAdapterFactory ??
      (readSnapshot =>
        createReadyTerminalNetworkAdapter(readSnapshot, async () =>
          Object.freeze({
            kind: 'response' as const,
            status: 200,
            body: Object.freeze({
              terminalRef: '00000000-0000-4000-8000-000000000005',
              storeRef: '00000000-0000-4000-8000-000000000006',
              groupWorkspaceKey: 'workspace-stage-test',
              bindingGeneration: 1,
            }),
          }),
        )),
  });

const createUpdateReadyNetworkAdapter = (
  readSnapshot: Parameters<typeof createReadyTerminalNetworkAdapter>[0],
  fixture: Readonly<{
    terminalRef: string;
    storeRef: string;
    projectRef: string;
    rule: unknown;
    downloadGrant: Readonly<{artifactRef: string; body: unknown}>;
  }>,
) => createReadyTerminalNetworkAdapter(readSnapshot, async request => {
  const path = request.pathAndQuery.split('?')[0];
  const operatingRules = Object.freeze({
    catalogManagementEnabled: false,
    externalCatalogSyncEnabled: false,
    openPlatformDeveloperCode: '',
    reservationEnabled: false,
    reservationDepositEnabled: false,
    queueCallEnabled: false,
    tableManagementEnabled: false,
    tableStatusEnabled: false,
    tableWaitCallEnabled: false,
    banquetOrderEnabled: false,
    pickupCallEnabled: false,
    receivableEnabled: false,
  });
  let body: unknown;
  if (path === '/activation') {
    body = Object.freeze({
      terminalRef: fixture.terminalRef,
      storeRef: fixture.storeRef,
      groupWorkspaceKey: 'workspace-stage-test',
      bindingGeneration: 1,
    });
  } else if (path === `/stores/${fixture.storeRef}/basic`) {
    body = Object.freeze({
      store: Object.freeze({
        id: fixture.storeRef,
        groupWorkspaceKey: 'workspace-stage-test',
        code: 'STAGE-TEST',
        name: 'Stage Test Store',
        project: Object.freeze({id: fixture.projectRef, code: 'PROJECT', name: 'Stage Test Project'}),
        brand: Object.freeze({id: '00000000-0000-4000-8000-000000000008', code: 'BRAND', name: 'Stage Test Brand'}),
        tenant: Object.freeze({id: '00000000-0000-4000-8000-000000000009', code: 'TENANT', name: 'Stage Test Tenant'}),
        status: 'ENABLED',
        extensionValues: Object.freeze({}),
        extensionRuleRevision: 0,
        revision: 1,
        createdAt: 1,
        updatedAt: 2,
        contractDerivedStatus: 'OPERATING',
        operatingRuleSwitches: operatingRules,
      }),
      operatingRules,
      storeUpdatedAtEpochMillis: 2,
      operatingRulesUpdatedAtEpochMillis: 2,
    });
  } else if (path === `/stores/${fixture.storeRef}/organization-path`) {
    body = Object.freeze({
      projectRef: fixture.projectRef,
      projectName: 'Stage Test Project',
      regionRef: '00000000-0000-4000-8000-000000000014',
      regionName: 'Stage Test Region',
      commercialGroupRef: '00000000-0000-4000-8000-000000000010',
      commercialGroupName: 'Stage Test Group',
      projectUpdatedAtEpochMillis: 3,
      regionUpdatedAtEpochMillis: 3,
      commercialGroupUpdatedAtEpochMillis: 3,
    });
  } else if (path === `/update-rules/projects/${fixture.projectRef}`) {
    body = Object.freeze({items: Object.freeze([fixture.rule]), collectionHash: 'a'.repeat(64), nextCursor: null});
  } else if (path === `/update-artifacts/${fixture.downloadGrant.artifactRef}/download-grant`) {
    body = fixture.downloadGrant.body;
  } else if (path === `/stores/${fixture.storeRef}/contracts`) {
    body = Object.freeze({items: Object.freeze([]), collectionUpdatedAtEpochMillis: 2});
  } else if (path === `/stores/${fixture.storeRef}/service-point-areas` || path === `/stores/${fixture.storeRef}/service-points`) {
    body = Object.freeze({items: Object.freeze([]), collectionUpdatedAtEpochMillis: 2});
  } else {
    return Object.freeze({kind: 'response' as const, status: 404, body: Object.freeze({})});
  }
  return Object.freeze({kind: 'response' as const, status: 200, body});
});

const makeReady = async (assembly: Awaited<ReturnType<typeof createAssembly>>) => {
  const result = await assembly.runtime.dispatchCommand(
    startupReadyCommand,
    {
      surfaceKey: 'PRIMARY',
      displayIndex: 0,
      readyPartKey: 'terminal.activation.lmp',
      contentFailure: null,
    },
    dispatchOptions(),
  );
  expect(result.status).toBe('completed');
};

const activate = async (assembly: Awaited<ReturnType<typeof createAssembly>>) => {
  const result = await assembly.runtime.dispatchCommand(
    activateTerminalCommand,
    {activationCode: '00123456'},
    dispatchOptions(),
  );
  expect(result.status).toBe('completed');
  expect(result.actorResults.map(item => item.result)).toContainEqual(
    expect.objectContaining({status: 'activated', terminalRef: '00000000-0000-4000-8000-000000000005'}),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetNativeTestRefFactory();
});

describe('sample-console integration owner-stage regressions', () => {
  it('confirms the current native boot only after a successful PRIMARY real-ready event', async () => {
    const terminalRef = '00000000-0000-4000-8000-000000000005';
    const storeRef = '00000000-0000-4000-8000-000000000006';
    const projectRef = '00000000-0000-4000-8000-000000000007';
    const fullApkSha256 = 'f'.repeat(64);
    const fullCertificateSha256 = '9'.repeat(64);
    const embedded = Object.freeze({
      schemaVersion: 1 as const,
      platform: 'android' as const,
      applicationId: 'com.example.terminal',
      nativeVersion: '1.0.0',
      nativeBuildNumber: 1,
      bundleVersion: '1.0.0',
      runtimeVersion: 'runtime-1',
      entry: 'index.android.bundle',
      files: Object.freeze([{path: 'index.android.bundle', sizeBytes: 10, sha256: 'a'.repeat(64)}]),
      publicationId: 'b'.repeat(64),
      apk: Object.freeze({path: 'terminal.apk', sha256: fullApkSha256, certificateSha256: fullCertificateSha256}),
    });
    const hot = Object.freeze({
      ...embedded,
      bundleVersion: '1.0.1',
      files: Object.freeze([{...embedded.files[0], sha256: 'c'.repeat(64)}]),
      publicationId: 'c'.repeat(64),
    });
    const facts: UpdateFacts = Object.freeze({
      actual: Object.freeze({
        applicationId: embedded.applicationId,
        nativeVersion: embedded.nativeVersion,
        nativeBuildNumber: embedded.nativeBuildNumber,
        runtimeVersion: embedded.runtimeVersion,
        bundleVersion: embedded.bundleVersion,
        publicationId: embedded.publicationId,
        apkSha256: fullApkSha256,
        bootId: 'native-current-boot-token',
        entryKind: 'embedded' as const,
      }),
      embedded,
      selectedPublicationId: embedded.publicationId,
      previousPublicationId: null,
      candidatePublicationId: null,
      installerActionId: null,
      installerState: 'none',
      selectionResetReason: null,
    });
    const fullSummary = Object.freeze({
      artifactRef: '00000000-0000-4000-8000-000000000011',
      kind: 'FULL',
      applicationId: embedded.applicationId,
      runtimeVersion: embedded.runtimeVersion,
      nativeBuildNumber: embedded.nativeBuildNumber,
      apkVersion: embedded.nativeVersion,
      jsVersion: embedded.bundleVersion,
      publicationId: embedded.publicationId,
      apkSha256: fullApkSha256,
      zipSha256: 'd'.repeat(64),
      byteSize: 128,
      createdAtEpochMillis: 1,
    });
    const hotSummary = Object.freeze({
      artifactRef: '00000000-0000-4000-8000-000000000012',
      kind: 'HOT',
      applicationId: embedded.applicationId,
      runtimeVersion: embedded.runtimeVersion,
      nativeBuildNumber: embedded.nativeBuildNumber,
      apkVersion: embedded.nativeVersion,
      jsVersion: hot.bundleVersion,
      publicationId: hot.publicationId,
      apkSha256: null,
      zipSha256: 'e'.repeat(64),
      byteSize: 128,
      createdAtEpochMillis: 2,
    });
    const rule = Object.freeze({
      ruleRef: '00000000-0000-4000-8000-000000000013',
      targetMode: 'STORE_REFS',
      storeRefs: Object.freeze([storeRef]),
      applicationId: embedded.applicationId,
      createdAtEpochMillis: 2,
      full: fullSummary,
      hot: hotSummary,
      nSeconds: 300,
      hotStrategy: 'IMMEDIATE',
      mSeconds: null,
      description: null,
    });
    const hotGrant = Object.freeze({
      relativeContentPath: 'artifacts/hot.zip',
      grant: 'g'.repeat(40),
      expiresAtEpochMillis: Date.now() + 60_000,
      artifactRef: hotSummary.artifactRef,
      zipSha256: hotSummary.zipSha256,
      byteSize: hotSummary.byteSize,
      artifact: Object.freeze({
        schemaVersion: 1 as const,
        platform: 'android' as const,
        applicationId: embedded.applicationId,
        nativeVersion: embedded.nativeVersion,
        nativeBuildNumber: embedded.nativeBuildNumber,
        bundleVersion: hot.bundleVersion,
        runtimeVersion: embedded.runtimeVersion,
        entry: hot.entry,
        files: hot.files,
        publicationId: hot.publicationId,
        minimumFull: Object.freeze({
          applicationId: embedded.applicationId,
          nativeBuildNumber: embedded.nativeBuildNumber,
          runtimeVersion: embedded.runtimeVersion,
          publicationId: embedded.publicationId,
          apkSha256: fullApkSha256,
        }),
        apk: null,
      }),
    });
    const confirmations: Array<Readonly<{bootToken: string; publicationId: string}>> = [];
    const events: LogEvent[] = [];
    let appliedActionId: string | null = null;
    const success = <T,>(value: T): PortResult<T> => ({status: 'succeeded', value, completedAt: 1 as TimestampMs});
    const updatePort: UpdatePort = {
      ...unavailableUpdatePort,
      readFacts: async () => success(facts),
      prepareArtifact: async input => success({preparedId: 'prepared-hot', artifact: input.artifact}),
      applyPrepared: async input => {
        appliedActionId = input.actionId;
        return success({
          actionId: input.actionId,
          taskId: input.taskId,
          state: 'accepted',
          reason: null,
          publicationId: hot.publicationId,
          bootId: null,
        });
      },
      readAction: async () => success(null),
      confirmBoot: async input => {
        confirmations.push(input);
        return success({confirmed: true as const});
      },
      releasePrepared: async () => success({released: true}),
    };
    const assembly = await createAssembly({
      platformPorts: createTestPlatformPorts({deviceInfo: DEVICE_INFO, updatePort, events}),
      persistenceKey: `sample-console-boot-confirm-${Date.now()}`,
      surfaceForm: 'mobile',
      serverSpaces: stageServerSpaces,
      transportNetworkAdapterFactory: readSnapshot => createUpdateReadyNetworkAdapter(readSnapshot, {
        terminalRef, storeRef, projectRef, rule,
        downloadGrant: Object.freeze({artifactRef: hotSummary.artifactRef, body: hotGrant}),
      }),
    });
    try {
      const failedReady = await assembly.runtime.dispatchCommand(
        startupReadyCommand,
        {
          surfaceKey: 'PRIMARY',
          displayIndex: 0,
          readyPartKey: null,
          contentFailure: 'render-error',
        },
        dispatchOptions(),
      );
      expect(failedReady.status).toBe('completed');
      expect(confirmations).toHaveLength(0);
      await activate(assembly);
      await waitFor(() => expect(selectProjectBasicLoadReadiness(assembly.runtime.getState()).status).toBe('flushed'));
      await waitFor(() => expect(selectProjectTerminalUpdateRules(assembly.runtime.getState()).status).toBe('ready'));
      const candidate = selectProjectTerminalUpdateCandidate(assembly.runtime.getState(), embedded.applicationId, storeRef);
      if (candidate === null)
        throw new Error(
          `PROJECT_UPDATE_CANDIDATE_MISSING bindingReady=${JSON.stringify(selectProjectBasicLoadReadiness(assembly.runtime.getState()))} path=${JSON.stringify(selectProjectOrganizationPath(assembly.runtime.getState()))} rules=${JSON.stringify(selectProjectTerminalUpdateRules(assembly.runtime.getState()))}`,
        );
      await waitFor(() => {
        if (appliedActionId === null)
          throw new Error(`PROJECT_CANDIDATE_NOT_EXECUTED candidate=${JSON.stringify(candidate)} events=${JSON.stringify(events)}`);
      });
      expect(selectProjectBasicLoadReadiness(assembly.runtime.getState()).status).toBe('flushed');
      expect(selectProjectOrganizationPath(assembly.runtime.getState())?.value.projectRef).toBe(projectRef);

      expect(confirmations).toHaveLength(0);

      const ready = await assembly.runtime.dispatchCommand(
        startupReadyCommand,
        {
          surfaceKey: 'PRIMARY',
          displayIndex: 0,
          readyPartKey: 'terminal.activation.lmp',
          contentFailure: null,
        },
        dispatchOptions(),
      );
      expect(ready.status).toBe('completed');
      expect(confirmations).toEqual([
        {
          timeoutMs: 60_000,
          bootToken: 'native-current-boot-token',
          publicationId: embedded.publicationId,
        },
      ]);
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('re-reads a pending FULL action at PRIMARY readiness before resuming HOT', async () => {
    const persistenceKey = `sample-console-full-action-resume-${Date.now()}`;
    const plainStorage = createProcessMemoryStateStoragePort();
    const protectedStorage = createProcessMemoryStateStoragePort();
    const applicationId = 'com.example.resume-test';
    const full: TerminalUpdateArtifact = Object.freeze({
      schemaVersion: 1,
      platform: 'android',
      applicationId,
      nativeVersion: '1.0.0',
      nativeBuildNumber: 2,
      bundleVersion: '1.0.0',
      runtimeVersion: 'runtime-resume-test',
      entry: 'assets/index.android.bundle',
      files: Object.freeze([{path: 'assets/index.android.bundle', sizeBytes: 10, sha256: 'a'.repeat(64)}]),
      publicationId: 'b'.repeat(64),
      apk: Object.freeze({path: 'sample.apk', sha256: 'c'.repeat(64), certificateSha256: 'd'.repeat(64)}),
    });
    const hot: TerminalUpdateArtifact = Object.freeze({
      ...full,
      bundleVersion: '1.0.1',
      files: Object.freeze([{path: 'assets/index.android.bundle', sizeBytes: 11, sha256: 'e'.repeat(64)}]),
      publicationId: 'f'.repeat(64),
      minimumFull: Object.freeze({
        applicationId,
        nativeBuildNumber: full.nativeBuildNumber,
        runtimeVersion: full.runtimeVersion,
        publicationId: full.publicationId,
        apkSha256: full.apk!.sha256,
      }),
    });
    const target: FixedUpdateTarget = Object.freeze({
      ruleRef: 'full-action-resume-rule',
      collectionHash: 'b'.repeat(64),
      createdAt: 1 as TimestampMs,
      applicationId,
      full: Object.freeze({sourceRef: 'fixture:full', expectedSha256: full.publicationId, artifact: full}),
      hot: Object.freeze({sourceRef: 'fixture:hot', expectedSha256: hot.publicationId, artifact: hot}),
      policy: Object.freeze({nSeconds: 300, hotStrategy: 'IMMEDIATE' as const, mSeconds: null}),
      strategy: Object.freeze({maxNetworkAttempts: 0, bootTimeoutMs: 30_000}),
      selectionContext: Object.freeze({selectedSpace: 'development', contextIdentity: 'full-action-resume', ruleRef: 'full-action-resume-rule'}),
    });
    const task = Object.freeze({
      taskId: 'full-action-resume-task',
      target,
      phase: 'applying-full' as const,
      actionId: 'full-action-resume-action',
      actionKind: 'full' as const,
      preparedId: 'full-prepared',
      bootId: null,
      failureCode: null,
      originalBundleVersion: '1.0.0',
    });
    const succeeded = <T,>(value: T): PortResult<T> => ({status: 'succeeded', value, completedAt: 1 as TimestampMs});
    const action = (state: 'accepted' | 'succeeded') =>
      Object.freeze({
        taskId: task.taskId,
        actionId: task.actionId!,
        state,
        reason: null,
        publicationId: full.publicationId,
        bootId: state === 'succeeded' ? 'full-boot-ready' : null,
      });
    let readActionCount = 0;
    const events: LogEvent[] = [];
    const prepareArtifact = vi.fn(async (input: Parameters<UpdatePort['prepareArtifact']>[0]) =>
      succeeded({preparedId: 'hot-prepared', artifact: input.artifact}),
    );
    const updatePort: UpdatePort = {
      ...unavailableUpdatePort,
      readFacts: async () =>
        succeeded(
          Object.freeze({
            actual: Object.freeze({
              applicationId,
              nativeVersion: full.nativeVersion,
              nativeBuildNumber: full.nativeBuildNumber,
              runtimeVersion: full.runtimeVersion,
              bundleVersion: full.bundleVersion,
              publicationId: full.publicationId,
              bootId: 'full-boot-ready',
              entryKind: 'embedded' as const,
            }),
            embedded: full,
            selectedPublicationId: full.publicationId,
            previousPublicationId: null,
            candidatePublicationId: null,
            installerActionId: null,
            installerState: 'none' as const,
            selectionResetReason: null,
          }),
        ),
      prepareArtifact,
      applyPrepared: async input =>
        succeeded(
          Object.freeze({
            taskId: input.taskId,
            actionId: input.actionId,
            state: 'accepted' as const,
            reason: null,
            publicationId: hot.publicationId,
            bootId: null,
          }),
        ),
      readAction: async () => succeeded(action(++readActionCount === 1 ? 'accepted' : 'succeeded')),
      confirmBoot: vi.fn<UpdatePort['confirmBoot']>(async input =>
        succeeded(Object.freeze({confirmed: true as const})),
      ),
      releasePrepared: async () => succeeded({released: true}),
    };
    const updateTaskKey = createPersistenceFieldKey({
      persistenceKey,
      sliceName: terminalUpdateRegistration.name,
      storageKey: 'currentTask',
    });
    expect((await plainStorage.write({key: updateTaskKey, value: JSON.stringify(task)})).status).toBe('succeeded');
    const assembly = await createAssembly({
      platformPorts: createTestPlatformPorts({
        plainStorage,
        protectedStorage,
        deviceInfo: DEVICE_INFO,
        updatePort,
        events,
      }),
      persistenceKey,
      surfaceForm: 'mobile',
      terminalUpdateSourceProvider: {readTarget: async () => target, resolveSourcePath: () => '/fixture/hot.zip'},
    });
    try {
      expect(readActionCount).toBe(1);
      const pendingAfterInstall = selectTerminalUpdateTask(assembly.runtime.getState());
      if (pendingAfterInstall?.phase !== 'applying-full' || pendingAfterInstall.actionId !== task.actionId)
        throw new Error(
          `PENDING_TASK_AFTER_INSTALL_MISMATCH phase=${pendingAfterInstall?.phase ?? 'NONE'} actionPending=${pendingAfterInstall?.actionId === null || pendingAfterInstall === null ? 0 : 1}`,
        );
      expect(pendingAfterInstall).toMatchObject({
        taskId: task.taskId,
        phase: 'applying-full',
        actionId: task.actionId,
      });
      expect(prepareArtifact).not.toHaveBeenCalled();
      await makeReady(assembly);
      await waitFor(() =>
        expect(events.some(event => event.event === 'terminal-update.primary-ready-received')).toBe(true),
      );
      await waitFor(() =>
        expect(events.some(event => event.event === 'terminal-update.primary-ready-continuation-result')).toBe(true),
      );
      const resumeResult = events.find(event => event.event === 'terminal-update.primary-ready-continuation-result');
      if (readActionCount !== 2)
        throw new Error(
          `PRIMARY_READY_RECONCILE_DID_NOT_READ_ACTION count=${readActionCount} result=${JSON.stringify(resumeResult?.data)}`,
        );
      await waitFor(() => expect(readActionCount).toBe(2));
      await waitFor(() => {
        if (prepareArtifact.mock.calls.length !== 1)
          throw new Error(
            `HOT_RESUME_NOT_PREPARED calls=${prepareArtifact.mock.calls.length} result=${JSON.stringify(resumeResult?.data)} task=${JSON.stringify(selectTerminalUpdateTask(assembly.runtime.getState()))} events=${JSON.stringify(events.map(event => ({event: event.event, data: event.data})))}`,
          );
      });
      expect(prepareArtifact).toHaveBeenCalledWith(expect.objectContaining({kind: 'hot', sourceRef: 'fixture:hot'}));
      expect(updatePort.confirmBoot).toHaveBeenCalledOnce();
      expect(updatePort.confirmBoot).toHaveBeenCalledWith({
        timeoutMs: 30_000,
        bootToken: 'full-boot-ready',
        publicationId: full.publicationId,
      });
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('restores an authenticated session without routing past the activation gate', async () => {
    const persistenceKey = `sample-console-stage-restore-${Date.now()}`;
    const plainStorage = createProcessMemoryStateStoragePort();
    const protectedStorage = createProcessMemoryStateStoragePort();
    const previous = await createAssembly({
      platformPorts: createTestPlatformPorts({plainStorage, protectedStorage, deviceInfo: DEVICE_INFO}),
      persistenceKey,
      surfaceForm: 'laptop',
    });
    try {
      await makeReady(previous);
      await activate(previous);
      const login = await previous.runtime.dispatchCommand(
        loginCommand,
        {operatorName: 'A001', passcode: '1111'},
        dispatchOptions(),
      );
      expect(login.status).toBe('completed');
      await waitForPersistedSession(plainStorage);
    } finally {
      await releaseRuntimeForTestAsync(previous.runtime);
    }

    const assembly = await createAssembly({
      platformPorts: createTestPlatformPorts({plainStorage, protectedStorage, deviceInfo: DEVICE_INFO}),
      persistenceKey,
      surfaceForm: 'laptop',
    });
    try {
      await makeReady(assembly);
      expect(selectSessionState(assembly.runtime.getState())).toEqual({status: 'authenticated', operatorName: 'A001'});
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.desk.member-list');
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('preserves the active member form when the client records an RTT sample', async () => {
    const assembly = await createAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2, deviceInfo: DEVICE_INFO}),
      persistenceKey: `sample-console-stage-rtt-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    let renderer: Awaited<ReturnType<typeof render>> | undefined;
    try {
      await makeReady(assembly);
      await activate(assembly);
      const login = await assembly.runtime.dispatchCommand(
        loginCommand,
        {operatorName: 'A001', passcode: '1111'},
        dispatchOptions(),
      );
      expect(login.status).toBe('completed');
      await waitFor(() =>
        expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.desk.member-list'),
      );
      setNativeTestRefFactory((hostName: string, props: NativeTestHostProps) => {
        if (props.testID === adminTestIds.launcher) {
          return {
            measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
              callback(0, 0, 1, 1),
          };
        }
        return hostName === 'View' ? {} : undefined;
      });
      renderer = await render(createSurfaceForDisplayIndex(assembly, 0));
      fireEvent.press(renderer.getByTestId(sampleMemberDeskTestId('sample.desk.member-list:empty-action')));
      await waitFor(() =>
        expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.desk.member-form'),
      );
      fireEvent.changeText(
        renderer.getByTestId(sampleMemberDeskTestId('sample.desk.member-form:name')),
        'Alice pending',
      );

      await act(async () => {
        assembly.runtime.getStore().dispatch(terminalDataClientActions.recordRtt({rttMs: 47, observedAt: Date.now()}));
      });

      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.desk.member-form');
      expect(renderer.getByTestId(sampleMemberDeskTestId('sample.desk.member-form:name')).props.value).toBe(
        'Alice pending',
      );
    } finally {
      renderer?.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });
});
