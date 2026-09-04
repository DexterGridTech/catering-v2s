import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {createElement, type ComponentType, type ReactElement} from 'react'
import {describe, expect, it} from 'vitest'
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
  RenderProvider,
  SurfaceRoot,
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

const mount = (element: ReactElement): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(element)
  })
  return renderer!
}

const findFallbacks = (renderer: ReactTestRenderer) => renderer.root.findAll(node =>
  typeof node.type === 'string'
  && typeof node.props.testID === 'string'
  && node.props.testID.startsWith('ui-base-render:fallback:'),
)

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
})

describe('render surface hosts', () => {
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
    renderer.unmount()
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
