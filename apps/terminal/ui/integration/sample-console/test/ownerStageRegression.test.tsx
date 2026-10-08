import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createRequestId, type TimestampMs} from '@catering-v2s/kernel-base-contracts';
import {
  createProcessMemoryStateStoragePort,
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
  acceptTerminalUpdateTargetCommand,
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
    const target: FixedUpdateTarget = Object.freeze({
      ruleRef: 'startup-confirm-rule',
      createdAt: 1 as TimestampMs,
      applicationId: embedded.applicationId,
      full: null,
      hot: Object.freeze({sourceRef: 'fixture:hot', expectedSha256: hot.publicationId, artifact: hot}),
      strategy: Object.freeze({maxNetworkAttempts: 1, bootTimeoutMs: 30_000}),
      selectionContext: Object.freeze({selectedSpace: 'development', contextIdentity: 'startup-confirm-test'}),
    });
    const confirmations: Array<Readonly<{bootToken: string; publicationId: string}>> = [];
    let appliedActionId: string | null = null;
    let appliedTaskId: string | null = null;
    const success = <T,>(value: T): PortResult<T> => ({status: 'succeeded', value, completedAt: 1 as TimestampMs});
    const updatePort: UpdatePort = {
      readFacts: async () => success(facts),
      prepareArtifact: async () => success({preparedId: 'prepared-hot', artifact: hot}),
      applyPrepared: async input => {
        appliedActionId = input.actionId;
        appliedTaskId = input.taskId;
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
        return success({
          actionId: appliedActionId ?? '',
          taskId: appliedTaskId ?? '',
          state: 'accepted',
          reason: null,
          publicationId: input.publicationId,
          bootId: input.bootToken,
        });
      },
      releasePrepared: async () => success({released: true}),
    };
    const assembly = await createAssembly({
      platformPorts: createTestPlatformPorts({deviceInfo: DEVICE_INFO, updatePort}),
      persistenceKey: `sample-console-boot-confirm-${Date.now()}`,
      surfaceForm: 'mobile',
      terminalUpdateSourceProvider: {
        readTarget: async () => target,
        resolveSourcePath: () => '/run-owned/hot.zip',
      },
    });
    try {
      const accepted = await assembly.runtime.dispatchCommand(
        acceptTerminalUpdateTargetCommand,
        {selectionContext: target.selectionContext},
        dispatchOptions(),
      );
      expect(accepted.status).toBe('completed');
      expect(appliedActionId).not.toBeNull();

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
          timeoutMs: 30_000,
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
      createdAt: 1 as TimestampMs,
      applicationId,
      full: Object.freeze({sourceRef: 'fixture:full', expectedSha256: full.publicationId, artifact: full}),
      hot: Object.freeze({sourceRef: 'fixture:hot', expectedSha256: hot.publicationId, artifact: hot}),
      strategy: Object.freeze({maxNetworkAttempts: 0, bootTimeoutMs: 30_000}),
      selectionContext: Object.freeze({selectedSpace: 'development', contextIdentity: 'full-action-resume'}),
    });
    const task = Object.freeze({
      taskId: 'full-action-resume-task',
      target,
      phase: 'applying-full' as const,
      actionId: 'full-action-resume-action',
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
      confirmBoot: async input =>
        succeeded(
          Object.freeze({
            taskId: task.taskId,
            actionId: task.actionId!,
            state: 'accepted' as const,
            reason: null,
            publicationId: input.publicationId,
            bootId: input.bootToken,
          }),
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
        expect(events.some(event => event.event === 'terminal-update.primary-ready-resume-requested')).toBe(true),
      );
      await waitFor(() =>
        expect(events.some(event => event.event === 'terminal-update.primary-ready-resume-result')).toBe(true),
      );
      const resumeResult = events.find(event => event.event === 'terminal-update.primary-ready-resume-result');
      if (readActionCount !== 2)
        throw new Error(
          `PRIMARY_READY_RECONCILE_DID_NOT_READ_ACTION count=${readActionCount} result=${JSON.stringify(resumeResult?.data)}`,
        );
      await waitFor(() => expect(readActionCount).toBe(2));
      await waitFor(() => expect(prepareArtifact).toHaveBeenCalledOnce());
      expect(prepareArtifact).toHaveBeenCalledWith(expect.objectContaining({kind: 'hot', sourceRef: 'fixture:hot'}));
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
