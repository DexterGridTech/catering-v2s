import type {ActorDefinition, ActorExecutionContext} from '@catering-v2s/kernel-base-runtime'
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime'
import {
  readDisplayInfo,
  resolveSecondarySurfaceAvailable,
} from '@catering-v2s/kernel-base-display-context'
import {
  loginSucceededCommand,
  logoutSucceededCommand,
  sessionRestoredAnonymousCommand,
  sessionRestoredAuthenticatedCommand,
} from '@catering-v2s/kernel-feature-sample-staff-session'
import {showScreenCommand} from '@catering-v2s/kernel-base-ui-state'
import {moduleName} from '../../moduleName'

const showPrimary = async (context: ActorExecutionContext, partKey: string): Promise<void> => {
  await context.dispatchCommand(showScreenCommand, {
    displayMode: 'PRIMARY',
    containerKey: 'main',
    partKey,
  })
}

const showSecondaryIfAvailable = async (
  context: ActorExecutionContext,
  partKey: string,
): Promise<void> => {
  const displayInfo = await readDisplayInfo(context.platformPorts.device)
  const available = resolveSecondarySurfaceAvailable(displayInfo)
  context.platformPorts.logger.info({
    category: 'display-diagnostics',
    event: 'sample-wallpaper-console.secondary-placement',
    message: 'Secondary placement availability resolved',
    data: {
      source: 'sample-wallpaper-console.placement-actor',
      requestedPartKey: partKey,
      displayInfoStatus: displayInfo.status,
      secondaryAvailable: available,
    },
  })
  if (!available) return
  await context.dispatchCommand(showScreenCommand, {
    displayMode: 'SECONDARY',
    containerKey: 'main',
    partKey,
  })
}

export const createWallpaperConsolePlacementActor = (): ActorDefinition => defineActor(moduleName, 'placement', [
  onCommand(loginSucceededCommand, async context => {
    await showPrimary(context, 'sample.wallpaper.picker')
    await showSecondaryIfAvailable(context, 'sample.wallpaper-console.welcome')
    return null
  }),
  onCommand(sessionRestoredAuthenticatedCommand, async context => {
    await showPrimary(context, 'sample.wallpaper.picker')
    await showSecondaryIfAvailable(context, 'sample.wallpaper-console.welcome')
    return null
  }),
  onCommand(logoutSucceededCommand, async context => {
    await showSecondaryIfAvailable(context, 'sample.wallpaper-console.waiting')
    return null
  }),
  onCommand(sessionRestoredAnonymousCommand, async context => {
    await showSecondaryIfAvailable(context, 'sample.wallpaper-console.waiting')
    return null
  }),
])
