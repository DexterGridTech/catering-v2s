import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from './moduleName'
import type {LoginFailedPayload, LoginPayload} from './types'

export type EmptyPayload = Readonly<{}>

export const bootstrapSessionCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'bootstrap-session',
  visibility: 'internal',
})

export const loginCommand = defineCommand<LoginPayload>(moduleName, {
  name: 'login',
  visibility: 'public',
})

export const logoutCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'logout',
  visibility: 'public',
})

export const loginSucceededCommand = defineCommand<Readonly<{operatorName: string}>>(moduleName, {
  name: 'login-succeeded',
  visibility: 'public',
})

export const loginFailedCommand = defineCommand<LoginFailedPayload>(moduleName, {
  name: 'login-failed',
  visibility: 'public',
})

export const logoutSucceededCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'logout-succeeded',
  visibility: 'public',
})

export const sessionRestoredAuthenticatedCommand = defineCommand<Readonly<{operatorName: string}>>(moduleName, {
  name: 'session-restored-authenticated',
  visibility: 'public',
})

export const sessionRestoredAnonymousCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'session-restored-anonymous',
  visibility: 'public',
})
