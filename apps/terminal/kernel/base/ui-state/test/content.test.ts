import {afterEach, describe, expect, it} from 'vitest';
import {createNodeId, createRequestId} from '@catering-v2s/kernel-base-contracts';
import {
  resolveSurfaceDisplayMode,
  resolveWorkspace,
  selectDisplayRole,
  switchDisplayRoleCommand,
  switchInstanceModeCommand,
  createDisplayContextModule,
} from '@catering-v2s/kernel-base-display-context';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {createRuntime, type Runtime, type RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import {moduleName as contractsModuleName} from '@catering-v2s/kernel-base-contracts';
import {
  moduleName as platformPortsModuleName,
  type LogEvent,
  type StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as stateModuleName} from '@catering-v2s/kernel-base-state';
import {
  clearLayersCommand,
  closeLayerCommand,
  createUiCatalog,
  createUiStateModule,
  isWorkspaceOwnedByInstanceMode,
  openLayerCommand,
  selectLayers,
  selectScreen,
  showScreenCommand,
  type UiCatalog,
} from '../src/index';
import {createDisplayPlatformPorts, FakeDevicePort} from '../../display-context/test/testSupport';
import {releaseRuntimeForTest, runtimeStateSyncForTest} from '@catering-v2s/kernel-base-runtime/testing';
import {createFakeStorage} from '../../state/test/testSupport';
import {parseLayerEntries} from '../src/foundations/workspaceSlices';

const createDependencies = (): readonly RuntimeModule[] => [
  Object.freeze({moduleName: contractsModuleName, kind: 'toolkit' as const, dependencies: []}),
  Object.freeze({
    moduleName: platformPortsModuleName,
    kind: 'toolkit' as const,
    dependencies: [{moduleName: contractsModuleName}],
  }),
  Object.freeze({
    moduleName: stateModuleName,
    kind: 'toolkit' as const,
    dependencies: [{moduleName: contractsModuleName}, {moduleName: platformPortsModuleName}],
  }),
];

const createFixture = async (
  input: Readonly<{
    plainStorage?: StateStoragePort;
    protectedStorage?: StateStoragePort;
    persistenceKey?: string;
    catalog?: UiCatalog;
  }> = {},
): Promise<
  Readonly<{
    runtime: Runtime;
    device: FakeDevicePort;
    events: LogEvent[];
    persistenceKey: string;
  }>
> => {
  const device = new FakeDevicePort();
  const events = createEvents();
  const persistenceKey = input.persistenceKey ?? `ui-state-content-${Math.random().toString(36).slice(2)}`;
  const runtime = createRuntime({
    localNodeId: createNodeId(),
    modules: [
      ...createDependencies(),
      createDisplayContextModule(),
      createUiStateModule({catalog: input.catalog ?? testLayerCatalog, variables: [], surfaceForm: 'laptop'}),
    ],
    platformPorts: createDisplayPlatformPorts({
      device,
      events,
      plainStorage: input.plainStorage,
      protectedStorage: input.protectedStorage,
    }),
    state: {
      runtimeName: `ui-state-content-${Math.random().toString(36).slice(2)}`,
      environmentMode: 'TEST',
      persistenceKey,
      persistenceDebounceMs: 0,
    },
  });
  await runtime.start();
  return Object.freeze({runtime, device, events, persistenceKey});
};

const createEvents = () => [] as LogEvent[];

const createTestLayerCatalog = (
  partKeys: readonly string[] = [
    'transient-layer',
    'payment-alert',
    'different-alert',
    'one',
    'two',
    'stale',
    'unavailable',
  ],
): UiCatalog =>
  createUiCatalog(
    partKeys.map(partKey => ({
      partKey,
      rendererKey: `${partKey}-renderer`,
      containerKeys: [],
      displayModes: ['PRIMARY', 'SECONDARY'] as const,
      workspaces: ['MAIN', 'BRANCH'] as const,
      instanceModes: ['MASTER', 'SLAVE'] as const,
      surfaceForm: ['laptop', 'mobile'] as const,
      title: partKey,
      description: partKey,
    })),
  );

const testLayerCatalog = createTestLayerCatalog();

const layerStorageKey = (
  persistenceKey: string,
  workspace: 'MAIN' | 'BRANCH',
  displayMode: 'PRIMARY' | 'SECONDARY',
): string =>
  [
    'catering-v2s.terminal.state.v1',
    encodeURIComponent(persistenceKey),
    encodeURIComponent(`kernel.base.ui-state.content.${workspace}`),
    'record',
    'layers',
    'entry',
    encodeURIComponent(displayMode),
  ].join('/');

const rawLayerStorage = (
  persistenceKey: string,
  workspace: 'MAIN' | 'BRANCH',
  displayMode: 'PRIMARY' | 'SECONDARY',
  value: unknown,
): Record<string, string> => ({
  [layerStorageKey(persistenceKey, workspace, displayMode)]: JSON.stringify(value),
});

const containerStorageKey = (
  persistenceKey: string,
  workspace: 'MAIN' | 'BRANCH',
  displayMode: 'PRIMARY' | 'SECONDARY',
): string =>
  [
    'catering-v2s.terminal.state.v1',
    encodeURIComponent(persistenceKey),
    encodeURIComponent(`kernel.base.ui-state.content.${workspace}`),
    'record',
    'containers',
    'entry',
    encodeURIComponent(displayMode),
  ].join('/');

const rawContainerStorage = (
  persistenceKey: string,
  workspace: 'MAIN' | 'BRANCH',
  displayMode: 'PRIMARY' | 'SECONDARY',
  value: unknown,
): Record<string, string> => ({
  [containerStorageKey(persistenceKey, workspace, displayMode)]: JSON.stringify(value),
});

const dispatchOptions = (displayMode: 'PRIMARY' | 'SECONDARY' = 'PRIMARY') => ({
  requestId: createRequestId(),
  routeContext: Object.freeze({workspace: 'MAIN' as const, instanceMode: 'MASTER' as const, displayMode}),
});

const currentTuple = (runtime: Runtime, displayIndex: 0 | 1 = 0) => {
  const state = runtime.getState();
  const instanceMode = selectRuntimeInstanceMode(state);
  const displayRole = selectDisplayRole(state);
  return Object.freeze({
    workspace: resolveWorkspace({instanceMode, displayRole}),
    displayMode: resolveSurfaceDisplayMode({displayIndex, displayRole, instanceMode}),
  });
};

describe('ui-state workspace content commands', () => {
  const runtimes: Runtime[] = [];

  it('keeps write ownership independent from the render workspace', () => {
    expect(isWorkspaceOwnedByInstanceMode({instanceMode: 'MASTER', workspace: 'MAIN'})).toBe(true);
    expect(isWorkspaceOwnedByInstanceMode({instanceMode: 'MASTER', workspace: 'BRANCH'})).toBe(false);
    expect(isWorkspaceOwnedByInstanceMode({instanceMode: 'SLAVE', workspace: 'BRANCH'})).toBe(true);
    expect(isWorkspaceOwnedByInstanceMode({instanceMode: 'SLAVE', workspace: 'MAIN'})).toBe(false);
  });

  afterEach(() => {
    for (const runtime of runtimes.splice(0)) releaseRuntimeForTest(runtime);
  });

  it('routes explicit displayMode independently from routeContext displayMode', async () => {
    const fixture = await createFixture();
    runtimes.push(fixture.runtime);

    const result = await fixture.runtime.dispatchCommand(
      showScreenCommand,
      {displayMode: 'SECONDARY', containerKey: 'root', partKey: 'customer-receipt'},
      dispatchOptions('PRIMARY'),
    );

    expect(result.status).toBe('completed');
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')).toEqual({
      partKey: 'customer-receipt',
    });
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')).toBeUndefined();
  });

  it('keeps all four workspace/mode buckets isolated', async () => {
    const fixture = await createFixture();
    runtimes.push(fixture.runtime);

    await fixture.runtime.dispatchCommand(
      showScreenCommand,
      {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        partKey: 'main-primary',
      },
      dispatchOptions('PRIMARY'),
    );
    await fixture.runtime.dispatchCommand(
      showScreenCommand,
      {
        displayMode: 'SECONDARY',
        containerKey: 'root',
        partKey: 'main-secondary',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('main-primary');
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')?.partKey).toBe('main-secondary');

    const modeResult = await fixture.runtime.dispatchCommand(
      switchInstanceModeCommand,
      {instanceMode: 'SLAVE'},
      dispatchOptions('PRIMARY'),
    );
    expect(modeResult.status).toBe('completed');
    expect(currentTuple(fixture.runtime)).toEqual({workspace: 'BRANCH', displayMode: 'PRIMARY'});
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')).toBeUndefined();
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')).toBeUndefined();

    await fixture.runtime.dispatchCommand(
      showScreenCommand,
      {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        partKey: 'branch-primary',
      },
      dispatchOptions('SECONDARY'),
    );
    await fixture.runtime.dispatchCommand(
      showScreenCommand,
      {
        displayMode: 'SECONDARY',
        containerKey: 'root',
        partKey: 'branch-secondary',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('branch-primary');
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')?.partKey).toBe('branch-secondary');

    await fixture.runtime.dispatchCommand(
      switchInstanceModeCommand,
      {
        instanceMode: 'MASTER',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(currentTuple(fixture.runtime)).toEqual({workspace: 'MAIN', displayMode: 'PRIMARY'});
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('main-primary');
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')?.partKey).toBe('main-secondary');
  });

  it('preserves BRANCH primary content across the single-screen CHIEF to VICE flip', async () => {
    const fixture = await createFixture();
    runtimes.push(fixture.runtime);

    await fixture.runtime.dispatchCommand(
      switchInstanceModeCommand,
      {
        instanceMode: 'SLAVE',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(currentTuple(fixture.runtime)).toEqual({workspace: 'BRANCH', displayMode: 'PRIMARY'});
    await fixture.runtime.dispatchCommand(
      showScreenCommand,
      {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        partKey: 'branch-login',
      },
      dispatchOptions('SECONDARY'),
    );

    await fixture.runtime.dispatchCommand(
      switchDisplayRoleCommand,
      {
        displayRole: 'VICE',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(currentTuple(fixture.runtime)).toEqual({workspace: 'MAIN', displayMode: 'SECONDARY'});
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')).toBeUndefined();

    const rejected = await fixture.runtime.dispatchCommand(
      showScreenCommand,
      {
        displayMode: 'SECONDARY',
        containerKey: 'root',
        partKey: 'vice-screen',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(rejected.status).toBe('error');
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')).toBeUndefined();

    await fixture.runtime.dispatchCommand(
      switchDisplayRoleCommand,
      {
        displayRole: 'CHIEF',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(currentTuple(fixture.runtime)).toEqual({workspace: 'BRANCH', displayMode: 'PRIMARY'});
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('branch-login');
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')).toBeUndefined();
  });

  it('restores containers and layers with order, props, and openedAt across a runtime restart', async () => {
    const plainStorage = createFakeStorage();
    const protectedStorage = createFakeStorage();
    const first = await createFixture({
      plainStorage,
      protectedStorage,
      persistenceKey: 'ui-state-content-restart',
    });
    runtimes.push(first.runtime);

    await first.runtime.dispatchCommand(
      showScreenCommand,
      {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        partKey: 'restored-screen',
      },
      dispatchOptions('PRIMARY'),
    );
    await first.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'PRIMARY',
        layerId: 'transient',
        partKey: 'transient-layer',
        props: {source: 'restart'},
      },
      dispatchOptions('PRIMARY'),
    );
    expect(selectScreen(first.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('restored-screen');
    expect(selectLayers(first.runtime.getState(), 'PRIMARY')).toHaveLength(1);
    const expectedLayers = selectLayers(first.runtime.getState(), 'PRIMARY');

    releaseRuntimeForTest(first.runtime);
    const second = await createFixture({
      plainStorage,
      protectedStorage,
      persistenceKey: first.persistenceKey,
    });
    runtimes.push(second.runtime);

    expect(selectScreen(second.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('restored-screen');
    expect(selectLayers(second.runtime.getState(), 'PRIMARY')).toEqual(expectedLayers);
    expect(Number.isInteger(expectedLayers[0]?.openedAt)).toBe(true);
    expect(expectedLayers[0]?.openedAt).toBeGreaterThan(0);
    expect(expectedLayers[0]?.props).toEqual({source: 'restart'});
  });

  it('does not persist an explicitly ephemeral layer and filters an old ephemeral row', async () => {
    const plainStorage = createFakeStorage();
    const protectedStorage = createFakeStorage();
    const persistenceKey = 'ui-state-content-ephemeral-layer';
    const first = await createFixture({plainStorage, protectedStorage, persistenceKey});
    runtimes.push(first.runtime);

    await first.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'PRIMARY',
        layerId: 'ephemeral-notice',
        partKey: 'one',
        persistence: 'ephemeral',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(selectLayers(first.runtime.getState(), 'PRIMARY')[0]?.persistence).toBe('ephemeral');
    releaseRuntimeForTest(first.runtime);

    const second = await createFixture({plainStorage, protectedStorage, persistenceKey});
    runtimes.push(second.runtime);
    expect(selectLayers(second.runtime.getState(), 'PRIMARY')).toEqual([]);

    const diagnostics: {readonly reason: string}[] = [];
    expect(
      parseLayerEntries(
        [
          {
            layerId: 'legacy-ephemeral',
            partKey: 'one',
            openedAt: 101,
            persistence: 'ephemeral',
          },
        ],
        {
          workspace: 'MAIN',
          displayMode: 'PRIMARY',
          onHydrationDiagnostic: diagnostic => {
            diagnostics.push(diagnostic);
          },
        },
      ),
    ).toEqual([]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.reason).toBe('ephemeral-entry');
  });

  it('restores layers independently in all four workspace/displayMode buckets', async () => {
    const plainStorage = createFakeStorage();
    const protectedStorage = createFakeStorage();
    const persistenceKey = 'ui-state-content-four-buckets';
    const first = await createFixture({plainStorage, protectedStorage, persistenceKey});
    runtimes.push(first.runtime);

    await first.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'PRIMARY',
        layerId: 'main-primary',
        partKey: 'one',
        props: {bucket: 'main-primary'},
      },
      dispatchOptions('PRIMARY'),
    );
    await first.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'SECONDARY',
        layerId: 'main-secondary',
        partKey: 'two',
        props: {bucket: 'main-secondary'},
      },
      dispatchOptions('SECONDARY'),
    );
    const expectedMainPrimary = selectLayers(first.runtime.getState(), 'PRIMARY');
    const expectedMainSecondary = selectLayers(first.runtime.getState(), 'SECONDARY');

    await first.runtime.dispatchCommand(
      switchInstanceModeCommand,
      {
        instanceMode: 'SLAVE',
      },
      dispatchOptions('PRIMARY'),
    );
    await first.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'PRIMARY',
        layerId: 'branch-primary',
        partKey: 'one',
        props: {bucket: 'branch-primary'},
      },
      dispatchOptions('PRIMARY'),
    );
    await first.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'SECONDARY',
        layerId: 'branch-secondary',
        partKey: 'two',
        props: {bucket: 'branch-secondary'},
      },
      dispatchOptions('SECONDARY'),
    );
    const expectedBranchPrimary = selectLayers(first.runtime.getState(), 'PRIMARY');
    const expectedBranchSecondary = selectLayers(first.runtime.getState(), 'SECONDARY');

    releaseRuntimeForTest(first.runtime);
    const second = await createFixture({plainStorage, protectedStorage, persistenceKey});
    runtimes.push(second.runtime);
    await second.runtime.dispatchCommand(
      switchInstanceModeCommand,
      {
        instanceMode: 'MASTER',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(selectLayers(second.runtime.getState(), 'PRIMARY')).toEqual(expectedMainPrimary);
    expect(selectLayers(second.runtime.getState(), 'SECONDARY')).toEqual(expectedMainSecondary);

    await second.runtime.dispatchCommand(
      switchInstanceModeCommand,
      {
        instanceMode: 'SLAVE',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(selectLayers(second.runtime.getState(), 'PRIMARY')).toEqual(expectedBranchPrimary);
    expect(selectLayers(second.runtime.getState(), 'SECONDARY')).toEqual(expectedBranchSecondary);
  });

  it('treats an old archive without layers entries as an empty layer state', async () => {
    const plainStorage = createFakeStorage();
    const protectedStorage = createFakeStorage();
    const persistenceKey = 'ui-state-content-old-archive';
    const first = await createFixture({plainStorage, protectedStorage, persistenceKey});
    runtimes.push(first.runtime);
    await first.runtime.dispatchCommand(
      showScreenCommand,
      {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        partKey: 'restored-screen',
      },
      dispatchOptions('PRIMARY'),
    );
    releaseRuntimeForTest(first.runtime);

    const second = await createFixture({plainStorage, protectedStorage, persistenceKey});
    runtimes.push(second.runtime);
    expect(selectScreen(second.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('restored-screen');
    expect(selectLayers(second.runtime.getState(), 'PRIMARY')).toEqual([]);
    expect(selectLayers(second.runtime.getState(), 'SECONDARY')).toEqual([]);
  });

  it('drops malformed and duplicate hydrated rows while retaining valid order and diagnostics', async () => {
    const persistenceKey = 'ui-state-content-invalid-layer-rows';
    const plainStorage = createFakeStorage(
      rawLayerStorage(persistenceKey, 'MAIN', 'PRIMARY', [
        {layerId: 'first', partKey: 'one', openedAt: 101, props: {ok: true}},
        {layerId: 'first', partKey: 'two', openedAt: 102},
        {layerId: 'bad-time', partKey: 'one', openedAt: 0},
        {layerId: 'missing-part', openedAt: 103},
        'not-an-object',
        {layerId: 'last', partKey: 'two', openedAt: 104},
      ]),
    );
    const protectedStorage = createFakeStorage();
    const fixture = await createFixture({plainStorage, protectedStorage, persistenceKey});
    runtimes.push(fixture.runtime);

    expect(selectLayers(fixture.runtime.getState(), 'PRIMARY').map(layer => layer.layerId)).toEqual(['first', 'last']);
    expect(selectLayers(fixture.runtime.getState(), 'PRIMARY')[0]?.props).toEqual({ok: true});
    expect(fixture.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'ui-state-hydration',
          data: expect.objectContaining({workspace: 'MAIN', displayMode: 'PRIMARY', reason: 'duplicate-layer-id'}),
        }),
        expect.objectContaining({
          category: 'ui-state-hydration',
          data: expect.objectContaining({workspace: 'MAIN', displayMode: 'PRIMARY', reason: 'invalid-entry'}),
        }),
      ]),
    );
  });

  it('drops a non-JSON props value in the layer hydration parser', () => {
    const diagnostics: {readonly reason: string}[] = [];
    const parsed = parseLayerEntries(
      [
        {layerId: 'invalid-props', partKey: 'one', openedAt: 101, props: {value: Symbol('invalid')}},
        {layerId: 'valid', partKey: 'two', openedAt: 102},
      ],
      {
        workspace: 'MAIN',
        displayMode: 'PRIMARY',
        onHydrationDiagnostic: diagnostic => {
          diagnostics.push(diagnostic);
        },
      },
    );

    expect(parsed.map(layer => layer.layerId)).toEqual(['valid']);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.reason).toBe('invalid-entry');
  });

  it('prunes malformed, unknown, and other-form hydrated containers before render', async () => {
    const persistenceKey = 'ui-state-content-container-prune';
    const plainStorage = createFakeStorage(
      rawContainerStorage(persistenceKey, 'MAIN', 'PRIMARY', {
        root: {partKey: 'known-screen'},
        mobile: {partKey: 'mobile-screen'},
        retired: {partKey: 'retired-screen'},
        broken: 'not-a-placement',
      }),
    );
    const protectedStorage = createFakeStorage();
    const catalog = createUiCatalog([
      {
        partKey: 'known-screen',
        rendererKey: 'known-screen-renderer',
        containerKeys: ['root'],
        displayModes: ['PRIMARY', 'SECONDARY'] as const,
        workspaces: ['MAIN', 'BRANCH'] as const,
        instanceModes: ['MASTER', 'SLAVE'] as const,
        surfaceForm: ['laptop', 'mobile'] as const,
        title: 'Known screen',
        description: 'Known screen',
      },
      {
        partKey: 'mobile-screen',
        rendererKey: 'mobile-screen-renderer',
        containerKeys: ['root'],
        displayModes: ['PRIMARY', 'SECONDARY'] as const,
        workspaces: ['MAIN', 'BRANCH'] as const,
        instanceModes: ['MASTER', 'SLAVE'] as const,
        surfaceForm: ['mobile'] as const,
        title: 'Mobile screen',
        description: 'Mobile screen',
      },
    ]);
    const fixture = await createFixture({plainStorage, protectedStorage, persistenceKey, catalog});
    runtimes.push(fixture.runtime);

    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('known-screen');
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'mobile')).toBeUndefined();
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'retired')).toBeUndefined();
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'broken')).toBeUndefined();
    expect(fixture.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'ui-state-hydration.container.discarded',
          data: expect.objectContaining({
            scope: 'container',
            containerKey: 'broken',
            reason: 'hydrated-container-invalid',
          }),
        }),
        expect.objectContaining({
          event: 'ui-state-hydration.container.not-renderable',
          data: expect.objectContaining({
            scope: 'container',
            containerKey: 'mobile',
            reason: 'hydrated-container-not-renderable',
          }),
        }),
        expect.objectContaining({
          event: 'ui-state-hydration.container.not-renderable',
          data: expect.objectContaining({
            scope: 'container',
            containerKey: 'retired',
            reason: 'hydrated-container-not-renderable',
          }),
        }),
      ]),
    );
    expect(
      fixture.events
        .filter(event => event.event === 'ui-state-hydration.container.not-renderable')
        .every(
          event =>
            event.message === 'Hydrated UI container was removed because it is not renderable in the current catalog',
        ),
    ).toBe(true);
    expect([...plainStorage.values.values()].some(value => value.includes('mobile-screen'))).toBe(false);
    expect([...plainStorage.values.values()].some(value => value.includes('retired-screen'))).toBe(false);
  });

  it('prunes unknown catalog members only in the instance-owned workspace', async () => {
    const persistenceKey = 'ui-state-content-membership-prune';
    const plainStorage = createFakeStorage();
    const protectedStorage = createFakeStorage();
    const first = await createFixture({plainStorage, protectedStorage, persistenceKey, catalog: testLayerCatalog});
    runtimes.push(first.runtime);
    await first.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'PRIMARY',
        layerId: 'stale-main-primary',
        partKey: 'stale',
      },
      dispatchOptions('PRIMARY'),
    );
    await first.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'SECONDARY',
        layerId: 'stale-main-secondary',
        partKey: 'stale',
      },
      dispatchOptions('SECONDARY'),
    );
    await first.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'PRIMARY',
        layerId: 'kept-main',
        partKey: 'one',
      },
      dispatchOptions('PRIMARY'),
    );
    await first.runtime.dispatchCommand(
      switchInstanceModeCommand,
      {
        instanceMode: 'SLAVE',
      },
      dispatchOptions('PRIMARY'),
    );
    await first.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'PRIMARY',
        layerId: 'stale-branch-primary',
        partKey: 'stale',
      },
      dispatchOptions('PRIMARY'),
    );
    await first.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'SECONDARY',
        layerId: 'stale-branch-secondary',
        partKey: 'stale',
      },
      dispatchOptions('SECONDARY'),
    );
    releaseRuntimeForTest(first.runtime);

    const withoutStale = createTestLayerCatalog([
      'transient-layer',
      'payment-alert',
      'different-alert',
      'one',
      'two',
      'unavailable',
    ]);
    const second = await createFixture({plainStorage, protectedStorage, persistenceKey, catalog: withoutStale});
    runtimes.push(second.runtime);
    await second.runtime.dispatchCommand(
      switchInstanceModeCommand,
      {
        instanceMode: 'MASTER',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(selectLayers(second.runtime.getState(), 'PRIMARY').map(layer => layer.layerId)).toEqual([
      'stale-main-primary',
      'kept-main',
    ]);
    expect(selectLayers(second.runtime.getState(), 'SECONDARY').map(layer => layer.layerId)).toEqual([
      'stale-main-secondary',
    ]);
    expect([...plainStorage.values.values()].some(value => value.includes('stale'))).toBe(true);
    expect(
      second.events.filter(event => event.category === 'ui-state-hydration' && event.data?.reason === 'unknown-part'),
    ).toHaveLength(2);

    await second.runtime.dispatchCommand(
      switchInstanceModeCommand,
      {
        instanceMode: 'SLAVE',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(selectLayers(second.runtime.getState(), 'PRIMARY')).toEqual([]);
    expect(selectLayers(second.runtime.getState(), 'SECONDARY')).toEqual([]);
  });

  it('projects the owner content slice in both declared sync directions', async () => {
    const source = await createFixture({persistenceKey: 'ui-state-content-projection-source'});
    const target = await createFixture({persistenceKey: 'ui-state-content-projection-target'});
    runtimes.push(source.runtime, target.runtime);

    const mainSliceName = Object.keys(source.runtime.getState()).find(name => name.endsWith('.content.MAIN'));
    const branchSliceName = Object.keys(source.runtime.getState()).find(name => name.endsWith('.content.BRANCH'));
    expect(mainSliceName).toBeDefined();
    expect(branchSliceName).toBeDefined();
    if (mainSliceName === undefined || branchSliceName === undefined) return;

    await source.runtime.dispatchCommand(
      showScreenCommand,
      {
        displayMode: 'SECONDARY',
        containerKey: 'root',
        partKey: 'one',
      },
      dispatchOptions('SECONDARY'),
    );
    const mainPayload = runtimeStateSyncForTest(source.runtime).createFullSyncPayload(mainSliceName);
    expect(mainPayload.status).toBe('ready');
    if (mainPayload.status !== 'ready') return;
    expect(
      runtimeStateSyncForTest(target.runtime).applyAuthoritativeSync(mainSliceName, mainPayload.payload).status,
    ).toBe('applied');
    expect(selectScreen(target.runtime.getState(), 'SECONDARY', 'root')).toMatchObject({partKey: 'one'});

    await source.runtime.dispatchCommand(
      switchInstanceModeCommand,
      {
        instanceMode: 'SLAVE',
      },
      dispatchOptions('PRIMARY'),
    );
    await source.runtime.dispatchCommand(
      switchDisplayRoleCommand,
      {
        displayRole: 'CHIEF',
      },
      dispatchOptions('PRIMARY'),
    );
    await source.runtime.dispatchCommand(
      showScreenCommand,
      {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        partKey: 'two',
      },
      dispatchOptions('PRIMARY'),
    );
    const branchPayload = runtimeStateSyncForTest(source.runtime).createFullSyncPayload(branchSliceName);
    expect(branchPayload.status).toBe('ready');
    if (branchPayload.status !== 'ready') return;
    expect(
      runtimeStateSyncForTest(target.runtime).applyAuthoritativeSync(branchSliceName, branchPayload.payload).status,
    ).toBe('applied');
    const projectedBranch = target.runtime.getState()[branchSliceName] as {
      readonly contentSets: {
        readonly PRIMARY: {readonly containers: Record<string, {readonly partKey: string}>};
      };
    };
    expect(projectedBranch.contentSets.PRIMARY.containers.root?.partKey).toBe('two');
  });

  it('keeps a catalog member when it is unavailable for the current surface', async () => {
    const persistenceKey = 'ui-state-content-unavailable-member';
    const plainStorage = createFakeStorage();
    const protectedStorage = createFakeStorage();
    const availableCatalog = createTestLayerCatalog(['unavailable']);
    const first = await createFixture({plainStorage, protectedStorage, persistenceKey, catalog: availableCatalog});
    runtimes.push(first.runtime);
    await first.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'PRIMARY',
        layerId: 'unavailable-layer',
        partKey: 'unavailable',
      },
      dispatchOptions('PRIMARY'),
    );
    const expected = selectLayers(first.runtime.getState(), 'PRIMARY');
    releaseRuntimeForTest(first.runtime);

    const mobileOnlyCatalog = createUiCatalog([
      {
        ...availableCatalog.entries[0]!,
        surfaceForm: ['mobile'] as const,
      },
    ]);
    const second = await createFixture({plainStorage, protectedStorage, persistenceKey, catalog: mobileOnlyCatalog});
    runtimes.push(second.runtime);
    expect(selectLayers(second.runtime.getState(), 'PRIMARY')).toEqual(expected);
    const writesAfterSecondStart = plainStorage.calls.write.length + protectedStorage.calls.write.length;
    releaseRuntimeForTest(second.runtime);
    const third = await createFixture({plainStorage, protectedStorage, persistenceKey, catalog: mobileOnlyCatalog});
    runtimes.push(third.runtime);
    expect(selectLayers(third.runtime.getState(), 'PRIMARY')).toEqual(expected);
    expect(plainStorage.calls.write.length + protectedStorage.calls.write.length).toBe(writesAfterSecondStart);
  });

  it('rejects duplicate layer ids, leaves the stack unchanged, and records a safe diagnostic', async () => {
    const fixture = await createFixture();
    runtimes.push(fixture.runtime);

    const first = await fixture.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'PRIMARY',
        layerId: 'payment',
        partKey: 'payment-alert',
        props: {amount: 12},
      },
      dispatchOptions('PRIMARY'),
    );
    expect(first.status).toBe('completed');
    const before = selectLayers(fixture.runtime.getState(), 'PRIMARY');
    const duplicate = await fixture.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'PRIMARY',
        layerId: 'payment',
        partKey: 'different-alert',
        props: {amount: 99},
      },
      dispatchOptions('PRIMARY'),
    );
    expect(duplicate.status).toBe('error');
    expect(selectLayers(fixture.runtime.getState(), 'PRIMARY')).toEqual(before);
    expect(fixture.events).toEqual(
      expect.arrayContaining([expect.objectContaining({event: 'ui-state.layer.duplicate-rejected'})]),
    );
  });

  it('closes only the requested mode and keeps an absent close idempotent', async () => {
    const fixture = await createFixture();
    runtimes.push(fixture.runtime);

    await fixture.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'PRIMARY',
        layerId: 'one',
        partKey: 'one',
      },
      dispatchOptions('PRIMARY'),
    );
    await fixture.runtime.dispatchCommand(
      openLayerCommand,
      {
        displayMode: 'SECONDARY',
        layerId: 'two',
        partKey: 'two',
      },
      dispatchOptions('PRIMARY'),
    );
    const close = await fixture.runtime.dispatchCommand(
      closeLayerCommand,
      {
        displayMode: 'PRIMARY',
        layerId: 'one',
      },
      dispatchOptions('SECONDARY'),
    );
    expect(close.status).toBe('completed');
    expect(selectLayers(fixture.runtime.getState(), 'PRIMARY')).toEqual([]);
    expect(selectLayers(fixture.runtime.getState(), 'SECONDARY').map(layer => layer.layerId)).toEqual(['two']);

    const absent = await fixture.runtime.dispatchCommand(
      closeLayerCommand,
      {
        displayMode: 'PRIMARY',
        layerId: 'missing',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(absent.status).toBe('completed');
    expect(absent.actorResults[0]?.result).toMatchObject({changed: false});

    const clear = await fixture.runtime.dispatchCommand(
      clearLayersCommand,
      {
        displayMode: 'SECONDARY',
      },
      dispatchOptions('PRIMARY'),
    );
    expect(clear.status).toBe('completed');
    expect(selectLayers(fixture.runtime.getState(), 'SECONDARY')).toEqual([]);
  });
});
