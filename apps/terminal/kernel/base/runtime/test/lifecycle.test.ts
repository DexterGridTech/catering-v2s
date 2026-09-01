import {describe, expect, it} from 'vitest'
import {createCommandId, createNodeId, createRuntimeInstanceId} from '@catering-v2s/kernel-base-contracts'
import {
  createRuntime,
  defineActor,
  defineCommand,
  onCommand,
  type RuntimeJournalEvent,
  type RuntimeModule,
} from '../src/index'
import {createLifecycleEmitter, type LifecycleCommandContext} from '../src/foundations/createLifecycleEmitter'
import {createTestPlatformPorts, createTestRuntimeInput, createTestSlice} from './testSupport'

type CommandSpec = NonNullable<RuntimeModule['commandDefinitions']>[number]

const moduleFor = (
  moduleName: string,
  commands: readonly CommandSpec[] = [],
  actors: readonly ReturnType<typeof defineActor>[] = [],
  hooks: Pick<RuntimeModule, 'preSetup' | 'install'> = {},
): RuntimeModule => Object.freeze({
  moduleName,
  kind: 'owner' as const,
  dependencies: [{moduleName: 'kernel.base.runtime'}],
  commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
  commandDefinitions: commands,
  actors: actors.map(actor => ({name: actor.actorName})),
  actorDefinitions: actors,
  ...hooks,
})

describe('runtime journal and lifecycle', () => {
  it('J-1 keeps a bounded FIFO journal and isolates observer failures', async () => {
    const observed: RuntimeJournalEvent[] = []
    const command = defineCommand<Readonly<{}>>('test.lifecycle.journal', {name: 'run', visibility: 'internal'})
    const actor = defineActor('test.lifecycle.journal', 'worker', [onCommand(command, () => ({ok: true}))])
    const runtime = createRuntime({
      ...createTestRuntimeInput({modules: [moduleFor('test.lifecycle.journal', [command], [actor])]}),
      limits: {maxJournalRecords: 3},
      onLifecycleEvent: event => { observed.push(event); throw new Error('observer must be isolated') },
    })
    await runtime.start()
    await runtime.dispatchCommand(command, {})
    expect(runtime.journal.list()).toHaveLength(3)
    expect(observed.length).toBeGreaterThan(3)
    expect(runtime.journal.list()[0]?.occurredAt).toBeLessThanOrEqual(runtime.journal.list()[1]?.occurredAt ?? Number.MAX_SAFE_INTEGER)
    expect(runtime.status).toBe('started')
  })

  it('J-2 turns journal append failure into diagnostics rather than a dispatch rejection', () => {
    const events = [] as import('@catering-v2s/kernel-base-platform-ports').LogEvent[]
    const ports = createTestPlatformPorts({events})
    const throwingJournal = {
      list: () => [] as readonly RuntimeJournalEvent[],
      subscribe: () => () => undefined,
      append: () => { throw new Error('append-failed') },
    }
    const context: LifecycleCommandContext = {
      runtimeId: createRuntimeInstanceId(),
      localNodeId: createNodeId(),
      requestId: null,
      commandId: createCommandId(),
      parentCommandId: null,
      commandName: 'test.lifecycle.command',
      visibility: 'internal',
      target: 'local',
      allowNoActor: true,
      routeContext: null,
      startedAt: 1,
    }
    const sessionId = 'session_lifecycle_test' as never
    const emitter = createLifecycleEmitter({
      runtimeId: context.runtimeId,
      localNodeId: context.localNodeId,
      logger: ports.logger,
      maxJournalRecords: 10,
      sessionId: () => sessionId,
      journal: throwingJournal,
    })
    const result = emitter.emitLifecycle({kind: 'command.started', context})
    expect(result.ok).toBe(true)
    expect(events.some(event => event.event === 'runtime.journal.append-failed'
      && event.context?.commandId === context.commandId
      && event.context?.requestId === undefined
      && event.context?.commandName === context.commandName
      && event.context?.sessionId === sessionId
      && event.context?.nodeId === context.localNodeId)).toBe(true)
    expect(emitter.aggregate(context.commandId)).toBe('running')
  })

  it('keeps an unresolved command completion visible as running instead of inventing an error', () => {
    const context: LifecycleCommandContext = {
      runtimeId: createRuntimeInstanceId(),
      localNodeId: createNodeId(),
      requestId: null,
      commandId: createCommandId(),
      parentCommandId: null,
      commandName: 'test.lifecycle.unresolved-completion',
      visibility: 'internal',
      target: 'local',
      allowNoActor: false,
      routeContext: null,
      startedAt: 1,
    }
    const journal: RuntimeJournalEvent[] = []
    const emitter = createLifecycleEmitter({
      runtimeId: context.runtimeId,
      localNodeId: context.localNodeId,
      logger: createTestPlatformPorts().logger,
      maxJournalRecords: 10,
      journal: {
        list: () => journal,
        subscribe: () => () => undefined,
        append: event => { journal.push(event) },
      },
    })
    emitter.emitLifecycle({kind: 'command.started', context})
    emitter.emitLifecycle({kind: 'actor.running', context, actorKey: 'test.actor', startedAt: 1})
    emitter.emitLifecycle({kind: 'command.completed', context, completedAt: 2})
    const completed = journal.find(event => event.kind === 'command.completed')
    expect(completed?.kind).toBe('command.completed')
    if (completed?.kind === 'command.completed') expect(completed.status).toBe('running')
  })

  it('releases completed command records while keeping late events journal-visible', () => {
    const context: LifecycleCommandContext = {
      runtimeId: createRuntimeInstanceId(),
      localNodeId: createNodeId(),
      requestId: null,
      commandId: createCommandId(),
      parentCommandId: null,
      commandName: 'test.lifecycle.release',
      visibility: 'internal',
      target: 'local',
      allowNoActor: false,
      routeContext: null,
      startedAt: 1,
    }
    const journal: RuntimeJournalEvent[] = []
    const emitter = createLifecycleEmitter({
      runtimeId: context.runtimeId,
      localNodeId: context.localNodeId,
      logger: createTestPlatformPorts().logger,
      maxJournalRecords: 10,
      journal: {
        list: () => journal,
        subscribe: () => () => undefined,
        append: event => { journal.push(event) },
      },
    })
    emitter.emitLifecycle({kind: 'command.started', context})
    emitter.emitLifecycle({kind: 'actor.running', context, actorKey: 'test.actor', startedAt: 1})
    emitter.emitLifecycle({
      kind: 'actor.completed', context, actorKey: 'test.actor', startedAt: 1, completedAt: 2,
      result: null, error: null,
    })
    emitter.emitLifecycle({kind: 'command.completed', context, completedAt: 3})
    expect(emitter.getObservation(context.commandId)).toBeDefined()
    emitter.releaseCommand(context.commandId)
    expect(emitter.getObservation(context.commandId)).toBeUndefined()
    expect(emitter.aggregate(context.commandId)).toBeUndefined()
    expect(emitter.emitLifecycle({
      kind: 'actor.late-completed', context, actorKey: 'test.actor', completedAt: 4, error: null,
    }).ok).toBe(true)
    expect(journal.some(event => event.kind === 'actor.late-completed')).toBe(true)
  })

  it('uses a fixed actor key for every depth rejection', () => {
    const makeContext = (commandName: string): LifecycleCommandContext => ({
      runtimeId: createRuntimeInstanceId(),
      localNodeId: createNodeId(),
      requestId: null,
      commandId: createCommandId(),
      parentCommandId: null,
      commandName,
      visibility: 'internal',
      target: 'local',
      allowNoActor: false,
      routeContext: null,
      startedAt: 1,
    })
    const emitter = createLifecycleEmitter({
      runtimeId: createRuntimeInstanceId(),
      localNodeId: createNodeId(),
      logger: createTestPlatformPorts().logger,
      maxJournalRecords: 10,
    })
    const error = {
      key: 'depth', code: 'DEPTH', message: 'depth', category: 'SYSTEM' as const, severity: 'HIGH' as const,
    }
    const first = emitter.emitLifecycle({
      kind: 'command.depth-rejected', context: makeContext('test.depth.one'), commandChain: [], error,
    })
    const second = emitter.emitLifecycle({
      kind: 'command.depth-rejected', context: makeContext('test.depth.two'), commandChain: [], error,
    })
    expect(first.record?.actorKey).toBe('kernel.base.runtime.depth-rejected')
    expect(second.record?.actorKey).toBe(first.record?.actorKey)
  })

  it('L-1 runs preSetup before install and shares one descriptor reference', async () => {
    const order: string[] = []
    let preDescriptors: unknown
    let installDescriptors: unknown
    let installStateAvailable = false
    const module = moduleFor('test.lifecycle.order', [], [], {
      preSetup: context => { order.push('preSetup'); preDescriptors = context.descriptors },
      install: context => {
        order.push('install')
        installDescriptors = context.descriptors
        installStateAvailable = context.getState() !== undefined
      },
    })
    const runtime = createRuntime(createTestRuntimeInput({modules: [module]}))
    const descriptors = runtime.descriptors
    await runtime.start()
    expect(order).toEqual(['preSetup', 'install'])
    expect(preDescriptors).toBe(descriptors)
    expect(installDescriptors).toBe(descriptors)
    expect(installStateAvailable).toBe(true)
  })

  it('L-2 makes a failed runtime terminal and keeps facade access closed', async () => {
    const runtime = createRuntime(createTestRuntimeInput({modules: [moduleFor('test.lifecycle.failure', [], [], {
      install: () => { throw new Error('install failed') },
    })]}))
    expect(() => runtime.getState()).toThrow()
    await expect(runtime.start()).rejects.toMatchObject({key: 'kernel.base.runtime.lifecycle_failed'})
    expect(runtime.status).toBe('failed')
    expect(() => runtime.getStore()).toThrow()
    await expect(runtime.dispatchCommand('kernel.base.runtime.initialize', {})).rejects.toMatchObject({key: 'kernel.base.runtime.lifecycle_failed'})
  })

  it('L-4 releases test-owned timeout resources without exporting cleanup', async () => {
    const {releaseRuntimeForTest} = await import('../src/testing/releaseRuntimeForTest')
    const command = defineCommand<Readonly<{}>>('test.lifecycle.cleanup', {name: 'run', visibility: 'internal', timeoutMs: 1000})
    const runtime = createRuntime(createTestRuntimeInput({modules: [moduleFor('test.lifecycle.cleanup', [command], [defineActor('test.lifecycle.cleanup', 'slow', [onCommand(command, async () => new Promise(() => undefined))])])]}))
    await runtime.start()
    const pending = runtime.dispatchCommand(command, {})
    await Promise.resolve()
    const released = releaseRuntimeForTest(runtime)
    expect(released).toBeGreaterThan(0)
    // The pending actor is deliberately not cancelled by runtime policy; cleanup
    // only releases the test-owned timer. The promise is left outside the test.
    expect(Object.keys(runtime)).not.toContain('releaseRuntimeForTest')
    void pending
  })

  it('L-4 releases module state subscriptions through the test resource registry', async () => {
    let notifications = 0
    const command = defineCommand<Readonly<{}>>('test.lifecycle.subscription', {
      name: 'change', visibility: 'internal',
    })
    const actor = defineActor('test.lifecycle.subscription', 'writer', [onCommand(command, context => {
      context.dispatchAction({type: 'test/increment'})
      return null
    })])
    const module: RuntimeModule = {
      moduleName: 'test.lifecycle.subscription',
      kind: 'owner',
      dependencies: [{moduleName: 'kernel.base.runtime'}],
      commands: [{name: command.commandName, visibility: command.visibility}],
      commandDefinitions: [command],
      actors: [{name: actor.actorName}],
      actorDefinitions: [actor],
      stateSlices: [createTestSlice('test.lifecycle.subscription.state')],
      install: context => { context.subscribeState(() => { notifications += 1 }) },
    }
    const runtime = createRuntime(createTestRuntimeInput({modules: [module]}))
    await runtime.start()
    await runtime.dispatchCommand(command, {})
    const beforeRelease = notifications
    expect(beforeRelease).toBeGreaterThan(0)
    const {releaseRuntimeForTest} = await import('../src/testing/releaseRuntimeForTest')
    expect(releaseRuntimeForTest(runtime)).toBeGreaterThan(0)
    await runtime.dispatchCommand(command, {})
    expect(notifications).toBe(beforeRelease)
  })

  it('L-4 releases actor state subscriptions through the test resource registry', async () => {
    let notifications = 0
    let subscribed = false
    const command = defineCommand<Readonly<{}>>('test.lifecycle.actor-subscription', {
      name: 'change', visibility: 'internal',
    })
    const actor = defineActor('test.lifecycle.actor-subscription', 'writer', [onCommand(command, context => {
      if (!subscribed) {
        subscribed = true
        context.subscribeState(() => { notifications += 1 })
      }
      context.dispatchAction({type: 'test/increment'})
      return null
    })])
    const module: RuntimeModule = {
      moduleName: 'test.lifecycle.actor-subscription',
      kind: 'owner',
      dependencies: [{moduleName: 'kernel.base.runtime'}],
      commands: [{name: command.commandName, visibility: command.visibility}],
      commandDefinitions: [command],
      actors: [{name: actor.actorName}],
      actorDefinitions: [actor],
      stateSlices: [createTestSlice('test.lifecycle.actor-subscription.state')],
    }
    const runtime = createRuntime(createTestRuntimeInput({modules: [module]}))
    await runtime.start()
    await runtime.dispatchCommand(command, {})
    expect(notifications).toBe(1)
    const {releaseRuntimeForTest} = await import('../src/testing/releaseRuntimeForTest')
    expect(releaseRuntimeForTest(runtime)).toBeGreaterThan(0)
    runtime.getStore().dispatch({type: 'test/increment'})
    expect(notifications).toBe(1)
  })
})
