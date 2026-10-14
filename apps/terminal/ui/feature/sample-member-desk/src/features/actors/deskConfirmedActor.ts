import {isCurrentWorkspaceOwnedByInstance} from '@catering-v2s/kernel-base-ui-state';
import {defineActor, onCommand, selectRuntimeInstanceMode, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {
  memberConfirmedCommand as registryMemberConfirmedCommand,
  selectMembers,
  selectPendingMember,
} from '@catering-v2s/kernel-feature-sample-member-registry';
import {moduleName} from '../../moduleName';
import {closePrimaryLayer, hasSecondarySurface, isBranchWorkspace, primary, returnToList, secondary, show} from './shared/memberDeskActorSupport';

export const createDeskConfirmedActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-confirmed', [
    onCommand(registryMemberConfirmedCommand, async context => {
      const state = context.getState();
      const {memberId} = context.command.payload;
      const confirmedMember = selectMembers(state).find(member => member.memberId === memberId);
      if (confirmedMember === undefined) return null;
      if (selectRuntimeInstanceMode(state) === 'SLAVE') {
        await show({
          context,
          displayMode: primary,
          partKey: 'sample.desk.branch.member-list',
          routeContext: {workspace: 'BRANCH', instanceMode: 'SLAVE', displayMode: 'PRIMARY'},
        });
        return null;
      }
      if (!isCurrentWorkspaceOwnedByInstance(state)) return null;
      const pending = selectPendingMember(context.getState());
      if (pending !== null && pending.operationId !== memberId) return null;
      const secondarySurface = hasSecondarySurface(context);
      await returnToList(context, secondarySurface);
      if (secondarySurface) {
        await closePrimaryLayer(context, 'sample.desk.waiting-confirm');
      }
      return null;
    }),
  ]);
