import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import type {ReactElement} from 'react'
import {describe, expect, it, vi} from 'vitest'
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native'
import {advanceAnimatedTimingsForTests, setAnimatedTimingAutoFinishForTests} from '../../../../../../tools/terminal-shared/react-native-vitest-entry'
import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import {
  createProcessMemoryStateStoragePort,
  type LogEvent,
  type StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports'
import {switchDisplayRoleCommand, switchInstanceModeCommand} from '@catering-v2s/kernel-base-display-context'
import {selectRequestExecutionView} from '@catering-v2s/kernel-base-runtime'
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing'
import {
  clearLayersCommand,
  openLayerCommand,
  selectLayers,
  selectScreen,
  showScreenCommand,
} from '@catering-v2s/kernel-base-ui-state'
import {refreshTopologyDisplayCommand, topologyActions} from '@catering-v2s/kernel-base-topology'
import {createUiCatalog, selectAvailableParts} from '@catering-v2s/kernel-base-ui-state'
import {
  confirmMemberCommand,
  rejectMemberCommand,
  selectMembers,
  selectPendingMember,
  submitMemberCommand,
} from '@catering-v2s/kernel-feature-sample-member-registry'
import {sessionRestoredAnonymousCommand} from '@catering-v2s/kernel-feature-sample-staff-session'
import {
  memberRegistrationAbandonedCommand,
  memberRegistrationRetryRequestedCommand,
  memberSubmissionWithdrawnCommand,
} from '../../../../ui/feature/sample-member-desk/src/features/commands/commands'
import {createSampleAssembly as createProductionSampleAssembly, createSurfaceForDisplayIndex} from '../src'
import {createSampleDefinedParts} from '../src/assembly/assembly'
import {adminTestIds} from '@catering-v2s/ui-base-admin-shell'
import {sampleMemberDeskAssembly} from '@catering-v2s/ui-feature-sample-member-desk'
import {sampleStaffAuthAssembly} from '@catering-v2s/ui-feature-sample-staff-auth'
import {createTestPlatformPorts, TestPeerChannel, type TestPlatformPorts} from './support'

type TestSampleAssemblyInput = Omit<Parameters<typeof createProductionSampleAssembly>[0], 'platformPorts' | 'nativeLoadingCapability'> & Readonly<{
  readonly platformPorts: TestPlatformPorts
}>

type TestInstanceQuery = Readonly<{
  readonly findByProps: (props: Readonly<Record<string, unknown>>) => TestInstanceQuery
  readonly props: Readonly<Record<string, unknown>>
}>
type NativeTestElement = Readonly<{readonly type: unknown; readonly props: Readonly<Record<string, unknown>>}>

const createSampleAssembly = (input: TestSampleAssemblyInput) => createProductionSampleAssembly({
  ...input,
  nativeLoadingCapability: input.platformPorts.nativeLoadingCapability,
})

const LANDSCAPE_PRIMARY_FRAME = {width: 1280, height: 800} as const
const LANDSCAPE_SECONDARY_FRAME = {width: 1280, height: 800} as const
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
  inputMeasuredY = 120,
): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  const createInputNodeMock = (node: NativeTestElement): unknown => {
    const testID = node.props.testID
    if (testID === 'ui.base.input:surface-frame') return {}
    if (typeof testID === 'string' && testID.endsWith(':scroll')) {
      const contentNode = {}
      return {
        getInnerViewRef: () => contentNode,
        measureLayout: (_relativeTo: unknown, callback: (x: number, y: number, width: number, height: number) => void) => {
          callback(0, 0, frameLayout.width, Math.max(1, frameLayout.height - 20))
        },
        scrollTo: () => undefined,
      }
    }
    if (typeof testID === 'string') {
      return {
        measureLayout: (_relativeTo: unknown, callback: (x: number, y: number, width: number, height: number) => void) => {
          callback(0, inputMeasuredY, Math.min(320, frameLayout.width), 40)
        },
        focus: () => undefined,
        blur: () => undefined,
      }
    }
    return undefined
  }
  act(() => {
    renderer = (create as unknown as (
      element: Parameters<typeof create>[0],
      options?: Readonly<{readonly createNodeMock: (element: ReactElement) => unknown}>,
    ) => ReactTestRenderer)(element, {
      createNodeMock: (node: ReactElement) => {
        const testID = (node.props as Readonly<{readonly testID?: unknown}>).testID
        if (testID === adminTestIds.launcher) {
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
        }
        return createInputNodeMock(node as unknown as NativeTestElement)
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
  const scrollAreas = renderer!.root.findAll(scroll => scroll.type === ScrollView
    && typeof scroll.props.testID === 'string'
    && scroll.props.testID.endsWith(':scroll')
    && typeof scroll.props.onLayout === 'function'
    && typeof scroll.props.onContentSizeChange === 'function'
    && typeof scroll.props.onScroll === 'function')
  act(() => {
    for (const scroll of scrollAreas) {
      ;(scroll.props.onLayout as (event: unknown) => void)({nativeEvent: {layout: {
        x: 0,
        y: 0,
        width: frameLayout.width,
        height: Math.max(1, frameLayout.height - 20),
      }}})
      ;(scroll.props.onContentSizeChange as (width: number, height: number) => void)(frameLayout.width, 1200)
      ;(scroll.props.onScroll as (event: unknown) => void)({nativeEvent: {contentOffset: {y: 0}}})
    }
  })
  return renderer!
}

const reportPrimaryReadyLayout = async (
  renderer: ReactTestRenderer,
  frame: Readonly<{readonly width: number; readonly height: number}>,
): Promise<void> => {
  const boundaries = renderer.root.findAllByProps({testID: 'ui-base-render:screen-ready-boundary'})
  act(() => {
    for (const boundary of boundaries) {
      ;(boundary.props.onLayout as (event: unknown) => void)({nativeEvent: {layout: frame}})
    }
  })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

const openTestPeerAsSlave = async (peer: TestPeerChannel): Promise<void> => {
  peer.emit({type: 'open', connectionId: 'test-peer-connection'})
  peer.emit({
    type: 'message',
    connectionId: 'test-peer-connection',
    raw: JSON.stringify({
      type: 'hello',
      protocolVersion: 1,
      moduleName: 'ui.integration.sample-console',
      wireId: 'test-peer-hello',
      nodeId: 'test-peer-slave',
      displayName: '测试副机',
      instanceMode: 'SLAVE',
      displayRole: 'VICE',
    }),
  })
  await new Promise(resolve => setTimeout(resolve, 0))
}

const stateFullSliceNames = (peer: TestPeerChannel): string[] => peer.sentFrames
  .map(raw => JSON.parse(raw) as Readonly<{readonly type?: string; readonly sliceName?: string}>)
  .filter(frame => frame.type === 'state-full-chunk' && frame.sliceName !== undefined)
  .map(frame => frame.sliceName!)

const press = (renderer: ReactTestRenderer, testID: string): (() => unknown) => {
  const instance = renderer.root.findByProps({testID}) as unknown as Readonly<{
    readonly props: Readonly<{readonly onPress: () => unknown}>
  }>
  return instance.props.onPress
}

const waitForAdminContent = async (renderer: ReactTestRenderer): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (renderer.root.findAllByProps({testID: adminTestIds.shell}).length > 0
      && renderer.root.findAllByProps({testID: adminTestIds.panel.body}).length > 0) return
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
  }
  throw new Error('authenticated admin shell did not become available')
}

const selectMobileAdminSection = async (renderer: ReactTestRenderer, partKey: string): Promise<void> => {
  await act(async () => {
    press(renderer, 'terminal.admin:navigation:trigger')()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  await act(async () => {
    press(renderer, `terminal.admin:navigation:option:${partKey}`)()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
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
  finishKeyboardPresentation(renderer)
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
  await waitForAdminContent(renderer)
}

const measureKeyboardLayers = (renderer: ReactTestRenderer): void => {
  const measurementLayers = renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-layer-position:measure'}) as unknown as readonly TestInstanceQuery[]
  for (const layer of measurementLayers) {
    const backdrop = layer.findByProps({testID: 'ui.base.input:virtual-keyboard:backdrop'})
    const layout = StyleSheet.flatten(backdrop.props.style) as Readonly<{readonly width: number; readonly height: number}>
    const onLayout = layer.props.onLayout
    if (typeof onLayout !== 'function') throw new Error('Keyboard measurement layer is missing its onLayout callback')
    act(() => {
      ;(onLayout as (event: unknown) => void)({nativeEvent: {layout}})
    })
  }
}

const finishKeyboardPresentation = (renderer: ReactTestRenderer): void => {
  setAnimatedTimingAutoFinishForTests(true)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-layer-position:measure'}).length === 0) break
    measureKeyboardLayers(renderer)
    act(() => { advanceAnimatedTimingsForTests(1) })
  }
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

  it('records a visible content failure in the shared startup completion facts', async () => {
    const events: LogEvent[] = []
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({events}),
      persistenceKey: `sample-console-startup-content-failure-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      const selection = await assembly.runtime.dispatchCommand(showScreenCommand, {
        displayMode: 'PRIMARY',
        containerKey: 'main',
        partKey: 'sample.console.missing-part',
      }, {
        requestId: createRequestId(),
        routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
      })
      expect(selection.status).toBe('completed')
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME, true)
      await reportPrimaryReadyLayout(renderer, PORTRAIT_PRIMARY_FRAME)
      const complete = events.find(event => event.event === 'startup.complete')
      expect(complete?.data).toMatchObject({
        primaryReadyPartKey: 'sample.console.missing-part',
        primaryContentFailure: 'missing-catalog-entry',
      })
      expect(events.some(event => event.event === 'startup.ready-failed')).toBe(false)
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('retries PRIMARY startup readiness after prerequisites reject completion', async () => {
    const events: LogEvent[] = []
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({events, failStartupReadyCount: 1}),
      persistenceKey: `sample-console-startup-retry-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
    })
    let renderer: ReactTestRenderer | undefined
    try {
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME, true)
      await reportPrimaryReadyLayout(renderer, PORTRAIT_PRIMARY_FRAME)
      expect(events.filter(event => event.event === 'startup.complete')).toHaveLength(0)
      expect(events.filter(event => event.event === 'startup.ready-dispatch-failed')).toHaveLength(1)
      expect(events.find(event => event.event === 'startup.ready-dispatch-failed')?.data?.errorName)
        .toBe('Error')

      act(() => { renderer!.unmount() })
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME)
      await reportPrimaryReadyLayout(renderer, PORTRAIT_PRIMARY_FRAME)
      expect(events.filter(event => event.event === 'startup.ready-dispatch-failed')).toHaveLength(1)
      expect(events.filter(event => event.event === 'startup.complete')).toHaveLength(1)
      expect(events.filter(event => event.event === 'startup.ready-dispatch-start')).toHaveLength(2)
      expect(events.filter(event => event.event === 'startup.ready-dispatch-result').map(event => event.data?.status))
        .toEqual(['error', 'completed'])
    } finally {
      if (renderer !== undefined) act(() => { renderer!.unmount() })
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('sends the member registry sync slice but never an isolated wallpaper slice', async () => {
    const peer = new TestPeerChannel()
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({displayCount: 1}),
      persistenceKey: `sample-console-sync-slices-${Date.now()}`,
      surfaceForm: 'laptop',
      topologyPeerChannel: peer,
    })
    try {
      await openTestPeerAsSlave(peer)
      const sliceNames = stateFullSliceNames(peer)
      expect(sliceNames).toContain('kernel.feature.sample-member-registry.members')
      expect(sliceNames).not.toContain('kernel.feature.sample-staff-session.session')
      expect(sliceNames).not.toContain('kernel.feature.sample-wallpaper.selection')
    } finally {
      await peer.dispose()
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

  it('selects the form-specific login renderer at the real integration surface', async () => {
    const assemblies = await Promise.all((['laptop', 'mobile'] as const).map(surfaceForm =>
      createSampleAssembly({
        platformPorts: createTestPlatformPorts({displayCount: surfaceForm === 'laptop' ? 2 : 1}),
        persistenceKey: `sample-console-form-renderer-${surfaceForm}-${Date.now()}`,
        surfaceForm,
        surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, surfaceForm === 'laptop' ? LANDSCAPE_PRIMARY_FRAME : PORTRAIT_PRIMARY_FRAME)},
      })))
    const renderers: ReactTestRenderer[] = []
    try {
      for (const assembly of assemblies) {
        const frame = assembly.surfaceForm === 'laptop' ? LANDSCAPE_PRIMARY_FRAME : PORTRAIT_PRIMARY_FRAME
        const renderer = mount(createSurfaceForDisplayIndex(assembly, 0), frame)
        renderers.push(renderer)
        const login = renderer.root.findByProps({testID: 'sample.auth.login'})
        const actions = renderer.root.findByProps({testID: 'sample.auth.login:actions'})
        const style = StyleSheet.flatten(login.props.style)
        if (assembly.surfaceForm === 'laptop') {
          expect(style).toMatchObject({maxWidth: 720, alignSelf: 'center'})
          expect(actions.props.orientation).toBeUndefined()
        } else {
          expect(style).toMatchObject({paddingHorizontal: 8, gap: 3})
          expect(actions.props.orientation).toBe('column')
        }
      }
    } finally {
      for (const renderer of renderers) act(() => { renderer.unmount() })
      for (const assembly of assemblies) releaseRuntimeForTest(assembly.runtime)
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
      expect(assembly.runtimeFacts.surfaceCanvasSizes).toEqual(override.orientations.landscape)
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
    const withSampleLaptop = createUiCatalog(createSampleDefinedParts()
      .filter(({catalogEntry}) => catalogEntry.surfaceForm.includes('laptop'))
      .map(({catalogEntry}) => catalogEntry))
    const withSampleMobile = createUiCatalog(createSampleDefinedParts()
      .filter(({catalogEntry}) => catalogEntry.surfaceForm.includes('mobile'))
      .map(({catalogEntry}) => catalogEntry))
    const withoutSampleLaptop = createUiCatalog(createSampleDefinedParts(false)
      .filter(({catalogEntry}) => catalogEntry.surfaceForm.includes('laptop'))
      .map(({catalogEntry}) => catalogEntry))
    const withoutSampleMobile = createUiCatalog(createSampleDefinedParts(false)
      .filter(({catalogEntry}) => catalogEntry.surfaceForm.includes('mobile'))
      .map(({catalogEntry}) => catalogEntry))
    expect(selectAvailableParts(withSampleLaptop, 'admin.sections', context).map(entry => entry.partKey)).toContain('sample.console.admin-test')
    expect(selectAvailableParts(withSampleMobile, 'admin.sections', mobileContext).map(entry => entry.partKey)).toContain('sample.console.admin-test')
    expect(selectAvailableParts(withoutSampleLaptop, 'admin.sections', context).map(entry => entry.partKey)).not.toContain('sample.console.admin-test')
    expect(selectAvailableParts(withoutSampleMobile, 'admin.sections', mobileContext).map(entry => entry.partKey)).not.toContain('sample.console.admin-test')
  })

  it('registers separate laptop and mobile renderer siblings for every sample business part', () => {
    const definedParts = createSampleDefinedParts(false)
    const groups = new Map<string, typeof definedParts[number][]>()
    for (const part of definedParts) {
      const siblings = groups.get(part.catalogEntry.partKey) ?? []
      siblings.push(part)
      groups.set(part.catalogEntry.partKey, siblings)
    }

    for (const [partKey, siblings] of groups) {
      expect(partKey.startsWith('sample.auth.') || partKey.startsWith('sample.desk.')).toBe(true)
      expect(siblings).toHaveLength(2)
      expect(siblings.map(part => part.catalogEntry.surfaceForm).sort()).toEqual([['laptop'], ['mobile']])
      expect(new Set(siblings.map(part => part.rendererBinding.component)).size).toBe(2)
      expect(new Set(siblings.map(part => part.rendererBinding.rendererKey)).size).toBe(2)
      for (const sibling of siblings) {
        const surfaceForm = sibling.catalogEntry.surfaceForm[0]
        expect(sibling.rendererBinding.rendererKey).toBe(`${partKey}.${surfaceForm}`)
      }
    }
  })

  it('keeps exact metadata for the integration-owned part and composes feature parts unchanged', () => {
    const definedParts = createSampleDefinedParts()
    const featureParts = [
      ...sampleStaffAuthAssembly.parts,
      ...sampleMemberDeskAssembly.parts,
    ]

    expect(createSampleDefinedParts(false)).toEqual(featureParts)
    expect(definedParts.slice(0, featureParts.length)).toEqual(featureParts)
    expect(definedParts).toHaveLength(featureParts.length + 1)
    expect(definedParts.slice(featureParts.length).map(({catalogEntry, rendererBinding}) => ({
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
    }))).toEqual([{
      partKey: 'sample.console.admin-test',
      rendererKey: 'sample.console.admin-test',
      containerKeys: ['admin.sections'],
      displayModes: ['PRIMARY', 'SECONDARY'],
      workspaces: ['MAIN', 'BRANCH'],
      instanceModes: ['MASTER', 'SLAVE'],
      title: '示例诊断',
      surfaceForm: ['laptop', 'mobile'],
      layerTier: 'standard',
      layerGuard: 'dismissible',
    }])
  })

  it('allows only the member desk customer surfaces on a topology secondary', () => {
    const secondaryMemberParts = [...new Set(createSampleDefinedParts(false)
      .filter(({catalogEntry}) =>
        catalogEntry.partKey.startsWith('sample.desk.')
        && catalogEntry.displayModes.includes('SECONDARY')
        && catalogEntry.instanceModes.includes('SLAVE'))
      .map(({catalogEntry}) => catalogEntry.partKey))]
    expect(secondaryMemberParts).toEqual([
      'sample.desk.customer-welcome',
      'sample.desk.customer-member',
    ])
  })

  it('keeps exactly the three canonical admin pages available in both laptop and mobile', async () => {
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
        adminTestIds.sections.topology,
      ]) {
        expect(laptopRenderer.root.findByProps({testID: sectionTestID})).toBeDefined()
      }
      expect(laptopRenderer.root.findAllByProps({testID: adminTestIds.sections.sampleConsole})).toHaveLength(0)
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
      expect(laptopRenderer.root.findByProps({testID: adminTestIds.runtime.title})).toBeDefined()
      await act(async () => {
        press(laptopRenderer!, adminTestIds.sections.platformPorts)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(StyleSheet.flatten(laptopRenderer.root.findByProps({testID: adminTestIds.content}).props.style)).toMatchObject({
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      })
      const laptopPortsSection = laptopRenderer.root.findAllByProps({testID: adminTestIds.ports.section})
        .find(node => node.type === View)!
      expect(StyleSheet.flatten(laptopPortsSection.props.style)).toMatchObject({
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      })
      const laptopSectionHeading = laptopRenderer.root.findAllByProps({testID: adminTestIds.ports.title})
        .find(node => node.type === Text)!
      expect(laptopSectionHeading.props).toMatchObject({
        accessibilityRole: 'header',
        accessibilityLiveRegion: 'polite',
      })

      mobileRenderer = mount(createSurfaceForDisplayIndex(mobileAssembly, 0), PORTRAIT_PRIMARY_FRAME)
      await tapLauncher(mobileRenderer)
      await authenticateAdmin(mobileRenderer)
      expect(mobileRenderer.root.findByProps({testID: 'terminal.admin:navigation'})).toBeDefined()
      const mobileShell = mobileRenderer.root.findByProps({testID: adminTestIds.shell})
      const mobileShellStyle = StyleSheet.flatten(mobileShell.props.style)
      expect(mobileShellStyle).toMatchObject({flex: 1, width: '100%'})
      expect(mobileShellStyle).not.toHaveProperty('maxWidth')
      const mobileNavigation = mobileRenderer.root.findByProps({testID: 'terminal.admin:navigation'})
      expect(mobileNavigation).toBeDefined()
      const mobileNavigationTrigger = mobileRenderer.root.findByProps({testID: 'terminal.admin:navigation:trigger'})
      expect(mobileNavigationTrigger.props.accessibilityRole).toBe('button')
      expect(mobileNavigationTrigger.props.accessibilityLabel).toBe('选择终端管理页面')
      expect(mobileNavigationTrigger.props.accessibilityState).toMatchObject({expanded: false})
      await act(async () => {
        press(mobileRenderer!, 'terminal.admin:navigation:trigger')()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(mobileRenderer.root.findByProps({testID: 'terminal.admin:navigation:menu'})).toBeDefined()
      for (const partKey of [
        'admin.console.platform-ports',
        'admin.console.runtime',
        'admin.console.topology',
      ]) {
        expect(mobileRenderer.root.findByProps({testID: `terminal.admin:navigation:option:${partKey}`})).toBeDefined()
      }
      expect(mobileRenderer.root.findAllByProps({testID: 'terminal.admin:navigation:option:sample.console.admin-test'})).toHaveLength(0)
      await act(async () => {
        press(mobileRenderer!, 'terminal.admin:navigation:option:admin.console.platform-ports')()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(mobileRenderer.root.findByProps({testID: 'terminal.admin:navigation:trigger'}).props.accessibilityState).toMatchObject({expanded: false})
      expect(mobileRenderer.root.findByProps({testID: adminTestIds.content})).toBeDefined()
      const mobilePortsSection = mobileRenderer.root.findAllByProps({testID: adminTestIds.ports.section})
        .find(node => node.type === View)!
      expect(StyleSheet.flatten(mobilePortsSection.props.style)).toMatchObject({
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      })
      const mobileSectionHeading = mobileRenderer.root.findAllByProps({testID: adminTestIds.ports.title})
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
      finishKeyboardPresentation(renderer)
      expect(renderer.root.findByProps({testID: adminTestIds.login})).toBeDefined()
      const loginCard = renderer.root.findByProps({testID: `${adminTestIds.login}:card`})
      expect(renderer.root.findAllByProps({testID: 'ui.base.input:surface-frame'})).toHaveLength(1)
      expect(renderer.root.findAll(node => node.type === View && node.props.testID === 'ui.base.input:virtual-keyboard')).toHaveLength(1)
      expect(StyleSheet.flatten(loginCard.props.style)).toMatchObject({width: '100%'})
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
      await waitForAdminContent(renderer)
      expect(renderer.root.findByProps({testID: adminTestIds.shell})).toBeDefined()
      expect(renderer.root.findByProps({testID: 'terminal.admin:navigation'})).toBeDefined()
      await selectMobileAdminSection(renderer!, 'admin.console.runtime')
      expect(renderer.root.findByProps({testID: adminTestIds.runtime.section})).toBeDefined()
      expect(renderer.root.findAllByProps({testID: 'sample.console.admin-test'})).toHaveLength(0)
      await act(async () => {
        hostSource.emit({
          stableHostLogicalSize: {width: 1000, height: 700},
          isHostPrimaryDisplay: true,
        })
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findByProps({testID: adminTestIds.shell})).toBeDefined()
      expect(renderer.root.findByProps({testID: adminTestIds.runtime.section})).toBeDefined()
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
      finishKeyboardPresentation(renderer)
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
      finishKeyboardPresentation(renderer)
      await act(async () => {
        press(renderer!, 'ui.base.input:virtual-keyboard:text-1')()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findByProps({testID: `${adminTestIds.password}:digit:0`}).props.children).toBe('*')
      expect(findTextInput(renderer, 'sample.desk.member-form:phone').props.value).toBe('3')

      await act(async () => {
        press(renderer!, adminTestIds.close)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(renderer.root.findAllByProps({testID: adminTestIds.login})).toHaveLength(0)
      const restoredBusinessInput = findTextInput(renderer, 'sample.desk.member-form:phone')
      act(() => { restoredBusinessInput.props.onFocus({nativeEvent: {}}) })
      finishKeyboardPresentation(renderer)
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

  it('accepts the displayed device-derived admin code entered through the virtual keyboard', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({deviceInfo: {
        deviceId: 'DEVICE-ADMIN-LOGIN-001',
        systemName: 'Android',
        systemVersion: '34',
        logicalProcessorCount: 8,
      }}),
      persistenceKey: `sample-console-admin-derived-password-test-${Date.now()}`,
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
      finishKeyboardPresentation(renderer)
      const displayedCode = String(renderer.root.findByProps({testID: adminTestIds.debugPassword}).props.children)
        .match(/\d{6}/)?.[0]
      expect(displayedCode).toMatch(/^\d{6}$/)
      for (const digit of displayedCode!) {
        await act(async () => {
          press(renderer!, `ui.base.input:virtual-keyboard:text-${digit}`)()
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      }
      await act(async () => {
        press(renderer!, adminTestIds.verify)()
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      await waitForAdminContent(renderer)
      expect(renderer.root.findByProps({testID: adminTestIds.shell})).toBeDefined()
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
        .toEqual(['请输入动态口令', null])
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
      platformPorts: createTestPlatformPorts({displayCount: 2, displayInfoGate, displayInfoGateAfterCalls: 2}),
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
      await selectMobileAdminSection(renderer!, 'admin.console.runtime')
      expect(renderer.root.findByProps({testID: adminTestIds.runtime.section})).toBeDefined()
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
      await selectMobileAdminSection(firstRenderer!, 'admin.console.runtime')
      expect(firstRenderer.root.findByProps({testID: adminTestIds.runtime.section})).toBeDefined()
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
      finishKeyboardPresentation(renderer)
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
      expect(selectLayers(assembly.runtime.getState(), 'PRIMARY').map(layer => layer.layerId)).toEqual([
        'business-layer',
        'admin.console.layer',
      ])
      const canvas = renderer.root.findByProps({testID: 'ui-base-render:surface-host-canvas'})
      expect(canvas.props.style).toEqual(expect.arrayContaining([
        expect.objectContaining({width: 1280, height: 800}),
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

  it('starts the single assembly with all input modules and the runtime module', async () => {
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
      expect(assembly.runtime.descriptors).toHaveLength(10)
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

  it('keeps the production SurfaceRoot on the input presentation bridge', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-presentation-bridge-${Date.now()}`,
      surfaceForm: 'mobile',
      surfaceHostSourcesByDisplayIndex: {0: createHostSource(true, PORTRAIT_PRIMARY_FRAME)},
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
      renderer = mount(createSurfaceForDisplayIndex(assembly, 0), PORTRAIT_PRIMARY_FRAME, true, {width: 0, height: 0}, 500)

      const financialProbe = findTextInput(renderer, 'sample.desk.member-form:keyboard-financial-probe')
      act(() => { financialProbe.props.onFocus({nativeEvent: {}}) })
      finishKeyboardPresentation(renderer)

      const translatedNodes = renderer.root.findAll(node => {
        const style = StyleSheet.flatten(node.props.style) as Readonly<{
          readonly transform?: readonly Readonly<{readonly translateY?: unknown}>[]
        }> | undefined
        return style?.transform?.some(transform => typeof transform.translateY === 'number' && transform.translateY < -0.5) ?? false
      })
      expect(translatedNodes.length).toBeGreaterThan(0)
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

  it('recomputes anonymous secondary placement after a display refresh', async () => {
    let displayCount = 1
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts({getDisplayCount: () => displayCount}),
      persistenceKey: `sample-console-display-refresh-placement-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    try {
      await assembly.runtime.dispatchCommand(sessionRestoredAnonymousCommand, {}, {requestId: createRequestId()})
      displayCount = 2
      const refreshed = await assembly.runtime.dispatchCommand(
        refreshTopologyDisplayCommand,
        {},
        {requestId: createRequestId()},
      )
      if (refreshed.status !== 'completed') throw new Error(JSON.stringify(refreshed, null, 2))
      expect(selectScreen(assembly.runtime.getState(), 'SECONDARY', 'main')).toMatchObject({
        partKey: 'sample.desk.customer-welcome',
      })
    } finally {
      releaseRuntimeForTest(assembly.runtime)
    }
  })

  it('routes every production UI screen command through the runtime boundary', async () => {
    const assembly = await createSampleAssembly({
      platformPorts: createTestPlatformPorts(),
      persistenceKey: `sample-console-runtime-route-command-family-${Date.now()}`,
      surfaceForm: 'laptop',
    })
    try {
      assembly.runtime.getStore().dispatch(topologyActions.setMasterLocator({
        host: '192.0.2.10',
        port: 43172,
        basePath: '/terminal-topology',
          identity: {
            protocolVersion: 1,
            moduleName: 'ui.integration.sample-console',
          nodeId: 'node-master',
          displayName: 'TER master',
          instanceMode: 'MASTER',
          displayRole: 'CHIEF',
        },
      }))

      const cases = [
        {
          command: showScreenCommand,
          payload: {displayMode: 'SECONDARY' as const, containerKey: 'main', partKey: 'sample.desk.customer-welcome'},
        },
        {
          command: openLayerCommand,
          payload: {displayMode: 'PRIMARY' as const, layerId: 'sample.desk.waiting-confirm', partKey: 'sample.desk.waiting-confirm'},
        },
        {
          command: clearLayersCommand,
          payload: {displayMode: 'SECONDARY' as const},
        },
      ] as const

      for (const currentCase of cases) {
        const requestId = createRequestId()
        const result = await assembly.runtime.dispatchCommand(currentCase.command.commandName, currentCase.payload, {requestId})
        expect(result.status).toBe('completed')
        expect(selectRequestExecutionView(assembly.runtime.getState(), requestId)).toMatchObject({
          status: 'completed',
          commands: [expect.objectContaining({
            commandName: currentCase.command.commandName,
            observations: [expect.objectContaining({target: 'local'})],
          })],
        })
      }
    } finally {
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
      finishKeyboardPresentation(secondaryRenderer)
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
      finishKeyboardPresentation(secondaryRenderer)
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
      finishKeyboardPresentation(secondaryRenderer)
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
