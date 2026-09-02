import {describe, expect, it, vi} from 'vitest'
import {
  createRuntime,
  defineActor,
  defineCommand,
  onCommand,
  type RuntimeModule,
} from '../src/index'
import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import {createSharedMemoryStoragePort, createTestRuntimeInput, createTestSlice, deferred} from './testSupport'

type CommandSpec = NonNullable<RuntimeModule['commandDefinitions']>[number]

const moduleFor = (
  moduleName: string,
  commands: readonly CommandSpec[],
  actors: readonly ReturnType<typeof defineActor>[],
  extra: Partial<RuntimeModule> = {},
): RuntimeModule => Object.freeze({
  moduleName,
  kind: 'owner' as const,
  dependencies: [{moduleName: 'kernel.base.runtime'}],
  commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
  commandDefinitions: commands,
  actors: actors.map(actor => ({name: actor.actorName})),
  actorDefinitions: actors,
  ...extra,
})

describe('runtime reset boundary', () => {
  it('X-1 captures previous state, resets persistence first, then rebuilds module lifecycle', async () => {
    const command = defineCommand<Readonly<{}>>('test.reset', {name: 'request', visibility: 'internal'})
    let requested = false
    let previousValue: number | undefined
    const actor = defineActor('test.reset', 'requester', [onCommand(command, context => {
      if (!requested) {
        requested = true
        context.requestApplicationReset('operator-request')
      }
      return {requested: true}
    })])
    const module = moduleFor('test.reset', [command], [actor], {
      stateSlices: [createTestSlice('test.reset.state', 0)],
      onApplicationReset: (_context, input) => {
        previousValue = Number(Reflect.get(input.previousState['test.reset.state'] ?? {}, 'value'))
      },
    })
    const runtime = createRuntime(createTestRuntimeInput({modules: [module]}))
    await runtime.start()
    runtime.getStore().dispatch({type: 'test/increment'})
    expect(Reflect.get(runtime.getState()['test.reset.state'] ?? {}, 'value')).toBe(1)
    const result = await runtime.dispatchCommand(command, {})
    expect(result.status).toBe('completed')
    expect(previousValue).toBe(1)
    expect(Reflect.get(runtime.getState()['test.reset.state'] ?? {}, 'value')).toBe(0)
    expect(runtime.status).toBe('started')
  })

  it('X-2 ignores duplicate reasons and reset requests raised during reset', async () => {
    const request = defineCommand<Readonly<{}>>('test.reset.ignored', {name: 'request', visibility: 'internal'})
    const during = defineCommand<Readonly<{}>>('test.reset.ignored', {name: 'during', visibility: 'internal'})
    let requested = false
    const requestActor = defineActor('test.reset.ignored', 'requester', [onCommand(request, context => {
      if (!requested) {
        requested = true
        context.requestApplicationReset('first-reason')
        context.requestApplicationReset('second-reason')
      }
      return null
    })])
    const duringActor = defineActor('test.reset.ignored', 'during', [onCommand(during, context => {
      context.requestApplicationReset('during-reset')
      return null
    })])
    const module = moduleFor('test.reset.ignored', [request, during], [requestActor, duringActor], {
      onApplicationReset: async context => { await context.dispatchCommand(during, {}) },
    })
    const runtime = createRuntime(createTestRuntimeInput({modules: [module]}))
    await runtime.start()
    const result = await runtime.dispatchCommand(request, {})
    expect(result.status).toBe('completed')
    const events = runtime.journal.list()
    expect(events.some(event => event.kind === 'reset.reason-ignored' && event.keptReason === 'first-reason' && event.ignoredReason === 'second-reason')).toBe(true)
    expect(events.some(event => event.kind === 'reset.during-reset-ignored' && event.ignoredCommandId !== null)).toBe(true)
    expect(runtime.status).toBe('started')
  })

  it('cleans the root command chain when reset fails', async () => {
    const shared = createSharedMemoryStoragePort()
    const failingPlainStorage = {
      ...shared.storage,
      listKeys: async () => ({
        status: 'failed' as const,
        port: 'persistKv' as const,
        capability: 'listKeys',
        error: {code: 'RESET_LIST_FAILED', message: 'reset list failed', retryable: false},
      }),
    }
    const resetCommand = defineCommand<Readonly<{}>>('test.reset.cleanup', {name: 'request', visibility: 'internal'})
    const probeCommand = defineCommand<Readonly<{}>>('test.reset.cleanup', {name: 'probe', visibility: 'internal'})
    let requested = false
    const resetActor = defineActor('test.reset.cleanup', 'requester', [onCommand(resetCommand, context => {
      if (!requested) {
        requested = true
        context.requestApplicationReset('storage-failure')
      }
      return null
    })])
    const probeActor = defineActor('test.reset.cleanup', 'probe', [onCommand(probeCommand, () => null)])
    const module = moduleFor('test.reset.cleanup', [resetCommand, probeCommand], [resetActor, probeActor], {
      stateSlices: [createTestSlice('test.reset.cleanup.state')],
    })
    const runtime = createRuntime({
      ...createTestRuntimeInput({modules: [module], plainStorage: failingPlainStorage}),
      limits: {maxCommandDepth: 1},
    })
    await runtime.start()
    const rootCommandId = 'cmd_reset_cleanup_root' as never
    await expect(runtime.dispatchCommand(resetCommand, {}, {commandId: rootCommandId})).rejects.toMatchObject({
      key: 'kernel.base.runtime.lifecycle_failed',
    })
    const child = await runtime.dispatchCommand(probeCommand, {}, {parentCommandId: rootCommandId})
    expect(child.status).toBe('completed')
  })

  it('discards and warns about a pending reset when the root command fails', async () => {
    const events: import('@catering-v2s/kernel-base-platform-ports').LogEvent[] = []
    const first = defineCommand<Readonly<{}>>('test.reset.discarded', {name: 'first', visibility: 'internal'})
    const second = defineCommand<Readonly<{}>>('test.reset.discarded', {name: 'second', visibility: 'internal'})
    let firstRequested = false
    let secondRequested = false
    let resetCount = 0
    const firstActor = defineActor('test.reset.discarded', 'first', [onCommand(first, context => {
      if (!firstRequested) {
        firstRequested = true
        context.requestApplicationReset('discarded-secret-reason')
      }
      return null
    })])
    const secondActor = defineActor('test.reset.discarded', 'second', [onCommand(second, context => {
      if (!secondRequested) {
        secondRequested = true
        context.requestApplicationReset('second-reason')
      }
      return null
    })])
    const module = moduleFor('test.reset.discarded', [first, second], [firstActor, secondActor], {
      onApplicationReset: () => { resetCount += 1 },
    })
    const runtime = createRuntime(createTestRuntimeInput({modules: [module], events}))
    await runtime.start()
    const originalDispatch = runtime.getStore().dispatch
    let dispatchCount = 0
    const dispatch = vi.spyOn(runtime.getStore(), 'dispatch').mockImplementation(action => {
      dispatchCount += 1
      // command.started, actor.running, and actor.completed write successfully;
      // fail command.completed after the actor has queued its reset.
      if (dispatchCount === 4) throw new Error('synthetic root completion failure')
      return originalDispatch(action)
    })
    try {
      await expect(runtime.dispatchCommand(first, {}, {requestId: createRequestId()})).rejects.toMatchObject({
        key: 'kernel.base.runtime.ledger_write_failed',
      })
    } finally {
      dispatch.mockRestore()
    }

    const discarded = events.find(event => event.event === 'runtime.reset.request-discarded-after-root-failure')
    expect(discarded).toMatchObject({
      level: 'warn',
      data: {rootCommandId: expect.any(String), hasReason: true},
    })
    expect(JSON.stringify(discarded)).not.toContain('discarded-secret-reason')

    const result = await runtime.dispatchCommand(second, {})
    expect(result.status).toBe('completed')
    expect(resetCount).toBe(1)
  })

  it('does not queue a reset from an actor that finishes after its command was released', async () => {
    const lateRelease = deferred<void>()
    let resetCount = 0
    const timedCommand = defineCommand<Readonly<{}>>('test.reset.late', {
      name: 'timed', visibility: 'internal', timeoutMs: 5,
    })
    const probeCommand = defineCommand<Readonly<{}>>('test.reset.late', {
      name: 'probe', visibility: 'internal',
    })
    const timedActor = defineActor('test.reset.late', 'timed', [onCommand(timedCommand, async context => {
      await lateRelease.promise
      context.requestApplicationReset('late-reset')
      return null
    })])
    const probeActor = defineActor('test.reset.late', 'probe', [onCommand(probeCommand, () => null)])
    const module = moduleFor('test.reset.late', [timedCommand, probeCommand], [timedActor, probeActor], {
      onApplicationReset: () => { resetCount += 1 },
    })
    const runtime = createRuntime(createTestRuntimeInput({modules: [module]}))
    await runtime.start()
    const result = await runtime.dispatchCommand(timedCommand, {})
    expect(result.status).toBe('timed-out')
    lateRelease.resolve()
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
    const probe = await runtime.dispatchCommand(probeCommand, {})
    expect(probe.status).toBe('completed')
    expect(resetCount).toBe(0)
  })
})
