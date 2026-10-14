import {isCurrentWorkspaceOwnedByInstance} from '@catering-v2s/kernel-base-ui-state';
import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {memberFormOpenedCommand} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {isBranchWorkspace, primary, show} from './shared/memberDeskActorSupport';

export const createDeskFormActor = (): ActorDefinition =>
  defineActor(moduleName, 'desk-form', [
    onCommand(memberFormOpenedCommand, async context => {
      if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null;
      await show({
        context,
        displayMode: primary,
        partKey: isBranchWorkspace(context) ? 'sample.desk.branch.member-form' : 'sample.desk.member-form',
      });
      return null;
    }),
  ]);
