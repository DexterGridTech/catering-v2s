import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {
  createRuntimeModule,
  selectRuntimeInstanceMode,
  type RuntimeModule,
  type RuntimeModuleContext,
} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {runtimeModuleDependencyNames} from '../dependencies';
import {
  confirmMemberCommand,
  memberConfirmedCommand,
  memberPendingCommand,
  memberRejectedCommand,
  rejectMemberCommand,
  submitMemberCommand,
  memberWithdrawnCommand,
  withdrawMemberCommand,
  registerBranchConfirmedMemberCommand,
} from '../declarations/commands';
import {createConfirmMemberActor} from '../features/actors/confirmMemberActor';
import {createRejectMemberActor} from '../features/actors/rejectMemberActor';
import {createRegisterBranchConfirmedMemberActor} from '../features/actors/registerBranchConfirmedMemberActor';
import {createSubmitMemberActor} from '../features/actors/submitMemberActor';
import {moduleKind, moduleName} from '../moduleName';
import {memberStateRegistration} from '../features/slices/memberRegistry';
import {selectBranchPendingMember} from '../selectors/selectBranchPendingMember';
import {selectHostPendingMember} from '../selectors/selectHostPendingMember';
import {selectMembers} from '../selectors/selectMembers';
import {selectPendingMember} from '../selectors/selectPendingMember';

const commands = [
  submitMemberCommand,
  confirmMemberCommand,
  rejectMemberCommand,
  memberPendingCommand,
  memberConfirmedCommand,
  memberRejectedCommand,
  withdrawMemberCommand,
  memberWithdrawnCommand,
  registerBranchConfirmedMemberCommand,
] as const;

export const createSampleMemberRegistryModule = (
  input: Readonly<{canMutate?: (state: StateRoot) => boolean}> = {},
): RuntimeModule => {
  let active = false;
  let reconciliationOperationId: string | null = null;
  let branchConfirmationInFlightOperationId: string | null = null;
  let reconcileRegisteredBranchMember = (): void => undefined;
  const actors = [
    createSubmitMemberActor(input.canMutate),
    createConfirmMemberActor(input.canMutate, {
      onStarted: operationId => {
        branchConfirmationInFlightOperationId = operationId;
      },
      onSettled: operationId => {
        if (branchConfirmationInFlightOperationId === operationId) branchConfirmationInFlightOperationId = null;
        reconcileRegisteredBranchMember();
      },
    }),
    createRejectMemberActor(input.canMutate),
    createRegisterBranchConfirmedMemberActor(input.canMutate),
  ] as const;
  return createRuntimeModule({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commandDefinitions: commands,
    selectorDefinitions: [selectMembers, selectPendingMember, selectHostPendingMember, selectBranchPendingMember],
    actorDefinitions: actors,
    stateSlices: [memberStateRegistration],
    install: (context: RuntimeModuleContext) => {
      active = true;
      reconcileRegisteredBranchMember = (): void => {
        if (!active || selectRuntimeInstanceMode(context.getState()) !== 'SLAVE') {
          reconciliationOperationId = null;
          return;
        }
        const state = context.getState();
        const pending = selectBranchPendingMember(state);
        const registered =
          pending === null
            ? undefined
            : selectMembers(state).find(member => member.operationId === pending.operationId);
        if (pending === null || registered === undefined) {
          reconciliationOperationId = null;
          return;
        }
        if (reconciliationOperationId === pending.operationId) return;
        if (branchConfirmationInFlightOperationId === pending.operationId) return;
        const operationId = pending.operationId;
        reconciliationOperationId = operationId;
        queueMicrotask(() => {
          const current = context.getState();
          const currentPending = selectBranchPendingMember(current);
          const currentRegistered = selectMembers(current).find(member => member.operationId === operationId);
          if (
            !active ||
            selectRuntimeInstanceMode(current) !== 'SLAVE' ||
            currentPending?.operationId !== operationId ||
            currentRegistered === undefined ||
            branchConfirmationInFlightOperationId === operationId
          ) {
            if (reconciliationOperationId === operationId) reconciliationOperationId = null;
            return;
          }
          void context
            .dispatchCommand(confirmMemberCommand, {operationId}, {requestId: createRequestId()})
            .catch((error: unknown) => {
              context.platformPorts.logger
                .scope({moduleName})
                .withContext({commandName: confirmMemberCommand.commandName})
                .error({
                  category: 'member-registry.reconciliation',
                  event: 'member-registry.branch-confirmation-reconciliation-failed',
                  message: 'Unable to reconcile a branch confirmation from the authoritative member list',
                  data: {operationId, errorType: error instanceof Error ? error.name : typeof error},
                });
            })
            .finally(() => {
              if (reconciliationOperationId === operationId) reconciliationOperationId = null;
            });
        });
      };
      const unsubscribe = context.subscribeState(reconcileRegisteredBranchMember);
      context.registerResource(() => {
        active = false;
        unsubscribe();
      });
      reconcileRegisteredBranchMember();
    },
  });
};
