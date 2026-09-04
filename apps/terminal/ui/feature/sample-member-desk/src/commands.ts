import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from './moduleName'

export type EmptyPayload = Readonly<{}>

export const memberFormOpenedCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'member-form-opened',
  visibility: 'public',
})

export const noticeDismissedCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'notice-dismissed',
  visibility: 'public',
})
