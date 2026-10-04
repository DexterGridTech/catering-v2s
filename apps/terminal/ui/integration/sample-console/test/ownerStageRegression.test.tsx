import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {createProcessMemoryStateStoragePort} from '@catering-v2s/kernel-base-platform-ports';
import {selectScreen} from '@catering-v2s/kernel-base-ui-state';
import {releaseRuntimeForTestAsync} from '@catering-v2s/kernel-base-runtime/testing';
import {selectSessionState, loginCommand, sessionSliceName} from '@catering-v2s/kernel-feature-sample-staff-session';
import {activateTerminalCommand} from '@catering-v2s/kernel-base-terminal-data-client';
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

vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  const [{withNativeTestHosts: installHosts}, reactRuntime] = await Promise.all([
    import('../../../../../../tools/terminal-shared/rntl-native-test-host'),
    import('react'),
  ]);
  return installHosts(actual, reactRuntime);
});

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(async (length: number) => new Uint8Array(length)),
}));

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
      fireEvent.press(renderer.getByTestId('sample.desk.member-list:empty-action'));
      await waitFor(() =>
        expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.desk.member-form'),
      );
      fireEvent.changeText(renderer.getByTestId('sample.desk.member-form:name'), 'Alice pending');

      await act(async () => {
        assembly.runtime.getStore().dispatch(terminalDataClientActions.recordRtt({rttMs: 47, observedAt: Date.now()}));
      });

      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.desk.member-form');
      expect(renderer.getByTestId('sample.desk.member-form:name').props.value).toBe('Alice pending');
    } finally {
      renderer?.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });
});
