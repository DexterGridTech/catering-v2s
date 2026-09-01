import {describe, expect, it, vi} from 'vitest'
import {
  createCommandId,
  createNodeId,
  createRequestId,
  createRuntimeInstanceId,
} from '@catering-v2s/kernel-base-contracts'
import {
  createRuntime,
  defineActor,
  defineCommand,
  onCommand,
  selectRuntimeInstanceMode,
  setRuntimeInstanceModeCommand,
  type ActorExecutionContext,
  type RuntimeModule,
} from '../src/index'
import {createSetRuntimeInstanceModeActor} from '../src/features/actors/setRuntimeInstanceModeActor'
import {createStateRuntime} from '@catering-v2s/kernel-base-state'
import {runtimeInstanceModeSlice} from '../src/features/slices/runtimeInstanceMode'
import {createTestPlatformPorts, createTestRuntimeInput, createTestSlice, deferred} from './testSupport'

type CommandSpec = NonNullable<RuntimeModule['commandDefinitions']>[number]

const moduleFor = (
  moduleName: string,
  commands: readonly CommandSpec[],
  actors: readonly ReturnType<typeof defineActor>[] = [],
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

describe('runtime role and route boundaries', () => {
  it('I-1 defaults every new runtime to MASTER', async () => {
    const runtime = createRuntime(createTestRuntimeInput({runtimeName: 'runtime-master-default'}))
    await runtime.start()
    expect(Reflect.get(runtime.getState()['kernel.base.runtime.instance-mode'] ?? {}, 'instanceMode')).toBe('MASTER')
  })

  it('I-1 fails closed when the role slice is missing', () => {
    expect(() => selectRuntimeInstanceMode({} as never)).toThrow(
      'Missing runtime instance mode slice: kernel.base.runtime.instance-mode',
    )
  })

  it('I-2 runs role effects before the write, is idempotent, and preserves state on failure', async () => {
    let mode: 'MASTER' | 'SLAVE' = 'MASTER'
    const effectOrder: string[] = []
    const effectActor = createSetRuntimeInstanceModeActor([
      async ({nextMode}) => { effectOrder.push(`effect:${nextMode}`); if (nextMode === 'SLAVE') mode = 'MASTER' },
    ])
    const context = {
      runtimeId: createRuntimeInstanceId(),
      localNodeId: createNodeId(),
      platformPorts: createTestPlatformPorts(),
      command: {
        runtimeId: createRuntimeInstanceId(), requestId: createRequestId(), commandId: createCommandId(),
        parentCommandId: null, commandName: 'kernel.base.runtime.set-instance-mode',
        payload: {instanceMode: 'SLAVE' as const}, target: 'local' as const, routeContext: null, dispatchedAt: 1,
      },
      actor: {actorKey: 'kernel.base.runtime.instance-mode', moduleName: 'kernel.base.runtime', actorName: 'instance-mode'},
      getState: () => ({'kernel.base.runtime.instance-mode': {instanceMode: mode}}),
      dispatchAction: action => { effectOrder.push(`write:${String(Reflect.get(action, 'payload'))}`); mode = Reflect.get(action, 'payload') as 'MASTER' | 'SLAVE'; return action },
      flushPersistence: async () => ({status: 'succeeded', writtenKeys: [], removedKeys: []}),
      subscribeState: () => () => undefined,
      dispatchCommand: async () => ({requestId: null, commandId: createCommandId(), status: 'completed', actorResults: []}),
      requestApplicationReset: () => undefined,
    } satisfies ActorExecutionContext<{instanceMode: 'MASTER' | 'SLAVE'}>
    const result = await effectActor.handlers[0]!.handle(context)
    expect(result).toMatchObject({changed: true, currentMode: 'SLAVE'})
    expect(effectOrder).toEqual(['effect:SLAVE', 'write:SLAVE'])
    effectOrder.length = 0
    const same = await effectActor.handlers[0]!.handle(context)
    expect(same).toMatchObject({changed: false, previousMode: 'SLAVE', currentMode: 'SLAVE'})
    expect(effectOrder).toEqual([])
    const failingActor = createSetRuntimeInstanceModeActor([() => { throw new Error('effect failed') }])
    mode = 'MASTER'
    await expect(failingActor.handlers[0]!.handle(context)).rejects.toThrow('effect failed')
    expect(mode).toBe('MASTER')

    let seamCalled = false
    const seamModule = moduleFor('test.role-effect-seam', [], [], {
      roleChangeEffects: [({previousMode, nextMode}) => {
        seamCalled = previousMode === 'MASTER' && nextMode === 'SLAVE'
      }],
    })
    const runtime = createRuntime(createTestRuntimeInput({modules: [seamModule]}))
    await runtime.start()
    const runtimeResult = await runtime.dispatchCommand(
      setRuntimeInstanceModeCommand,
      {instanceMode: 'SLAVE'},
    )
    expect(runtimeResult.status).toBe('completed')
    expect(seamCalled).toBe(true)
    expect(selectRuntimeInstanceMode(runtime.getState())).toBe('SLAVE')
    expect(runtime.journal.list()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'role.change-requested',
        previousMode: 'MASTER',
        nextMode: 'SLAVE',
        commandName: 'kernel.base.runtime.set-instance-mode',
      }),
      expect.objectContaining({
        kind: 'role.changed',
        previousMode: 'MASTER',
        nextMode: 'SLAVE',
        commandName: 'kernel.base.runtime.set-instance-mode',
      }),
    ]))
  })

  it('I-2 fails closed for an invalid role payload before effects or role signals', async () => {
    let effectCalls = 0
    const module = moduleFor('test.role-invalid-payload', [], [], {
      roleChangeEffects: [() => { effectCalls += 1 }],
    })
    const runtime = createRuntime(createTestRuntimeInput({modules: [module]}))
    await runtime.start()

    const result = await runtime.dispatchCommand(
      'kernel.base.runtime.set-instance-mode',
      {instanceMode: 'INVALID'},
    )

    expect(result.status).toBe('error')
    expect(effectCalls).toBe(0)
    expect(selectRuntimeInstanceMode(runtime.getState())).toBe('MASTER')
    expect(runtime.journal.list().some(event => event.kind === 'role.change-requested' || event.kind === 'role.changed')).toBe(false)
  })

  it('I-3 rejects inbound sync for the isolated role slice', async () => {
    const runtime = await createStateRuntime({
      runtimeName: 'runtime-isolated-role', environmentMode: 'TEST', slices: [runtimeInstanceModeSlice],
      logger: createTestPlatformPorts().logger,
      plainStorage: createTestPlatformPorts().persistKv,
      protectedStorage: createTestPlatformPorts().persistSecure,
      persistenceKey: 'runtime-isolated-role', storageTimeouts: {readMs: 50, writeMs: 50, resetMs: 50},
      persistenceDebounceMs: 0,
    })
    const result = runtime.applyAuthoritativeSync('kernel.base.runtime.instance-mode', {
      mode: 'authoritative', replaceMissing: true, entries: [],
    })
    expect(result).toEqual({status: 'skipped', sliceName: 'kernel.base.runtime.instance-mode', reason: 'SYNC_NOT_DECLARED'})
    expect(Reflect.get(runtime.getState()['kernel.base.runtime.instance-mode'] ?? {}, 'instanceMode')).toBe('MASTER')
  })

  it('keeps a late role transition journal-visible after the command accumulator is released', async () => {
    vi.useFakeTimers()
    try {
      const effectRelease = deferred<void>()
      const roleModule = moduleFor('test.role-late', [], [], {
        roleChangeEffects: [async () => { await effectRelease.promise }],
      })
      const runtime = createRuntime(createTestRuntimeInput({modules: [roleModule]}))
      await runtime.start()
      const pending = runtime.dispatchCommand(setRuntimeInstanceModeCommand, {instanceMode: 'SLAVE'})
      await vi.advanceTimersByTimeAsync(60_000)
      const timedOut = await pending
      expect(timedOut.status).toBe('timed-out')
      effectRelease.resolve()
      await vi.runAllTicks()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      expect(runtime.journal.list()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'role.changed',
          commandName: 'kernel.base.runtime.set-instance-mode',
          previousMode: 'MASTER',
          nextMode: 'SLAVE',
          visibility: 'internal',
        }),
      ]))
    } finally {
      vi.useRealTimers()
    }
  })

  it('C-1 inherits a complete route context by default and replaces it only as a whole', async () => {
    const parent = defineCommand<Readonly<{}>>('test.route', {name: 'parent', visibility: 'internal'})
    const child = defineCommand<Readonly<{}>>('test.route', {name: 'child', visibility: 'internal'})
    const observed: Array<{route: unknown; parent: unknown}> = []
    const childActor = defineActor('test.route', 'child', [onCommand(child, context => {
      observed.push({route: context.command.routeContext, parent: context.command.parentCommandId})
      return null
    })])
    const parentActor = defineActor('test.route', 'parent', [onCommand(parent, async context => {
      await context.dispatchCommand(child, {})
      await context.dispatchCommand(child, {}, {routeContext: {workspace: 'MAIN', instanceMode: 'SLAVE'}})
      return null
    })])
    const runtime = createRuntime(createTestRuntimeInput({modules: [moduleFor('test.route', [parent, child], [parentActor, childActor])]}))
    await runtime.start()
    const requestId = createRequestId()
    const routeContext = Object.freeze({workspace: 'BRANCH', instanceMode: 'MASTER', displayMode: 'PRIMARY'})
    const result = await runtime.dispatchCommand(parent, {}, {requestId, routeContext})
    expect(result.status).toBe('completed')
    expect(observed[0]?.route).toBe(routeContext)
    expect(observed[1]?.route).toEqual({workspace: 'MAIN', instanceMode: 'SLAVE'})
    expect(observed[0]?.parent).not.toBeNull()
    expect(observed[1]?.parent).toBe(observed[0]?.parent)
  })
})
