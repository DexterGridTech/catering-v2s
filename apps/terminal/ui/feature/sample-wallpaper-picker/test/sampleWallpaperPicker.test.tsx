/// <reference path="../src/types/assets.d.ts" />

import {fireEvent, render} from '@testing-library/react-native';
import {createElement, type ReactElement} from 'react';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import type {
  LogEvent,
  LogWriteInput,
  LogWriteResult,
  LoggerPort,
  NativeLoadingCapability,
} from '@catering-v2s/kernel-base-platform-ports';
import type {CommandDispatchResult, Runtime} from '@catering-v2s/kernel-base-runtime';
import {createRendererCatalog, RenderProvider, type RenderProviderProps} from '@catering-v2s/ui-base-render';
import {createUiCatalog} from '@catering-v2s/kernel-base-ui-state';
import {selectPendingWallpaperId, selectWallpaperId} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {logoutCommand} from '@catering-v2s/kernel-feature-sample-staff-session';
import {
  assetsById,
  branchWallpaperOptionTestId,
  branchWallpaperPickerTestIds,
  WallpaperBackground,
  wallpaperOptionSelectedCommand,
  confirmWallpaperRequestedCommand,
  wallpaperPickerExitRequestedCommand,
  wallpaperOptionTestId,
  wallpaperPickerTestIds,
  sampleWallpaperPickerAssembly,
} from '../src/index';
import {WallpaperPicker} from '../src/components/laptop/WallpaperPicker';
import {BranchWallpaperPicker} from '../src/components/laptop/BranchWallpaperPicker';
import {WallpaperPicker as MobileWallpaperPicker} from '../src/components/mobile/WallpaperPicker';
import {WallpaperSystemNotice} from '../src/components/laptop/WallpaperSystemNotice';
import {WallpaperSystemNotice as MobileWallpaperSystemNotice} from '../src/components/mobile/WallpaperSystemNotice';
import expectedW1 from '../assets/w1.jpg';
import expectedW2 from '../assets/w2.jpg';
import expectedW3 from '../assets/w3.jpg';
import {createWallpaperPickerActor} from '../src/features/actors/actors';
import {wallpaperSystemFailureDismissedCommand} from '../src/features/commands/commands';
import {queryRenderedTree} from '../../../../../../tools/terminal-shared/rntl-rendered-tree';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

type RuntimeStateRoot = ReturnType<Runtime['getState']>;
type TestInstance = Readonly<{
  readonly props: Readonly<Record<string, any>>;
  readonly children?: readonly unknown[];
}>;

const completed = (): CommandDispatchResult => ({
  requestId: null,
  commandId: 'cmd_test' as CommandDispatchResult['commandId'],
  status: 'completed',
  actorResults: [],
});

const resolvedSystemFailure = (): CommandDispatchResult => ({
  requestId: null,
  commandId: 'cmd_system_failure' as CommandDispatchResult['commandId'],
  status: 'error',
  actorResults: [
    {
      actorKey: 'test.system-failure',
      status: 'error',
      startedAt: 1,
      completedAt: 2,
      result: null,
      error: {
        key: 'test.system-failure',
        code: 'ERR_TEST_SYSTEM_FAILURE',
        message: 'test system failure',
        category: 'SYSTEM',
        severity: 'MEDIUM',
        details: {phase: 'before-write'},
      },
    },
  ],
});

const logger = (): LoggerPort => {
  const write = (_input: LogWriteInput): LogWriteResult => ({
    status: 'succeeded',
    value: {} as LogEvent,
    completedAt: 0,
  });
  const value: LoggerPort = {
    debug: write,
    info: write,
    warn: write,
    error: write,
    scope: () => value,
    withContext: () => value,
  };
  return value;
};

const createStateSource = (root: RuntimeStateRoot) => ({
  getStatus: () => 'started' as const,
  getState: () => root,
  subscribe: () => () => undefined,
});

const nativeLoadingCapability: NativeLoadingCapability = Object.freeze({
  targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY', displayIndex: 0}),
  hideOnce: async reason => Object.freeze({hidden: true, alreadyHidden: false, reason}),
});

const rootFor = (wallpaperId: 'none' | 'w1' | 'w2' | 'w3', pendingWallpaperId?: 'none' | 'w1' | 'w2' | 'w3') =>
  Object.freeze({
    'kernel.base.runtime.instance-mode': Object.freeze({instanceMode: 'MASTER'}),
    'kernel.base.display-context.display-role': Object.freeze({displayRole: 'CHIEF', powerConfirmation: null}),
    'kernel.feature.sample-wallpaper.selection': Object.freeze({
      wallpaperId,
      ...(pendingWallpaperId === undefined ? {} : {pendingWallpaperId}),
    }),
  }) as RuntimeStateRoot;

const mount = (element: ReactElement) => render(element);

const renderProvider = (
  root: RuntimeStateRoot,
  dispatchCommand: RenderProviderProps['dispatchCommand'],
  child: ReactElement,
) =>
  createElement(
    RenderProvider,
    {
      stateSource: createStateSource(root),
      uiCatalog: createUiCatalog([]),
      rendererCatalog: createRendererCatalog([]),
      logger: logger(),
      nativeLoadingCapability,
      runtimeFacts: {} as RenderProviderProps['runtimeFacts'],
      dispatchCommand,
      selectUiVariable: (_state, declaration) => declaration.defaultValue,
    },
    child,
  );

const commandDispatch = (calls: Array<Readonly<{name: string; payload: unknown}>>) =>
  (async command => {
    calls.push({name: command.definition.commandName, payload: command.payload});
    return completed();
  }) as RenderProviderProps['dispatchCommand'];

describe('sample wallpaper picker', () => {
  it('exports laptop/mobile renderer siblings and one asset map', () => {
    const expectedPair = (
      part: Readonly<{
        readonly partKey: string;
        readonly containerKeys: readonly string[];
        readonly displayModes: readonly string[];
        readonly workspaces: readonly string[];
        readonly instanceModes: readonly string[];
        readonly title: string;
        readonly layerTier: 'standard' | 'alert';
        readonly layerGuard: 'dismissible' | 'decisive';
      }>,
    ) =>
      (['laptop', 'mobile'] as const).map(surfaceForm => ({
        ...part,
        rendererKey: `${part.partKey}.${surfaceForm}`,
        surfaceForm: [surfaceForm],
      }));
    const metadata = sampleWallpaperPickerAssembly.parts.map(({catalogEntry, rendererBinding}) => ({
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
    }));
    expect(metadata).toEqual([
      ...expectedPair({
        partKey: 'sample.wallpaper.picker',
        containerKeys: ['main'],
        displayModes: ['PRIMARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER'],
        title: '屏幕壁纸',
        layerTier: 'standard',
        layerGuard: 'dismissible',
      }),
      ...expectedPair({
        partKey: 'sample.wallpaper.system-notice',
        containerKeys: [],
        displayModes: ['PRIMARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER'],
        title: '壁纸系统失败提示',
        layerTier: 'alert',
        layerGuard: 'dismissible',
      }),
      {
        partKey: 'sample.wallpaper.branch.picker',
        rendererKey: 'sample.wallpaper.branch.picker',
        containerKeys: ['main'],
        displayModes: ['PRIMARY'],
        workspaces: ['BRANCH'],
        instanceModes: ['SLAVE'],
        title: '副机本地壁纸',
        surfaceForm: ['laptop'],
        layerTier: 'standard',
        layerGuard: 'dismissible',
      },
      {
        partKey: 'sample.wallpaper.home',
        rendererKey: 'sample.wallpaper.home',
        containerKeys: ['main'],
        displayModes: ['PRIMARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER'],
        title: '当前壁纸',
        surfaceForm: ['laptop'],
        layerTier: 'standard',
        layerGuard: 'dismissible',
      },
      {
        partKey: 'sample.wallpaper.branch.home',
        rendererKey: 'sample.wallpaper.branch.home',
        containerKeys: ['main'],
        displayModes: ['PRIMARY'],
        workspaces: ['BRANCH'],
        instanceModes: ['SLAVE'],
        title: '副机当前壁纸',
        surfaceForm: ['laptop'],
        layerTier: 'standard',
        layerGuard: 'dismissible',
      },
      {
        partKey: 'sample.wallpaper.host-display',
        rendererKey: 'sample.wallpaper.host-display',
        containerKeys: ['main'],
        displayModes: ['SECONDARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER', 'SLAVE'],
        title: '主机已确认壁纸',
        surfaceForm: ['laptop'],
        layerTier: 'standard',
        layerGuard: 'dismissible',
      },
    ]);
    expect(Object.keys(assetsById)).toEqual(['none', 'w1', 'w2', 'w3']);
    expect(assetsById.none).toBeUndefined();
    expect(assetsById.w1).toBe(expectedW1);
    expect(assetsById.w2).toBe(expectedW2);
    expect(assetsById.w3).toBe(expectedW3);
  });

  it('ships three byte-distinct wallpaper assets independently of the runtime asset map', () => {
    const digests = ['w1.jpg', 'w2.jpg', 'w3.jpg'].map(fileName =>
      createHash('sha256')
        .update(readFileSync(new URL(`../assets/${fileName}`, import.meta.url)))
        .digest('hex'),
    );
    expect(new Set(digests).size).toBe(3);
  });

  it('renders four real radio controls from effective pending selection and derives confirm enabled', async () => {
    const renderer = await mount(
      renderProvider(rootFor('w1', 'w2'), commandDispatch([]), createElement(WallpaperPicker)),
    );
    const radios = queryRenderedTree(renderer, node => node.props.accessibilityRole === 'radio');
    expect(radios).toHaveLength(4);
    expect(renderer.getByTestId(wallpaperOptionTestId('w1')).props.accessibilityState.selected).toBe(false);
    expect(renderer.getByTestId(wallpaperOptionTestId('w2')).props.accessibilityState.selected).toBe(true);
    expect(renderer.getByTestId(wallpaperPickerTestIds.confirm).props.disabled).toBe(false);
    expect(renderer.getByTestId(wallpaperPickerTestIds.optionsScroll)).toBeTruthy();
    const options = renderer.getByTestId(wallpaperPickerTestIds.options);
    expect(options.props.style).toEqual({flexShrink: 0});
    expect(
      queryRenderedTree(
        renderer,
        node => typeof node.props.testID === 'string' && (node.props.testID as string).endsWith(':thumbnail'),
      ),
    ).toHaveLength(3);
    await renderer.unmount();
  });

  it('renders confirmed background only and leaves none without an image', async () => {
    const none = await mount(
      renderProvider(rootFor('none', 'w2'), commandDispatch([]), createElement(WallpaperBackground)),
    );
    expect(queryRenderedTree(none, node => node.props.testID === 'sample.wallpaper.background')).toHaveLength(0);
    await none.unmount();

    const selected = await mount(
      renderProvider(rootFor('w3'), commandDispatch([]), createElement(WallpaperBackground)),
    );
    const image = selected.getByTestId('sample.wallpaper.background');
    expect(image.props.source).toBe(expectedW3);
    expect(image.props.accessibilityLabel).toBe('当前壁纸：海滩');
    expect(image.props.resizeMode).toBe('cover');
    await selected.unmount();
  });

  it('resolves every non-none background source against the independent direct-import oracle', async () => {
    for (const [wallpaperId, expectedSource] of [
      ['w1', expectedW1],
      ['w2', expectedW2],
      ['w3', expectedW3],
    ] as const) {
      const renderer = await mount(
        renderProvider(rootFor(wallpaperId), commandDispatch([]), createElement(WallpaperBackground)),
      );
      expect(renderer.getByTestId('sample.wallpaper.background').props.source).toBe(expectedSource);
      await renderer.unmount();
    }
  });

  it('dispatches option and confirm intents through the real controls without local state', async () => {
    const calls: Array<Readonly<{name: string; payload: unknown}>> = [];
    const renderer = await mount(renderProvider(rootFor('w1'), commandDispatch(calls), createElement(WallpaperPicker)));
    const option = renderer.getByTestId(wallpaperOptionTestId('w2'));
    await fireEvent.press(option);
    expect(calls[0]).toMatchObject({
      name: wallpaperOptionSelectedCommand.commandName,
      payload: {wallpaperId: 'w2'},
    });
    const confirm = renderer.getByTestId(wallpaperPickerTestIds.confirm);
    expect(confirm.props.disabled).toBe(true);
    await renderer.unmount();
  });

  it('renders an independent SLAVE/BRANCH wallpaper page with local selectors and no logout affordance', async () => {
    const calls: Array<Readonly<{name: string; payload: unknown}>> = [];
    const renderer = await mount(
      renderProvider(rootFor('w1', 'w2'), commandDispatch(calls), createElement(BranchWallpaperPicker)),
    );
    expect(renderer.getByTestId(branchWallpaperPickerTestIds.root)).toBeTruthy();
    expect(renderer.getByTestId(branchWallpaperPickerTestIds.title).children).toContain('选择本机壁纸');
    expect(queryRenderedTree(renderer, node => node.props.accessibilityRole === 'radio')).toHaveLength(4);
    expect(renderer.getByTestId(branchWallpaperOptionTestId('w2')).props.accessibilityState.selected).toBe(true);
    expect(renderer.getByTestId(branchWallpaperPickerTestIds.confirm).props.disabled).toBe(false);
    expect(renderer.getByTestId(branchWallpaperPickerTestIds.exit)).toBeTruthy();
    expect(queryRenderedTree(renderer, node => node.props.testID === wallpaperPickerTestIds.logout)).toHaveLength(0);

    await fireEvent.press(renderer.getByTestId(branchWallpaperOptionTestId('w3')));
    expect(calls).toEqual([
      {name: wallpaperOptionSelectedCommand.commandName, payload: {wallpaperId: 'w3'}},
    ]);
    await fireEvent.press(renderer.getByTestId(branchWallpaperPickerTestIds.confirm));
    expect(calls[1]).toEqual({name: confirmWallpaperRequestedCommand.commandName, payload: {}});
    await renderer.unmount();
  });

  it('routes host MMP/LMP logout through the existing staff owner and keeps LSP exit separate', async () => {
    for (const Component of [MobileWallpaperPicker, WallpaperPicker]) {
      const calls: Array<Readonly<{name: string; payload: unknown}>> = [];
      const renderer = await mount(renderProvider(rootFor('w1'), commandDispatch(calls), createElement(Component)));
      await fireEvent.press(renderer.getByTestId(wallpaperPickerTestIds.logout));
      expect(calls).toEqual([{name: logoutCommand.commandName, payload: {}}]);
      if (Component === WallpaperPicker) {
        await fireEvent.press(renderer.getByTestId(wallpaperPickerTestIds.exit));
        expect(calls[1]).toEqual({name: wallpaperPickerExitRequestedCommand.commandName, payload: {}});
      }
      await renderer.unmount();
    }

    const branchCalls: Array<Readonly<{name: string; payload: unknown}>> = [];
    const branchRenderer = await mount(
      renderProvider(rootFor('w1'), commandDispatch(branchCalls), createElement(BranchWallpaperPicker)),
    );
    await fireEvent.press(branchRenderer.getByTestId(branchWallpaperPickerTestIds.exit));
    expect(branchCalls).toEqual([{name: wallpaperPickerExitRequestedCommand.commandName, payload: {}}]);
    expect(queryRenderedTree(branchRenderer, node => node.props.testID === wallpaperPickerTestIds.logout)).toHaveLength(0);
    await branchRenderer.unmount();
  });

  it('does not dispatch a kernel change command for the same effective option or a disabled confirm', async () => {
    const calls: Array<Readonly<{name: string; payload: unknown}>> = [];
    const renderer = await mount(renderProvider(rootFor('w1'), commandDispatch(calls), createElement(WallpaperPicker)));
    const same = renderer.getByTestId(wallpaperOptionTestId('w1'));
    await fireEvent.press(same);
    expect(calls).toHaveLength(1);
    const confirm = renderer.getByTestId(wallpaperPickerTestIds.confirm);
    expect(confirm.props.disabled).toBe(true);
    await fireEvent.press(confirm);
    expect(calls).toHaveLength(1);
    await renderer.unmount();
  });

  it('consumes a resolved system failure at the select production entrance and observes it in this feature', async () => {
    const calls: Array<Readonly<{name: string; payload: unknown}>> = [];
    const dispatch = (async command => {
      calls.push({name: command.definition.commandName, payload: command.payload});
      return command.definition.commandName === wallpaperOptionSelectedCommand.commandName
        ? resolvedSystemFailure()
        : completed();
    }) as RenderProviderProps['dispatchCommand'];
    const renderer = await mount(renderProvider(rootFor('w1'), dispatch, createElement(WallpaperPicker)));
    const option = renderer.getByTestId(wallpaperOptionTestId('w2'));
    await fireEvent.press(option);
    expect(calls.map(call => call.name)).toEqual([
      wallpaperOptionSelectedCommand.commandName,
      'ui.feature.sample-wallpaper-picker.wallpaper-system-failure-observed',
    ]);
    expect(calls[1]?.payload).toEqual({operation: 'select', phase: 'before-write'});
    await renderer.unmount();
  });

  it('consumes a rejected confirm dispatch and observes an unknown write phase without an unhandled rejection', async () => {
    const calls: Array<Readonly<{name: string; payload: unknown}>> = [];
    const dispatch = (async command => {
      calls.push({name: command.definition.commandName, payload: command.payload});
      if (command.definition.commandName === confirmWallpaperRequestedCommand.commandName) {
        throw new Error('test dispatch rejection');
      }
      return completed();
    }) as RenderProviderProps['dispatchCommand'];
    const renderer = await mount(renderProvider(rootFor('w1', 'w2'), dispatch, createElement(WallpaperPicker)));
    const confirm = renderer.getByTestId(wallpaperPickerTestIds.confirm);
    await fireEvent.press(confirm);
    expect(calls.map(call => call.name)).toEqual([
      confirmWallpaperRequestedCommand.commandName,
      'ui.feature.sample-wallpaper-picker.wallpaper-system-failure-observed',
    ]);
    expect(calls[1]?.payload).toEqual({operation: 'confirm', phase: 'unknown-write-phase'});
    await renderer.unmount();
  });

  it('keeps both picker notice profiles truthful for a confirm write-after failure', async () => {
    for (const [Component, isMobile] of [
      [WallpaperSystemNotice, false],
      [MobileWallpaperSystemNotice, true],
    ] as const) {
      const renderer = await mount(
        renderProvider(
          rootFor('w2'),
          commandDispatch([]),
          createElement(Component, {operation: 'confirm', phase: 'after-write'}),
        ),
      );
      expect(
        queryRenderedTree(renderer, node => node.props.testID === 'sample.wallpaper.system-notice:message').some(node =>
          node.children?.includes('壁纸已更换，但系统未能确认，无需重复操作'),
        ),
      ).toBe(true);
      expect(
        queryRenderedTree(renderer, node => node.props.testID === 'sample.wallpaper.system-notice').map(
          node => node.props.style,
        ),
      ).toContainEqual(
        isMobile ? {flex: 1, minHeight: 0, padding: 16, alignItems: 'stretch'} : {flex: 1, minHeight: 0, padding: 24},
      );
      expect(
        queryRenderedTree(renderer, node => node.props.testID === 'sample.wallpaper.system-notice:card')[0]?.props
          .style,
      ).toEqual(
        expect.arrayContaining([expect.objectContaining(isMobile ? {width: '100%'} : {width: '100%', maxWidth: 720})]),
      );
      expect(
        queryRenderedTree(renderer, node => node.props.testID === 'sample.wallpaper.system-notice:actions').map(
          node => node.props.className,
        ),
      ).toContain(isMobile ? 'w-full items-center gap-3' : 'flex-row flex-wrap items-start gap-3');
      const dismissStyles = queryRenderedTree(
        renderer,
        node => node.props.testID === 'sample.wallpaper.system-notice:dismiss',
      )[0]?.props.style;
      if (isMobile) expect(dismissStyles).toEqual(expect.arrayContaining([expect.objectContaining({width: '100%'})]));
      else expect(dismissStyles).toBeUndefined();
      await renderer.unmount();
    }
  });

  it('dispatches the wallpaper-picker-owned command when dismissing a system failure', async () => {
    const calls: Array<Readonly<{name: string; payload: unknown}>> = [];
    const renderer = await mount(
      renderProvider(
        rootFor('w1'),
        commandDispatch(calls),
        createElement(WallpaperSystemNotice, {operation: 'confirm', phase: 'after-write'}),
      ),
    );

    await fireEvent.press(renderer.getByTestId('sample.wallpaper.system-notice:dismiss'));
    expect(calls).toEqual([
      {
        name: wallpaperSystemFailureDismissedCommand.commandName,
        payload: {},
      },
    ]);
    await renderer.unmount();
  });

  it('uses the picker actor to dispatch only kernel commands for changed selection and confirmation', async () => {
    const calls: string[] = [];
    const actor = createWallpaperPickerActor();
    const context = (command: any, state: RuntimeStateRoot) =>
      ({
        runtimeId: 'runtime_test',
        localNodeId: 'node_test',
        platformPorts: {} as never,
        command,
        actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
        getState: () => state,
        dispatchAction: () => {
          throw new Error('picker actor must not dispatch a local action');
        },
        flushPersistence: async () => ({status: 'succeeded', value: {completed: true}, completedAt: 0}) as never,
        subscribeState: () => () => undefined,
        dispatchCommand: async (definition: {commandName: string}) => {
          calls.push(definition.commandName);
          return completed();
        },
        requestApplicationReset: () => undefined,
      }) as any;
    const selectHandler = actor.handlers.find(
      handler => handler.commandName === wallpaperOptionSelectedCommand.commandName,
    )!;
    const confirmHandler = actor.handlers.find(
      handler => handler.commandName === confirmWallpaperRequestedCommand.commandName,
    )!;

    await selectHandler.handle(
      context({commandName: wallpaperOptionSelectedCommand.commandName, payload: {wallpaperId: 'w1'}}, rootFor('w1')),
    );
    await selectHandler.handle(
      context(
        {commandName: wallpaperOptionSelectedCommand.commandName, payload: {wallpaperId: 'w2'}},
        rootFor('w1', 'w2'),
      ),
    );
    expect(calls).toEqual([]);

    await selectHandler.handle(
      context({commandName: wallpaperOptionSelectedCommand.commandName, payload: {wallpaperId: 'w2'}}, rootFor('w1')),
    );
    await confirmHandler.handle(
      context({commandName: confirmWallpaperRequestedCommand.commandName, payload: {}}, rootFor('w1', 'w2')),
    );
    expect(calls).toEqual([
      'kernel.feature.sample-wallpaper.select-wallpaper',
      'kernel.feature.sample-wallpaper.confirm-wallpaper',
    ]);
  });
});
