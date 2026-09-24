/// <reference path="../src/types/assets.d.ts" />

import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {createElement, type ReactElement} from 'react'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {describe, expect, it, vi} from 'vitest'
import type {LogEvent, LogWriteInput, LogWriteResult, LoggerPort, NativeLoadingCapability} from '@catering-v2s/ui-base-test-support'
import type {CommandDispatchResult, Runtime} from '@catering-v2s/kernel-base-runtime'
import {
  createRendererCatalog,
  RenderProvider,
  type RenderProviderProps,
} from '@catering-v2s/ui-base-render'
import {createUiCatalog} from '@catering-v2s/kernel-base-ui-state'
import {
  selectPendingWallpaperId,
  selectWallpaperId,
} from '@catering-v2s/kernel-feature-sample-wallpaper'
import {PrimitiveImage, PrimitiveRadio, PrimitiveScrollView} from '@catering-v2s/ui-base-primitives'
import {
  assetsById,
  WallpaperBackground,
  wallpaperOptionSelectedCommand,
  confirmWallpaperRequestedCommand,
  wallpaperOptionTestId,
  wallpaperPickerTestIds,
  sampleWallpaperPickerAssembly,
} from '../src/index'
import {WallpaperPicker} from '../src/components/laptop/WallpaperPicker'
import {WallpaperSystemNotice} from '../src/components/laptop/WallpaperSystemNotice'
import {WallpaperSystemNotice as MobileWallpaperSystemNotice} from '../src/components/mobile/WallpaperSystemNotice'
import expectedW1 from '../assets/w1.jpg'
import expectedW2 from '../assets/w2.jpg'
import expectedW3 from '../assets/w3.jpg'
import {createWallpaperPickerActor} from '../src/features/actors/actors'
import {wallpaperSystemFailureDismissedCommand} from '../src/features/commands/commands'

;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

type RuntimeStateRoot = ReturnType<Runtime['getState']>
type TestInstance = Readonly<{
  readonly props: Readonly<Record<string, any>>
  readonly children?: readonly unknown[]
}>

const completed = (): CommandDispatchResult => ({
  requestId: null,
  commandId: 'cmd_test' as CommandDispatchResult['commandId'],
  status: 'completed',
  actorResults: [],
})

const resolvedSystemFailure = (): CommandDispatchResult => ({
  requestId: null,
  commandId: 'cmd_system_failure' as CommandDispatchResult['commandId'],
  status: 'error',
  actorResults: [{
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
  }],
})

const logger = (): LoggerPort => {
  const write = (_input: LogWriteInput): LogWriteResult => ({
    status: 'succeeded',
    value: {} as LogEvent,
    completedAt: 0,
  })
  const value: LoggerPort = {
    debug: write,
    info: write,
    warn: write,
    error: write,
    scope: () => value,
    withContext: () => value,
  }
  return value
}

const createStateSource = (root: RuntimeStateRoot) => ({
  getStatus: () => 'started' as const,
  getState: () => root,
  subscribe: () => () => undefined,
})

const nativeLoadingCapability: NativeLoadingCapability = Object.freeze({
  targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY', displayIndex: 0}),
  hideOnce: async reason => Object.freeze({hidden: true, alreadyHidden: false, reason}),
})

const rootFor = (wallpaperId: 'none' | 'w1' | 'w2' | 'w3', pendingWallpaperId?: 'none' | 'w1' | 'w2' | 'w3') => Object.freeze({
  'kernel.base.runtime.instance-mode': Object.freeze({instanceMode: 'MASTER'}),
  'kernel.base.display-context.display-role': Object.freeze({displayRole: 'CHIEF', powerConfirmation: null}),
  'kernel.feature.sample-wallpaper.selection': Object.freeze({wallpaperId, ...(pendingWallpaperId === undefined ? {} : {pendingWallpaperId})}),
}) as RuntimeStateRoot

const mount = (element: ReactElement): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(element)
  })
  return renderer!
}

const renderProvider = (
  root: RuntimeStateRoot,
  dispatchCommand: RenderProviderProps['dispatchCommand'],
  child: ReactElement,
) => createElement(
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
)

const commandDispatch = (calls: Array<Readonly<{name: string; payload: unknown}>>) => (async command => {
  calls.push({name: command.definition.commandName, payload: command.payload})
  return completed()
}) as RenderProviderProps['dispatchCommand']

describe('sample wallpaper picker', () => {
  it('exports laptop/mobile renderer siblings and one asset map', () => {
    const expectedPair = (part: Readonly<{
      readonly partKey: string
      readonly containerKeys: readonly string[]
      readonly displayModes: readonly string[]
      readonly workspaces: readonly string[]
      readonly instanceModes: readonly string[]
      readonly title: string
      readonly layerTier: 'standard' | 'alert'
      readonly layerGuard: 'dismissible' | 'decisive'
    }>) => (['laptop', 'mobile'] as const).map(surfaceForm => ({
      ...part,
      rendererKey: `${part.partKey}.${surfaceForm}`,
      surfaceForm: [surfaceForm],
    }))
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
    }))
    expect(metadata).toEqual([
      ...expectedPair({partKey: 'sample.wallpaper.picker', containerKeys: ['main'], displayModes: ['PRIMARY'], workspaces: ['MAIN'], instanceModes: ['MASTER'], title: '屏幕壁纸', layerTier: 'standard', layerGuard: 'dismissible'}),
      ...expectedPair({partKey: 'sample.wallpaper.system-notice', containerKeys: [], displayModes: ['PRIMARY'], workspaces: ['MAIN'], instanceModes: ['MASTER'], title: '壁纸系统失败提示', layerTier: 'alert', layerGuard: 'dismissible'}),
    ])
    expect(Object.keys(assetsById)).toEqual(['none', 'w1', 'w2', 'w3'])
    expect(assetsById.none).toBeUndefined()
    expect(assetsById.w1).toBe(expectedW1)
    expect(assetsById.w2).toBe(expectedW2)
    expect(assetsById.w3).toBe(expectedW3)
  })

  it('ships three byte-distinct wallpaper assets independently of the runtime asset map', () => {
    const digests = ['w1.jpg', 'w2.jpg', 'w3.jpg'].map(fileName => createHash('sha256')
      .update(readFileSync(new URL(`../assets/${fileName}`, import.meta.url)))
      .digest('hex'))
    expect(new Set(digests).size).toBe(3)
  })

  it('renders four real radio controls from effective pending selection and derives confirm enabled', () => {
    const renderer = mount(renderProvider(rootFor('w1', 'w2'), commandDispatch([]), createElement(WallpaperPicker)))
    const radios = renderer.root.findAllByType(PrimitiveRadio)
    expect(radios).toHaveLength(4)
    expect(renderer.root.findByProps({testID: wallpaperOptionTestId('w1')}).props.selected).toBe(false)
    expect(renderer.root.findByProps({testID: wallpaperOptionTestId('w2')}).props.selected).toBe(true)
    expect(renderer.root.findByProps({testID: wallpaperPickerTestIds.confirm}).props.disabled).toBe(false)
    expect(renderer.root.findAllByType(PrimitiveScrollView)).toHaveLength(1)
    expect(renderer.root.findByType(PrimitiveScrollView).props.layout).toBe('transparent')
    const options = renderer.root.findByProps({testID: wallpaperPickerTestIds.options})
    expect(options.props.style).toEqual({flexShrink: 0})
    expect(renderer.root.findAllByType(PrimitiveImage)).toHaveLength(3)
    renderer.unmount()
  })

  it('renders confirmed background only and leaves none without an image', () => {
    const none = mount(renderProvider(rootFor('none', 'w2'), commandDispatch([]), createElement(WallpaperBackground)))
    expect(none.root.findAllByType(PrimitiveImage)).toHaveLength(0)
    none.unmount()

    const selected = mount(renderProvider(rootFor('w3'), commandDispatch([]), createElement(WallpaperBackground)))
    const image = selected.root.findByProps({testID: 'sample.wallpaper.background'})
    expect(image.props.source).toBe(expectedW3)
    expect(image.props.accessibilityLabel).toBe('当前壁纸：海滩')
    expect(image.props.layout).toBe('background')
    selected.unmount()
  })

  it('resolves every non-none background source against the independent direct-import oracle', () => {
    for (const [wallpaperId, expectedSource] of [
      ['w1', expectedW1],
      ['w2', expectedW2],
      ['w3', expectedW3],
    ] as const) {
      const renderer = mount(renderProvider(rootFor(wallpaperId), commandDispatch([]), createElement(WallpaperBackground)))
      expect(renderer.root.findByProps({testID: 'sample.wallpaper.background'}).props.source).toBe(expectedSource)
      renderer.unmount()
    }
  })

  it('dispatches option and confirm intents through the real controls without local state', async () => {
    const calls: Array<Readonly<{name: string; payload: unknown}>> = []
    const renderer = mount(renderProvider(rootFor('w1'), commandDispatch(calls), createElement(WallpaperPicker)))
    const option = renderer.root.findByProps({testID: wallpaperOptionTestId('w2')})
    await act(async () => { await option.props.onSelectedChange() })
    expect(calls[0]).toMatchObject({
      name: wallpaperOptionSelectedCommand.commandName,
      payload: {wallpaperId: 'w2'},
    })
    const confirm = renderer.root.findByProps({testID: wallpaperPickerTestIds.confirm})
    expect(confirm.props.disabled).toBe(true)
    renderer.unmount()
  })

  it('does not dispatch a kernel change command for the same effective option or a disabled confirm', async () => {
    const calls: Array<Readonly<{name: string; payload: unknown}>> = []
    const renderer = mount(renderProvider(rootFor('w1'), commandDispatch(calls), createElement(WallpaperPicker)))
    const same = renderer.root.findByProps({testID: wallpaperOptionTestId('w1')})
    await act(async () => { await same.props.onSelectedChange() })
    expect(calls).toHaveLength(1)
    const confirm = renderer.root.findByProps({testID: wallpaperPickerTestIds.confirm})
    expect(confirm.props.disabled).toBe(true)
    act(() => { confirm.props.onPress() })
    expect(calls).toHaveLength(1)
    renderer.unmount()
  })

  it('consumes a resolved system failure at the select production entrance and observes it in this feature', async () => {
    const calls: Array<Readonly<{name: string; payload: unknown}>> = []
    const dispatch = (async command => {
      calls.push({name: command.definition.commandName, payload: command.payload})
      return command.definition.commandName === wallpaperOptionSelectedCommand.commandName
        ? resolvedSystemFailure()
        : completed()
    }) as RenderProviderProps['dispatchCommand']
    const renderer = mount(renderProvider(rootFor('w1'), dispatch, createElement(WallpaperPicker)))
    const option = renderer.root.findByProps({testID: wallpaperOptionTestId('w2')})
    await act(async () => { await option.props.onSelectedChange() })
    expect(calls.map(call => call.name)).toEqual([
      wallpaperOptionSelectedCommand.commandName,
      'ui.feature.sample-wallpaper-picker.wallpaper-system-failure-observed',
    ])
    expect(calls[1]?.payload).toEqual({operation: 'select', phase: 'before-write'})
    renderer.unmount()
  })

  it('consumes a rejected confirm dispatch and observes an unknown write phase without an unhandled rejection', async () => {
    const calls: Array<Readonly<{name: string; payload: unknown}>> = []
    const dispatch = (async command => {
      calls.push({name: command.definition.commandName, payload: command.payload})
      if (command.definition.commandName === confirmWallpaperRequestedCommand.commandName) {
        throw new Error('test dispatch rejection')
      }
      return completed()
    }) as RenderProviderProps['dispatchCommand']
    const renderer = mount(renderProvider(rootFor('w1', 'w2'), dispatch, createElement(WallpaperPicker)))
    const confirm = renderer.root.findByProps({testID: wallpaperPickerTestIds.confirm})
    await act(async () => { await confirm.props.onPress() })
    expect(calls.map(call => call.name)).toEqual([
      confirmWallpaperRequestedCommand.commandName,
      'ui.feature.sample-wallpaper-picker.wallpaper-system-failure-observed',
    ])
    expect(calls[1]?.payload).toEqual({operation: 'confirm', phase: 'unknown-write-phase'})
    renderer.unmount()
  })

  it('keeps both picker notice profiles truthful for a confirm write-after failure', () => {
    for (const [Component, isMobile] of [[WallpaperSystemNotice, false], [MobileWallpaperSystemNotice, true]] as const) {
      const renderer = mount(renderProvider(
        rootFor('w2'),
        commandDispatch([]),
        createElement(Component, {operation: 'confirm', phase: 'after-write'}),
      ))
      expect(renderer.root.findAllByProps({testID: 'sample.wallpaper.system-notice:message'})
        .some(node => node.children?.includes('壁纸已更换，但系统未能确认，无需重复操作'))).toBe(true)
      expect(renderer.root.findAllByProps({testID: 'sample.wallpaper.system-notice'}).map(node => node.props.style))
        .toContainEqual(isMobile ? {flex: 1, minHeight: 0, padding: 16, alignItems: 'stretch'} : {flex: 1, minHeight: 0, padding: 24})
      expect(renderer.root.findAllByProps({testID: 'sample.wallpaper.system-notice:card'}).map(node => node.props.style))
        .toContainEqual(isMobile ? {width: '100%'} : {width: '100%', maxWidth: 720})
      expect(renderer.root.findAllByProps({testID: 'sample.wallpaper.system-notice:actions'}).map(node => node.props.className))
        .toContain(isMobile ? 'w-full items-center gap-3' : 'flex-row flex-wrap items-start gap-3')
      expect(renderer.root.findAllByProps({testID: 'sample.wallpaper.system-notice:dismiss'}).map(node => node.props.style))
        .toContainEqual(isMobile ? {width: '100%'} : undefined)
      renderer.unmount()
    }
  })

  it('dispatches the wallpaper-picker-owned command when dismissing a system failure', async () => {
    const calls: Array<Readonly<{name: string; payload: unknown}>> = []
    const renderer = mount(renderProvider(
      rootFor('w1'),
      commandDispatch(calls),
      createElement(WallpaperSystemNotice, {operation: 'confirm', phase: 'after-write'}),
    ))

    await act(async () => {
      await renderer.root.findByProps({testID: 'sample.wallpaper.system-notice:dismiss'}).props.onPress()
    })
    expect(calls).toEqual([{
      name: wallpaperSystemFailureDismissedCommand.commandName,
      payload: {},
    }])
    renderer.unmount()
  })

  it('uses the picker actor to dispatch only kernel commands for changed selection and confirmation', async () => {
    const calls: string[] = []
    const actor = createWallpaperPickerActor()
    const context = (command: any, state: RuntimeStateRoot) => ({
      runtimeId: 'runtime_test',
      localNodeId: 'node_test',
      platformPorts: {} as never,
      command,
      actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
      getState: () => state,
      dispatchAction: () => { throw new Error('picker actor must not dispatch a local action') },
      flushPersistence: async () => ({status: 'succeeded', value: {completed: true}, completedAt: 0} as never),
      subscribeState: () => () => undefined,
      dispatchCommand: async (definition: {commandName: string}) => {
        calls.push(definition.commandName)
        return completed()
      },
      requestApplicationReset: () => undefined,
    }) as any
    const selectHandler = actor.handlers.find(handler => handler.commandName === wallpaperOptionSelectedCommand.commandName)!
    const confirmHandler = actor.handlers.find(handler => handler.commandName === confirmWallpaperRequestedCommand.commandName)!

    await selectHandler.handle(context({commandName: wallpaperOptionSelectedCommand.commandName, payload: {wallpaperId: 'w1'}}, rootFor('w1')))
    await selectHandler.handle(context({commandName: wallpaperOptionSelectedCommand.commandName, payload: {wallpaperId: 'w2'}}, rootFor('w1', 'w2')))
    expect(calls).toEqual([])

    await selectHandler.handle(context({commandName: wallpaperOptionSelectedCommand.commandName, payload: {wallpaperId: 'w2'}}, rootFor('w1')))
    await confirmHandler.handle(context({commandName: confirmWallpaperRequestedCommand.commandName, payload: {}}, rootFor('w1', 'w2')))
    expect(calls).toEqual(['kernel.feature.sample-wallpaper.select-wallpaper', 'kernel.feature.sample-wallpaper.confirm-wallpaper'])
  })
})
