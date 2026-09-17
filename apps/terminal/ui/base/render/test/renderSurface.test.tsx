import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {createElement, type ComponentType, type ReactElement} from 'react'
import {BackHandler, StyleSheet, TextInput, View} from 'react-native'
import {describe, expect, it, vi} from 'vitest'
import type {
  LogEvent,
  LogWriteInput,
  LogWriteResult,
  LoggerPort,
} from '@catering-v2s/kernel-base-platform-ports'
import {defineCommand, type Runtime} from '@catering-v2s/kernel-base-runtime'
import {createCommandId} from '@catering-v2s/kernel-base-contracts'
import {
  createRendererCatalog,
  bindSurfaceHostIdentity,
  definePart,
  LayerStack,
  RenderProvider,
  ScreenContainer,
  SurfaceFocusBoundaryContext,
  SurfaceRoot,
  calculateSurfaceHostGeometry,
  dispatchWithRequestId,
  useDispatchCommand,
  type SurfaceHostSnapshot,
  type SurfaceHostMeasurementSource,
  type SurfaceHostSource,
  type RenderProviderProps,
  type SurfaceHostIdentityRejection,
} from '../src/index'
import {createUiCatalog, selectScreen} from '@catering-v2s/kernel-base-ui-state'
import {createRenderPartDiagnosticReporter} from '../src/foundations/diagnostics'
import {unusedRenderProviderBindings} from './renderProviderBindings'

;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

type RuntimeStateRoot = ReturnType<Runtime['getState']>

type FakeSource = Readonly<{
  readonly stateSource: {
    readonly getStatus: () => 'created' | 'started'
    readonly getState: () => RuntimeStateRoot
    readonly subscribe: (listener: () => void) => () => void
  }
  readonly setStatus: (status: 'created' | 'started') => void
  readonly setRoot: (root: RuntimeStateRoot) => void
  readonly notify: () => void
}>

const createSource = (): FakeSource => {
  let status: 'created' | 'started' = 'created'
  let root = Object.freeze({}) as RuntimeStateRoot
  const listeners = new Set<() => void>()
  const stateSource = {
    getStatus: () => status,
    getState: () => root,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return {
    stateSource,
    setStatus: nextStatus => { status = nextStatus },
    setRoot: nextRoot => { root = nextRoot },
    notify: () => { for (const listener of [...listeners]) listener() },
  }
}

const createLogger = (): Readonly<{logger: LoggerPort; events: LogWriteInput[]}> => {
  const events: LogWriteInput[] = []
  const write = (input: LogWriteInput): LogWriteResult => {
    events.push(input)
    return {status: 'succeeded', value: {} as LogEvent, completedAt: 0}
  }
  const logger: LoggerPort = {
    debug: write,
    info: write,
    warn: write,
    error: write,
    scope: () => logger,
    withContext: () => logger,
  }
  return {logger, events}
}

const mount = (
  element: ReactElement,
  createNodeMock?: (element: ReactElement) => unknown,
): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = (create as unknown as (
      element: ReactElement,
      options?: Readonly<{readonly createNodeMock: (element: ReactElement) => unknown}>,
    ) => ReactTestRenderer)(element, createNodeMock === undefined ? undefined : {createNodeMock})
  })
  return renderer!
}

const findFallbacks = (renderer: ReactTestRenderer) => renderer.root.findAll(node =>
  typeof node.type === 'string'
  && typeof node.props.testID === 'string'
  && node.props.testID.startsWith('ui-base-render:fallback:'),
)

const findByTestID = (renderer: ReactTestRenderer, testID: string) => {
  const matches = renderer.root.findAll(node => node.props.testID === testID)
  if (matches.length === 0) throw new Error(`testID not found: ${testID}`)
  return matches[0]
}

type BackPressHandler = Parameters<typeof BackHandler.addEventListener>[1]

const emptyContent = () => ({
  contentSets: {
    PRIMARY: {containers: {}, layers: []},
    SECONDARY: {containers: {}, layers: []},
  },
})

const rootWithContent = (content: object): RuntimeStateRoot => Object.freeze({
  'kernel.base.runtime.instance-mode': Object.freeze({instanceMode: 'MASTER'}),
  'kernel.base.display-context.display-role': Object.freeze({displayRole: 'CHIEF'}),
  'kernel.base.ui-state.content.MAIN': content,
  'kernel.base.ui-state.content.BRANCH': emptyContent(),
}) as RuntimeStateRoot

type ScreenProps = Readonly<{marker: string}>
const Screen: ComponentType<ScreenProps> = props => createElement('render-screen', props)
type StandardLayerProps = Readonly<{marker: string}>
const StandardLayer: ComponentType<StandardLayerProps> = props => createElement('render-layer', props)
type AlertLayerProps = Readonly<{marker: string}>
const AlertLayer: ComponentType<AlertLayerProps> = props => createElement('render-layer', props)

const part = <TProps extends object>(input: Readonly<{
  readonly partKey: string
  readonly rendererKey: string
  readonly component: ComponentType<TProps>
  readonly layerTier?: 'standard' | 'alert'
  readonly layerGuard?: 'dismissible' | 'decisive'
  readonly containerKeys?: readonly string[]
  readonly surfaceForm?: readonly ('laptop' | 'mobile')[]
}>) => definePart({
  partKey: input.partKey,
  rendererKey: input.rendererKey,
  containerKeys: input.containerKeys ?? ['root'],
  displayModes: ['PRIMARY', 'SECONDARY'] as const,
  workspaces: ['MAIN'] as const,
  instanceModes: ['MASTER'] as const,
  surfaceForm: input.surfaceForm ?? ['laptop', 'mobile'] as const,
  title: input.partKey,
  description: input.partKey,
  component: input.component,
  ...(input.layerTier === undefined ? {} : {layerTier: input.layerTier}),
  ...(input.layerGuard === undefined ? {} : {layerGuard: input.layerGuard}),
})

const hostSnapshot = (
  width: number,
  height: number,
): SurfaceHostSnapshot => Object.freeze({
  stableHostLogicalSize: Object.freeze({width, height}),
  isHostPrimaryDisplay: true,
  surfaceIdentity: Object.freeze({
    surfaceKey: 'PRIMARY',
    displayIndex: 0,
    surfaceForm: 'laptop',
    displayMode: 'PRIMARY',
  }),
})

const createHostSource = (initial: SurfaceHostSnapshot | null) => {
  let current = initial
  const listeners = new Set<(snapshot: SurfaceHostSnapshot | null) => void>()
  const source: SurfaceHostSource & Readonly<{
    readonly emit: (snapshot: SurfaceHostSnapshot | null) => void
  }> = {
    getSnapshot: () => current,
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit: snapshot => {
      current = snapshot
      for (const listener of [...listeners]) listener(snapshot)
    },
  }
  return source
}

describe('render surface hosts', () => {
  it('stamps each surface dispatch with its local route context', async () => {
    const source = createSource()
    const {logger} = createLogger()
    source.setRoot(rootWithContent(emptyContent()))
    source.setStatus('started')
    const command = defineCommand<Readonly<{}>>('test.surface-route', {name: 'run', visibility: 'internal'})
    const observed: Array<Readonly<{readonly displayMode?: unknown; readonly workspace?: unknown}>> = []
    const dispatchCommand: RenderProviderProps['dispatchCommand'] = async (_current, options) => {
      observed.push(options.routeContext ?? {})
      return {
        requestId: options.requestId ?? null,
        commandId: createCommandId(),
        status: 'completed',
        actorResults: [],
      }
    }
    const RouteProbe = ({label}: Readonly<{readonly label: string}>) => {
      const dispatch = useDispatchCommand()
      return createElement('surface-route-probe', {
        label,
        invoke: () => dispatch(command, {}),
      })
    }
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        ...unusedRenderProviderBindings,
        dispatchCommand,
        createRouteContext: (_root, displayMode) => ({
          displayMode,
          workspace: 'MAIN',
          instanceMode: 'MASTER',
        }),
      },
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
      }, createElement(RouteProbe, {label: 'primary'})),
      createElement(SurfaceRoot, {
        displayMode: 'SECONDARY',
        containerKey: 'root',
      }, createElement(RouteProbe, {label: 'secondary'})),
    ))

    const probes = renderer.root.findAllByType('surface-route-probe')
    expect(probes).toHaveLength(2)
    await act(async () => {
      await (probes[0]!.props.invoke as () => Promise<unknown>)()
      await (probes[1]!.props.invoke as () => Promise<unknown>)()
    })
    expect(observed).toEqual([
      {displayMode: 'PRIMARY', workspace: 'MAIN', instanceMode: 'MASTER'},
      {displayMode: 'SECONDARY', workspace: 'MAIN', instanceMode: 'MASTER'},
    ])
    renderer.unmount()
  })

  it('transfers the physical-index host fact without deriving it from display mode', () => {
    const source: SurfaceHostMeasurementSource = {
      getSnapshot: () => Object.freeze({
        stableHostLogicalSize: Object.freeze({width: 960, height: 540}),
        isHostPrimaryDisplay: true,
      }),
      subscribe: () => () => undefined,
    }
    const bound = bindSurfaceHostIdentity(source, {
      surfaceKey: 'PRIMARY',
      displayIndex: 0,
      surfaceForm: 'laptop',
      displayMode: 'SECONDARY',
    })

    expect(bound.getSnapshot()).toMatchObject({
      isHostPrimaryDisplay: true,
      surfaceIdentity: {
        surfaceKey: 'PRIMARY',
        displayIndex: 0,
        displayMode: 'SECONDARY',
      },
    })
  })

  it('reports a typed diagnostic when a host measurement contradicts its physical display identity', () => {
    const source: SurfaceHostMeasurementSource = {
      getSnapshot: () => Object.freeze({
        stableHostLogicalSize: Object.freeze({width: 960, height: 540}),
        isHostPrimaryDisplay: false,
      }),
      subscribe: () => () => undefined,
    }
    const rejections: SurfaceHostIdentityRejection[] = []
    const bound = bindSurfaceHostIdentity(source, {
      surfaceKey: 'PRIMARY',
      displayIndex: 0,
      surfaceForm: 'laptop',
      displayMode: 'PRIMARY',
    }, rejection => { rejections.push(rejection) })

    expect(bound.getSnapshot()).toBeNull()
    expect(rejections).toEqual([{
      reason: 'physical-host-flag-mismatch',
      displayIndex: 0,
      expectedIsHostPrimaryDisplay: true,
      actualIsHostPrimaryDisplay: false,
    }])
  })

  it('calculates independent scale axes from the stable host and canvas sizes', () => {
    const geometry = calculateSurfaceHostGeometry({
      canvas: {width: 960, height: 540},
      snapshot: hostSnapshot(800, 600),
    })

    expect(geometry).not.toBeNull()
    expect(geometry?.canvas).toEqual({width: 960, height: 540})
    expect(geometry?.host).toEqual({width: 800, height: 600})
    expect(geometry?.scaleX).toBeCloseTo(800 / 960)
    expect(geometry?.scaleY).toBeCloseTo(600 / 540)
    expect(geometry?.scaleX).not.toBe(geometry?.scaleY)
  })

  it('holds a fixed logical canvas inside the host viewport and does not pass host facts to children', () => {
    const source = createSource()
    const {logger} = createLogger()
    const host = createHostSource(hostSnapshot(800, 600))
    source.setRoot(rootWithContent(emptyContent()))
    source.setStatus('started')

    const renderer = mount(createElement(
      RenderProvider,
      {stateSource: source.stateSource, uiCatalog: createUiCatalog([]), rendererCatalog: createRendererCatalog([]), logger, ...unusedRenderProviderBindings},
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        canvas: {width: 960, height: 540},
        surfaceHostSource: host,
      }),
    ))

    const viewport = findByTestID(renderer, 'ui-base-render:surface-host-viewport')
    const canvas = findByTestID(renderer, 'ui-base-render:surface-host-canvas')
    expect(StyleSheet.flatten(viewport.props.style)).toMatchObject({flex: 1, overflow: 'hidden'})
    expect(StyleSheet.flatten(canvas.props.style)).toMatchObject({
      width: 960,
      height: 540,
      transformOrigin: 'top left',
    })
    expect((StyleSheet.flatten(canvas.props.style) as {readonly transform?: unknown}).transform).toEqual([
      {scaleX: 800 / 960},
      {scaleY: 600 / 540},
    ])
    expect(StyleSheet.flatten(canvas.props.style)).not.toHaveProperty('stableHostLogicalSize')
    renderer.unmount()
  })

  it('renders no canvas while a platform host is unavailable and clears stale state on unavailability', () => {
    const source = createSource()
    const {logger} = createLogger()
    const host = createHostSource(null)
    source.setRoot(rootWithContent(emptyContent()))
    source.setStatus('started')

    const renderer = mount(createElement(
      RenderProvider,
      {stateSource: source.stateSource, uiCatalog: createUiCatalog([]), rendererCatalog: createRendererCatalog([]), logger, ...unusedRenderProviderBindings},
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        canvas: {width: 960, height: 540},
        surfaceHostSource: host,
      }),
    ))

    expect(findByTestID(renderer, 'ui-base-render:surface-host-pending')).toBeDefined()
    expect(findByTestID(renderer, 'ui-base-render:surface-host-loading-indicator')).toBeDefined()
    expect(renderer.root.findAll(node => node.props.testID === 'ui-base-render:surface-host-canvas')).toHaveLength(0)

    act(() => host.emit(hostSnapshot(800, 600)))
    expect(findByTestID(renderer, 'ui-base-render:surface-host-canvas')).toBeDefined()

    act(() => host.emit(null))
    expect(findByTestID(renderer, 'ui-base-render:surface-host-pending')).toBeDefined()
    expect(renderer.root.findAll(node => node.props.testID === 'ui-base-render:surface-host-canvas')).toHaveLength(0)
    renderer.unmount()
  })

  it('turns an explicit PRIMARY host-unavailable terminal fact into the failure page', async () => {
    const source = createSource()
    const {logger} = createLogger()
    const identity = Object.freeze({
      surfaceKey: 'PRIMARY' as const,
      displayIndex: 0 as const,
      surfaceForm: 'laptop' as const,
      displayMode: 'PRIMARY' as const,
    })
    let availability: 'pending' | 'ready' | 'unavailable' = 'pending'
    let current: SurfaceHostSnapshot | null = null
    const snapshotListeners = new Set<(snapshot: SurfaceHostSnapshot | null) => void>()
    const availabilityListeners = new Set<(next: typeof availability) => void>()
    const host: SurfaceHostSource = {
      getSnapshot: () => current,
      subscribe: listener => {
        snapshotListeners.add(listener)
        return () => snapshotListeners.delete(listener)
      },
      getAvailability: () => availability,
      subscribeAvailability: listener => {
        availabilityListeners.add(listener)
        return () => availabilityListeners.delete(listener)
      },
      getSurfaceIdentity: () => identity,
    }
    const hiddenReasons: string[] = []
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason)
        return {hidden: true, alreadyHidden: false, reason}
      },
    }
    source.setRoot(rootWithContent(emptyContent()))
    source.setStatus('started')

    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        ...unusedRenderProviderBindings,
        nativeLoadingCapability,
      },
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        canvas: {width: 960, height: 540},
        surfaceHostSource: host,
      }),
    ))

    expect(findByTestID(renderer, 'ui-base-render:surface-host-pending')).toBeDefined()
    act(() => {
      availability = 'unavailable'
      current = null
      for (const listener of [...availabilityListeners]) listener(availability)
      for (const listener of [...snapshotListeners]) listener(current)
    })
    await act(async () => undefined)

    expect(findByTestID(renderer, 'ui-base-render:surface-host-failure')).toBeDefined()
    expect(findByTestID(renderer, 'ui.base.render:startup-failure')).toBeDefined()
    expect(hiddenReasons).toEqual(['startup-failure'])
    renderer.unmount()
  })

  it('keeps an empty PRIMARY container as visible content failure without a system page', async () => {
    const source = createSource()
    const {logger, events} = createLogger()
    const host = createHostSource(hostSnapshot(960, 540))
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => ({hidden: true, alreadyHidden: false, reason}),
    }
    source.setRoot(rootWithContent(emptyContent()))
    source.setStatus('started')

    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        ...unusedRenderProviderBindings,
        nativeLoadingCapability,
      },
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        canvas: {width: 960, height: 540},
        surfaceHostSource: host,
      }),
    ))

    await act(async () => undefined)
    expect(findByTestID(renderer, 'ui-base-render:fallback:container-empty')).toBeDefined()
    const fallback = findByTestID(renderer, 'ui-base-render:fallback:container-empty')
    expect(fallback.props.children).toContain('页面找不到')
    expect(renderer.root.findAll(node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0)
    expect(events.some(event => event.event === 'startup.failure-page-visible')).toBe(false)
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'ui.base.render',
        event: 'container-empty',
        data: {
          category: 'content',
          reason: 'container-empty',
          partKey: null,
          displayMode: 'PRIMARY',
          containerKey: 'root',
          surfaceForm: 'laptop',
        },
      }),
    ]))
    renderer.unmount()
  })

  it('keeps a configured integration default placement stable across unrelated root updates', () => {
    const source = createSource()
    const {logger} = createLogger()
    let screenRenderCount = 0
    const DefaultScreen: ComponentType<object> = props => {
      screenRenderCount += 1
      return createElement('render-screen', props)
    }
    const defined = part({partKey: 'default-screen-part', rendererKey: 'default-screen-renderer', component: DefaultScreen})
    const root = Object.freeze({
      ...rootWithContent(emptyContent()),
      'test.unrelated': Object.freeze({value: 1}),
    }) as RuntimeStateRoot
    source.setRoot(root)
    source.setStatus('started')
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([defined.catalogEntry]),
        rendererCatalog: createRendererCatalog([defined.rendererBinding]),
        logger,
        ...unusedRenderProviderBindings,
      },
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        defaultContainerPartKeys: {root: defined.catalogEntry.partKey},
      }),
    ))

    expect(renderer.root.findAllByType('render-screen')).toHaveLength(1)
    expect(screenRenderCount).toBe(1)
    expect(selectScreen(source.stateSource.getState(), 'PRIMARY', 'root')).toBeUndefined()

    act(() => {
      source.setRoot(Object.freeze({
        ...rootWithContent(emptyContent()),
        'test.unrelated': Object.freeze({value: 2}),
      }) as RuntimeStateRoot)
      source.notify()
    })

    expect(screenRenderCount).toBe(1)
    renderer.unmount()
  })

  it('passes one shrinkable content subtree through the frame seam', () => {
    const source = createSource()
    const {logger} = createLogger()
    const defined = part({partKey: 'frame-part', rendererKey: 'frame-renderer', component: Screen})
    const uiCatalog = createUiCatalog([defined.catalogEntry])
    const rendererCatalog = createRendererCatalog([defined.rendererBinding])
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {containers: {root: {partKey: 'frame-part'}}, layers: []},
        SECONDARY: {containers: {}, layers: []},
      },
    }))
    source.setStatus('started')
    let frameCalls = 0
    const renderer = mount(createElement(
      RenderProvider,
      {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        renderContentFrame: ({content}) => {
          frameCalls += 1
          return createElement('surface-frame', {testID: 'surface-frame'}, content, createElement('keyboard-dock'))
        },
      }),
    ))

    const frame = findByTestID(renderer, 'surface-frame')
    const frameProps = frame.props as Readonly<{readonly children: readonly ReactElement[] | ReactElement}>
    const frameChildren = Array.isArray(frameProps.children) ? frameProps.children : [frameProps.children]
    const content = frameChildren[0]!
    const contentProps = content.props as Readonly<{readonly style: unknown; readonly children: readonly unknown[]}>
    expect(frameCalls).toBe(1)
    expect(content.type).toBe(View)
    expect(StyleSheet.flatten(contentProps.style)).toMatchObject({flex: 1})
    expect(contentProps.children).toEqual(expect.arrayContaining([
      expect.objectContaining({type: ScreenContainer}),
      expect.objectContaining({type: LayerStack}),
    ]))
    expect(renderer.root.findByType('render-screen').props.marker).toBeUndefined()
    renderer.unmount()
  })

  it('notifies input consumers around the first and last layer focus boundary', () => {
    const source = createSource()
    const {logger} = createLogger()
    const defined = part({
      partKey: 'focus-boundary-layer',
      rendererKey: 'focus-boundary-layer-renderer',
      component: StandardLayer,
      layerTier: 'alert',
      layerGuard: 'dismissible',
      containerKeys: [],
    })
    const uiCatalog = createUiCatalog([defined.catalogEntry])
    const rendererCatalog = createRendererCatalog([defined.rendererBinding])
    const root = (layers: readonly object[]) => rootWithContent({
      contentSets: {
        PRIMARY: {containers: {}, layers},
        SECONDARY: {containers: {}, layers: []},
      },
    })
    source.setRoot(root([]))
    source.setStatus('started')
    const events: string[] = []
    const previousInput = {focus: vi.fn(() => { events.push('previous-focus') })}
    const layerFocusTargets = new Map<string, {focus: () => void}>()
    const renderer = mount(createElement(
      RenderProvider,
      {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        renderContentFrame: ({content}) => createElement(
          SurfaceFocusBoundaryContext.Provider,
          {value: phase => { events.push(phase) }},
          content,
        ),
      }),
    ), element => {
      const testID = (element.props as {readonly testID?: unknown}).testID
      if (typeof testID !== 'string' || !testID.startsWith('ui-base-render:layer:')) return {}
      const existing = layerFocusTargets.get(testID)
      if (existing !== undefined) return existing
      const target = {focus: () => { events.push('layer-focus') }}
      layerFocusTargets.set(testID, target)
      return target
    })

    const focusedInput = vi.spyOn(TextInput.State, 'currentlyFocusedInput')
      .mockReturnValue(previousInput as never)

    act(() => {
      source.setRoot(root([{layerId: 'focus-layer', partKey: 'focus-boundary-layer', openedAt: 1}]))
      source.notify()
    })
    expect(events).toEqual(['suspend', 'layer-focus'])

    act(() => {
      source.setRoot(root([
        {layerId: 'focus-layer', partKey: 'focus-boundary-layer', openedAt: 1},
        {layerId: 'focus-layer-2', partKey: 'focus-boundary-layer', openedAt: 2},
      ]))
      source.notify()
    })
    expect(events).toEqual(['suspend', 'layer-focus', 'layer-focus'])

    act(() => {
      source.setRoot(root([{layerId: 'focus-layer', partKey: 'focus-boundary-layer', openedAt: 1}]))
      source.notify()
    })
    expect(events).toEqual(['suspend', 'layer-focus', 'layer-focus', 'layer-focus'])

    act(() => {
      source.setRoot(root([]))
      source.notify()
    })
    expect(events).toEqual([
      'suspend', 'layer-focus', 'layer-focus', 'layer-focus', 'restore', 'previous-focus',
    ])
    focusedInput.mockRestore()
    renderer.unmount()
  })

  it('keeps explicit PRIMARY and SECONDARY surfaces on their own content sets', () => {
    const source = createSource()
    const {logger} = createLogger()
    const defined = part({partKey: 'surface-part', rendererKey: 'surface-renderer', component: Screen})
    const uiCatalog = createUiCatalog([defined.catalogEntry])
    const rendererCatalog = createRendererCatalog([defined.rendererBinding])
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {containers: {root: {partKey: 'surface-part', props: {marker: 'primary'}}}, layers: []},
        SECONDARY: {containers: {root: {partKey: 'surface-part', props: {marker: 'secondary'}}}, layers: []},
      },
    }))
    source.setStatus('started')

    const renderer = mount(createElement(
      RenderProvider,
      {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
      createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
      createElement(SurfaceRoot, {displayMode: 'SECONDARY', containerKey: 'root'}),
    ))
    const screens = renderer.root.findAllByType('render-screen')
    expect(screens.map(screen => screen.props.marker)).toEqual(['primary', 'secondary'])
    const screenContainers = renderer.root.findAll(node => node.type === View && node.props.testID === 'ui-base-render:screen-container')
    const layerStacks = renderer.root.findAll(node => node.type === View && node.props.testID === 'ui-base-render:layer-stack')
    expect(screenContainers).toHaveLength(2)
    expect(layerStacks).toHaveLength(2)
    expect(screenContainers.every(node => node.type === View)).toBe(true)
    expect(layerStacks.every(node => node.type === View)).toBe(true)
    expect(renderer.root.findAll(node => node.props.testID === 'ui-base-render:layer-backdrop')).toHaveLength(0)
    expect((StyleSheet.flatten(layerStacks[0].props.style) as {readonly position?: string}).position).toBe('absolute')
    renderer.unmount()
  })

  it('keeps diagnostic suppression local to each Provider', () => {
    const first = createSource()
    const second = createSource()
    const firstLogger = createLogger()
    const secondLogger = createLogger()
    const missing = part({
      partKey: 'provider-local-missing-renderer',
      rendererKey: 'provider-local-missing-renderer-binding',
      component: Screen,
    })
    const uiCatalog = createUiCatalog([missing.catalogEntry])
    const rendererCatalog = createRendererCatalog([])
    const content = {
      contentSets: {
        PRIMARY: {containers: {root: {partKey: 'provider-local-missing-renderer'}}, layers: []},
        SECONDARY: {containers: {}, layers: []},
      },
    }
    first.setRoot(rootWithContent(content))
    second.setRoot(rootWithContent(content))
    first.setStatus('started')
    second.setStatus('started')
    const provider = (source: FakeSource, logger: ReturnType<typeof createLogger>) => createElement(
      RenderProvider,
      {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger: logger.logger, ...unusedRenderProviderBindings},
      createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
    )

    const renderer = mount(createElement(
      'provider-diagnostic-root',
      null,
      provider(first, firstLogger),
      provider(second, secondLogger),
    ))
    expect(firstLogger.events.filter(event => event.event === 'missing-renderer')).toHaveLength(1)
    expect(secondLogger.events.filter(event => event.event === 'missing-renderer')).toHaveLength(1)
    renderer.unmount()
  })

  it('keeps transition and content failures as distinct typed fallback facts', () => {
    const source = createSource()
    const {logger} = createLogger()
    const uiCatalog = createUiCatalog([])
    const rendererCatalog = createRendererCatalog([])
    const renderer = mount(
      createElement(RenderProvider, {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
        createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'})),
    )
    const unavailable = findFallbacks(renderer)
    expect(unavailable.map(item => item.props.testID)).toEqual([
      'ui-base-render:fallback:runtime-not-started',
      'ui-base-render:fallback:runtime-not-started',
    ])

    act(() => {
      source.setRoot(rootWithContent(emptyContent()))
      source.setStatus('started')
      source.notify()
    })
    const empty = findFallbacks(renderer)
    expect(empty.map(item => item.props.testID)).toContain('ui-base-render:fallback:container-empty')
    expect(empty.map(item => item.props.testID)).not.toContain('ui-base-render:fallback:runtime-unavailable')
    renderer.unmount()
  })

  it('keeps runtime-not-started neutral on the target PRIMARY surface', () => {
    const source = createSource()
    const {logger} = createLogger()
    const host = createHostSource(hostSnapshot(800, 600))
    const hiddenReasons: string[] = []
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason)
        return {hidden: true, alreadyHidden: false, reason}
      },
    }
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        ...unusedRenderProviderBindings,
        nativeLoadingCapability,
      },
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        canvas: {width: 960, height: 540},
        surfaceHostSource: host,
      }),
    ))

    expect(findByTestID(renderer, 'ui-base-render:fallback:runtime-not-started')).toBeDefined()
    expect(renderer.root.findAll(node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0)
    expect(renderer.root.findAll(node => node.props.testID === 'ui.base.render:runtime-failure')).toHaveLength(0)
    expect(hiddenReasons).toEqual([])
    renderer.unmount()
  })

  it('resolves screen and layer through both catalogs and orders layers by tier/time/id', () => {
    const source = createSource()
    const {logger} = createLogger()
    const screenPart = part({partKey: 'surface-screen-part', rendererKey: 'surface-screen-renderer', component: Screen})
    const standard = part({partKey: 'standard-part', rendererKey: 'standard-renderer', component: StandardLayer, layerTier: 'standard', containerKeys: []})
    const alert = part({partKey: 'alert-part', rendererKey: 'alert-renderer', component: AlertLayer, layerTier: 'alert', containerKeys: []})
    const uiCatalog = createUiCatalog([screenPart.catalogEntry, standard.catalogEntry, alert.catalogEntry])
    const rendererCatalog = createRendererCatalog([screenPart.rendererBinding, standard.rendererBinding, alert.rendererBinding])
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {
          containers: {root: {partKey: 'surface-screen-part', props: {marker: 'screen'}}},
          layers: [
            {layerId: 'alert', partKey: 'alert-part', openedAt: 1, props: {marker: 'alert'}},
            {layerId: 'standard-late', partKey: 'standard-part', openedAt: 3, props: {marker: 'standard-late'}},
            {layerId: 'standard-z', partKey: 'standard-part', openedAt: 1, props: {marker: 'standard-z'}},
            {layerId: 'standard-a', partKey: 'standard-part', openedAt: 1, props: {marker: 'standard-a'}},
          ],
        },
        SECONDARY: {containers: {}, layers: []},
      },
    }))
    source.setStatus('started')
    const renderer = mount(createElement(
      RenderProvider,
      {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
      createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
    ))
    expect(renderer.root.findByType('render-screen').props.marker).toBe('screen')
    expect(renderer.root.findAllByType('render-layer').map(layer => layer.props.marker)).toEqual([
      'standard-a',
      'standard-z',
      'standard-late',
      'alert',
    ])
    const layerStack = findByTestID(renderer, 'ui-base-render:layer-stack')
    expect(findByTestID(renderer, 'ui-base-render:layer-backdrop')).toBeDefined()
    const layerStackStyle = StyleSheet.flatten(layerStack.props.style)
    expect(layerStackStyle).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 1000,
      elevation: 1000,
    })
    expect(layerStackStyle).not.toHaveProperty('alignItems')
    expect(layerStackStyle).not.toHaveProperty('justifyContent')
    expect(layerStackStyle).not.toHaveProperty('padding')
    expect(layerStack.props.pointerEvents).toBe('box-none')
    const layerSurfaces = renderer.root.findAll(node =>
      node.type === View
      && typeof node.props.testID === 'string'
      && node.props.testID.startsWith('ui-base-render:layer:'),
    )
    expect(layerSurfaces).toHaveLength(4)
    const layerStyle = StyleSheet.flatten(layerSurfaces[0]!.props.style)
    expect(layerStyle).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })
    expect(layerStyle).not.toHaveProperty('alignItems')
    expect(layerStyle).not.toHaveProperty('justifyContent')
    expect(layerStyle).not.toHaveProperty('padding')
    renderer.unmount()
  })

  it('enforces decisive guards for backdrop and Android back without dispatching close', () => {
    const source = createSource()
    const {logger} = createLogger()
    const defined = part({
      partKey: 'decisive-layer-part',
      rendererKey: 'decisive-layer-renderer',
      component: StandardLayer,
      layerTier: 'alert',
      layerGuard: 'decisive',
      containerKeys: [],
    })
    const uiCatalog = createUiCatalog([defined.catalogEntry])
    const rendererCatalog = createRendererCatalog([defined.rendererBinding])
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {
          containers: {},
          layers: [{layerId: 'decisive', partKey: 'decisive-layer-part', openedAt: 1, props: {marker: 'decisive'}}],
        },
        SECONDARY: {containers: {}, layers: []},
      },
    }))
    source.setStatus('started')

    const dispatches: string[] = []
    const dispatchCommand: RenderProviderProps['dispatchCommand'] = async command => {
      dispatches.push(command.definition.commandName)
      throw new Error('test dispatch rejection')
    }
    const backHandlers: BackPressHandler[] = []
    const addBackHandler = vi.spyOn(BackHandler, 'addEventListener')
    addBackHandler.mockImplementation((_eventName, handler) => {
      backHandlers.push(handler)
      return {remove: () => undefined} as ReturnType<typeof BackHandler.addEventListener>
    })

    const renderer = mount(createElement(
      RenderProvider,
      {...unusedRenderProviderBindings, stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, dispatchCommand},
      createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
    ))
    act(() => {
      const onPress = findByTestID(renderer, 'ui-base-render:layer-backdrop').props.onPress
      if (typeof onPress !== 'function') throw new Error('layer backdrop must be pressable')
      onPress()
    })
    expect(dispatches).toEqual([])
    expect(backHandlers).toHaveLength(1)
    expect(backHandlers[0]!({type: 'hardwareBackPress', timeStamp: 0})).toBe(true)
    expect(dispatches).toEqual([])
    renderer.unmount()
    addBackHandler.mockRestore()
  })

  it('lets dismissible guards close through backdrop and Android back', async () => {
    const source = createSource()
    const {logger} = createLogger()
    const defined = part({
      partKey: 'dismissible-layer-part',
      rendererKey: 'dismissible-layer-renderer',
      component: StandardLayer,
      layerTier: 'standard',
      layerGuard: 'dismissible',
      containerKeys: [],
    })
    const uiCatalog = createUiCatalog([defined.catalogEntry])
    const rendererCatalog = createRendererCatalog([defined.rendererBinding])
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {
          containers: {},
          layers: [{layerId: 'dismissible', partKey: 'dismissible-layer-part', openedAt: 1, props: {marker: 'dismissible'}}],
        },
        SECONDARY: {containers: {}, layers: []},
      },
    }))
    source.setStatus('started')

    const dispatches: string[] = []
    const featureDismissCommand = defineCommand<Readonly<Record<string, never>>>('ui.feature.test', {
      name: 'dismiss-layer',
      visibility: 'public',
    })
    const dispatchCommand: RenderProviderProps['dispatchCommand'] = async command => {
      dispatches.push(command.definition.commandName)
      throw new Error('test dispatch rejection')
    }
    const backHandlers: BackPressHandler[] = []
    const addBackHandler = vi.spyOn(BackHandler, 'addEventListener')
    addBackHandler.mockImplementation((_eventName, handler) => {
      backHandlers.push(handler)
      return {remove: () => undefined} as ReturnType<typeof BackHandler.addEventListener>
    })

    const renderer = mount(createElement(
      RenderProvider,
      {
        ...unusedRenderProviderBindings,
        stateSource: source.stateSource,
        uiCatalog,
        rendererCatalog,
        logger,
        dispatchCommand,
        layerDismissals: {
          'dismissible-layer-part': ({dispatchCommand: dispatch}) => dispatchWithRequestId({
            dispatchCommand: dispatch,
            definition: featureDismissCommand,
            payload: {},
          }),
        },
      },
      createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
    ))
    await act(async () => {
      const onPress = findByTestID(renderer, 'ui-base-render:layer-backdrop').props.onPress
      if (typeof onPress !== 'function') throw new Error('layer backdrop must be pressable')
      onPress()
      await Promise.resolve()
    })
    expect(dispatches).toEqual(['ui.feature.test.dismiss-layer'])
    await act(async () => {
      expect(backHandlers[0]!({type: 'hardwareBackPress', timeStamp: 0})).toBe(true)
      await Promise.resolve()
    })
    expect(dispatches).toEqual(['ui.feature.test.dismiss-layer', 'ui.feature.test.dismiss-layer'])
    renderer.unmount()
    addBackHandler.mockRestore()
  })

  it('moves focus into the top layer and restores the prior input after the last layer closes', () => {
    const source = createSource()
    const {logger} = createLogger()
    const defined = part({
      partKey: 'focus-layer-part',
      rendererKey: 'focus-layer-renderer',
      component: StandardLayer,
      layerTier: 'standard',
      layerGuard: 'dismissible',
      containerKeys: [],
    })
    const uiCatalog = createUiCatalog([defined.catalogEntry])
    const rendererCatalog = createRendererCatalog([defined.rendererBinding])
    source.setRoot(rootWithContent(emptyContent()))
    source.setStatus('started')

    const previousInput = {focus: vi.fn()}
    const layerFocusTarget = {focus: vi.fn()}
    const focusedInput = vi.spyOn(TextInput.State, 'currentlyFocusedInput')
      .mockReturnValue(previousInput as never)
    const renderer = mount(
      createElement(
        RenderProvider,
        {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
        createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
      ),
      element => (element.props as {readonly testID?: string}).testID === 'ui-base-render:layer:focus-layer'
        ? layerFocusTarget
        : {},
    )

    act(() => {
      source.setRoot(rootWithContent({
        contentSets: {
          PRIMARY: {
            containers: {},
            layers: [{layerId: 'focus-layer', partKey: 'focus-layer-part', openedAt: 1, props: {marker: 'focus'}}],
          },
          SECONDARY: {containers: {}, layers: []},
        },
      }))
      source.notify()
    })
    expect(layerFocusTarget.focus).toHaveBeenCalledTimes(1)

    act(() => {
      source.setRoot(rootWithContent(emptyContent()))
      source.notify()
    })
    expect(previousInput.focus).toHaveBeenCalledTimes(1)
    focusedInput.mockRestore()
    renderer.unmount()
  })

  it('keeps a layer focusable without a prior input focus', () => {
    const source = createSource()
    const {logger} = createLogger()
    const defined = part({
      partKey: 'focus-without-input-part',
      rendererKey: 'focus-without-input-renderer',
      component: StandardLayer,
      layerTier: 'standard',
      layerGuard: 'dismissible',
      containerKeys: [],
    })
    const uiCatalog = createUiCatalog([defined.catalogEntry])
    const rendererCatalog = createRendererCatalog([defined.rendererBinding])
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {
          containers: {},
          layers: [{layerId: 'focus-without-input', partKey: 'focus-without-input-part', openedAt: 1}],
        },
        SECONDARY: {containers: {}, layers: []},
      },
    }))
    source.setStatus('started')
    const focusedInput = vi.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(undefined as never)
    const layerFocusTarget = {focus: vi.fn()}
    const renderer = mount(
      createElement(
        RenderProvider,
        {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
        createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
      ),
      element => (element.props as {readonly testID?: string}).testID === 'ui-base-render:layer:focus-without-input'
        ? layerFocusTarget
        : {},
    )
    expect(layerFocusTarget.focus).toHaveBeenCalledTimes(1)
    act(() => {
      source.setRoot(rootWithContent(emptyContent()))
      source.notify()
    })
    expect(() => renderer.unmount()).not.toThrow()
    focusedInput.mockRestore()
  })

  it('reports missing catalog, missing renderer, and invalid props on screen and layer paths', () => {
    const source = createSource()
    const {logger, events} = createLogger()
    const valid = part({partKey: 'valid-part', rendererKey: 'valid-renderer', component: Screen})
    const missingRenderer = part({partKey: 'missing-renderer-part', rendererKey: 'not-installed', component: Screen, containerKeys: []})
    let businessCalls = 0
    const CountingScreen: ComponentType<object> = props => {
      businessCalls += 1
      return createElement('render-counted-screen', props)
    }
    const counted = part({partKey: 'counted-part', rendererKey: 'counted-renderer', component: CountingScreen})
    const countedLayer = part({
      partKey: 'counted-layer-part',
      rendererKey: 'counted-layer-renderer',
      component: CountingScreen,
      containerKeys: [],
    })
    const screenMissingRenderer = part({partKey: 'screen-missing-renderer-part', rendererKey: 'screen-not-installed', component: Screen})
    const fullUiCatalog = createUiCatalog([
      valid.catalogEntry,
      missingRenderer.catalogEntry,
      counted.catalogEntry,
      countedLayer.catalogEntry,
      screenMissingRenderer.catalogEntry,
    ])
    const fullRendererCatalog = createRendererCatalog([
      valid.rendererBinding,
      counted.rendererBinding,
      countedLayer.rendererBinding,
    ])
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {
          containers: {root: {partKey: 'missing-catalog-part'}},
          layers: [
            {layerId: 'missing-catalog-layer', partKey: 'missing-catalog-layer-part', openedAt: 1},
            {layerId: 'missing-renderer-layer', partKey: 'missing-renderer-part', openedAt: 2},
            {layerId: 'invalid-props-layer', partKey: 'valid-part', openedAt: 3, props: []},
          ],
        },
        SECONDARY: {containers: {}, layers: []},
      },
    }))
    source.setStatus('started')
    const renderer = mount(createElement(
      RenderProvider,
      {stateSource: source.stateSource, uiCatalog: fullUiCatalog, rendererCatalog: fullRendererCatalog, logger, ...unusedRenderProviderBindings},
      createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
    ))
    expect(findFallbacks(renderer).map(item => item.props.testID)).toContain('ui-base-render:fallback:missing-catalog-entry')
    expect(findFallbacks(renderer).map(item => item.props.testID)).toContain('ui-base-render:fallback:missing-renderer')
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'ui.base.render',
        event: 'missing-catalog-entry',
        data: {
          category: 'content',
          reason: 'missing-catalog-entry',
          partKey: 'missing-catalog-part',
          displayMode: 'PRIMARY',
          containerKey: 'root',
          surfaceForm: 'laptop',
        },
      }),
      expect.objectContaining({
        category: 'ui.base.render',
        event: 'missing-catalog-entry',
        data: {
          category: 'content',
          reason: 'missing-catalog-entry',
          partKey: 'missing-catalog-layer-part',
          displayMode: 'PRIMARY',
          containerKey: null,
          surfaceForm: 'laptop',
        },
      }),
      expect.objectContaining({
        category: 'ui.base.render',
        event: 'missing-renderer',
        data: {
          category: 'system',
          reason: 'missing-renderer',
          partKey: 'missing-renderer-part',
          displayMode: 'PRIMARY',
          rendererKey: 'not-installed',
        },
      }),
    ]))

    const invalidRoot = rootWithContent({
      contentSets: {
        PRIMARY: {
          containers: {root: {partKey: 'counted-part', props: 'invalid'}},
          layers: [{layerId: 'invalid-layer', partKey: 'counted-layer-part', openedAt: 1, props: []}],
        },
        SECONDARY: {containers: {}, layers: []},
      },
    })
    act(() => {
      source.setRoot(invalidRoot)
      source.notify()
    })
    expect(renderer.root.findAllByType('render-counted-screen')).toHaveLength(0)
    expect(findFallbacks(renderer).map(item => item.props.testID)).toContain('ui-base-render:fallback:invalid-props')
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'ui.base.render',
        event: 'invalid-props-shape',
        data: {
          category: 'content',
          reason: 'invalid-props',
          partKey: 'counted-part',
          displayMode: 'PRIMARY',
          containerKey: 'root',
          surfaceForm: 'laptop',
          valueType: 'string',
        },
      }),
      expect.objectContaining({
        category: 'ui.base.render',
        event: 'invalid-props-shape',
        data: {
          category: 'content',
          reason: 'invalid-props',
          partKey: 'counted-layer-part',
          displayMode: 'PRIMARY',
          containerKey: null,
          surfaceForm: 'laptop',
          valueType: 'array',
        },
      }),
    ]))

    const screenMissingRendererRoot = rootWithContent({
      contentSets: {
        PRIMARY: {
          containers: {root: {partKey: 'screen-missing-renderer-part'}},
          layers: [],
        },
        SECONDARY: {containers: {}, layers: []},
      },
    })
    act(() => {
      source.setRoot(screenMissingRendererRoot)
      source.notify()
    })
    expect(findFallbacks(renderer).map(item => item.props.testID)).toContain('ui-base-render:fallback:missing-renderer')
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'ui.base.render',
        event: 'missing-renderer',
        data: {
          category: 'system',
          reason: 'missing-renderer',
          partKey: 'screen-missing-renderer-part',
          displayMode: 'PRIMARY',
          rendererKey: 'screen-not-installed',
        },
      }),
    ]))
    renderer.unmount()
    expect(businessCalls).toBe(0)
  })

  it('treats a missing catalog entry as visible content failure and PRIMARY readiness', async () => {
    const source = createSource()
    const {logger} = createLogger()
    const host = createHostSource(hostSnapshot(800, 600))
    const readyInputs: Array<Readonly<{readonly readyPartKey: string | null; readonly contentFailure: string | null}>> = []
    const hiddenReasons: string[] = []
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason)
        return {hidden: true, alreadyHidden: false, reason}
      },
    }
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {containers: {root: {partKey: 'missing-content-part'}}, layers: []},
        SECONDARY: {containers: {}, layers: []},
      },
    }))
    source.setStatus('started')
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        ...unusedRenderProviderBindings,
        nativeLoadingCapability,
        onPrimarySurfaceReady: input => {
          readyInputs.push({readyPartKey: input.readyPartKey, contentFailure: input.contentFailure})
        },
      },
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        canvas: {width: 960, height: 540},
        surfaceHostSource: host,
      }),
    ))

    expect(findByTestID(renderer, 'ui-base-render:fallback:missing-catalog-entry').props.children).toContain('页面找不到')
    expect(renderer.root.findAll(node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0)
    const boundary = findByTestID(renderer, 'ui-base-render:screen-ready-boundary')
    await act(async () => {
      boundary.props.onLayout({nativeEvent: {layout: {width: 800, height: 600}}})
    })
    expect(readyInputs).toEqual([{readyPartKey: 'missing-content-part', contentFailure: 'missing-catalog-entry'}])
    expect(hiddenReasons).toEqual(['startup-ready'])
    renderer.unmount()
  })

  it('reports an incompatible catalog entry as visible content failure and PRIMARY ready', async () => {
    const source = createSource()
    const {logger, events} = createLogger()
    const host = createHostSource(hostSnapshot(800, 600))
    const incompatible = part({
      partKey: 'incompatible-screen-part',
      rendererKey: 'incompatible-screen-renderer',
      component: Screen,
      surfaceForm: ['mobile'],
    })
    const readyInputs: Array<Readonly<{
      readonly readyPartKey: string | null
      readonly contentFailure: string | null
    }>> = []
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => ({hidden: true, alreadyHidden: false, reason}),
    }
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {containers: {root: {partKey: incompatible.catalogEntry.partKey}}, layers: []},
        SECONDARY: {containers: {}, layers: []},
      },
    }))
    source.setStatus('started')

    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([incompatible.catalogEntry]),
        rendererCatalog: createRendererCatalog([incompatible.rendererBinding]),
        logger,
        ...unusedRenderProviderBindings,
        nativeLoadingCapability,
        onPrimarySurfaceReady: input => {
          readyInputs.push({readyPartKey: input.readyPartKey, contentFailure: input.contentFailure})
        },
      },
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        canvas: {width: 960, height: 540},
        surfaceHostSource: host,
      }),
    ))

    const fallback = findByTestID(renderer, 'ui-base-render:fallback:incompatible-catalog-entry')
    expect(fallback.props.children).toContain('页面找不到')
    expect(fallback.props.children).toContain('incompatible-screen-part')
    expect(fallback.props.children).toContain('laptop')
    expect(renderer.root.findAll(node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0)
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: 'incompatible-catalog-entry',
        data: {
          category: 'content',
          reason: 'incompatible-catalog-entry',
          partKey: 'incompatible-screen-part',
          displayMode: 'PRIMARY',
          containerKey: 'root',
          surfaceForm: 'laptop',
        },
      }),
    ]))

    const boundary = findByTestID(renderer, 'ui-base-render:screen-ready-boundary')
    await act(async () => {
      boundary.props.onLayout({nativeEvent: {layout: {width: 800, height: 600}}})
    })
    expect(readyInputs).toEqual([{
      readyPartKey: 'incompatible-screen-part',
      contentFailure: 'incompatible-catalog-entry',
    }])
    renderer.unmount()
  })

  it('does not collide diagnostic identities when keys contain separators', () => {
    const {logger, events} = createLogger()
    const reporter = createRenderPartDiagnosticReporter(logger)
    reporter.report({
      event: 'missing-renderer',
      data: {
        category: 'system',
        reason: 'missing-renderer',
        partKey: 'part|PRIMARY',
        displayMode: 'PRIMARY',
        rendererKey: 'renderer',
      },
    })
    reporter.report({
      event: 'missing-renderer',
      data: {
        category: 'system',
        reason: 'missing-renderer',
        partKey: 'part',
        displayMode: 'PRIMARY',
        rendererKey: 'PRIMARY|renderer',
      },
    })
    expect(events).toHaveLength(2)
  })

  it('reports the same diagnostic again after content recovers', () => {
    const source = createSource()
    const {logger, events} = createLogger()
    const defined = part({
      partKey: 'recoverable-part',
      rendererKey: 'recoverable-renderer',
      component: Screen,
    })
    const uiCatalog = createUiCatalog([defined.catalogEntry])
    const missingRendererCatalog = createRendererCatalog([])
    const installedRendererCatalog = createRendererCatalog([defined.rendererBinding])
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {containers: {root: {partKey: 'recoverable-part'}}, layers: []},
        SECONDARY: {containers: {}, layers: []},
      },
    }))
    source.setStatus('started')

    const render = (rendererCatalog: ReturnType<typeof createRendererCatalog>) => createElement(
      RenderProvider,
      {stateSource: source.stateSource, uiCatalog, rendererCatalog, logger, ...unusedRenderProviderBindings},
      createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
    )
    const renderer = mount(render(missingRendererCatalog))
    const missingRendererEvents = () => events.filter(event => event.event === 'missing-renderer')
    expect(missingRendererEvents()).toHaveLength(1)

    act(() => {
      renderer.update(render(installedRendererCatalog))
    })
    expect(missingRendererEvents()).toHaveLength(1)

    act(() => {
      renderer.update(render(missingRendererCatalog))
    })
    expect(missingRendererEvents()).toHaveLength(2)
    renderer.unmount()
  })

  it('hides native loading only after the real PRIMARY part and host geometry lay out', async () => {
    const source = createSource()
    const {logger} = createLogger()
    const host = createHostSource(hostSnapshot(800, 600))
    const defined = part({partKey: 'ready-part', rendererKey: 'ready-renderer', component: Screen})
    const hiddenReasons: string[] = []
    const readyParts: Array<string | null> = []
    const lifecycle: string[] = []
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        lifecycle.push('hide')
        hiddenReasons.push(reason)
        return {hidden: true, alreadyHidden: false, reason}
      },
    }
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {containers: {root: {partKey: 'ready-part'}}, layers: []},
        SECONDARY: {containers: {}, layers: []},
      },
    }))
    source.setStatus('started')

    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([defined.catalogEntry]),
        rendererCatalog: createRendererCatalog([defined.rendererBinding]),
        logger,
        ...unusedRenderProviderBindings,
        nativeLoadingCapability,
        onPrimarySurfaceReady: ({readyPartKey}) => {
          lifecycle.push('ready-callback')
          readyParts.push(readyPartKey)
        },
      },
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        canvas: {width: 960, height: 540},
        surfaceHostSource: host,
      }),
    ))

    expect(hiddenReasons).toEqual([])
    const boundary = findByTestID(renderer, 'ui-base-render:screen-ready-boundary')
    await act(async () => {
      boundary.props.onLayout({nativeEvent: {layout: {width: 800, height: 600}}})
    })
    expect(hiddenReasons).toEqual(['startup-ready'])
    expect(readyParts).toEqual(['ready-part'])
    expect(lifecycle).toEqual(['ready-callback', 'hide'])
    renderer.unmount()
  })

  it('keeps a content failure ready before a later system failure uses the runtime variant', async () => {
    const source = createSource()
    const {logger, events} = createLogger()
    const host = createHostSource(hostSnapshot(800, 600))
    const defined = part({partKey: 'content-ready-part', rendererKey: 'content-ready-renderer', component: Screen})
    const hiddenReasons: string[] = []
    const readyInputs: Array<{
      readonly readyPartKey: string | null
      readonly contentFailure: string | null
    }> = []
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason)
        return {hidden: true, alreadyHidden: false, reason}
      },
    }
    const uiCatalog = createUiCatalog([defined.catalogEntry])
    const rendererCatalog = createRendererCatalog([defined.rendererBinding])
    const render = (
      currentRendererCatalog: ReturnType<typeof createRendererCatalog> = rendererCatalog,
    ) => createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog,
        rendererCatalog: currentRendererCatalog,
        logger,
        ...unusedRenderProviderBindings,
        nativeLoadingCapability,
        onPrimarySurfaceReady: input => {
          readyInputs.push({
            readyPartKey: input.readyPartKey,
            contentFailure: input.contentFailure,
          })
        },
      },
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        canvas: {width: 960, height: 540},
        surfaceHostSource: host,
      }),
    )

    source.setRoot(rootWithContent(emptyContent()))
    source.setStatus('started')
    const renderer = mount(render())
    expect(findByTestID(renderer, 'ui-base-render:fallback:container-empty').props.children).toContain('页面找不到')
    expect(renderer.root.findAll(node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0)

    const contentBoundary = findByTestID(renderer, 'ui-base-render:screen-ready-boundary')
    await act(async () => {
      contentBoundary.props.onLayout({nativeEvent: {layout: {width: 800, height: 600}}})
    })
    expect(readyInputs).toEqual([{
      readyPartKey: null,
      contentFailure: 'container-empty',
    }])
    expect(hiddenReasons).toEqual(['startup-ready'])

    act(() => {
      source.setRoot(rootWithContent({
        contentSets: {
          PRIMARY: {containers: {root: {partKey: 'content-ready-part'}}, layers: []},
          SECONDARY: {containers: {}, layers: []},
        },
      }))
      source.notify()
      renderer.update(render(createRendererCatalog([])))
    })
    await act(async () => undefined)
    expect(findByTestID(renderer, 'ui.base.render:runtime-failure')).toBeDefined()
    expect(findByTestID(renderer, 'ui.base.render:runtime-failure:title').props.children).toBe('终端运行异常')
    expect(renderer.root.findAll(node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0)
    expect(events.some(event => event.event === 'startup.failure-page-visible')).toBe(true)
    renderer.unmount()

    const beforeReadySource = createSource()
    beforeReadySource.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {containers: {root: {partKey: 'content-ready-part'}}, layers: []},
        SECONDARY: {containers: {}, layers: []},
      },
    }))
    beforeReadySource.setStatus('started')
    const beforeReadyRenderer = mount(createElement(
      RenderProvider,
      {
        stateSource: beforeReadySource.stateSource,
        uiCatalog,
        rendererCatalog: createRendererCatalog([]),
        logger,
        ...unusedRenderProviderBindings,
        nativeLoadingCapability,
      },
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        canvas: {width: 960, height: 540},
        surfaceHostSource: host,
      }),
    ))
    expect(findByTestID(beforeReadyRenderer, 'ui.base.render:startup-failure')).toBeDefined()
    expect(findByTestID(beforeReadyRenderer, 'ui.base.render:startup-failure:title').props.children).toBe('终端启动失败')
    beforeReadyRenderer.unmount()
  })

  it('does not treat an outer root or a fallback branch as rendered readiness', async () => {
    const source = createSource()
    const {logger} = createLogger()
    const host = createHostSource(hostSnapshot(800, 600))
    const defined = part({partKey: 'missing-renderer-part', rendererKey: 'missing-renderer', component: Screen})
    const hiddenReasons: string[] = []
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason)
        return {hidden: true, alreadyHidden: false, reason}
      },
    }
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {containers: {root: {partKey: 'missing-renderer-part'}}, layers: []},
        SECONDARY: {containers: {}, layers: []},
      },
    }))
    source.setStatus('started')

    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([defined.catalogEntry]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        ...unusedRenderProviderBindings,
        nativeLoadingCapability,
      },
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        canvas: {width: 960, height: 540},
        surfaceHostSource: host,
      }),
    ))

    const root = findByTestID(renderer, 'ui-base-render:surface-root')
    await act(async () => {
      root.props.onLayout({nativeEvent: {layout: {width: 800, height: 600}}})
    })
    expect(hiddenReasons).toEqual(['startup-failure'])
    expect(renderer.root.findByProps({testID: 'ui-base-render:fallback:missing-renderer'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'ui.base.render:startup-failure'})).toBeDefined()
    expect(renderer.root.findAllByProps({testID: 'ui-base-render:screen-ready-boundary'})).toHaveLength(0)
    renderer.unmount()
  })

  it('keeps a system failure neutral on the SECONDARY physical surface', async () => {
    const source = createSource()
    const {logger} = createLogger()
    const secondaryHost = createHostSource(Object.freeze({
      stableHostLogicalSize: Object.freeze({width: 800, height: 600}),
      isHostPrimaryDisplay: false,
      surfaceIdentity: Object.freeze({
        surfaceKey: 'SECONDARY' as const,
        displayIndex: 1 as const,
        surfaceForm: 'laptop' as const,
        displayMode: 'SECONDARY' as const,
      }),
    }))
    const missingRenderer = part({
      partKey: 'secondary-missing-renderer-part',
      rendererKey: 'secondary-missing-renderer',
      component: Screen,
    })
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {containers: {}, layers: []},
        SECONDARY: {containers: {root: {partKey: missingRenderer.catalogEntry.partKey}}, layers: []},
      },
    }))
    source.setStatus('started')
    const hiddenReasons: string[] = []
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason)
        return {hidden: true, alreadyHidden: false, reason}
      },
    }
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([missingRenderer.catalogEntry]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        ...unusedRenderProviderBindings,
        nativeLoadingCapability,
      },
      createElement(SurfaceRoot, {
        displayMode: 'SECONDARY',
        containerKey: 'root',
        surfaceHostSource: secondaryHost,
      }),
    ))

    expect(findByTestID(renderer, 'ui-base-render:fallback:missing-renderer')).toBeDefined()
    expect(renderer.root.findAll(node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0)
    expect(renderer.root.findAll(node => node.props.testID === 'ui.base.render:runtime-failure')).toHaveLength(0)
    expect(hiddenReasons).toEqual([])
    renderer.unmount()
  })

  it('keeps a content failure visible on SECONDARY without reporting PRIMARY readiness', async () => {
    const source = createSource()
    const {logger} = createLogger()
    const secondaryHost = createHostSource(Object.freeze({
      stableHostLogicalSize: Object.freeze({width: 800, height: 600}),
      isHostPrimaryDisplay: false,
      surfaceIdentity: Object.freeze({
        surfaceKey: 'SECONDARY' as const,
        displayIndex: 1 as const,
        surfaceForm: 'laptop' as const,
        displayMode: 'SECONDARY' as const,
      }),
    }))
    const incompatible = part({
      partKey: 'secondary-content-part',
      rendererKey: 'secondary-content-renderer',
      component: Screen,
      surfaceForm: ['mobile'] as const,
    })
    const readyInputs: unknown[] = []
    const hiddenReasons: string[] = []
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason)
        return {hidden: true, alreadyHidden: false, reason}
      },
    }
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {containers: {}, layers: []},
        SECONDARY: {containers: {root: {partKey: incompatible.catalogEntry.partKey}}, layers: []},
      },
    }))
    source.setStatus('started')
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([incompatible.catalogEntry]),
        rendererCatalog: createRendererCatalog([incompatible.rendererBinding]),
        logger,
        ...unusedRenderProviderBindings,
        nativeLoadingCapability,
        onPrimarySurfaceReady: input => { readyInputs.push(input) },
      },
      createElement(SurfaceRoot, {
        displayMode: 'SECONDARY',
        containerKey: 'root',
        surfaceHostSource: secondaryHost,
      }),
    ))

    expect(findByTestID(renderer, 'ui-base-render:fallback:incompatible-catalog-entry')).toBeDefined()
    expect(findByTestID(renderer, 'ui-base-render:fallback:incompatible-catalog-entry').props.children).toContain('页面找不到')
    expect(renderer.root.findAll(node => node.props.testID === 'ui.base.render:startup-failure')).toHaveLength(0)
    expect(renderer.root.findAll(node => node.props.testID === 'ui.base.render:runtime-failure')).toHaveLength(0)
    expect(readyInputs).toHaveLength(0)
    expect(hiddenReasons).toEqual([])
    renderer.unmount()
  })

  it('keeps content failure visible without native readiness when no physical host is attached', () => {
    const source = createSource()
    const {logger} = createLogger()
    const missing = part({partKey: 'hostless-content-part', rendererKey: 'hostless-content-renderer', component: Screen})
    const readyInputs: unknown[] = []
    const hiddenReasons: string[] = []
    const nativeLoadingCapability = {
      targetPhysicalSurface: {surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const},
      hideOnce: async (reason: string) => {
        hiddenReasons.push(reason)
        return {hidden: true, alreadyHidden: false, reason}
      },
    }
    source.setRoot(rootWithContent({
      contentSets: {
        PRIMARY: {containers: {root: {partKey: 'hostless-missing-part'}}, layers: []},
        SECONDARY: {containers: {}, layers: []},
      },
    }))
    source.setStatus('started')
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([missing.catalogEntry]),
        rendererCatalog: createRendererCatalog([missing.rendererBinding]),
        logger,
        ...unusedRenderProviderBindings,
        nativeLoadingCapability,
        onPrimarySurfaceReady: input => { readyInputs.push(input) },
      },
      createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
    ))

    expect(findByTestID(renderer, 'ui-base-render:fallback:missing-catalog-entry')).toBeDefined()
    expect(readyInputs).toEqual([])
    expect(hiddenReasons).toEqual([])
    renderer.unmount()
  })
})
