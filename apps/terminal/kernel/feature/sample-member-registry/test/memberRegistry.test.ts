import {describe, expect, it} from 'vitest'
import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import {releaseRuntimeForTest, runtimeStateSyncForTest} from '@catering-v2s/kernel-base-runtime/testing'
import {
  confirmMemberCommand,
  createSampleMemberRegistryModule,
  memberConfirmedCommand,
  memberPendingCommand,
  memberRejectedCommand,
  memberWithdrawnCommand,
  rejectMemberCommand,
  selectMembers,
  selectPendingMember,
  submitMemberCommand,
  withdrawMemberCommand,
} from '../src/index'
import {
  createEventRecorderModule,
  createMemoryStorageForTest,
  createTestRuntime,
  type RecordedEvent,
} from './support'
import {memberSliceName} from '../src/features/slices/slice'

describe('sample member registry owner module', () => {
  it('describes the owner commands, actors, slice, and isolated persistence contract', () => {
    const module = createSampleMemberRegistryModule()
    expect(module.moduleName).toBe('kernel.feature.sample-member-registry')
    expect(module.kind).toBe('owner')
    expect(module.dependencies?.map(dependency => dependency.moduleName)).toEqual([
      'kernel.base.runtime',
    ])
    expect(module.commands?.map(command => [command.name, command.visibility])).toEqual([
      ['kernel.feature.sample-member-registry.submit-member', 'public'],
      ['kernel.feature.sample-member-registry.confirm-member', 'public'],
      ['kernel.feature.sample-member-registry.reject-member', 'public'],
      ['kernel.feature.sample-member-registry.member-pending', 'public'],
      ['kernel.feature.sample-member-registry.member-confirmed', 'public'],
      ['kernel.feature.sample-member-registry.member-rejected', 'public'],
      ['kernel.feature.sample-member-registry.withdraw-member', 'public'],
      ['kernel.feature.sample-member-registry.member-withdrawn', 'public'],
    ])
    expect(module.actors?.map(actor => actor.name)).toEqual(['submit', 'confirm', 'reject'])
    expect(module.slices).toEqual([{
      name: 'kernel.feature.sample-member-registry.members',
      persistIntent: 'owner-only',
    }])
    expect(module.stateSlices).toHaveLength(1)
    expect(module.stateSlices?.[0]?.syncIntent).toBe('master-to-slave')
    expect(module.stateSlices?.[0]?.hasPersistence).toBe(true)
  })

  it('builds and applies the declared master-to-slave full member snapshot', async () => {
    const source = createTestRuntime([createSampleMemberRegistryModule()])
    const target = createTestRuntime([createSampleMemberRegistryModule()])
    try {
      await source.start()
      await target.start()
      await source.dispatchCommand(submitMemberCommand, {
        name: 'Sync me',
        phone: '010-0000-0000',
      }, {requestId: createRequestId()})

      const payload = runtimeStateSyncForTest(source).createFullSyncPayload(memberSliceName)
      expect(payload.status).toBe('ready')
      if (payload.status !== 'ready') return
      expect(payload.payload).toMatchObject({
        mode: 'authoritative',
        replaceMissing: true,
        entries: [expect.objectContaining({key: 'state'})],
      })

      const applied = runtimeStateSyncForTest(target).applyAuthoritativeSync(memberSliceName, payload.payload)
      expect(applied).toEqual({
        status: 'applied',
        sliceName: memberSliceName,
        changed: true,
      })
      expect(selectPendingMember(target.getState())).toEqual({
        name: 'Sync me',
        phone: '010-0000-0000',
      })
    } finally {
      releaseRuntimeForTest(source)
      releaseRuntimeForTest(target)
    }
  })

  it('submits a pending registration and emits its result event', async () => {
    const events: RecordedEvent[] = []
    const runtime = createTestRuntime([
      createSampleMemberRegistryModule(),
      createEventRecorderModule([memberPendingCommand], events),
    ])
    await runtime.start()

    const requestId = createRequestId()
    const result = await runtime.dispatchCommand(submitMemberCommand, {
      name: 'Alice',
      phone: '010-1234-5678',
    }, {requestId})

    expect(result.status).toBe('completed')
    expect(selectPendingMember(runtime.getState())).toEqual({
      name: 'Alice',
      phone: '010-1234-5678',
    })
    expect(selectMembers(runtime.getState())).toEqual([])
    expect(events).toEqual([expect.objectContaining({
      commandName: memberPendingCommand.commandName,
      payload: {name: 'Alice', phone: '010-1234-5678'},
      requestId: String(requestId),
    })])
  })

  it('treats confirmation with no pending registration as a late no-op', async () => {
    const runtime = createTestRuntime([createSampleMemberRegistryModule()])
    await runtime.start()

    const result = await runtime.dispatchCommand(confirmMemberCommand, {}, {requestId: createRequestId()})

    expect(result.status).toBe('completed')
    expect(result.actorResults[0]?.error).toBeNull()
    expect(selectMembers(runtime.getState())).toEqual([])
    expect(selectPendingMember(runtime.getState())).toBeNull()
  })

  it('confirms a pending registration into a member and clears pending state', async () => {
    const events: RecordedEvent[] = []
    const runtime = createTestRuntime([
      createSampleMemberRegistryModule(),
      createEventRecorderModule([memberPendingCommand, memberConfirmedCommand], events),
    ])
    await runtime.start()
    await runtime.dispatchCommand(submitMemberCommand, {
      name: 'Bob',
      phone: '010-9876-5432',
    }, {requestId: createRequestId()})

    const requestId = createRequestId()
    const result = await runtime.dispatchCommand(confirmMemberCommand, {age: 37}, {requestId})
    const members = selectMembers(runtime.getState())

    expect(result.status).toBe('completed')
    expect(selectPendingMember(runtime.getState())).toBeNull()
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({name: 'Bob', phone: '010-9876-5432', age: 37})
    expect(members[0]?.memberId).toEqual(expect.any(String))
    expect(members[0]?.registeredAt).toEqual(expect.any(Number))
    expect(events.at(-1)).toEqual(expect.objectContaining({
      commandName: memberConfirmedCommand.commandName,
      payload: {memberId: members[0]?.memberId},
      requestId: String(requestId),
    }))
  })

  it('restores committed members but does not restore an unconfirmed pending registration after restart', async () => {
    const storage = createMemoryStorageForTest()
    const first = createTestRuntime([createSampleMemberRegistryModule()], storage)
    await first.start()
    await first.dispatchCommand(submitMemberCommand, {
      name: 'Committed',
      phone: '010-2222-3333',
    }, {requestId: createRequestId()})
    await first.dispatchCommand(confirmMemberCommand, {}, {requestId: createRequestId()})
    await first.dispatchCommand(submitMemberCommand, {
      name: 'Pending',
      phone: '010-4444-5555',
    }, {requestId: createRequestId()})
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    const second = createTestRuntime([createSampleMemberRegistryModule()], storage)
    await second.start()

    expect(selectMembers(second.getState())).toEqual([expect.objectContaining({
      name: 'Committed',
      phone: '010-2222-3333',
    })])
    expect(selectPendingMember(second.getState())).toBeNull()
  })

  it('rejects a pending registration while retaining it for desk retry, and emits the explicit reason', async () => {
    const events: RecordedEvent[] = []
    const runtime = createTestRuntime([
      createSampleMemberRegistryModule(),
      createEventRecorderModule([memberPendingCommand, memberRejectedCommand], events),
    ])
    await runtime.start()
    await runtime.dispatchCommand(submitMemberCommand, {
      name: 'Carol',
      phone: '010-1111-2222',
    }, {requestId: createRequestId()})

    const requestId = createRequestId()
    const result = await runtime.dispatchCommand(rejectMemberCommand, {}, {requestId})

    expect(result.status).toBe('completed')
    expect(selectPendingMember(runtime.getState())).toEqual({
      name: 'Carol',
      phone: '010-1111-2222',
    })
    expect(selectMembers(runtime.getState())).toEqual([])
    expect(events.at(-1)).toEqual(expect.objectContaining({
      commandName: memberRejectedCommand.commandName,
      payload: {reasonCode: 'customer-rejected'},
      requestId: String(requestId),
    }))
  })

  it('withdraws a pending registration without emitting a rejection reason', async () => {
    const events: RecordedEvent[] = []
    const runtime = createTestRuntime([
      createSampleMemberRegistryModule(),
      createEventRecorderModule([memberPendingCommand, memberRejectedCommand, memberWithdrawnCommand], events),
    ])
    await runtime.start()
    await runtime.dispatchCommand(submitMemberCommand, {
      name: 'Dana',
      phone: '010-3333-4444',
    }, {requestId: createRequestId()})

    const requestId = createRequestId()
    const result = await runtime.dispatchCommand(withdrawMemberCommand, {}, {requestId})

    expect(result.status).toBe('completed')
    expect(selectPendingMember(runtime.getState())).toBeNull()
    expect(selectMembers(runtime.getState())).toEqual([])
    expect(events.at(-1)).toEqual(expect.objectContaining({
      commandName: memberWithdrawnCommand.commandName,
      payload: {},
      requestId: String(requestId),
    }))
    expect(events.some(event => event.commandName === memberRejectedCommand.commandName)).toBe(false)
  })

  it('makes late reject and withdraw commands no-ops after the first terminal decision', async () => {
    const events: RecordedEvent[] = []
    const runtime = createTestRuntime([
      createSampleMemberRegistryModule(),
      createEventRecorderModule([memberRejectedCommand, memberWithdrawnCommand], events),
    ])
    await runtime.start()
    await runtime.dispatchCommand(submitMemberCommand, {
      name: 'Eve',
      phone: '010-5555-6666',
    }, {requestId: createRequestId()})
    await runtime.dispatchCommand(withdrawMemberCommand, {}, {requestId: createRequestId()})
    const lateReject = await runtime.dispatchCommand(rejectMemberCommand, {}, {requestId: createRequestId()})
    const lateWithdraw = await runtime.dispatchCommand(withdrawMemberCommand, {}, {requestId: createRequestId()})

    expect(lateReject.status).toBe('completed')
    expect(lateWithdraw.status).toBe('completed')
    expect(events).toHaveLength(1)
    expect(events[0]?.commandName).toBe(memberWithdrawnCommand.commandName)
  })

  it('requires request ids for externally dispatched public member request commands', async () => {
    const runtime = createTestRuntime([createSampleMemberRegistryModule()])
    await runtime.start()

    await expect(runtime.dispatchCommand(submitMemberCommand, {
      name: 'Alice',
      phone: '010-1234-5678',
    })).rejects.toMatchObject({code: 'ERR_TER_RUNTIME_REQUEST_ID_REQUIRED'})
    await expect(runtime.dispatchCommand(confirmMemberCommand, {}))
      .rejects.toMatchObject({code: 'ERR_TER_RUNTIME_REQUEST_ID_REQUIRED'})
    await expect(runtime.dispatchCommand(rejectMemberCommand, {}))
      .rejects.toMatchObject({code: 'ERR_TER_RUNTIME_REQUEST_ID_REQUIRED'})
    await expect(runtime.dispatchCommand(withdrawMemberCommand, {}))
      .rejects.toMatchObject({code: 'ERR_TER_RUNTIME_REQUEST_ID_REQUIRED'})
  })
})
