import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {createInvalidMemberPayloadError} from '../../foundations/errors';
import {moduleName} from '../../moduleName';
import {memberActions} from '../slices/memberRegistry';
import {memberPendingCommand, submitMemberCommand} from '../../declarations/commands';
import {readPendingPayload, requireEligible, type MemberMutationGuard} from './shared/memberActorSupport';

export const createSubmitMemberActor = (guard?: MemberMutationGuard): ActorDefinition =>
  defineActor(moduleName, 'submit', [
    onCommand(submitMemberCommand, async context => {
      requireEligible(guard, context);
      const requestId = context.command.requestId;
      if (requestId === null) throw createInvalidMemberPayloadError(context);
      const pending = Object.freeze({...readPendingPayload(context), operationId: String(requestId)});
      if (selectRuntimeInstanceMode(context.getState()) === 'MASTER') {
        context.dispatchAction(memberActions.setHostPending(pending));
      } else {
        context.dispatchAction(memberActions.setBranchPending(pending));
      }
      await context.dispatchCommand(memberPendingCommand, pending);
      return null;
    }),
  ]);
