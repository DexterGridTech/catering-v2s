import {isCurrentWorkspaceOwnedByInstance} from '@catering-v2s/kernel-base-ui-state';
import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {logoutCommand as staffLogoutCommand} from '@catering-v2s/kernel-feature-sample-staff-session';
import {
  memberDraftDiscardedCommand,
  memberFormCancelledCommand,
  memberRegistrationAbandonedCommand,
  memberRegistrationRetryRequestedCommand,
} from '../../declarations/commands';
import {
  memberWithdrawnCommand as registryMemberWithdrawnCommand,
  selectPendingMember,
  withdrawMemberCommand as registryWithdrawMemberCommand,
} from '@catering-v2s/kernel-feature-sample-member-registry';
import {moduleName} from '../../moduleName';
import {
  closePrimaryLayer,
  hasSecondarySurface,
  isBranchWorkspace,
  primary,
  returnToForm,
  returnToList,
  secondary,
  show,
} from './shared/memberDeskActorSupport';
import {openLayerCommand, selectLayers} from '@catering-v2s/kernel-base-ui-state';

export const createDeskNoticeActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-notice', [
    onCommand(memberFormCancelledCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const secondarySurface = hasSecondarySurface(context);
      if (context.command.payload.dirty) {
        await context.dispatchCommand(openLayerCommand, {
          displayMode: primary,
          layerId: 'sample.desk.discard-confirm',
          partKey: isBranchWorkspace(context) ? 'sample.desk.branch.discard-confirm' : 'sample.desk.discard-confirm',
          props: {intent: 'cancel-form'},
        });
        return null;
      }
      await returnToList(context, secondarySurface);
      return null;
    }),
    onCommand(memberDraftDiscardedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await closePrimaryLayer(context, 'sample.desk.discard-confirm');
      if (context.command.payload.intent === 'logout') {
        await context.dispatchCommand(staffLogoutCommand, {});
        return null;
      }
      await returnToList(context, hasSecondarySurface(context));
      return null;
    }),
    onCommand(memberRegistrationRetryRequestedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await closePrimaryLayer(context, 'sample.desk.registry-notice');
      const secondarySurface = hasSecondarySurface(context);
      if (secondarySurface) await closePrimaryLayer(context, 'sample.desk.waiting-confirm');
      await returnToForm(context);
      return null;
    }),
    onCommand(memberRegistrationAbandonedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const pending = selectPendingMember(context.getState());
      if (pending === null) return null;
      await context.dispatchCommand(registryWithdrawMemberCommand, {operationId: pending.operationId});
      await closePrimaryLayer(context, 'sample.desk.registry-notice');
      const secondarySurface = hasSecondarySurface(context);
      if (secondarySurface) await closePrimaryLayer(context, 'sample.desk.waiting-confirm');
      await returnToList(context, secondarySurface);
      return null;
    }),
    onCommand(registryMemberWithdrawnCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const pending = selectPendingMember(context.getState());
      if (pending !== null && pending.operationId !== context.command.payload.operationId) return null;
      const hasWithdrawConfirmation = selectLayers(context.getState(), primary).some(
        layer => layer.layerId === 'sample.desk.withdraw-confirm',
      );
      const secondarySurface = hasSecondarySurface(context);
      if (!hasWithdrawConfirmation && secondarySurface) return null;
      if (secondarySurface) {
        await closePrimaryLayer(context, 'sample.desk.withdraw-confirm');
        await closePrimaryLayer(context, 'sample.desk.waiting-confirm');
        await show({context, displayMode: secondary, partKey: 'sample.desk.customer-welcome'});
      }
      await returnToForm(context);
      return null;
    }),
  ]);
