import {render, type RenderResult} from '@testing-library/react-native';
import {createElement, type ComponentType, type ReactElement} from 'react';
import {describe, expect, it} from 'vitest';
import type {LogEvent, LogWriteInput, LogWriteResult, LoggerPort} from '@catering-v2s/kernel-base-platform-ports';
import {createRendererCatalog, definePart, RenderProvider, SurfaceRoot} from '../src';
import {createUiCatalog} from '@catering-v2s/kernel-base-ui-state';
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

const mount = (element: ReactElement): Promise<RenderResult> => render(element);

describe('LayerStack filtered hydration behavior', () => {
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
    await renderer.unmount();
  });
});
