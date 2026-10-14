import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {registerBranchConfirmedMemberCommand} from '../../declarations/commands';
import {createInvalidMemberPayloadError} from '../../foundations/errors';
import {moduleName} from '../../moduleName';
import {memberActions} from '../slices/memberRegistry';
import {requireEligible, type MemberMutationGuard} from './shared/memberActorSupport';

export const createRegisterBranchConfirmedMemberActor = (guard?: MemberMutationGuard): ActorDefinition =>
  defineActor(moduleName, 'register-branch-confirmed', [
    onCommand(registerBranchConfirmedMemberCommand, context => {
      requireEligible(guard, context);
      if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER') return null;
      const {operationId, name, phone, age} = context.command.payload;
      if (
        typeof operationId !== 'string' ||
        operationId.length === 0 ||
        typeof name !== 'string' ||
        name.trim().length === 0 ||
        typeof phone !== 'string' ||
        phone.trim().length === 0
      )
        throw createInvalidMemberPayloadError(context);
      const member = Object.freeze({
        memberId: operationId,
        operationId,
        name,
        phone,
        ...(typeof age === 'number' && Number.isFinite(age) ? {age} : {}),
        registeredAt: nowTimestampMs(),
      });
      context.dispatchAction(memberActions.registerConfirmedMember(member));
      return null;
    }),
  ]);
