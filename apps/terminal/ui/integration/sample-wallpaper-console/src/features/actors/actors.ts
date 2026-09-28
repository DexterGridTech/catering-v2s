import type {ActorDefinition, ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import {
  loginSucceededCommand,
  logoutSucceededCommand,
  sessionRestoredAnonymousCommand,
  sessionRestoredAuthenticatedCommand,
} from '@catering-v2s/kernel-feature-sample-staff-session';
import {selectSessionState} from '@catering-v2s/kernel-feature-sample-staff-session';
import {isCurrentWorkspaceOwnedByInstance, showScreenCommand} from '@catering-v2s/kernel-base-ui-state';
import {selectTopologyFacts, topologyDisplayChangedCommand} from '@catering-v2s/kernel-base-topology';
import {moduleName} from '../../moduleName';

const showPrimary = async (context: ActorExecutionContext, partKey: string): Promise<void> => {
  if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return;
  await context.dispatchCommand(showScreenCommand, {
    displayMode: 'PRIMARY',
    containerKey: 'main',
    partKey,
  });
};

const showSecondaryIfAvailable = async (context: ActorExecutionContext, partKey: string): Promise<void> => {
  const facts = selectTopologyFacts(context.getState());
  const available = facts?.hasTopologySecondarySurface === true;
  context.platformPorts.logger.info({
    category: 'display-diagnostics',
    event: 'sample-wallpaper-console.secondary-placement',
    message: 'Secondary placement availability resolved',
    data: {
      source: 'sample-wallpaper-console.placement-actor',
      requestedPartKey: partKey,
      instanceMode: facts?.instanceMode ?? null,
      paired: facts?.paired ?? null,
      displayCount: facts?.displayCount ?? null,
      hasTopologySecondarySurface: facts?.hasTopologySecondarySurface ?? null,
      secondaryAvailable: available,
    },
  });
  if (!available || !isCurrentWorkspaceOwnedByInstance(context.getState())) return;
  await context.dispatchCommand(showScreenCommand, {
    displayMode: 'SECONDARY',
    containerKey: 'main',
    partKey,
  });
};

const selectSessionStatus = (context: ActorExecutionContext): 'anonymous' | 'authenticated' | 'other' => {
  const status = selectSessionState(context.getState()).status;
  if (status === 'anonymous' || status === 'authenticated') return status;
  return 'other';
};

export const createWallpaperConsolePlacementActor = (): ActorDefinition =>
  defineActor(moduleName, 'placement', [
    onCommand(topologyDisplayChangedCommand, async context => {
      const sessionStatus = selectSessionStatus(context);
      if (sessionStatus === 'authenticated') {
        await showSecondaryIfAvailable(context, 'sample.wallpaper-console.welcome');
      } else if (sessionStatus === 'anonymous') {
        await showSecondaryIfAvailable(context, 'sample.wallpaper-console.waiting');
      }
      return null;
    }),
    onCommand(loginSucceededCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await showPrimary(context, 'sample.wallpaper.picker');
      await showSecondaryIfAvailable(context, 'sample.wallpaper-console.welcome');
      return null;
    }),
    onCommand(sessionRestoredAuthenticatedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await showPrimary(context, 'sample.wallpaper.picker');
      await showSecondaryIfAvailable(context, 'sample.wallpaper-console.welcome');
      return null;
    }),
    onCommand(logoutSucceededCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await showSecondaryIfAvailable(context, 'sample.wallpaper-console.waiting');
      return null;
    }),
    onCommand(sessionRestoredAnonymousCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await showSecondaryIfAvailable(context, 'sample.wallpaper-console.waiting');
      return null;
    }),
  ]);
