import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from './moduleName'
import type {MemberRejectedPayload} from './types'

export type EmptyPayload = Readonly<{}>

export const submitMemberCommand = defineCommand<Readonly<{name: string; phone: string}>>(moduleName, {
  name: 'submit-member',
  visibility: 'public',
})

export const confirmMemberCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'confirm-member',
  visibility: 'public',
})

export const rejectMemberCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'reject-member',
  visibility: 'public',
})

export const memberPendingCommand = defineCommand<Readonly<{name: string; phone: string}>>(moduleName, {
  name: 'member-pending',
  visibility: 'public',
})

export const memberConfirmedCommand = defineCommand<Readonly<{memberId: string}>>(moduleName, {
  name: 'member-confirmed',
  visibility: 'public',
})

export const memberRejectedCommand = defineCommand<MemberRejectedPayload>(moduleName, {
  name: 'member-rejected',
  visibility: 'public',
})
