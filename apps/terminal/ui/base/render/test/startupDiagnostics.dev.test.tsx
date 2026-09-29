import {render} from '@testing-library/react-native';
import {createElement} from 'react';
import {describe, expect, it} from 'vitest';
import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailablePersistSecurePort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type LogEvent,
} from '@catering-v2s/kernel-base-platform-ports';
import {createUiCatalog} from '@catering-v2s/kernel-base-ui-state';
import {createRendererCatalog, definePart, RenderProvider} from '../src/index';
import {unusedRenderProviderBindings} from './renderProviderBindings';

const makePorts = (events: LogEvent[]) =>
  createPlatformPorts({
    environmentMode: 'DEV',
    bindings: {
      logger: {
        kind: 'sink',
        write: event => {
          events.push(event);
        },
      },
      persistKv: createProcessMemoryStateStoragePort(),
      persistSecure: unavailablePersistSecurePort,
      device: unavailableDevicePort,
      appControl: unavailableAppControlPort,
      script: unavailableScriptPort,
      connector: unavailableConnectorPort,
      hotUpdate: unavailableHotUpdatePort,
      logUpload: unavailableLogUploadPort,
      topologyHost: unavailableTopologyHostPort,
    },
  });

describe('render startup diagnostics', () => {
  it('reports catalog entries and missing renderer keys once from RenderProvider', async () => {
    const events: LogEvent[] = [];
    const ports = makePorts(events);
    const component = () => createElement('render-startup-fixture');
    const matching = definePart({
      partKey: 'startup.part.matching',
      rendererKey: 'startup.renderer.matching',
      containerKeys: ['root'],
      displayModes: ['PRIMARY'] as const,
      workspaces: ['MAIN'] as const,
      instanceModes: ['MASTER'] as const,
      surfaceForm: ['laptop', 'mobile'] as const,
      title: 'matching',
      description: 'matching',
      component,
    });
    const missing = {
      ...matching.catalogEntry,
      partKey: 'startup.part.missing',
      rendererKey: 'startup.renderer.missing',
    };
    const uiCatalog = createUiCatalog([matching.catalogEntry, missing]);
    const rendererCatalog = createRendererCatalog([matching.rendererBinding]);
    const stateSource = {
      getStatus: () => 'started' as const,
      getState: () => ({}),
      subscribe: () => () => undefined,
    };
    const renderer = await render(
      createElement(
        RenderProvider,
        {stateSource, uiCatalog, rendererCatalog, logger: ports.logger, ...unusedRenderProviderBindings},
        null,
      ),
    );
    const partsEvents = events.filter(event => event.category === 'startup.parts');
    if (!__DEV__) {
      expect(partsEvents).toHaveLength(0);
      await renderer.unmount();
      return;
    }
    expect(partsEvents, 'DEV_RENDER_PARTS_FACT_MISSING').toHaveLength(1);
    expect(partsEvents[0]?.data).toMatchObject({
      count: 2,
      missingRendererKeys: ['startup.renderer.missing'],
    });
    await renderer.unmount();
  });
});
