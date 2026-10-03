import {act, fireEvent, render, waitFor, type RenderResult} from '@testing-library/react-native';
import type {ReactElement} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {selectServerConfiguration} from '@catering-v2s/kernel-base-server-config';
import packageJson from '../package.json';
import {StyleSheet} from 'react-native';
import {
  advanceAnimatedTimingsForTests,
  setAnimatedTimingAutoFinishForTests,
} from '../../../../../../tools/terminal-shared/react-native-vitest-entry';
import {createProcessMemoryStateStoragePort, type LogEvent, type StateStoragePort} from '@catering-v2s/kernel-base-platform-ports';
import {
  loginCommand,
  logoutCommand,
  selectSessionState,
} from '@catering-v2s/kernel-feature-sample-staff-session';
import {ADMIN_CONSOLE_LAYER_ID, ADMIN_CONSOLE_PART_KEY, adminTestIds} from '@catering-v2s/ui-base-admin-shell';
import {openLayerCommand, selectLayers, selectScreen, showScreenCommand} from '@catering-v2s/kernel-base-ui-state';
import {
  confirmWallpaperCommand,
  selectWallpaperCommand,
  selectPendingWallpaperId,
  selectWallpaperId,
} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {releaseRuntimeForTestAsync} from '@catering-v2s/kernel-base-runtime/testing';
import {topologyActions} from '@catering-v2s/kernel-base-topology';
import {
  createSurfaceForDisplayIndex,
  createSampleWallpaperConsoleAssembly as createProductionSampleWallpaperConsoleAssembly,
  parts as wallpaperConsoleParts,
  startupReadyCommand,
} from '../src';
import {
  sampleWallpaperPickerAssembly,
  wallpaperPickerExitRequestedCommand,
  wallpaperPickerTestIds,
} from '@catering-v2s/ui-feature-sample-wallpaper-picker';
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth';
import {needToActivateTerminalCommand} from '@catering-v2s/ui-base-terminal-activation';
import {activateTerminalCommand} from '@catering-v2s/kernel-base-terminal-data-client';
import {createTestPlatformPorts, TestPeerChannel, type TestPlatformPorts} from './support';
import {
  resetNativeTestRefFactory,
  setNativeTestRefFactory,
  type NativeTestHostProps,
} from '../../../../../../tools/terminal-shared/rntl-native-test-host';
import {
  getRenderedByProps,
  getRenderedDescendantByProps,
  queryRenderedByProps,
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

type TestWallpaperConsoleAssemblyInput = Omit<
  Parameters<typeof createProductionSampleWallpaperConsoleAssembly>[0],
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

const readPersistedValues = async (storages: readonly StateStoragePort[]): Promise<readonly string[]> => {
  const values: string[] = [];
  for (const storage of storages) {
    const keyResult = await storage.listKeys({});
    if (keyResult.status !== 'succeeded') throw new Error('SAMPLE_WALLPAPER_STORAGE_KEY_READ_FAILED');
    if (keyResult.value.length === 0) continue;
    const entriesResult = await storage.readMany({keys: keyResult.value});
    if (entriesResult.status !== 'succeeded') throw new Error('SAMPLE_WALLPAPER_STORAGE_VALUE_READ_FAILED');
    values.push(
      ...entriesResult.value.flatMap(entry => (entry.result.state === 'found' ? [entry.result.value] : [])),
    );
  }
  return values;
};

const waitForPersistedValues = async (storages: readonly StateStoragePort[], expectedValues: readonly string[]) => {
  await waitFor(async () => {
    const persisted = (await readPersistedValues(storages)).join('\n');
    for (const expected of expectedValues) expect(persisted).toContain(expected);
  });
};

const createSampleWallpaperConsoleAssembly = (input: TestWallpaperConsoleAssemblyInput) =>
  createProductionSampleWallpaperConsoleAssembly({
    ...input,
    transportNetworkAdapterFactory:
      input.transportNetworkAdapterFactory ??
      (readSnapshot =>
        Object.freeze({
          readSnapshot,
          connect: async () => {
            throw new Error('WEBSOCKET_NOT_EXPECTED_IN_WALLPAPER_COMPOSITION_TEST');
          },
          sendHttp: async () =>
            Object.freeze({
              kind: 'response' as const,
              status: 200,
              body: Object.freeze({
                terminalRef: 'terminal-wallpaper-test',
                storeRef: 'store-wallpaper-test',
                groupWorkspaceKey: 'workspace-wallpaper-test',
                bindingGeneration: 1,
              }),
            }),
        })),
    nativeLoadingCapability: input.platformPorts.nativeLoadingCapability,
  });

const signalPrimaryReady = async (assembly: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>>) => {
  const result = await assembly.runtime.dispatchCommand(
    startupReadyCommand,
    {surfaceKey: 'PRIMARY', displayIndex: 0, readyPartKey: 'terminal.activation.lmp', contentFailure: null},
    dispatchOptions(),
  );
  expect(result.status).toBe('completed');
};

const activateForTest = async (assembly: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>>) => {
  const result = await assembly.runtime.dispatchCommand(
    activateTerminalCommand,
    {activationCode: '00123456'},
    dispatchOptions(),
  );
  expect(result.status).toBe('completed');
  expect(result.actorResults.map(item => item.result)).toContainEqual(
    expect.objectContaining({status: 'activated', terminalRef: 'terminal-wallpaper-test'}),
  );
  await new Promise(resolve => setTimeout(resolve, 0));
};

const readyAndActivateForTest = async (
  assembly: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>>,
) => {
  await signalPrimaryReady(assembly);
  await activateForTest(assembly);
};

const loginForTest = async (assembly: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>>) => {
  const result = await assembly.runtime.dispatchCommand(
    loginCommand,
    {operatorName: 'A001', passcode: '1111'},
    dispatchOptions(),
  );
  expect(result.status).toBe('completed');
  await new Promise(resolve => setTimeout(resolve, 0));
};

const logoutForTest = async (assembly: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>>) => {
  const result = await assembly.runtime.dispatchCommand(logoutCommand, {}, dispatchOptions());
  expect(result.status).toBe('completed');
  await new Promise(resolve => setTimeout(resolve, 0));
};

const PRIMARY_FRAME = {width: 360, height: 640} as const;
const ACTIVATION_DEVICE_INFO = Object.freeze({
  deviceId: 'DEVICE-SAMPLE2-COMPOSITION-001',
  systemName: 'TEST',
  systemVersion: '1',
  logicalProcessorCount: 8,
});

const createPrimaryHostSource = () => {
  const snapshot = {
    stableHostLogicalSize: PRIMARY_FRAME,
    isHostPrimaryDisplay: true,
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
  };
};

const mount = async (element: ReactElement): Promise<TestRenderer> => {
  setNativeTestRefFactory((hostName: string, props: NativeTestHostProps) => {
    const testID = props.testID;
    if (testID === adminTestIds.launcher) {
      return {
        measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => {
          callback(0, 0, PRIMARY_FRAME.width, PRIMARY_FRAME.height);
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
          callback(0, 0, PRIMARY_FRAME.width, Math.max(1, PRIMARY_FRAME.height - 20));
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
          callback(0, 120, Math.min(320, PRIMARY_FRAME.width), 40);
        },
        focus: () => undefined,
        blur: () => undefined,
      };
    }
    return hostName === 'View' ? {} : undefined;
  });
  const renderer = await render(element);
  const scrollAreas = queryRenderedTree(
    renderer,
    node =>
      typeof node.props.testID === 'string' &&
      node.props.testID.endsWith(':scroll') &&
      typeof node.props.onLayout === 'function' &&
      typeof node.props.onContentSizeChange === 'function' &&
      typeof node.props.onScroll === 'function',
  ) as TestNode[];
  await act(async () => {
    for (const scroll of scrollAreas) {
      scroll.props.onLayout({
        nativeEvent: {
          layout: {
            x: 0,
            y: 0,
            width: PRIMARY_FRAME.width,
            height: Math.max(1, PRIMARY_FRAME.height - 20),
          },
        },
      });
      scroll.props.onContentSizeChange(PRIMARY_FRAME.width, 1200);
      scroll.props.onScroll({nativeEvent: {contentOffset: {y: 0}}});
    }
  });
  return renderer;
};

const measurePrimarySurface = async (renderer: TestRenderer): Promise<void> => {
  const frames = queryNodes(renderer, 'ui.base.input:surface-frame');
  await act(async () => {
    for (const frame of frames) {
      (frame.props.onLayout as (event: unknown) => void)({
        nativeEvent: {layout: PRIMARY_FRAME},
      });
    }
  });
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
      moduleName: 'ui.integration.sample-wallpaper-console',
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

const authenticateAdmin = async (renderer: TestRenderer): Promise<void> => {
  await finishKeyboardPresentation(renderer);
  for (const digit of ['1', '2', '3', '4', '5', '6']) {
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

const dispatchOptions = (displayMode: 'PRIMARY' | 'SECONDARY' = 'PRIMARY') => ({
  requestId: createRequestId(),
  routeContext: {displayMode},
});

afterEach(resetNativeTestRefFactory);

describe('sample2 wallpaper console assembly', () => {
  it('routes terminal activation intent through its own runtime owner for the LMS and LSP faces', async () => {
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-wallpaper-activation-route-${Date.now()}`,
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
  });

  it('uses only this integration package serverSpaces defaults and accepts an explicit entry fixture', async () => {
    const integrationDefaults = packageJson.serverSpaces as TransportServerConfig;
    const defaultsAssembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-wallpaper-console-server-defaults-${Date.now()}`,
      surfaceForm: 'mobile',
    });
    const fixture: TransportServerConfig = {
      selectedSpace: 'sample-wallpaper-fixture',
      spaces: [
        {
          name: 'sample-wallpaper-fixture',
          servers: [
            {
              serverName: 'business',
              addresses: [{addressName: 'fixture', baseUrl: 'https://sample-wallpaper.invalid/api', timeoutMs: 4321}],
            },
          ],
        },
      ],
    };
    let fixtureAssembly: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>> | undefined;
    try {
      fixtureAssembly = await createSampleWallpaperConsoleAssembly({
        platformPorts: createTestPlatformPorts(),
        persistenceKey: `sample-wallpaper-console-server-fixture-${Date.now()}`,
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
          name: 'sample-wallpaper-fixture',
          servers: [{serverName: 'business', addresses: fixture.spaces[0]!.servers[0]!.addresses}],
        },
      ]);
    } finally {
      await releaseRuntimeForTestAsync(defaultsAssembly.runtime);
      if (fixtureAssembly !== undefined) await releaseRuntimeForTestAsync(fixtureAssembly.runtime);
    }
  });
  it('keeps exact metadata for the laptop-only waiting and welcome parts', async () => {
    expect(
      wallpaperConsoleParts.map(({catalogEntry, rendererBinding}) => ({
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
        partKey: 'sample.wallpaper-console.waiting',
        rendererKey: 'sample.wallpaper-console.waiting',
        containerKeys: ['main'],
        displayModes: ['SECONDARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER', 'SLAVE'],
        title: '等待店员登录',
        surfaceForm: ['laptop'],
        layerTier: 'standard',
        layerGuard: 'dismissible',
      },
      {
        partKey: 'sample.wallpaper-console.welcome',
        rendererKey: 'sample.wallpaper-console.welcome',
        containerKeys: ['main'],
        displayModes: ['SECONDARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER', 'SLAVE'],
        title: '顾客欢迎页',
        surfaceForm: ['laptop'],
        layerTier: 'standard',
        layerGuard: 'dismissible',
      },
    ]);
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
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample2-surface-override-${Date.now()}`,
      surfaceForm: 'mobile',
      terminalSurfaces: override,
    });
    try {
      expect(assembly.surfaceDeclarations).toEqual(override.orientations.portrait);
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('keeps one logical canvas for laptop dual surfaces and rejects mobile secondary', async () => {
    const laptop = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
      persistenceKey: `sample2-surface-laptop-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    const mobile = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1}),
      persistenceKey: `sample2-surface-mobile-${Date.now()}`,
      surfaceForm: 'mobile',
    });
    let laptopPrimary: TestRenderer | undefined;
    let laptopSecondary: TestRenderer | undefined;
    let mobilePrimary: TestRenderer | undefined;
    try {
      laptopPrimary = await mount(createSurfaceForDisplayIndex(laptop, 0));
      laptopSecondary = await mount(createSurfaceForDisplayIndex(laptop, 1));
      mobilePrimary = await mount(createSurfaceForDisplayIndex(mobile, 0));
      expect(getNode(laptopPrimary, 'ui-base-render:surface-host-canvas').props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({width: 1280, height: 720})]),
      );
      expect(getNode(laptopSecondary, 'ui-base-render:surface-host-canvas').props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({width: 1280, height: 720})]),
      );
      expect(getNode(mobilePrimary, 'ui-base-render:surface-host-canvas').props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({width: 360, height: 640})]),
      );
      expect(() => createSurfaceForDisplayIndex(mobile, 1)).toThrow(/unavailable for mobile/);
    } finally {
      if (laptopPrimary !== undefined) await laptopPrimary.unmount();
      if (laptopSecondary !== undefined) await laptopSecondary.unmount();
      if (mobilePrimary !== undefined) await mobilePrimary.unmount();
      await releaseRuntimeForTestAsync(laptop.runtime);
      await releaseRuntimeForTestAsync(mobile.runtime);
    }
  });

  it('keeps one startup completion across a real-part navigation in one runtime', async () => {
    const events: LogEvent[] = [];
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1, events, deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample2-single-startup-completion-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createPrimaryHostSource()},
    });
    let renderer: TestRenderer | undefined;
    const layoutReadyBoundary = async () => {
      const boundaries = queryNodes(renderer!, 'ui-base-render:screen-ready-boundary');
      await act(async () => {
        for (const boundary of boundaries) {
          (boundary.props.onLayout as (event: unknown) => void)({
            nativeEvent: {layout: PRIMARY_FRAME},
          });
        }
      });
    };
    try {
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0));
      await measurePrimarySurface(renderer);
      await layoutReadyBoundary();
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await activateForTest(assembly);
        const result = await assembly.runtime.dispatchCommand(
          loginCommand,
          {operatorName: 'A001', passcode: '1111'},
          dispatchOptions(),
        );
        expect(result.status).toBe('completed');
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(getNode(renderer, wallpaperPickerTestIds.root)).toBeDefined();
      await layoutReadyBoundary();
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(events.filter(event => event.event === 'startup.complete')).toHaveLength(1);
      const complete = events.find(event => event.event === 'startup.complete');
      expect(complete?.data).toHaveProperty('primaryReadyPartKey');
      expect(complete?.data).toHaveProperty('primaryContentFailure');
      expect(events.some(event => event.event === 'startup.ready-failed')).toBe(false);
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('records a visible content failure in the shared startup completion facts', async () => {
    const events: LogEvent[] = [];
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({events}),
      persistenceKey: `sample2-startup-content-failure-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createPrimaryHostSource()},
    });
    let renderer: TestRenderer | undefined;
    try {
      const selection = await assembly.runtime.dispatchCommand(
        showScreenCommand,
        {
          displayMode: 'PRIMARY',
          containerKey: 'main',
          partKey: 'sample.wallpaper-console.missing-part',
        },
        {
          requestId: createRequestId(),
          routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
        },
      );
      expect(selection.status).toBe('completed');
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0));
      await measurePrimarySurface(renderer);
      await reportPrimaryReadyLayout(renderer, PRIMARY_FRAME);
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
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({events, failStartupReadyCount: 1}),
      persistenceKey: `sample2-startup-retry-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createPrimaryHostSource()},
    });
    let renderer: TestRenderer | undefined;
    try {
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0));
      await measurePrimarySurface(renderer);
      await reportPrimaryReadyLayout(renderer, PRIMARY_FRAME);
      expect(events.filter(event => event.event === 'startup.complete')).toHaveLength(0);
      expect(events.filter(event => event.event === 'startup.ready-dispatch-failed')).toHaveLength(1);
      expect(events.find(event => event.event === 'startup.ready-dispatch-failed')?.data?.errorName).toBe('Error');

      await renderer!.unmount();
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0));
      await measurePrimarySurface(renderer);
      await reportPrimaryReadyLayout(renderer, PRIMARY_FRAME);
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

  it('declares current peer staff, member, and confirmed wallpaper projections for a paired slave', async () => {
    const peer = new TestPeerChannel();
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1}),
      persistenceKey: `sample2-sync-slices-${Date.now()}`,
      surfaceForm: 'laptop',
      topologyPeerChannel: peer,
    });
    try {
      await openTestPeerAsSlave(peer);
      const sliceNames = stateFullSliceNames(peer);
      expect(sliceNames).toContain('kernel.feature.sample-wallpaper.selection');
      expect(sliceNames).toContain('kernel.feature.sample-staff-session.session');
      expect(sliceNames).not.toContain('kernel.feature.sample-member-registry.members');
    } finally {
      await peer.dispose();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('selects the form-specific wallpaper renderer at the real integration surface', async () => {
    const assemblies = await Promise.all(
      (['laptop', 'mobile'] as const).map(async surfaceForm => {
        const assembly = await createSampleWallpaperConsoleAssembly({
          platformPorts: createTestPlatformPorts({
            displayCount: surfaceForm === 'laptop' ? 2 : 1,
            deviceInfo: ACTIVATION_DEVICE_INFO,
          }),
          persistenceKey: `sample2-form-renderer-${surfaceForm}-${Date.now()}`,
          surfaceForm,
        });
        await readyAndActivateForTest(assembly);
        await loginForTest(assembly);
        return assembly;
      }),
    );
    const renderers: TestRenderer[] = [];
    try {
      for (const assembly of assemblies) {
        const renderer = await mount(createSurfaceForDisplayIndex(assembly, 0));
        renderers.push(renderer);
        await measurePrimarySurface(renderer);
        const picker = getNode(renderer, wallpaperPickerTestIds.root);
        const options = getNode(renderer, wallpaperPickerTestIds.options);
        const style = StyleSheet.flatten(picker.props.style);
        if (assembly.surfaceForm === 'laptop') {
          expect(style).toMatchObject({maxWidth: 960, alignSelf: 'center'});
          expect(StyleSheet.flatten(options.props.style)).toMatchObject({flexShrink: 0});
        } else {
          expect(style).toMatchObject({paddingHorizontal: 8, gap: 3});
          expect(StyleSheet.flatten(options.props.style)).toMatchObject({flexDirection: 'column'});
        }
      }
    } finally {
      for (const renderer of renderers) await renderer.unmount();
      for (const assembly of assemblies) await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('integrates the shared admin console on laptop and mobile primary surfaces', async () => {
    const assemblies = await Promise.all(
      (['laptop', 'mobile'] as const).map(surfaceForm =>
        createSampleWallpaperConsoleAssembly({
          platformPorts: createTestPlatformPorts({displayCount: surfaceForm === 'laptop' ? 2 : 1}),
          persistenceKey: `sample2-admin-integration-${surfaceForm}-${Date.now()}`,
          surfaceForm,
          showAdminPassword: true,
        }),
      ),
    );
    const renderers: TestRenderer[] = [];
    try {
      for (const assembly of assemblies) {
        await assembly.runtime.dispatchCommand(
          openLayerCommand,
          {
            displayMode: 'PRIMARY',
            layerId: ADMIN_CONSOLE_LAYER_ID,
            partKey: ADMIN_CONSOLE_PART_KEY,
          },
          dispatchOptions(),
        );
        const renderer = await mount(createSurfaceForDisplayIndex(assembly, 0));
        renderers.push(renderer);
        await measurePrimarySurface(renderer);
        expect(getNode(renderer, adminTestIds.login)).toBeDefined();
        expect(renderer.getByText(/^（\d{6}）$/)).toBeDefined();
        await authenticateAdmin(renderer);
        if (assembly.surfaceForm === 'mobile') {
          expect(getNode(renderer, 'terminal.admin:navigation')).toBeDefined();
          await act(async () => {
            await press(renderer, 'terminal.admin:navigation:trigger');
            await new Promise(resolve => setTimeout(resolve, 0));
          });
          for (const partKey of ['admin.console.platform-ports', 'admin.console.runtime', 'admin.console.topology']) {
            expect(getNode(renderer, `terminal.admin:navigation:option:${partKey}`)).toBeDefined();
          }
          await act(async () => {
            await press(renderer, 'terminal.admin:navigation:option:admin.console.runtime');
            await new Promise(resolve => setTimeout(resolve, 0));
          });
        } else {
          for (const sectionTestID of [
            adminTestIds.sections.platformPorts,
            adminTestIds.sections.runtime,
            adminTestIds.sections.topology,
          ]) {
            expect(getNode(renderer, sectionTestID)).toBeDefined();
          }
        }
        expect(selectLayers(assembly.runtime.getState(), 'PRIMARY')).toEqual(
          expect.arrayContaining([expect.objectContaining({layerId: ADMIN_CONSOLE_LAYER_ID})]),
        );
      }
    } finally {
      for (const renderer of renderers) await renderer.unmount();
      for (const assembly of assemblies) await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('keeps primary business parts as distinct laptop/mobile siblings and secondary parts laptop-only', async () => {
    const primaryParts = [...sampleStaffAuthAssembly.parts, ...sampleWallpaperPickerAssembly.parts];
    const pairedKeys = new Set(
      primaryParts.filter(part => part.catalogEntry.surfaceForm.includes('mobile')).map(part => part.catalogEntry.partKey),
    );
    const pairedParts = primaryParts.filter(part => pairedKeys.has(part.catalogEntry.partKey));
    const groups = new Map<string, (typeof pairedParts)[number][]>();
    for (const part of pairedParts) {
      const siblings = groups.get(part.catalogEntry.partKey) ?? [];
      siblings.push(part);
      groups.set(part.catalogEntry.partKey, siblings);
    }
    for (const siblings of groups.values()) {
      expect(siblings).toHaveLength(2);
      expect(siblings.map(part => part.catalogEntry.surfaceForm).sort()).toEqual([['laptop'], ['mobile']]);
      expect(new Set(siblings.map(part => part.rendererBinding.component)).size).toBe(2);
      expect(new Set(siblings.map(part => part.rendererBinding.rendererKey)).size).toBe(2);
    }

    expect(wallpaperConsoleParts.map(part => part.catalogEntry.surfaceForm)).toEqual([['laptop'], ['laptop']]);
    expect(new Set(wallpaperConsoleParts.map(part => part.rendererBinding.component)).size).toBe(2);
  });

  it('allows waiting, welcome and the host wallpaper projection on a topology secondary', async () => {
    expect(
      wallpaperConsoleParts
        .filter(
          part =>
            part.catalogEntry.displayModes.includes('SECONDARY') && part.catalogEntry.instanceModes.includes('SLAVE'),
        )
        .map(part => part.catalogEntry.partKey),
      ).toEqual(['sample.wallpaper-console.waiting', 'sample.wallpaper-console.welcome']);
    expect(
      sampleWallpaperPickerAssembly.parts
        .filter(part => part.catalogEntry.displayModes.includes('SECONDARY'))
        .map(part => part.catalogEntry.partKey),
    ).toEqual(['sample.wallpaper.host-display']);
  });

  it('routes session placement through one catalog and does not create a secondary on mobile', async () => {
    const events: LogEvent[] = [];
    const laptop = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2, events, deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample2-placement-laptop-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    const mobile = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1, events, deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample2-placement-mobile-${Date.now()}`,
      surfaceForm: 'mobile',
    });
    try {
      await readyAndActivateForTest(laptop);
      expect(
        events
          .filter(event => event.event === 'sample-wallpaper-console.stage-observed')
          .map(event => event.data?.stage),
      ).toContain('staff');
      expect(
        events.filter(event =>
          ['sample-wallpaper-console.reconcile-rejected', 'sample-wallpaper-console.reconcile-failed'].includes(
            event.event,
          ),
        ),
      ).toEqual([]);
      expect(selectScreen(laptop.runtime.getState(), 'SECONDARY', 'main')?.partKey).toBe('sample.wallpaper-console.waiting');
      await loginForTest(laptop);
      expect(selectScreen(laptop.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.wallpaper.picker');
      expect(selectScreen(laptop.runtime.getState(), 'SECONDARY', 'main')?.partKey).toBe('sample.wallpaper.host-display');
      await logoutForTest(laptop);
      expect(selectScreen(laptop.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.auth.login');
      expect(selectScreen(laptop.runtime.getState(), 'SECONDARY', 'main')?.partKey).toBe('sample.wallpaper-console.waiting');

      await readyAndActivateForTest(mobile);
      await loginForTest(mobile);
      expect(selectScreen(mobile.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.wallpaper.picker');
      expect(selectScreen(mobile.runtime.getState(), 'SECONDARY', 'main')).toBeUndefined();
      expect(
        events.some(
          event =>
            event.event === 'sample-wallpaper-console.secondary-placement' && event.data?.secondaryAvailable === false,
        ),
      ).toBe(true);
    } finally {
      await releaseRuntimeForTestAsync(laptop.runtime);
      await releaseRuntimeForTestAsync(mobile.runtime);
    }
  });

  it('routes a successful local picker exit to the confirmed wallpaper display without logging out', async () => {
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1}),
      persistenceKey: `sample2-picker-exit-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    try {
      await assembly.runtime.dispatchCommand(loginCommand, {operatorName: 'A001', passcode: '1111'}, dispatchOptions());
      await assembly.runtime.dispatchCommand(
        wallpaperPickerExitRequestedCommand,
        {},
        {
          requestId: createRequestId(),
          routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
        },
      );
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.wallpaper.home');
      expect(selectSessionState(assembly.runtime.getState()).status).toBe('authenticated');
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('places the secondary on a paired single-screen master through topology facts', async () => {
    const events: LogEvent[] = [];
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1, events}),
      persistenceKey: `sample2-paired-single-screen-master-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    try {
      assembly.runtime.getStore().dispatch(
        topologyActions.setPeerIdentity({
          protocolVersion: 1,
          moduleName: 'ui.integration.sample-wallpaper-console',
          nodeId: 'paired-slave',
          displayName: 'paired slave',
          instanceMode: 'SLAVE',
          displayRole: 'VICE',
        }),
      );
      await assembly.runtime.dispatchCommand(
        startupReadyCommand,
        {surfaceKey: 'PRIMARY', displayIndex: 0, readyPartKey: 'terminal.activation.lmp', contentFailure: null},
        dispatchOptions(),
      );
      expect(selectScreen(assembly.runtime.getState(), 'SECONDARY', 'main')?.partKey).toBe(
        'terminal.activation.lms',
      );
      expect(
        events.some(
          event =>
            event.event === 'sample-wallpaper-console.secondary-placement' &&
            event.data?.hasTopologySecondarySurface === true &&
            event.data?.secondaryAvailable === true,
        ),
      ).toBe(true);
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('prunes a persisted laptop-only secondary container when hydrating the mobile assembly', async () => {
    const plainStorage = createProcessMemoryStateStoragePort();
    const protectedStorage = createProcessMemoryStateStoragePort();
    const events: LogEvent[] = [];
    const persistenceKey = `sample2-cross-form-container-${Date.now()}`;
    let laptop: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>> | undefined;
    let mobile: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>> | undefined;
    try {
      laptop = await createSampleWallpaperConsoleAssembly({
        platformPorts: createTestPlatformPorts({
          displayCount: 2,
          events,
          plainStorage,
          protectedStorage,
          deviceInfo: ACTIVATION_DEVICE_INFO,
        }),
        persistenceKey,
        surfaceForm: 'laptop',
      });
      await readyAndActivateForTest(laptop);
      expect(selectScreen(laptop.runtime.getState(), 'SECONDARY', 'main')?.partKey).toBe(
        'sample.wallpaper-console.waiting',
      );
      await waitForPersistedValues([plainStorage, protectedStorage], ['sample.wallpaper-console.waiting']);
      await releaseRuntimeForTestAsync(laptop.runtime);
      laptop = undefined;

      mobile = await createSampleWallpaperConsoleAssembly({
        platformPorts: createTestPlatformPorts({
          displayCount: 1,
          events,
          plainStorage,
          protectedStorage,
        }),
        persistenceKey,
        surfaceForm: 'mobile',
      });
      expect(selectScreen(mobile.runtime.getState(), 'SECONDARY', 'main')).toBeUndefined();
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'ui-state-hydration.container.not-renderable',
            data: expect.objectContaining({
              displayMode: 'SECONDARY',
              containerKey: 'main',
              partKey: 'sample.wallpaper-console.waiting',
              reason: 'hydrated-container-not-renderable',
            }),
          }),
        ]),
      );
    } finally {
      if (laptop !== undefined) releaseRuntimeForTestAsync(laptop.runtime);
      if (mobile !== undefined) releaseRuntimeForTestAsync(mobile.runtime);
    }
  });

  it('renders the same confirmed wallpaper selector on both laptop surfaces', async () => {
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2, deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample2-background-laptop-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    let primary: TestRenderer | undefined;
    let secondary: TestRenderer | undefined;
    try {
      await assembly.runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w2'}, dispatchOptions());
      await assembly.runtime.dispatchCommand(confirmWallpaperCommand, {}, dispatchOptions());
      expect(selectWallpaperId(assembly.runtime.getState())).toBe('w2');
      expect(selectPendingWallpaperId(assembly.runtime.getState())).toBeUndefined();
      primary = await mount(createSurfaceForDisplayIndex(assembly, 0));
      secondary = await mount(createSurfaceForDisplayIndex(assembly, 1));
      expect(queryNodes(primary, 'sample.wallpaper.background')).toHaveLength(1);
      expect(queryNodes(secondary, 'sample.wallpaper.background')).toHaveLength(1);
      expect(getNode(primary, 'sample.wallpaper.background').props.source).toBe(
        getNode(secondary, 'sample.wallpaper.background').props.source,
      );
      expect(queryNodes(primary, wallpaperPickerTestIds.root)).toHaveLength(0);

      const firstSource = getNode(primary, 'sample.wallpaper.background').props.source;
      await primary.unmount();
      await secondary.unmount();
      primary = undefined;
      secondary = undefined;

      await assembly.runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w3'}, dispatchOptions());
      await assembly.runtime.dispatchCommand(confirmWallpaperCommand, {}, dispatchOptions());
      primary = await mount(createSurfaceForDisplayIndex(assembly, 0));
      secondary = await mount(createSurfaceForDisplayIndex(assembly, 1));
      const nextPrimarySource = getNode(primary, 'sample.wallpaper.background').props.source;
      expect(nextPrimarySource).not.toBe(firstSource);
      expect(nextPrimarySource).toBe(getNode(secondary, 'sample.wallpaper.background').props.source);
    } finally {
      if (primary !== undefined) await primary.unmount();
      if (secondary !== undefined) await secondary.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('keeps picker, waiting, and host confirmed wallpaper containers transparent', async () => {
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2, deviceInfo: ACTIVATION_DEVICE_INFO}),
      persistenceKey: `sample2-transparent-consumers-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    let waiting: TestRenderer | undefined;
    let primary: TestRenderer | undefined;
    let secondary: TestRenderer | undefined;
    const containerFor = (renderer: TestRenderer, testID: string) => {
      return getNode(renderer, testID);
    };
    try {
      await readyAndActivateForTest(assembly);
      waiting = await mount(createSurfaceForDisplayIndex(assembly, 1));
      expect(containerFor(waiting, 'sample.wallpaper-console.waiting').props.className).toContain('flex-1 p-6 gap-4');
      await waiting.unmount();
      waiting = undefined;

      await loginForTest(assembly);
      primary = await mount(createSurfaceForDisplayIndex(assembly, 0));
      secondary = await mount(createSurfaceForDisplayIndex(assembly, 1));
      expect(containerFor(primary, wallpaperPickerTestIds.root).props.className).toContain('flex-1 p-6 gap-4');
      expect(containerFor(secondary, 'sample.wallpaper.host-display').props.className).toContain('flex-1 p-6 gap-4');
    } finally {
      if (waiting !== undefined) await waiting.unmount();
      if (primary !== undefined) await primary.unmount();
      if (secondary !== undefined) await secondary.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('keeps picker as the primary interactive content after authenticated placement', async () => {
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1}),
      persistenceKey: `sample2-picker-placement-${Date.now()}`,
      surfaceForm: 'mobile',
    });
    let renderer: TestRenderer | undefined;
    try {
      await assembly.runtime.dispatchCommand(
        showScreenCommand,
        {
          displayMode: 'PRIMARY',
          containerKey: 'main',
          partKey: 'sample.wallpaper.picker',
        },
        dispatchOptions(),
      );
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0));
      expect(getNode(renderer, wallpaperPickerTestIds.root)).toBeDefined();
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY')).toEqual([]);
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('restores confirmed wallpaper, pending choice, business screen, and admin layer after restart', async () => {
    const plainStorage = createProcessMemoryStateStoragePort();
    const protectedStorage = createProcessMemoryStateStoragePort();
    const persistenceKey = 'sample2-cold-restart-state';
    let firstAssembly: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>> | undefined;
    let secondAssembly: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>> | undefined;
    let renderer: TestRenderer | undefined;
    try {
      firstAssembly = await createSampleWallpaperConsoleAssembly({
        platformPorts: createTestPlatformPorts({
          displayCount: 2,
          plainStorage,
          protectedStorage,
          deviceInfo: ACTIVATION_DEVICE_INFO,
        }),
        persistenceKey,
        surfaceForm: 'laptop',
      });
      await readyAndActivateForTest(firstAssembly);
      await loginForTest(firstAssembly);
      await firstAssembly.runtime.dispatchCommand(
        openLayerCommand,
        {
          displayMode: 'PRIMARY',
          layerId: ADMIN_CONSOLE_LAYER_ID,
          partKey: ADMIN_CONSOLE_PART_KEY,
        },
        dispatchOptions(),
      );
      await firstAssembly.runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w2'}, dispatchOptions());
      await firstAssembly.runtime.dispatchCommand(confirmWallpaperCommand, {}, dispatchOptions());
      await firstAssembly.runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w3'}, dispatchOptions());
      const businessPartKey = selectScreen(firstAssembly.runtime.getState(), 'PRIMARY', 'main')?.partKey;
      expect(businessPartKey).toBe('sample.wallpaper.picker');
      await waitForPersistedValues([plainStorage, protectedStorage], [
        'w2',
        'w3',
        ADMIN_CONSOLE_LAYER_ID,
        'sample.wallpaper.picker',
        'A001',
        'terminal-wallpaper-test',
      ]);
      await releaseRuntimeForTestAsync(firstAssembly.runtime);
      firstAssembly = undefined;

      secondAssembly = await createSampleWallpaperConsoleAssembly({
        platformPorts: createTestPlatformPorts({
          displayCount: 2,
          plainStorage,
          protectedStorage,
        }),
        persistenceKey,
        surfaceForm: 'laptop',
      });
      expect(selectWallpaperId(secondAssembly.runtime.getState())).toBe('w2');
      expect(selectPendingWallpaperId(secondAssembly.runtime.getState())).toBe('w3');
      expect(selectScreen(secondAssembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: businessPartKey,
      });
      expect(selectLayers(secondAssembly.runtime.getState(), 'PRIMARY')).toEqual(
        expect.arrayContaining([expect.objectContaining({layerId: ADMIN_CONSOLE_LAYER_ID})]),
      );
      renderer = await mount(createSurfaceForDisplayIndex(secondAssembly, 0));
      expect(getNode(renderer, adminTestIds.login)).toBeDefined();
      expect(getNode(renderer, wallpaperPickerTestIds.confirm).props.disabled).toBe(false);
    } finally {
      if (renderer !== undefined) await renderer!.unmount();
      if (firstAssembly !== undefined) releaseRuntimeForTestAsync(firstAssembly.runtime);
      if (secondAssembly !== undefined) releaseRuntimeForTestAsync(secondAssembly.runtime);
    }
  });
});
