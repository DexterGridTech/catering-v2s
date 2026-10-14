import {isCurrentWorkspaceOwnedByInstance} from '@catering-v2s/kernel-base-ui-state';
import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {startMemberDeskCommand} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {
  hasSecondarySurface,
  isBranchWorkspace,
  memberListPart,
  secondary,
  selectDeskHostPendingMember,
  show,
} from './shared/memberDeskActorSupport';

export const createDeskNavigationActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-navigation', [
    onCommand(startMemberDeskCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      const route = context.command.routeContext;
      const isMainCustomerSurface =
        route?.workspace === 'MAIN' &&
        route.displayMode === 'SECONDARY' &&
        (route.instanceMode === 'MASTER' || route.instanceMode === 'SLAVE');
      if (isMainCustomerSurface) {
        const pending = selectDeskHostPendingMember(context);
        await show({
          context,
          displayMode: secondary,
          partKey: pending === null ? 'sample.desk.customer-welcome' : 'sample.desk.customer-member',
          ...(pending === null ? {} : {props: {mode: 'confirm'}}),
        });
        return null;
      }
      await show({context, displayMode: 'PRIMARY', partKey: memberListPart(context)});
      if (route === null && !isBranchWorkspace(context) && hasSecondarySurface(context))
        await show({context, displayMode: secondary, partKey: 'sample.desk.customer-welcome'});
      return null;
    }),
  ]);
