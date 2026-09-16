import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {createElement, useMemo} from 'react'
import {describe, expect, it} from 'vitest'
import {createCommandId, createRequestId, type RequestId} from '@catering-v2s/kernel-base-contracts'
import type {
  LogEvent,
  LogWriteInput,
  LogWriteResult,
  LoggerPort,
} from '@catering-v2s/kernel-base-platform-ports'
import type {Runtime, RuntimeStatus} from '@catering-v2s/kernel-base-runtime'
import {createCommand, defineCommand} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import {
  createRendererCatalog,
  createRenderRuntimeFacts,
  RenderProvider,
  resolveDebugMode,
  useDispatchCommand,
  useRequestInFlight,
  useRenderStatus,
  useUiStateSelector,
  useUiCatalogContext,
  useUiVariable,
  useTrackedRequest,
  type RenderProviderProps,
} from '../src/index'
import {createModuleUiVariableFactory, createUiCatalog, type UiCatalogContext, type UiVariableDeclaration} from '@catering-v2s/kernel-base-ui-state'
import {createRenderSnapshotReader} from '../src/foundations/createRenderSnapshotReader'
import {areUiCatalogContextsEqual} from '../src/hooks/useUiCatalogContext'
import {nativeLoadingCapability, unusedRenderProviderBindings} from './renderProviderBindings'

;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

type RuntimeStateRoot = ReturnType<Runtime['getState']>

type FakeStateSource = {
  readonly stateSource: RenderProviderProps['stateSource']
  readonly notify: () => void
  readonly setStatus: (status: RuntimeStatus) => void
  readonly setRoot: (root: RuntimeStateRoot) => void
  readonly getStateCalls: () => number
  readonly listenerCount: () => number
}

const createFakeStateSource = (
  initialStatus: 'created' | 'starting' | 'started' | 'failed' = 'created',
): FakeStateSource => {
  let status = initialStatus
  let root = Object.freeze({slice: Object.freeze({marker: 0})}) as RuntimeStateRoot
  let getStateCalls = 0
  const listeners = new Set<() => void>()
  const stateSource: RenderProviderProps['stateSource'] = {
    getStatus: () => status,
    getState: () => {
      getStateCalls += 1
      if (status !== 'started') throw new Error('fake getState called before started')
      return root
    },
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return {
    stateSource,
    notify: () => {
      for (const listener of [...listeners]) listener()
    },
    setStatus: nextStatus => {
      status = nextStatus
    },
    setRoot: nextRoot => {
      root = nextRoot
    },
    getStateCalls: () => getStateCalls,
    listenerCount: () => listeners.size,
  }
}

const createLogger = (): Readonly<{logger: LoggerPort; events: LogWriteInput[]}> => {
  const events: LogWriteInput[] = []
  const write = (input: LogWriteInput): LogWriteResult => {
    events.push(input)
    return {
      status: 'succeeded',
      value: {} as LogEvent,
      completedAt: 0,
    }
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

const requestRoot = (
  requestId: RequestId,
  commandStatus: 'running' | 'completed',
): RuntimeStateRoot => {
  const running = commandStatus === 'running'
  const commandId = createCommandId()
  const record = {
    requestId,
    workspace: null,
    startedAt: 1,
    commands: [{
      commandId,
      parentCommandId: null,
      commandName: 'render.request-support-test.submit',
      target: 'local',
      allowNoActor: false,
      actorResults: [{
        actorKey: 'render.request-support-test.actor',
        status: commandStatus,
        startedAt: 1,
        completedAt: running ? null : 2,
        result: null,
        error: null,
      }],
      startedAt: 1,
      completedAt: running ? null : 2,
      displayMode: null,
    }],
  }
  return Object.freeze({
    'kernel.base.runtime.instance-mode': Object.freeze({instanceMode: 'MASTER'}),
    'kernel.base.runtime.request-ledger.MASTER': Object.freeze({
      [String(requestId)]: Object.freeze({value: record, updatedAt: 1}),
    }),
    'kernel.base.runtime.request-ledger.SLAVE': Object.freeze({}),
  }) as RuntimeStateRoot
}

describe('render runtime snapshot seam', () => {
  it('gates getState by status and preserves snapshot identity', () => {
    const source = createFakeStateSource()
    const reader = createRenderSnapshotReader(source.stateSource)

    const created = reader.getSnapshot()
    expect(created).toBe(reader.getSnapshot())
    expect(created.root).toBeUndefined()
    expect(source.getStateCalls()).toBe(0)

    source.setStatus('starting')
    const starting = reader.getSnapshot()
    expect(starting).toBe(reader.getSnapshot())
    expect(starting.root).toBeUndefined()
    expect(source.getStateCalls()).toBe(0)

    const root = Object.freeze({slice: Object.freeze({marker: 1})}) as RuntimeStateRoot
    source.setRoot(root)
    source.setStatus('started')
    const started = reader.getSnapshot()
    expect(started.root).toBe(root)
    expect(started).toBe(reader.getSnapshot())
    expect(source.getStateCalls()).toBe(2)

    source.setStatus('failed')
    const failed = reader.getSnapshot()
    expect(failed.root).toBeUndefined()
    expect(failed).toBe(reader.getSnapshot())
    expect(source.getStateCalls()).toBe(2)
  })

  it('re-renders from unavailable through started to failed and caches selector results by root', () => {
    const source = createFakeStateSource()
    const {logger, events} = createLogger()
    let selectorCalls = 0
    const selectProbe = (root: RuntimeStateRoot) => {
      selectorCalls += 1
      return {root}
    }
    const Probe = () => {
      const selected = useUiStateSelector(selectProbe)
      return createElement('render-probe', {
        testID: selected === undefined ? 'runtime-unavailable' : 'available',
        selected,
      })
    }

    let renderer: ReactTestRenderer
    act(() => {
      renderer = create(createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
        },
        createElement(Probe),
      ))
    })
    expect(renderer!.root.findByType('render-probe').props.testID).toBe('runtime-unavailable')
    expect(source.getStateCalls()).toBe(0)
    expect(selectorCalls).toBe(0)

    act(() => {
      source.setStatus('starting')
      source.notify()
    })
    expect(renderer!.root.findByType('render-probe').props.testID).toBe('runtime-unavailable')
    expect(source.getStateCalls()).toBe(0)

    const firstRoot = Object.freeze({slice: Object.freeze({marker: 1})}) as RuntimeStateRoot
    act(() => {
      source.setRoot(firstRoot)
      source.setStatus('started')
      source.notify()
    })
    expect(renderer!.root.findByType('render-probe').props.testID).toBe('available')
    expect(selectorCalls).toBe(1)
    const startedCalls = source.getStateCalls()
    const selectedBeforeSameRootRerender = renderer!.root.findByType('render-probe').props.selected

    act(() => {
      renderer!.update(createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
        },
        createElement(Probe),
      ))
    })
    expect(selectorCalls).toBe(1)
    expect(renderer!.root.findByType('render-probe').props.selected).toBe(selectedBeforeSameRootRerender)

    act(() => {
      source.notify()
    })
    expect(selectorCalls).toBe(1)
    expect(source.getStateCalls()).toBeGreaterThanOrEqual(startedCalls)

    const secondRoot = Object.freeze({slice: Object.freeze({marker: 2})}) as RuntimeStateRoot
    act(() => {
      source.setRoot(secondRoot)
      source.notify()
    })
    expect(selectorCalls).toBe(2)

    const callsBeforeFailure = source.getStateCalls()
    act(() => {
      source.setStatus('failed')
      source.notify()
    })
    expect(renderer!.root.findByType('render-probe').props.testID).toBe('runtime-unavailable')
    expect(source.getStateCalls()).toBe(callsBeforeFailure)
    expect(events.some(event => event.event === 'runtime-status-changed')).toBe(true)

    act(() => {
      renderer!.unmount()
    })
    expect(source.listenerCount()).toBe(0)
  })

  it('recomputes when selector identity changes while root stays the same', () => {
    const source = createFakeStateSource('started')
    const {logger} = createLogger()
    const root = Object.freeze({slice: Object.freeze({marker: 7})}) as RuntimeStateRoot
    source.setRoot(root)
    let selectorCalls = 0
    let selector = (currentRoot: RuntimeStateRoot) => {
      selectorCalls += 1
      return {marker: Reflect.get(
        Reflect.get(currentRoot, 'slice') as Record<PropertyKey, unknown>,
        'marker',
      ) as number, version: 1}
    }
    const Probe = () => {
      const selected = useUiStateSelector(selector)
      return createElement('selector-identity-probe', {selected})
    }
    const provider = (children: ReturnType<typeof createElement>) => createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        ...unusedRenderProviderBindings,
      },
      children,
    )

    let renderer: ReactTestRenderer
    act(() => { renderer = create(provider(createElement(Probe))) })
    expect(selectorCalls).toBe(1)
    expect(renderer!.root.findByType('selector-identity-probe').props.selected).toEqual({marker: 7, version: 1})

    selector = currentRoot => {
      selectorCalls += 1
      return {marker: Reflect.get(
        Reflect.get(currentRoot, 'slice') as Record<PropertyKey, unknown>,
        'marker',
      ) as number, version: 2}
    }
    act(() => { renderer!.update(provider(createElement(Probe))) })
    expect(selectorCalls).toBe(2)
    expect(renderer!.root.findByType('selector-identity-probe').props.selected).toEqual({marker: 7, version: 2})
    act(() => {
      renderer!.unmount()
    })
  })

  it('updates a selector when its captured input changes while the root stays the same', () => {
    const source = createFakeStateSource('started')
    const {logger} = createLogger()
    source.setRoot(Object.freeze({slice: Object.freeze({marker: 'marker', other: 'other'})}) as RuntimeStateRoot)
    const Probe = ({field}: Readonly<{readonly field: 'marker' | 'other'}>) => {
      const selector = useMemo(
        () => (root: RuntimeStateRoot) => (Reflect.get(root, 'slice') as Record<string, unknown>)[field],
        [field],
      )
      const selected = useUiStateSelector(selector)
      return createElement('selector-capture-probe', {selected})
    }
    const provider = (field: 'marker' | 'other') => createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        ...unusedRenderProviderBindings,
      },
      createElement(Probe, {field}),
    )
    let renderer: ReactTestRenderer
    act(() => { renderer = create(provider('marker')) })
    expect(renderer!.root.findByType('selector-capture-probe').props.selected).toBe('marker')
    act(() => { renderer!.update(provider('other')) })
    expect(renderer!.root.findByType('selector-capture-probe').props.selected).toBe('other')
    act(() => { renderer!.unmount() })
  })

  it('does not re-render when an unrelated root update leaves the selected primitive equal', () => {
    const source = createFakeStateSource('started')
    const {logger} = createLogger()
    const selectMarker = (root: RuntimeStateRoot): number => Reflect.get(
      Reflect.get(root, 'slice') as Record<PropertyKey, unknown>,
      'marker',
    ) as number
    let renderCount = 0
    const Probe = () => {
      renderCount += 1
      const marker = useUiStateSelector(selectMarker)
      return createElement('render-count-probe', {marker})
    }
    source.setRoot(Object.freeze({
      slice: Object.freeze({marker: 1}),
      unrelated: Object.freeze({value: 'first'}),
    }) as RuntimeStateRoot)
    const provider = createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        ...unusedRenderProviderBindings,
      },
      createElement(Probe),
    )
    let renderer: ReactTestRenderer
    act(() => { renderer = create(provider) })
    expect(renderCount).toBe(1)
    expect(renderer!.root.findByType('render-count-probe').props.marker).toBe(1)

    act(() => {
      source.setRoot(Object.freeze({
        slice: Object.freeze({marker: 1}),
        unrelated: Object.freeze({value: 'second'}),
      }) as RuntimeStateRoot)
      source.notify()
    })
    expect(renderCount).toBe(1)

    act(() => {
      source.setRoot(Object.freeze({
        slice: Object.freeze({marker: 2}),
        unrelated: Object.freeze({value: 'third'}),
      }) as RuntimeStateRoot)
      source.notify()
    })
    expect(renderCount).toBe(2)
    expect(renderer!.root.findByType('render-count-probe').props.marker).toBe(2)
    act(() => { renderer!.unmount() })
  })

  it('uses a narrow equality for derived values without swallowing changed fields', () => {
    const source = createFakeStateSource('started')
    const {logger} = createLogger()
    const selectProjection = (root: RuntimeStateRoot) => {
      const slice = Reflect.get(root, 'slice') as Readonly<{readonly marker: number; readonly label: string}>
      return {marker: slice.marker, label: slice.label}
    }
    const equalProjection = (
      previous: Readonly<{readonly marker: number; readonly label: string}> | undefined,
      next: Readonly<{readonly marker: number; readonly label: string}> | undefined,
    ) => previous?.marker === next?.marker && previous?.label === next?.label
    let renderCount = 0
    const Probe = () => {
      renderCount += 1
      const projection = useUiStateSelector(selectProjection, equalProjection)
      return createElement('derived-probe', {projection})
    }
    const provider = createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        ...unusedRenderProviderBindings,
      },
      createElement(Probe),
    )
    source.setRoot(Object.freeze({slice: Object.freeze({marker: 1, label: 'one'})}) as RuntimeStateRoot)
    let renderer: ReactTestRenderer
    act(() => { renderer = create(provider) })
    expect(renderCount).toBe(1)
    act(() => {
      source.setRoot(Object.freeze({slice: Object.freeze({marker: 1, label: 'one'})}) as RuntimeStateRoot)
      source.notify()
    })
    expect(renderCount).toBe(1)
    act(() => {
      source.setRoot(Object.freeze({slice: Object.freeze({marker: 1, label: 'two'})}) as RuntimeStateRoot)
      source.notify()
    })
    expect(renderCount).toBe(2)
    expect(renderer!.root.findByType('derived-probe').props.projection).toEqual({marker: 1, label: 'two'})
    act(() => { renderer!.unmount() })
  })

  it('keeps runtime status separate from an undefined business selection', () => {
    const source = createFakeStateSource()
    const {logger} = createLogger()
    let renderCount = 0
    const Probe = () => {
      renderCount += 1
      const status = useRenderStatus()
      const emptySelection = useUiStateSelector(() => undefined)
      return createElement('status-boundary-probe', {status, emptySelection})
    }
    let renderer: ReactTestRenderer
    act(() => {
      renderer = create(createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
        },
        createElement(Probe),
      ))
    })
    expect(renderer!.root.findByType('status-boundary-probe').props).toMatchObject({
      status: 'created',
      emptySelection: undefined,
    })
    expect(source.getStateCalls()).toBe(0)

    act(() => {
      source.setStatus('starting')
      source.notify()
    })
    expect(renderer!.root.findByType('status-boundary-probe').props.status).toBe('starting')
    expect(source.getStateCalls()).toBe(0)

    source.setRoot(Object.freeze({slice: Object.freeze({marker: 1})}) as RuntimeStateRoot)
    act(() => {
      source.setStatus('started')
      source.notify()
    })
    expect(renderer!.root.findByType('status-boundary-probe').props).toMatchObject({
      status: 'started',
      emptySelection: undefined,
    })
    const rendersAfterStarted = renderCount
    act(() => {
      source.setRoot(Object.freeze({slice: Object.freeze({marker: 2})}) as RuntimeStateRoot)
      source.notify()
    })
    expect(renderCount).toBe(rendersAfterStarted)
    expect(renderer!.root.findByType('status-boundary-probe').props.status).toBe('started')
    expect(source.getStateCalls()).toBeGreaterThan(0)
    act(() => { renderer!.unmount() })
  })

  it('projects catalog context with a complete shallow equality boundary', () => {
    const source = createFakeStateSource('started')
    const {logger} = createLogger()
    const createCatalogRoot = (instanceMode: 'MASTER' | 'SLAVE', marker: number): RuntimeStateRoot => Object.freeze({
      'kernel.base.runtime.instance-mode': Object.freeze({instanceMode}),
      'kernel.base.display-context.display-role': Object.freeze({displayRole: 'CHIEF'}),
      slice: Object.freeze({marker}),
    }) as RuntimeStateRoot
    let renderCount = 0
    const Probe = () => {
      renderCount += 1
      const context = useUiCatalogContext('PRIMARY')
      return createElement('catalog-context-probe', {context})
    }
    const provider = (child: ReturnType<typeof createElement>) => createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        ...unusedRenderProviderBindings,
      },
      child,
    )
    source.setRoot(createCatalogRoot('MASTER', 1))
    let renderer: ReactTestRenderer
    act(() => { renderer = create(provider(createElement(Probe))) })
    expect(renderCount).toBe(1)
    expect(renderer!.root.findByType('catalog-context-probe').props.context).toMatchObject({
      displayMode: 'PRIMARY',
      instanceMode: 'MASTER',
      surfaceForm: 'laptop',
    })
    act(() => {
      source.setRoot(createCatalogRoot('MASTER', 2))
      source.notify()
    })
    expect(renderCount).toBe(1)
    act(() => {
      source.setRoot(createCatalogRoot('SLAVE', 3))
      source.notify()
    })
    expect(renderCount).toBe(2)
    expect(renderer!.root.findByType('catalog-context-probe').props).toMatchObject({
      context: {instanceMode: 'SLAVE'},
    })
    act(() => { renderer!.unmount() })
  })

  it('compares every catalog context field at the selector equality boundary', () => {
    const base: UiCatalogContext = {
      displayMode: 'PRIMARY',
      workspace: 'MAIN',
      instanceMode: 'MASTER',
      surfaceForm: 'laptop',
    }
    const cases: readonly [keyof UiCatalogContext, UiCatalogContext][] = [
      ['displayMode', {...base, displayMode: 'SECONDARY'}],
      ['workspace', {...base, workspace: 'BRANCH'}],
      ['instanceMode', {...base, instanceMode: 'SLAVE'}],
      ['surfaceForm', {...base, surfaceForm: 'mobile'}],
    ]
    for (const [field, changed] of cases) {
      expect(areUiCatalogContextsEqual(base, changed), `${field} must invalidate the projection`).toBe(false)
    }
    expect(areUiCatalogContextsEqual(base, {...base})).toBe(true)
    expect(areUiCatalogContextsEqual(undefined, base)).toBe(false)
  })

  it('keeps two Providers independent across roots, notifications, and teardown', () => {
    const first = createFakeStateSource('started')
    const second = createFakeStateSource('started')
    const firstLogger = createLogger()
    const secondLogger = createLogger()
    first.setRoot(Object.freeze({slice: Object.freeze({marker: 1})}) as RuntimeStateRoot)
    second.setRoot(Object.freeze({slice: Object.freeze({marker: 2})}) as RuntimeStateRoot)
    const selectMarker = (root: RuntimeStateRoot): number => Reflect.get(
      Reflect.get(root, 'slice') as Record<PropertyKey, unknown>,
      'marker',
    ) as number
    const Probe = ({label}: Readonly<{readonly label: string}>) => {
      const marker = useUiStateSelector(selectMarker)
      return createElement('provider-isolation-probe', {label, marker})
    }
    const provider = (
      source: FakeStateSource,
      logger: ReturnType<typeof createLogger>,
      label: string,
    ) => createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger: logger.logger,
        ...unusedRenderProviderBindings,
      },
      createElement(Probe, {label}),
    )

    let renderer: ReactTestRenderer
    act(() => {
      renderer = create(createElement(
        'provider-isolation-root',
        null,
        provider(first, firstLogger, 'first'),
        provider(second, secondLogger, 'second'),
      ))
    })
    const probes = () => renderer!.root.findAllByType('provider-isolation-probe')
    expect(probes().map(probe => [probe.props.label, probe.props.marker])).toEqual([
      ['first', 1],
      ['second', 2],
    ])
    expect(first.listenerCount()).toBe(2)
    expect(second.listenerCount()).toBe(2)

    act(() => {
      first.setRoot(Object.freeze({slice: Object.freeze({marker: 3})}) as RuntimeStateRoot)
      first.notify()
    })
    expect(probes().map(probe => [probe.props.label, probe.props.marker])).toEqual([
      ['first', 3],
      ['second', 2],
    ])

    act(() => {
      renderer!.update(createElement(
        'provider-isolation-root',
        null,
        provider(second, secondLogger, 'second'),
      ))
    })
    expect(first.listenerCount()).toBe(0)
    expect(second.listenerCount()).toBe(2)
    act(() => {
      second.setRoot(Object.freeze({slice: Object.freeze({marker: 4})}) as RuntimeStateRoot)
      second.notify()
    })
    expect(probes().map(probe => [probe.props.label, probe.props.marker])).toEqual([
      ['second', 4],
    ])
    act(() => {
      renderer!.unmount()
    })
    expect(second.listenerCount()).toBe(0)
  })

  it('updates both Providers from one shared state source and keeps the survivor subscribed', () => {
    const source = createFakeStateSource('started')
    const firstLogger = createLogger()
    const secondLogger = createLogger()
    source.setRoot(Object.freeze({slice: Object.freeze({marker: 1})}) as RuntimeStateRoot)
    const selectMarker = (root: RuntimeStateRoot): number => Reflect.get(
      Reflect.get(root, 'slice') as Record<PropertyKey, unknown>,
      'marker',
    ) as number
    const Probe = ({label}: Readonly<{readonly label: string}>) => {
      const marker = useUiStateSelector(selectMarker)
      return createElement('shared-source-probe', {label, marker})
    }
    const provider = (
      logger: ReturnType<typeof createLogger>,
      label: string,
    ) => createElement(
      RenderProvider,
      {
        stateSource: source.stateSource,
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger: logger.logger,
        ...unusedRenderProviderBindings,
      },
      createElement(Probe, {label}),
    )

    let renderer: ReactTestRenderer
    act(() => {
      renderer = create(createElement(
        'shared-source-root',
        null,
        provider(firstLogger, 'first'),
        provider(secondLogger, 'second'),
      ))
    })
    const probes = () => renderer!.root.findAllByType('shared-source-probe')
    expect(probes().map(probe => [probe.props.label, probe.props.marker])).toEqual([
      ['first', 1],
      ['second', 1],
    ])
    expect(source.listenerCount()).toBe(4)

    act(() => {
      source.setRoot(Object.freeze({slice: Object.freeze({marker: 2})}) as RuntimeStateRoot)
      source.notify()
    })
    expect(probes().map(probe => [probe.props.label, probe.props.marker])).toEqual([
      ['first', 2],
      ['second', 2],
    ])

    act(() => {
      renderer!.update(createElement(
        'shared-source-root',
        null,
        provider(secondLogger, 'second'),
      ))
    })
    expect(source.listenerCount()).toBe(2)

    act(() => {
      source.setRoot(Object.freeze({slice: Object.freeze({marker: 3})}) as RuntimeStateRoot)
      source.notify()
    })
    expect(probes().map(probe => [probe.props.label, probe.props.marker])).toEqual([
      ['second', 3],
    ])
    act(() => {
      renderer!.unmount()
    })
    expect(source.listenerCount()).toBe(0)
  })

  it('exposes only the injected command and module-bound variable readers', async () => {
    const source = createFakeStateSource('started')
    const {logger} = createLogger()
    const variable = createModuleUiVariableFactory('render-test').define('label', {
      defaultValue: 'default',
      persistIntent: 'never',
    })
    const command = createCommand(
      defineCommand<{readonly marker: string}>('render-test', {
        name: 'submit',
        visibility: 'public',
      }),
      {marker: 'payload'},
    )
    const requestId = 'render-request-1' as Parameters<RenderProviderProps['dispatchCommand']>[1]['requestId']
    const dispatchCalls: Array<Readonly<{command: unknown; requestId: typeof requestId}>> = []
    const dispatchCommand: RenderProviderProps['dispatchCommand'] = async (currentCommand, options) => {
      dispatchCalls.push({command: currentCommand, requestId: options.requestId})
      return undefined as never
    }
    const readerCalls: Array<Readonly<{root: RuntimeStateRoot; declaration: typeof variable}>> = []
    const selectUiVariable: RenderProviderProps['selectUiVariable'] = <TValue extends StateJsonValue>(
      root: RuntimeStateRoot,
      declaration: UiVariableDeclaration<TValue>,
    ) => {
      readerCalls.push({root, declaration: declaration as typeof variable})
      return 'bound-value' as TValue
    }
    const Probe = () => {
      const dispatch = useDispatchCommand()
      const value = useUiVariable(variable)
      return createElement('injected-seam-probe', {
        value,
        invoke: () => dispatch(command, {requestId}),
      })
    }

    let renderer: ReactTestRenderer
    act(() => {
      renderer = create(createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          nativeLoadingCapability,
          runtimeFacts: createRenderRuntimeFacts({
            environmentMode: 'TEST',
            debugMode: resolveDebugMode({}),
            deviceIdentity: {available: false, deviceId: null},
            platformPortCapabilities: [],
          }),
          dispatchCommand,
          selectUiVariable,
          selectSurfaceForm: () => 'laptop' as const,
        },
        createElement(Probe),
      ))
    })
    const probe = renderer!.root.findByType('injected-seam-probe')
    expect(probe.props.value).toBe('bound-value')
    expect(readerCalls).toHaveLength(1)
    expect(readerCalls[0]?.declaration).toBe(variable)
    const invoke = probe.props.invoke as () => Promise<unknown>
    await act(async () => { await invoke() })
    expect(dispatchCalls).toEqual([{command, requestId}])
    renderer!.unmount()
  })

  it('tracks a request through started and completed ledger views', () => {
    const source = createFakeStateSource('started')
    const requestId = createRequestId()
    source.setRoot(requestRoot(requestId, 'running'))
    const {logger} = createLogger()
    const Probe = () => createElement('request-in-flight-probe', {
      testID: useRequestInFlight(requestId) ? 'loading' : 'idle',
    })

    let renderer: ReactTestRenderer
    act(() => {
      renderer = create(createElement(
        RenderProvider,
        {
          stateSource: source.stateSource,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          ...unusedRenderProviderBindings,
        },
        createElement(Probe),
      ))
    })
    expect(renderer!.root.findByType('request-in-flight-probe').props.testID).toBe('loading')

    act(() => {
      source.setRoot(requestRoot(requestId, 'completed'))
      source.notify()
    })
    expect(renderer!.root.findByType('request-in-flight-probe').props.testID).toBe('idle')
    act(() => { renderer!.unmount() })
  })

  it('keeps the tracked request until its matching finish call', () => {
    let trackedRequest: ReturnType<typeof useTrackedRequest> | undefined
    const Probe = () => {
      const tracked = useTrackedRequest()
      trackedRequest = tracked
      return createElement('tracked-request-probe', {requestId: tracked.requestId})
    }

    let renderer: ReactTestRenderer
    act(() => { renderer = create(createElement(Probe)) })
    expect(renderer!.root.findByType('tracked-request-probe').props.requestId).toBeNull()

    let requestId: RequestId | undefined
    act(() => {
      requestId = trackedRequest!.start()
    })
    expect(requestId).toMatch(/^req_/)
    expect(renderer!.root.findByType('tracked-request-probe').props.requestId).toBe(requestId)

    act(() => {
      trackedRequest!.finish(createRequestId())
    })
    expect(renderer!.root.findByType('tracked-request-probe').props.requestId).toBe(requestId)

    act(() => {
      trackedRequest!.finish(requestId!)
    })
    expect(renderer!.root.findByType('tracked-request-probe').props.requestId).toBeNull()
    act(() => { renderer!.unmount() })
  })
})
