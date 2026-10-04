import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {RuntimeModule, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
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
} from '../features/commands/commands';
import {
  createConfirmMemberActor,
  createRejectMemberActor,
  createRegisterBranchConfirmedMemberActor,
  createSubmitMemberActor,
} from '../features/actors/actors';
import {memberErrorDefinitions} from '../foundations/errors';
import {moduleKind, moduleName} from '../moduleName';
import {memberStateRegistration} from '../features/slices/slice';
import {selectBranchPendingMember, selectMembers} from '../selectors/selectors';

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
  const actors = [
    createSubmitMemberActor(input.canMutate),
    createConfirmMemberActor(input.canMutate),
    createRejectMemberActor(input.canMutate),
    createRegisterBranchConfirmedMemberActor(input.canMutate),
  ] as const;
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    errorDefinitions: memberErrorDefinitions,
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: [{name: memberStateRegistration.name, persistIntent: memberStateRegistration.persistIntent}],
    stateSlices: [memberStateRegistration],
    install: (context: RuntimeModuleContext) => {
      active = true;
      const reconcileRegisteredBranchMember = (): void => {
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
            currentRegistered === undefined
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
