import {act, fireEvent, render, type RenderResult} from '@testing-library/react-native';
import type {ReactElement} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {StyleSheet} from 'react-native';
import {
  advanceAnimatedTimingsForTests,
  setAnimatedTimingAutoFinishForTests,
} from '../../../../../../tools/terminal-shared/react-native-vitest-entry';
import {createProcessMemoryStateStoragePort, type LogEvent} from '@catering-v2s/kernel-base-platform-ports';
import {
  loginCommand,
  loginSucceededCommand,
  logoutSucceededCommand,
  sessionRestoredAnonymousCommand,
  sessionRestoredAuthenticatedCommand,
} from '@catering-v2s/kernel-feature-sample-staff-session';
import {ADMIN_CONSOLE_LAYER_ID, ADMIN_CONSOLE_PART_KEY, adminTestIds} from '@catering-v2s/ui-base-admin-shell';
import {openLayerCommand, selectLayers, selectScreen, showScreenCommand} from '@catering-v2s/kernel-base-ui-state';
import {
  confirmWallpaperCommand,
  selectWallpaperCommand,
  selectPendingWallpaperId,
  selectWallpaperId,
} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing';
import {topologyActions} from '@catering-v2s/kernel-base-topology';
import {
  createSurfaceForDisplayIndex,
  createSampleWallpaperConsoleAssembly as createProductionSampleWallpaperConsoleAssembly,
  parts as wallpaperConsoleParts,
} from '../src';
import {sampleWallpaperPickerAssembly, wallpaperPickerTestIds} from '@catering-v2s/ui-feature-sample-wallpaper-picker';
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth';
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
  const {withNativeTestHosts} = await import('../../../../../../tools/terminal-shared/rntl-native-test-host');
  return withNativeTestHosts(actual);
});

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

const createSampleWallpaperConsoleAssembly = (input: TestWallpaperConsoleAssemblyInput) =>
  createProductionSampleWallpaperConsoleAssembly({
    ...input,
    nativeLoadingCapability: input.platformPorts.nativeLoadingCapability,
  });

const PRIMARY_FRAME = {width: 360, height: 640} as const;

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
      releaseRuntimeForTest(assembly.runtime);
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
      if (laptopPrimary !== undefined)
        await act(async () => {
          laptopPrimary!.unmount();
        });
      if (laptopSecondary !== undefined)
        await act(async () => {
          laptopSecondary!.unmount();
        });
      if (mobilePrimary !== undefined)
        await act(async () => {
          mobilePrimary!.unmount();
        });
      releaseRuntimeForTest(laptop.runtime);
      releaseRuntimeForTest(mobile.runtime);
    }
  });

  it('keeps one startup completion across a real-part navigation in one runtime', async () => {
    const events: LogEvent[] = [];
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1, events}),
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
        const result = await assembly.runtime.dispatchCommand(
          loginSucceededCommand,
          {operatorName: 'Alice'},
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
      if (renderer !== undefined)
        await act(async () => {
          renderer!.unmount();
        });
      releaseRuntimeForTest(assembly.runtime);
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
      if (renderer !== undefined)
        await act(async () => {
          renderer!.unmount();
        });
      releaseRuntimeForTest(assembly.runtime);
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

      await act(async () => {
        renderer!.unmount();
      });
      renderer = await mount(createSurfaceForDisplayIndex(assembly, 0));
      await measurePrimarySurface(renderer);
      await reportPrimaryReadyLayout(renderer, PRIMARY_FRAME);
      expect(events.filter(event => event.event === 'startup.ready-dispatch-failed')).toHaveLength(1);
      expect(events.filter(event => event.event === 'startup.complete')).toHaveLength(1);
      expect(events.filter(event => event.event === 'startup.ready-dispatch-start')).toHaveLength(2);
      expect(
        events.filter(event => event.event === 'startup.ready-dispatch-result').map(event => event.data?.status),
      ).toEqual(['error', 'completed']);
    } finally {
      if (renderer !== undefined)
        await act(async () => {
          renderer!.unmount();
        });
      releaseRuntimeForTest(assembly.runtime);
    }
  });

  it('excludes isolated wallpaper and session slices from topology state transfer', async () => {
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
      expect(sliceNames).not.toContain('kernel.feature.sample-wallpaper.selection');
      expect(sliceNames).not.toContain('kernel.feature.sample-staff-session.session');
      expect(sliceNames).not.toContain('kernel.feature.sample-member-registry.members');
    } finally {
      await peer.dispose();
      releaseRuntimeForTest(assembly.runtime);
    }
  });

  it('selects the form-specific wallpaper renderer at the real integration surface', async () => {
    const assemblies = await Promise.all(
      (['laptop', 'mobile'] as const).map(async surfaceForm => {
        const assembly = await createSampleWallpaperConsoleAssembly({
          platformPorts: createTestPlatformPorts({displayCount: surfaceForm === 'laptop' ? 2 : 1}),
          persistenceKey: `sample2-form-renderer-${surfaceForm}-${Date.now()}`,
          surfaceForm,
        });
        await assembly.runtime.dispatchCommand(loginSucceededCommand, {operatorName: 'Alice'}, dispatchOptions());
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
      for (const renderer of renderers)
        await act(async () => {
          renderer.unmount();
        });
      for (const assembly of assemblies) releaseRuntimeForTest(assembly.runtime);
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
      for (const renderer of renderers)
        await act(async () => {
          renderer.unmount();
        });
      for (const assembly of assemblies) releaseRuntimeForTest(assembly.runtime);
    }
  });

  it('keeps primary business parts as distinct laptop/mobile siblings and secondary parts laptop-only', async () => {
    const primaryParts = [...sampleStaffAuthAssembly.parts, ...sampleWallpaperPickerAssembly.parts];
    const groups = new Map<string, (typeof primaryParts)[number][]>();
    for (const part of primaryParts) {
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

  it('allows only waiting and welcome parts on a topology secondary', async () => {
    expect(
      wallpaperConsoleParts
        .filter(
          part =>
            part.catalogEntry.displayModes.includes('SECONDARY') && part.catalogEntry.instanceModes.includes('SLAVE'),
        )
        .map(part => part.catalogEntry.partKey),
    ).toEqual(['sample.wallpaper-console.waiting', 'sample.wallpaper-console.welcome']);
  });

  it('routes session placement through one catalog and does not create a secondary on mobile', async () => {
    const events: LogEvent[] = [];
    const laptop = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2, events}),
      persistenceKey: `sample2-placement-laptop-${Date.now()}`,
      surfaceForm: 'laptop',
    });
    const mobile = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1, events}),
      persistenceKey: `sample2-placement-mobile-${Date.now()}`,
      surfaceForm: 'mobile',
    });
    try {
      await laptop.runtime.dispatchCommand(sessionRestoredAnonymousCommand, {}, dispatchOptions());
      expect(selectScreen(laptop.runtime.getState(), 'SECONDARY', 'main')?.partKey).toBe(
        'sample.wallpaper-console.waiting',
      );
      await laptop.runtime.dispatchCommand(
        sessionRestoredAuthenticatedCommand,
        {operatorName: 'Alice'},
        dispatchOptions(),
      );
      expect(selectScreen(laptop.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.wallpaper.picker');
      expect(selectScreen(laptop.runtime.getState(), 'SECONDARY', 'main')?.partKey).toBe(
        'sample.wallpaper-console.welcome',
      );
      await laptop.runtime.dispatchCommand(logoutSucceededCommand, {}, dispatchOptions());
      expect(selectScreen(laptop.runtime.getState(), 'SECONDARY', 'main')?.partKey).toBe(
        'sample.wallpaper-console.waiting',
      );

      await mobile.runtime.dispatchCommand(loginSucceededCommand, {operatorName: 'Alice'}, dispatchOptions());
      expect(selectScreen(mobile.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.wallpaper.picker');
      expect(selectScreen(mobile.runtime.getState(), 'SECONDARY', 'main')).toBeUndefined();
      expect(
        events.some(
          event =>
            event.event === 'sample-wallpaper-console.secondary-placement' && event.data?.secondaryAvailable === false,
        ),
      ).toBe(true);
    } finally {
      releaseRuntimeForTest(laptop.runtime);
      releaseRuntimeForTest(mobile.runtime);
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
      await assembly.runtime.dispatchCommand(sessionRestoredAnonymousCommand, {}, dispatchOptions());
      expect(selectScreen(assembly.runtime.getState(), 'SECONDARY', 'main')?.partKey).toBe(
        'sample.wallpaper-console.waiting',
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
      releaseRuntimeForTest(assembly.runtime);
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
        }),
        persistenceKey,
        surfaceForm: 'laptop',
      });
      await laptop.runtime.dispatchCommand(sessionRestoredAnonymousCommand, {}, dispatchOptions());
      expect(selectScreen(laptop.runtime.getState(), 'SECONDARY', 'main')?.partKey).toBe(
        'sample.wallpaper-console.waiting',
      );
      await new Promise(resolve => setTimeout(resolve, 350));
      releaseRuntimeForTest(laptop.runtime);
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
      if (laptop !== undefined) releaseRuntimeForTest(laptop.runtime);
      if (mobile !== undefined) releaseRuntimeForTest(mobile.runtime);
    }
  });

  it('renders the same confirmed wallpaper selector on both laptop surfaces', async () => {
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
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
      await act(async () => {
        primary!.unmount();
        secondary!.unmount();
      });
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
      if (primary !== undefined)
        await act(async () => {
          primary!.unmount();
        });
      if (secondary !== undefined)
        await act(async () => {
          secondary!.unmount();
        });
      releaseRuntimeForTest(assembly.runtime);
    }
  });

  it('keeps picker, waiting, and welcome containers transparent for the wallpaper layer', async () => {
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
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
      await assembly.runtime.dispatchCommand(sessionRestoredAnonymousCommand, {}, dispatchOptions());
      waiting = await mount(createSurfaceForDisplayIndex(assembly, 1));
      expect(containerFor(waiting, 'sample.wallpaper-console.waiting').props.className).toContain('flex-1 p-6 gap-4');
      await act(async () => {
        waiting!.unmount();
      });
      waiting = undefined;

      await assembly.runtime.dispatchCommand(loginSucceededCommand, {operatorName: 'Alice'}, dispatchOptions());
      primary = await mount(createSurfaceForDisplayIndex(assembly, 0));
      secondary = await mount(createSurfaceForDisplayIndex(assembly, 1));
      expect(containerFor(primary, wallpaperPickerTestIds.root).props.className).toContain('flex-1 p-6 gap-4');
      expect(containerFor(secondary, 'sample.wallpaper-console.welcome').props.className).toContain('flex-1 p-6 gap-4');
    } finally {
      if (waiting !== undefined)
        await act(async () => {
          waiting!.unmount();
        });
      if (primary !== undefined)
        await act(async () => {
          primary!.unmount();
        });
      if (secondary !== undefined)
        await act(async () => {
          secondary!.unmount();
        });
      releaseRuntimeForTest(assembly.runtime);
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
      if (renderer !== undefined)
        await act(async () => {
          renderer!.unmount();
        });
      releaseRuntimeForTest(assembly.runtime);
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
        }),
        persistenceKey,
        surfaceForm: 'laptop',
      });
      await firstAssembly.runtime.dispatchCommand(
        loginCommand,
        {
          operatorName: 'A001',
          passcode: '1111',
        },
        dispatchOptions(),
      );
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
      await new Promise(resolve => setTimeout(resolve, 350));
      releaseRuntimeForTest(firstAssembly.runtime);
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
      if (renderer !== undefined)
        await act(async () => {
          renderer!.unmount();
        });
      if (firstAssembly !== undefined) releaseRuntimeForTest(firstAssembly.runtime);
      if (secondAssembly !== undefined) releaseRuntimeForTest(secondAssembly.runtime);
    }
  });
});
