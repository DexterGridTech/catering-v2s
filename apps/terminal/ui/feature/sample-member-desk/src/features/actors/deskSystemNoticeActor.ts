import {isCurrentWorkspaceOwnedByInstance, openLayerCommand, selectLayers} from '@catering-v2s/kernel-base-ui-state';
import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {deskSystemFailureDismissedCommand, deskSystemFailureObservedCommand} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {closePrimaryLayer, memberPart, primary} from './shared/memberDeskActorSupport';

export const createDeskSystemNoticeActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-system-notice', [
    onCommand(deskSystemFailureObservedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const hasNotice = selectLayers(context.getState(), primary).some(
        layer => layer.layerId === 'sample.desk.system-notice',
      );
      if (hasNotice) return null;
      await context.dispatchCommand(openLayerCommand, {
        displayMode: primary,
        layerId: 'sample.desk.system-notice',
        partKey: memberPart(context, 'system-notice'),
        props: {operation: context.command.payload.operation},
        persistence: 'ephemeral',
      });
      return null;
    }),
    onCommand(deskSystemFailureDismissedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await closePrimaryLayer(context, 'sample.desk.system-notice');
      return null;
    }),
  ]);
