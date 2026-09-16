import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {describe, expect, it} from 'vitest'
import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import {createProcessMemoryStateStoragePort, type LogEvent} from '@catering-v2s/kernel-base-platform-ports'
import {
  loginCommand,
  loginSucceededCommand,
  logoutSucceededCommand,
  sessionRestoredAnonymousCommand,
  sessionRestoredAuthenticatedCommand,
} from '@catering-v2s/kernel-feature-sample-staff-session'
import {
  ADMIN_CONSOLE_LAYER_ID,
  ADMIN_CONSOLE_PART_KEY,
  AdminLauncher,
  adminTestIds,
} from '@catering-v2s/ui-base-admin-shell'
import {
  openLayerCommand,
  selectLayers,
  selectScreen,
  showScreenCommand,
} from '@catering-v2s/kernel-base-ui-state'
import {
  confirmWallpaperCommand,
  selectWallpaperCommand,
  selectPendingWallpaperId,
  selectWallpaperId,
} from '@catering-v2s/kernel-feature-sample-wallpaper'
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing'
import {PrimitiveContainer, PrimitiveImage} from '@catering-v2s/ui-base-primitives'
import {createSurfaceForDisplayIndex, createSampleWallpaperConsoleAssembly as createProductionSampleWallpaperConsoleAssembly} from '../src'
import {wallpaperPickerTestIds} from '@catering-v2s/ui-feature-sample-wallpaper-picker'
import {createTestPlatformPorts, type TestPlatformPorts} from './support'

type TestWallpaperConsoleAssemblyInput = Omit<Parameters<typeof createProductionSampleWallpaperConsoleAssembly>[0], 'platformPorts' | 'nativeLoadingCapability'> & Readonly<{
  readonly platformPorts: TestPlatformPorts
}>

const createSampleWallpaperConsoleAssembly = (input: TestWallpaperConsoleAssemblyInput) => createProductionSampleWallpaperConsoleAssembly({
  ...input,
  nativeLoadingCapability: input.platformPorts.nativeLoadingCapability,
})

const PRIMARY_FRAME = {width: 360, height: 640} as const

const createPrimaryHostSource = () => {
  const snapshot = {
    stableHostLogicalSize: PRIMARY_FRAME,
    isHostPrimaryDisplay: true,
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
  }
}

const mount = (element: Parameters<typeof create>[0]): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(element) })
  return renderer!
}

const measurePrimarySurface = (renderer: ReactTestRenderer): void => {
  const frames = renderer.root.findAllByProps({testID: 'ui.base.input:surface-frame'})
  act(() => {
    for (const frame of frames) {
      ;(frame.props.onLayout as (event: unknown) => void)({
        nativeEvent: {layout: PRIMARY_FRAME},
      })
    }
  })
}

const press = (renderer: ReactTestRenderer, testID: string): (() => unknown) => {
  const instance = renderer.root.findByProps({testID}) as unknown as Readonly<{
    readonly props: Readonly<{readonly onPress: () => unknown}>
  }>
  return instance.props.onPress
}

const authenticateAdmin = async (renderer: ReactTestRenderer): Promise<void> => {
  for (const digit of ['1', '2', '3', '4', '5', '6']) {
    await act(async () => {
      press(renderer, `ui.base.input:virtual-keyboard:text-${digit}`)()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }
  await act(async () => {
    press(renderer, adminTestIds.verify)()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

const dispatchOptions = (displayMode: 'PRIMARY' | 'SECONDARY' = 'PRIMARY') => ({
  requestId: createRequestId(),
  routeContext: {displayMode},
})

describe('sample2 wallpaper console assembly', () => {
  it('uses caller-provided surface declarations for the selected form', async () => {
    const override = {
      orientations: {
        landscape: {
          PRIMARY: {width: 1400, height: 700},
          SECONDARY: {width: 700, height: 400},
        },
        portrait: {
          PRIMARY: {width: 411, height: 731},
        },
      },
    } as const
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample2-surface-override-${Date.now()}`,
      surfaceForm: 'mobile',
      terminalSurfaces: override,
    })
    try {
      expect(assembly.surfaceDeclarations).toEqual(override.orientations.portrait)
    } finally {
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('keeps one logical canvas for laptop dual surfaces and rejects mobile secondary', async () => {
    const laptop = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
      persistenceKey: `sample2-surface-laptop-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    const mobile = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1}),
      persistenceKey: `sample2-surface-mobile-${Date.now()}`,
      surfaceForm: 'mobile',
    })
    let laptopPrimary: ReactTestRenderer | undefined
    let laptopSecondary: ReactTestRenderer | undefined
    let mobilePrimary: ReactTestRenderer | undefined
    try {
      laptopPrimary = mount(createSurfaceForDisplayIndex(laptop, 0))
      laptopSecondary = mount(createSurfaceForDisplayIndex(laptop, 1))
      mobilePrimary = mount(createSurfaceForDisplayIndex(mobile, 0))
      expect(laptopPrimary.root.findByProps({testID: 'ui-base-render:surface-host-canvas'}).props.style)
        .toEqual(expect.arrayContaining([expect.objectContaining({width: 1280, height: 800})]))
      expect(laptopSecondary.root.findByProps({testID: 'ui-base-render:surface-host-canvas'}).props.style)
        .toEqual(expect.arrayContaining([expect.objectContaining({width: 960, height: 540})]))
      expect(mobilePrimary.root.findByProps({testID: 'ui-base-render:surface-host-canvas'}).props.style)
        .toEqual(expect.arrayContaining([expect.objectContaining({width: 360, height: 640})]))
      expect(() => createSurfaceForDisplayIndex(mobile, 1)).toThrow(/unavailable for mobile/)
    } finally {
      if (laptopPrimary !== undefined) act(() => { laptopPrimary!.unmount() })
      if (laptopSecondary !== undefined) act(() => { laptopSecondary!.unmount() })
      if (mobilePrimary !== undefined) act(() => { mobilePrimary!.unmount() })
      releaseRuntimeForTest(laptop.runtime)
      releaseRuntimeForTest(mobile.runtime)
    }
  })

  it('keeps one startup completion across a real-part navigation in one runtime', async () => {
    const events: LogEvent[] = []
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1, events}),
      persistenceKey: `sample2-single-startup-completion-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createPrimaryHostSource()},
    })
    let renderer: ReactTestRenderer | undefined
    const layoutReadyBoundary = () => {
      const boundaries = renderer!.root.findAllByProps({testID: 'ui-base-render:screen-ready-boundary'})
      act(() => {
        for (const boundary of boundaries) {
          ;(boundary.props.onLayout as (event: unknown) => void)({
            nativeEvent: {layout: PRIMARY_FRAME},
          })
        }
      })
    }
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0))
      measurePrimarySurface(renderer)
      layoutReadyBoundary()
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

      await act(async () => {
        const result = await assembly.runtime.dispatchCommand(loginSucceededCommand, {operatorName: 'Alice'}, dispatchOptions())
        expect(result.status).toBe('completed')
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findByProps({testID: wallpaperPickerTestIds.root})).toBeDefined()
      layoutReadyBoundary()
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

      expect(events.filter(event => event.event === 'startup.complete')).toHaveLength(1)
      const complete = events.find(event => event.event === 'startup.complete')
      expect(complete?.data).toHaveProperty('primaryReadyPartKey')
      expect(complete?.data).toHaveProperty('primaryContentFailure')
      expect(events.some(event => event.event === 'startup.ready-failed')).toBe(false)
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('integrates the shared admin console on laptop and mobile primary surfaces', async () => {
    const assemblies = await Promise.all((['laptop', 'mobile'] as const).map(surfaceForm =>
      createSampleWallpaperConsoleAssembly({
        platformPorts: createTestPlatformPorts({displayCount: surfaceForm === 'laptop' ? 2 : 1}),
        persistenceKey: `sample2-admin-integration-${surfaceForm}-${Date.now()}`,
        surfaceForm,
        showAdminPassword: true,
      })))
    const renderers: ReactTestRenderer[] = []
    try {
      for (const assembly of assemblies) {
        await assembly.runtime.dispatchCommand(openLayerCommand, {
          displayMode: 'PRIMARY',
          layerId: ADMIN_CONSOLE_LAYER_ID,
          partKey: ADMIN_CONSOLE_PART_KEY,
        }, dispatchOptions())
        const renderer = mount(createSurfaceForDisplayIndex(assembly, 0))
        renderers.push(renderer)
        measurePrimarySurface(renderer)
        expect(renderer.root.findAllByType(AdminLauncher)).toHaveLength(1)
        expect(renderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()
        expect(renderer.root.findByProps({testID: adminTestIds.debugPassword}).props.children).toMatch(/^（\d{6}）$/)
        await authenticateAdmin(renderer)
        for (const sectionTestID of [
          adminTestIds.sections.platformPorts,
          adminTestIds.sections.runtime,
          adminTestIds.sections.displayContext,
        ]) {
          expect(renderer.root.findByProps({testID: sectionTestID})).toBeDefined()
        }
        expect(selectLayers(assembly.runtime.getState(), 'PRIMARY'))
          .toEqual(expect.arrayContaining([expect.objectContaining({layerId: ADMIN_CONSOLE_LAYER_ID})]))
      }
    } finally {
      for (const renderer of renderers) act(() => { renderer.unmount() })
      for (const assembly of assemblies) releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('routes session placement through one catalog and does not create a secondary on mobile', async () => {
    const events: LogEvent[] = []
    const laptop = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2, events}),
      persistenceKey: `sample2-placement-laptop-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    const mobile = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1, events}),
      persistenceKey: `sample2-placement-mobile-${Date.now()}`,
      surfaceForm: 'mobile',
    })
    try {
      await laptop.runtime.dispatchCommand(sessionRestoredAnonymousCommand, {}, dispatchOptions())
      expect(selectScreen(laptop.runtime.getState(), 'SECONDARY', 'main')?.partKey)
        .toBe('sample.wallpaper-console.waiting')
      await laptop.runtime.dispatchCommand(sessionRestoredAuthenticatedCommand, {operatorName: 'Alice'}, dispatchOptions())
      expect(selectScreen(laptop.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.wallpaper.picker')
      expect(selectScreen(laptop.runtime.getState(), 'SECONDARY', 'main')?.partKey)
        .toBe('sample.wallpaper-console.welcome')
      await laptop.runtime.dispatchCommand(logoutSucceededCommand, {}, dispatchOptions())
      expect(selectScreen(laptop.runtime.getState(), 'SECONDARY', 'main')?.partKey)
        .toBe('sample.wallpaper-console.waiting')

      await mobile.runtime.dispatchCommand(loginSucceededCommand, {operatorName: 'Alice'}, dispatchOptions())
      expect(selectScreen(mobile.runtime.getState(), 'PRIMARY', 'main')?.partKey).toBe('sample.wallpaper.picker')
      expect(selectScreen(mobile.runtime.getState(), 'SECONDARY', 'main')).toBeUndefined()
      expect(events.some(event => event.event === 'sample-wallpaper-console.secondary-placement' && event.data?.secondaryAvailable === false)).toBe(true)
    } finally {
      releaseRuntimeForTest(laptop.runtime)
      releaseRuntimeForTest(mobile.runtime)
    }
  })

  it('prunes a persisted laptop-only secondary container when hydrating the mobile assembly', async () => {
    const plainStorage = createProcessMemoryStateStoragePort()
    const protectedStorage = createProcessMemoryStateStoragePort()
    const events: LogEvent[] = []
    const persistenceKey = `sample2-cross-form-container-${Date.now()}`
    let laptop: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>> | undefined
    let mobile: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>> | undefined
    try {
      laptop = await createSampleWallpaperConsoleAssembly({
        platformPorts: createTestPlatformPorts({
          displayCount: 2,
          events,
          plainStorage,
          protectedStorage,
        }),
        persistenceKey,
        surfaceForm: 'laptop',
      })
      await laptop.runtime.dispatchCommand(sessionRestoredAnonymousCommand, {}, dispatchOptions())
      expect(selectScreen(laptop.runtime.getState(), 'SECONDARY', 'main')?.partKey)
        .toBe('sample.wallpaper-console.waiting')
      await new Promise(resolve => setTimeout(resolve, 350))
      releaseRuntimeForTest(laptop.runtime)
      laptop = undefined

      mobile = await createSampleWallpaperConsoleAssembly({
        platformPorts: createTestPlatformPorts({
          displayCount: 1,
          events,
          plainStorage,
          protectedStorage,
        }),
        persistenceKey,
        surfaceForm: 'mobile',
      })
      expect(selectScreen(mobile.runtime.getState(), 'SECONDARY', 'main')).toBeUndefined()
      expect(events).toEqual(expect.arrayContaining([
        expect.objectContaining({
          event: 'ui-state-hydration.container.not-renderable',
          data: expect.objectContaining({
            displayMode: 'SECONDARY',
            containerKey: 'main',
            partKey: 'sample.wallpaper-console.waiting',
            reason: 'hydrated-container-not-renderable',
          }),
        }),
      ]))
    } finally {
      if (laptop !== undefined) releaseRuntimeForTest(laptop.runtime)
      if (mobile !== undefined) releaseRuntimeForTest(mobile.runtime)
    }
  })

  it('renders the same confirmed wallpaper selector on both laptop surfaces', async () => {
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
      persistenceKey: `sample2-background-laptop-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    let primary: ReactTestRenderer | undefined
    let secondary: ReactTestRenderer | undefined
    try {
      await assembly.runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w2'}, dispatchOptions())
      await assembly.runtime.dispatchCommand(confirmWallpaperCommand, {}, dispatchOptions())
      expect(selectWallpaperId(assembly.runtime.getState())).toBe('w2')
      expect(selectPendingWallpaperId(assembly.runtime.getState())).toBeUndefined()
      primary = mount(createSurfaceForDisplayIndex(assembly, 0))
      secondary = mount(createSurfaceForDisplayIndex(assembly, 1))
      expect(primary.root.findAllByType(PrimitiveImage)).toHaveLength(1)
      expect(secondary.root.findAllByType(PrimitiveImage)).toHaveLength(1)
      expect(primary.root.findByProps({testID: 'sample.wallpaper.background'}).props.source)
        .toBe(secondary.root.findByProps({testID: 'sample.wallpaper.background'}).props.source)
      expect(primary.root.findAllByProps({testID: wallpaperPickerTestIds.root})).toHaveLength(0)

      const firstSource = primary.root.findByProps({testID: 'sample.wallpaper.background'}).props.source
      act(() => {
        primary!.unmount()
        secondary!.unmount()
      })
      primary = undefined
      secondary = undefined

      await assembly.runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w3'}, dispatchOptions())
      await assembly.runtime.dispatchCommand(confirmWallpaperCommand, {}, dispatchOptions())
      primary = mount(createSurfaceForDisplayIndex(assembly, 0))
      secondary = mount(createSurfaceForDisplayIndex(assembly, 1))
      const nextPrimarySource = primary.root.findByProps({testID: 'sample.wallpaper.background'}).props.source
      expect(nextPrimarySource).not.toBe(firstSource)
      expect(nextPrimarySource).toBe(secondary.root.findByProps({testID: 'sample.wallpaper.background'}).props.source)
    } finally {
      if (primary !== undefined) act(() => { primary!.unmount() })
      if (secondary !== undefined) act(() => { secondary!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('keeps picker, waiting, and welcome containers transparent for the wallpaper layer', async () => {
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
      persistenceKey: `sample2-transparent-consumers-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    let waiting: ReactTestRenderer | undefined
    let primary: ReactTestRenderer | undefined
    let secondary: ReactTestRenderer | undefined
    const containerFor = (renderer: ReactTestRenderer, testID: string) => {
      const container = renderer.root.findAllByType(PrimitiveContainer)
        .find(candidate => candidate.props.testID === testID)
      expect(container).toBeDefined()
      return container!
    }
    try {
      await assembly.runtime.dispatchCommand(sessionRestoredAnonymousCommand, {}, dispatchOptions())
      waiting = mount(createSurfaceForDisplayIndex(assembly, 1))
      expect(containerFor(waiting, 'sample.wallpaper-console.waiting').props.layout).toBe('transparent')
      act(() => { waiting!.unmount() })
      waiting = undefined

      await assembly.runtime.dispatchCommand(loginSucceededCommand, {operatorName: 'Alice'}, dispatchOptions())
      primary = mount(createSurfaceForDisplayIndex(assembly, 0))
      secondary = mount(createSurfaceForDisplayIndex(assembly, 1))
      expect(containerFor(primary, wallpaperPickerTestIds.root).props.layout).toBe('transparent')
      expect(containerFor(secondary, 'sample.wallpaper-console.welcome').props.layout).toBe('transparent')
    } finally {
      if (waiting !== undefined) act(() => { waiting!.unmount() })
      if (primary !== undefined) act(() => { primary!.unmount() })
      if (secondary !== undefined) act(() => { secondary!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('keeps picker as the primary interactive content after authenticated placement', async () => {
    const assembly = await createSampleWallpaperConsoleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1}),
      persistenceKey: `sample2-picker-placement-${Date.now()}`,
      surfaceForm: 'mobile',
    })
    let renderer: ReactTestRenderer | undefined
    try {
      await assembly.runtime.dispatchCommand(showScreenCommand, {
        displayMode: 'PRIMARY',
        containerKey: 'main',
        partKey: 'sample.wallpaper.picker',
      }, dispatchOptions())
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0))
      expect(renderer.root.findByProps({testID: wallpaperPickerTestIds.root})).toBeDefined()
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY')).toEqual([])
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('restores confirmed wallpaper, pending choice, business screen, and admin layer after restart', async () => {
    const plainStorage = createProcessMemoryStateStoragePort()
    const protectedStorage = createProcessMemoryStateStoragePort()
    const persistenceKey = 'sample2-cold-restart-state'
    let firstAssembly: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>> | undefined
    let secondAssembly: Awaited<ReturnType<typeof createSampleWallpaperConsoleAssembly>> | undefined
    let renderer: ReactTestRenderer | undefined
    try {
      firstAssembly = await createSampleWallpaperConsoleAssembly({
        platformPorts: createTestPlatformPorts({
          displayCount: 2,
          plainStorage,
          protectedStorage,
        }),
        persistenceKey,
        surfaceForm: 'laptop',
      })
      await firstAssembly.runtime.dispatchCommand(loginCommand, {
        operatorName: 'A001',
        passcode: '1111',
      }, dispatchOptions())
      await firstAssembly.runtime.dispatchCommand(openLayerCommand, {
        displayMode: 'PRIMARY',
        layerId: ADMIN_CONSOLE_LAYER_ID,
        partKey: ADMIN_CONSOLE_PART_KEY,
      }, dispatchOptions())
      await firstAssembly.runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w2'}, dispatchOptions())
      await firstAssembly.runtime.dispatchCommand(confirmWallpaperCommand, {}, dispatchOptions())
      await firstAssembly.runtime.dispatchCommand(selectWallpaperCommand, {wallpaperId: 'w3'}, dispatchOptions())
      const businessPartKey = selectScreen(firstAssembly.runtime.getState(), 'PRIMARY', 'main')?.partKey
      expect(businessPartKey).toBe('sample.wallpaper.picker')
      await new Promise(resolve => setTimeout(resolve, 350))
      releaseRuntimeForTest(firstAssembly.runtime)
      firstAssembly = undefined

      secondAssembly = await createSampleWallpaperConsoleAssembly({
        platformPorts: createTestPlatformPorts({
          displayCount: 2,
          plainStorage,
          protectedStorage,
        }),
        persistenceKey,
        surfaceForm: 'laptop',
      })
      expect(selectWallpaperId(secondAssembly.runtime.getState())).toBe('w2')
      expect(selectPendingWallpaperId(secondAssembly.runtime.getState())).toBe('w3')
      expect(selectScreen(secondAssembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({partKey: businessPartKey})
      expect(selectLayers(secondAssembly.runtime.getState(), 'PRIMARY'))
        .toEqual(expect.arrayContaining([expect.objectContaining({layerId: ADMIN_CONSOLE_LAYER_ID})]))
      renderer = mount(createSurfaceForDisplayIndex(secondAssembly, 0))
      expect(renderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()
      expect(renderer.root.findByProps({testID: wallpaperPickerTestIds.confirm}).props.disabled).toBe(false)
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      if (firstAssembly !== undefined) releaseRuntimeForTest(firstAssembly.runtime)
      if (secondAssembly !== undefined) releaseRuntimeForTest(secondAssembly.runtime)
    }
  })
})
