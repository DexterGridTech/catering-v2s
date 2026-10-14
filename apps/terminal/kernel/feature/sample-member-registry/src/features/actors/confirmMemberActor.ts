import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {
  confirmMemberCommand,
  memberConfirmedCommand,
  registerBranchConfirmedMemberCommand,
} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {selectBranchPendingMember} from '../../selectors/selectBranchPendingMember';
import {selectHostPendingMember} from '../../selectors/selectHostPendingMember';
import {selectMembers} from '../../selectors/selectMembers';
import {memberActions} from '../slices/memberRegistry';
import {requireEligible, type BranchConfirmationLifecycle, type MemberMutationGuard} from './shared/memberActorSupport';

export const createConfirmMemberActor = (
  guard?: MemberMutationGuard,
  branchConfirmation?: BranchConfirmationLifecycle,
): ActorDefinition =>
  defineActor(moduleName, 'confirm', [
    onCommand(confirmMemberCommand, async context => {
      requireEligible(guard, context);
      const {operationId} = context.command.payload;
      if (typeof operationId !== 'string' || operationId.length === 0) return null;
      const isMaster = selectRuntimeInstanceMode(context.getState()) === 'MASTER';
      const pending = isMaster
        ? selectHostPendingMember(context.getState())
        : selectBranchPendingMember(context.getState());
      if (pending === null || pending.operationId !== operationId) return null;
      if (!isMaster) branchConfirmation?.onStarted(operationId);
      try {
        if (!isMaster) {
          const registered = selectMembers(context.getState()).find(member => member.operationId === operationId);
          if (registered !== undefined) {
            context.dispatchAction(memberActions.withdrawBranchPending(operationId));
            await context.dispatchCommand(memberConfirmedCommand, {memberId: registered.memberId});
            return null;
          }
        }
        const requestedAge = context.command.payload.age;
        const age = typeof requestedAge === 'number' && Number.isFinite(requestedAge) ? requestedAge : undefined;
        const member = Object.freeze({
          memberId: operationId,
          operationId,
          name: pending.name,
          phone: pending.phone,
          ...(age === undefined ? {} : {age}),
          registeredAt: nowTimestampMs(),
        });
        if (isMaster) {
          context.dispatchAction(memberActions.confirmHostPending(member));
        } else {
          const result = await context.dispatchCommand(
            registerBranchConfirmedMemberCommand,
            {
              operationId,
              name: pending.name,
              phone: pending.phone,
              ...(age === undefined ? {} : {age}),
            },
            {target: 'peer'},
          );
          if (result.status !== 'completed') throw new Error('Host member registration did not complete');
          if (selectBranchPendingMember(context.getState())?.operationId !== operationId) return null;
          const registered = selectMembers(context.getState()).find(member => member.operationId === operationId);
          if (registered === undefined) return null;
          context.dispatchAction(memberActions.withdrawBranchPending(operationId));
          await context.dispatchCommand(memberConfirmedCommand, {memberId: registered.memberId});
          return null;
        }
        await context.dispatchCommand(memberConfirmedCommand, {memberId: member.memberId});
        return null;
      } finally {
        if (!isMaster) branchConfirmation?.onSettled(operationId);
      }
    }),
  ]);
