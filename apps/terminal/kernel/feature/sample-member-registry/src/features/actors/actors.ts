import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {ActorDefinition, ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import {
  confirmMemberCommand,
  memberConfirmedCommand,
  memberPendingCommand,
  memberRejectedCommand,
  memberWithdrawnCommand,
  rejectMemberCommand,
  submitMemberCommand,
  withdrawMemberCommand,
  registerBranchConfirmedMemberCommand,
} from '../commands/commands';
import {createInvalidMemberPayloadError} from '../../foundations/errors';
import {moduleName} from '../../moduleName';
import {selectBranchPendingMember, selectHostPendingMember} from '../../selectors/selectors';
import {memberActions} from '../slices/slice';
import type {PendingMember} from '../../types/types';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readPendingPayload = (context: ActorExecutionContext): Omit<PendingMember, 'operationId'> => {
  const value: unknown = context.command.payload;
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    typeof value.phone !== 'string' ||
    value.name.trim().length === 0 ||
    value.phone.trim().length === 0
  ) {
    throw createInvalidMemberPayloadError(context);
  }
  return Object.freeze({name: value.name, phone: value.phone});
};

export const createSubmitMemberActor = (): ActorDefinition =>
  defineActor(moduleName, 'submit', [
    onCommand(submitMemberCommand, async context => {
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

export const createConfirmMemberActor = (): ActorDefinition =>
  defineActor(moduleName, 'confirm', [
    onCommand(confirmMemberCommand, async context => {
      const {operationId} = context.command.payload;
      if (typeof operationId !== 'string' || operationId.length === 0) return null;
      const isMaster = selectRuntimeInstanceMode(context.getState()) === 'MASTER';
      const pending = isMaster ? selectHostPendingMember(context.getState()) : selectBranchPendingMember(context.getState());
      if (pending === null || pending.operationId !== operationId) return null;
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
        context.dispatchAction(memberActions.withdrawBranchPending(operationId));
      }
      await context.dispatchCommand(memberConfirmedCommand, {memberId: member.memberId});
      return null;
    }),
  ]);

export const createRegisterBranchConfirmedMemberActor = (): ActorDefinition =>
  defineActor(moduleName, 'register-branch-confirmed', [
    onCommand(registerBranchConfirmedMemberCommand, context => {
      if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER') return null;
      const {operationId, name, phone, age} = context.command.payload;
      if (
        typeof operationId !== 'string' || operationId.length === 0 ||
        typeof name !== 'string' || name.trim().length === 0 ||
        typeof phone !== 'string' || phone.trim().length === 0
      ) throw createInvalidMemberPayloadError(context);
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

export const createRejectMemberActor = (): ActorDefinition =>
  defineActor(moduleName, 'reject', [
    onCommand(rejectMemberCommand, async context => {
      const pending = selectRuntimeInstanceMode(context.getState()) === 'MASTER'
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
      const isMaster = selectRuntimeInstanceMode(context.getState()) === 'MASTER';
      const pending = isMaster ? selectHostPendingMember(context.getState()) : selectBranchPendingMember(context.getState());
      const operationId = context.command.payload.operationId;
      if (pending === null || pending.operationId !== operationId) return null;
      context.dispatchAction(isMaster ? memberActions.withdrawHostPending(operationId) : memberActions.withdrawBranchPending(operationId));
      await context.dispatchCommand(memberWithdrawnCommand, {operationId});
      return null;
    }),
  ]);
