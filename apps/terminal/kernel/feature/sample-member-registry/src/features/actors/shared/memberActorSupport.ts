import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {createInvalidMemberPayloadError} from '../../../foundations/errors';
import type {PendingMember} from '../../../types/types';

export type MemberMutationGuard = (state: StateRoot) => boolean;

export type BranchConfirmationLifecycle = Readonly<{
  onStarted: (operationId: string) => void;
  onSettled: (operationId: string) => void;
}>;

export const requireEligible = (guard: MemberMutationGuard | undefined, context: ActorExecutionContext): void => {
  if (guard !== undefined && !guard(context.getState())) throw new Error('MEMBER_MUTATION_REQUIRES_ACTIVE_SESSION');
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readPendingPayload = (context: ActorExecutionContext): Omit<PendingMember, 'operationId'> => {
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
