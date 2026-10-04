import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import type {MemberRejectedPayload} from '../../types/types';

export type EmptyPayload = Readonly<{}>;

export const submitMemberCommand = defineCommand<Readonly<{name: string; phone: string}>>(moduleName, {
  name: 'submit-member',
  visibility: 'public',
});

export const confirmMemberCommand = defineCommand<Readonly<{readonly operationId: string; readonly age?: number}>>(
  moduleName,
  {
    name: 'confirm-member',
    visibility: 'public',
  },
);

export const rejectMemberCommand = defineCommand<Readonly<{readonly operationId: string}>>(moduleName, {
  name: 'reject-member',
  visibility: 'public',
});

export const withdrawMemberCommand = defineCommand<Readonly<{readonly operationId: string}>>(moduleName, {
  name: 'withdraw-member',
  visibility: 'public',
});

export const memberPendingCommand = defineCommand<Readonly<{operationId: string; name: string; phone: string}>>(
  moduleName,
  {
    name: 'member-pending',
    visibility: 'public',
  },
);

export const memberConfirmedCommand = defineCommand<Readonly<{memberId: string}>>(moduleName, {
  name: 'member-confirmed',
  visibility: 'public',
});

export const memberRejectedCommand = defineCommand<MemberRejectedPayload>(moduleName, {
  name: 'member-rejected',
  visibility: 'public',
});

export const memberWithdrawnCommand = defineCommand<Readonly<{operationId: string}>>(moduleName, {
  name: 'member-withdrawn',
  visibility: 'public',
});

/** Host-only idempotent registration used after an LSP-local customer confirmation. */
export const registerBranchConfirmedMemberCommand = defineCommand<
  Readonly<{operationId: string; name: string; phone: string; age?: number}>
>(moduleName, {
  name: 'register-branch-confirmed-member',
  visibility: 'public',
});
