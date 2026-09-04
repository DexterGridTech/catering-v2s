import {
  clearLayersCommand,
  clearUiVariablesCommand,
  closeLayerCommand,
  openLayerCommand,
  showScreenCommand,
} from '@catering-v2s/kernel-base-ui-state'
import {
  defineActor,
  onCommand,
  type ActorDefinition,
  type ActorExecutionContext,
} from '@catering-v2s/kernel-base-runtime'
import {
  loginFailedCommand,
  loginSucceededCommand,
  logoutSucceededCommand,
  sessionRestoredAnonymousCommand,
} from '@catering-v2s/kernel-feature-sample-staff-session'
import {authNoticeDismissedCommand} from '../../commands'
import {moduleName} from '../../moduleName'

const primary = 'PRIMARY' as const

const showLogin = (context: ActorExecutionContext) =>
  context.dispatchCommand(showScreenCommand, {
    displayMode: primary,
    containerKey: 'main',
    partKey: 'sample.auth.login',
  })

export const createAuthResultActor = (): ActorDefinition => defineActor(moduleName, 'auth-result', [
  onCommand(loginFailedCommand, async context => {
    await context.dispatchCommand(openLayerCommand, {
      displayMode: primary,
      layerId: 'sample.auth.notice',
      partKey: 'sample.auth.notice',
      props: {reasonCode: context.command.payload.reasonCode},
    })
    await context.dispatchCommand(clearUiVariablesCommand, {
      keys: ['sample.login.passcode'],
    })
    return null
  }),
])

export const createAuthNavigationActor = (): ActorDefinition => defineActor(moduleName, 'auth-navigation', [
  onCommand(logoutSucceededCommand, async context => {
    await context.dispatchCommand(clearLayersCommand, {displayMode: primary})
    await showLogin(context)
    return null
  }),
  onCommand(sessionRestoredAnonymousCommand, async context => {
    await showLogin(context)
    return null
  }),
  onCommand(loginSucceededCommand, async context => {
    await context.dispatchCommand(clearLayersCommand, {displayMode: primary})
    return null
  }),
])

export const createAuthNoticeActor = (): ActorDefinition => defineActor(moduleName, 'auth-notice', [
  onCommand(authNoticeDismissedCommand, async context => {
    await context.dispatchCommand(closeLayerCommand, {
      displayMode: primary,
      layerId: 'sample.auth.notice',
    })
    return null
  }),
])
