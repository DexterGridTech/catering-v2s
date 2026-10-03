import {render, waitFor, type RenderResult} from '@testing-library/react-native';
import {createElement, type ComponentType, type ReactElement} from 'react';
import {describe, expect, it} from 'vitest';
import {Text, View} from 'react-native';
import type {LogEvent, LogWriteInput, LogWriteResult, LoggerPort} from '@catering-v2s/kernel-base-platform-ports';
import {
  createCatalogContext,
  createRendererCatalog,
  definePart,
  RenderProvider,
  SurfaceFocusBoundaryContext,
  SurfaceRoot,
} from '../src';
import {createUiCatalog, isUiCatalogEntryAvailable, selectLayers} from '@catering-v2s/kernel-base-ui-state';
import {unusedRenderProviderBindings} from './renderProviderBindings';

type RuntimeStateRoot = ReturnType<import('@catering-v2s/kernel-base-runtime').Runtime['getState']>;

const createSource = () => {
  let root = Object.freeze({}) as RuntimeStateRoot;
  const listeners = new Set<() => void>();
  return {
    stateSource: {
      getStatus: () => 'started' as const,
      getState: () => root,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    setRoot: (nextRoot: RuntimeStateRoot) => {
      root = nextRoot;
    },
    notify: () => {
      for (const listener of [...listeners]) listener();
    },
  };
};

const createLogger = (): LoggerPort => {
  const write = (_input: LogWriteInput): LogWriteResult => ({
    status: 'succeeded',
    value: {} as LogEvent,
    completedAt: 0,
  });
  const logger: LoggerPort = {
    debug: write,
    info: write,
    warn: write,
    error: write,
    scope: () => logger,
    withContext: () => logger,
  };
  return logger;
};

const rootWithStaleLayer = (): RuntimeStateRoot =>
  Object.freeze({
    'kernel.base.runtime.instance-mode': Object.freeze({instanceMode: 'MASTER'}),
    'kernel.base.display-context.display-role': Object.freeze({displayRole: 'CHIEF'}),
    'kernel.base.ui-state.content.MAIN': Object.freeze({
      contentSets: {
        PRIMARY: {
          containers: {},
          layers: [{layerId: 'stale-mobile-layer', partKey: 'sample.mobile-only', openedAt: 1}],
        },
        SECONDARY: {containers: {}, layers: []},
      },
    }),
    'kernel.base.ui-state.content.BRANCH': Object.freeze({
      contentSets: {PRIMARY: {containers: {}, layers: []}, SECONDARY: {containers: {}, layers: []}},
    }),
  }) as RuntimeStateRoot;

const rootWithLayers = (layers: readonly object[]): RuntimeStateRoot =>
  Object.freeze({
    'kernel.base.runtime.instance-mode': Object.freeze({instanceMode: 'MASTER'}),
    'kernel.base.display-context.display-role': Object.freeze({displayRole: 'CHIEF'}),
    'kernel.base.ui-state.content.MAIN': Object.freeze({
      contentSets: {
        PRIMARY: {containers: {}, layers},
        SECONDARY: {containers: {}, layers: []},
      },
    }),
    'kernel.base.ui-state.content.BRANCH': Object.freeze({
      contentSets: {PRIMARY: {containers: {}, layers: []}, SECONDARY: {containers: {}, layers: []}},
    }),
  }) as RuntimeStateRoot;

const layerPart = (partKey: string, rendererKey: string, component: ComponentType<object>) =>
  definePart({
    partKey,
    rendererKey,
    containerKeys: [],
    displayModes: ['PRIMARY'] as const,
    workspaces: ['MAIN'] as const,
    instanceModes: ['MASTER'] as const,
    surfaceForm: ['laptop'] as const,
    title: partKey,
    description: partKey,
    component,
  });

const surfaceWithAdminEntry = (children: ReactElement) =>
  createElement(
    SurfaceRoot,
    {
      displayMode: 'PRIMARY',
      containerKey: 'main',
      renderContentFrame: ({content}) => createElement(View, {testID: 'admin-launcher'}, content),
    },
    children,
  );

const mount = (element: ReactElement): Promise<RenderResult> => render(element);

describe('LayerStack filtered hydration behavior', () => {
  it('places the business interlock above business layers, below local admin, and suspends business focus', async () => {
    const source = createSource();
    const businessPart = layerPart('sample.business-layer', 'sample.business-layer.renderer', () => null);
    const adminPart = definePart({
      partKey: 'sample.local-admin-layer',
      rendererKey: 'sample.local-admin-layer.renderer',
      containerKeys: [],
      displayModes: ['PRIMARY'] as const,
      workspaces: ['MAIN'] as const,
      instanceModes: ['MASTER'] as const,
      surfaceForm: ['laptop'] as const,
      title: 'Local admin',
      description: 'Local admin layer',
      layerTier: 'admin',
      component: () => createElement(Text, {testID: 'local-admin-layer'}, 'admin'),
    });
    source.setRoot(
      rootWithLayers([
        {layerId: 'business-layer', partKey: businessPart.catalogEntry.partKey, openedAt: 3},
        {layerId: 'local-admin-layer', partKey: adminPart.catalogEntry.partKey, openedAt: 1},
      ]),
    );
    expect(selectLayers(source.stateSource.getState(), 'PRIMARY')).toHaveLength(2);
    const uiCatalog = createUiCatalog([businessPart.catalogEntry, adminPart.catalogEntry]);
    const catalogContext = createCatalogContext(source.stateSource.getState(), 'PRIMARY', 'laptop');
    expect(isUiCatalogEntryAvailable(businessPart.catalogEntry, null, catalogContext)).toBe(true);
    expect(isUiCatalogEntryAvailable(adminPart.catalogEntry, null, catalogContext)).toBe(true);
    const catalog = createRendererCatalog([businessPart.rendererBinding, adminPart.rendererBinding]);
    const focusEvents: string[] = [];

    const renderer = await mount(
      createElement(
        SurfaceFocusBoundaryContext.Provider,
        {value: phase => focusEvents.push(phase)},
        createElement(
          RenderProvider,
          {
            ...unusedRenderProviderBindings,
            stateSource: source.stateSource,
            uiCatalog,
            rendererCatalog: catalog,
            logger: createLogger(),
            selectBusinessInterlockActive: () => true,
            renderBusinessInterlock: () => createElement(View, {testID: 'business-interlock'}),
          },
          surfaceWithAdminEntry(createElement(Text, {testID: 'surface-content'}, 'surface')),
        ),
      ),
    );

    const interlockOrder = renderer
      .getAllByTestId(/business-interlock|local-admin-layer/)
      .filter(node => node.props.testID === 'business-interlock' || node.props.testID === 'local-admin-layer')
      .map(node => node.props.testID);
    expect(interlockOrder).toEqual(['business-interlock', 'local-admin-layer']);
    expect(renderer.getByTestId('business-interlock')).toBeDefined();
    expect(renderer.getByTestId('local-admin-layer')).toBeDefined();
    expect(
      renderer
        .getAllByTestId(/^ui-base-render:layer:/, {includeHiddenElements: true})
        .map(node => node.props.testID),
    ).toEqual([
      'ui-base-render:layer:business-layer',
      'ui-base-render:layer:local-admin-layer',
    ]);
    expect(renderer.getByTestId('ui-base-render:layer:business-layer', {includeHiddenElements: true}).props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    expect(renderer.getByTestId('ui-base-render:layer:local-admin-layer').props).toMatchObject({
      accessibilityElementsHidden: false,
      importantForAccessibility: 'auto',
    });
    await waitFor(() => expect(focusEvents).toContain('suspend'));
    await renderer.unmount();

    const isolatedSource = createSource();
    isolatedSource.setRoot(rootWithLayers([]));
    const isolatedFocusEvents: string[] = [];
    const isolatedRenderer = await mount(
      createElement(
        SurfaceFocusBoundaryContext.Provider,
        {value: phase => isolatedFocusEvents.push(phase)},
        createElement(
          RenderProvider,
          {
            ...unusedRenderProviderBindings,
            stateSource: isolatedSource.stateSource,
            uiCatalog: createUiCatalog([]),
            rendererCatalog: createRendererCatalog([]),
            logger: createLogger(),
            selectBusinessInterlockActive: () => true,
            renderBusinessInterlock: () => createElement(View, {testID: 'business-interlock'}),
          },
          createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'main'}),
        ),
      ),
    );
    expect(isolatedRenderer.getByTestId('business-interlock')).toBeDefined();
    await waitFor(() => expect(isolatedFocusEvents).toContain('suspend'));
    await isolatedRenderer.unmount();
  });

  it('does not leave a backdrop or empty layer for a placement unavailable in the current form', async () => {
    const source = createSource();
    source.setRoot(rootWithStaleLayer());
    const mobileOnly: ComponentType<object> = () => createElement('mobile-only-layer');
    const defined = definePart({
      partKey: 'sample.mobile-only',
      rendererKey: 'sample.mobile-only.renderer',
      containerKeys: [],
      displayModes: ['PRIMARY'] as const,
      workspaces: ['MAIN'] as const,
      instanceModes: ['MASTER'] as const,
      surfaceForm: ['mobile'] as const,
      title: 'Mobile only',
      description: 'Mobile only layer',
      component: mobileOnly,
    });
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          ...unusedRenderProviderBindings,
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([defined.catalogEntry]),
          rendererCatalog: createRendererCatalog([defined.rendererBinding]),
          logger: createLogger(),
        },
        createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'main'}),
      ),
    );

    expect(renderer.queryAllByTestId('ui-base-render:layer-backdrop')).toHaveLength(0);
    expect(renderer.queryAllByTestId('ui-base-render:layer:stale-mobile-layer')).toHaveLength(0);
    expect(renderer.getByTestId('ui-base-render:layer-stack').props.pointerEvents).toBe('box-none');
    await renderer.unmount();
  });

  it('catches a synchronous resolvePart failure in its owning layer without removing siblings', async () => {
    const source = createSource();
    const broken = layerPart('sample.broken-layer', 'sample.broken-layer.renderer', () => null);
    const healthy = layerPart('sample.healthy-layer', 'sample.healthy-layer.renderer', () =>
      createElement(Text, {testID: 'healthy-layer'}, 'healthy layer'),
    );
    source.setRoot(
      rootWithLayers([
        {layerId: 'broken-layer', partKey: broken.catalogEntry.partKey, openedAt: 1},
        {layerId: 'healthy-layer', partKey: healthy.catalogEntry.partKey, openedAt: 2},
      ]),
    );
    const catalog = createRendererCatalog([broken.rendererBinding, healthy.rendererBinding]);
    let brokenRendererResolveCount = 0;
    const rendererCatalog = {
      resolve: (rendererKey: string) => {
        if (rendererKey === broken.rendererBinding.rendererKey) {
          brokenRendererResolveCount += 1;
        }
        const layerResolution =
          rendererKey === broken.rendererBinding.rendererKey &&
          brokenRendererResolveCount >= (process.env.TERMINAL_TEST_DEV_MODE === 'true' ? 2 : 1);
        if (layerResolution) {
          throw new Error('resolvePart synchronous failure');
        }
        return catalog.resolve(rendererKey);
      },
      tierOf: catalog.tierOf,
      guardOf: catalog.guardOf,
    };

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          ...unusedRenderProviderBindings,
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([broken.catalogEntry, healthy.catalogEntry]),
          rendererCatalog,
          logger: createLogger(),
        },
        surfaceWithAdminEntry(createElement(Text, {testID: 'surface-content'}, 'surface content')),
      ),
    );

    await waitFor(() =>
      expect(renderer.getByTestId('ui-base-render:system-failure:layer:broken-layer:dismiss')).toBeDefined(),
    );
    expect(renderer.getByTestId('healthy-layer')).toBeDefined();
    expect(renderer.getByTestId('surface-content')).toBeDefined();
    expect(renderer.getByTestId('admin-launcher')).toBeDefined();
    await renderer.unmount();
  });

  it('catches LayerStack render failures outside the content boundary and keeps the management tree mounted', async () => {
    const source = createSource();
    const first = layerPart('sample.first-layer', 'sample.first-layer.renderer', () => null);
    const second = layerPart('sample.second-layer', 'sample.second-layer.renderer', () => null);
    source.setRoot(
      rootWithLayers([
        {layerId: 'first-layer', partKey: first.catalogEntry.partKey, openedAt: 1},
        {layerId: 'second-layer', partKey: second.catalogEntry.partKey, openedAt: 2},
      ]),
    );
    const catalog = createRendererCatalog([first.rendererBinding, second.rendererBinding]);
    const rendererCatalog = {
      resolve: catalog.resolve,
      tierOf: (_rendererKey: string) => {
        throw new Error('LayerStack comparator failure');
      },
      guardOf: catalog.guardOf,
    };

    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          ...unusedRenderProviderBindings,
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([first.catalogEntry, second.catalogEntry]),
          rendererCatalog,
          logger: createLogger(),
        },
        surfaceWithAdminEntry(createElement(Text, {testID: 'surface-content'}, 'surface content')),
      ),
    );

    expect(renderer.getByTestId('ui-base-render:system-failure:surface-layers:dismiss')).toBeDefined();
    expect(renderer.getByTestId('surface-content')).toBeDefined();
    expect(renderer.getByTestId('admin-launcher')).toBeDefined();
    await renderer.unmount();
  });
});
