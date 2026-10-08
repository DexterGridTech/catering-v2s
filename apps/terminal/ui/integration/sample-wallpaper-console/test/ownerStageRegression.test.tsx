import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createRequestId, type TimestampMs} from '@catering-v2s/kernel-base-contracts';
import {
  createProcessMemoryStateStoragePort,
  type PortResult,
  type UpdateFacts,
  type UpdatePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {selectScreen} from '@catering-v2s/kernel-base-ui-state';
import {releaseRuntimeForTestAsync} from '@catering-v2s/kernel-base-runtime/testing';
import {selectSessionState, loginCommand, sessionSliceName} from '@catering-v2s/kernel-feature-sample-staff-session';
import {sampleStaffAuthTestIds} from '@catering-v2s/ui-feature-sample-staff-auth';
import {activateTerminalCommand} from '@catering-v2s/kernel-base-terminal-data-client';
import {acceptTerminalUpdateTargetCommand, type FixedUpdateTarget} from '@catering-v2s/kernel-base-terminal-update';
import {terminalDataClientActions} from '../../../../../terminal/kernel/base/terminal-data-client/src/features/slices/terminalDataClient';
import {createSurfaceForDisplayIndex, createSampleWallpaperConsoleAssembly} from '../src';
import {startupReadyCommand} from '../src/application/module';
import {createReadyTerminalNetworkAdapter, createTestPlatformPorts, type TestPlatformPorts} from './support';
import {adminTestIds} from '@catering-v2s/ui-base-admin-shell';
import {
  resetNativeTestRefFactory,
  setNativeTestRefFactory,
  type NativeTestHostProps,
} from '../../../../../../tools/terminal-shared/rntl-native-test-host';

vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  const [{withNativeTestHosts}, reactRuntime] = await Promise.all([
    import('../../../../../../tools/terminal-shared/rntl-native-test-host'),
    import('react'),
  ]);
  return withNativeTestHosts(actual, reactRuntime);
});

vi.mock('expo-crypto', () => {
  let sequence = 0;
  return {
    getRandomBytesAsync: vi.fn(async (length: number) => new Uint8Array(length)),
    randomUUID: vi.fn(() => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`),
  };
});

const DEVICE_INFO = Object.freeze({
  deviceId: 'DEVICE-WALLPAPER-STAGE-REGRESSION',
  systemName: 'TEST',
  systemVersion: '1',
  logicalProcessorCount: 8,
});

type TestAssemblyInput = Omit<
  Parameters<typeof createSampleWallpaperConsoleAssembly>[0],
  'platformPorts' | 'nativeLoadingCapability'
> &
  Readonly<{readonly platformPorts: TestPlatformPorts}>;

const createAssembly = (input: TestAssemblyInput) =>
  createSampleWallpaperConsoleAssembly({
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
              terminalRef: '00000000-0000-4000-8000-000000000011',
              storeRef: '00000000-0000-4000-8000-000000000012',
              groupWorkspaceKey: 'workspace-wallpaper-stage-test',
              bindingGeneration: 1,
            }),
          }),
        )),
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
    expect.objectContaining({status: 'activated', terminalRef: '00000000-0000-4000-8000-000000000011'}),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetNativeTestRefFactory();
});

describe('sample-wallpaper-console integration owner-stage regressions', () => {
  it('confirms the current native boot after wallpaper PRIMARY real-ready', async () => {
    const embedded = Object.freeze({
      schemaVersion: 1 as const,
      platform: 'android' as const,
      applicationId: 'com.example.wallpaper-terminal',
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
        bootId: 'wallpaper-native-boot-token',
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
      ruleRef: 'wallpaper-startup-confirm-rule',
      createdAt: 1 as TimestampMs,
      applicationId: embedded.applicationId,
      full: null,
      hot: Object.freeze({sourceRef: 'fixture:hot', expectedSha256: hot.publicationId, artifact: hot}),
      strategy: Object.freeze({maxNetworkAttempts: 1, bootTimeoutMs: 30_000}),
      selectionContext: Object.freeze({
        selectedSpace: 'development',
        contextIdentity: 'wallpaper-startup-confirm-test',
      }),
    });
    const confirmations: Array<Readonly<{timeoutMs: number; bootToken: string; publicationId: string}>> = [];
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
      persistenceKey: `sample-wallpaper-boot-confirm-${Date.now()}`,
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
          bootToken: 'wallpaper-native-boot-token',
          publicationId: embedded.publicationId,
        },
      ]);
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('restores an authenticated session without routing past the activation gate', async () => {
    const persistenceKey = `sample-wallpaper-stage-restore-${Date.now()}`;
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
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.wallpaper.picker');
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('preserves the pending login input when the client records an RTT sample', async () => {
    const assembly = await createAssembly({
      platformPorts: createTestPlatformPorts({deviceInfo: DEVICE_INFO}),
      persistenceKey: `sample-wallpaper-stage-rtt-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    let renderer: Awaited<ReturnType<typeof render>> | undefined;
    try {
      await makeReady(assembly);
      await activate(assembly);
      await waitFor(() =>
        expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.auth.login'),
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
      fireEvent.changeText(renderer.getByTestId(sampleStaffAuthTestIds.operatorName), 'A001 pending');

      await act(async () => {
        assembly.runtime.getStore().dispatch(terminalDataClientActions.recordRtt({rttMs: 47, observedAt: Date.now()}));
      });

      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.auth.login');
      expect(renderer.getByTestId(sampleStaffAuthTestIds.operatorName).props.value).toBe('A001 pending');
    } finally {
      renderer?.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });
});
