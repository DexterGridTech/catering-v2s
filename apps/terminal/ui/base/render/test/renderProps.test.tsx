import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {createElement, type ComponentType} from 'react'
import {describe, expect, it} from 'vitest'
import type {LogEvent, LogWriteInput, LogWriteResult, LoggerPort} from '@catering-v2s/kernel-base-platform-ports'
import type {Runtime} from '@catering-v2s/kernel-base-runtime'
import {createUiCatalog} from '@catering-v2s/kernel-base-ui-state'
import {
  createRendererCatalog,
  definePart,
  RenderProvider,
  SurfaceRoot,
  useSurfaceDisplayMode,
  useUiStateSelector,
} from '../src/index'
import {unusedRenderProviderBindings} from './renderProviderBindings'

;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

type RuntimeStateRoot = ReturnType<Runtime['getState']>

type FakeSource = Readonly<{
  readonly stateSource: {
    readonly getStatus: () => 'started'
    readonly getState: () => RuntimeStateRoot
    readonly subscribe: (listener: () => void) => () => void
  }
  readonly setRoot: (root: RuntimeStateRoot) => void
  readonly notify: () => void
}>

const createSource = (initialRoot: RuntimeStateRoot): FakeSource => {
  let root = initialRoot
  const listeners = new Set<() => void>()
  return {
    stateSource: {
      getStatus: () => 'started',
      getState: () => root,
      subscribe: listener => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    setRoot: nextRoot => { root = nextRoot },
    notify: () => { for (const listener of [...listeners]) listener() },
  }
}

const createLogger = (): Readonly<{readonly logger: LoggerPort; readonly events: LogWriteInput[]}> => {
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

const rootWithScreen = (props?: unknown): RuntimeStateRoot => Object.freeze({
  'kernel.base.runtime.instance-mode': Object.freeze({instanceMode: 'MASTER'}),
  'kernel.base.display-context.display-role': Object.freeze({displayRole: 'CHIEF'}),
  'kernel.base.ui-state.content.MAIN': Object.freeze({
    contentSets: {
      PRIMARY: {containers: {root: props === undefined ? {partKey: 'props-part'} : {partKey: 'props-part', props}}, layers: []},
      SECONDARY: {containers: {}, layers: []},
    },
  }),
  'kernel.base.ui-state.content.BRANCH': Object.freeze({
    contentSets: {
      PRIMARY: {containers: {}, layers: []},
      SECONDARY: {containers: {}, layers: []},
    },
  }),
}) as RuntimeStateRoot

type ProbeProps = Readonly<{readonly marker?: string; readonly extra?: number}>

const createProbeFixture = () => {
  const received: object[] = []
  const Probe: ComponentType<ProbeProps> = props => {
    received.push(props)
    const mode = useSurfaceDisplayMode()
    const selectedRoot = useUiStateSelector(root => root)
    return createElement('render-props-probe', {
      testID: 'props-probe',
      marker: props.marker ?? 'absent',
      mode,
      propKeys: Object.keys(props).sort(),
      selectedRoot,
    })
  }
  const defined = definePart({
    partKey: 'props-part',
    rendererKey: 'props-renderer',
    containerKeys: ['root'],
    displayModes: ['PRIMARY', 'SECONDARY'] as const,
    workspaces: ['MAIN'] as const,
    instanceModes: ['MASTER'] as const,
    surfaceForm: ['laptop', 'mobile'] as const,
    title: 'props-part',
    description: 'props-part',
    component: Probe,
  })
  return Object.freeze({
    received,
    uiCatalog: createUiCatalog([defined.catalogEntry]),
    rendererCatalog: createRendererCatalog([defined.rendererBinding]),
  })
}

const mount = (element: ReturnType<typeof createElement>): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(element) })
  return renderer!
}

const unmount = (renderer: ReactTestRenderer): void => {
  act(() => { renderer.unmount() })
}

describe('render component input contract', () => {
  it('T-11 passes props through and maps absent props to an empty object', () => {
    const fixture = createProbeFixture()
    const source = createSource(rootWithScreen({marker: 'plain', extra: 7}))
    const {logger, events} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {stateSource: source.stateSource, uiCatalog: fixture.uiCatalog, rendererCatalog: fixture.rendererCatalog, logger, ...unusedRenderProviderBindings},
      createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
    ))

    const initial = renderer.root.findByType('render-props-probe')
    expect(initial.props.marker).toBe('plain')
    expect(initial.props.mode).toBe('PRIMARY')
    expect(initial.props.propKeys).toEqual(['extra', 'marker'])
    expect(Object.keys(fixture.received[0]).sort()).toEqual(['extra', 'marker'])
    expect(Object.keys(fixture.received[0])).not.toEqual(expect.arrayContaining(['partKey', 'containerKey', 'displayMode', 'testID']))

    act(() => {
      source.setRoot(rootWithScreen())
      source.notify()
    })
    const absent = renderer.root.findByType('render-props-probe')
    expect(absent.props.marker).toBe('absent')
    expect(absent.props.propKeys).toEqual([])
    expect(fixture.received.at(-1)).toEqual({})
    expect(events.some(event => event.event === 'invalid-props-shape')).toBe(false)
    unmount(renderer)
  })

  it('T-12 keeps hook order when the same renderer changes props shape', () => {
    const fixture = createProbeFixture()
    const source = createSource(rootWithScreen())
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {stateSource: source.stateSource, uiCatalog: fixture.uiCatalog, rendererCatalog: fixture.rendererCatalog, logger, ...unusedRenderProviderBindings},
      createElement(SurfaceRoot, {displayMode: 'PRIMARY', containerKey: 'root'}),
    ))

    expect(renderer.root.findByType('render-props-probe').props.propKeys).toEqual([])
    act(() => {
      source.setRoot(rootWithScreen({marker: 'present'}))
      source.notify()
    })
    expect(renderer.root.findByType('render-props-probe').props.marker).toBe('present')
    expect(renderer.root.findByType('render-props-probe').props.propKeys).toEqual(['marker'])
    expect(fixture.received).toHaveLength(2)
    unmount(renderer)
  })
})
