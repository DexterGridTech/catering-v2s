import {isCurrentWorkspaceOwnedByInstance, openLayerCommand} from '@catering-v2s/kernel-base-ui-state';
import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {
  memberRejectedCommand as registryMemberRejectedCommand,
  selectPendingMember,
} from '@catering-v2s/kernel-feature-sample-member-registry';
import {moduleName} from '../../moduleName';
import {hasSecondarySurface, memberPart, primary, returnToForm, secondary, show} from './shared/memberDeskActorSupport';

export const createDeskRejectedActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-rejected', [
    onCommand(registryMemberRejectedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      if (selectPendingMember(context.getState())?.operationId !== context.command.payload.operationId) return null;
      await context.dispatchCommand(openLayerCommand, {
        displayMode: primary,
        layerId: 'sample.desk.registry-notice',
        partKey: memberPart(context, 'registry-notice'),
        props: {reasonCode: context.command.payload.reasonCode},
      });
      if (hasSecondarySurface(context)) {
        await show({context, displayMode: secondary, partKey: 'sample.desk.customer-welcome'});
      } else {
        await returnToForm(context);
      }
      return null;
    }),
  ]);
