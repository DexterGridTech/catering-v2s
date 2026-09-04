import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from './moduleName'

export type EmptyPayload = Readonly<{}>

export const authNoticeDismissedCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'auth-notice-dismissed',
  visibility: 'public',
})
