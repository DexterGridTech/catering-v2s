import {unavailableRemoteControlPort} from '@catering-v2s/kernel-base-platform-ports';
import {act, type ReactNode} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type NativeLoadingCapability,
} from '@catering-v2s/kernel-base-platform-ports';
import {
  createRuntimeModule,
  defineActor,
  defineCommand,
  onCommand,
  selectLastLocalInteraction,
  type RuntimeModuleContext,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import {definePart, type RenderProviderProps} from '@catering-v2s/ui-base-render';
import {createUiRuntimeModule} from '@catering-v2s/ui-base-feature-assembly';
import {createIntegrationAssembly} from '../src/application/integrationAssembly';

const renderedBundle = vi.hoisted(() => ({props: undefined as unknown}));
vi.mock('@catering-v2s/ui-base-render', async importOriginal => {
  const actual = await importOriginal<typeof import('@catering-v2s/ui-base-render')>();
  const React = await import('react');
  return {
    ...actual,
    RenderProvider: (props: Readonly<{uiCatalog: Readonly<{entries: readonly Readonly<{partKey: string}>[]}>; children?: ReactNode}>) => {
      renderedBundle.props = props;
      return React.createElement('div', {'data-ui-part-keys': props.uiCatalog.entries.map(entry => entry.partKey).join(',')}, props.children);
    },
    SurfaceRoot: (props: Readonly<{children?: ReactNode}>) => React.createElement(React.Fragment, null, props.children),
  };
});

type TestRoot = Readonly<{render(node: ReactNode): void; unmount(): void}>;

const moduleName = 'test.console-owner-retry';
const startupReadyCommand = defineCommand<Readonly<{readonly ready: boolean}>>(moduleName, {
  name: 'startup-ready',
  visibility: 'public',
});

const nativeLoadingCapability: NativeLoadingCapability = Object.freeze({
  targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY', displayIndex: 0}),
  hideOnce: async reason => Object.freeze({hidden: true, alreadyHidden: false, reason}),
});

describe('console assembly runtime owner recovery', () => {
  it('replaces the bundle rendered by an already mounted surface when runtime retry succeeds', async () => {
    const events: unknown[] = [];
    let installAttempts = 0;
    let cleanupCalls = 0;
    const platformPorts = createPlatformPorts({
      environmentMode: 'TEST',
      bindings: {
        logger: {
          kind: 'sink',
          write: event => {
            events.push(event);
          },
        },
        persistKv: createProcessMemoryStateStoragePort(),
        persistSecure: createProcessMemoryStateStoragePort(),
        device: unavailableDevicePort,
        appControl: unavailableAppControlPort,
        script: unavailableScriptPort,
        connector: unavailableConnectorPort,
        update: unavailableUpdatePort,
        logUpload: unavailableLogUploadPort,
        topologyHost: unavailableTopologyHostPort,
        remoteControl: unavailableRemoteControlPort,
      },
    });

    const createApplicationModule = (): RuntimeModule => {
      const actor = defineActor(moduleName, 'startup-ready', [
        onCommand(startupReadyCommand, () => ({completed: true})),
      ]);
      const runtimeModule = createRuntimeModule({
        moduleName,
        kind: 'owner' as const,
        dependencies: [],
        commandDefinitions: [startupReadyCommand],
        actorDefinitions: [actor],
        install: (context: RuntimeModuleContext) => {
          installAttempts += 1;
          context.registerResource(() => {
            cleanupCalls += 1;
          });
          if (installAttempts === 1) throw new Error('first runtime install fails');
        },
      });
      return createUiRuntimeModule(runtimeModule, {
        parts: [
          definePart({
            partKey: `test.owner-part-${installAttempts}`,
            rendererKey: `test.owner-part-${installAttempts}.laptop`,
            containerKeys: ['main'],
            displayModes: ['PRIMARY'],
            workspaces: ['MAIN'],
            instanceModes: ['MASTER'],
            surfaceForm: ['laptop'],
            title: 'Owner part',
            description: 'Owner contribution for retry test',
            component: () => null,
          }),
        ],
      });
    };

    const assembly = await createIntegrationAssembly({
      appName: 'test-console-owner',
      errorPrefix: 'test-console-owner',
      runtimeName: 'test-console-owner',
      defaultPersistenceKey: 'test-console-owner',
      platformPorts,
      nativeLoadingCapability,
      surfaceForm: 'laptop',
      surfaceDeclarations: {PRIMARY: {width: 1280, height: 800}},
      startupReadyCommand,
      createStartupReadyPayload: () => ({ready: true}),
      createApplicationModules: () => [createApplicationModule()],
    });

    const failedRuntime = assembly.runtime;
    const surface = assembly.createSurface({displayIndex: 0, displayMode: 'PRIMARY', surfaceForm: 'laptop'});
    expect(failedRuntime.status).toBe('failed');
    expect(installAttempts).toBe(1);
    expect(cleanupCalls).toBe(1);
    expect(events).toEqual(expect.any(Array));

    const {JSDOM} = (await import('jsdom' as string)) as {
      JSDOM: new (html: string) => {window: Window & typeof globalThis; close(): void};
    };
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'window', {configurable: true, value: dom.window});
    Object.defineProperty(globalThis, 'document', {configurable: true, value: dom.window.document});
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {configurable: true, value: true});
    const {createRoot} = (await import('react-dom/client' as string)) as {
      createRoot(container: Element): TestRoot;
    };
    const root = createRoot(dom.window.document.getElementById('root') as Element);
    try {
      await act(async () => root.render(surface));
      const renderedContainer = dom.window.document.querySelector('[data-ui-part-keys]');
      expect(renderedContainer?.getAttribute('data-ui-part-keys')).toBe('test.owner-part-0');

      let firstRetry!: Promise<void>;
      await act(async () => {
        firstRetry = assembly.retryRuntime();
        const concurrentRetry = assembly.retryRuntime();
        expect(concurrentRetry).toBe(firstRetry);
        await firstRetry;
      });

      const recoveredRuntime = assembly.runtime;
      expect(recoveredRuntime.status).toBe('started');
      expect(recoveredRuntime.runtimeId).not.toBe(failedRuntime.runtimeId);
      expect(renderedContainer?.getAttribute('data-ui-part-keys')).toBe('test.owner-part-1');
      expect(installAttempts).toBe(2);
      expect(cleanupCalls).toBe(1);

      const providerProps = renderedBundle.props as RenderProviderProps;
      await act(async () => {
        await providerProps.onLocalInteraction?.();
      });
      expect(selectLastLocalInteraction(recoveredRuntime.getState()).revision).toBe(1);

      await act(async () => assembly.retryRuntime());
      expect(assembly.runtime).toBe(recoveredRuntime);
      expect(installAttempts).toBe(2);
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      if (oldWindow === undefined) Reflect.deleteProperty(globalThis, 'window');
      else Object.defineProperty(globalThis, 'window', oldWindow);
      if (oldDocument === undefined) Reflect.deleteProperty(globalThis, 'document');
      else Object.defineProperty(globalThis, 'document', oldDocument);
      Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    }
  });
});
