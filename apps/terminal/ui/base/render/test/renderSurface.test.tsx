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
import type {Runtime} from '@catering-v2s/kernel-base-runtime'
import {
  createRendererCatalog,
  definePart,
  LayerStack,
  RenderProvider,
  ScreenContainer,
  SurfaceFocusBoundaryContext,
  SurfaceRoot,
  calculateSurfaceHostImeInset,
  calculateSurfaceHostGeometry,
  useSurfaceHostImeInset,
  type SurfaceHostSnapshot,
  type SurfaceHostSource,
  type RenderProviderProps,
} from '../src/index'
import {createUiCatalog} from '@catering-v2s/kernel-base-ui-state'
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
}>) => definePart({
  partKey: input.partKey,
  rendererKey: input.rendererKey,
  containerKeys: input.containerKeys ?? ['root'],
  displayModes: ['PRIMARY', 'SECONDARY'] as const,
  workspaces: ['MAIN'] as const,
  instanceModes: ['MASTER'] as const,
  title: input.partKey,
  description: input.partKey,
  component: input.component,
  ...(input.layerTier === undefined ? {} : {layerTier: input.layerTier}),
  ...(input.layerGuard === undefined ? {} : {layerGuard: input.layerGuard}),
})

const hostSnapshot = (
  width: number,
  height: number,
  ime?: SurfaceHostSnapshot['ime'],
): SurfaceHostSnapshot => Object.freeze({
  stableHostLogicalSize: Object.freeze({width, height}),
  ...(ime === undefined ? {} : {ime}),
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
  it('converts the target-window IME inset through the vertical canvas scale only', () => {
    expect(calculateSurfaceHostImeInset({
      ime: {visible: true, bottomLogicalBeforeCanvasScale: 100},
      scaleY: 2,
    })).toBe(50)
    expect(calculateSurfaceHostImeInset({
      ime: {visible: false, bottomLogicalBeforeCanvasScale: 100},
      scaleY: 2,
    })).toBe(0)
    expect(calculateSurfaceHostImeInset({
      ime: {visible: true, bottomLogicalBeforeCanvasScale: 100},
      scaleY: 0.5,
    })).toBe(200)
  })

  it('provides only the final logical IME inset to the hosted content', () => {
    const source = createSource()
    const {logger} = createLogger()
    const host = createHostSource(hostSnapshot(2560, 1600, {
      visible: true,
      bottomLogicalBeforeCanvasScale: 100,
    }))
    source.setRoot(rootWithContent(emptyContent()))
    source.setStatus('started')
    const ImeProbe = () => createElement('render-ime-probe', {
      testID: 'sample:ime-probe',
      value: useSurfaceHostImeInset(),
    })

    const renderer = mount(createElement(
      RenderProvider,
      {stateSource: source.stateSource, uiCatalog: createUiCatalog([]), rendererCatalog: createRendererCatalog([]), logger, ...unusedRenderProviderBindings},
      createElement(SurfaceRoot, {
        displayMode: 'PRIMARY',
        containerKey: 'root',
        canvas: {width: 1280, height: 800},
        surfaceHostSource: host,
      }, createElement(ImeProbe)),
    ))

    expect(findByTestID(renderer, 'sample:ime-probe').props.value).toBe(50)
    renderer.unmount()
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
    expect(renderer.root.findAll(node => node.props.testID === 'ui-base-render:surface-host-canvas')).toHaveLength(0)

    act(() => host.emit(hostSnapshot(800, 600)))
    expect(findByTestID(renderer, 'ui-base-render:surface-host-canvas')).toBeDefined()

    act(() => host.emit(null))
    expect(findByTestID(renderer, 'ui-base-render:surface-host-pending')).toBeDefined()
    expect(renderer.root.findAll(node => node.props.testID === 'ui-base-render:surface-host-canvas')).toHaveLength(0)
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

  it('keeps runtime unavailable and container empty as distinct fallback facts', () => {
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
      'ui-base-render:fallback:runtime-unavailable',
      'ui-base-render:fallback:runtime-unavailable',
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
    expect(StyleSheet.flatten(layerStack.props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 1000,
      elevation: 1000,
    })
    expect(layerStack.props.pointerEvents).toBe('box-none')
    const layerSurfaces = renderer.root.findAll(node =>
      node.type === View
      && typeof node.props.testID === 'string'
      && node.props.testID.startsWith('ui-base-render:layer:'),
    )
    expect(layerSurfaces).toHaveLength(4)
    expect(StyleSheet.flatten(layerSurfaces[0]!.props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })
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
    await act(async () => {
      const onPress = findByTestID(renderer, 'ui-base-render:layer-backdrop').props.onPress
      if (typeof onPress !== 'function') throw new Error('layer backdrop must be pressable')
      onPress()
      await Promise.resolve()
    })
    expect(dispatches).toEqual(['kernel.base.ui-state.close-layer'])
    await act(async () => {
      expect(backHandlers[0]!({type: 'hardwareBackPress', timeStamp: 0})).toBe(true)
      await Promise.resolve()
    })
    expect(dispatches).toEqual(['kernel.base.ui-state.close-layer', 'kernel.base.ui-state.close-layer'])
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
    const screenMissingRenderer = part({partKey: 'screen-missing-renderer-part', rendererKey: 'screen-not-installed', component: Screen})
    const fullUiCatalog = createUiCatalog([
      valid.catalogEntry,
      missingRenderer.catalogEntry,
      counted.catalogEntry,
      screenMissingRenderer.catalogEntry,
    ])
    const fullRendererCatalog = createRendererCatalog([valid.rendererBinding, counted.rendererBinding])
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
        data: {partKey: 'missing-catalog-part', displayMode: 'PRIMARY'},
      }),
      expect.objectContaining({
        category: 'ui.base.render',
        event: 'missing-catalog-entry',
        data: {partKey: 'missing-catalog-layer-part', displayMode: 'PRIMARY'},
      }),
      expect.objectContaining({
        category: 'ui.base.render',
        event: 'missing-renderer',
        data: {partKey: 'missing-renderer-part', displayMode: 'PRIMARY', rendererKey: 'not-installed'},
      }),
    ]))

    const invalidRoot = rootWithContent({
      contentSets: {
        PRIMARY: {
          containers: {root: {partKey: 'counted-part', props: 'invalid'}},
          layers: [{layerId: 'invalid-layer', partKey: 'counted-part', openedAt: 1, props: []}],
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
        data: {partKey: 'counted-part', displayMode: 'PRIMARY', valueType: 'string'},
      }),
      expect.objectContaining({
        category: 'ui.base.render',
        event: 'invalid-props-shape',
        data: {partKey: 'counted-part', displayMode: 'PRIMARY', valueType: 'array'},
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
        data: {partKey: 'screen-missing-renderer-part', displayMode: 'PRIMARY', rendererKey: 'screen-not-installed'},
      }),
    ]))
    renderer.unmount()
    expect(businessCalls).toBe(0)
  })

  it('does not collide diagnostic identities when keys contain separators', () => {
    const {logger, events} = createLogger()
    const reporter = createRenderPartDiagnosticReporter(logger)
    reporter.report({
      event: 'missing-renderer',
      data: {partKey: 'part|PRIMARY', displayMode: 'PRIMARY', rendererKey: 'renderer'},
    })
    reporter.report({
      event: 'missing-renderer',
      data: {partKey: 'part', displayMode: 'PRIMARY', rendererKey: 'PRIMARY|renderer'},
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
})
