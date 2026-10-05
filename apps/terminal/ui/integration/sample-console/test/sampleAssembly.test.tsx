import {act, fireEvent, render, waitFor, type RenderResult} from '@testing-library/react-native';
import type {ReactElement} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {StyleSheet} from 'react-native';
import {
  advanceAnimatedTimingsForTests,
  setAnimatedTimingAutoFinishForTests,
} from '../../../../../../tools/terminal-shared/react-native-vitest-entry';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {
  createProcessMemoryStateStoragePort,
  type LogEvent,
  type StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {switchDisplayRoleCommand, switchInstanceModeCommand} from '@catering-v2s/kernel-base-display-context';
import {selectRequestExecutionView} from '@catering-v2s/kernel-base-runtime';
import {releaseRuntimeForTestAsync} from '@catering-v2s/kernel-base-runtime/testing';
import {
  clearLayersCommand,
  openLayerCommand,
  selectLayers,
  selectScreen,
  showScreenCommand,
  contentStateSliceName,
} from '@catering-v2s/kernel-base-ui-state';
import {refreshTopologyDisplayCommand, topologyActions} from '@catering-v2s/kernel-base-topology';
import {createUiCatalog, selectAvailableParts} from '@catering-v2s/kernel-base-ui-state';
import {
  confirmMemberCommand,
  rejectMemberCommand,
  selectMembers,
  selectPendingMember,
  submitMemberCommand,
} from '@catering-v2s/kernel-feature-sample-member-registry';
import {loginCommand} from '@catering-v2s/kernel-feature-sample-staff-session';
import {selectServerConfiguration} from '@catering-v2s/kernel-base-server-config';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import packageJson from '../package.json';
import {
  memberRegistrationAbandonedCommand,
  memberRegistrationRetryRequestedCommand,
  memberSubmissionWithdrawnCommand,
} from '../../../../ui/feature/sample-member-desk/src/features/commands/commands';
import {createSampleAssembly as createProductionSampleAssembly, createSurfaceForDisplayIndex} from '../src';
import {startupReadyCommand} from '../src/application/module';
import {createSampleDefinedParts} from '../src/assembly/assembly';
import {adminTestIds} from '@catering-v2s/ui-base-admin-shell';
import {sampleMemberDeskAssembly} from '@catering-v2s/ui-feature-sample-member-desk';
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth';
import {needToActivateTerminalCommand} from '@catering-v2s/ui-base-terminal-activation';
import {activateTerminalCommand} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  createReadyTerminalNetworkAdapter,
  createTestPlatformPorts,
  TestPeerChannel,
  type TestPlatformPorts,
} from './support';
import {
  resetNativeTestRefFactory,
  setNativeTestRefFactory,
  type NativeTestHostProps,
} from '../../../../../../tools/terminal-shared/rntl-native-test-host';
import {
  getRenderedByProps,
  getRenderedDescendantByProps,
  queryRenderedByProps,
  queryRenderedByType,
  queryRenderedTree,
  type RenderedTestInstance,
} from '../../../../../../tools/terminal-shared/rntl-rendered-tree';

vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  const [{withNativeTestHosts}, reactRuntime] = await Promise.all([
    import('../../../../../../tools/terminal-shared/rntl-native-test-host'),
    import('react'),
  ]);
  return withNativeTestHosts(actual, reactRuntime);
});

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(async (length: number) => new Uint8Array(length)),
}));

type TestSampleAssemblyInput = Omit<
  Parameters<typeof createProductionSampleAssembly>[0],
  'platformPorts' | 'nativeLoadingCapability'
> &
  Readonly<{
    readonly platformPorts: TestPlatformPorts;
  }>;

type TestRenderer = RenderResult;
type TestNode = Omit<RenderedTestInstance, 'props'> & Readonly<{readonly props: Record<string, any>}>;
const getNode = (renderer: TestRenderer, testID: string): TestNode =>
  getRenderedByProps(renderer, {testID}) as TestNode;
const queryNodes = (renderer: TestRenderer, testID: string): TestNode[] =>
  queryRenderedByProps(renderer, {testID}) as TestNode[];
const queryNodesByType = (renderer: TestRenderer, type: string): TestNode[] =>
  queryRenderedByType(renderer, type) as TestNode[];

const createSampleAssembly = (input: TestSampleAssemblyInput) =>
  createProductionSampleAssembly({
    ...input,
    transportNetworkAdapterFactory:
      input.transportNetworkAdapterFactory ??
      (readSnapshot =>
        createReadyTerminalNetworkAdapter(readSnapshot, async () =>
          Object.freeze({
            kind: 'response' as const,
            status: 200,
            body: Object.freeze({
              terminalRef: '00000000-0000-4000-8000-000000000001',
              storeRef: '00000000-0000-4000-8000-000000000002',
              groupWorkspaceKey: 'workspace-console-test',
              bindingGeneration: 1,
            }),
          }),
        )),
    nativeLoadingCapability: input.platformPorts.nativeLoadingCapability,
  });

const dispatchOptions = () => ({requestId: createRequestId()});

const signalPrimaryReady = async (assembly: Awaited<ReturnType<typeof createSampleAssembly>>) => {
  const result = await assembly.runtime.dispatchCommand(
    startupReadyCommand,
    {surfaceKey: 'PRIMARY', displayIndex: 0, readyPartKey: 'terminal.activation.lmp', contentFailure: null},
    dispatchOptions(),
  );
  expect(result.status).toBe('completed');
};

const activateForTest = async (assembly: Awaited<ReturnType<typeof createSampleAssembly>>) => {
  const result = await assembly.runtime.dispatchCommand(
    activateTerminalCommand,
    {activationCode: '00123456'},
    dispatchOptions(),
  );
  expect(result.status).toBe('completed');
  const activation = result.actorResults
    .map(item => item.result)
    .find(value => typeof value === 'object' && value !== null && 'status' in value && value.status === 'activated');
  if (activation === undefined)
    throw new Error(`TERMINAL_TEST_ACTIVATION_RESULT ${JSON.stringify(result.actorResults)}`);
  expect(activation).toMatchObject({status: 'activated', terminalRef: '00000000-0000-4000-8000-000000000001'});
  await new Promise(resolve => setTimeout(resolve, 0));
};

const readyAndActivateForTest = async (assembly: Awaited<ReturnType<typeof createSampleAssembly>>) => {
  await signalPrimaryReady(assembly);
  await activateForTest(assembly);
};

const loginForTest = async (assembly: Awaited<ReturnType<typeof createSampleAssembly>>) => {
  const result = await assembly.runtime.dispatchCommand(
    loginCommand,
    {operatorName: 'A001', passcode: '1111'},
    dispatchOptions(),
  );
  expect(result.status).toBe('completed');
  await new Promise(resolve => setTimeout(resolve, 0));
};

const ACTIVATION_DEVICE_INFO = Object.freeze({
  deviceId: 'DEVICE-SAMPLE-CONSOLE-TEST',
  systemName: 'TEST',
  systemVersion: '1',
  logicalProcessorCount: 8,
});

const LANDSCAPE_PRIMARY_FRAME = {width: 1280, height: 720} as const;
const LANDSCAPE_SECONDARY_FRAME = {width: 1280, height: 720} as const;
const PORTRAIT_PRIMARY_FRAME = {width: 360, height: 640} as const;
const LAUNCHER_WINDOW_ORIGIN = {x: 100, y: 200} as const;

type HostMeasurementSnapshot = Readonly<{
  readonly stableHostLogicalSize: Readonly<{readonly width: number; readonly height: number}>;
  readonly isHostPrimaryDisplay: boolean;
}>;

type HostSourceHandle = Readonly<{
  readonly getSnapshot: () => HostMeasurementSnapshot;
  readonly subscribe: (listener: (snapshot: HostMeasurementSnapshot) => void) => () => void;
  readonly emit: (snapshot: HostMeasurementSnapshot) => void;
}>;

const createHostSource = (
  isHostPrimaryDisplay: boolean,
  stableHostLogicalSize: Readonly<{readonly width: number; readonly height: number}> = LANDSCAPE_PRIMARY_FRAME,
): HostSourceHandle => {
  let currentSnapshot: HostMeasurementSnapshot = Object.freeze({
    stableHostLogicalSize: Object.freeze({
      width: stableHostLogicalSize.width,
      height: stableHostLogicalSize.height,
    }),
    isHostPrimaryDisplay,
  });
  const listeners = new Set<(snapshot: HostMeasurementSnapshot) => void>();
  return Object.freeze({
    getSnapshot: () => currentSnapshot,
    subscribe: (listener: (snapshot: HostMeasurementSnapshot) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: (snapshot: HostMeasurementSnapshot) => {
      currentSnapshot = Object.freeze({
        stableHostLogicalSize: Object.freeze({
          width: snapshot.stableHostLogicalSize.width,
          height: snapshot.stableHostLogicalSize.height,
        }),
        isHostPrimaryDisplay: snapshot.isHostPrimaryDisplay,
      });
      for (const listener of listeners) listener(currentSnapshot);
    },
  });
};

const createRecordingStorage = () => {
  const delegate = createProcessMemoryStateStoragePort();
  const writes: string[] = [];
  const storage: StateStoragePort = {
    ...delegate,
    write: async input => {
      writes.push(input.value);
      return delegate.write(input);
    },
    writeMany: async input => {
      writes.push(...input.entries.map(entry => entry.value));
      return delegate.writeMany(input);
    },
  };
  return Object.freeze({storage, writes});
};

const waitForRecordedValues = async (
  recordings: readonly Readonly<{readonly writes: readonly string[]}>[],
  expectedValues: readonly string[],
) => {
  await waitFor(() => {
    const persisted = recordings.flatMap(recording => recording.writes).join('\n');
    for (const expected of expectedValues) expect(persisted).toContain(expected);
  });
};

const mount = async (
  element: ReactElement,
  frameLayout: Readonly<{readonly width: number; readonly height: number}> = LANDSCAPE_SECONDARY_FRAME,
  measureSurface = true,
  launcherMeasuredSize: Readonly<{readonly width: number; readonly height: number}> = {width: 0, height: 0},
  inputMeasuredY = 120,
  launcherWindowOrigin: () => Readonly<{readonly x: number; readonly y: number}> = () => LAUNCHER_WINDOW_ORIGIN,
  launcherMeasurement?: () => Readonly<{
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }>,
): Promise<TestRenderer> => {
  setNativeTestRefFactory((hostName: string, props: NativeTestHostProps) => {
    const testID = props.testID;
    if (testID === adminTestIds.launcher) {
      return {
        measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => {
          const measurement = launcherMeasurement?.() ?? {
            ...launcherWindowOrigin(),
            width: launcherMeasuredSize.width,
            height: launcherMeasuredSize.height,
          };
          callback(measurement.x, measurement.y, measurement.width, measurement.height);
        },
      };
    }
    if (typeof testID === 'string' && testID.endsWith(':scroll')) {
      const contentNode = {};
      return {
        getInnerViewRef: () => contentNode,
        measureLayout: (
          _relativeTo: unknown,
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => {
          callback(0, 0, frameLayout.width, Math.max(1, frameLayout.height - 20));
        },
        scrollTo: () => undefined,
      };
    }
    if (typeof testID === 'string') {
      return {
        measureLayout: (
          _relativeTo: unknown,
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => {
          callback(0, inputMeasuredY, Math.min(320, frameLayout.width), 40);
        },
        focus: () => undefined,
        blur: () => undefined,
      };
    }
  });
  const renderer = await render(element);
  const frames = queryNodes(renderer, 'ui.base.input:surface-frame');
  if (measureSurface) {
    await act(async () => {
      for (const frame of frames) {
        (frame.props.onLayout as (event: unknown) => void)({nativeEvent: {layout: frameLayout}});
      }
    });
  }
  const launchers = queryNodes(renderer, adminTestIds.launcher);
  await act(async () => {
    for (const launcher of launchers) {
      (launcher.props.onLayout as (event: unknown) => void)({
        nativeEvent: {layout: {x: 0, y: 0, width: frameLayout.width, height: frameLayout.height}},
      });
    }
  });
  const scrollAreas = queryRenderedTree(
    renderer,
    scroll =>
      typeof scroll.props.testID === 'string' &&
      scroll.props.testID.endsWith(':scroll') &&
      typeof scroll.props.onLayout === 'function' &&
      typeof scroll.props.onContentSizeChange === 'function' &&
      typeof scroll.props.onScroll === 'function',
  );
  await act(async () => {
    for (const scroll of scrollAreas) {
      (scroll.props.onLayout as (event: unknown) => void)({
        nativeEvent: {
          layout: {
            x: 0,
            y: 0,
            width: frameLayout.width,
            height: Math.max(1, frameLayout.height - 20),
          },
        },
      });
      (scroll.props.onContentSizeChange as (width: number, height: number) => void)(frameLayout.width, 1200);
      (scroll.props.onScroll as (event: unknown) => void)({nativeEvent: {contentOffset: {y: 0}}});
    }
  });
  return renderer;
};

const reportPrimaryReadyLayout = async (
  renderer: TestRenderer,
  frame: Readonly<{readonly width: number; readonly height: number}>,
): Promise<void> => {
  const boundaries = queryNodes(renderer, 'ui-base-render:screen-ready-boundary');
  await act(async () => {
    for (const boundary of boundaries) {
      (boundary.props.onLayout as (event: unknown) => void)({nativeEvent: {layout: frame}});
    }
  });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

const openTestPeerAsSlave = async (peer: TestPeerChannel): Promise<void> => {
  peer.emit({type: 'open', connectionId: 'test-peer-connection'});
  peer.emit({
    type: 'message',
    connectionId: 'test-peer-connection',
    raw: JSON.stringify({
      type: 'hello',
      protocolVersion: 1,
      moduleName: 'ui.integration.sample-console',
      wireId: 'test-peer-hello',
      nodeId: 'test-peer-slave',
      displayName: '测试副机',
      instanceMode: 'SLAVE',
      displayRole: 'VICE',
    }),
  });
  await new Promise(resolve => setTimeout(resolve, 0));
};

const stateFullSliceNames = (peer: TestPeerChannel): string[] =>
  peer.sentFrames
    .map(raw => JSON.parse(raw) as Readonly<{readonly type?: string; readonly sliceName?: string}>)
    .filter(frame => frame.type === 'state-full-chunk' && frame.sliceName !== undefined)
    .map(frame => frame.sliceName!);

const press = async (renderer: TestRenderer, testID: string): Promise<void> => {
  await fireEvent.press(renderer.getByTestId(testID));
};

const waitForAdminContent = async (renderer: TestRenderer): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (queryNodes(renderer, adminTestIds.shell).length > 0 && queryNodes(renderer, adminTestIds.panel.body).length > 0)
      return;
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  }
  throw new Error('authenticated admin shell did not become available');
};

const selectMobileAdminSection = async (renderer: TestRenderer, partKey: string): Promise<void> => {
  await act(async () => {
    await press(renderer, 'terminal.admin:navigation:trigger');
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  await act(async () => {
    await press(renderer, `terminal.admin:navigation:option:${partKey}`);
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

const pressLauncher = (
  renderer: TestRenderer,
  logicalX = 1,
  logicalY = 1,
  stopPropagation?: () => void,
  windowOrigin: Readonly<{readonly x: number; readonly y: number}> = LAUNCHER_WINDOW_ORIGIN,
): void => {
  const launcher = getNode(renderer, adminTestIds.launcher) as TestNode &
    Readonly<{
      readonly props: Readonly<{
        readonly onTouchEnd: (
          event: Readonly<{
            readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>;
            readonly stopPropagation?: () => void;
          }>,
        ) => void;
      }>;
    }>;
  const canvas = getNode(renderer, 'ui-base-render:surface-host-canvas') as TestNode &
    Readonly<{
      readonly props: Readonly<{readonly style: unknown}>;
    }>;
  const transform =
    (
      StyleSheet.flatten(canvas.props.style) as Readonly<{
        readonly transform?: readonly Readonly<Record<string, number>>[];
      }>
    ).transform ?? [];
  const scaleX = transform.find(item => item.scaleX !== undefined)?.scaleX ?? 1;
  const scaleY = transform.find(item => item.scaleY !== undefined)?.scaleY ?? 1;
  const pageX = windowOrigin.x + logicalX * scaleX;
  const pageY = windowOrigin.y + logicalY * scaleY;
  if (!Number.isFinite(pageX) || !Number.isFinite(pageY)) throw new Error('Unable to construct launcher test point');
  launcher.props.onTouchEnd({
    nativeEvent: {
      pageX,
      pageY,
    },
    stopPropagation,
  });
};

const tapLauncher = async (renderer: TestRenderer, count = 5, logicalX = 1, logicalY = 1): Promise<void> => {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      pressLauncher(renderer, logicalX, logicalY);
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
};

const tapWebLauncher = async (renderer: TestRenderer, count = 5): Promise<void> => {
  const launcher = getNode(renderer, adminTestIds.launcher) as TestNode &
    Readonly<{
      readonly props: Readonly<{
        readonly onClick?: (event: unknown) => unknown;
        readonly onTouchEnd?: (event: unknown) => unknown;
      }>;
    }>;
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      const webEvent = {
        nativeEvent: {
          clientX: LAUNCHER_WINDOW_ORIGIN.x + 1,
          clientY: LAUNCHER_WINDOW_ORIGIN.y + 1,
        },
      };
      // Model the two browser event notifications that a single physical tap
      // could produce. The production Web branch must bind only one of them.
      launcher.props.onTouchEnd?.({
        nativeEvent: {
          pageX: LAUNCHER_WINDOW_ORIGIN.x + 1,
          pageY: LAUNCHER_WINDOW_ORIGIN.y + 1,
        },
      });
      launcher.props.onClick?.(webEvent);
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
};

const authenticateAdmin = async (renderer: TestRenderer): Promise<void> => {
  await finishKeyboardPresentation(renderer);
  const displayedPassword = renderer.queryByText(/^（\d{6}）$/);
  const displayedCode = String(displayedPassword?.props.children ?? '').match(/\d{6}/)?.[0] ?? '123456';
  for (const digit of displayedCode) {
    await act(async () => {
      await press(renderer, `ui.base.input:virtual-keyboard:text-${digit}`);
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
  await act(async () => {
    await press(renderer, adminTestIds.verify);
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  await waitForAdminContent(renderer);
};

const measureKeyboardLayers = async (renderer: TestRenderer): Promise<void> => {
  const measurementLayers = queryNodes(renderer, 'ui.base.input:keyboard-layer-position:measure');
  for (const layer of measurementLayers) {
    const backdrop = getRenderedDescendantByProps(layer, {
      testID: 'ui.base.input:virtual-keyboard:backdrop',
    }) as TestNode;
    const layout = StyleSheet.flatten(backdrop.props.style) as Readonly<{
      readonly width: number;
      readonly height: number;
    }>;
    const onLayout = layer.props.onLayout;
    if (typeof onLayout !== 'function') throw new Error('Keyboard measurement layer is missing its onLayout callback');
    await act(async () => {
      (onLayout as (event: unknown) => void)({nativeEvent: {layout}});
    });
  }
};

const finishKeyboardPresentation = async (renderer: TestRenderer): Promise<void> => {
  setAnimatedTimingAutoFinishForTests(true);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (queryNodes(renderer, 'ui.base.input:keyboard-layer-position:measure').length === 0) break;
    await measureKeyboardLayers(renderer);
    await act(async () => {
      advanceAnimatedTimingsForTests(1);
    });
  }
};

const findTextInput = (renderer: TestRenderer, testID: string): TestNode => {
  const input = queryNodesByType(renderer, 'TextInput').find(node => node.props.testID === testID);
  if (input === undefined) throw new Error(`Missing TextInput ${testID}`);
  return input;
};

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(Date.now());
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetNativeTestRefFactory();
});

describe('sample-console real assembly', () => {
  it('renders only the explicit activation success result after the client owner activates', async () => {
    const requests: Array<Readonly<{pathAndQuery: string; activationCode: string | undefined}>> = [];
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({
        deviceInfo: {
          deviceId: 'DEVICE-ACTIVATION-001',
          systemName: 'Android',
          systemVersion: '57',
          logicalProcessorCount: 8,
        },
      }),
      persistenceKey: `sample-console-activation-success-${Date.now()}`,
      surfaceForm: 'laptop',
      transportNetworkAdapterFactory: readSnapshot =>
        Object.freeze({
          readSnapshot,
          connect: async () => {
            throw new Error('WEBSOCKET_NOT_EXPECTED_IN_ACTIVATION_SCREEN_TEST');
          },
          sendHttp: async input => {
            requests.push(
              Object.freeze({
                pathAndQuery: input.pathAndQuery,
                activationCode: (input.body as {activationCode?: string} | undefined)?.activationCode,
              }),
            );
            return Object.freeze({
              kind: 'response' as const,
              status: 200,
              body: Object.freeze({
                terminalRef: '00000000-0000-4000-8000-000000000003',
                storeRef: '00000000-0000-4000-8000-000000000004',
                groupWorkspaceKey: 'workspace-1',
                bindingGeneration: 1,
              }),
            });
          },
        }),
    });
    let renderer: TestRenderer | undefined;
    try {
      const activation = await assembly.runtime.dispatchCommand(
        activateTerminalCommand,
        {activationCode: '00123456'},
        {requestId: createRequestId()},
      );
      expect(activation.status).toBe('completed');
      expect(activation.actorResults.map(item => item.result)).toContainEqual(
        expect.objectContaining({status: 'activated', terminalRef: '00000000-0000-4000-8000-000000000003'}),
      );
      expect(requests).toEqual([{pathAndQuery: '/activation', activationCode: '00123456'}]);
      const routeContext = {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'} as const;
      const intent = await assembly.runtime.dispatchCommand(
        needToActivateTerminalCommand,
        {},
        {requestId: createRequestId(), routeContext},
      );
      expect(intent.status).toBe('completed');
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'terminal.activation.lmp',
      });

      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME);
      expect(getNode(renderer, 'terminal.activation.result').children.join('')).toBe('设备已激活成功');
      expect(queryNodes(renderer, 'terminal.activation.submit')).toHaveLength(0);
      expect(queryNodes(renderer, 'terminal.activation.continue')).toHaveLength(0);
    } finally {
      if (renderer !== undefined) await renderer.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('routes activation intent to MMP, LMP, single-host LMS, dual-host LMS, or LSP from route ownership', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-activation-route-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    const routes = [
      {
        routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'} as const,
        expected: 'terminal.activation.lmp',
      },
      {
        routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'SECONDARY'} as const,
        expected: 'terminal.activation.lms',
      },
      {
        routeContext: {workspace: 'MAIN', instanceMode: 'SLAVE', displayMode: 'SECONDARY'} as const,
        expected: 'terminal.activation.lms',
      },
      {
        routeContext: {workspace: 'BRANCH', instanceMode: 'SLAVE', displayMode: 'PRIMARY'} as const,
        expected: 'terminal.activation.lsp',
      },
    ];
    try {
      for (const [index, item] of routes.entries()) {
        if (index === 2) {
          const slaveMode = await assembly.runtime.dispatchCommand(
            switchInstanceModeCommand,
            {instanceMode: 'SLAVE'},
            {
              requestId: createRequestId(),
              routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
            },
          );
          expect(slaveMode.status).toBe('completed');
          const viceRole = await assembly.runtime.dispatchCommand(
            switchDisplayRoleCommand,
            {displayRole: 'VICE'},
            {
              requestId: createRequestId(),
              routeContext: {workspace: 'BRANCH', instanceMode: 'SLAVE', displayMode: 'PRIMARY'},
            },
          );
          expect(viceRole.status).toBe('completed');
        } else if (index === 3) {
          const chiefRole = await assembly.runtime.dispatchCommand(
            switchDisplayRoleCommand,
            {displayRole: 'CHIEF'},
            {
              requestId: createRequestId(),
              routeContext: {workspace: 'MAIN', instanceMode: 'SLAVE', displayMode: 'SECONDARY'},
            },
          );
          expect(chiefRole.status).toBe('completed');
        }
        const result = await assembly.runtime.dispatchCommand(
          needToActivateTerminalCommand,
          {},
          {requestId: createRequestId(), routeContext: item.routeContext},
        );
        expect(result.status, `route ${index}`).toBe('completed');
        expect(selectScreen(assembly.runtime.getState(), item.routeContext.displayMode, 'main')?.partKey).toBe(
          item.expected,
        );
      }
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
    const mobileAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-activation-mobile-route-${Date.now()}`,
      surfaceForm: 'mobile',
    });
    try {
      const result = await mobileAssembly.runtime.dispatchCommand(
        needToActivateTerminalCommand,
        {},
        {
          requestId: createRequestId(),
          routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
        },
      );
      expect(result.status).toBe('completed');
      expect(selectScreen(mobileAssembly.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe(
        'terminal.activation.mmp',
      );
    } finally {
      await releaseRuntimeForTestAsync(mobileAssembly.runtime);
    }
  });

  it('restores an activation screen removed from an already-routed secondary placement', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2, deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample-console-secondary-activation-restored-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    try {
      await signalPrimaryReady(assembly);
      expect(selectScreen(assembly.runtime.getState(), 'SECONDARY', 'main')?.partKey).toBe('terminal.activation.lms');

      assembly.runtime.getStore().dispatch({
        type: `${contentStateSliceName('MAIN')}/removeScreen`,
        payload: {displayMode: 'SECONDARY', containerKey: 'main'},
      });

      await waitFor(() => {
        expect(selectScreen(assembly.runtime.getState(), 'SECONDARY', 'main')?.partKey).toBe('terminal.activation.lms');
      });
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('uses only this integration package serverSpaces defaults and accepts an explicit entry fixture', async () => {
    const integrationDefaults = packageJson.serverSpaces as TransportServerConfig;
    const developmentSpace = integrationDefaults.spaces.find(space => space.name === integrationDefaults.selectedSpace);
    expect(developmentSpace?.servers.map(server => server.serverName).sort()).toEqual([
      'business',
      'terminal-data-server',
    ]);
    expect(developmentSpace?.servers.find(server => server.serverName === 'terminal-data-server')?.addresses).toEqual([
      {addressName: 'haproxy-entry-one', baseUrl: 'ws://127.0.0.1:28180', timeoutMs: 10000},
      {addressName: 'haproxy-entry-two', baseUrl: 'ws://127.0.0.1:28181', timeoutMs: 10000},
    ]);
    const defaultsAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-server-defaults-${Date.now()}`,
      surfaceForm: 'mobile',
    });
    const fixture: TransportServerConfig = {
      selectedSpace: 'sample-console-fixture',
      spaces: [
        {
          name: 'sample-console-fixture',
          servers: [
            {
              serverName: 'business',
              addresses: [{addressName: 'fixture', baseUrl: 'https://sample-console.invalid/api', timeoutMs: 3210}],
            },
          ],
        },
      ],
    };
    let fixtureAssembly: Awaited<ReturnType<typeof createSampleAssembly>> | undefined;
    try {
      fixtureAssembly = await createSampleAssembly({
        platformPorts: createTestPlatformPorts(),
        persistenceKey: `sample-console-server-fixture-${Date.now()}`,
        surfaceForm: 'mobile',
        serverSpaces: fixture,
      });
      const defaultState = defaultsAssembly.runtime.getState();
      const fixtureState = fixtureAssembly.runtime.getState();
      expect(defaultState['kernel.base.server-config.configuration']).toMatchObject({
        selectedSpace: integrationDefaults.selectedSpace,
      });
      expect(selectServerConfiguration(defaultState, integrationDefaults).spaces.map(space => space.name)).toEqual(
        integrationDefaults.spaces.map(space => space.name),
      );
      expect(fixtureState['kernel.base.server-config.configuration']).toMatchObject({
        selectedSpace: fixture.selectedSpace,
      });
      expect(selectServerConfiguration(fixtureState, fixture).spaces).toMatchObject([
        {
          name: 'sample-console-fixture',
          servers: [{serverName: 'business', addresses: fixture.spaces[0]!.servers[0]!.addresses}],
        },
      ]);
    } finally {
      await releaseRuntimeForTestAsync(defaultsAssembly.runtime);
      if (fixtureAssembly !== undefined) await releaseRuntimeForTestAsync(fixtureAssembly.runtime);
    }
  });

  it('waits for PRIMARY surface measurement when resolved layout arrives first', async () => {
    const events: LogEvent[] = [];
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({events}),
      persistenceKey: `sample-console-ready-measurement-order-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    });
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME, false);
      const boundary = getNode(renderer, 'ui-base-render:screen-ready-boundary');
      await act(async () => {
        (boundary.props.onLayout as (event: unknown) => void)({
          nativeEvent: {layout: PORTRAIT_PRIMARY_FRAME},
        });
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(events.filter(event => event.event === 'startup.complete')).toHaveLength(0);
      expect(events.some(event => event.event === 'startup.ready-failed')).toBe(false);

      const frame = getNode(renderer, 'ui.base.input:surface-frame');
      await act(async () => {
        (frame.props.onLayout as (event: unknown) => void)({
          nativeEvent: {layout: PORTRAIT_PRIMARY_FRAME},
        });
      });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(events.filter(event => event.event === 'startup.complete')).toHaveLength(1);
      expect(events.some(event => event.event === 'startup.ready-failed')).toBe(false);
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('records a visible content failure in the shared startup completion facts', async () => {
    const events: LogEvent[] = [];
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({events}),
      persistenceKey: `sample-console-startup-content-failure-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    });
    let renderer: TestRenderer | undefined;
    try {
      const selection = await assembly.runtime.dispatchCommand(
        showScreenCommand,
        {
          displayMode: 'PRIMARY',
          containerKey: 'main',
          partKey: 'sample.console.missing-part',
        },
        {
          requestId: createRequestId(),
          routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
        },
      );
      expect(selection.status).toBe('completed');
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME, true);
      await reportPrimaryReadyLayout(renderer, PORTRAIT_PRIMARY_FRAME);
      const complete = events.find(event => event.event === 'startup.complete');
      expect(complete?.data).toMatchObject({
        primaryReadyPartKey: null,
        primaryContentFailure: 'missing-catalog-entry',
      });
      expect(events.some(event => event.event === 'startup.ready-failed')).toBe(false);
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('retries PRIMARY startup readiness after prerequisites reject completion', async () => {
    const events: LogEvent[] = [];
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({events, failStartupReadyCount: 1}),
      persistenceKey: `sample-console-startup-retry-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    });
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME, true);
      await reportPrimaryReadyLayout(renderer, PORTRAIT_PRIMARY_FRAME);
      expect(events.filter(event => event.event === 'startup.complete')).toHaveLength(0);
      expect(events.filter(event => event.event === 'startup.ready-dispatch-failed')).toHaveLength(1);
      expect(events.find(event => event.event === 'startup.ready-dispatch-failed')?.data?.errorName).toBe('Error');

      await renderer!.unmount();
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME);
      await reportPrimaryReadyLayout(renderer, PORTRAIT_PRIMARY_FRAME);
      expect(events.filter(event => event.event === 'startup.ready-dispatch-failed')).toHaveLength(1);
      expect(events.filter(event => event.event === 'startup.complete')).toHaveLength(1);
      expect(events.filter(event => event.event === 'startup.ready-dispatch-start')).toHaveLength(2);
      expect(
        events.filter(event => event.event === 'startup.ready-dispatch-result').map(event => event.data?.status),
      ).toEqual(['partial-failed', 'completed']);
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('declares the host staff qualification and confirmed member projections for a paired slave', async () => {
    const peer = new TestPeerChannel();
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1}),
      persistenceKey: `sample-console-sync-slices-${Date.now()}`,
      surfaceForm: 'laptop',
      topologyPeerChannel: peer,
    });
    try {
      await openTestPeerAsSlave(peer);
      const sliceNames = stateFullSliceNames(peer);
      expect(sliceNames).toContain('kernel.feature.sample-member-registry.members');
      expect(sliceNames).toContain('kernel.feature.sample-staff-session.session');
      expect(sliceNames).not.toContain('kernel.feature.sample-wallpaper.selection');
    } finally {
      await peer.dispose();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('opens admin console from the transformed mobile preview hit area', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-mobile-launcher-preview-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    });
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME, true, {
        width: PORTRAIT_PRIMARY_FRAME.width * 3,
        height: PORTRAIT_PRIMARY_FRAME.height * 3,
      });
      await tapLauncher(renderer, 5, 120, 120);
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY')).toEqual(
        expect.arrayContaining([expect.objectContaining({layerId: 'admin.console.layer'})]),
      );
      expect(getNode(renderer, adminTestIds.login)).toBeDefined();
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('selects the form-specific login renderer at the real integration surface', async () => {
    const assemblies = await Promise.all(
      (['laptop', 'mobile'] as const).map(surfaceForm =>
        createSampleAssembly({
          platformPorts: createTestPlatformPorts({
            displayCount: surfaceForm === 'laptop' ? 2 : 1,
            deviceInfo: ACTIVATION_DEVICE_INFO,
          }),
          persistenceKey: `sample-console-form-renderer-${surfaceForm}-${Date.now()}`,
          surfaceForm,
          surfaceHostSourcesByDisplayIndex: {
            0: createHostSource(true, surfaceForm === 'laptop' ? LANDSCAPE_PRIMARY_FRAME : PORTRAIT_PRIMARY_FRAME),
          },
        }),
      ),
    );
    const renderers: TestRenderer[] = [];
    try {
      for (const assembly of assemblies) {
        const frame = assembly.surfaceForm === 'laptop' ? LANDSCAPE_PRIMARY_FRAME : PORTRAIT_PRIMARY_FRAME;
        await readyAndActivateForTest(assembly);
        const renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), frame);
        renderers.push(renderer);
        const login = getNode(renderer, 'sample.auth.login');
        const actions = getNode(renderer, 'sample.auth.login:actions');
        const style = StyleSheet.flatten(login.props.style);
        if (assembly.surfaceForm === 'laptop') {
          expect(style).toMatchObject({maxWidth: 720, alignSelf: 'center'});
          expect(actions.props.className).toContain('flex-row');
        } else {
          expect(style).toMatchObject({paddingHorizontal: 8, gap: 3});
          expect(actions.props.className).not.toContain('flex-row');
        }
      }
    } finally {
      for (const renderer of renderers) await renderer.unmount();
      for (const assembly of assemblies) await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('uses caller-provided surface declarations for the selected form', async () => {
    const override = {
      orientations: {
        landscape: {
          PRIMARY: {width: 1400, height: 700},
          SECONDARY: {width: 700, height: 400},
        },
        portrait: {
          PRIMARY: {width: 411, height: 731},
        },
      },
    } as const;
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample-console-surface-override-${Date.now()}`,
      surfaceForm: 'laptop',
      terminalSurfaces: override,
    });
    try {
      expect(assembly.surfaceDeclarations).toEqual(override.orientations.landscape);
      expect(assembly.runtimeFacts.surfaceCanvasSizes).toEqual(override.orientations.landscape);
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('does not reuse a platform-port run id for separate console writers', async () => {
    const firstEvents: LogEvent[] = [];
    const secondEvents: LogEvent[] = [];
    const sharedPlatformRunId = 'platform-port-run-id-shared-by-two-clients';
    const firstAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({
        events: firstEvents,
        startupRunId: sharedPlatformRunId,
        stripPortDescriptors: true,
      }),
      persistenceKey: `sample-console-writer-run-id-first-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    });
    const secondAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({
        events: secondEvents,
        startupRunId: sharedPlatformRunId,
        stripPortDescriptors: true,
      }),
      persistenceKey: `sample-console-writer-run-id-second-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    });
    let firstRenderer: TestRenderer | undefined;
    let secondRenderer: TestRenderer | undefined;
    try {
      firstRenderer = await mount(createSurfaceForDisplayIndex(firstAssembly, 0), PORTRAIT_PRIMARY_FRAME);
      secondRenderer = await mount(createSurfaceForDisplayIndex(secondAssembly, 0), PORTRAIT_PRIMARY_FRAME);
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      for (const renderer of [firstRenderer, secondRenderer]) {
        const boundaries = queryNodes(renderer, 'ui-base-render:screen-ready-boundary');
        await act(async () => {
          for (const boundary of boundaries) {
            (boundary.props.onLayout as (event: unknown) => void)({
              nativeEvent: {layout: {width: PORTRAIT_PRIMARY_FRAME.width, height: PORTRAIT_PRIMARY_FRAME.height}},
            });
          }
        });
      }
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      const readStartupRunId = (events: readonly LogEvent[]): string => {
        const complete = events.find(event => event.event === 'startup.complete');
        const startupRunId = complete?.data?.startupRunId;
        if (typeof startupRunId !== 'string') throw new Error('missing startup.complete run id');
        expect(complete?.data).toHaveProperty('primaryReadyPartKey');
        expect(complete?.data).toHaveProperty('primaryContentFailure');
        return startupRunId;
      };
      const firstRunId = readStartupRunId(firstEvents);
      const secondRunId = readStartupRunId(secondEvents);
      expect(firstRunId).not.toBe(sharedPlatformRunId);
      expect(secondRunId).not.toBe(sharedPlatformRunId);
      expect(secondRunId).not.toBe(firstRunId);
    } finally {
      if (firstRenderer !== undefined) await firstRenderer!.unmount();
      if (secondRenderer !== undefined) await secondRenderer!.unmount();
      await releaseRuntimeForTestAsync(firstAssembly.runtime);
      await releaseRuntimeForTestAsync(secondAssembly.runtime);
    }
  });

  it('non-production catalog unit exposes the injected sample section', async () => {
    const context = {
      displayMode: 'PRIMARY' as const,
      workspace: 'MAIN' as const,
      instanceMode: 'MASTER' as const,
      surfaceForm: 'laptop' as const,
    };
    const mobileContext = {...context, surfaceForm: 'mobile' as const};
    const withSampleLaptop = createUiCatalog(
      createSampleDefinedParts()
        .filter(({catalogEntry}) => catalogEntry.surfaceForm.includes('laptop'))
        .map(({catalogEntry}) => catalogEntry),
    );
    const withSampleMobile = createUiCatalog(
      createSampleDefinedParts()
        .filter(({catalogEntry}) => catalogEntry.surfaceForm.includes('mobile'))
        .map(({catalogEntry}) => catalogEntry),
    );
    const withoutSampleLaptop = createUiCatalog(
      createSampleDefinedParts(false)
        .filter(({catalogEntry}) => catalogEntry.surfaceForm.includes('laptop'))
        .map(({catalogEntry}) => catalogEntry),
    );
    const withoutSampleMobile = createUiCatalog(
      createSampleDefinedParts(false)
        .filter(({catalogEntry}) => catalogEntry.surfaceForm.includes('mobile'))
        .map(({catalogEntry}) => catalogEntry),
    );
    expect(selectAvailableParts(withSampleLaptop, 'admin.sections', context).map(entry => entry.partKey)).toContain(
      'sample.console.admin-test',
    );
    expect(
      selectAvailableParts(withSampleMobile, 'admin.sections', mobileContext).map(entry => entry.partKey),
    ).toContain('sample.console.admin-test');
    expect(
      selectAvailableParts(withoutSampleLaptop, 'admin.sections', context).map(entry => entry.partKey),
    ).not.toContain('sample.console.admin-test');
    expect(
      selectAvailableParts(withoutSampleMobile, 'admin.sections', mobileContext).map(entry => entry.partKey),
    ).not.toContain('sample.console.admin-test');
  });

  it('registers separate laptop and mobile renderer siblings for every sample business part', async () => {
    const definedParts = createSampleDefinedParts(false).filter(
      ({catalogEntry}) =>
        catalogEntry.partKey.startsWith('sample.auth.') || catalogEntry.partKey.startsWith('sample.desk.'),
    );
    const groups = new Map<string, (typeof definedParts)[number][]>();
    for (const part of definedParts) {
      const siblings = groups.get(part.catalogEntry.partKey) ?? [];
      siblings.push(part);
      groups.set(part.catalogEntry.partKey, siblings);
    }

    for (const [partKey, siblings] of groups) {
      expect(partKey.startsWith('sample.auth.') || partKey.startsWith('sample.desk.')).toBe(true);
      expect(siblings).toHaveLength(2);
      expect(siblings.map(part => part.catalogEntry.surfaceForm).sort()).toEqual([['laptop'], ['mobile']]);
      expect(new Set(siblings.map(part => part.rendererBinding.component)).size).toBe(2);
      expect(new Set(siblings.map(part => part.rendererBinding.rendererKey)).size).toBe(2);
      for (const sibling of siblings) {
        const surfaceForm = sibling.catalogEntry.surfaceForm[0];
        expect(sibling.rendererBinding.rendererKey).toBe(`${partKey}.${surfaceForm}`);
      }
    }
  });

  it('keeps exact metadata for the integration-owned part and composes feature parts unchanged', async () => {
    const definedParts = createSampleDefinedParts();
    const featureParts = [...sampleStaffAuthAssembly.parts, ...sampleMemberDeskAssembly.parts];

    const activationParts = createSampleDefinedParts(false).filter(({catalogEntry}) =>
      catalogEntry.partKey.startsWith('terminal.activation.'),
    );
    expect(activationParts.map(({catalogEntry}) => catalogEntry.partKey)).toEqual([
      'terminal.activation.mmp',
      'terminal.activation.lmp',
      'terminal.activation.lms',
      'terminal.activation.lsp',
      'terminal.activation.admin.status',
    ]);
    expect(definedParts.slice(0, featureParts.length)).toEqual(featureParts);
    expect(definedParts).toHaveLength(featureParts.length + 7);
    expect(
      definedParts.slice(featureParts.length + 5).map(({catalogEntry, rendererBinding}) => ({
        partKey: catalogEntry.partKey,
        rendererKey: catalogEntry.rendererKey,
        containerKeys: [...catalogEntry.containerKeys],
        displayModes: [...catalogEntry.displayModes],
        workspaces: [...catalogEntry.workspaces],
        instanceModes: [...catalogEntry.instanceModes],
        title: catalogEntry.title,
        surfaceForm: [...catalogEntry.surfaceForm],
        layerTier: rendererBinding.layerTier,
        layerGuard: rendererBinding.layerGuard,
      })),
    ).toEqual([
      {
        partKey: 'terminal.server-config.admin',
        rendererKey: 'terminal.server-config.admin',
        containerKeys: ['admin.sections'],
        displayModes: ['PRIMARY', 'SECONDARY'],
        workspaces: ['MAIN', 'BRANCH'],
        instanceModes: ['MASTER', 'SLAVE'],
        title: '服务配置',
        surfaceForm: ['mobile', 'laptop'],
        layerTier: 'standard',
        layerGuard: 'dismissible',
      },
      {
        partKey: 'sample.console.admin-test',
        rendererKey: 'sample.console.admin-test',
        containerKeys: ['admin.sections'],
        displayModes: ['PRIMARY', 'SECONDARY'],
        workspaces: ['MAIN', 'BRANCH'],
        instanceModes: ['MASTER', 'SLAVE'],
        title: '示例诊断',
        surfaceForm: ['laptop', 'mobile'],
        layerTier: 'standard',
        layerGuard: 'dismissible',
      },
    ]);
  });

  it('allows only the member desk customer surfaces on a topology secondary', async () => {
    const secondaryMemberParts = [
      ...new Set(
        createSampleDefinedParts(false)
          .filter(
            ({catalogEntry}) =>
              catalogEntry.partKey.startsWith('sample.desk.') &&
              catalogEntry.displayModes.includes('SECONDARY') &&
              catalogEntry.instanceModes.includes('SLAVE'),
          )
          .map(({catalogEntry}) => catalogEntry.partKey),
      ),
    ];
    expect(secondaryMemberParts).toEqual(['sample.desk.customer-welcome', 'sample.desk.customer-member']);
  });

  it('shows built-in and integration-registered admin pages in laptop and mobile', async () => {
    const laptopAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-laptop-filter-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, LANDSCAPE_PRIMARY_FRAME)},
    });
    const mobileAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-mobile-filter-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    });
    let laptopRenderer: TestRenderer | undefined;
    let mobileRenderer: TestRenderer | undefined;
    try {
      laptopRenderer = await mount(createSurfaceForDisplayIndex(laptopAssembly, 0), LANDSCAPE_PRIMARY_FRAME);
      await tapLauncher(laptopRenderer);
      await authenticateAdmin(laptopRenderer);
      for (const sectionTestID of [
        adminTestIds.sections.platformPorts,
        adminTestIds.sections.runtime,
        adminTestIds.sections.topology,
        adminTestIds.sections.sampleConsole,
      ]) {
        const sectionButton = queryNodes(laptopRenderer, sectionTestID).find(node => node.type === 'Pressable')!;
        expect(sectionButton.props.accessibilityState).toMatchObject({selected: false});
      }
      expect(getNode(laptopRenderer, 'terminal.admin:panel:normal:title')).toBeDefined();
      expect(queryNodes(laptopRenderer, adminTestIds.ports.title)).toHaveLength(0);
      for (const sectionTestID of [
        adminTestIds.sections.platformPorts,
        adminTestIds.sections.runtime,
        adminTestIds.sections.topology,
      ]) {
        expect(getNode(laptopRenderer, sectionTestID)).toBeDefined();
      }
      const laptopShell = getNode(laptopRenderer, adminTestIds.shell);
      const laptopShellStyle = StyleSheet.flatten(laptopShell.props.style);
      expect(laptopShellStyle).toMatchObject({flex: 1, width: '100%'});
      expect(laptopShellStyle).not.toHaveProperty('maxWidth');
      expect(StyleSheet.flatten(getNode(laptopRenderer, 'terminal.admin:workspace').props.style)).toMatchObject({
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'nowrap',
        minHeight: 0,
      });
      expect(StyleSheet.flatten(getNode(laptopRenderer, 'terminal.admin:navigation').props.style)).toMatchObject({
        flexDirection: 'column',
        flexWrap: 'nowrap',
      });
      const laptopSectionButton = queryNodes(laptopRenderer, adminTestIds.sections.runtime).find(
        node => node.type === 'Pressable',
      )!;
      expect(laptopSectionButton.props.accessibilityRole).toBe('button');
      expect(laptopSectionButton.props.accessibilityLabel).toBe('选择运行状态');
      expect(laptopSectionButton.props.accessibilityState).toMatchObject({selected: false});
      await act(async () => {
        await press(laptopRenderer!, adminTestIds.sections.runtime);
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      const laptopSelectedSectionButton = queryNodes(laptopRenderer, adminTestIds.sections.runtime).find(
        node => node.type === 'Pressable',
      )!;
      expect(laptopSelectedSectionButton.props.accessibilityState).toMatchObject({selected: true});
      expect(getNode(laptopRenderer, adminTestIds.runtime.title)).toBeDefined();
      await act(async () => {
        await press(laptopRenderer!, adminTestIds.sections.platformPorts);
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(StyleSheet.flatten(getNode(laptopRenderer, adminTestIds.content).props.style)).toMatchObject({
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      });
      const laptopPortsSection = queryNodes(laptopRenderer, adminTestIds.ports.contentRoot).find(
        node => node.type === 'View',
      )!;
      expect(StyleSheet.flatten(laptopPortsSection.props.style)).toMatchObject({
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      });
      const laptopSectionHeading = queryNodes(laptopRenderer, adminTestIds.ports.title).find(
        node => node.type === 'Text',
      )!;
      expect(laptopSectionHeading.props).toMatchObject({
        accessibilityRole: 'header',
        accessibilityLiveRegion: 'polite',
      });
      await act(async () => {
        await press(laptopRenderer!, adminTestIds.sections.sampleConsole);
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(getNode(laptopRenderer, 'sample.console.admin-test:title')).toBeDefined();
      expect(
        queryNodes(laptopRenderer, adminTestIds.sections.sampleConsole).find(node => node.type === 'Pressable')?.props
          .accessibilityState,
      ).toMatchObject({selected: true});

      mobileRenderer = await mount(createSurfaceForDisplayIndex(mobileAssembly, 0), PORTRAIT_PRIMARY_FRAME);
      await tapLauncher(mobileRenderer);
      await authenticateAdmin(mobileRenderer);
      expect(getNode(mobileRenderer, 'terminal.admin:navigation')).toBeDefined();
      expect(getNode(mobileRenderer, 'terminal.admin:panel:normal:title')).toBeDefined();
      expect(queryNodesByType(mobileRenderer, 'Text').some(node => node.props.children === '平台端口')).toBe(false);
      const mobileShell = getNode(mobileRenderer, adminTestIds.shell);
      const mobileShellStyle = StyleSheet.flatten(mobileShell.props.style);
      expect(mobileShellStyle).toMatchObject({flex: 1, width: '100%'});
      expect(mobileShellStyle).not.toHaveProperty('maxWidth');
      const mobileNavigation = getNode(mobileRenderer, 'terminal.admin:navigation');
      expect(mobileNavigation).toBeDefined();
      const mobileNavigationTrigger = getNode(mobileRenderer, 'terminal.admin:navigation:trigger');
      expect(mobileNavigationTrigger.props.accessibilityRole).toBe('button');
      expect(mobileNavigationTrigger.props.accessibilityLabel).toBe('选择终端管理页面');
      expect(mobileNavigationTrigger.props.accessibilityState).toMatchObject({expanded: false});
      await act(async () => {
        await press(mobileRenderer!, 'terminal.admin:navigation:trigger');
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(getNode(mobileRenderer, 'terminal.admin:navigation:menu')).toBeDefined();
      for (const partKey of ['admin.console.platform-ports', 'admin.console.runtime', 'admin.console.topology']) {
        expect(getNode(mobileRenderer, `terminal.admin:navigation:option:${partKey}`)).toBeDefined();
      }
      expect(getNode(mobileRenderer, 'terminal.admin:navigation:option:sample.console.admin-test')).toBeDefined();
      await act(async () => {
        await press(mobileRenderer!, 'terminal.admin:navigation:option:admin.console.platform-ports');
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(getNode(mobileRenderer, 'terminal.admin:navigation:trigger').props.accessibilityState).toMatchObject({
        expanded: false,
      });
      expect(getNode(mobileRenderer, adminTestIds.content)).toBeDefined();
      const mobilePortsSection = queryNodes(mobileRenderer, adminTestIds.ports.contentRoot).find(
        node => node.type === 'View',
      )!;
      expect(StyleSheet.flatten(mobilePortsSection.props.style)).toMatchObject({
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      });
      const mobileSectionHeading = queryNodes(mobileRenderer, adminTestIds.ports.title).find(
        node => node.type === 'Text',
      )!;
      expect(mobileSectionHeading.props).toMatchObject({
        accessibilityRole: 'header',
        accessibilityLiveRegion: 'polite',
      });
      await act(async () => {
        await press(mobileRenderer!, 'terminal.admin:navigation:trigger');
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      await act(async () => {
        await press(mobileRenderer!, 'terminal.admin:navigation:option:sample.console.admin-test');
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(getNode(mobileRenderer, 'sample.console.admin-test:title')).toBeDefined();
    } finally {
      if (laptopRenderer !== undefined) await laptopRenderer!.unmount();
      if (mobileRenderer !== undefined) await mobileRenderer!.unmount();
      await releaseRuntimeForTestAsync(laptopAssembly.runtime);
      await releaseRuntimeForTestAsync(mobileAssembly.runtime);
    }
  });

  it('observes business controls without consuming their touch and maps scaled window points to logical space', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample-console-admin-gesture-ancestor-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, LANDSCAPE_PRIMARY_FRAME)},
    });
    let renderer: TestRenderer | undefined;
    try {
      await readyAndActivateForTest(assembly);
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME);
      const launcher = getNode(renderer, adminTestIds.launcher);
      expect(launcher.type).toBe('View');
      expect(launcher.props.onPress).toBeUndefined();
      expect(launcher.props.onStartShouldSetResponder).toBeUndefined();
      expect(launcher.props.onResponderGrant).toBeUndefined();
      const surfaceContent = getNode(renderer, 'ui.base.input:surface-content');
      expect(surfaceContent.type).toBe('View');
      expect(surfaceContent.props.onStartShouldSetResponder).toBeUndefined();
      expect(surfaceContent.props.onStartShouldSetResponderCapture).toBeUndefined();
      expect(surfaceContent.props.onResponderRelease).toBeUndefined();
      expect(surfaceContent.props.onTouchEnd).toBeDefined();
      expect(getRenderedDescendantByProps(launcher, {testID: 'sample.auth.login:submit'})).toBeDefined();

      await act(async () => {
        findTextInput(renderer!, 'sample.auth.login:operator-name').props.onChangeText?.('invalid-operator');
        findTextInput(renderer!, 'sample.auth.login:passcode').props.onChangeText?.('invalid-passcode');
      });
      await act(async () => {
        await press(renderer!, 'sample.auth.login:submit');
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      expect(getNode(renderer, 'sample.auth.notice')).toBeDefined();
      expect(queryNodes(renderer, adminTestIds.login)).toHaveLength(0);

      await act(async () => {
        await press(renderer!, 'sample.auth.notice:dismiss');
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      await tapLauncher(renderer, 5, 95, 95);
      expect(getNode(renderer, adminTestIds.login)).toBeDefined();
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('uses logical rather than raw window coordinates for the production launcher gate', async () => {
    const enlargedAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-gesture-enlarged-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, {width: 2560, height: 1200})},
    });
    const reducedAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-gesture-reduced-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, {width: 640, height: 400})},
    });
    let enlargedRenderer: TestRenderer | undefined;
    let reducedRenderer: TestRenderer | undefined;
    try {
      enlargedRenderer = await mount(createSurfaceForDisplayIndex(enlargedAssembly, 0), {width: 2560, height: 1200});
      await tapLauncher(enlargedRenderer, 5, 95, 100);
      expect(queryNodes(enlargedRenderer, adminTestIds.login)).toHaveLength(0);
      await tapLauncher(enlargedRenderer, 5, 95, 95);
      expect(getNode(enlargedRenderer, adminTestIds.login)).toBeDefined();

      reducedRenderer = await mount(createSurfaceForDisplayIndex(reducedAssembly, 0), {width: 640, height: 400});
      await tapLauncher(reducedRenderer, 5, 100, 100);
      expect(queryNodes(reducedRenderer, adminTestIds.login)).toHaveLength(0);
    } finally {
      if (enlargedRenderer !== undefined) await enlargedRenderer!.unmount();
      if (reducedRenderer !== undefined) await reducedRenderer!.unmount();
      await releaseRuntimeForTestAsync(enlargedAssembly.runtime);
      await releaseRuntimeForTestAsync(reducedAssembly.runtime);
    }
  });

  it('refreshes the measured launcher origin after host geometry changes', async () => {
    const hostSource = createHostSource(true);
    let windowOrigin: Readonly<{readonly x: number; readonly y: number}> = LAUNCHER_WINDOW_ORIGIN;
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-geometry-refresh-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: hostSource},
    });
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(
        createSurfaceForDisplayIndex(assembly, 0),
        LANDSCAPE_PRIMARY_FRAME,
        true,
        {width: LANDSCAPE_PRIMARY_FRAME.width, height: LANDSCAPE_PRIMARY_FRAME.height},
        120,
        () => windowOrigin,
      );
      windowOrigin = {x: 320, y: 440};
      await act(async () => {
        hostSource.emit({
          stableHostLogicalSize: {width: 1920, height: 1080},
          isHostPrimaryDisplay: true,
        });
      });
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!, 2, 2, undefined, windowOrigin);
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
      expect(getNode(renderer, adminTestIds.login)).toBeDefined();
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('measures launcher coordinates after the resized host layout has settled', async () => {
    const events: LogEvent[] = [];
    const initialMeasurement = {x: 100, y: 200, width: 1280, height: 720};
    const staleMeasurement = {x: -90, y: 159, width: 1360, height: 765};
    const resizedMeasurement = {x: 40, y: 159, width: 1100, height: 618.75};
    let currentMeasurement = initialMeasurement;
    const measurements: (typeof initialMeasurement)[] = [];
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({events}),
      persistenceKey: `sample-console-admin-viewport-settle-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    });
    let renderer: TestRenderer | undefined;
    const pendingFrames: FrameRequestCallback[] = [];
    const initialFrames: FrameRequestCallback[] = [];
    try {
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        initialFrames.push(callback);
        return initialFrames.length;
      });
      renderer = await mount(
        createSurfaceForDisplayIndex(assembly, 0),
        LANDSCAPE_PRIMARY_FRAME,
        true,
        LANDSCAPE_PRIMARY_FRAME,
        120,
        () => ({x: currentMeasurement.x, y: currentMeasurement.y}),
        () => {
          measurements.push(currentMeasurement);
          return currentMeasurement;
        },
      );
      await act(async () => {
        while (initialFrames.length > 0) initialFrames.shift()?.(0);
      });
      const launcher = getNode(renderer, adminTestIds.launcher) as unknown as Readonly<{
        readonly props: Readonly<{readonly onLayout: (event: unknown) => void}>;
      }>;
      measurements.length = 0;
      currentMeasurement = staleMeasurement;
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        pendingFrames.push(callback);
        return pendingFrames.length;
      });
      await act(async () => {
        launcher.props.onLayout({nativeEvent: {layout: LANDSCAPE_PRIMARY_FRAME}});
      });
      const firstFrame = pendingFrames.shift();
      if (firstFrame === undefined) throw new Error('Launcher measurement did not schedule its first frame');
      await act(async () => {
        firstFrame(1);
        // SurfaceCanvas commits the new scale/position after the viewport update.
        currentMeasurement = resizedMeasurement;
      });
      const settledFrame = pendingFrames.shift();
      if (settledFrame !== undefined) {
        await act(async () => {
          settledFrame(2);
        });
      }
      expect(measurements.at(-1)).toEqual(resizedMeasurement);

      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!, 2, 2, undefined, {
            x: currentMeasurement.x,
            y: currentMeasurement.y,
          });
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
      expect(getNode(renderer, adminTestIds.login)).toBeDefined();
      expect(events.some(event => event.event === 'admin.launcher-open-requested')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('refreshes launcher window coordinates after ancestor layout movement', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-ancestor-move-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    });
    let windowOrigin: Readonly<{readonly x: number; readonly y: number}> = LAUNCHER_WINDOW_ORIGIN;
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(
        createSurfaceForDisplayIndex(assembly, 0),
        LANDSCAPE_PRIMARY_FRAME,
        true,
        {width: LANDSCAPE_PRIMARY_FRAME.width, height: LANDSCAPE_PRIMARY_FRAME.height},
        120,
        () => windowOrigin,
      );
      windowOrigin = {x: 360, y: 520};
      const launcher = getNode(renderer, adminTestIds.launcher) as unknown as Readonly<{
        readonly props: Readonly<{readonly onLayout: (event: unknown) => void}>;
      }>;
      await act(async () => {
        launcher.props.onLayout({
          nativeEvent: {
            layout: {
              x: 24,
              y: 32,
              width: LANDSCAPE_PRIMARY_FRAME.width,
              height: LANDSCAPE_PRIMARY_FRAME.height,
            },
          },
        });
      });
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!, 2, 2, undefined, windowOrigin);
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
      expect(getNode(renderer, adminTestIds.login)).toBeDefined();
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('opens admin through the real gesture/keypad controls and close/reopen returns to login', async () => {
    const hostSource = createHostSource(true, PORTRAIT_PRIMARY_FRAME);
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-controls-test-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: hostSource},
    });
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME);
      const stopPropagation = vi.fn();
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!, 1, 1, stopPropagation);
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
      await finishKeyboardPresentation(renderer);
      expect(getNode(renderer, adminTestIds.login)).toBeDefined();
      const loginCard = getNode(renderer, `${adminTestIds.login}:card`);
      expect(queryNodes(renderer, 'ui.base.input:surface-frame')).toHaveLength(1);
      expect(
        queryRenderedTree(
          renderer,
          node => node.type === 'View' && node.props.testID === 'ui.base.input:virtual-keyboard',
        ),
      ).toHaveLength(1);
      expect(StyleSheet.flatten(loginCard.props.style)).toMatchObject({width: '100%'});
      expect(getNode(renderer, 'ui.base.input:virtual-keyboard:text-1')).toBeDefined();
      expect(stopPropagation).toHaveBeenCalledTimes(1);
      for (const digit of ['1', '2', '3', '4', '5', '6']) {
        await act(async () => {
          await press(renderer!, `ui.base.input:virtual-keyboard:text-${digit}`);
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
      await act(async () => {
        await press(renderer!, adminTestIds.verify);
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      await waitForAdminContent(renderer);
      expect(getNode(renderer, adminTestIds.shell)).toBeDefined();
      expect(getNode(renderer, 'terminal.admin:navigation')).toBeDefined();
      await selectMobileAdminSection(renderer!, 'admin.console.runtime');
      expect(getNode(renderer, adminTestIds.runtime.contentRoot)).toBeDefined();
      expect(queryNodes(renderer, 'sample.console.admin-test')).toHaveLength(0);
      await act(async () => {
        hostSource.emit({
          stableHostLogicalSize: {width: 1000, height: 700},
          isHostPrimaryDisplay: true,
        });
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(getNode(renderer, adminTestIds.shell)).toBeDefined();
      expect(getNode(renderer, adminTestIds.runtime.contentRoot)).toBeDefined();
      await act(async () => {
        await press(renderer!, adminTestIds.close);
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(queryNodes(renderer, adminTestIds.shell)).toHaveLength(0);
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!);
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
      expect(getNode(renderer, adminTestIds.login)).toBeDefined();
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('binds only the Web click event and opens through browser-shaped coordinates', async () => {
    const globalWithDocument = globalThis as {document?: unknown};
    const previousDocument = globalWithDocument.document;
    Object.defineProperty(globalWithDocument, 'document', {configurable: true, value: {}});
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-web-launcher-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    });
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME);
      const launcher = getNode(renderer, adminTestIds.launcher) as unknown as Readonly<{
        readonly props: Readonly<{readonly onClick?: unknown; readonly onTouchEnd?: unknown}>;
      }>;
      expect(typeof launcher.props.onClick).toBe('function');
      expect(launcher.props.onTouchEnd).toBeUndefined();
      await tapWebLauncher(renderer, 3);
      expect(queryNodes(renderer, adminTestIds.login)).toHaveLength(0);
      await tapWebLauncher(renderer, 2);
      expect(getNode(renderer, adminTestIds.login)).toBeDefined();
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
      if (previousDocument === undefined) delete globalWithDocument.document;
      else Object.defineProperty(globalWithDocument, 'document', {configurable: true, value: previousDocument});
    }
  });

  it('keeps admin keyboard ownership while business input remains underneath and restores it on close', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-focus-scope-test-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    });
    let renderer: TestRenderer | undefined;
    try {
      await assembly.runtime.dispatchCommand(
        showScreenCommand,
        {
          displayMode: 'PRIMARY',
          containerKey: 'main',
          partKey: 'sample.desk.member-form',
        },
        {
          requestId: createRequestId(),
          routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
        },
      );
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME);

      const businessInput = findTextInput(renderer, 'sample.desk.member-form:phone');
      await act(async () => {
        businessInput.props.onFocus({nativeEvent: {}});
      });
      await finishKeyboardPresentation(renderer);
      await act(async () => {
        await press(renderer!, 'ui.base.input:virtual-keyboard:text-3');
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(findTextInput(renderer, 'sample.desk.member-form:phone').props.value).toBe('3');

      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!);
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
      expect(getNode(renderer, adminTestIds.login)).toBeDefined();

      const businessInputUnderAdmin = findTextInput(renderer, 'sample.desk.member-form:phone');
      await act(async () => {
        businessInputUnderAdmin.props.onFocus({nativeEvent: {}});
      });
      await finishKeyboardPresentation(renderer);
      await act(async () => {
        await press(renderer!, 'ui.base.input:virtual-keyboard:text-1');
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(renderer.getByText('*')).toBeDefined();
      expect(findTextInput(renderer, 'sample.desk.member-form:phone').props.value).toBe('3');

      await act(async () => {
        await press(renderer!, adminTestIds.close);
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(queryNodes(renderer, adminTestIds.login)).toHaveLength(0);
      const restoredBusinessInput = findTextInput(renderer, 'sample.desk.member-form:phone');
      await act(async () => {
        restoredBusinessInput.props.onFocus({nativeEvent: {}});
      });
      await finishKeyboardPresentation(renderer);
      await act(async () => {
        await press(renderer!, 'ui.base.input:virtual-keyboard:text-4');
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(findTextInput(renderer, 'sample.desk.member-form:phone').props.value).toBe('34');
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('shows the current admin password beside the instruction when the package flag is enabled', async () => {
    const events: never[] = [];
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({events}),
      persistenceKey: `sample-console-admin-debug-password-test-${Date.now()}`,
      surfaceForm: 'laptop',
      startupDebugMode: false,
      showAdminPassword: true,
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    });
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME);
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!);
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
      expect(renderer.getByText('（123456）')).toBeDefined();
      expect(getNode(renderer, 'terminal.admin:login:instruction')).toBeDefined();
      expect(
        events.some(event => String((event as {readonly event?: unknown}).event) === 'sample.runtime-facts-resolved'),
      ).toBe(true);
      expect(events.some(event => JSON.stringify(event).includes('123456'))).toBe(false);
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('accepts the displayed device-derived admin code entered through the virtual keyboard', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({
        deviceInfo: {
          deviceId: 'DEVICE-ADMIN-LOGIN-001',
          systemName: 'Android',
          systemVersion: '34',
          logicalProcessorCount: 8,
        },
      }),
      persistenceKey: `sample-console-admin-derived-password-test-${Date.now()}`,
      surfaceForm: 'laptop',
      startupDebugMode: false,
      showAdminPassword: true,
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    });
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME);
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!);
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
      await finishKeyboardPresentation(renderer);
      const displayedCode = String(renderer.getByText(/^（\d{6}）$/).props.children).match(/\d{6}/)?.[0];
      expect(displayedCode).toMatch(/^\d{6}$/);
      for (const digit of displayedCode!) {
        await act(async () => {
          await press(renderer!, `ui.base.input:virtual-keyboard:text-${digit}`);
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
      await act(async () => {
        await press(renderer!, adminTestIds.verify);
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      await waitForAdminContent(renderer);
      expect(getNode(renderer, adminTestIds.shell)).toBeDefined();
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('hides the current admin password when the package flag is disabled', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-password-hidden-test-${Date.now()}`,
      surfaceForm: 'laptop',
      startupDebugMode: true,
      showAdminPassword: false,
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    });
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME);
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!);
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
      expect(queryNodes(renderer, adminTestIds.debugPassword)).toHaveLength(0);
      expect(renderer.getByText('请输入动态口令')).toBeDefined();
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('keeps the local admin launcher available on a physical non-host surface', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-secondary-test-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {1: createHostSource(false)},
    });
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 1));
      expect(queryNodes(renderer, adminTestIds.launcher)).toHaveLength(1);
      await tapLauncher(renderer);
      expect(getNode(renderer, adminTestIds.login)).toBeDefined();
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('emits an observable rejection when the primary surface receives a non-host measurement', async () => {
    const events: LogEvent[] = [];
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({events}),
      persistenceKey: `sample-console-admin-host-rejection-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(false, LANDSCAPE_PRIMARY_FRAME)},
    });
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME);
      expect(getNode(renderer, 'ui-base-render:surface-host-pending')).toBeDefined();
      expect(queryNodes(renderer, adminTestIds.launcher)).toHaveLength(0);
      const rejection = events.find(event => event.event === 'surface.host-identity-rejected');
      expect(rejection).toMatchObject({
        category: 'display-diagnostics',
        event: 'surface.host-identity-rejected',
        data: {
          reason: 'physical-host-flag-mismatch',
          displayIndex: 0,
          expectedIsHostPrimaryDisplay: true,
          actualIsHostPrimaryDisplay: false,
        },
      });
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('retains submitted business state underneath the admin layer', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2, deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample-console-admin-submitted-business-state-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, LANDSCAPE_PRIMARY_FRAME)},
    });
    let renderer: TestRenderer | undefined;
    try {
      await readyAndActivateForTest(assembly);
      await loginForTest(assembly);
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME);
      await act(async () => {
        const result = await assembly.runtime.dispatchCommand(
          submitMemberCommand,
          {
            name: 'Alice',
            phone: '010-1234-5678',
          },
          {requestId: createRequestId()},
        );
        expect(result.status).toBe('completed');
      });

      await tapLauncher(renderer);
      expect(getNode(renderer, adminTestIds.login)).toBeDefined();

      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.member-list',
      });
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY').map(layer => layer.layerId)).toEqual(
        expect.arrayContaining(['sample.desk.waiting-confirm', 'admin.console.layer']),
      );
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('keeps a business command alive while the admin layer opens over the business surface', async () => {
    let releaseDisplayInfo: () => void = () => undefined;
    const displayInfoGate = new Promise<void>(resolve => {
      releaseDisplayInfo = resolve;
    });
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({
        displayCount: 2,
        deviceInfo: ACTIVATION_DEVICE_INFO,
        displayInfoGate,
        displayInfoGateAfterCalls: 2,
      }),
      persistenceKey: `sample-console-admin-in-flight-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, LANDSCAPE_PRIMARY_FRAME)},
    });
    let renderer: TestRenderer | undefined;
    try {
      await readyAndActivateForTest(assembly);
      await loginForTest(assembly);
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME);
      let businessSettled = false;
      const businessPromise = assembly.runtime
        .dispatchCommand(
          submitMemberCommand,
          {
            name: 'Alice',
            phone: '010-1234-5678',
          },
          {requestId: createRequestId()},
        )
        .then(result => {
          businessSettled = true;
          return result;
        });
      await Promise.resolve();
      expect(businessSettled).toBe(false);

      await tapLauncher(renderer);
      expect(getNode(renderer, adminTestIds.login)).toBeDefined();

      releaseDisplayInfo();
      const result = await businessPromise;
      expect(result.status).toBe('completed');
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.member-list',
      });
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY').map(layer => layer.layerId)).toEqual(
        expect.arrayContaining(['sample.desk.waiting-confirm', 'admin.console.layer']),
      );
    } finally {
      releaseDisplayInfo();
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('persists the admin layer while keeping section selection ephemeral', async () => {
    const plainStorage = createRecordingStorage();
    const protectedStorage = createRecordingStorage();
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({
        plainStorage: plainStorage.storage,
        protectedStorage: protectedStorage.storage,
      }),
      persistenceKey: `sample-console-admin-persistence-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    });
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME);
      await tapLauncher(renderer);
      await authenticateAdmin(renderer);
      await selectMobileAdminSection(renderer!, 'admin.console.runtime');
      expect(getNode(renderer, adminTestIds.runtime.contentRoot)).toBeDefined();
      await waitForRecordedValues([plainStorage, protectedStorage], ['admin.console.layer']);
      const persistedValues = [...plainStorage.writes, ...protectedStorage.writes];
      expect(persistedValues.length).toBeGreaterThan(0);
      expect(persistedValues.join('\n')).toContain('admin.console.layer');
      expect(persistedValues.join('\n')).not.toContain('sample.console.admin-test');
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('restores the real admin layer and business screen across a cold runtime restart', async () => {
    const plainStorage = createRecordingStorage();
    const protectedStorage = createRecordingStorage();
    const persistenceKey = 'sample-console-admin-cold-restart';
    const hostSource = createHostSource(true, PORTRAIT_PRIMARY_FRAME);
    let firstAssembly: Awaited<ReturnType<typeof createSampleAssembly>> | undefined;
    let secondAssembly: Awaited<ReturnType<typeof createSampleAssembly>> | undefined;
    let firstRenderer: TestRenderer | undefined;
    let secondRenderer: TestRenderer | undefined;
    try {
      firstAssembly = await createSampleAssembly({
        platformPorts: createTestPlatformPorts({
          plainStorage: plainStorage.storage,
          protectedStorage: protectedStorage.storage,
          deviceInfo: ACTIVATION_DEVICE_INFO,
        }),
        persistenceKey,
        surfaceForm: 'mobile',
        showAdminPassword: true,
        surfaceHostSourcesByDisplayIndex: {0: hostSource},
      });
      await readyAndActivateForTest(firstAssembly);
      await loginForTest(firstAssembly);
      firstRenderer = await mount(createSurfaceForDisplayIndex(firstAssembly, 0), PORTRAIT_PRIMARY_FRAME);
      await tapLauncher(firstRenderer);
      await authenticateAdmin(firstRenderer);
      await selectMobileAdminSection(firstRenderer!, 'admin.console.runtime');
      expect(getNode(firstRenderer, adminTestIds.runtime.contentRoot)).toBeDefined();
      const businessBefore = selectScreen(firstAssembly.runtime.getState(), 'PRIMARY', 'main');
      expect(businessBefore).toBeDefined();
      const businessPartKey = businessBefore!.partKey;
      await waitForRecordedValues(
        [plainStorage, protectedStorage],
        ['admin.console.layer', businessPartKey, 'A001', '00000000-0000-4000-8000-000000000001'],
      );
      await releaseRuntimeForTestAsync(firstAssembly.runtime);
      firstAssembly = undefined;
      // Do not unmount the first renderer before hydration: a killed process
      // does not run the layer component's close effect.

      secondAssembly = await createSampleAssembly({
        platformPorts: createTestPlatformPorts({
          plainStorage: plainStorage.storage,
          protectedStorage: protectedStorage.storage,
          deviceInfo: ACTIVATION_DEVICE_INFO,
        }),
        persistenceKey,
        surfaceForm: 'mobile',
        surfaceHostSourcesByDisplayIndex: {0: hostSource},
      });
      secondRenderer = await mount(createSurfaceForDisplayIndex(secondAssembly, 0), PORTRAIT_PRIMARY_FRAME);
      expect(selectLayers(secondAssembly.runtime.getState(), 'PRIMARY')).toEqual(
        expect.arrayContaining([expect.objectContaining({layerId: 'admin.console.layer'})]),
      );
      expect(selectScreen(secondAssembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: businessPartKey,
      });
      expect(getNode(secondRenderer, adminTestIds.login)).toBeDefined();
    } finally {
      if (firstRenderer !== undefined) await firstRenderer!.unmount();
      if (secondRenderer !== undefined) await secondRenderer!.unmount();
      if (firstAssembly !== undefined) releaseRuntimeForTestAsync(firstAssembly.runtime);
      if (secondAssembly !== undefined) releaseRuntimeForTestAsync(secondAssembly.runtime);
    }
  });

  it('cleans only admin state on a display identity replacement and recomputes canvas geometry', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-replacement-test-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    });
    let renderer: TestRenderer | undefined;
    try {
      await assembly.runtime.dispatchCommand(
        openLayerCommand,
        {
          displayMode: 'PRIMARY',
          layerId: 'business-layer',
          partKey: 'sample.desk.waiting-confirm',
        },
        {requestId: createRequestId()},
      );
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME);
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!);
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
      await finishKeyboardPresentation(renderer);
      for (const digit of ['1', '2', '3', '4', '5', '6']) {
        await act(async () => {
          await press(renderer!, `ui.base.input:virtual-keyboard:text-${digit}`);
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
      await act(async () => {
        await press(renderer!, adminTestIds.verify);
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY').map(layer => layer.layerId)).toEqual(
        expect.arrayContaining(['business-layer', 'admin.console.layer']),
      );

      await act(async () => {
        await assembly.runtime.dispatchCommand(
          switchInstanceModeCommand,
          {instanceMode: 'SLAVE'},
          {
            requestId: createRequestId(),
            routeContext: {displayMode: 'PRIMARY'},
          },
        );
        await assembly.runtime.dispatchCommand(
          switchDisplayRoleCommand,
          {displayRole: 'VICE'},
          {
            requestId: createRequestId(),
            routeContext: {displayMode: 'PRIMARY'},
          },
        );
        await renderer!.rerender(createSurfaceForDisplayIndex(assembly, 0));
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(queryNodes(renderer, adminTestIds.shell)).toHaveLength(0);
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY').map(layer => layer.layerId)).toEqual([
        'business-layer',
        'admin.console.layer',
      ]);
      const canvas = getNode(renderer, 'ui-base-render:surface-host-canvas');
      expect(canvas.props.style).toEqual(expect.arrayContaining([expect.objectContaining({width: 1280, height: 720})]));
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });
  it('reads device identity once at assembly startup and exposes only the normalized fact', async () => {
    let deviceInfoCalls = 0;
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({
        onGetDeviceInfo: () => {
          deviceInfoCalls += 1;
        },
        deviceInfo: {
          deviceId: ' DEVICE-001 ',
          manufacturer: 'Example',
          model: 'Terminal',
          systemName: 'Android',
          systemVersion: '15',
          logicalProcessorCount: 8,
        },
      }),
      persistenceKey: `sample-console-device-identity-test-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    try {
      expect(deviceInfoCalls).toBe(1);
      expect(assembly.runtimeFacts.deviceIdentity).toEqual({available: true, deviceId: 'DEVICE-001'});
      expect(Object.isFrozen(assembly.runtimeFacts)).toBe(true);
      expect(Object.isFrozen(assembly.runtimeFacts.deviceIdentity)).toBe(true);
      createSurfaceForDisplayIndex(assembly, 0);
      createSurfaceForDisplayIndex(assembly, 0);
      expect(deviceInfoCalls).toBe(1);
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('starts the single assembly with all input modules and the runtime module', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-test-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    try {
      expect(assembly.runtime.status).toBe('started');
      expect(assembly.runtime.descriptors.map(descriptor => descriptor.moduleName)).toEqual(
        expect.arrayContaining([
          'kernel.base.runtime',
          'kernel.base.display-context',
          'kernel.base.ui-state',
          'kernel.base.server-config',
          'kernel.feature.sample-staff-session',
          'kernel.feature.sample-member-registry',
          'ui.feature.sample-staff-auth',
          'ui.feature.sample-member-desk',
          'ui.base.terminal-activation',
          'kernel.base.terminal-data-client',
          'ui.integration.sample-console',
        ]),
      );
      expect(assembly.runtime.descriptors).toHaveLength(14);
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('renders a real catalog part through RenderProvider and SurfaceRoot', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample-console-render-test-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    let renderer: TestRenderer | undefined;
    try {
      await readyAndActivateForTest(assembly);
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME);
      expect(getNode(renderer, 'sample.auth.login')).toBeDefined();
      expect(getNode(renderer, 'sample.auth.login:submit')).toBeDefined();
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('keeps the production SurfaceRoot on the input presentation bridge', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-presentation-bridge-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    });
    let renderer: TestRenderer | undefined;
    try {
      await assembly.runtime.dispatchCommand(
        showScreenCommand,
        {
          displayMode: 'PRIMARY',
          containerKey: 'main',
          partKey: 'sample.desk.member-form',
        },
        {
          requestId: createRequestId(),
          routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
        },
      );
      renderer = await mount(
        createSurfaceForDisplayIndex(assembly, 0),
        PORTRAIT_PRIMARY_FRAME,
        true,
        {width: 0, height: 0},
        500,
      );

      const financialProbe = findTextInput(renderer, 'sample.desk.member-form:keyboard-financial-probe');
      await act(async () => {
        financialProbe.props.onFocus({nativeEvent: {}});
      });
      await finishKeyboardPresentation(renderer);

      const translatedNodes = queryRenderedTree(renderer, node => {
        const style = StyleSheet.flatten(node.props.style) as
          | Readonly<{
              readonly transform?: readonly Readonly<{readonly translateY?: unknown}>[];
            }>
          | undefined;
        return (
          style?.transform?.some(
            transform => typeof transform.translateY === 'number' && transform.translateY < -0.5,
          ) ?? false
        );
      });
      expect(translatedNodes.length).toBeGreaterThan(0);
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('maps the secondary display index through display-context ownership', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-secondary-render-test-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    let renderer: TestRenderer | undefined;
    try {
      const result = await assembly.runtime.dispatchCommand(
        showScreenCommand,
        {
          displayMode: 'SECONDARY',
          containerKey: 'main',
          partKey: 'sample.desk.customer-welcome',
        },
        {
          requestId: createRequestId(),
          routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
        },
      );
      expect(result.status).toBe('completed');
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 1), LANDSCAPE_SECONDARY_FRAME);
      expect(getNode(renderer, 'sample.desk.customer-welcome')).toBeDefined();
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('recomputes anonymous secondary placement after a display refresh', async () => {
    let displayCount = 1;
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({getDisplayCount: () => displayCount, deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample-console-display-refresh-placement-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    try {
      await readyAndActivateForTest(assembly);
      displayCount = 2;
      const refreshed = await assembly.runtime.dispatchCommand(
        refreshTopologyDisplayCommand,
        {},
        {requestId: createRequestId()},
      );
      if (refreshed.status !== 'completed') throw new Error(JSON.stringify(refreshed, null, 2));
      expect(selectScreen(assembly.runtime.getState(), 'SECONDARY', 'main')).toMatchObject({
        partKey: 'sample.auth.guide.lms',
      });
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('routes every production UI screen command through the runtime boundary', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-runtime-route-command-family-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    try {
      assembly.runtime.getStore().dispatch(
        topologyActions.setMasterLocator({
          host: '192.0.2.10',
          port: 43172,
          basePath: '/terminal-topology',
          identity: {
            protocolVersion: 1,
            moduleName: 'ui.integration.sample-console',
            nodeId: 'node-master',
            displayName: 'TER master',
            instanceMode: 'MASTER',
            displayRole: 'CHIEF',
          },
        }),
      );

      const cases = [
        {
          command: showScreenCommand,
          payload: {displayMode: 'SECONDARY' as const, containerKey: 'main', partKey: 'sample.desk.customer-welcome'},
        },
        {
          command: openLayerCommand,
          payload: {
            displayMode: 'PRIMARY' as const,
            layerId: 'sample.desk.waiting-confirm',
            partKey: 'sample.desk.waiting-confirm',
          },
        },
        {
          command: clearLayersCommand,
          payload: {displayMode: 'SECONDARY' as const},
        },
      ] as const;

      for (const currentCase of cases) {
        const requestId = createRequestId();
        const result = await assembly.runtime.dispatchCommand(currentCase.command.commandName, currentCase.payload, {
          requestId,
        });
        expect(result.status).toBe('completed');
        expect(selectRequestExecutionView(assembly.runtime.getState(), requestId)).toMatchObject({
          status: 'completed',
          commands: [
            expect.objectContaining({
              commandName: currentCase.command.commandName,
              observations: [expect.objectContaining({target: 'local'})],
            }),
          ],
        });
      }
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('closes the dual-screen age journey on withdraw before a late confirm can register', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2, deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample-console-age-withdraw-test-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    let renderer: TestRenderer | undefined;
    try {
      await readyAndActivateForTest(assembly);
      await loginForTest(assembly);
      await act(async () => {
        await assembly.runtime.dispatchCommand(
          submitMemberCommand,
          {
            name: 'Alice',
            phone: '010-1234-5678',
          },
          {requestId: createRequestId()},
        );
      });
      renderer = await mount(
        <>
          {createSurfaceForDisplayIndex(assembly, 0)}
          {createSurfaceForDisplayIndex(assembly, 1)}
        </>,
      );

      const ageInput = findTextInput(renderer, 'sample.desk.customer-member:age');
      await act(async () => {
        ageInput.props.onFocus({nativeEvent: {}});
      });
      await finishKeyboardPresentation(renderer);
      expect(getNode(renderer, 'ui.base.input:virtual-keyboard')).toBeDefined();
      await act(async () => {
        await press(renderer!, 'ui.base.input:virtual-keyboard:text-3');
      });

      await press(renderer, 'sample.desk.waiting-confirm:withdraw');
      await waitFor(() => {
        expect(getNode(renderer!, 'sample.desk.withdraw-confirm:withdraw')).toBeDefined();
      });
      await press(renderer, 'sample.desk.withdraw-confirm:withdraw');

      expect(selectPendingMember(assembly.runtime.getState())).toBeNull();
      expect(selectScreen(assembly.runtime.getState(), 'SECONDARY', 'main')).toMatchObject({
        partKey: 'sample.desk.customer-welcome',
      });
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY')).toHaveLength(0);
      expect(getNode(renderer, 'sample.desk.customer-welcome')).toBeDefined();

      const membersBeforeLateConfirm = selectMembers(assembly.runtime.getState());
      await act(async () => {
        await assembly.runtime.dispatchCommand(
          confirmMemberCommand,
          {operationId: 'late-confirm', age: 3},
          {requestId: createRequestId()},
        );
      });
      expect(selectPendingMember(assembly.runtime.getState())).toBeNull();
      expect(selectMembers(assembly.runtime.getState())).toEqual(membersBeforeLateConfirm);
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('confirms a locally edited secondary age into the member fact only at decision time', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2, deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample-console-age-confirm-test-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    let secondaryRenderer: TestRenderer | undefined;
    try {
      await readyAndActivateForTest(assembly);
      await loginForTest(assembly);
      await assembly.runtime.dispatchCommand(
        submitMemberCommand,
        {
          name: 'Alice',
          phone: '010-1234-5678',
        },
        {requestId: createRequestId()},
      );
      secondaryRenderer = await mount(createSurfaceForDisplayIndex(assembly, 1));
      const ageInput = findTextInput(secondaryRenderer, 'sample.desk.customer-member:age');
      await act(async () => {
        ageInput.props.onFocus({nativeEvent: {}});
      });
      await finishKeyboardPresentation(secondaryRenderer);
      await act(async () => {
        await press(secondaryRenderer!, 'ui.base.input:virtual-keyboard:text-3');
      });
      await act(async () => {
        await press(secondaryRenderer!, 'sample.desk.customer-member:confirm');
      });
      expect(selectMembers(assembly.runtime.getState())).toContainEqual(
        expect.objectContaining({
          name: 'Alice',
          phone: '010-1234-5678',
          age: 3,
        }),
      );
      expect(selectPendingMember(assembly.runtime.getState())).toBeNull();
    } finally {
      if (secondaryRenderer !== undefined) await secondaryRenderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('does not persist locally edited age when the customer rejects', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2, deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample-console-age-reject-test-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    let secondaryRenderer: TestRenderer | undefined;
    try {
      await readyAndActivateForTest(assembly);
      await loginForTest(assembly);
      await assembly.runtime.dispatchCommand(
        submitMemberCommand,
        {
          name: 'Alice',
          phone: '010-1234-5678',
        },
        {requestId: createRequestId()},
      );
      secondaryRenderer = await mount(createSurfaceForDisplayIndex(assembly, 1));
      const ageInput = findTextInput(secondaryRenderer, 'sample.desk.customer-member:age');
      await act(async () => {
        ageInput.props.onFocus({nativeEvent: {}});
      });
      await finishKeyboardPresentation(secondaryRenderer);
      await act(async () => {
        await press(secondaryRenderer!, 'ui.base.input:virtual-keyboard:text-4');
      });
      await act(async () => {
        await press(secondaryRenderer!, 'sample.desk.customer-member:reject');
      });
      expect(selectMembers(assembly.runtime.getState())).toEqual([]);
      expect(selectPendingMember(assembly.runtime.getState())).toEqual({
        operationId: expect.any(String),
        name: 'Alice',
        phone: '010-1234-5678',
      });
    } finally {
      if (secondaryRenderer !== undefined) await secondaryRenderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('retains rejected pending data for retry and clears it only when the notice is abandoned', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2, deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample-console-retry-abandon-test-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    try {
      await readyAndActivateForTest(assembly);
      await loginForTest(assembly);
      await assembly.runtime.dispatchCommand(
        submitMemberCommand,
        {
          name: 'Carol',
          phone: '010-1111-2222',
        },
        {requestId: createRequestId()},
      );
      await assembly.runtime.dispatchCommand(
        rejectMemberCommand,
        {operationId: selectPendingMember(assembly.runtime.getState())?.operationId ?? 'missing-pending'},
        {requestId: createRequestId()},
      );
      expect(selectPendingMember(assembly.runtime.getState())).toEqual({
        operationId: expect.any(String),
        name: 'Carol',
        phone: '010-1111-2222',
      });

      await assembly.runtime.dispatchCommand(
        memberRegistrationRetryRequestedCommand,
        {
          reasonCode: 'customer-rejected',
        },
        {requestId: createRequestId()},
      );
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.member-form',
      });
      expect(selectPendingMember(assembly.runtime.getState())).toEqual({
        operationId: expect.any(String),
        name: 'Carol',
        phone: '010-1111-2222',
      });

      await assembly.runtime.dispatchCommand(
        rejectMemberCommand,
        {operationId: selectPendingMember(assembly.runtime.getState())?.operationId ?? 'missing-pending'},
        {requestId: createRequestId()},
      );
      await assembly.runtime.dispatchCommand(memberRegistrationAbandonedCommand, {}, {requestId: createRequestId()});
      expect(selectPendingMember(assembly.runtime.getState())).toBeNull();
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.member-list',
      });
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY')).toHaveLength(0);
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('returns the single-surface hand-back to the member form without a confirmation layer', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1, deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample-console-hand-back-test-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    try {
      await readyAndActivateForTest(assembly);
      await loginForTest(assembly);
      await assembly.runtime.dispatchCommand(
        submitMemberCommand,
        {
          name: 'Alice',
          phone: '010-1234-5678',
        },
        {requestId: createRequestId()},
      );
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.customer-member',
        props: {mode: 'handheld-confirm'},
      });

      await assembly.runtime.dispatchCommand(
        memberSubmissionWithdrawnCommand,
        {operationId: selectPendingMember(assembly.runtime.getState())?.operationId ?? 'missing-pending'},
        {requestId: createRequestId()},
      );
      expect(selectPendingMember(assembly.runtime.getState())).toBeNull();
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.member-form',
      });
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });
});
