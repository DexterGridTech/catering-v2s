import {
  clearLayersCommand,
  closeLayerCommand,
  openLayerCommand,
  selectLayers,
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
  logoutCommand as staffLogoutCommand,
  logoutSucceededCommand as staffLogoutSucceededCommand,
  sessionRestoredAnonymousCommand as staffSessionRestoredAnonymousCommand,
  sessionRestoredAuthenticatedCommand as staffSessionRestoredAuthenticatedCommand,
} from '@catering-v2s/kernel-feature-sample-staff-session'
import {
  memberConfirmedCommand as registryMemberConfirmedCommand,
  memberPendingCommand as registryMemberPendingCommand,
  memberRejectedCommand as registryMemberRejectedCommand,
  memberWithdrawnCommand as registryMemberWithdrawnCommand,
  withdrawMemberCommand as registryWithdrawMemberCommand,
} from '@catering-v2s/kernel-feature-sample-member-registry'
import {readDisplayInfo, resolveSecondarySurfaceAvailable} from '@catering-v2s/kernel-base-display-context'
import {
  deskSystemFailureDismissedCommand,
  deskSystemFailureObservedCommand,
  memberDraftDiscardedCommand,
  memberFormCancelledCommand,
  memberFormOpenedCommand,
  memberRegistrationAbandonedCommand,
  memberRegistrationRetryRequestedCommand,
  memberSubmissionWithdrawnCommand,
} from '../../commands'
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

const clearPrimaryLayers = (context: ActorExecutionContext) =>
  context.dispatchCommand(clearLayersCommand, {displayMode: primary})

const closePrimaryLayer = (
  context: ActorExecutionContext,
  layerId: string,
) => context.dispatchCommand(closeLayerCommand, {displayMode: primary, layerId})

const returnToList = async (
  context: ActorExecutionContext,
  secondarySurface: boolean,
): Promise<void> => {
  await show(context, primary, 'sample.desk.member-list')
  if (secondarySurface) await show(context, secondary, 'sample.desk.customer-welcome')
}

const returnToForm = async (
  context: ActorExecutionContext,
): Promise<void> => {
  await show(context, primary, 'sample.desk.member-form')
}

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
    await clearPrimaryLayers(context)
    const secondarySurface = await hasSecondarySurface(context)
    if (secondarySurface) {
      await context.dispatchCommand(clearLayersCommand, {displayMode: secondary})
      await show(context, secondary, 'sample.desk.customer-welcome')
    }
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
    return null
  }),
])

export const createDeskPendingActor = (): ActorDefinition => defineActor(moduleName, 'desk-pending', [
  onCommand(registryMemberPendingCommand, async context => {
    const secondarySurface = await hasSecondarySurface(context)
    if (secondarySurface) {
      await show(context, primary, 'sample.desk.member-list')
      await context.dispatchCommand(openLayerCommand, {
        displayMode: primary,
        layerId: 'sample.desk.waiting-confirm',
        partKey: 'sample.desk.waiting-confirm',
      })
      await show(context, secondary, 'sample.desk.customer-member', {mode: 'confirm'})
      return null
    }
    await show(context, primary, 'sample.desk.customer-member', {mode: 'handheld-confirm'})
    return null
  }),
  onCommand(memberSubmissionWithdrawnCommand, async context => {
    await context.dispatchCommand(registryWithdrawMemberCommand, {})
    return null
  }),
])

export const createDeskConfirmedActor = (): ActorDefinition => defineActor(moduleName, 'desk-confirmed', [
  onCommand(registryMemberConfirmedCommand, async context => {
    const secondarySurface = await hasSecondarySurface(context)
    await returnToList(context, secondarySurface)
    if (secondarySurface) {
      await closePrimaryLayer(context, 'sample.desk.waiting-confirm')
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
      await show(context, secondary, 'sample.desk.customer-welcome')
    } else {
      await show(context, primary, 'sample.desk.member-form')
    }
    return null
  }),
])

export const createDeskNoticeActor = (): ActorDefinition => defineActor(moduleName, 'desk-notice', [
  onCommand(memberFormCancelledCommand, async context => {
    const secondarySurface = await hasSecondarySurface(context)
    if (context.command.payload.dirty) {
      await context.dispatchCommand(openLayerCommand, {
        displayMode: primary,
        layerId: 'sample.desk.discard-confirm',
        partKey: 'sample.desk.discard-confirm',
        props: {intent: 'cancel-form'},
      })
      return null
    }
    await returnToList(context, secondarySurface)
    return null
  }),
  onCommand(memberDraftDiscardedCommand, async context => {
    await closePrimaryLayer(context, 'sample.desk.discard-confirm')
    if (context.command.payload.intent === 'logout') {
      await context.dispatchCommand(staffLogoutCommand, {})
      return null
    }
    await returnToList(context, await hasSecondarySurface(context))
    return null
  }),
  onCommand(memberRegistrationRetryRequestedCommand, async context => {
    await closePrimaryLayer(context, 'sample.desk.registry-notice')
    const secondarySurface = await hasSecondarySurface(context)
    if (secondarySurface) await closePrimaryLayer(context, 'sample.desk.waiting-confirm')
    await returnToForm(context)
    return null
  }),
  onCommand(memberRegistrationAbandonedCommand, async context => {
    await context.dispatchCommand(registryWithdrawMemberCommand, {})
    await closePrimaryLayer(context, 'sample.desk.registry-notice')
    const secondarySurface = await hasSecondarySurface(context)
    if (secondarySurface) await closePrimaryLayer(context, 'sample.desk.waiting-confirm')
    await returnToList(context, secondarySurface)
    return null
  }),
  onCommand(registryMemberWithdrawnCommand, async context => {
    const hasWithdrawConfirmation = selectLayers(context.getState(), primary)
      .some(layer => layer.layerId === 'sample.desk.withdraw-confirm')
    const secondarySurface = await hasSecondarySurface(context)
    if (!hasWithdrawConfirmation && secondarySurface) return null
    if (secondarySurface) {
      await closePrimaryLayer(context, 'sample.desk.withdraw-confirm')
      await closePrimaryLayer(context, 'sample.desk.waiting-confirm')
      await show(context, secondary, 'sample.desk.customer-welcome')
    }
    await returnToForm(context)
    return null
  }),
])

export const createDeskSystemNoticeActor = (): ActorDefinition => defineActor(moduleName, 'desk-system-notice', [
  onCommand(deskSystemFailureObservedCommand, async context => {
    await context.dispatchCommand(openLayerCommand, {
      displayMode: primary,
      layerId: 'sample.desk.system-notice',
      partKey: 'sample.desk.system-notice',
      props: {operation: context.command.payload.operation},
    })
    return null
  }),
  onCommand(deskSystemFailureDismissedCommand, async context => {
    await closePrimaryLayer(context, 'sample.desk.system-notice')
    return null
  }),
])
