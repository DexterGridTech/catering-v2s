import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {closeLayerCommand, openLayerCommand, selectLayers} from '@catering-v2s/kernel-base-ui-state';
import {
  authSystemFailureDismissedCommand,
  authSystemFailureObservedCommand,
} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {isContentOwner, primaryDisplayMode} from './shared/staffAuthActorSupport';

export const createAuthSystemNoticeActor = (): ActorDefinition =>
  defineActor(moduleName, 'auth-system-notice', [
    onCommand(authSystemFailureObservedCommand, async context => {
      if (!isContentOwner(context)) return null;
      const hasNotice = selectLayers(context.getState(), primaryDisplayMode).some(
        layer => layer.layerId === 'sample.auth.system-notice',
      );
      if (hasNotice) return null;
      await context.dispatchCommand(openLayerCommand, {
        displayMode: primaryDisplayMode,
        layerId: 'sample.auth.system-notice',
        partKey: 'sample.auth.system-notice',
        props: {operation: context.command.payload.operation},
        persistence: 'ephemeral',
      });
      return null;
    }),
    onCommand(authSystemFailureDismissedCommand, async context => {
      if (!isContentOwner(context)) return null;
      await context.dispatchCommand(closeLayerCommand, {
        displayMode: primaryDisplayMode,
        layerId: 'sample.auth.system-notice',
      });
      return null;
    }),
  ]);
