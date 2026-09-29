import {act, render, type RenderResult} from '@testing-library/react-native';
import {createElement, Fragment, type ComponentType, type ReactElement} from 'react';
import {Animated, BackHandler, StyleSheet, Text, TextInput, View} from 'react-native';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {LogEvent, LogWriteInput, LogWriteResult, LoggerPort} from '@catering-v2s/kernel-base-platform-ports';
import {defineCommand, type Runtime} from '@catering-v2s/kernel-base-runtime';
import {createCommandId} from '@catering-v2s/kernel-base-contracts';
import {
  createRendererCatalog,
  bindSurfaceHostIdentity,
  definePart,
  LayerStack,
  RenderProvider,
  ScreenContainer,
  SurfacePresentationOffsetProvider,
  useSurfacePresentationOffset,
  SurfaceFocusBoundaryContext,
  SurfaceRoot,
  calculateSurfaceHostGeometry,
  dispatchWithRequestId,
  useDispatchCommand,
  type SurfaceHostSnapshot,
  type SurfaceHostMeasurementSource,
  type SurfaceHostSource,
  type RenderProviderProps,
  type SurfaceHostIdentityRejection,
} from '../src/index';
import {createUiCatalog, selectScreen} from '@catering-v2s/kernel-base-ui-state';
import {createRenderPartDiagnosticReporter} from '../src/foundations/diagnostics';
import {unusedRenderProviderBindings} from './renderProviderBindings';
import {
  getRenderedNode,
  queryRenderedSubtree,
  queryRenderedTree,
} from '../../../../../../tools/terminal-shared/rntl-rendered-tree';
import {
  resetNativeTestRefFactory,
  setNativeTestRefFactory,
  withNativeTestHosts,
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

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

type RuntimeStateRoot = ReturnType<Runtime['getState']>;

type FakeSource = Readonly<{
  readonly stateSource: {
    readonly getStatus: () => 'created' | 'started';
    readonly getState: () => RuntimeStateRoot;
    readonly subscribe: (listener: () => void) => () => void;
  };
  readonly setStatus: (status: 'created' | 'started') => void;
  readonly setRoot: (root: RuntimeStateRoot) => void;
  readonly notify: () => void;
}>;

const createSource = (): FakeSource => {
  let status: 'created' | 'started' = 'created';
  let root = Object.freeze({}) as RuntimeStateRoot;
  const listeners = new Set<() => void>();
  const stateSource = {
    getStatus: () => status,
    getState: () => root,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    stateSource,
    setStatus: nextStatus => {
      status = nextStatus;
    },
    setRoot: nextRoot => {
      root = nextRoot;
    },
    notify: () => {
      for (const listener of [...listeners]) listener();
    },
  };
};

const createLogger = (): Readonly<{logger: LoggerPort; events: LogWriteInput[]}> => {
  const events: LogWriteInput[] = [];
  const write = (input: LogWriteInput): LogWriteResult => {
    events.push(input);
    return {status: 'succeeded', value: {} as LogEvent, completedAt: 0};
  };
  const logger: LoggerPort = {
    debug: write,
    info: write,
    warn: write,
    error: write,
    scope: () => logger,
    withContext: () => logger,
  };
  return {logger, events};
};

const mount = async (element: ReactElement): Promise<RenderResult> => render(element);
const mountWithNativeTestRefs = async (
  element: ReactElement,
  resolveRef: (hostName: string, props: NativeTestHostProps) => unknown,
): Promise<RenderResult> => {
  setNativeTestRefFactory(resolveRef);
  return render(element);
};

afterEach(resetNativeTestRefFactory);

const findFallbacks = (renderer: RenderResult) =>
  queryRenderedTree(
    renderer,
    node =>
      typeof node.type === 'string' &&
      typeof node.props.testID === 'string' &&
      node.props.testID.startsWith('ui-base-render:fallback:'),
  );

const findByTestID = (renderer: RenderResult, testID: string) => renderer.getByTestId(testID);

type BackPressHandler = Parameters<typeof BackHandler.addEventListener>[1];

const emptyContent = () => ({
  contentSets: {
    PRIMARY: {containers: {}, layers: []},
    SECONDARY: {containers: {}, layers: []},
  },
});

const rootWithContent = (content: object): RuntimeStateRoot =>
  Object.freeze({
    'kernel.base.runtime.instance-mode': Object.freeze({instanceMode: 'MASTER'}),
    'kernel.base.display-context.display-role': Object.freeze({displayRole: 'CHIEF'}),
    'kernel.base.ui-state.content.MAIN': content,
    'kernel.base.ui-state.content.BRANCH': emptyContent(),
  }) as RuntimeStateRoot;

type ScreenProps = Readonly<{marker: string}>;
const Screen: ComponentType<ScreenProps> = props => createElement('render-screen', props);
type StandardLayerProps = Readonly<{marker: string}>;
const StandardLayer: ComponentType<StandardLayerProps> = props => createElement('render-layer', props);
type AlertLayerProps = Readonly<{marker: string}>;
const AlertLayer: ComponentType<AlertLayerProps> = props => createElement('render-layer', props);

const SurfacePresentationProbe = () => {
  const offset = useSurfacePresentationOffset();
  return createElement(View, {
    testID: 'surface-presentation-probe',
    style: {transform: [{translateY: offset}]},
  });
};

const part = <TProps extends object>(
  input: Readonly<{
    readonly partKey: string;
    readonly rendererKey: string;
    readonly component: ComponentType<TProps>;
    readonly layerTier?: 'standard' | 'alert';
    readonly layerGuard?: 'dismissible' | 'decisive';
    readonly containerKeys?: readonly string[];
    readonly surfaceForm?: readonly ('laptop' | 'mobile')[];
  }>,
) =>
  definePart({
    partKey: input.partKey,
    rendererKey: input.rendererKey,
    containerKeys: input.containerKeys ?? ['root'],
    displayModes: ['PRIMARY', 'SECONDARY'] as const,
    workspaces: ['MAIN'] as const,
    instanceModes: ['MASTER'] as const,
    surfaceForm: input.surfaceForm ?? (['laptop', 'mobile'] as const),
    title: input.partKey,
    description: input.partKey,
    component: input.component,
    ...(input.layerTier === undefined ? {} : {layerTier: input.layerTier}),
    ...(input.layerGuard === undefined ? {} : {layerGuard: input.layerGuard}),
  });

const hostSnapshot = (width: number, height: number): SurfaceHostSnapshot =>
  Object.freeze({
    stableHostLogicalSize: Object.freeze({width, height}),
    isHostPrimaryDisplay: true,
    surfaceIdentity: Object.freeze({
      surfaceKey: 'PRIMARY',
      displayIndex: 0,
      surfaceForm: 'laptop',
      displayMode: 'PRIMARY',
    }),
  });

const createHostSource = (initial: SurfaceHostSnapshot | null) => {
  let current = initial;
  const listeners = new Set<(snapshot: SurfaceHostSnapshot | null) => void>();
  const source: SurfaceHostSource &
    Readonly<{
      readonly emit: (snapshot: SurfaceHostSnapshot | null) => void;
    }> = {
    getSnapshot: () => current,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: snapshot => {
      current = snapshot;
      for (const listener of [...listeners]) listener(snapshot);
    },
  };
  return source;
};

describe('render surface hosts', () => {
  it('keeps the admin layer mounted when surface-owned content fails', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const AdminConsoleLayer: ComponentType<object> = () =>
      createElement(View, {testID: 'admin-console-layer'}, createElement(Text, null, 'Admin console'));
    const adminLayer = part({
      partKey: 'test.admin-console-layer',
      rendererKey: 'test.admin-console-layer.renderer',
      component: AdminConsoleLayer,
      containerKeys: [],
    });
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {}, layers: [{layerId: 'admin.console.layer', partKey: 'test.admin-console-layer', openedAt: 1}]},
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');
    const BrokenSurfaceContent: ComponentType<object> = () => {
      throw new Error('surface-owned-render-failure');
    };

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([adminLayer.catalogEntry]),
          rendererCatalog: createRendererCatalog([adminLayer.rendererBinding]),
          logger,
          ...unusedRenderProviderBindings,
        },
        createElement(
          SurfaceRoot,
          {displayMode: 'PRIMARY', containerKey: 'root'},
          createElement(BrokenSurfaceContent),
        ),
      ),
    );

    expect(renderer.getByTestId('ui-base-render:system-failure:surface-content')).toBeTruthy();
    expect(renderer.getByTestId('admin-console-layer')).toBeTruthy();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('stamps each surface dispatch with its local route context', async () => {
    const source = createSource();
    const {logger} = createLogger();
    source.setRoot(rootWithContent(emptyContent()));
    source.setStatus('started');
    const command = defineCommand<Readonly<{}>>('test.surface-route', {name: 'run', visibility: 'internal'});
    const observed: Array<Readonly<{readonly displayMode?: unknown; readonly workspace?: unknown}>> = [];
    const dispatchCommand: RenderProviderProps['dispatchCommand'] = async (_current, options) => {
      observed.push(options.routeContext ?? {});
      return {
        requestId: options.requestId ?? null,
        commandId: createCommandId(),
        status: 'completed',
        actorResults: [],
      };
    };
    const RouteProbe = ({label}: Readonly<{readonly label: string}>) => {
      const dispatch = useDispatchCommand();
      return createElement('surface-route-probe', {
        label,
        invoke: () => dispatchWithRequestId({dispatchCommand: dispatch, definition: command, payload: {}}),
      });
    };
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
          dispatchCommand,
          createRouteContext: (_root, displayMode) => ({
            displayMode,
            workspace: 'MAIN',
            instanceMode: 'MASTER',
          }),
        },
        createElement(
          SurfaceRoot,
          {
            displayMode: 'PRIMARY',
            containerKey: 'root',
          },
          createElement(RouteProbe, {label: 'primary'}),
        ),
        createElement(
          SurfaceRoot,
          {
            displayMode: 'SECONDARY',
            containerKey: 'root',
          },
          createElement(RouteProbe, {label: 'secondary'}),
        ),
      ),
    );

    const probes = queryRenderedTree(renderer, node => node.type === 'surface-route-probe');
    expect(probes).toHaveLength(2);
    await act(async () => {
      await (probes[0]!.props.invoke as () => Promise<unknown>)();
      await (probes[1]!.props.invoke as () => Promise<unknown>)();
    });
    expect(observed).toEqual([
      {displayMode: 'PRIMARY', workspace: 'MAIN', instanceMode: 'MASTER'},
      {displayMode: 'SECONDARY', workspace: 'MAIN', instanceMode: 'MASTER'},
    ]);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('transfers the physical-index host fact without deriving it from display mode', async () => {
    const source: SurfaceHostMeasurementSource = {
      getSnapshot: () =>
        Object.freeze({
          stableHostLogicalSize: Object.freeze({width: 960, height: 540}),
          isHostPrimaryDisplay: true,
        }),
      subscribe: () => () => undefined,
    };
    const bound = bindSurfaceHostIdentity(source, {
      surfaceKey: 'PRIMARY',
      displayIndex: 0,
      surfaceForm: 'laptop',
      displayMode: 'SECONDARY',
    });

    expect(bound.getSnapshot()).toMatchObject({
      isHostPrimaryDisplay: true,
      surfaceIdentity: {
        surfaceKey: 'PRIMARY',
        displayIndex: 0,
        displayMode: 'SECONDARY',
      },
    });
  });

  it('reports a typed diagnostic when a host measurement contradicts its physical display identity', async () => {
    const source: SurfaceHostMeasurementSource = {
      getSnapshot: () =>
        Object.freeze({
          stableHostLogicalSize: Object.freeze({width: 960, height: 540}),
          isHostPrimaryDisplay: false,
        }),
      subscribe: () => () => undefined,
    };
    const rejections: SurfaceHostIdentityRejection[] = [];
    const bound = bindSurfaceHostIdentity(
      source,
      {
        surfaceKey: 'PRIMARY',
        displayIndex: 0,
        surfaceForm: 'laptop',
        displayMode: 'PRIMARY',
      },
      rejection => {
        rejections.push(rejection);
      },
    );

    expect(bound.getSnapshot()).toBeNull();
    expect(rejections).toEqual([
      {
        reason: 'physical-host-flag-mismatch',
        displayIndex: 0,
        expectedIsHostPrimaryDisplay: true,
        actualIsHostPrimaryDisplay: false,
      },
    ]);
  });

  it('calculates independent scale axes from the stable host and canvas sizes', async () => {
    const geometry = calculateSurfaceHostGeometry({
      canvas: {width: 960, height: 540},
      snapshot: hostSnapshot(800, 600),
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.canvas).toEqual({width: 960, height: 540});
    expect(geometry?.host).toEqual({width: 800, height: 600});
    expect(geometry?.scaleX).toBeCloseTo(800 / 960);
    expect(geometry?.scaleY).toBeCloseTo(600 / 540);
    expect(geometry?.scaleX).not.toBe(geometry?.scaleY);
  });

  it('holds a fixed logical canvas inside the host viewport and does not pass host facts to children', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const host = createHostSource(hostSnapshot(800, 600));
    source.setRoot(rootWithContent(emptyContent()));
    source.setStatus('started');

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          canvas: {width: 960, height: 540},
          surfaceHostSource: host,
        }),
      ),
    );

    const viewport = findByTestID(renderer, 'ui-base-render:surface-host-viewport');
    const canvas = findByTestID(renderer, 'ui-base-render:surface-host-canvas');
    expect(StyleSheet.flatten(viewport.props.style)).toMatchObject({flex: 1, overflow: 'hidden'});
    expect(StyleSheet.flatten(canvas.props.style)).toMatchObject({
      width: 960,
      height: 540,
      transformOrigin: 'top left',
    });
    expect((StyleSheet.flatten(canvas.props.style) as {readonly transform?: unknown}).transform).toEqual([
      {scaleX: 800 / 960},
      {scaleY: 600 / 540},
    ]);
    expect(StyleSheet.flatten(canvas.props.style)).not.toHaveProperty('stableHostLogicalSize');
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps presentation and input geometry in the canvas unit under a non-unit host scale', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const host = createHostSource(hostSnapshot(800, 600));
    const presentationOffset = new Animated.Value(-246);
    source.setRoot(rootWithContent(emptyContent()));
    source.setStatus('started');

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
        },
        createElement(
          SurfaceRoot,
          {
            displayMode: 'PRIMARY',
            containerKey: 'root',
            canvas: {width: 960, height: 540},
            surfaceHostSource: host,
            renderContentFrame: ({content}) =>
              createElement(SurfacePresentationOffsetProvider, {offset: presentationOffset}, content),
          },
          createElement(SurfacePresentationProbe),
        ),
      ),
    );

    const canvas = findByTestID(renderer, 'ui-base-render:surface-host-canvas');
    const probe = findByTestID(renderer, 'surface-presentation-probe');
    const canvasStyle = StyleSheet.flatten(canvas.props.style) as Readonly<{
      readonly transform: readonly Readonly<Record<string, number>>[];
    }>;
    const probeStyle = StyleSheet.flatten(probe.props.style) as Readonly<{
      readonly transform: readonly Readonly<Record<string, unknown>>[];
    }>;
    const presentedContent = queryRenderedTree(renderer, node => node.type === Animated.View).find(node => {
      const style = StyleSheet.flatten(node.props.style) as Readonly<{
        readonly transform?: readonly Readonly<Record<string, unknown>>[];
      }> | null;
      return style?.transform?.some(transform => transform.translateY === presentationOffset) === true;
    });
    expect(canvasStyle.transform).toEqual([{scaleX: 800 / 960}, {scaleY: 600 / 540}]);
    expect(probeStyle.transform).toEqual([{translateY: presentationOffset}]);
    expect(presentedContent).toBeDefined();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps the input frame returned by renderContentFrame inside the hosted canvas subtree', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const host = createHostSource(hostSnapshot(800, 600));
    source.setRoot(rootWithContent(emptyContent()));
    source.setStatus('started');

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          canvas: {width: 960, height: 540},
          surfaceHostSource: host,
          renderContentFrame: ({content}) => createElement(View, {testID: 'ui.base.input:surface-frame'}, content),
        }),
      ),
    );

    const canvas = findByTestID(renderer, 'ui-base-render:surface-host-canvas');
    expect(queryRenderedSubtree(canvas, node => node.props.testID === 'ui.base.input:surface-frame')).toHaveLength(1);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('renders no canvas while a platform host is unavailable and clears stale state on unavailability', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const host = createHostSource(null);
    source.setRoot(rootWithContent(emptyContent()));
    source.setStatus('started');

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          canvas: {width: 960, height: 540},
          surfaceHostSource: host,
        }),
      ),
    );

    expect(findByTestID(renderer, 'ui-base-render:surface-host-pending')).toBeDefined();
    expect(findByTestID(renderer, 'ui-base-render:surface-host-loading-indicator')).toBeDefined();
    expect(
      queryRenderedTree(renderer, node => node.props.testID === 'ui-base-render:surface-host-canvas'),
    ).toHaveLength(0);

    await act(async () => host.emit(hostSnapshot(800, 600)));
    expect(findByTestID(renderer, 'ui-base-render:surface-host-canvas')).toBeDefined();

    await act(async () => host.emit(null));
    expect(findByTestID(renderer, 'ui-base-render:surface-host-pending')).toBeDefined();
    expect(
      queryRenderedTree(renderer, node => node.props.testID === 'ui-base-render:surface-host-canvas'),
    ).toHaveLength(0);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('turns an explicit PRIMARY host-unavailable terminal fact into the failure page', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const identity = Object.freeze({
      surfaceKey: 'PRIMARY' as const,
      displayIndex: 0 as const,
      surfaceForm: 'laptop' as const,
      displayMode: 'PRIMARY' as const,
    });
    let availability: 'pending' | 'ready' | 'unavailable' = 'pending';
    let current: SurfaceHostSnapshot | null = null;
    const snapshotListeners = new Set<(snapshot: SurfaceHostSnapshot | null) => void>();
    const availabilityListeners = new Set<(next: typeof availability) => void>();
    const host: SurfaceHostSource = {
      getSnapshot: () => current,
      subscribe: listener => {
        snapshotListeners.add(listener);
        return () => snapshotListeners.delete(listener);
      },
      getAvailability: () => availability,
      subscribeAvailability: listener => {
        availabilityListeners.add(listener);
        return () => availabilityListeners.delete(listener);
      },
      getSurfaceIdentity: () => identity,
    };
    const hiddenReasons: string[] = [];
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason);
        return {hidden: true, alreadyHidden: false, reason};
      },
    };
    source.setRoot(rootWithContent(emptyContent()));
    source.setStatus('started');

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
          nativeLoadingCapability,
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          canvas: {width: 960, height: 540},
          surfaceHostSource: host,
        }),
      ),
    );

    expect(findByTestID(renderer, 'ui-base-render:surface-host-pending')).toBeDefined();
    await act(async () => {
      availability = 'unavailable';
      current = null;
      for (const listener of [...availabilityListeners]) listener(availability);
      for (const listener of [...snapshotListeners]) listener(current);
    });
    await act(async () => undefined);

    expect(findByTestID(renderer, 'ui-base-render:surface-host-failure')).toBeDefined();
    expect(findByTestID(renderer, 'ui.base.render:startup-failure')).toBeDefined();
    expect(hiddenReasons).toEqual(['startup-failure']);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps an empty PRIMARY container as visible content failure without a system page', async () => {
    const source = createSource();
    const {logger, events} = createLogger();
    const host = createHostSource(hostSnapshot(960, 540));
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => ({hidden: true, alreadyHidden: false, reason}),
    };
    source.setRoot(rootWithContent(emptyContent()));
    source.setStatus('started');

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
          nativeLoadingCapability,
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          canvas: {width: 960, height: 540},
          surfaceHostSource: host,
        }),
      ),
    );

    await act(async () => undefined);
    expect(findByTestID(renderer, 'ui-base-render:fallback:container-empty')).toBeDefined();
    const fallback = findByTestID(renderer, 'ui-base-render:fallback:container-empty');
    expect(fallback.props.children).toContain('页面找不到');
    expect(queryRenderedTree(renderer, node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0);
    expect(events.some(event => event.event === 'startup.failure-page-visible')).toBe(false);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'ui.base.render',
          event: 'container-empty',
          data: {
            category: 'content',
            reason: 'container-empty',
            partKey: null,
            displayMode: 'PRIMARY',
            containerKey: 'root',
            surfaceForm: 'laptop',
          },
        }),
      ]),
    );
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps a configured integration default placement stable across unrelated root updates', async () => {
    const source = createSource();
    const {logger} = createLogger();
    let screenRenderCount = 0;
    const DefaultScreen: ComponentType<object> = props => {
      screenRenderCount += 1;
      return createElement('render-screen', props);
    };
    const defined = part({
      partKey: 'default-screen-part',
      rendererKey: 'default-screen-renderer',
      component: DefaultScreen,
    });
    const root = Object.freeze({
      ...rootWithContent(emptyContent()),
      'test.unrelated': Object.freeze({value: 1}),
    }) as RuntimeStateRoot;
    source.setRoot(root);
    source.setStatus('started');
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([defined.catalogEntry]),
          rendererCatalog: createRendererCatalog([defined.rendererBinding]),
          logger,
          ...unusedRenderProviderBindings,
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          defaultContainerPartKeys: {root: defined.catalogEntry.partKey},
        }),
      ),
    );

    expect(queryRenderedTree(renderer, node => node.type === 'render-screen')).toHaveLength(1);
    expect(screenRenderCount).toBe(1);
    expect(selectScreen(source.stateSource.getState(), 'PRIMARY', 'root')).toBeUndefined();

    await act(async () => {
      source.setRoot(
        Object.freeze({
          ...rootWithContent(emptyContent()),
          'test.unrelated': Object.freeze({value: 2}),
        }) as RuntimeStateRoot,
      );
      source.notify();
    });

    expect(screenRenderCount).toBe(1);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('passes one shrinkable content subtree through the frame seam', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const defined = part({partKey: 'frame-part', rendererKey: 'frame-renderer', component: Screen});
    const uiCatalog = createUiCatalog([defined.catalogEntry]);
    const rendererCatalog = createRendererCatalog([defined.rendererBinding]);
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {root: {partKey: 'frame-part'}}, layers: []},
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');
    let frameCalls = 0;
    const renderer = await mount(
      createElement(
        RenderProvider,
        {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          renderContentFrame: ({content}) => {
            frameCalls += 1;
            return createElement('surface-frame', {testID: 'surface-frame'}, content, createElement('keyboard-dock'));
          },
        }),
      ),
    );

    const frame = findByTestID(renderer, 'surface-frame');
    const frameProps = frame.props as Readonly<{readonly children: readonly ReactElement[] | ReactElement}>;
    const frameChildren = Array.isArray(frameProps.children) ? frameProps.children : [frameProps.children];
    expect(frameCalls).toBe(1);
    expect(frameChildren).toHaveLength(2);
    const contentView = queryRenderedTree(renderer, node => node.type === 'View').find(node => {
      const style = StyleSheet.flatten(node.props.style) as Readonly<{readonly flex?: number}> | null;
      return style?.flex === 1 && queryRenderedSubtree(node, child => child.type === Animated.View).length > 0;
    });
    expect(contentView).toBeDefined();
    const contentProps = contentView!.props as unknown as Readonly<{
      readonly style: unknown;
      readonly children: readonly unknown[];
    }>;
    expect(StyleSheet.flatten(contentProps.style)).toMatchObject({flex: 1});
    const presentedContent = queryRenderedSubtree(contentView!, node => node.type === Animated.View)[0]!;
    const layerStack = queryRenderedSubtree(contentView!, node => node.type === LayerStack)[0]!;
    const presentedChildren = (presentedContent.props as Readonly<{readonly children?: unknown}>).children;
    expect(presentedChildren).toEqual(expect.arrayContaining([expect.objectContaining({type: ScreenContainer})]));
    expect(getRenderedNode(renderer, node => node.type === 'render-screen').props.marker).toBeUndefined();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('notifies input consumers around the first and last layer focus boundary', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const defined = part({
      partKey: 'focus-boundary-layer',
      rendererKey: 'focus-boundary-layer-renderer',
      component: StandardLayer,
      layerTier: 'alert',
      layerGuard: 'dismissible',
      containerKeys: [],
    });
    const uiCatalog = createUiCatalog([defined.catalogEntry]);
    const rendererCatalog = createRendererCatalog([defined.rendererBinding]);
    const root = (layers: readonly object[]) =>
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {}, layers},
          SECONDARY: {containers: {}, layers: []},
        },
      });
    source.setRoot(root([]));
    source.setStatus('started');
    const events: string[] = [];
    const previousInput = {
      focus: vi.fn(() => {
        events.push('previous-focus');
      }),
    };
    const layerFocusTargets = new Map<string, {focus: () => void}>();
    const renderer = await mountWithNativeTestRefs(
      createElement(
        RenderProvider,
        {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          renderContentFrame: ({content}) =>
            createElement(
              SurfaceFocusBoundaryContext.Provider,
              {
                value: phase => {
                  events.push(phase);
                },
              },
              content,
            ),
        }),
      ),
      (_hostName, props) => {
        const testID = props.testID;
        if (typeof testID !== 'string' || !testID.startsWith('ui-base-render:layer:')) return {};
        const existing = layerFocusTargets.get(testID);
        if (existing !== undefined) return existing;
        const target = {
          focus: () => {
            events.push('layer-focus');
          },
        };
        layerFocusTargets.set(testID, target);
        return target;
      },
    );

    const focusedInput = vi.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(previousInput as never);

    await act(async () => {
      source.setRoot(root([{layerId: 'focus-layer', partKey: 'focus-boundary-layer', openedAt: 1}]));
      source.notify();
    });
    expect(events).toEqual(['suspend']);

    await act(async () => {
      source.setRoot(
        root([
          {layerId: 'focus-layer', partKey: 'focus-boundary-layer', openedAt: 1},
          {layerId: 'focus-layer-2', partKey: 'focus-boundary-layer', openedAt: 2},
        ]),
      );
      source.notify();
    });
    expect(events).toEqual(['suspend']);

    await act(async () => {
      source.setRoot(root([{layerId: 'focus-layer', partKey: 'focus-boundary-layer', openedAt: 1}]));
      source.notify();
    });
    expect(events).toEqual(['suspend']);

    await act(async () => {
      source.setRoot(root([]));
      source.notify();
    });
    expect(events).toEqual(['suspend', 'restore']);
    expect(previousInput.focus).not.toHaveBeenCalled();
    focusedInput.mockRestore();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps explicit PRIMARY and SECONDARY surfaces on their own content sets', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const defined = part({partKey: 'surface-part', rendererKey: 'surface-renderer', component: Screen});
    const uiCatalog = createUiCatalog([defined.catalogEntry]);
    const rendererCatalog = createRendererCatalog([defined.rendererBinding]);
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {root: {partKey: 'surface-part', props: {marker: 'primary'}}}, layers: []},
          SECONDARY: {containers: {root: {partKey: 'surface-part', props: {marker: 'secondary'}}}, layers: []},
        },
      }),
    );
    source.setStatus('started');

    const renderer = await mount(
      createElement(
        RenderProvider,
        {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
        createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
        createElement(SurfaceRoot, {displayMode: 'SECONDARY', containerKey: 'root'}),
      ),
    );
    const screens = queryRenderedTree(renderer, node => node.type === 'render-screen');
    expect(screens.map(screen => screen.props.marker)).toEqual(['primary', 'secondary']);
    const screenContainers = queryRenderedTree(
      renderer,
      node => node.type === 'View' && node.props.testID === 'ui-base-render:screen-container',
    );
    const layerStacks = queryRenderedTree(
      renderer,
      node => node.type === 'View' && node.props.testID === 'ui-base-render:layer-stack',
    );
    expect(screenContainers).toHaveLength(2);
    expect(layerStacks).toHaveLength(2);
    expect(screenContainers.every(node => node.type === 'View')).toBe(true);
    expect(layerStacks.every(node => node.type === 'View')).toBe(true);
    expect(queryRenderedTree(renderer, node => node.props.testID === 'ui-base-render:layer-backdrop')).toHaveLength(0);
    expect((StyleSheet.flatten(layerStacks[0].props.style) as {readonly position?: string}).position).toBe('absolute');
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps diagnostic suppression local to each Provider', async () => {
    const first = createSource();
    const second = createSource();
    const firstLogger = createLogger();
    const secondLogger = createLogger();
    const missing = part({
      partKey: 'provider-local-missing-renderer',
      rendererKey: 'provider-local-missing-renderer-binding',
      component: Screen,
    });
    const uiCatalog = createUiCatalog([missing.catalogEntry]);
    const rendererCatalog = createRendererCatalog([]);
    const content = {
      contentSets: {
        PRIMARY: {containers: {root: {partKey: 'provider-local-missing-renderer'}}, layers: []},
        SECONDARY: {containers: {}, layers: []},
      },
    };
    first.setRoot(rootWithContent(content));
    second.setRoot(rootWithContent(content));
    first.setStatus('started');
    second.setStatus('started');
    const provider = (source: FakeSource, logger: ReturnType<typeof createLogger>) =>
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog,
          rendererCatalog,
          logger: logger.logger,
          ...unusedRenderProviderBindings,
        },
        createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
      );

    const renderer = await mount(
      createElement('provider-diagnostic-root', null, provider(first, firstLogger), provider(second, secondLogger)),
    );
    expect(firstLogger.events.filter(event => event.event === 'missing-renderer')).toHaveLength(1);
    expect(secondLogger.events.filter(event => event.event === 'missing-renderer')).toHaveLength(1);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps transition and content failures as distinct typed fallback facts', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const uiCatalog = createUiCatalog([]);
    const rendererCatalog = createRendererCatalog([]);
    const renderer = await mount(
      createElement(
        RenderProvider,
        {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
        createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
      ),
    );
    const unavailable = findFallbacks(renderer);
    expect(unavailable.map(item => item.props.testID)).toEqual([
      'ui-base-render:fallback:runtime-not-started',
      'ui-base-render:fallback:runtime-not-started',
    ]);

    await act(async () => {
      source.setRoot(rootWithContent(emptyContent()));
      source.setStatus('started');
      source.notify();
    });
    const empty = findFallbacks(renderer);
    expect(empty.map(item => item.props.testID)).toContain('ui-base-render:fallback:container-empty');
    expect(empty.map(item => item.props.testID)).not.toContain('ui-base-render:fallback:runtime-unavailable');
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps runtime-not-started neutral on the target PRIMARY surface', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const host = createHostSource(hostSnapshot(800, 600));
    const hiddenReasons: string[] = [];
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason);
        return {hidden: true, alreadyHidden: false, reason};
      },
    };
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
          nativeLoadingCapability,
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          canvas: {width: 960, height: 540},
          surfaceHostSource: host,
        }),
      ),
    );

    expect(renderer.queryAllByTestId('ui-base-render:fallback:runtime-not-started')).not.toHaveLength(0);
    expect(queryRenderedTree(renderer, node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0);
    expect(queryRenderedTree(renderer, node => node.props.testID === 'ui.base.render:runtime-failure')).toHaveLength(0);
    expect(hiddenReasons).toEqual([]);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('resolves screen and layer through both catalogs and orders layers by tier/time/id', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const presentationOffset = new Animated.Value(-24);
    const screenPart = part({
      partKey: 'surface-screen-part',
      rendererKey: 'surface-screen-renderer',
      component: Screen,
    });
    const standard = part({
      partKey: 'standard-part',
      rendererKey: 'standard-renderer',
      component: StandardLayer,
      layerTier: 'standard',
      containerKeys: [],
    });
    const alert = part({
      partKey: 'alert-part',
      rendererKey: 'alert-renderer',
      component: AlertLayer,
      layerTier: 'alert',
      containerKeys: [],
    });
    const uiCatalog = createUiCatalog([screenPart.catalogEntry, standard.catalogEntry, alert.catalogEntry]);
    const rendererCatalog = createRendererCatalog([
      screenPart.rendererBinding,
      standard.rendererBinding,
      alert.rendererBinding,
    ]);
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {
            containers: {root: {partKey: 'surface-screen-part', props: {marker: 'screen'}}},
            layers: [
              {layerId: 'alert', partKey: 'alert-part', openedAt: 1, props: {marker: 'alert'}},
              {layerId: 'standard-late', partKey: 'standard-part', openedAt: 3, props: {marker: 'standard-late'}},
              {layerId: 'standard-z', partKey: 'standard-part', openedAt: 1, props: {marker: 'standard-z'}},
              {layerId: 'standard-a', partKey: 'standard-part', openedAt: 1, props: {marker: 'standard-a'}},
            ],
          },
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');
    const renderer = await mount(
      createElement(
        SurfacePresentationOffsetProvider,
        {offset: presentationOffset},
        createElement(
          RenderProvider,
          {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
          createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
        ),
      ),
    );
    expect(getRenderedNode(renderer, node => node.type === 'render-screen').props.marker).toBe('screen');
    expect(queryRenderedTree(renderer, node => node.type === 'render-layer').map(layer => layer.props.marker)).toEqual([
      'standard-a',
      'standard-z',
      'standard-late',
      'alert',
    ]);
    const layerStack = findByTestID(renderer, 'ui-base-render:layer-stack');
    const backdrop = findByTestID(renderer, 'ui-base-render:layer-backdrop');
    expect(backdrop).toBeDefined();
    const layerStackStyle = StyleSheet.flatten(layerStack.props.style);
    expect(layerStackStyle).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 1000,
      elevation: 1000,
    });
    expect(layerStackStyle).not.toHaveProperty('alignItems');
    expect(layerStackStyle).not.toHaveProperty('justifyContent');
    expect(layerStackStyle).not.toHaveProperty('padding');
    expect(layerStackStyle).not.toHaveProperty('transform');
    expect(StyleSheet.flatten(backdrop.props.style)).not.toHaveProperty('transform');
    expect(layerStack.props.pointerEvents).toBe('box-none');
    const layerSurfaces = queryRenderedTree(
      renderer,
      node =>
        node.type === 'View' &&
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('ui-base-render:layer:'),
    );
    expect(layerSurfaces).toHaveLength(4);
    expect(layerSurfaces.every(layer => layer.props.pointerEvents === 'box-none')).toBe(true);
    const layerStyle = StyleSheet.flatten(layerSurfaces[0]!.props.style);
    expect(layerStyle).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(layerStyle).not.toHaveProperty('alignItems');
    expect(layerStyle).not.toHaveProperty('justifyContent');
    expect(layerStyle).not.toHaveProperty('padding');
    expect(layerStyle).not.toHaveProperty('transform');
    const alertLayer = findByTestID(renderer, 'ui-base-render:layer:alert');
    expect(alertLayer.props.focusable).not.toBe(true);
    expect(alertLayer.props.accessibilityViewIsModal).not.toBe(true);
    expect(StyleSheet.flatten(alertLayer.props.style)).not.toHaveProperty('transform');

    const movingNodes = queryRenderedTree(renderer, node => {
      const style = StyleSheet.flatten(node.props.style) as
        {readonly transform?: readonly {readonly translateY?: unknown}[]} | undefined;
      return style?.transform?.some(transform => transform.translateY === presentationOffset) ?? false;
    });
    expect(movingNodes).toHaveLength(5);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('enforces decisive guards for backdrop and Android back without dispatching close', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const defined = part({
      partKey: 'decisive-layer-part',
      rendererKey: 'decisive-layer-renderer',
      component: StandardLayer,
      layerTier: 'alert',
      layerGuard: 'decisive',
      containerKeys: [],
    });
    const uiCatalog = createUiCatalog([defined.catalogEntry]);
    const rendererCatalog = createRendererCatalog([defined.rendererBinding]);
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {
            containers: {},
            layers: [{layerId: 'decisive', partKey: 'decisive-layer-part', openedAt: 1, props: {marker: 'decisive'}}],
          },
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');

    const dispatches: string[] = [];
    const dispatchCommand: RenderProviderProps['dispatchCommand'] = async command => {
      dispatches.push(command.definition.commandName);
      throw new Error('test dispatch rejection');
    };
    const backHandlers: BackPressHandler[] = [];
    const addBackHandler = vi.spyOn(BackHandler, 'addEventListener');
    addBackHandler.mockImplementation((_eventName, handler) => {
      backHandlers.push(handler);
      return {remove: () => undefined} as ReturnType<typeof BackHandler.addEventListener>;
    });

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          ...unusedRenderProviderBindings,
          stateSource: source.stateSource,
          uiCatalog,
          rendererCatalog,
          logger,
          dispatchCommand,
        },
        createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
      ),
    );
    await act(async () => {
      const onPress = findByTestID(renderer, 'ui-base-render:layer-backdrop').props.onPress;
      if (typeof onPress !== 'function') throw new Error('layer backdrop must be pressable');
      onPress();
    });
    expect(dispatches).toEqual([]);
    expect(backHandlers).toHaveLength(1);
    expect(backHandlers[0]!({type: 'hardwareBackPress', timeStamp: 0})).toBe(true);
    expect(dispatches).toEqual([]);
    await act(async () => {
      await renderer.unmount();
    });
    addBackHandler.mockRestore();
  });

  it('lets dismissible guards close through backdrop and Android back', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const defined = part({
      partKey: 'dismissible-layer-part',
      rendererKey: 'dismissible-layer-renderer',
      component: StandardLayer,
      layerTier: 'standard',
      layerGuard: 'dismissible',
      containerKeys: [],
    });
    const uiCatalog = createUiCatalog([defined.catalogEntry]);
    const rendererCatalog = createRendererCatalog([defined.rendererBinding]);
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {
            containers: {},
            layers: [
              {layerId: 'dismissible', partKey: 'dismissible-layer-part', openedAt: 1, props: {marker: 'dismissible'}},
            ],
          },
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');

    const dispatches: string[] = [];
    const featureDismissCommand = defineCommand<Readonly<Record<string, never>>>('ui.feature.test', {
      name: 'dismiss-layer',
      visibility: 'public',
    });
    const dispatchCommand: RenderProviderProps['dispatchCommand'] = async command => {
      dispatches.push(command.definition.commandName);
      throw new Error('test dispatch rejection');
    };
    const backHandlers: BackPressHandler[] = [];
    const addBackHandler = vi.spyOn(BackHandler, 'addEventListener');
    addBackHandler.mockImplementation((_eventName, handler) => {
      backHandlers.push(handler);
      return {remove: () => undefined} as ReturnType<typeof BackHandler.addEventListener>;
    });

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          ...unusedRenderProviderBindings,
          stateSource: source.stateSource,
          uiCatalog,
          rendererCatalog,
          logger,
          dispatchCommand,
          layerDismissals: {
            'dismissible-layer-part': ({dispatchCommand: dispatch}) =>
              dispatchWithRequestId({
                dispatchCommand: dispatch,
                definition: featureDismissCommand,
                payload: {},
              }),
          },
        },
        createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
      ),
    );
    await act(async () => {
      const onPress = findByTestID(renderer, 'ui-base-render:layer-backdrop').props.onPress;
      if (typeof onPress !== 'function') throw new Error('layer backdrop must be pressable');
      onPress();
      await Promise.resolve();
    });
    expect(dispatches).toEqual(['ui.feature.test.dismiss-layer']);
    await act(async () => {
      expect(backHandlers[0]!({type: 'hardwareBackPress', timeStamp: 0})).toBe(true);
      await Promise.resolve();
    });
    expect(dispatches).toEqual(['ui.feature.test.dismiss-layer', 'ui.feature.test.dismiss-layer']);
    await act(async () => {
      await renderer.unmount();
    });
    addBackHandler.mockRestore();
  });

  it('does not focus-trap a layer or restore prior native focus after the last layer closes', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const defined = part({
      partKey: 'focus-layer-part',
      rendererKey: 'focus-layer-renderer',
      component: StandardLayer,
      layerTier: 'standard',
      layerGuard: 'dismissible',
      containerKeys: [],
    });
    const uiCatalog = createUiCatalog([defined.catalogEntry]);
    const rendererCatalog = createRendererCatalog([defined.rendererBinding]);
    source.setRoot(rootWithContent(emptyContent()));
    source.setStatus('started');

    const previousInput = {focus: vi.fn()};
    const layerFocusTarget = {focus: vi.fn()};
    const focusedInput = vi.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(previousInput as never);
    const renderer = await mountWithNativeTestRefs(
      createElement(
        RenderProvider,
        {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
        createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
      ),
      (_hostName, props) => (props.testID === 'ui-base-render:layer:focus-layer' ? layerFocusTarget : {}),
    );

    await act(async () => {
      source.setRoot(
        rootWithContent({
          contentSets: {
            PRIMARY: {
              containers: {},
              layers: [{layerId: 'focus-layer', partKey: 'focus-layer-part', openedAt: 1, props: {marker: 'focus'}}],
            },
            SECONDARY: {containers: {}, layers: []},
          },
        }),
      );
      source.notify();
    });
    expect(layerFocusTarget.focus).not.toHaveBeenCalled();

    await act(async () => {
      source.setRoot(rootWithContent(emptyContent()));
      source.notify();
    });
    expect(previousInput.focus).not.toHaveBeenCalled();
    focusedInput.mockRestore();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('does not require or assign native focus when a layer opens without prior input focus', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const defined = part({
      partKey: 'focus-without-input-part',
      rendererKey: 'focus-without-input-renderer',
      component: StandardLayer,
      layerTier: 'standard',
      layerGuard: 'dismissible',
      containerKeys: [],
    });
    const uiCatalog = createUiCatalog([defined.catalogEntry]);
    const rendererCatalog = createRendererCatalog([defined.rendererBinding]);
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {
            containers: {},
            layers: [{layerId: 'focus-without-input', partKey: 'focus-without-input-part', openedAt: 1}],
          },
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');
    const focusedInput = vi.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(undefined as never);
    const layerFocusTarget = {focus: vi.fn()};
    const renderer = await mountWithNativeTestRefs(
      createElement(
        RenderProvider,
        {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
        createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
      ),
      (_hostName, props) => (props.testID === 'ui-base-render:layer:focus-without-input' ? layerFocusTarget : {}),
    );
    expect(layerFocusTarget.focus).not.toHaveBeenCalled();
    await act(async () => {
      source.setRoot(rootWithContent(emptyContent()));
      source.notify();
    });
    await act(async () => {
      await renderer.unmount();
    });
    focusedInput.mockRestore();
  });

  it('reports missing catalog, missing renderer, and invalid props on screen and layer paths', async () => {
    const source = createSource();
    const {logger, events} = createLogger();
    const valid = part({partKey: 'valid-part', rendererKey: 'valid-renderer', component: Screen});
    const missingRenderer = part({
      partKey: 'missing-renderer-part',
      rendererKey: 'not-installed',
      component: Screen,
      containerKeys: [],
    });
    let businessCalls = 0;
    const CountingScreen: ComponentType<object> = props => {
      businessCalls += 1;
      return createElement('render-counted-screen', props);
    };
    const counted = part({partKey: 'counted-part', rendererKey: 'counted-renderer', component: CountingScreen});
    const countedLayer = part({
      partKey: 'counted-layer-part',
      rendererKey: 'counted-layer-renderer',
      component: CountingScreen,
      containerKeys: [],
    });
    const screenMissingRenderer = part({
      partKey: 'screen-missing-renderer-part',
      rendererKey: 'screen-not-installed',
      component: Screen,
    });
    const fullUiCatalog = createUiCatalog([
      valid.catalogEntry,
      missingRenderer.catalogEntry,
      counted.catalogEntry,
      countedLayer.catalogEntry,
      screenMissingRenderer.catalogEntry,
    ]);
    const fullRendererCatalog = createRendererCatalog([
      valid.rendererBinding,
      counted.rendererBinding,
      countedLayer.rendererBinding,
    ]);
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {
            containers: {root: {partKey: 'missing-catalog-part'}},
            layers: [
              {layerId: 'missing-catalog-layer', partKey: 'missing-catalog-layer-part', openedAt: 1},
              {layerId: 'missing-renderer-layer', partKey: 'missing-renderer-part', openedAt: 2},
              {layerId: 'invalid-props-layer', partKey: 'valid-part', openedAt: 3, props: []},
            ],
          },
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');
    let diagnosticCountDuringRender = -1;
    const RenderPhaseObserver = () => {
      diagnosticCountDuringRender = events.length;
      return null;
    };
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: fullUiCatalog,
          rendererCatalog: fullRendererCatalog,
          logger,
          ...unusedRenderProviderBindings,
        },
        createElement(
          Fragment,
          null,
          createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
          createElement(RenderPhaseObserver),
        ),
      ),
    );
    expect(diagnosticCountDuringRender).toBe(0);
    expect(findFallbacks(renderer).map(item => item.props.testID)).toContain(
      'ui-base-render:fallback:missing-catalog-entry',
    );
    expect(findFallbacks(renderer).map(item => item.props.testID)).toContain(
      'ui-base-render:fallback:missing-renderer',
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'ui.base.render',
          event: 'missing-catalog-entry',
          data: {
            category: 'content',
            reason: 'missing-catalog-entry',
            partKey: 'missing-catalog-part',
            displayMode: 'PRIMARY',
            containerKey: 'root',
            surfaceForm: 'laptop',
          },
        }),
        expect.objectContaining({
          category: 'ui.base.render',
          event: 'missing-catalog-entry',
          data: {
            category: 'content',
            reason: 'missing-catalog-entry',
            partKey: 'missing-catalog-layer-part',
            displayMode: 'PRIMARY',
            containerKey: null,
            surfaceForm: 'laptop',
          },
        }),
        expect.objectContaining({
          category: 'ui.base.render',
          event: 'missing-renderer',
          data: {
            category: 'system',
            reason: 'missing-renderer',
            partKey: 'missing-renderer-part',
            displayMode: 'PRIMARY',
            rendererKey: 'not-installed',
          },
        }),
      ]),
    );

    const invalidRoot = rootWithContent({
      contentSets: {
        PRIMARY: {
          containers: {root: {partKey: 'counted-part', props: 'invalid'}},
          layers: [{layerId: 'invalid-layer', partKey: 'counted-layer-part', openedAt: 1, props: []}],
        },
        SECONDARY: {containers: {}, layers: []},
      },
    });
    await act(async () => {
      source.setRoot(invalidRoot);
      source.notify();
    });
    expect(queryRenderedTree(renderer, node => node.type === 'render-counted-screen')).toHaveLength(0);
    expect(findFallbacks(renderer).map(item => item.props.testID)).toContain('ui-base-render:fallback:invalid-props');
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'ui.base.render',
          event: 'invalid-props-shape',
          data: {
            category: 'content',
            reason: 'invalid-props',
            partKey: 'counted-part',
            displayMode: 'PRIMARY',
            containerKey: 'root',
            surfaceForm: 'laptop',
            valueType: 'string',
          },
        }),
        expect.objectContaining({
          category: 'ui.base.render',
          event: 'invalid-props-shape',
          data: {
            category: 'content',
            reason: 'invalid-props',
            partKey: 'counted-layer-part',
            displayMode: 'PRIMARY',
            containerKey: null,
            surfaceForm: 'laptop',
            valueType: 'array',
          },
        }),
      ]),
    );

    const screenMissingRendererRoot = rootWithContent({
      contentSets: {
        PRIMARY: {
          containers: {root: {partKey: 'screen-missing-renderer-part'}},
          layers: [],
        },
        SECONDARY: {containers: {}, layers: []},
      },
    });
    await act(async () => {
      source.setRoot(screenMissingRendererRoot);
      source.notify();
    });
    expect(findFallbacks(renderer).map(item => item.props.testID)).toContain(
      'ui-base-render:fallback:missing-renderer',
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'ui.base.render',
          event: 'missing-renderer',
          data: {
            category: 'system',
            reason: 'missing-renderer',
            partKey: 'screen-missing-renderer-part',
            displayMode: 'PRIMARY',
            rendererKey: 'screen-not-installed',
          },
        }),
      ]),
    );
    await act(async () => {
      await renderer.unmount();
    });
    expect(businessCalls).toBe(0);
  });

  it('treats a missing catalog entry as visible content failure and PRIMARY readiness', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const host = createHostSource(hostSnapshot(800, 600));
    const readyInputs: Array<Readonly<{readonly readyPartKey: string | null; readonly contentFailure: string | null}>> =
      [];
    const hiddenReasons: string[] = [];
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason);
        return {hidden: true, alreadyHidden: false, reason};
      },
    };
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {root: {partKey: 'missing-content-part'}}, layers: []},
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
          nativeLoadingCapability,
          onPrimarySurfaceReady: input => {
            readyInputs.push({readyPartKey: input.readyPartKey, contentFailure: input.contentFailure});
          },
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          canvas: {width: 960, height: 540},
          surfaceHostSource: host,
        }),
      ),
    );

    expect(findByTestID(renderer, 'ui-base-render:fallback:missing-catalog-entry').props.children).toContain(
      '页面找不到',
    );
    expect(queryRenderedTree(renderer, node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0);
    const boundary = findByTestID(renderer, 'ui-base-render:screen-ready-boundary');
    await act(async () => {
      boundary.props.onLayout({nativeEvent: {layout: {width: 800, height: 600}}});
    });
    expect(readyInputs).toEqual([{readyPartKey: 'missing-content-part', contentFailure: 'missing-catalog-entry'}]);
    expect(hiddenReasons).toEqual(['startup-ready']);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('reports an incompatible catalog entry as visible content failure and PRIMARY ready', async () => {
    const source = createSource();
    const {logger, events} = createLogger();
    const host = createHostSource(hostSnapshot(800, 600));
    const incompatible = part({
      partKey: 'incompatible-screen-part',
      rendererKey: 'incompatible-screen-renderer',
      component: Screen,
      surfaceForm: ['mobile'],
    });
    const readyInputs: Array<
      Readonly<{
        readonly readyPartKey: string | null;
        readonly contentFailure: string | null;
      }>
    > = [];
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => ({hidden: true, alreadyHidden: false, reason}),
    };
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {root: {partKey: incompatible.catalogEntry.partKey}}, layers: []},
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([incompatible.catalogEntry]),
          rendererCatalog: createRendererCatalog([incompatible.rendererBinding]),
          logger,
          ...unusedRenderProviderBindings,
          nativeLoadingCapability,
          onPrimarySurfaceReady: input => {
            readyInputs.push({readyPartKey: input.readyPartKey, contentFailure: input.contentFailure});
          },
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          canvas: {width: 960, height: 540},
          surfaceHostSource: host,
        }),
      ),
    );

    const fallback = findByTestID(renderer, 'ui-base-render:fallback:incompatible-catalog-entry');
    expect(fallback.props.children).toContain('页面找不到');
    expect(fallback.props.children).toContain('incompatible-screen-part');
    expect(fallback.props.children).toContain('laptop');
    expect(queryRenderedTree(renderer, node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'incompatible-catalog-entry',
          data: {
            category: 'content',
            reason: 'incompatible-catalog-entry',
            partKey: 'incompatible-screen-part',
            displayMode: 'PRIMARY',
            containerKey: 'root',
            surfaceForm: 'laptop',
          },
        }),
      ]),
    );

    const boundary = findByTestID(renderer, 'ui-base-render:screen-ready-boundary');
    await act(async () => {
      boundary.props.onLayout({nativeEvent: {layout: {width: 800, height: 600}}});
    });
    expect(readyInputs).toEqual([
      {
        readyPartKey: 'incompatible-screen-part',
        contentFailure: 'incompatible-catalog-entry',
      },
    ]);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('does not collide diagnostic identities when keys contain separators', async () => {
    const {logger, events} = createLogger();
    const reporter = createRenderPartDiagnosticReporter(logger);
    reporter.report({
      event: 'missing-renderer',
      data: {
        category: 'system',
        reason: 'missing-renderer',
        partKey: 'part|PRIMARY',
        displayMode: 'PRIMARY',
        rendererKey: 'renderer',
      },
    });
    reporter.report({
      event: 'missing-renderer',
      data: {
        category: 'system',
        reason: 'missing-renderer',
        partKey: 'part',
        displayMode: 'PRIMARY',
        rendererKey: 'PRIMARY|renderer',
      },
    });
    expect(events).toHaveLength(2);
  });

  it('reports the same diagnostic again after content recovers', async () => {
    const source = createSource();
    const {logger, events} = createLogger();
    const defined = part({
      partKey: 'recoverable-part',
      rendererKey: 'recoverable-renderer',
      component: Screen,
    });
    const uiCatalog = createUiCatalog([defined.catalogEntry]);
    const missingRendererCatalog = createRendererCatalog([]);
    const installedRendererCatalog = createRendererCatalog([defined.rendererBinding]);
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {root: {partKey: 'recoverable-part'}}, layers: []},
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');

    const render = (rendererCatalog: ReturnType<typeof createRendererCatalog>) =>
      createElement(
        RenderProvider,
        {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
        createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
      );
    const renderer = await mount(render(missingRendererCatalog));
    const missingRendererEvents = () => events.filter(event => event.event === 'missing-renderer');
    expect(missingRendererEvents()).toHaveLength(1);

    await act(async () => {
      await renderer.rerender(render(installedRendererCatalog));
    });
    expect(missingRendererEvents()).toHaveLength(1);

    await act(async () => {
      await renderer.rerender(render(missingRendererCatalog));
    });
    expect(missingRendererEvents()).toHaveLength(2);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('hides native loading only after the real PRIMARY part and host geometry lay out', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const host = createHostSource(hostSnapshot(800, 600));
    const defined = part({partKey: 'ready-part', rendererKey: 'ready-renderer', component: Screen});
    const hiddenReasons: string[] = [];
    const readyParts: Array<string | null> = [];
    const lifecycle: string[] = [];
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        lifecycle.push('hide');
        hiddenReasons.push(reason);
        return {hidden: true, alreadyHidden: false, reason};
      },
    };
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {root: {partKey: 'ready-part'}}, layers: []},
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([defined.catalogEntry]),
          rendererCatalog: createRendererCatalog([defined.rendererBinding]),
          logger,
          ...unusedRenderProviderBindings,
          nativeLoadingCapability,
          onPrimarySurfaceReady: ({readyPartKey}) => {
            lifecycle.push('ready-callback');
            readyParts.push(readyPartKey);
          },
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          canvas: {width: 960, height: 540},
          surfaceHostSource: host,
        }),
      ),
    );

    expect(hiddenReasons).toEqual([]);
    const boundary = findByTestID(renderer, 'ui-base-render:screen-ready-boundary');
    await act(async () => {
      boundary.props.onLayout({nativeEvent: {layout: {width: 800, height: 600}}});
    });
    expect(hiddenReasons).toEqual(['startup-ready']);
    expect(readyParts).toEqual(['ready-part']);
    expect(lifecycle).toEqual(['ready-callback', 'hide']);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('reports a first-screen render error as content failure and releases startup loading without real readiness', async () => {
    const source = createSource();
    const {logger, events} = createLogger();
    const host = createHostSource(hostSnapshot(800, 600));
    const BrokenScreen: ComponentType<ScreenProps> = () => {
      throw new Error('private screen failure detail');
    };
    const defined = part({
      partKey: 'broken-startup-part',
      rendererKey: 'broken-startup-renderer',
      component: BrokenScreen,
    });
    const hiddenReasons: string[] = [];
    const readyInputs: Array<Readonly<{readonly readyPartKey: string | null; readonly contentFailure: string | null}>> =
      [];
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason);
        return {hidden: true, alreadyHidden: false, reason};
      },
    };
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {root: {partKey: 'broken-startup-part'}}, layers: []},
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([defined.catalogEntry]),
          rendererCatalog: createRendererCatalog([defined.rendererBinding]),
          logger,
          ...unusedRenderProviderBindings,
          nativeLoadingCapability,
          onPrimarySurfaceReady: input => {
            readyInputs.push({
              readyPartKey: input.readyPartKey,
              contentFailure: input.contentFailure,
            });
          },
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          canvas: {width: 960, height: 540},
          surfaceHostSource: host,
        }),
      ),
    );

    const notice = findByTestID(renderer, 'ui-base-render:system-failure:screen:root:broken-startup-part');
    expect(notice).toBeDefined();
    expect(queryRenderedTree(renderer, node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0);
    expect(hiddenReasons).toEqual([]);
    expect(readyInputs).toEqual([]);

    const fallbackBoundary = findByTestID(renderer, 'ui-base-render:screen-ready-boundary');
    await act(async () => {
      fallbackBoundary.props.onLayout({nativeEvent: {layout: {width: 800, height: 600}}});
    });

    expect(readyInputs).toEqual([
      {
        readyPartKey: 'broken-startup-part',
        contentFailure: 'render-error',
      },
    ]);
    expect(hiddenReasons).toEqual(['startup-ready']);
    expect(renderer.getByText('知道了')).toBeDefined();
    expect(events.find(event => event.event === 'runtime.system-failure.render-failed')?.data).toEqual({
      ownerId: 'screen:root:broken-startup-part',
      errorName: 'Error',
    });
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps a content failure ready before a later system failure uses the runtime variant', async () => {
    const source = createSource();
    const {logger, events} = createLogger();
    const host = createHostSource(hostSnapshot(800, 600));
    const defined = part({partKey: 'content-ready-part', rendererKey: 'content-ready-renderer', component: Screen});
    const hiddenReasons: string[] = [];
    const readyInputs: Array<{
      readonly readyPartKey: string | null;
      readonly contentFailure: string | null;
    }> = [];
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason);
        return {hidden: true, alreadyHidden: false, reason};
      },
    };
    const uiCatalog = createUiCatalog([defined.catalogEntry]);
    const rendererCatalog = createRendererCatalog([defined.rendererBinding]);
    const render = (currentRendererCatalog: ReturnType<typeof createRendererCatalog> = rendererCatalog) =>
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog,
          rendererCatalog: currentRendererCatalog,
          logger,
          ...unusedRenderProviderBindings,
          nativeLoadingCapability,
          onPrimarySurfaceReady: input => {
            readyInputs.push({
              readyPartKey: input.readyPartKey,
              contentFailure: input.contentFailure,
            });
          },
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          canvas: {width: 960, height: 540},
          surfaceHostSource: host,
        }),
      );

    source.setRoot(rootWithContent(emptyContent()));
    source.setStatus('started');
    const renderer = await mount(render());
    expect(findByTestID(renderer, 'ui-base-render:fallback:container-empty').props.children).toContain('页面找不到');
    expect(queryRenderedTree(renderer, node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0);

    const contentBoundary = findByTestID(renderer, 'ui-base-render:screen-ready-boundary');
    await act(async () => {
      contentBoundary.props.onLayout({nativeEvent: {layout: {width: 800, height: 600}}});
    });
    expect(readyInputs).toEqual([
      {
        readyPartKey: null,
        contentFailure: 'container-empty',
      },
    ]);
    expect(hiddenReasons).toEqual(['startup-ready']);

    await act(async () => {
      source.setRoot(
        rootWithContent({
          contentSets: {
            PRIMARY: {containers: {root: {partKey: 'content-ready-part'}}, layers: []},
            SECONDARY: {containers: {}, layers: []},
          },
        }),
      );
      source.notify();
      await renderer.rerender(render(createRendererCatalog([])));
    });
    await act(async () => undefined);
    expect(findByTestID(renderer, 'ui.base.render:runtime-failure')).toBeDefined();
    expect(findByTestID(renderer, 'ui.base.render:runtime-failure:title').props.children).toBe('终端运行异常');
    expect(queryRenderedTree(renderer, node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0);
    expect(events.some(event => event.event === 'startup.failure-page-visible')).toBe(true);
    await act(async () => {
      await renderer.unmount();
    });

    const beforeReadySource = createSource();
    beforeReadySource.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {root: {partKey: 'content-ready-part'}}, layers: []},
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    beforeReadySource.setStatus('started');
    const beforeReadyRenderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: beforeReadySource.stateSource,
          uiCatalog,
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
          nativeLoadingCapability,
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          canvas: {width: 960, height: 540},
          surfaceHostSource: host,
        }),
      ),
    );
    expect(findByTestID(beforeReadyRenderer, 'ui.base.render:startup-failure')).toBeDefined();
    expect(findByTestID(beforeReadyRenderer, 'ui.base.render:startup-failure:title').props.children).toBe(
      '终端启动失败',
    );
    await act(async () => {
      await beforeReadyRenderer.unmount();
    });
  });

  it('does not treat an outer root or a fallback branch as rendered readiness', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const host = createHostSource(hostSnapshot(800, 600));
    const defined = part({partKey: 'missing-renderer-part', rendererKey: 'missing-renderer', component: Screen});
    const hiddenReasons: string[] = [];
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason);
        return {hidden: true, alreadyHidden: false, reason};
      },
    };
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {root: {partKey: 'missing-renderer-part'}}, layers: []},
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([defined.catalogEntry]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
          nativeLoadingCapability,
        },
        createElement(SurfaceRoot, {
          displayMode: 'PRIMARY',
          containerKey: 'root',
          canvas: {width: 960, height: 540},
          surfaceHostSource: host,
        }),
      ),
    );

    const root = findByTestID(renderer, 'ui-base-render:surface-root');
    await act(async () => {
      root.props.onLayout({nativeEvent: {layout: {width: 800, height: 600}}});
    });
    expect(hiddenReasons).toEqual(['startup-failure']);
    expect(renderer.getByTestId('ui-base-render:fallback:missing-renderer')).toBeDefined();
    expect(renderer.getByTestId('ui.base.render:startup-failure')).toBeDefined();
    expect(renderer.queryAllByTestId('ui-base-render:screen-ready-boundary')).toHaveLength(0);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps a system failure neutral on the SECONDARY physical surface', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const secondaryHost = createHostSource(
      Object.freeze({
        stableHostLogicalSize: Object.freeze({width: 800, height: 600}),
        isHostPrimaryDisplay: false,
        surfaceIdentity: Object.freeze({
          surfaceKey: 'SECONDARY' as const,
          displayIndex: 1 as const,
          surfaceForm: 'laptop' as const,
          displayMode: 'SECONDARY' as const,
        }),
      }),
    );
    const missingRenderer = part({
      partKey: 'secondary-missing-renderer-part',
      rendererKey: 'secondary-missing-renderer',
      component: Screen,
    });
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {}, layers: []},
          SECONDARY: {containers: {root: {partKey: missingRenderer.catalogEntry.partKey}}, layers: []},
        },
      }),
    );
    source.setStatus('started');
    const hiddenReasons: string[] = [];
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason);
        return {hidden: true, alreadyHidden: false, reason};
      },
    };
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([missingRenderer.catalogEntry]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
          nativeLoadingCapability,
        },
        createElement(SurfaceRoot, {
          displayMode: 'SECONDARY',
          containerKey: 'root',
          surfaceHostSource: secondaryHost,
        }),
      ),
    );

    expect(findByTestID(renderer, 'ui-base-render:fallback:missing-renderer')).toBeDefined();
    expect(queryRenderedTree(renderer, node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0);
    expect(queryRenderedTree(renderer, node => node.props.testID === 'ui.base.render:runtime-failure')).toHaveLength(0);
    expect(hiddenReasons).toEqual([]);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps a content failure visible on SECONDARY without reporting PRIMARY readiness', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const secondaryHost = createHostSource(
      Object.freeze({
        stableHostLogicalSize: Object.freeze({width: 800, height: 600}),
        isHostPrimaryDisplay: false,
        surfaceIdentity: Object.freeze({
          surfaceKey: 'SECONDARY' as const,
          displayIndex: 1 as const,
          surfaceForm: 'laptop' as const,
          displayMode: 'SECONDARY' as const,
        }),
      }),
    );
    const incompatible = part({
      partKey: 'secondary-content-part',
      rendererKey: 'secondary-content-renderer',
      component: Screen,
      surfaceForm: ['mobile'] as const,
    });
    const readyInputs: unknown[] = [];
    const hiddenReasons: string[] = [];
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason);
        return {hidden: true, alreadyHidden: false, reason};
      },
    };
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {}, layers: []},
          SECONDARY: {containers: {root: {partKey: incompatible.catalogEntry.partKey}}, layers: []},
        },
      }),
    );
    source.setStatus('started');
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([incompatible.catalogEntry]),
          rendererCatalog: createRendererCatalog([incompatible.rendererBinding]),
          logger,
          ...unusedRenderProviderBindings,
          nativeLoadingCapability,
          onPrimarySurfaceReady: input => {
            readyInputs.push(input);
          },
        },
        createElement(SurfaceRoot, {
          displayMode: 'SECONDARY',
          containerKey: 'root',
          surfaceHostSource: secondaryHost,
        }),
      ),
    );

    expect(findByTestID(renderer, 'ui-base-render:fallback:incompatible-catalog-entry')).toBeDefined();
    expect(findByTestID(renderer, 'ui-base-render:fallback:incompatible-catalog-entry').props.children).toContain(
      '页面找不到',
    );
    expect(queryRenderedTree(renderer, node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0);
    expect(queryRenderedTree(renderer, node => node.props.testID === 'ui.base.render:runtime-failure')).toHaveLength(0);
    expect(readyInputs).toHaveLength(0);
    expect(hiddenReasons).toEqual([]);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps content failure visible without native readiness when no physical host is attached', async () => {
    const source = createSource();
    const {logger} = createLogger();
    const missing = part({
      partKey: 'hostless-content-part',
      rendererKey: 'hostless-content-renderer',
      component: Screen,
    });
    const readyInputs: unknown[] = [];
    const hiddenReasons: string[] = [];
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason);
        return {hidden: true, alreadyHidden: false, reason};
      },
    };
    source.setRoot(
      rootWithContent({
        contentSets: {
          PRIMARY: {containers: {root: {partKey: 'hostless-missing-part'}}, layers: []},
          SECONDARY: {containers: {}, layers: []},
        },
      }),
    );
    source.setStatus('started');
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([missing.catalogEntry]),
          rendererCatalog: createRendererCatalog([missing.rendererBinding]),
          logger,
          ...unusedRenderProviderBindings,
          nativeLoadingCapability,
          onPrimarySurfaceReady: input => {
            readyInputs.push(input);
          },
        },
        createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
      ),
    );

    expect(findByTestID(renderer, 'ui-base-render:fallback:missing-catalog-entry')).toBeDefined();
    expect(readyInputs).toEqual([]);
    expect(hiddenReasons).toEqual([]);
    await act(async () => {
      await renderer.unmount();
    });
  });
});
