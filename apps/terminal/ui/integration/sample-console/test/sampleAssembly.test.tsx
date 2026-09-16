import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import type {ReactElement} from 'react'
import {describe, expect, it, vi} from 'vitest'
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native'
import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import {
  createProcessMemoryStateStoragePort,
  type LogEvent,
  type StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports'
import {switchDisplayRoleCommand, switchInstanceModeCommand} from '@catering-v2s/kernel-base-display-context'
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing'
import {
  openLayerCommand,
  selectLayers,
  selectScreen,
  showScreenCommand,
} from '@catering-v2s/kernel-base-ui-state'
import {createUiCatalog, selectAvailableParts} from '@catering-v2s/kernel-base-ui-state'
import {
  confirmMemberCommand,
  rejectMemberCommand,
  selectMembers,
  selectPendingMember,
  submitMemberCommand,
} from '@catering-v2s/kernel-feature-sample-member-registry'
import {
  memberRegistrationAbandonedCommand,
  memberRegistrationRetryRequestedCommand,
  memberSubmissionWithdrawnCommand,
} from '../../../../ui/feature/sample-member-desk/src/features/commands/commands'
import {createSampleAssembly as createProductionSampleAssembly, createSurfaceForDisplayIndex} from '../src'
import {createSampleDefinedParts} from '../src/assembly/assembly'
import {adminTestIds} from '@catering-v2s/ui-base-admin-shell'
import {createTestPlatformPorts, type TestPlatformPorts} from './support'

type TestSampleAssemblyInput = Omit<Parameters<typeof createProductionSampleAssembly>[0], 'platformPorts' | 'nativeLoadingCapability'> & Readonly<{
  readonly platformPorts: TestPlatformPorts
}>

const createSampleAssembly = (input: TestSampleAssemblyInput) => createProductionSampleAssembly({
  ...input,
  nativeLoadingCapability: input.platformPorts.nativeLoadingCapability,
})

const LANDSCAPE_PRIMARY_FRAME = {width: 1280, height: 800} as const
const LANDSCAPE_SECONDARY_FRAME = {width: 960, height: 540} as const
const PORTRAIT_PRIMARY_FRAME = {width: 360, height: 640} as const
const LAUNCHER_WINDOW_ORIGIN = {x: 100, y: 200} as const

type HostMeasurementSnapshot = Readonly<{
  readonly stableHostLogicalSize: Readonly<{readonly width: number; readonly height: number}>
  readonly isHostPrimaryDisplay: boolean
}>

type HostSourceHandle = Readonly<{
  readonly getSnapshot: () => HostMeasurementSnapshot
  readonly subscribe: (listener: (snapshot: HostMeasurementSnapshot) => void) => () => void
  readonly emit: (snapshot: HostMeasurementSnapshot) => void
}>

const createHostSource = (
  isHostPrimaryDisplay: boolean,
  stableHostLogicalSize: Readonly<{readonly width: number; readonly height: number}> = LANDSCAPE_PRIMARY_FRAME,
): HostSourceHandle => {
  let currentSnapshot: HostMeasurementSnapshot = Object.freeze({
    stableHostLogicalSize: Object.freeze({
      width: stableHostLogicalSize.width,
      height: stableHostLogicalSize.height,
    }),
    isHostPrimaryDisplay,
  })
  const listeners = new Set<(snapshot: HostMeasurementSnapshot) => void>()
  return Object.freeze({
    getSnapshot: () => currentSnapshot,
    subscribe: (listener: (snapshot: HostMeasurementSnapshot) => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    emit: (snapshot: HostMeasurementSnapshot) => {
      currentSnapshot = Object.freeze({
        stableHostLogicalSize: Object.freeze({
          width: snapshot.stableHostLogicalSize.width,
          height: snapshot.stableHostLogicalSize.height,
        }),
        isHostPrimaryDisplay: snapshot.isHostPrimaryDisplay,
      })
      for (const listener of listeners) listener(currentSnapshot)
    },
  })
}

const createRecordingStorage = () => {
  const delegate = createProcessMemoryStateStoragePort()
  const writes: string[] = []
  const storage: StateStoragePort = {
    ...delegate,
    write: async input => {
      writes.push(input.value)
      return delegate.write(input)
    },
    writeMany: async input => {
      writes.push(...input.entries.map(entry => entry.value))
      return delegate.writeMany(input)
    },
  }
  return Object.freeze({storage, writes})
}

const mount = (
  element: Parameters<typeof create>[0],
  frameLayout: Readonly<{readonly width: number; readonly height: number}> = LANDSCAPE_SECONDARY_FRAME,
  measureSurface = true,
  launcherMeasuredSize: Readonly<{readonly width: number; readonly height: number}> = {width: 0, height: 0},
): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = (create as unknown as (
      element: Parameters<typeof create>[0],
      options?: Readonly<{readonly createNodeMock: (element: ReactElement) => unknown}>,
    ) => ReactTestRenderer)(element, {
      createNodeMock: (node: ReactElement) => {
        const testID = (node.props as Readonly<{readonly testID?: unknown}>).testID
        if (testID !== adminTestIds.launcher) return undefined
        return {
          measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => {
            callback(
              LAUNCHER_WINDOW_ORIGIN.x,
              LAUNCHER_WINDOW_ORIGIN.y,
              launcherMeasuredSize.width,
              launcherMeasuredSize.height,
            )
          },
        }
      },
    })
  })
  const frames = renderer!.root.findAllByProps({testID: 'ui.base.input:surface-frame'})
  if (measureSurface) {
    act(() => {
      for (const frame of frames) {
        ;(frame.props.onLayout as (event: unknown) => void)({nativeEvent: {layout: frameLayout}})
      }
    })
  }
  const launchers = renderer!.root.findAllByProps({testID: adminTestIds.launcher})
  act(() => {
    for (const launcher of launchers) {
      ;(launcher.props.onLayout as (event: unknown) => void)({
        nativeEvent: {layout: {x: 0, y: 0, width: frameLayout.width, height: frameLayout.height}},
      })
    }
  })
  return renderer!
}

const press = (renderer: ReactTestRenderer, testID: string): (() => unknown) => {
  const instance = renderer.root.findByProps({testID}) as unknown as Readonly<{
    readonly props: Readonly<{readonly onPress: () => unknown}>
  }>
  return instance.props.onPress
}

const pressLauncher = (
  renderer: ReactTestRenderer,
  logicalX = 1,
  logicalY = 1,
  stopPropagation?: () => void,
): void => {
  const launcher = renderer.root.findByProps({testID: adminTestIds.launcher}) as unknown as Readonly<{
    readonly props: Readonly<{
      readonly onTouchEnd: (event: Readonly<{
        readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>
        readonly stopPropagation?: () => void
      }>) => void
    }>
  }>
  const canvas = renderer.root.findByProps({testID: 'ui-base-render:surface-host-canvas'}) as unknown as Readonly<{
    readonly props: Readonly<{readonly style: unknown}>
  }>
  const transform = (StyleSheet.flatten(canvas.props.style) as Readonly<{
    readonly transform?: readonly Readonly<Record<string, number>>[]
  }>).transform ?? []
  const scaleX = transform.find(item => item.scaleX !== undefined)?.scaleX ?? 1
  const scaleY = transform.find(item => item.scaleY !== undefined)?.scaleY ?? 1
  const pageX = LAUNCHER_WINDOW_ORIGIN.x + logicalX * scaleX
  const pageY = LAUNCHER_WINDOW_ORIGIN.y + logicalY * scaleY
  if (!Number.isFinite(pageX) || !Number.isFinite(pageY)) throw new Error('Unable to construct launcher test point')
  launcher.props.onTouchEnd({nativeEvent: {
    pageX,
    pageY,
  }, stopPropagation})
}

const tapLauncher = async (
  renderer: ReactTestRenderer,
  count = 5,
  logicalX = 1,
  logicalY = 1,
): Promise<void> => {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      pressLauncher(renderer, logicalX, logicalY)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }
}

const tapWebLauncher = async (renderer: ReactTestRenderer, count = 5): Promise<void> => {
  const launcher = renderer.root.findByProps({testID: adminTestIds.launcher}) as unknown as Readonly<{
    readonly props: Readonly<{
      readonly onClick?: (event: unknown) => unknown
      readonly onTouchEnd?: (event: unknown) => unknown
    }>
  }>
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      const webEvent = {nativeEvent: {
        clientX: LAUNCHER_WINDOW_ORIGIN.x + 1,
        clientY: LAUNCHER_WINDOW_ORIGIN.y + 1,
      }}
      // Model the two browser event notifications that a single physical tap
      // could produce. The production Web branch must bind only one of them.
      launcher.props.onTouchEnd?.({nativeEvent: {
        pageX: LAUNCHER_WINDOW_ORIGIN.x + 1,
        pageY: LAUNCHER_WINDOW_ORIGIN.y + 1,
      }})
      launcher.props.onClick?.(webEvent)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }
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

type TextInputTestInstance = Readonly<{
  readonly props: Readonly<{
    readonly testID?: unknown
    readonly value?: unknown
    readonly onFocus: (event: Readonly<{readonly nativeEvent: Readonly<Record<string, never>>}>) => void
    readonly onChangeText?: (value: string) => void
  }>
}>

const findTextInput = (renderer: ReactTestRenderer, testID: string): TextInputTestInstance => {
  const root = renderer.root as unknown as Readonly<{
    readonly findAllByType: (type: unknown) => readonly TextInputTestInstance[]
  }>
  const input = root.findAllByType(TextInput).find(node => node.props.testID === testID)
  if (input === undefined) throw new Error(`Missing TextInput ${testID}`)
  return input
}

describe('sample-console real assembly', () => {
  it('waits for PRIMARY surface measurement when resolved layout arrives first', async () => {
    const events: LogEvent[] = []
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({events}),
      persistenceKey: `sample-console-ready-measurement-order-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME, false)
      const boundary = renderer.root.findByProps({testID: 'ui-base-render:screen-ready-boundary'})
      await act(async () => {
        ;(boundary.props.onLayout as (event: unknown) => void)({
          nativeEvent: {layout: PORTRAIT_PRIMARY_FRAME},
        })
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(events.filter(event => event.event === 'startup.complete')).toHaveLength(0)
      expect(events.some(event => event.event === 'startup.ready-failed')).toBe(false)

      const frame = renderer.root.findByProps({testID: 'ui.base.input:surface-frame'})
      act(() => {
        ;(frame.props.onLayout as (event: unknown) => void)({
          nativeEvent: {layout: PORTRAIT_PRIMARY_FRAME},
        })
      })
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(events.filter(event => event.event === 'startup.complete')).toHaveLength(1)
      expect(events.some(event => event.event === 'startup.ready-failed')).toBe(false)
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('opens admin console from the transformed mobile preview hit area', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-mobile-launcher-preview-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(
        createSurfaceForDisplayIndex(assembly, 0),
        PORTRAIT_PRIMARY_FRAME,
        true,
        {
          width: PORTRAIT_PRIMARY_FRAME.width * 3,
          height: PORTRAIT_PRIMARY_FRAME.height * 3,
        },
      )
      await tapLauncher(renderer, 5, 120, 120)
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY'))
        .toEqual(expect.arrayContaining([expect.objectContaining({layerId: 'admin.console.layer'})]))
      expect(renderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

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
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-surface-override-${Date.now()}`,
      surfaceForm: 'laptop',
      terminalSurfaces: override,
    })
    try {
      expect(assembly.surfaceDeclarations).toEqual(override.orientations.landscape)
    } finally {
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('does not reuse a platform-port run id for separate console writers', async () => {
    const firstEvents: LogEvent[] = []
    const secondEvents: LogEvent[] = []
    const sharedPlatformRunId = 'platform-port-run-id-shared-by-two-clients'
    const firstAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({
        events: firstEvents,
        startupRunId: sharedPlatformRunId,
        stripPortDescriptors: true,
      }),
      persistenceKey: `sample-console-writer-run-id-first-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    })
    const secondAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({
        events: secondEvents,
        startupRunId: sharedPlatformRunId,
        stripPortDescriptors: true,
      }),
      persistenceKey: `sample-console-writer-run-id-second-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    })
    let firstRenderer: ReactTestRenderer | undefined
    let secondRenderer: ReactTestRenderer | undefined
    try {
      firstRenderer = mount(createSurfaceForDisplayIndex(firstAssembly, 0), PORTRAIT_PRIMARY_FRAME)
      secondRenderer = mount(createSurfaceForDisplayIndex(secondAssembly, 0), PORTRAIT_PRIMARY_FRAME)
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
      for (const renderer of [firstRenderer, secondRenderer]) {
        const boundaries = renderer.root.findAllByProps({testID: 'ui-base-render:screen-ready-boundary'})
        act(() => {
          for (const boundary of boundaries) {
            ;(boundary.props.onLayout as (event: unknown) => void)({
              nativeEvent: {layout: {width: PORTRAIT_PRIMARY_FRAME.width, height: PORTRAIT_PRIMARY_FRAME.height}},
            })
          }
        })
      }
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
      const readStartupRunId = (events: readonly LogEvent[]): string => {
        const complete = events.find(event => event.event === 'startup.complete')
        const startupRunId = complete?.data?.startupRunId
        if (typeof startupRunId !== 'string') throw new Error('missing startup.complete run id')
        expect(complete?.data).toHaveProperty('primaryReadyPartKey')
        expect(complete?.data).toHaveProperty('primaryContentFailure')
        return startupRunId
      }
      const firstRunId = readStartupRunId(firstEvents)
      const secondRunId = readStartupRunId(secondEvents)
      expect(firstRunId).not.toBe(sharedPlatformRunId)
      expect(secondRunId).not.toBe(sharedPlatformRunId)
      expect(secondRunId).not.toBe(firstRunId)
    } finally {
      if (firstRenderer !== undefined) act(() => { firstRenderer!.unmount() })
      if (secondRenderer !== undefined) act(() => { secondRenderer!.unmount() })
      releaseRuntimeForTest(firstAssembly.runtime)
      releaseRuntimeForTest(secondAssembly.runtime)
    }
  })

  it('non-production catalog unit exposes the injected sample section', () => {
    const context = {
      displayMode: 'PRIMARY' as const,
      workspace: 'MAIN' as const,
      instanceMode: 'MASTER' as const,
      surfaceForm: 'laptop' as const,
    }
    const mobileContext = {...context, surfaceForm: 'mobile' as const}
    const withSample = createUiCatalog(createSampleDefinedParts().map(({catalogEntry}) => catalogEntry))
    const withoutSample = createUiCatalog(createSampleDefinedParts(false).map(({catalogEntry}) => catalogEntry))
    expect(selectAvailableParts(withSample, 'admin.sections', context).map(entry => entry.partKey)).toContain('sample.console.admin-test')
    expect(selectAvailableParts(withSample, 'admin.sections', mobileContext).map(entry => entry.partKey)).toContain('sample.console.admin-test')
    expect(selectAvailableParts(withoutSample, 'admin.sections', context).map(entry => entry.partKey)).not.toContain('sample.console.admin-test')
    expect(selectAvailableParts(withoutSample, 'admin.sections', mobileContext).map(entry => entry.partKey)).not.toContain('sample.console.admin-test')
  })

  it('keeps the production admin test section available in both laptop and mobile', async () => {
    const laptopAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-laptop-filter-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, LANDSCAPE_PRIMARY_FRAME)},
    })
    const mobileAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-mobile-filter-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    })
    let laptopRenderer: ReactTestRenderer | undefined
    let mobileRenderer: ReactTestRenderer | undefined
    try {
      laptopRenderer = mount(createSurfaceForDisplayIndex(laptopAssembly, 0), LANDSCAPE_PRIMARY_FRAME)
      await tapLauncher(laptopRenderer)
      await authenticateAdmin(laptopRenderer)
      for (const sectionTestID of [
        adminTestIds.sections.platformPorts,
        adminTestIds.sections.runtime,
        adminTestIds.sections.displayContext,
        adminTestIds.sections.sampleConsole,
      ]) {
        expect(laptopRenderer.root.findByProps({testID: sectionTestID})).toBeDefined()
      }
      const laptopShell = laptopRenderer.root.findByProps({testID: adminTestIds.shell})
      const laptopShellStyle = StyleSheet.flatten(laptopShell.props.style)
      expect(laptopShellStyle).toMatchObject({flex: 1, width: '100%'})
      expect(laptopShellStyle).not.toHaveProperty('maxWidth')
      expect(StyleSheet.flatten(laptopRenderer.root.findByProps({testID: 'terminal.admin:workspace'}).props.style)).toMatchObject({
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'nowrap',
        minHeight: 0,
      })
      expect(StyleSheet.flatten(laptopRenderer.root.findByProps({testID: 'terminal.admin:navigation'}).props.style)).toMatchObject({
        flexDirection: 'column',
        flexWrap: 'nowrap',
      })
      const laptopSectionButton = laptopRenderer.root.findAllByProps({testID: adminTestIds.sections.runtime})
        .find(node => node.type === Pressable)!
      expect(laptopSectionButton.props.accessibilityRole).toBe('button')
      expect(laptopSectionButton.props.accessibilityLabel).toBe('选择运行状态')
      expect(laptopSectionButton.props.accessibilityState).toMatchObject({selected: false})
      await act(async () => {
        press(laptopRenderer!, adminTestIds.sections.runtime)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      const laptopSelectedSectionButton = laptopRenderer.root.findAllByProps({testID: adminTestIds.sections.runtime})
        .find(node => node.type === Pressable)!
      expect(laptopSelectedSectionButton.props.accessibilityState).toMatchObject({selected: true})
      await act(async () => {
        press(laptopRenderer!, adminTestIds.sections.platformPorts)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(StyleSheet.flatten(laptopRenderer.root.findByProps({testID: adminTestIds.content}).props.style)).toMatchObject({
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      })
      expect(StyleSheet.flatten(laptopRenderer.root.findByProps({testID: 'admin.console.platform-ports'}).props.style)).toMatchObject({
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      })
      const laptopSectionHeading = laptopRenderer.root.findAllByProps({testID: 'admin.console.platform-ports:title'})
        .find(node => node.type === Text)!
      expect(laptopSectionHeading.props).toMatchObject({
        accessibilityRole: 'header',
        accessibilityLiveRegion: 'polite',
      })

      mobileRenderer = mount(createSurfaceForDisplayIndex(mobileAssembly, 0), PORTRAIT_PRIMARY_FRAME)
      await tapLauncher(mobileRenderer)
      await authenticateAdmin(mobileRenderer)
      for (const sectionTestID of [
        adminTestIds.sections.platformPorts,
        adminTestIds.sections.runtime,
        adminTestIds.sections.displayContext,
        adminTestIds.sections.sampleConsole,
      ]) {
        expect(mobileRenderer.root.findByProps({testID: sectionTestID})).toBeDefined()
      }
      const mobileShell = mobileRenderer.root.findByProps({testID: adminTestIds.shell})
      const mobileShellStyle = StyleSheet.flatten(mobileShell.props.style)
      expect(mobileShellStyle).toMatchObject({flex: 1, width: '100%'})
      expect(mobileShellStyle).not.toHaveProperty('maxWidth')
      expect(StyleSheet.flatten(mobileRenderer.root.findByProps({testID: 'terminal.admin:navigation'}).props.style)).toMatchObject({
        flexWrap: 'wrap',
      })
      const mobileNavigation = mobileRenderer.root.findByProps({testID: 'terminal.admin:navigation'})
      expect(mobileNavigation.props.accessibilityRole).toBe('tablist')
      const mobileSectionTab = mobileRenderer.root.findAllByProps({testID: adminTestIds.sections.runtime})
        .find(node => node.type === Pressable)!
      expect(mobileSectionTab.props.accessibilityRole).toBe('tab')
      expect(mobileSectionTab.props.accessibilityLabel).toBe('选择运行状态')
      expect(mobileSectionTab.props.accessibilityState).toMatchObject({selected: false})
      await act(async () => {
        press(mobileRenderer!, adminTestIds.sections.runtime)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      const mobileSelectedSectionTab = mobileRenderer.root.findAllByProps({testID: adminTestIds.sections.runtime})
        .find(node => node.type === Pressable)!
      expect(mobileSelectedSectionTab.props.accessibilityState).toMatchObject({selected: true})
      await act(async () => {
        press(mobileRenderer!, adminTestIds.sections.platformPorts)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(mobileRenderer.root.findByProps({testID: adminTestIds.content})).toBeDefined()
      expect(StyleSheet.flatten(mobileRenderer.root.findByProps({testID: 'admin.console.platform-ports'}).props.style)).toMatchObject({
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      })
      const mobileSectionHeading = mobileRenderer.root.findAllByProps({testID: 'admin.console.platform-ports:title'})
        .find(node => node.type === Text)!
      expect(mobileSectionHeading.props).toMatchObject({
        accessibilityRole: 'header',
        accessibilityLiveRegion: 'polite',
      })
    } finally {
      if (laptopRenderer !== undefined) act(() => { laptopRenderer!.unmount() })
      if (mobileRenderer !== undefined) act(() => { mobileRenderer!.unmount() })
      releaseRuntimeForTest(laptopAssembly.runtime)
      releaseRuntimeForTest(mobileAssembly.runtime)
    }
  })

  it('observes business controls without consuming their touch and maps scaled window points to logical space', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-gesture-ancestor-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, LANDSCAPE_PRIMARY_FRAME)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      const launcher = renderer.root.findByProps({testID: adminTestIds.launcher}) as unknown as Readonly<{
        readonly type: unknown
        readonly props: Readonly<Record<string, unknown>>
        readonly findByProps: (props: Readonly<Record<string, unknown>>) => unknown
      }>
      expect(launcher.type).toBe(View)
      expect(launcher.props.onPress).toBeUndefined()
      expect(launcher.props.onStartShouldSetResponder).toBeUndefined()
      expect(launcher.props.onResponderGrant).toBeUndefined()
      const surfaceContent = renderer.root.findByProps({testID: 'ui.base.input:surface-content'}) as unknown as Readonly<{
        readonly type: unknown
        readonly props: Readonly<Record<string, unknown>>
      }>
      expect(surfaceContent.type).toBe(View)
      expect(surfaceContent.props.onStartShouldSetResponder).toBeUndefined()
      expect(surfaceContent.props.onStartShouldSetResponderCapture).toBeUndefined()
      expect(surfaceContent.props.onResponderRelease).toBeUndefined()
      expect(surfaceContent.props.onTouchEnd).toBeDefined()
      expect(launcher.findByProps({testID: 'sample.auth.login:submit'})).toBeDefined()

      act(() => {
        findTextInput(renderer!, 'sample.auth.login:operator-name').props.onChangeText?.('invalid-operator')
        findTextInput(renderer!, 'sample.auth.login:passcode').props.onChangeText?.('invalid-passcode')
      })
      await act(async () => {
        await press(renderer!, 'sample.auth.login:submit')()
        await new Promise(resolve => setTimeout(resolve, 20))
      })
      expect(renderer.root.findByProps({testID: 'sample.auth.notice'})).toBeDefined()
      expect(renderer.root.findAllByProps({testID: adminTestIds.login})).toHaveLength(0)

      await act(async () => {
        await press(renderer!, 'sample.auth.notice:dismiss')()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      await tapLauncher(renderer, 5, 95, 95)
      expect(renderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('uses logical rather than raw window coordinates for the production launcher gate', async () => {
    const enlargedAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-gesture-enlarged-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, {width: 2560, height: 1200})},
    })
    const reducedAssembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-gesture-reduced-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, {width: 640, height: 400})},
    })
    let enlargedRenderer: ReactTestRenderer | undefined
    let reducedRenderer: ReactTestRenderer | undefined
    try {
      enlargedRenderer = mount(createSurfaceForDisplayIndex(enlargedAssembly, 0), {width: 2560, height: 1200})
      await tapLauncher(enlargedRenderer, 5, 95, 100)
      expect(enlargedRenderer.root.findAllByProps({testID: adminTestIds.login})).toHaveLength(0)
      await tapLauncher(enlargedRenderer, 5, 95, 95)
      expect(enlargedRenderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()

      reducedRenderer = mount(createSurfaceForDisplayIndex(reducedAssembly, 0), {width: 640, height: 400})
      await tapLauncher(reducedRenderer, 5, 100, 100)
      expect(reducedRenderer.root.findAllByProps({testID: adminTestIds.login})).toHaveLength(0)
    } finally {
      if (enlargedRenderer !== undefined) act(() => { enlargedRenderer!.unmount() })
      if (reducedRenderer !== undefined) act(() => { reducedRenderer!.unmount() })
      releaseRuntimeForTest(enlargedAssembly.runtime)
      releaseRuntimeForTest(reducedAssembly.runtime)
    }
  })

  it('opens admin through the real gesture/keypad controls and close/reopen returns to login', async () => {
    const hostSource = createHostSource(true, PORTRAIT_PRIMARY_FRAME)
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-controls-test-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: hostSource},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME)
      const stopPropagation = vi.fn()
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!, 1, 1, stopPropagation)
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      expect(renderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()
      const loginCard = renderer.root.findByProps({testID: `${adminTestIds.login}:card`})
      expect(renderer.root.findAllByProps({testID: 'ui.base.input:surface-frame'})).toHaveLength(1)
      expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(1)
      expect(StyleSheet.flatten(loginCard.props.style)).toMatchObject({
        transform: [{translateY: -110}],
      })
      expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'})).toBeDefined()
      expect(stopPropagation).toHaveBeenCalledTimes(1)
      for (const digit of ['1', '2', '3', '4', '5', '6']) {
        await act(async () => {
          press(renderer!, `ui.base.input:virtual-keyboard:text-${digit}`)()
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      await act(async () => {
        press(renderer!, adminTestIds.verify)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findByProps({testID: adminTestIds.shell})).toBeDefined()
      expect(renderer.root.findByProps({testID: adminTestIds.sections.sampleConsole})).toBeDefined()
      await act(async () => {
        press(renderer!, adminTestIds.sections.runtime)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findByProps({testID: 'admin.console.runtime'})).toBeDefined()
      expect(renderer.root.findAllByProps({testID: 'sample.console.admin-test'})).toHaveLength(0)
      await act(async () => {
        hostSource.emit({
          stableHostLogicalSize: {width: 1000, height: 700},
          isHostPrimaryDisplay: true,
        })
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findByProps({testID: adminTestIds.shell})).toBeDefined()
      expect(renderer.root.findByProps({testID: 'admin.console.runtime'})).toBeDefined()
      await act(async () => {
        press(renderer!, adminTestIds.close)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findAllByProps({testID: adminTestIds.shell})).toHaveLength(0)
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!)
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      expect(renderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('binds only the Web click event and opens through browser-shaped coordinates', async () => {
    const globalWithDocument = globalThis as {document?: unknown}
    const previousDocument = globalWithDocument.document
    Object.defineProperty(globalWithDocument, 'document', {configurable: true, value: {}})
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-web-launcher-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      const launcher = renderer.root.findByProps({testID: adminTestIds.launcher}) as unknown as Readonly<{
        readonly props: Readonly<{readonly onClick?: unknown; readonly onTouchEnd?: unknown}>
      }>
      expect(typeof launcher.props.onClick).toBe('function')
      expect(launcher.props.onTouchEnd).toBeUndefined()
      await tapWebLauncher(renderer, 3)
      expect(renderer.root.findAllByProps({testID: adminTestIds.login})).toHaveLength(0)
      await tapWebLauncher(renderer, 2)
      expect(renderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
      if (previousDocument === undefined) delete globalWithDocument.document
      else Object.defineProperty(globalWithDocument, 'document', {configurable: true, value: previousDocument})
    }
  })

  it('keeps admin keyboard ownership while business input remains underneath and restores it on close', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-focus-scope-test-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      await assembly.runtime.dispatchCommand(showScreenCommand, {
        displayMode: 'PRIMARY',
        containerKey: 'main',
        partKey: 'sample.desk.member-form',
      }, {
        requestId: createRequestId(),
        routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
      })
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)

      const businessInput = findTextInput(renderer, 'sample.desk.member-form:phone')
      act(() => { businessInput.props.onFocus({nativeEvent: {}}) })
      await act(async () => {
        press(renderer!, 'ui.base.input:virtual-keyboard:text-3')()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(findTextInput(renderer, 'sample.desk.member-form:phone').props.value).toBe('3')

      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!)
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      expect(renderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()

      const businessInputUnderAdmin = findTextInput(renderer, 'sample.desk.member-form:phone')
      act(() => { businessInputUnderAdmin.props.onFocus({nativeEvent: {}}) })
      await act(async () => {
        press(renderer!, 'ui.base.input:virtual-keyboard:text-1')()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findByProps({testID: `${adminTestIds.password}:digit:0`}).props.children).toBe('•')
      expect(findTextInput(renderer, 'sample.desk.member-form:phone').props.value).toBe('3')

      await act(async () => {
        press(renderer!, adminTestIds.close)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findAllByProps({testID: adminTestIds.login})).toHaveLength(0)
      const restoredBusinessInput = findTextInput(renderer, 'sample.desk.member-form:phone')
      act(() => { restoredBusinessInput.props.onFocus({nativeEvent: {}}) })
      await act(async () => {
        press(renderer!, 'ui.base.input:virtual-keyboard:text-4')()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(findTextInput(renderer, 'sample.desk.member-form:phone').props.value).toBe('34')
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('shows the current admin password beside the instruction when the package flag is enabled', async () => {
    const events: never[] = []
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({events}),
      persistenceKey: `sample-console-admin-debug-password-test-${Date.now()}`,
      surfaceForm: 'laptop',
      startupDebugMode: false,
      showAdminPassword: true,
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!)
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      const debugPassword = renderer.root.findByProps({testID: adminTestIds.debugPassword})
      expect(debugPassword.props.children).toBe('（123456）')
      expect(renderer.root.findByProps({testID: 'terminal.admin:login:instruction'})).toBeDefined()
      expect(events.some(event => String((event as {readonly event?: unknown}).event) === 'sample.runtime-facts-resolved')).toBe(true)
      expect(events.some(event => JSON.stringify(event).includes('123456'))).toBe(false)
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('hides the current admin password when the package flag is disabled', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-password-hidden-test-${Date.now()}`,
      surfaceForm: 'laptop',
      startupDebugMode: true,
      showAdminPassword: false,
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!)
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      expect(renderer.root.findAllByProps({testID: adminTestIds.debugPassword})).toHaveLength(0)
      expect(renderer.root.findByProps({testID: 'terminal.admin:login:instruction'}).props.children)
        .toEqual(['请输入六位动态口令', null])
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('does not expose the admin launcher on a physical non-host surface', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-secondary-test-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {1: createHostSource(false)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 1))
      expect(renderer.root.findAllByProps({testID: adminTestIds.launcher})).toHaveLength(0)
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('emits an observable rejection when the primary surface receives a non-host measurement', async () => {
    const events: LogEvent[] = []
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({events}),
      persistenceKey: `sample-console-admin-host-rejection-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(false, LANDSCAPE_PRIMARY_FRAME)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      expect(renderer.root.findByProps({testID: 'ui-base-render:surface-host-pending'})).toBeDefined()
      expect(renderer.root.findAllByProps({testID: adminTestIds.launcher})).toHaveLength(0)
      const rejection = events.find(event => event.event === 'surface.host-identity-rejected')
      expect(rejection).toMatchObject({
        category: 'display-diagnostics',
        event: 'surface.host-identity-rejected',
        data: {
          reason: 'physical-host-flag-mismatch',
          displayIndex: 0,
          expectedIsHostPrimaryDisplay: true,
          actualIsHostPrimaryDisplay: false,
        },
      })
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('keeps a business command alive while the admin layer opens over the business surface', async () => {
    let releaseDisplayInfo: () => void = () => undefined
    const displayInfoGate = new Promise<void>(resolve => { releaseDisplayInfo = resolve })
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2, displayInfoGate, displayInfoGateAfterCalls: 1}),
      persistenceKey: `sample-console-admin-in-flight-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, LANDSCAPE_PRIMARY_FRAME)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      let businessSettled = false
      const businessPromise = assembly.runtime.dispatchCommand(submitMemberCommand, {
        name: 'Alice',
        phone: '010-1234-5678',
      }, {requestId: createRequestId()}).then(result => {
        businessSettled = true
        return result
      })
      await Promise.resolve()
      expect(businessSettled).toBe(false)

      await tapLauncher(renderer)
      expect(renderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()

      releaseDisplayInfo()
      const result = await businessPromise
      expect(result.status).toBe('completed')
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.member-list',
      })
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY').map(layer => layer.layerId)).toEqual(expect.arrayContaining([
        'sample.desk.waiting-confirm',
        'admin.console.layer',
      ]))
    } finally {
      releaseDisplayInfo()
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('persists the admin layer while keeping section selection ephemeral', async () => {
    const plainStorage = createRecordingStorage()
    const protectedStorage = createRecordingStorage()
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({
        plainStorage: plainStorage.storage,
        protectedStorage: protectedStorage.storage,
      }),
      persistenceKey: `sample-console-admin-persistence-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME)
      await tapLauncher(renderer)
      await authenticateAdmin(renderer)
      await act(async () => {
        await press(renderer!, adminTestIds.sections.sampleConsole)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findByProps({testID: 'sample.console.admin-test'})).toBeDefined()
      await new Promise(resolve => setTimeout(resolve, 350))
      const persistedValues = [...plainStorage.writes, ...protectedStorage.writes]
      expect(persistedValues.length).toBeGreaterThan(0)
      expect(persistedValues.join('\n')).toContain('admin.console.layer')
      expect(persistedValues.join('\n')).not.toContain('sample.console.admin-test')
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('restores the real admin layer and business screen across a cold runtime restart', async () => {
    const plainStorage = createRecordingStorage()
    const protectedStorage = createRecordingStorage()
    const persistenceKey = 'sample-console-admin-cold-restart'
    const hostSource = createHostSource(true, PORTRAIT_PRIMARY_FRAME)
    let firstAssembly: Awaited<ReturnType<typeof createSampleAssembly>> | undefined
    let secondAssembly: Awaited<ReturnType<typeof createSampleAssembly>> | undefined
    let firstRenderer: ReactTestRenderer | undefined
    let secondRenderer: ReactTestRenderer | undefined
    try {
      firstAssembly = await createSampleAssembly({
        platformPorts: createTestPlatformPorts({
          plainStorage: plainStorage.storage,
          protectedStorage: protectedStorage.storage,
        }),
        persistenceKey,
        surfaceForm: 'mobile',
        surfaceHostSourcesByDisplayIndex: {0: hostSource},
      })
      firstRenderer = mount(createSurfaceForDisplayIndex(firstAssembly, 0), PORTRAIT_PRIMARY_FRAME)
      await tapLauncher(firstRenderer)
      await authenticateAdmin(firstRenderer)
      await act(async () => {
        press(firstRenderer!, adminTestIds.sections.sampleConsole)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(firstRenderer.root.findByProps({testID: 'sample.console.admin-test'})).toBeDefined()
      const businessBefore = selectScreen(firstAssembly.runtime.getState(), 'PRIMARY', 'main')
      expect(businessBefore).toBeDefined()
      const businessPartKey = businessBefore!.partKey
      await new Promise(resolve => setTimeout(resolve, 350))
      releaseRuntimeForTest(firstAssembly.runtime)
      firstAssembly = undefined
      // Do not unmount the first renderer before hydration: a killed process
      // does not run the layer component's close effect.

      secondAssembly = await createSampleAssembly({
        platformPorts: createTestPlatformPorts({
          plainStorage: plainStorage.storage,
          protectedStorage: protectedStorage.storage,
        }),
        persistenceKey,
        surfaceForm: 'mobile',
        surfaceHostSourcesByDisplayIndex: {0: hostSource},
      })
      secondRenderer = mount(createSurfaceForDisplayIndex(secondAssembly, 0), PORTRAIT_PRIMARY_FRAME)
      expect(selectLayers(secondAssembly.runtime.getState(), 'PRIMARY'))
        .toEqual(expect.arrayContaining([expect.objectContaining({layerId: 'admin.console.layer'})]))
      expect(selectScreen(secondAssembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({partKey: businessPartKey})
      expect(secondRenderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()
    } finally {
      if (firstRenderer !== undefined) act(() => { firstRenderer!.unmount() })
      if (secondRenderer !== undefined) act(() => { secondRenderer!.unmount() })
      if (firstAssembly !== undefined) releaseRuntimeForTest(firstAssembly.runtime)
      if (secondAssembly !== undefined) releaseRuntimeForTest(secondAssembly.runtime)
    }
  })

  it('cleans only admin state on a display identity replacement and recomputes canvas geometry', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-admin-replacement-test-${Date.now()}`,
      surfaceForm: 'laptop',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      await assembly.runtime.dispatchCommand(openLayerCommand, {
        displayMode: 'PRIMARY',
        layerId: 'business-layer',
        partKey: 'sample.desk.waiting-confirm',
      }, {requestId: createRequestId()})
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          pressLauncher(renderer!)
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      for (const digit of ['1', '2', '3', '4', '5', '6']) {
        await act(async () => {
          press(renderer!, `ui.base.input:virtual-keyboard:text-${digit}`)()
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      await act(async () => {
        press(renderer!, adminTestIds.verify)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY').map(layer => layer.layerId)).toEqual(expect.arrayContaining([
        'business-layer',
        'admin.console.layer',
      ]))

      await act(async () => {
        await assembly.runtime.dispatchCommand(switchInstanceModeCommand, {instanceMode: 'SLAVE'}, {
          requestId: createRequestId(),
          routeContext: {displayMode: 'PRIMARY'},
        })
        await assembly.runtime.dispatchCommand(switchDisplayRoleCommand, {displayRole: 'VICE'}, {
          requestId: createRequestId(),
          routeContext: {displayMode: 'PRIMARY'},
        })
        ;(renderer as unknown as {readonly update: (element: ReturnType<typeof createSurfaceForDisplayIndex>) => void}).update(createSurfaceForDisplayIndex(assembly, 0))
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      expect(renderer.root.findAllByProps({testID: adminTestIds.shell})).toHaveLength(0)
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY').map(layer => layer.layerId)).toEqual(['business-layer'])
      const canvas = renderer.root.findByProps({testID: 'ui-base-render:surface-host-canvas'})
      expect(canvas.props.style).toEqual(expect.arrayContaining([
        expect.objectContaining({width: 960, height: 540}),
      ]))
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })
  it('reads device identity once at assembly startup and exposes only the normalized fact', async () => {
    let deviceInfoCalls = 0
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({
        onGetDeviceInfo: () => { deviceInfoCalls += 1 },
        deviceInfo: {
          deviceId: ' DEVICE-001 ',
          manufacturer: 'Example',
          model: 'Terminal',
          systemName: 'Android',
          systemVersion: '15',
          logicalProcessorCount: 8,
        },
      }),
      persistenceKey: `sample-console-device-identity-test-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    try {
      expect(deviceInfoCalls).toBe(1)
      expect(assembly.runtimeFacts.deviceIdentity).toEqual({available: true, deviceId: 'DEVICE-001'})
      expect(Object.isFrozen(assembly.runtimeFacts)).toBe(true)
      expect(Object.isFrozen(assembly.runtimeFacts.deviceIdentity)).toBe(true)
      createSurfaceForDisplayIndex(assembly, 0)
      createSurfaceForDisplayIndex(assembly, 0)
      expect(deviceInfoCalls).toBe(1)
    } finally {
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('starts the single assembly with all nine input modules and the runtime module', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-test-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    try {
      expect(assembly.runtime.status).toBe('started')
      expect(assembly.runtime.descriptors.map(descriptor => descriptor.moduleName)).toEqual(expect.arrayContaining([
        'kernel.base.runtime',
        'kernel.base.display-context',
        'kernel.base.ui-state',
        'kernel.feature.sample-staff-session',
        'kernel.feature.sample-member-registry',
        'ui.feature.sample-staff-auth',
        'ui.feature.sample-member-desk',
        'ui.integration.sample-console',
      ]))
      expect(assembly.runtime.descriptors).toHaveLength(8)
    } finally {
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('renders a real catalog part through RenderProvider and SurfaceRoot', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-render-test-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      expect(renderer.root.findByProps({testID: 'sample.auth.login'})).toBeDefined()
      expect(renderer.root.findByProps({testID: 'sample.auth.login:submit'})).toBeDefined()
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('maps the secondary display index through display-context ownership', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-secondary-render-test-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    let renderer: ReactTestRenderer | undefined
    try {
      const result = await assembly.runtime.dispatchCommand(showScreenCommand, {
        displayMode: 'SECONDARY',
        containerKey: 'main',
        partKey: 'sample.desk.customer-welcome',
      }, {
        requestId: createRequestId(),
        routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
      })
      expect(result.status).toBe('completed')
      renderer = mount(createSurfaceForDisplayIndex(assembly, 1), LANDSCAPE_SECONDARY_FRAME)
      expect(renderer.root.findByProps({testID: 'sample.desk.customer-welcome'})).toBeDefined()
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('closes the dual-screen age journey on withdraw before a late confirm can register', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
      persistenceKey: `sample-console-age-withdraw-test-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    let primaryRenderer: ReactTestRenderer | undefined
    let secondaryRenderer: ReactTestRenderer | undefined
    try {
      await act(async () => {
        await assembly.runtime.dispatchCommand(submitMemberCommand, {
          name: 'Alice',
          phone: '010-1234-5678',
        }, {requestId: createRequestId()})
      })
      primaryRenderer = mount(createSurfaceForDisplayIndex(assembly, 0), LANDSCAPE_PRIMARY_FRAME)
      secondaryRenderer = mount(createSurfaceForDisplayIndex(assembly, 1), LANDSCAPE_SECONDARY_FRAME)

      const ageInput = findTextInput(secondaryRenderer, 'sample.desk.customer-member:age')
      act(() => { ageInput.props.onFocus({nativeEvent: {}}) })
      expect(secondaryRenderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
      act(() => {
        press(secondaryRenderer!, 'ui.base.input:virtual-keyboard:text-3')()
      })

      await act(async () => { await press(primaryRenderer!, 'sample.desk.waiting-confirm:withdraw')() })
      expect(primaryRenderer.root.findByProps({testID: 'sample.desk.withdraw-confirm:withdraw'})).toBeDefined()
      await act(async () => { await press(primaryRenderer!, 'sample.desk.withdraw-confirm:withdraw')() })

      expect(selectPendingMember(assembly.runtime.getState())).toBeNull()
      expect(selectScreen(assembly.runtime.getState(), 'SECONDARY', 'main')).toMatchObject({
        partKey: 'sample.desk.customer-welcome',
      })
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY')).toHaveLength(0)
      expect(secondaryRenderer.root.findByProps({testID: 'sample.desk.customer-welcome'})).toBeDefined()

      const membersBeforeLateConfirm = selectMembers(assembly.runtime.getState())
      await act(async () => {
        await assembly.runtime.dispatchCommand(confirmMemberCommand, {age: 3}, {requestId: createRequestId()})
      })
      expect(selectPendingMember(assembly.runtime.getState())).toBeNull()
      expect(selectMembers(assembly.runtime.getState())).toEqual(membersBeforeLateConfirm)
    } finally {
      if (primaryRenderer !== undefined) act(() => { primaryRenderer!.unmount() })
      if (secondaryRenderer !== undefined) act(() => { secondaryRenderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('confirms a locally edited secondary age into the member fact only at decision time', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
      persistenceKey: `sample-console-age-confirm-test-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    let secondaryRenderer: ReactTestRenderer | undefined
    try {
      await assembly.runtime.dispatchCommand(submitMemberCommand, {
        name: 'Alice',
        phone: '010-1234-5678',
      }, {requestId: createRequestId()})
      secondaryRenderer = mount(createSurfaceForDisplayIndex(assembly, 1))
      const ageInput = findTextInput(secondaryRenderer, 'sample.desk.customer-member:age')
      act(() => { ageInput.props.onFocus({nativeEvent: {}}) })
      await act(async () => { await press(secondaryRenderer!, 'ui.base.input:virtual-keyboard:text-3')() })
      await act(async () => { await press(secondaryRenderer!, 'sample.desk.customer-member:confirm')() })
      expect(selectMembers(assembly.runtime.getState())).toContainEqual(expect.objectContaining({
        name: 'Alice',
        phone: '010-1234-5678',
        age: 3,
      }))
      expect(selectPendingMember(assembly.runtime.getState())).toBeNull()
    } finally {
      if (secondaryRenderer !== undefined) act(() => { secondaryRenderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('does not persist locally edited age when the customer rejects', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
      persistenceKey: `sample-console-age-reject-test-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    let secondaryRenderer: ReactTestRenderer | undefined
    try {
      await assembly.runtime.dispatchCommand(submitMemberCommand, {
        name: 'Alice',
        phone: '010-1234-5678',
      }, {requestId: createRequestId()})
      secondaryRenderer = mount(createSurfaceForDisplayIndex(assembly, 1))
      const ageInput = findTextInput(secondaryRenderer, 'sample.desk.customer-member:age')
      act(() => { ageInput.props.onFocus({nativeEvent: {}}) })
      await act(async () => { await press(secondaryRenderer!, 'ui.base.input:virtual-keyboard:text-4')() })
      await act(async () => { await press(secondaryRenderer!, 'sample.desk.customer-member:reject')() })
      expect(selectMembers(assembly.runtime.getState())).toEqual([])
      expect(selectPendingMember(assembly.runtime.getState())).toEqual({
        name: 'Alice',
        phone: '010-1234-5678',
      })
    } finally {
      if (secondaryRenderer !== undefined) act(() => { secondaryRenderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('retains rejected pending data for retry and clears it only when the notice is abandoned', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 2}),
      persistenceKey: `sample-console-retry-abandon-test-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    try {
      await assembly.runtime.dispatchCommand(submitMemberCommand, {
        name: 'Carol',
        phone: '010-1111-2222',
      }, {requestId: createRequestId()})
      await assembly.runtime.dispatchCommand(rejectMemberCommand, {}, {requestId: createRequestId()})
      expect(selectPendingMember(assembly.runtime.getState())).toEqual({
        name: 'Carol',
        phone: '010-1111-2222',
      })

      await assembly.runtime.dispatchCommand(memberRegistrationRetryRequestedCommand, {
        reasonCode: 'customer-rejected',
      }, {requestId: createRequestId()})
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.member-form',
      })
      expect(selectPendingMember(assembly.runtime.getState())).toEqual({
        name: 'Carol',
        phone: '010-1111-2222',
      })

      await assembly.runtime.dispatchCommand(rejectMemberCommand, {}, {requestId: createRequestId()})
      await assembly.runtime.dispatchCommand(memberRegistrationAbandonedCommand, {}, {requestId: createRequestId()})
      expect(selectPendingMember(assembly.runtime.getState())).toBeNull()
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.member-list',
      })
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY')).toHaveLength(0)
    } finally {
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('returns the single-surface hand-back to the member form without a confirmation layer', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1}),
      persistenceKey: `sample-console-hand-back-test-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    try {
      await assembly.runtime.dispatchCommand(submitMemberCommand, {
        name: 'Alice',
        phone: '010-1234-5678',
      }, {requestId: createRequestId()})
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.customer-member',
        props: {mode: 'handheld-confirm'},
      })

      await assembly.runtime.dispatchCommand(memberSubmissionWithdrawnCommand, {}, {requestId: createRequestId()})
      expect(selectPendingMember(assembly.runtime.getState())).toBeNull()
      expect(selectScreen(assembly.runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.member-form',
      })
    } finally {
      releaseRuntimeForTest(assembly.runtime)
    }
  })
})
