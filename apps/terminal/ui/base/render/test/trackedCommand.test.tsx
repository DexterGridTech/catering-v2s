import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {createElement} from 'react'
import {describe, expect, it} from 'vitest'
import type {LoggerPort, LogEvent, LogWriteInput, LogWriteResult} from '@catering-v2s/kernel-base-platform-ports'
import {createCommandId, type AppError, type RequestId} from '@catering-v2s/kernel-base-contracts'
import {createUiCatalog} from '@catering-v2s/kernel-base-ui-state'
import {createRendererCatalog, RenderProvider, useTrackedCommand, type RenderProviderProps, type TrackedCommandRunInput} from '../src/index'
import {defineCommand, type CommandDispatchResult, type CommandIntent} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import {unusedRenderProviderBindings} from './renderProviderBindings'

;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

type Payload = Readonly<{value: string}>
type Controller = ReturnType<typeof useTrackedCommand>
type RuntimeStateRoot = ReturnType<RenderProviderProps['stateSource']['getState']>

const definition = defineCommand<Payload>('render.tracked-command-test', {
  name: 'run',
  visibility: 'public',
})

const resultOf = (status: CommandDispatchResult['status'], categories: string[] = []): CommandDispatchResult => ({
  requestId: null,
  commandId: 'cmd_render_tracked_test' as CommandDispatchResult['commandId'],
  status,
  actorResults: categories.map(category => ({
    actorKey: 'test',
    status: 'error' as const,
    startedAt: 0,
    completedAt: 0,
    result: {},
    error: {
      key: 'render.tracked-command-test.failure',
      code: 'TEST_FAILURE',
      message: 'safe test failure',
      category: category as AppError['category'],
      severity: 'MEDIUM' as const,
    },
  })),
})

const createLogger = (): LoggerPort => {
  const write = (_input: LogWriteInput): LogWriteResult => ({status: 'succeeded', value: {} as LogEvent, completedAt: 0})
  const logger: LoggerPort = {
    debug: write,
    info: write,
    warn: write,
    error: write,
    scope: () => logger,
    withContext: () => logger,
  }
  return logger
}

type Harness = Readonly<{
  readonly renderer: ReactTestRenderer
  readonly getController: () => Controller
  readonly calls: Array<Readonly<{readonly commandName: string; readonly payload: StateJsonValue; readonly requestId: RequestId; readonly routeIntent?: string}>>
  readonly setRoot: (root: RuntimeStateRoot) => void
  readonly notify: () => void
}>

const requestRoot = (requestId: RequestId, status: 'running' | 'completed'): RuntimeStateRoot => {
  const running = status === 'running'
  const record = {
    requestId,
    workspace: null,
    startedAt: 1,
    commands: [{
      commandId: createCommandId(),
      parentCommandId: null,
      commandName: definition.commandName,
      target: 'local',
      allowNoActor: false,
      actorResults: [{
        actorKey: 'render.tracked-command-test.actor',
        status,
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

const mountHarness = (
  implementation: (command: CommandIntent<Payload>, options: Parameters<RenderProviderProps['dispatchCommand']>[1]) => Promise<CommandDispatchResult>,
): Harness => {
  let controller: Controller | undefined
  const calls: Array<Readonly<{readonly commandName: string; readonly payload: StateJsonValue; readonly requestId: RequestId; readonly routeIntent?: string}>> = []
  let root = requestRoot('req_render_tracked_initial' as RequestId, 'completed')
  const listeners = new Set<() => void>()
  const stateSource: RenderProviderProps['stateSource'] = {
    getStatus: () => 'started',
    getState: () => root,
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const dispatchCommand: RenderProviderProps['dispatchCommand'] = async <TPayload extends StateJsonValue>(
    command: CommandIntent<TPayload>,
    options: Parameters<RenderProviderProps['dispatchCommand']>[1],
  ) => {
    calls.push({commandName: command.definition.commandName, payload: command.payload, requestId: options.requestId, routeIntent: options.routeIntent})
    return implementation(command as unknown as CommandIntent<Payload>, options)
  }
  const Probe = () => {
    controller = useTrackedCommand()
    return createElement('tracked-command-probe', {busy: controller.requestInFlight})
  }

  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(createElement(
      RenderProvider,
      {
        stateSource,
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger: createLogger(),
        ...unusedRenderProviderBindings,
        dispatchCommand,
      },
      createElement(Probe),
    ))
  })
  return Object.freeze({
    renderer: renderer!,
    getController: () => controller!,
    calls,
    setRoot: nextRoot => { root = nextRoot },
    notify: () => { for (const listener of [...listeners]) listener() },
  })
}

const input = (overrides?: Partial<TrackedCommandRunInput<Payload>>): TrackedCommandRunInput<Payload> => ({
  definition,
  payload: {value: 'payload'},
  rejectionPolicy: 'RETHROW',
  ...overrides,
})

describe('useTrackedCommand', () => {
  it('keeps typed dispatch, route intent, terminal outcome and request cleanup together', async () => {
    const completed = resultOf('completed')
    const harness = mountHarness(async (_command, options) => {
      expect(options.requestId).toMatch(/^req_/)
      return completed
    })
    const outcomes: string[] = []

    let returned: CommandDispatchResult | undefined
    await act(async () => {
      returned = await harness.getController().run(input({
        routeIntent: 'peer-intent',
        onOutcome: (_result, outcome) => { outcomes.push(outcome) },
      }))
    })

    expect(returned).toBe(completed)
    expect(outcomes).toEqual(['completed'])
    expect(harness.calls[0]?.payload).toEqual({value: 'payload'})
    expect(harness.calls[0]?.routeIntent).toBe('peer-intent')
    expect(harness.getController().requestInFlight).toBe(false)
    act(() => { harness.renderer.unmount() })
  })

  it.each([
    ['business-failure', resultOf('partial-failed', ['BUSINESS'])],
    ['system-failure', resultOf('partial-failed', ['SYSTEM'])],
  ] as const)('passes %s outcome to the feature callback without rewriting the result', async (expected, result) => {
    const harness = mountHarness(async () => result)
    const outcomes: string[] = []

    await act(async () => {
      await harness.getController().run(input({onOutcome: (_result, outcome) => { outcomes.push(outcome) }}))
    })

    expect(outcomes).toEqual([expected])
    expect(harness.getController().requestInFlight).toBe(false)
    act(() => { harness.renderer.unmount() })
  })

  it('keeps running requests busy and rejects a second invocation', async () => {
    let resolveDispatch: ((result: CommandDispatchResult) => void) | undefined
    const pending = new Promise<CommandDispatchResult>(resolve => { resolveDispatch = resolve })
    const harness = mountHarness(async () => pending)

    let first: Promise<CommandDispatchResult | undefined> | undefined
    act(() => { first = harness.getController().run(input()) })
    await act(async () => { await Promise.resolve() })
    expect(harness.getController().requestInFlight).toBe(true)

    let second: CommandDispatchResult | undefined
    await act(async () => { second = await harness.getController().run(input({payload: {value: 'second'}})) })
    expect(second).toBeUndefined()
    expect(harness.calls).toHaveLength(1)

    await act(async () => {
      resolveDispatch!(resultOf('running'))
      await first
    })
    expect(harness.getController().requestInFlight).toBe(true)
    act(() => { harness.renderer.unmount() })
  })

  it('releases a running request after the runtime ledger becomes terminal', async () => {
    let invocation = 0
    const harness = mountHarness(async (_command, _options) =>
      invocation++ === 0 ? resultOf('running') : resultOf('completed'))

    await act(async () => { await harness.getController().run(input()) })
    expect(harness.getController().requestInFlight).toBe(true)
    const firstRequestId = harness.calls[0]!.requestId

    act(() => {
      harness.setRoot(requestRoot(firstRequestId, 'completed'))
      harness.notify()
    })
    expect(harness.getController().requestInFlight).toBe(false)

    await act(async () => { await harness.getController().run(input({payload: {value: 'after-terminal'}})) })
    expect(harness.calls).toHaveLength(2)
    act(() => { harness.renderer.unmount() })
  })

  it('blocks same-tick re-entry before React publishes the busy state', async () => {
    let resolveDispatch: ((result: CommandDispatchResult) => void) | undefined
    const pending = new Promise<CommandDispatchResult>(resolve => { resolveDispatch = resolve })
    const harness = mountHarness(async () => pending)

    let first: Promise<CommandDispatchResult | undefined> | undefined
    let second: Promise<CommandDispatchResult | undefined> | undefined
    act(() => {
      first = harness.getController().run(input())
      second = harness.getController().run(input({payload: {value: 'same-tick-second'}}))
    })

    expect(harness.calls).toHaveLength(1)
    await expect(second).resolves.toBeUndefined()
    await act(async () => {
      resolveDispatch!(resultOf('completed'))
      await first
    })
    expect(harness.getController().requestInFlight).toBe(false)
    act(() => { harness.renderer.unmount() })
  })

  it.each([
    ['CONSUME', false],
    ['RETHROW', true],
  ] as const)('handles dispatch rejection with %s policy', async (policy, shouldReject) => {
    const error = new Error('dispatch rejected')
    const harness = mountHarness(async () => { throw error })
    const rejected: unknown[] = []
    const promise = harness.getController().run(input({
      rejectionPolicy: policy,
      onRejected: value => { rejected.push(value) },
    }))

    if (shouldReject) await expect(promise).rejects.toBe(error)
    else await expect(promise).resolves.toBeUndefined()
    expect(rejected).toEqual([error])
    expect(harness.getController().requestInFlight).toBe(false)
    act(() => { harness.renderer.unmount() })
  })

  it('does not let a throwing rejection observer rewrite the original policy', async () => {
    const dispatchError = new Error('dispatch rejected')
    const observerError = new Error('observer failed')
    const consumed = mountHarness(async () => { throw dispatchError })
    await expect(consumed.getController().run(input({
      rejectionPolicy: 'CONSUME',
      onRejected: () => { throw observerError },
    }))).resolves.toBeUndefined()
    act(() => { consumed.renderer.unmount() })

    const rethrown = mountHarness(async () => { throw dispatchError })
    await expect(rethrown.getController().run(input({
      rejectionPolicy: 'RETHROW',
      onRejected: () => { throw observerError },
    }))).rejects.toBe(dispatchError)
    act(() => { rethrown.renderer.unmount() })
  })
})
