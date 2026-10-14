import {isCurrentWorkspaceOwnedByInstance, openLayerCommand} from '@catering-v2s/kernel-base-ui-state';
import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {
  memberPendingCommand as registryMemberPendingCommand,
  selectPendingMember,
  withdrawMemberCommand as registryWithdrawMemberCommand,
} from '@catering-v2s/kernel-feature-sample-member-registry';
import {
  memberSubmissionWithdrawnCommand,
} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {hasSecondarySurface, isBranchWorkspace, primary, secondary, show} from './shared/memberDeskActorSupport';

export const createDeskPendingActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-pending', [
    onCommand(registryMemberPendingCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      if (selectPendingMember(context.getState())?.operationId !== context.command.payload.operationId) return null;
      if (isBranchWorkspace(context)) {
        await show({context, displayMode: primary, partKey: 'sample.desk.branch.customer-member'});
        return null;
      }
      const secondarySurface = hasSecondarySurface(context);
      if (secondarySurface) {
        await show({context, displayMode: primary, partKey: 'sample.desk.member-list'});
        await context.dispatchCommand(openLayerCommand, {
          displayMode: primary,
          layerId: 'sample.desk.waiting-confirm',
          partKey: 'sample.desk.waiting-confirm',
        });
        await show({context, displayMode: secondary, partKey: 'sample.desk.customer-member', props: {mode: 'confirm'}});
        return null;
      }
      await show({
        context,
        displayMode: primary,
        partKey: 'sample.desk.customer-member',
        props: {mode: 'handheld-confirm'},
      });
      return null;
    }),
    onCommand(memberSubmissionWithdrawnCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await context.dispatchCommand(registryWithdrawMemberCommand, {operationId: context.command.payload.operationId});
      return null;
    }),
  ]);
