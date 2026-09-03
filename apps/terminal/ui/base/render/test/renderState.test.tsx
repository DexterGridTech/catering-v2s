import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {createElement} from 'react'
import {describe, expect, it} from 'vitest'
import type {
  LogEvent,
  LogWriteInput,
  LogWriteResult,
  LoggerPort,
} from '@catering-v2s/kernel-base-platform-ports'
import type {Runtime, RuntimeStatus} from '@catering-v2s/kernel-base-runtime'
import {createRendererCatalog, RenderProvider, useUiStateSelector, type RenderProviderProps} from '../src/index'
import {createUiCatalog} from '@catering-v2s/kernel-base-ui-state'
import {createRenderSnapshotReader} from '../src/foundations/createRenderSnapshotReader'

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
    const Probe = () => {
      const selected = useUiStateSelector(root => {
        selectorCalls += 1
        return {root}
      })
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
})
