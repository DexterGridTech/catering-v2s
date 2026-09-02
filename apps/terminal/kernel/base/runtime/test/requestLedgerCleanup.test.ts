import {describe, expect, it, vi} from 'vitest'
import {
  createCommandId,
  createRequestId,
  type RequestId,
} from '@catering-v2s/kernel-base-contracts'
import type {StateJsonValue, SyncStateDiff} from '@catering-v2s/kernel-base-state'
import type {StateStoragePort} from '@catering-v2s/kernel-base-platform-ports'
import {
  createRuntime,
  defineActor,
  defineCommand,
  onCommand,
  runtimeInstanceModeChangedCommand,
  selectRequestExecutionView,
  selectRuntimeInstanceMode,
  setRuntimeInstanceModeCommand,
  type ActorExecutionContext,
  type CommandDefinition,
  type RuntimeModule,
} from '../src/index'
import {cleanupRequestLedgerCommand} from '../src/features/commands/cleanupRequestLedger'
import {
  runtimeRequestLedgerMasterSliceName,
  runtimeRequestLedgerSlaveSliceName,
} from '../src/features/slices/requestLedger'
import {runtimeStateSyncForTest} from '../src/testing/runtimeStateSyncForTest'
import {releaseRuntimeForTest} from '../src/testing/releaseRuntimeForTest'
import {createSharedMemoryStoragePort, createTestRuntimeInput, deferred} from './testSupport'
import type {CommandExecutionObservation, ActorExecutionRecord} from '../src/types/execution'
import type {RequestExecutionRecord} from '../src/types/requestLedger'
import type {RuntimeLimits} from '../src/types/limits'

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

const runtimeWith = (
  module: RuntimeModule,
  input: Readonly<{
    runtimeName?: string
    plainStorage?: StateStoragePort
    protectedStorage?: StateStoragePort
    limits?: Partial<RuntimeLimits>
  }> = {},
) => createRuntime({
  ...createTestRuntimeInput({
    modules: [module],
    runtimeName: input.runtimeName,
    plainStorage: input.plainStorage,
    protectedStorage: input.protectedStorage,
  }),
  limits: input.limits,
})

const completedActor = (actorKey: string): ActorExecutionRecord => Object.freeze({
  actorKey,
  status: 'completed',
  startedAt: 1,
  completedAt: 2,
  result: {ok: true},
  error: null,
})

const observation = (input: Readonly<{
  commandId?: ReturnType<typeof createCommandId>
  status?: ActorExecutionRecord['status']
  startedAt?: number
  completedAt?: number | null
  commandName?: string
}> = {}): CommandExecutionObservation => Object.freeze({
  commandId: input.commandId ?? createCommandId(),
  parentCommandId: null,
  commandName: input.commandName ?? 'test.cleanup.command',
  target: 'local',
  allowNoActor: false,
  actorResults: Object.freeze([input.status === 'running'
    ? Object.freeze({
      actorKey: 'test.cleanup.actor', status: 'running' as const, startedAt: 1, completedAt: null,
      result: null, error: null,
    })
    : completedActor('test.cleanup.actor')]),
  startedAt: input.startedAt ?? 1,
  completedAt: input.completedAt === undefined
    ? (input.status === 'running' ? null : 2)
    : input.completedAt,
  displayMode: null,
})

const record = (
  requestId: RequestId,
  commands: readonly CommandExecutionObservation[],
): RequestExecutionRecord => Object.freeze({
  requestId,
  workspace: 'MAIN',
  startedAt: 1,
  commands: Object.freeze([...commands]),
})

const applyRecord = (
  runtime: ReturnType<typeof createRuntime>,
  sliceName: typeof runtimeRequestLedgerMasterSliceName | typeof runtimeRequestLedgerSlaveSliceName,
  requestId: RequestId,
  value: RequestExecutionRecord,
  updatedAt: number,
): void => {
  const result: SyncStateDiff = {
    mode: 'authoritative',
    replaceMissing: false,
    entries: [{key: requestId, value: {value, updatedAt}}],
  }
  expect(runtimeStateSyncForTest(runtime).applyAuthoritativeSync(sliceName, result).status).toBe('applied')
}

const makeCommandModule = (
  moduleName: string,
  handler: (context: ActorExecutionContext<Readonly<{}>>) => StateJsonValue | void | Promise<StateJsonValue | void>,
): {module: RuntimeModule; command: CommandDefinition<Readonly<{}>>} => {
  const command = defineCommand<Readonly<{}>>(moduleName, {name: 'run', visibility: 'public'})
  const actor = defineActor(moduleName, 'worker', [onCommand(command, handler)])
  return {module: moduleFor(moduleName, [command], [actor]), command}
}

describe('runtime request ledger cleanup', () => {
  it('E-1 deletes an expired terminal local half through the internal command actor', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    try {
      const {module, command} = makeCommandModule('test.cleanup.expired', () => ({done: true}))
      const runtime = runtimeWith(module, {
        limits: {maxCommandDepth: 1, requestRetentionMs: 10, requestMaxResidenceMs: 100_000},
      })
      await runtime.start()
      const requestId = createRequestId()
      await runtime.dispatchCommand(command, {}, {requestId})
      vi.setSystemTime(20)

      const result = await runtime.dispatchCommand(cleanupRequestLedgerCommand, {})
      expect(result.status).toBe('completed')
      expect(selectRequestExecutionView(runtime.getState(), requestId)).toBeNull()
      releaseRuntimeForTest(runtime)
    } finally {
      vi.useRealTimers()
    }
  })

  it('E-2 preserves running requests and local terminal facts while the peer is running', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    try {
      const blocked = deferred<Readonly<{done: boolean}>>()
      const {module, command} = makeCommandModule('test.cleanup.running', () => blocked.promise)
      const runtime = runtimeWith(module, {
        limits: {maxCommandDepth: 1, requestRetentionMs: 10, requestMaxResidenceMs: 100_000},
      })
      await runtime.start()
      const requestId = createRequestId()
      const pending = runtime.dispatchCommand(command, {}, {requestId})
      await Promise.resolve()
      vi.setSystemTime(20)
      await runtime.dispatchCommand(cleanupRequestLedgerCommand, {})
      expect(selectRequestExecutionView(runtime.getState(), requestId)?.status).toBe('started')
      blocked.resolve({done: true})
      await pending
      releaseRuntimeForTest(runtime)
    } finally {
      vi.useRealTimers()
    }
  })

  it('E-3/E-6 deletes only an expired local half and never an only-peer half', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    try {
      const {module} = makeCommandModule('test.cleanup.peer-boundary', () => null)
      const runtime = runtimeWith(module, {
        limits: {maxCommandDepth: 1, requestRetentionMs: 10, requestMaxResidenceMs: 100_000},
      })
      await runtime.start()
      const localRequestId = createRequestId()
      const peerRequestId = createRequestId()
      applyRecord(runtime, runtimeRequestLedgerMasterSliceName, localRequestId, record(localRequestId, [observation()]), 1)
      applyRecord(runtime, runtimeRequestLedgerSlaveSliceName, peerRequestId, record(peerRequestId, [observation()]), 1)
      vi.setSystemTime(200)

      await runtime.dispatchCommand(cleanupRequestLedgerCommand, {})
      expect(selectRequestExecutionView(runtime.getState(), localRequestId)).toBeNull()
      expect(selectRequestExecutionView(runtime.getState(), peerRequestId)).not.toBeNull()
      expect(selectRequestExecutionView(runtime.getState(), peerRequestId)?.timeSource).toBe('peer')
      releaseRuntimeForTest(runtime)
    } finally {
      vi.useRealTimers()
    }
  })

  it('E-2 keeps a local terminal half when a distinct peer command is still running within max residence', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    try {
      const {module} = makeCommandModule('test.cleanup.merged-running', () => null)
      const runtime = runtimeWith(module, {
        limits: {maxCommandDepth: 1, requestRetentionMs: 10, requestMaxResidenceMs: 100_000},
      })
      await runtime.start()
      const requestId = createRequestId()
      applyRecord(runtime, runtimeRequestLedgerMasterSliceName, requestId, record(requestId, [observation()]), 1)
      applyRecord(runtime, runtimeRequestLedgerSlaveSliceName, requestId, record(requestId, [observation({status: 'running'})]), 2)
      vi.setSystemTime(20)

      expect(selectRequestExecutionView(runtime.getState(), requestId)?.status).toBe('started')
      await runtime.dispatchCommand(cleanupRequestLedgerCommand, {})
      expect(selectRequestExecutionView(runtime.getState(), requestId)).not.toBeNull()
      releaseRuntimeForTest(runtime)
    } finally {
      vi.useRealTimers()
    }
  })

  it('E-2 deletes a peer-running merged entry after max residence independently of terminal retention', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    try {
      const {module} = makeCommandModule('test.cleanup.peer-running-residence', () => null)
      const runtime = runtimeWith(module, {
        limits: {maxCommandDepth: 1, requestRetentionMs: 10, requestMaxResidenceMs: 100_000},
      })
      await runtime.start()
      const requestId = createRequestId()
      applyRecord(runtime, runtimeRequestLedgerMasterSliceName, requestId, record(requestId, [observation()]), 1)
      applyRecord(runtime, runtimeRequestLedgerSlaveSliceName, requestId, record(requestId, [observation({status: 'running'})]), 2)
      vi.setSystemTime(100_002)

      expect(runtime.getState()[runtimeRequestLedgerMasterSliceName]).toHaveProperty(String(requestId))
      expect(selectRequestExecutionView(runtime.getState(), requestId)?.status).toBe('started')
      const cleanupResult = await runtime.dispatchCommand(cleanupRequestLedgerCommand, {})
      expect(cleanupResult.actorResults).toEqual(expect.arrayContaining([
        expect.objectContaining({
          result: expect.objectContaining({deletedRequestIds: [requestId]}),
        }),
      ]))
      expect(runtime.getState()[runtimeRequestLedgerMasterSliceName]).not.toHaveProperty(String(requestId))
      expect(selectRequestExecutionView(runtime.getState(), requestId)).toMatchObject({
        requestId,
        timeSource: 'peer',
        status: 'started',
      })
      releaseRuntimeForTest(runtime)
    } finally {
      vi.useRealTimers()
    }
  })

  it('E-5 documents the accepted peer-clock window after a role flip', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(100)
      const {module: fastModule} = makeCommandModule('test.cleanup.peer-clock-fast', () => null)
      const fast = runtimeWith(fastModule, {
        limits: {maxCommandDepth: 1, requestRetentionMs: 10, requestMaxResidenceMs: 100_000},
      })
      await fast.start()
      const fastRequestId = createRequestId()
      applyRecord(fast, runtimeRequestLedgerSlaveSliceName, fastRequestId, record(fastRequestId, [observation()]), 1_000)
      await fast.dispatchCommand(setRuntimeInstanceModeCommand, {instanceMode: 'SLAVE'})
      vi.setSystemTime(110)
      await fast.dispatchCommand(cleanupRequestLedgerCommand, {})
      expect(selectRequestExecutionView(fast.getState(), fastRequestId)?.timeSource).toBe('local')
      expect(selectRequestExecutionView(fast.getState(), fastRequestId)).not.toBeNull()
      releaseRuntimeForTest(fast)

      vi.setSystemTime(100)
      const {module: slowModule} = makeCommandModule('test.cleanup.peer-clock-slow', () => null)
      const slow = runtimeWith(slowModule, {
        limits: {maxCommandDepth: 1, requestRetentionMs: 10, requestMaxResidenceMs: 100_000},
      })
      await slow.start()
      const slowRequestId = createRequestId()
      applyRecord(slow, runtimeRequestLedgerSlaveSliceName, slowRequestId, record(slowRequestId, [observation()]), 1)
      await slow.dispatchCommand(setRuntimeInstanceModeCommand, {instanceMode: 'SLAVE'})
      vi.setSystemTime(110)
      await slow.dispatchCommand(cleanupRequestLedgerCommand, {})
      expect(selectRequestExecutionView(slow.getState(), slowRequestId)).toBeNull()
      releaseRuntimeForTest(slow)
    } finally {
      vi.useRealTimers()
    }
  })

  it('E-4 clears the old role half before writing the new role', async () => {
    vi.useFakeTimers()
    try {
      const {module} = makeCommandModule('test.cleanup.role-flip', () => ({done: true}))
      const runtime = runtimeWith(module)
      await runtime.start()
      const requestId = createRequestId()
      await runtime.dispatchCommand('test.cleanup.role-flip.run', {}, {requestId})
      expect(selectRequestExecutionView(runtime.getState(), requestId)).not.toBeNull()

      const result = await runtime.dispatchCommand(setRuntimeInstanceModeCommand, {instanceMode: 'SLAVE'})
      expect(result.status).toBe('completed')
      expect(selectRuntimeInstanceMode(runtime.getState())).toBe('SLAVE')
      expect(runtime.getState()[runtimeRequestLedgerMasterSliceName]).toEqual({})
      expect(selectRequestExecutionView(runtime.getState(), requestId)).toBeNull()
      releaseRuntimeForTest(runtime)
    } finally {
      vi.useRealTimers()
    }
  })

  it('E-4 preserves the original request start when role change writes the new half', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1000)
      const runtime = runtimeWith(moduleFor('test.cleanup.role-request', [], []))
      await runtime.start()
      const requestId = createRequestId()

      const result = await runtime.dispatchCommand(setRuntimeInstanceModeCommand, {instanceMode: 'SLAVE'}, {
        requestId,
        onLifecycleEvent: event => {
          if (event.kind === 'command.started' && event.commandName === setRuntimeInstanceModeCommand.commandName) {
            vi.setSystemTime(5000)
          }
        },
      })

      expect(result.status).toBe('completed')
      expect(selectRuntimeInstanceMode(runtime.getState())).toBe('SLAVE')
      expect(runtime.getState()[runtimeRequestLedgerMasterSliceName]).toEqual({})
      const view = selectRequestExecutionView(runtime.getState(), requestId)
      expect(view).toMatchObject({requestId, status: 'completed', timeSource: 'local'})
      expect(view?.startedAt).toBe(1000)
      expect(view?.commands.map(command => command.commandName).sort()).toEqual([
        runtimeInstanceModeChangedCommand.commandName,
        setRuntimeInstanceModeCommand.commandName,
      ].sort())
      const parent = view?.commands.find(command => command.commandName === setRuntimeInstanceModeCommand.commandName)
      const child = view?.commands.find(command => command.commandName === runtimeInstanceModeChangedCommand.commandName)
      expect(parent?.parentCommandId).toBeNull()
      expect(child?.parentCommandId).toBe(parent?.commandId)
      expect(runtime.getState()[runtimeRequestLedgerSlaveSliceName]).toHaveProperty(String(requestId))
      releaseRuntimeForTest(runtime)
    } finally {
      vi.useRealTimers()
    }
  })

  it('E-4 keeps the committed role when a post-commit consumer fails', async () => {
    const failingConsumer = defineActor('test.cleanup.role-consumer-failure', 'consumer', [onCommand(
      runtimeInstanceModeChangedCommand,
      () => { throw new Error('post-commit consumer failed') },
    )])
    const {module} = makeCommandModule('test.cleanup.role-consumer-failure', () => ({done: true}))
    const runtime = runtimeWith({
      ...module,
      actors: [{name: 'handler'}, {name: 'consumer'}],
      actorDefinitions: [...module.actorDefinitions ?? [], failingConsumer],
    })
    await runtime.start()
    const requestId = createRequestId()
    await runtime.dispatchCommand('test.cleanup.role-consumer-failure.run', {}, {requestId})

    const result = await runtime.dispatchCommand(setRuntimeInstanceModeCommand, {instanceMode: 'SLAVE'})
    expect(result.status).toBe('completed')
    expect(selectRuntimeInstanceMode(runtime.getState())).toBe('SLAVE')
    expect(selectRequestExecutionView(runtime.getState(), requestId)).toBeNull()
    expect(runtime.journal.list()).toEqual(expect.arrayContaining([
      expect.objectContaining({commandName: 'kernel.base.runtime.instance-mode-changed', kind: 'actor.error'}),
    ]))
    releaseRuntimeForTest(runtime)
  })

  it('E-4 keeps role and ledger when the role action cannot dispatch', async () => {
    const {module} = makeCommandModule('test.cleanup.role-clear-failure', () => ({done: true}))
    const runtime = runtimeWith(module)
    await runtime.start()
    const requestId = createRequestId()
    await runtime.dispatchCommand('test.cleanup.role-clear-failure.run', {}, {requestId})
    const dispatch = vi.spyOn(runtime.getStore(), 'dispatch').mockImplementation(() => {
      throw new Error('role clear dispatch failed')
    })
    try {
      const result = await runtime.dispatchCommand(setRuntimeInstanceModeCommand, {instanceMode: 'SLAVE'})
      expect(result.status).toBe('error')
      expect(selectRuntimeInstanceMode(runtime.getState())).toBe('MASTER')
      expect(selectRequestExecutionView(runtime.getState(), requestId)).not.toBeNull()
    } finally {
      dispatch.mockRestore()
      expect(releaseRuntimeForTest(runtime)).toBe(0)
    }
  })

  it('does not register a cleanup timer and scans before the first write of a new request', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    try {
      const {module, command} = makeCommandModule('test.cleanup.new-request-scan', () => ({done: true}))
      const runtime = runtimeWith(module, {
        limits: {maxCommandDepth: 1, requestRetentionMs: 10, requestMaxResidenceMs: 100_000},
      })
      await runtime.start()
      const expiredRequestId = createRequestId()
      applyRecord(runtime, runtimeRequestLedgerMasterSliceName, expiredRequestId, record(expiredRequestId, [observation()]), 1)
      vi.setSystemTime(20)
      await vi.advanceTimersByTimeAsync(1_000)
      expect(selectRequestExecutionView(runtime.getState(), expiredRequestId)).not.toBeNull()

      const newRequestId = createRequestId()
      await runtime.dispatchCommand(command, {}, {requestId: newRequestId})
      expect(selectRequestExecutionView(runtime.getState(), expiredRequestId)).toBeNull()
      expect(selectRequestExecutionView(runtime.getState(), newRequestId)).not.toBeNull()
    releaseRuntimeForTest(runtime)
    } finally {
      vi.useRealTimers()
    }
  })

  it('R-1 does not persist ledger facts but does recover the owner role', async () => {
    const plain = createSharedMemoryStoragePort()
    const protectedStorage = createSharedMemoryStoragePort()
    const {module} = makeCommandModule('test.cleanup.restart', () => ({done: true}))
    const first = runtimeWith(module, {
      runtimeName: 'cleanup-restart-first',
      plainStorage: plain.storage,
      protectedStorage: protectedStorage.storage,
    })
    await first.start()
    await first.dispatchCommand(setRuntimeInstanceModeCommand, {instanceMode: 'SLAVE'})
    await first.dispatchCommand('test.cleanup.restart.run', {}, {requestId: createRequestId()})
    await Promise.resolve()
    await Promise.resolve()
    releaseRuntimeForTest(first)

    const second = runtimeWith(module, {
      runtimeName: 'cleanup-restart-second',
      plainStorage: plain.storage,
      protectedStorage: protectedStorage.storage,
    })
    await second.start()
    expect(selectRuntimeInstanceMode(second.getState())).toBe('SLAVE')
    expect(Object.keys(second.getState()[runtimeRequestLedgerMasterSliceName] ?? {})).toHaveLength(0)
    expect(Object.keys(second.getState()[runtimeRequestLedgerSlaveSliceName] ?? {})).toHaveLength(0)
    releaseRuntimeForTest(second)
  })
})
