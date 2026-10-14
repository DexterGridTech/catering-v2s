import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {openLayerCommand} from '@catering-v2s/kernel-base-ui-state';
import {loginFailedCommand} from '@catering-v2s/kernel-feature-sample-staff-session';
import {authNoticeDismissedCommand} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {isContentOwner, primaryDisplayMode} from './shared/staffAuthActorSupport';

export const createAuthResultActor = (): ActorDefinition =>
  defineActor(moduleName, 'auth-result', [
    onCommand(loginFailedCommand, async context => {
      if (!isContentOwner(context)) return null;
      await context.dispatchCommand(openLayerCommand, {
        displayMode: primaryDisplayMode,
        layerId: 'sample.auth.notice',
        partKey: 'sample.auth.notice',
        props: {reasonCode: context.command.payload.reasonCode},
      });
      return null;
    }),
  ]);
