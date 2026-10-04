import {useCallback} from 'react';
import {
  confirmMemberCommand,
  rejectMemberCommand,
  selectBranchPendingMember,
  selectHostPendingMember,
} from '@catering-v2s/kernel-feature-sample-member-registry';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {CommandDefinition} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {
  deskSystemFailureObservedCommand,
  memberSubmissionWithdrawnCommand,
  type DeskSystemOperation,
} from '../features/commands/commands';
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useTrackedCommand,
  useUiStateSelector,
} from '@catering-v2s/ui-base-render';
import {useInputSnapshot} from '@catering-v2s/ui-base-input';
import type {CustomerMemberMode} from '../types/customerMember';

export const ageFieldId = (prefix = 'sample.desk.customer-member') => `${prefix}:age`;

export const useCustomerMember = ({
  mode,
  inputPrefix,
  pendingSource,
}: Readonly<{
  readonly mode: CustomerMemberMode;
  readonly inputPrefix?: string;
  readonly pendingSource?: 'host' | 'branch';
}>) => {
  const dispatchCommand = useDispatchCommand();
  const runtimeMode = useUiStateSelector(selectRuntimeInstanceMode);
  const resolvedPendingSource = pendingSource ?? (mode === 'confirm' || runtimeMode === 'MASTER' ? 'host' : 'branch');
  const pending =
    useUiStateSelector(resolvedPendingSource === 'host' ? selectHostPendingMember : selectBranchPendingMember) ?? null;
  const captureInputSnapshot = useInputSnapshot();
  const trackedCommand = useTrackedCommand();
  const requestInFlight = trackedCommand.requestInFlight;
  const canDecide = pending !== null && pending !== undefined && !requestInFlight;
  const memberAgeFieldId = ageFieldId(inputPrefix);

  const observeSystemFailure = useCallback(
    async (operation: DeskSystemOperation): Promise<void> => {
      try {
        await dispatchWithRequestId({
          dispatchCommand,
          definition: deskSystemFailureObservedCommand,
          payload: {operation},
        });
      } catch {
        // useDispatchCommand has already emitted the structured rejection diagnostic.
      }
    },
    [dispatchCommand],
  );

  const decide = useCallback(
    <TPayload extends StateJsonValue>(
      command: CommandDefinition<TPayload>,
      payload: TPayload,
      operation: DeskSystemOperation,
    ) => {
      if (!canDecide) return;
      return trackedCommand.run({
        definition: command,
        payload,
        target: mode === 'confirm' && resolvedPendingSource === 'host' && runtimeMode === 'SLAVE' ? 'peer' : 'local',
        rejectionPolicy: 'RETHROW',
        onOutcome: (_result, outcome) => (outcome === 'system-failure' ? observeSystemFailure(operation) : undefined),
        onRejected: () => observeSystemFailure(operation),
      });
    },
    [canDecide, mode, observeSystemFailure, resolvedPendingSource, runtimeMode, trackedCommand],
  );

  const confirm = useCallback(() => {
    const rawAge = captureInputSnapshot().fields[memberAgeFieldId]?.value.trim() ?? '';
    if (pending === null) return undefined;
    if (rawAge.length === 0) return decide(confirmMemberCommand, {operationId: pending.operationId}, 'confirm-member');
    const age = Number(rawAge);
    return decide(
      confirmMemberCommand,
      {operationId: pending.operationId, ...(Number.isFinite(age) ? {age} : {})},
      'confirm-member',
    );
  }, [captureInputSnapshot, decide, memberAgeFieldId, pending]);
  const reject = useCallback(
    () =>
      pending === null ? undefined : decide(rejectMemberCommand, {operationId: pending.operationId}, 'reject-member'),
    [decide, pending],
  );
  const handBack = useCallback(
    () =>
      pending === null
        ? undefined
        : decide(memberSubmissionWithdrawnCommand, {operationId: pending.operationId}, 'withdraw-member'),
    [decide, pending],
  );

  return {
    pending,
    ageFieldId: memberAgeFieldId,
    requestInFlight,
    canDecide,
    isHandheldConfirm: mode === 'handheld-confirm',
    confirm,
    reject,
    handBack,
  };
};
