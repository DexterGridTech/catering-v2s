import {createCommandId, nowTimestampMs} from '@catering-v2s/kernel-base-contracts'
import type {ActorDefinition, ActorExecutionContext} from '@catering-v2s/kernel-base-runtime'
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime'
import {
  confirmMemberCommand,
  memberConfirmedCommand,
  memberPendingCommand,
  memberRejectedCommand,
  memberWithdrawnCommand,
  rejectMemberCommand,
  submitMemberCommand,
  withdrawMemberCommand,
} from '../../commands'
import {createInvalidMemberPayloadError, createNoPendingMemberError} from '../../errors'
import {moduleName} from '../../moduleName'
import {selectPendingMember} from '../../selectors'
import {memberActions} from '../../slice'
import type {PendingMember} from '../../types'

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readPendingPayload = (
  context: ActorExecutionContext,
): PendingMember => {
  const value: unknown = context.command.payload
  if (!isRecord(value)
    || typeof value.name !== 'string'
    || typeof value.phone !== 'string'
    || value.name.trim().length === 0
    || value.phone.trim().length === 0) {
    throw createInvalidMemberPayloadError(context)
  }
  return Object.freeze({name: value.name, phone: value.phone})
}

export const createSubmitMemberActor = (): ActorDefinition => defineActor(moduleName, 'submit', [
  onCommand(submitMemberCommand, async context => {
    const pending = readPendingPayload(context)
    context.dispatchAction(memberActions.setPending(pending))
    await context.dispatchCommand(memberPendingCommand, pending)
    return null
  }),
])

export const createConfirmMemberActor = (): ActorDefinition => defineActor(moduleName, 'confirm', [
  onCommand(confirmMemberCommand, async context => {
    const pending = selectPendingMember(context.getState())
    if (pending === null) return null
    const requestedAge = context.command.payload.age
    const age = typeof requestedAge === 'number' && Number.isFinite(requestedAge)
      ? requestedAge
      : undefined
    const member = Object.freeze({
      memberId: String(createCommandId()),
      name: pending.name,
      phone: pending.phone,
      ...(age === undefined ? {} : {age}),
      registeredAt: nowTimestampMs(),
    })
    context.dispatchAction(memberActions.confirmPending(member))
    await context.dispatchCommand(memberConfirmedCommand, {memberId: member.memberId})
    return null
  }),
])

export const createRejectMemberActor = (): ActorDefinition => defineActor(moduleName, 'reject', [
  onCommand(rejectMemberCommand, async context => {
    if (selectPendingMember(context.getState()) === null) return null
    await context.dispatchCommand(memberRejectedCommand, {reasonCode: 'customer-rejected'})
    return null
  }),
  onCommand(withdrawMemberCommand, async context => {
    if (selectPendingMember(context.getState()) === null) return null
    context.dispatchAction(memberActions.clearPending())
    await context.dispatchCommand(memberWithdrawnCommand, {})
    return null
  }),
])
