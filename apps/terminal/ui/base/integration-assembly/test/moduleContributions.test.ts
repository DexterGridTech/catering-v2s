import {unavailableRemoteControlPort} from '@catering-v2s/kernel-base-platform-ports';
import {createElement, type ReactElement} from 'react';
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
  defineActor,
  defineCommand,
  defineStateSelector,
  createRuntimeModule,
  onCommand,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {createUiRuntimeModule} from '@catering-v2s/ui-base-feature-assembly';
import {defineStateRuntimeSlice} from '@catering-v2s/kernel-base-state';
import {createModuleUiVariableFactory} from '@catering-v2s/kernel-base-ui-state';
import {definePart, type RenderProviderProps} from '@catering-v2s/ui-base-render';
import {createIntegrationAssembly} from '../src/application/integrationAssembly';
import {releaseRuntimeForTestAsync} from '../../../../kernel/base/runtime/src/testing';

const capturedRenderProvider = vi.hoisted(() => ({props: undefined as unknown}));
vi.mock('@catering-v2s/ui-base-render', async importOriginal => {
  const actual = await importOriginal<typeof import('@catering-v2s/ui-base-render')>();
  return {
    ...actual,
    RenderProvider: (props: RenderProviderProps) => {
      capturedRenderProvider.props = props;
      return null;
    },
  };
});

const moduleName = 'test.integration-module-contributions';
const startupReadyCommand = defineCommand<Readonly<{readonly ready: boolean}>>(moduleName, {
  name: 'startup-ready',
  visibility: 'public',
});

const createReadyModule = (): RuntimeModule =>
  createRuntimeModule({
    moduleName,
    kind: 'toolkit',
    dependencies: [],
    commandDefinitions: [startupReadyCommand],
    actorDefinitions: [
      defineActor(moduleName, 'startup-ready', [onCommand(startupReadyCommand, () => null)]),
    ],
  });

const nativeLoadingCapability: NativeLoadingCapability = Object.freeze({
  targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY', displayIndex: 0}),
  hideOnce: async reason => Object.freeze({hidden: true, alreadyHidden: false, reason}),
});

const platformPorts = createPlatformPorts({
  environmentMode: 'TEST',
  bindings: {
    logger: {kind: 'sink', write: () => ({status: 'succeeded', value: {}, completedAt: 0})},
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

const moduleWith = (
  name: string,
  contribution: Readonly<{partKey?: string; dismissalKey?: string; surfaceForm?: 'laptop' | 'mobile'}>,
) =>
  createUiRuntimeModule(
    createRuntimeModule({
      moduleName: `test.${name}`,
      kind: 'toolkit',
      dependencies: [],
      commandDefinitions: [],
      actorDefinitions: [],
      stateSlices: [],
    }),
    {
      ...(contribution.partKey === undefined
        ? contribution.dismissalKey === undefined
          ? {}
          : {
              parts: [
                definePart({
                  partKey: contribution.dismissalKey,
                  rendererKey: `${contribution.dismissalKey}.${contribution.surfaceForm ?? 'laptop'}`,
                  containerKeys: ['main'],
                  displayModes: ['PRIMARY'],
                  workspaces: ['MAIN'],
                  instanceModes: ['MASTER'],
                  surfaceForm: [contribution.surfaceForm ?? 'laptop'],
                  title: contribution.dismissalKey,
                  description: contribution.dismissalKey,
                  component: () => null,
                }),
              ],
            }
        : {
            parts: [
              definePart({
                partKey: contribution.partKey,
                rendererKey: `${contribution.partKey}.laptop`,
                containerKeys: ['main'],
                displayModes: ['PRIMARY'],
                workspaces: ['MAIN'],
                instanceModes: ['MASTER'],
                surfaceForm: [contribution.surfaceForm ?? 'laptop'],
                title: contribution.partKey,
                description: contribution.partKey,
                component: () => null,
              }),
            ],
          }),
      ...(contribution.dismissalKey === undefined
        ? {}
        : {layerDismissals: {[contribution.dismissalKey]: () => undefined}}),
    },
  );

const create = (modules: readonly RuntimeModule[] | (() => readonly RuntimeModule[])) =>
  createIntegrationAssembly({
    appName: 'test-module-contributions',
    errorPrefix: 'test-module-contributions',
    runtimeName: 'test-module-contributions',
    defaultPersistenceKey: 'test-module-contributions',
    platformPorts,
    nativeLoadingCapability,
    surfaceForm: 'laptop',
    surfaceDeclarations: {PRIMARY: {width: 1280, height: 800}},
    startupReadyCommand,
    createStartupReadyPayload: () => ({ready: true}),
    createApplicationModules: () => [
      createReadyModule(),
      ...(typeof modules === 'function' ? modules() : modules),
    ],
  });

const optionalModuleName = 'test.optional-feature-bundle';
const optionalPartKey = `${optionalModuleName}.part`;
const optionalStateName = `${optionalModuleName}.state`;
const optionalCommand = defineCommand(optionalModuleName, {name: 'run', visibility: 'public'});
const optionalSelector = defineStateSelector(optionalModuleName, 'loaded', {
  parameters: [],
  selector: () => true,
});
const optionalStateSlice = defineStateRuntimeSlice({
  name: optionalStateName,
  reducer: (state = {loaded: true}) => state,
  persistIntent: 'never',
  syncIntent: 'isolated',
});
const optionalVariable = createModuleUiVariableFactory(optionalModuleName).define('enabled', {
  defaultValue: true,
  persistIntent: 'never',
});

const createOptionalModule = (input: Readonly<{calls: string[]; failInstall?: boolean}>): RuntimeModule =>
  createUiRuntimeModule(
    createRuntimeModule({
      moduleName: optionalModuleName,
      kind: 'toolkit',
      dependencies: [],
      stateSlices: [optionalStateSlice],
      commandDefinitions: [optionalCommand],
      selectorDefinitions: [optionalSelector],
      actorDefinitions: [
        defineActor(optionalModuleName, 'commands', [
          onCommand(optionalCommand, () => {
            input.calls.push('run');
            return null;
          }),
        ]),
      ],
      ...(input.failInstall === undefined
        ? {}
        : {
            install: (context: Parameters<NonNullable<RuntimeModule['install']>>[0]) => {
              context.registerResource(() => undefined);
              if (input.failInstall) throw new Error('optional module install failed');
            },
          }),
    }),
    {
      parts: [
        definePart({
          partKey: optionalPartKey,
          rendererKey: `${optionalPartKey}.laptop`,
          containerKeys: ['main'],
          displayModes: ['PRIMARY'],
          workspaces: ['MAIN'],
          instanceModes: ['MASTER'],
          surfaceForm: ['laptop'],
          title: 'Optional part',
          description: 'Optional module part',
          component: () => null,
        }),
      ],
      variables: [optionalVariable],
      layerDismissals: {[optionalPartKey]: () => undefined},
    },
  );

const surfaceProvider = async (assembly: Awaited<ReturnType<typeof create>>): Promise<RenderProviderProps> => {
  capturedRenderProvider.props = undefined;
  const {renderToStaticMarkup} = (await import('react-dom/server' as string)) as {
    renderToStaticMarkup: (node: ReactElement) => string;
  };
  renderToStaticMarkup(assembly.createSurface({displayIndex: 0, displayMode: 'PRIMARY', surfaceForm: 'laptop'}));
  if (capturedRenderProvider.props === undefined) throw new Error('INTEGRATION_RENDER_PROVIDER_NOT_CAPTURED');
  return capturedRenderProvider.props as RenderProviderProps;
};

describe('integration module UI contributions', () => {
  it('rejects owner parts that reuse a part key on the same surface before creating a Runtime', async () => {
    await expect(
      create([moduleWith('first', {partKey: 'test.shared-part'}), moduleWith('second', {partKey: 'test.shared-part'})]),
    ).rejects.toThrow(/overlapping surfaceForm for test\.shared-part: laptop/);
  });

  it('rejects duplicate keyed dismissals instead of silently replacing the owner', async () => {
    await expect(
      create([
        moduleWith('first', {dismissalKey: 'test.shared-layer', surfaceForm: 'laptop'}),
        moduleWith('second', {dismissalKey: 'test.shared-layer', surfaceForm: 'mobile'}),
      ]),
    ).rejects.toThrow(/duplicate layer dismissal for partKey: test\.shared-layer/);
  });

  it('loads a complete package module with its Runtime and UI contributions', async () => {
    const calls: string[] = [];
    const assembly = await create([createOptionalModule({calls})]);
    try {
      expect(assembly.runtime.status).toBe('started');
      expect(assembly.runtime.descriptors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            moduleName: optionalModuleName,
            stateSliceNames: [optionalStateName],
            commandNames: [optionalCommand.commandName],
            actorKeys: [`${optionalModuleName}.commands`],
            selectorNames: [`${optionalModuleName}.loaded`],
          }),
        ]),
      );
      expect(assembly.runtime.getState()).toHaveProperty(optionalStateName);
      expect(assembly.runtime.evaluateSelector(`${optionalModuleName}.loaded`, [])).toBe(true);
      expect(
        (
          await assembly.runtime.dispatchCommand(optionalCommand, {}, {requestId: createRequestId()})
        ).status,
      ).toBe('completed');
      expect(calls).toEqual(['run']);

      const provider = await surfaceProvider(assembly);
      expect(provider.uiCatalog.entries.map(entry => entry.partKey)).toContain(optionalPartKey);
      expect(Object.keys(provider.layerDismissals ?? {})).toContain(optionalPartKey);
      expect(provider.selectUiVariable(assembly.runtime.getState(), optionalVariable)).toBe(true);
    } finally {
      await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });

  it('removes a failed package module and all its UI contributions in one Runtime replacement', async () => {
    let includeOptional = true;
    const calls: string[] = [];
    const assembly = await create(() =>
      includeOptional ? [createOptionalModule({calls, failInstall: true})] : [],
    );
    try {
      expect(assembly.runtime.status).toBe('failed');
      expect(assembly.runtime.descriptors).toEqual(
        expect.arrayContaining([expect.objectContaining({moduleName: optionalModuleName})]),
      );
      const oldProvider = await surfaceProvider(assembly);
      expect(oldProvider.uiCatalog.entries.map(entry => entry.partKey)).toContain(optionalPartKey);
      expect(Object.keys(oldProvider.layerDismissals ?? {})).toContain(optionalPartKey);

      includeOptional = false;
      await assembly.retryRuntime();

      expect(assembly.runtime.status).toBe('started');
      expect(assembly.runtime.descriptors.some(descriptor => descriptor.moduleName === optionalModuleName)).toBe(false);
      expect(assembly.runtime.descriptors.flatMap(descriptor => descriptor.commandNames)).not.toContain(
        optionalCommand.commandName,
      );
      expect(Object.hasOwn(assembly.runtime.getState(), optionalStateName)).toBe(false);
      expect(() => assembly.runtime.evaluateSelector(`${optionalModuleName}.loaded`, [])).toThrow(
        `RUNTIME_SELECTOR_NOT_REGISTERED:${optionalModuleName}.loaded`,
      );
      await expect(
        assembly.runtime.dispatchCommand(optionalCommand.commandName, {}, {requestId: createRequestId()}),
      ).rejects.toThrow();

      const newProvider = await surfaceProvider(assembly);
      expect(newProvider.uiCatalog.entries.map(entry => entry.partKey)).not.toContain(optionalPartKey);
      expect(Object.keys(newProvider.layerDismissals ?? {})).not.toContain(optionalPartKey);
      expect(() => newProvider.selectUiVariable(assembly.runtime.getState(), optionalVariable)).toThrow(
        `variable declaration is not registered: ${optionalVariable.key}`,
      );
      expect(calls).toEqual([]);
    } finally {
      if (assembly.runtime.status === 'started') await releaseRuntimeForTestAsync(assembly.runtime);
    }
  });
});
