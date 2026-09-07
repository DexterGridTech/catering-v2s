import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from './moduleName'

export type EmptyPayload = Readonly<{}>

export type MemberFormCancelledPayload = Readonly<{readonly dirty: boolean}>
export type DraftDiscardIntent = 'cancel-form' | 'logout'
export type RegistryNoticeReason = 'customer-rejected' | 'system-failure'
export type DeskSystemOperation = 'submit-member' | 'confirm-member' | 'reject-member' | 'withdraw-member' | 'logout'

export const memberFormOpenedCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'member-form-opened',
  visibility: 'public',
})

export const memberFormCancelledCommand = defineCommand<MemberFormCancelledPayload>(moduleName, {
  name: 'member-form-cancelled',
  visibility: 'public',
})

export const memberDraftDiscardedCommand = defineCommand<Readonly<{readonly intent: DraftDiscardIntent}>>(moduleName, {
  name: 'member-draft-discarded',
  visibility: 'public',
})

export const memberSubmissionWithdrawnCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'member-submission-withdrawn',
  visibility: 'public',
})

export const memberRegistrationRetryRequestedCommand = defineCommand<Readonly<{
  readonly reasonCode: RegistryNoticeReason
}>>(moduleName, {
  name: 'member-registration-retry-requested',
  visibility: 'public',
})

export const memberRegistrationAbandonedCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'member-registration-abandoned',
  visibility: 'public',
})

export const deskSystemFailureObservedCommand = defineCommand<Readonly<{
  readonly operation: DeskSystemOperation
}>>(moduleName, {
  name: 'desk-system-failure-observed',
  visibility: 'public',
})

export const deskSystemFailureDismissedCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'desk-system-failure-dismissed',
  visibility: 'public',
})
