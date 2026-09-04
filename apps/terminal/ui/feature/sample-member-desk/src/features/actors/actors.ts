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
  loginSucceededCommand as staffLoginSucceededCommand,
  logoutSucceededCommand as staffLogoutSucceededCommand,
  sessionRestoredAnonymousCommand as staffSessionRestoredAnonymousCommand,
  sessionRestoredAuthenticatedCommand as staffSessionRestoredAuthenticatedCommand,
} from '@catering-v2s/kernel-feature-sample-staff-session'
import {
  memberConfirmedCommand as registryMemberConfirmedCommand,
  memberPendingCommand as registryMemberPendingCommand,
  memberRejectedCommand as registryMemberRejectedCommand,
} from '@catering-v2s/kernel-feature-sample-member-registry'
import {readDisplayInfo, resolveSecondarySurfaceAvailable} from '@catering-v2s/kernel-base-display-context'
import {memberFormOpenedCommand, noticeDismissedCommand} from '../../commands'
import {moduleName} from '../../moduleName'

const primary = 'PRIMARY' as const
const secondary = 'SECONDARY' as const
const main = 'main' as const

const hasSecondarySurface = async (context: ActorExecutionContext): Promise<boolean> =>
  resolveSecondarySurfaceAvailable(await readDisplayInfo(context.platformPorts.device))

const show = (
  context: ActorExecutionContext,
  displayMode: typeof primary | typeof secondary,
  partKey: string,
  props?: Readonly<Record<string, string>>,
) => context.dispatchCommand(showScreenCommand, {
  displayMode,
  containerKey: main,
  partKey,
  ...(props === undefined ? {} : {props}),
})

export const createDeskNavigationActor = (): ActorDefinition => defineActor(moduleName, 'desk-navigation', [
  onCommand(staffLoginSucceededCommand, async context => {
    await show(context, primary, 'sample.desk.member-list')
    if (await hasSecondarySurface(context)) await show(context, secondary, 'sample.desk.customer-welcome')
    return null
  }),
  onCommand(staffSessionRestoredAuthenticatedCommand, async context => {
    await show(context, primary, 'sample.desk.member-list')
    if (await hasSecondarySurface(context)) await show(context, secondary, 'sample.desk.customer-welcome')
    return null
  }),
  onCommand(staffLogoutSucceededCommand, async context => {
    await context.dispatchCommand(clearLayersCommand, {displayMode: secondary})
    if (await hasSecondarySurface(context)) await show(context, secondary, 'sample.desk.customer-welcome')
    return null
  }),
  onCommand(staffSessionRestoredAnonymousCommand, async context => {
    if (await hasSecondarySurface(context)) await show(context, secondary, 'sample.desk.customer-welcome')
    return null
  }),
])

export const createDeskFormActor = (): ActorDefinition => defineActor(moduleName, 'desk-form', [
  onCommand(memberFormOpenedCommand, async context => {
    await show(context, primary, 'sample.desk.member-form')
    if (await hasSecondarySurface(context)) {
      await show(context, secondary, 'sample.desk.customer-member', {mode: 'preview'})
    }
    return null
  }),
])

export const createDeskPendingActor = (): ActorDefinition => defineActor(moduleName, 'desk-pending', [
  onCommand(registryMemberPendingCommand, async context => {
    if (await hasSecondarySurface(context)) {
      await show(context, primary, 'sample.desk.member-list')
      await context.dispatchCommand(openLayerCommand, {
        displayMode: primary,
        layerId: 'sample.desk.waiting-confirm',
        partKey: 'sample.desk.waiting-confirm',
      })
      await show(context, secondary, 'sample.desk.customer-member', {mode: 'confirm'})
      return null
    }
    await show(context, primary, 'sample.desk.customer-member', {mode: 'confirm'})
    return null
  }),
])

export const createDeskConfirmedActor = (): ActorDefinition => defineActor(moduleName, 'desk-confirmed', [
  onCommand(registryMemberConfirmedCommand, async context => {
    await context.dispatchCommand(clearUiVariablesCommand, {
      keys: ['sample.member.name', 'sample.member.phone'],
    })
    await show(context, primary, 'sample.desk.member-list')
    if (await hasSecondarySurface(context)) {
      await context.dispatchCommand(closeLayerCommand, {
        displayMode: primary,
        layerId: 'sample.desk.waiting-confirm',
      })
      await show(context, secondary, 'sample.desk.customer-welcome')
    }
    return null
  }),
])

export const createDeskRejectedActor = (): ActorDefinition => defineActor(moduleName, 'desk-rejected', [
  onCommand(registryMemberRejectedCommand, async context => {
    await context.dispatchCommand(openLayerCommand, {
      displayMode: primary,
      layerId: 'sample.desk.registry-notice',
      partKey: 'sample.desk.registry-notice',
      props: {reasonCode: context.command.payload.reasonCode},
    })
    if (await hasSecondarySurface(context)) {
      await show(context, secondary, 'sample.desk.customer-member', {mode: 'preview'})
    } else {
      await show(context, primary, 'sample.desk.member-form')
    }
    return null
  }),
])

export const createDeskNoticeActor = (): ActorDefinition => defineActor(moduleName, 'desk-notice', [
  onCommand(noticeDismissedCommand, async context => {
    await context.dispatchCommand(closeLayerCommand, {
      displayMode: primary,
      layerId: 'sample.desk.registry-notice',
    })
    if (await hasSecondarySurface(context)) {
      await context.dispatchCommand(closeLayerCommand, {
        displayMode: primary,
        layerId: 'sample.desk.waiting-confirm',
      })
      await show(context, primary, 'sample.desk.member-form')
    }
    return null
  }),
])
