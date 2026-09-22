import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {createElement} from 'react'
import {describe, expect, it} from 'vitest'
import {createAppError, createModuleErrorFactory, createRequestId} from '@catering-v2s/kernel-base-contracts'
import {createDisplayContextModule} from '@catering-v2s/kernel-base-display-context'
import {createUiCatalog, createUiStateModule, selectLayers} from '@catering-v2s/kernel-base-ui-state'
import type {LogEvent, LogWriteInput, LogWriteResult, LoggerPort, NativeLoadingCapability} from '@catering-v2s/ui-base-test-support'
import {
  defineActor,
  onCommand,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime'
import {
  confirmWallpaperCommand,
  createSampleWallpaperModule,
  selectWallpaperCommand,
  selectPendingWallpaperId,
  selectWallpaperId,
} from '@catering-v2s/kernel-feature-sample-wallpaper'
import {createSampleWallpaperPickerModule} from '../src/application/module'
import {WallpaperPicker} from '../src/components/laptop/WallpaperPicker'
import {
  confirmWallpaperRequestedCommand,
  wallpaperOptionSelectedCommand,
  wallpaperSystemFailureObservedCommand,
} from '../src/features/commands/commands'
import {sampleWallpaperPickerAssembly} from '../src/assembly/assembly'
import {createTestRuntime} from '../../../../kernel/feature/sample-wallpaper/test/support'
import {releaseRuntimeForTest} from '../../../../kernel/base/runtime/src/testing'
import {
  createRendererCatalog,
  RenderProvider,
  type RenderProviderProps,
} from '@catering-v2s/ui-base-render'
import {wallpaperOptionTestId} from '../src/foundations/wallpaperPickerTestIds'

;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

const injectionModuleName = 'test.ui.sample-wallpaper-picker-failure-injection'
const defineError = createModuleErrorFactory(injectionModuleName)
const injectedFailureDefinition = defineError('child-write-after-failure', {
  name: 'Injected child write-after failure',
  defaultTemplate: 'Injected child write-after failure',
  category: 'SYSTEM',
  severity: 'MEDIUM',
  code: 'ERR_TEST_TER_SAMPLE_WALLPAPER_CHILD_WRITE_AFTER_FAILURE',
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

const nativeLoadingCapability: NativeLoadingCapability = Object.freeze({
  targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY', displayIndex: 0}),
  hideOnce: async reason => Object.freeze({hidden: true, alreadyHidden: false, reason}),
})

const failureInjectionModule = (): RuntimeModule => {
  const actor = defineActor(injectionModuleName, 'child-write-after-failure', [
    onCommand(selectWallpaperCommand, context => Promise.reject(createAppError(injectedFailureDefinition, {
        context: {
          commandName: context.command.commandName,
          commandId: context.command.commandId,
          requestId: context.command.requestId ?? undefined,
          nodeId: context.localNodeId,
        },
      }))),
    onCommand(confirmWallpaperCommand, context => Promise.reject(createAppError(injectedFailureDefinition, {
        context: {
          commandName: context.command.commandName,
          commandId: context.command.commandId,
          requestId: context.command.requestId ?? undefined,
          nodeId: context.localNodeId,
        },
      }))),
  ])
  return Object.freeze({
    moduleName: injectionModuleName,
    kind: 'owner' as const,
    dependencies: [{moduleName: 'kernel.base.runtime'}],
    commands: [],
    commandDefinitions: [],
    actors: [{name: actor.actorName}],
    actorDefinitions: [actor],
    slices: [],
    stateSlices: [],
  })
}

const beforeWriteFailureWallpaperModule = (): RuntimeModule => {
  const actor = defineActor('kernel.feature.sample-wallpaper', 'before-write-failure', [
    onCommand(selectWallpaperCommand, context => {
      throw createAppError(injectedFailureDefinition, {
        context: {
          commandName: context.command.commandName,
          commandId: context.command.commandId,
          requestId: context.command.requestId ?? undefined,
          nodeId: context.localNodeId,
        },
      })
    }),
    onCommand(confirmWallpaperCommand, context => {
      throw createAppError(injectedFailureDefinition, {
        context: {
          commandName: context.command.commandName,
          commandId: context.command.commandId,
          requestId: context.command.requestId ?? undefined,
          nodeId: context.localNodeId,
        },
      })
    }),
  ])
  return Object.freeze({
    ...createSampleWallpaperModule(),
    actors: [{name: actor.actorName}],
    actorDefinitions: [actor],
  })
}

type TestRuntime = ReturnType<typeof createTestRuntime>

const mountPicker = (runtime: TestRuntime, catalog: ReturnType<typeof createUiCatalog>): ReactTestRenderer => {
  const stateSource: RenderProviderProps['stateSource'] = {
    getStatus: () => runtime.status,
    getState: () => runtime.getState(),
    subscribe: listener => runtime.subscribe(listener),
  }
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(createElement(
      RenderProvider,
      {
        stateSource,
        uiCatalog: catalog,
        rendererCatalog: createRendererCatalog([]),
        logger: logger(),
        nativeLoadingCapability,
        runtimeFacts: {} as RenderProviderProps['runtimeFacts'],
        dispatchCommand: (command, options) => runtime.dispatchCommand(
          command.definition,
          command.payload,
          options,
        ),
        selectUiVariable: (_state, declaration) => declaration.defaultValue,
      },
      createElement(WallpaperPicker),
    ))
  })
  return renderer!
}

describe('sample wallpaper picker production failure boundary', () => {
  it('propagates a real child write-after select failure through the production picker actor', async () => {
    const catalog = createUiCatalog(sampleWallpaperPickerAssembly.parts.filter(part => part.catalogEntry.surfaceForm.includes('mobile')).map(part => part.catalogEntry))
    const uiState = createUiStateModule({catalog, variables: [], surfaceForm: 'mobile'})
    const injectedRuntime = createTestRuntime([
      createDisplayContextModule(),
      uiState,
      createSampleWallpaperModule(),
      failureInjectionModule(),
      createSampleWallpaperPickerModule(),
    ])
    try {
      await injectedRuntime.start()
      const result = await injectedRuntime.dispatchCommand(
        wallpaperOptionSelectedCommand,
        {wallpaperId: 'w2'},
        {requestId: createRequestId()},
      )
      expect(result.status).toBe('error')
      expect(result.actorResults.some(actor => actor.error?.code === 'ERR_TER_SAMPLE_WALLPAPER_PICKER_CHILD_DISPATCH_FAILED')).toBe(true)
      expect(selectWallpaperId(injectedRuntime.getState())).toBe('none')
      expect(selectPendingWallpaperId(injectedRuntime.getState())).toBe('w2')

      const notice = await injectedRuntime.dispatchCommand(
        wallpaperSystemFailureObservedCommand,
        {operation: 'select', phase: 'after-write'},
        {requestId: createRequestId()},
      )
      expect(notice.status).toBe('completed')
      expect(selectLayers(injectedRuntime.getState(), 'PRIMARY')).toEqual([
        expect.objectContaining({
          layerId: 'sample.wallpaper.system-notice',
          partKey: 'sample.wallpaper.system-notice',
          persistence: 'ephemeral',
          props: {operation: 'select', phase: 'after-write'},
        }),
      ])
    } finally {
      releaseRuntimeForTest(injectedRuntime)
    }
  })

  it('propagates a real child write-after confirm failure without rolling back confirmed state', async () => {
    const catalog = createUiCatalog(sampleWallpaperPickerAssembly.parts.filter(part => part.catalogEntry.surfaceForm.includes('mobile')).map(part => part.catalogEntry))
    const uiState = createUiStateModule({catalog, variables: [], surfaceForm: 'mobile'})
    const runtime = createTestRuntime([
      createDisplayContextModule(),
      uiState,
      createSampleWallpaperModule(),
      failureInjectionModule(),
      createSampleWallpaperPickerModule(),
    ])
    try {
      await runtime.start()
      await runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w2'}, {requestId: createRequestId()})
      const result = await runtime.dispatchCommand(
        confirmWallpaperRequestedCommand,
        {},
        {requestId: createRequestId()},
      )
      expect(result.status).toBe('error')
      expect(selectWallpaperId(runtime.getState())).toBe('w2')
      expect(selectPendingWallpaperId(runtime.getState())).toBeUndefined()
    } finally {
      releaseRuntimeForTest(runtime)
    }
  })

  it('closes the real picker UI to child result readback and system notice without a manual notice dispatch', async () => {
    const catalog = createUiCatalog(sampleWallpaperPickerAssembly.parts.filter(part => part.catalogEntry.surfaceForm.includes('mobile')).map(part => part.catalogEntry))
    const uiState = createUiStateModule({catalog, variables: [], surfaceForm: 'mobile'})
    const runtime = createTestRuntime([
      createDisplayContextModule(),
      uiState,
      createSampleWallpaperModule(),
      failureInjectionModule(),
      createSampleWallpaperPickerModule(),
    ])
    let renderer: ReactTestRenderer | undefined
    try {
      await runtime.start()
      renderer = mountPicker(runtime, catalog)

      const option = renderer!.root.findByProps({testID: wallpaperOptionTestId('w2')})
      await act(async () => { await option.props.onSelectedChange() })

      expect(selectWallpaperId(runtime.getState())).toBe('none')
      expect(selectPendingWallpaperId(runtime.getState())).toBe('w2')
      expect(selectLayers(runtime.getState(), 'PRIMARY')).toEqual([
        expect.objectContaining({
          layerId: 'sample.wallpaper.system-notice',
          partKey: 'sample.wallpaper.system-notice',
          persistence: 'ephemeral',
          props: {operation: 'select', phase: 'after-write'},
        }),
      ])
    } finally {
      renderer?.unmount()
      releaseRuntimeForTest(runtime)
    }
  })

  it('closes the real picker UI to a truthful before-write notice from a runtime child failure', async () => {
    const catalog = createUiCatalog(sampleWallpaperPickerAssembly.parts.filter(part => part.catalogEntry.surfaceForm.includes('mobile')).map(part => part.catalogEntry))
    const uiState = createUiStateModule({catalog, variables: [], surfaceForm: 'mobile'})
    const runtime = createTestRuntime([
      createDisplayContextModule(),
      uiState,
      beforeWriteFailureWallpaperModule(),
      createSampleWallpaperPickerModule(),
    ])
    let renderer: ReactTestRenderer | undefined
    try {
      await runtime.start()
      renderer = mountPicker(runtime, catalog)
      const option = renderer.root.findByProps({testID: wallpaperOptionTestId('w2')})
      await act(async () => { await option.props.onSelectedChange() })

      expect(selectWallpaperId(runtime.getState())).toBe('none')
      expect(selectPendingWallpaperId(runtime.getState())).toBeUndefined()
      expect(selectLayers(runtime.getState(), 'PRIMARY')).toEqual([
        expect.objectContaining({
          layerId: 'sample.wallpaper.system-notice',
          props: {operation: 'select', phase: 'before-write'},
        }),
      ])
    } finally {
      renderer?.unmount()
      releaseRuntimeForTest(runtime)
    }
  })
})
