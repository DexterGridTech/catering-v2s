import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {
  memberRejectedCommand,
  memberWithdrawnCommand,
  rejectMemberCommand,
  withdrawMemberCommand,
} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {selectBranchPendingMember} from '../../selectors/selectBranchPendingMember';
import {selectHostPendingMember} from '../../selectors/selectHostPendingMember';
import {memberActions} from '../slices/memberRegistry';
import {requireEligible, type MemberMutationGuard} from './shared/memberActorSupport';

export const createRejectMemberActor = (guard?: MemberMutationGuard): ActorDefinition =>
  defineActor(moduleName, 'reject', [
    onCommand(rejectMemberCommand, async context => {
      requireEligible(guard, context);
      const pending =
        selectRuntimeInstanceMode(context.getState()) === 'MASTER'
          ? selectHostPendingMember(context.getState())
          : selectBranchPendingMember(context.getState());
      if (pending === null || pending.operationId !== context.command.payload.operationId) return null;
      await context.dispatchCommand(memberRejectedCommand, {
        operationId: pending.operationId,
        reasonCode: 'customer-rejected',
      });
      return null;
    }),
    onCommand(withdrawMemberCommand, async context => {
      requireEligible(guard, context);
      const isMaster = selectRuntimeInstanceMode(context.getState()) === 'MASTER';
      const pending = isMaster
        ? selectHostPendingMember(context.getState())
        : selectBranchPendingMember(context.getState());
      const operationId = context.command.payload.operationId;
      if (pending === null || pending.operationId !== operationId) return null;
      context.dispatchAction(
        isMaster ? memberActions.withdrawHostPending(operationId) : memberActions.withdrawBranchPending(operationId),
      );
      await context.dispatchCommand(memberWithdrawnCommand, {operationId});
      return null;
    }),
  ]);
