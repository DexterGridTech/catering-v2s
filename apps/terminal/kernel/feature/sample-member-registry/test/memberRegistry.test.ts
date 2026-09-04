import {describe, expect, it} from 'vitest'
import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import {
  confirmMemberCommand,
  createSampleMemberRegistryModule,
  memberConfirmedCommand,
  memberPendingCommand,
  memberRejectedCommand,
  rejectMemberCommand,
  selectMembers,
  selectPendingMember,
  submitMemberCommand,
} from '../src/index'
import {
  createEventRecorderModule,
  createMemoryStorageForTest,
  createTestRuntime,
  type RecordedEvent,
} from './support'

describe('sample member registry owner module', () => {
  it('describes the owner commands, actors, slice, and isolated persistence contract', () => {
    const module = createSampleMemberRegistryModule()
    expect(module.moduleName).toBe('kernel.feature.sample-member-registry')
    expect(module.kind).toBe('owner')
    expect(module.dependencies?.map(dependency => dependency.moduleName)).toEqual([
      'kernel.base.contracts',
      'kernel.base.runtime',
      'kernel.base.state',
    ])
    expect(module.commands?.map(command => [command.name, command.visibility])).toEqual([
      ['kernel.feature.sample-member-registry.submit-member', 'public'],
      ['kernel.feature.sample-member-registry.confirm-member', 'public'],
      ['kernel.feature.sample-member-registry.reject-member', 'public'],
      ['kernel.feature.sample-member-registry.member-pending', 'public'],
      ['kernel.feature.sample-member-registry.member-confirmed', 'public'],
      ['kernel.feature.sample-member-registry.member-rejected', 'public'],
    ])
    expect(module.actors?.map(actor => actor.name)).toEqual(['submit', 'confirm', 'reject'])
    expect(module.slices).toEqual([{
      name: 'kernel.feature.sample-member-registry.members',
      persistIntent: 'owner-only',
    }])
    expect(module.stateSlices).toHaveLength(1)
    expect(module.stateSlices?.[0]?.syncIntent).toBe('isolated')
    expect(module.stateSlices?.[0]?.hasPersistence).toBe(true)
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

  it('rejects confirmation with no pending registration without mutating members', async () => {
    const runtime = createTestRuntime([createSampleMemberRegistryModule()])
    await runtime.start()

    const result = await runtime.dispatchCommand(confirmMemberCommand, {}, {requestId: createRequestId()})

    expect(result.status).toBe('error')
    expect(result.actorResults[0]?.error).toMatchObject({
      code: 'ERR_TER_SAMPLE_MEMBER_NO_PENDING',
    })
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
    const result = await runtime.dispatchCommand(confirmMemberCommand, {}, {requestId})
    const members = selectMembers(runtime.getState())

    expect(result.status).toBe('completed')
    expect(selectPendingMember(runtime.getState())).toBeNull()
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({name: 'Bob', phone: '010-9876-5432'})
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

  it('rejects a pending registration, clears it, and emits the explicit reason', async () => {
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
    expect(selectPendingMember(runtime.getState())).toBeNull()
    expect(selectMembers(runtime.getState())).toEqual([])
    expect(events.at(-1)).toEqual(expect.objectContaining({
      commandName: memberRejectedCommand.commandName,
      payload: {reasonCode: 'customer-rejected'},
      requestId: String(requestId),
    }))
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
  })
})
