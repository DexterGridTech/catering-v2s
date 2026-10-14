import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {closeLayerCommand} from '@catering-v2s/kernel-base-ui-state';
import {authNoticeDismissedCommand} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {isContentOwner, primaryDisplayMode} from './shared/staffAuthActorSupport';

export const createAuthNoticeActor = (): ActorDefinition =>
  defineActor(moduleName, 'auth-notice', [
    onCommand(authNoticeDismissedCommand, async context => {
      if (!isContentOwner(context)) return null;
      await context.dispatchCommand(closeLayerCommand, {
        displayMode: primaryDisplayMode,
        layerId: 'sample.auth.notice',
      });
      return null;
    }),
  ]);
