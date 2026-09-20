import {
  clearLayersCommand,
  closeLayerCommand,
  createUiVariableWrite,
  openLayerCommand,
  selectLayers,
  setUiVariablesCommand,
  showScreenCommand,
  isCurrentWorkspaceOwnedByInstance,
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
import {
  authNoticeDismissedCommand,
  authSystemFailureDismissedCommand,
  authSystemFailureObservedCommand,
} from '../commands/commands'
import {moduleName} from '../../moduleName'
import {operatorNameVariable} from '../variables/variables'

const primary = 'PRIMARY' as const

const isContentOwner = (context: ActorExecutionContext): boolean =>
  isCurrentWorkspaceOwnedByInstance(context.getState())

const showLogin = (context: ActorExecutionContext) =>
  context.dispatchCommand(showScreenCommand, {
    displayMode: primary,
    containerKey: 'main',
    partKey: 'sample.auth.login',
  })

export const createAuthResultActor = (): ActorDefinition => defineActor(moduleName, 'auth-result', [
  onCommand(loginFailedCommand, async context => {
    if (!isContentOwner(context)) return null
    await context.dispatchCommand(openLayerCommand, {
      displayMode: primary,
      layerId: 'sample.auth.notice',
      partKey: 'sample.auth.notice',
      props: {reasonCode: context.command.payload.reasonCode},
    })
    return null
  }),
])

export const createAuthNavigationActor = (): ActorDefinition => defineActor(moduleName, 'auth-navigation', [
  onCommand(logoutSucceededCommand, async context => {
    if (!isContentOwner(context)) return null
    await context.dispatchCommand(clearLayersCommand, {displayMode: primary})
    await showLogin(context)
    return null
  }),
  onCommand(sessionRestoredAnonymousCommand, async context => {
    if (!isContentOwner(context)) return null
    await showLogin(context)
    return null
  }),
  onCommand(loginSucceededCommand, async context => {
    if (!isContentOwner(context)) return null
    await context.dispatchCommand(setUiVariablesCommand, {
      entries: [createUiVariableWrite(operatorNameVariable, context.command.payload.operatorName)],
    })
    await context.dispatchCommand(clearLayersCommand, {displayMode: primary})
    return null
  }),
])

export const createAuthNoticeActor = (): ActorDefinition => defineActor(moduleName, 'auth-notice', [
  onCommand(authNoticeDismissedCommand, async context => {
    if (!isContentOwner(context)) return null
    await context.dispatchCommand(closeLayerCommand, {
      displayMode: primary,
      layerId: 'sample.auth.notice',
    })
    return null
  }),
])

export const createAuthSystemNoticeActor = (): ActorDefinition => defineActor(moduleName, 'auth-system-notice', [
  onCommand(authSystemFailureObservedCommand, async context => {
    if (!isContentOwner(context)) return null
    const hasNotice = selectLayers(context.getState(), primary)
      .some(layer => layer.layerId === 'sample.auth.system-notice')
    if (hasNotice) return null
    await context.dispatchCommand(openLayerCommand, {
      displayMode: primary,
      layerId: 'sample.auth.system-notice',
      partKey: 'sample.auth.system-notice',
      props: {operation: context.command.payload.operation},
      persistence: 'ephemeral',
    })
    return null
  }),
  onCommand(authSystemFailureDismissedCommand, async context => {
    if (!isContentOwner(context)) return null
    await context.dispatchCommand(closeLayerCommand, {
      displayMode: primary,
      layerId: 'sample.auth.system-notice',
    })
    return null
  }),
])
