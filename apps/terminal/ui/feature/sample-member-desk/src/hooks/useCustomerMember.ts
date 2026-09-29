import {useCallback} from 'react';
import {
  confirmMemberCommand,
  rejectMemberCommand,
  selectPendingMember,
} from '@catering-v2s/kernel-feature-sample-member-registry';
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

export const ageFieldId = 'sample.desk.customer-member:age';

export const useCustomerMember = ({mode}: Readonly<{readonly mode: CustomerMemberMode}>) => {
  const dispatchCommand = useDispatchCommand();
  const pending = useUiStateSelector(selectPendingMember);
  const captureInputSnapshot = useInputSnapshot();
  const trackedCommand = useTrackedCommand();
  const requestInFlight = trackedCommand.requestInFlight;
  const canDecide = pending !== null && pending !== undefined && !requestInFlight;

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
        routeIntent: 'peer-intent',
        rejectionPolicy: 'RETHROW',
        onOutcome: (_result, outcome) => (outcome === 'system-failure' ? observeSystemFailure(operation) : undefined),
        onRejected: () => observeSystemFailure(operation),
      });
    },
    [canDecide, observeSystemFailure, trackedCommand],
  );

  const confirm = useCallback(() => {
    const rawAge = captureInputSnapshot().fields[ageFieldId]?.value.trim() ?? '';
    if (rawAge.length === 0) return decide(confirmMemberCommand, {}, 'confirm-member');
    const age = Number(rawAge);
    return decide(confirmMemberCommand, Number.isFinite(age) ? {age} : {}, 'confirm-member');
  }, [captureInputSnapshot, decide]);
  const reject = useCallback(() => decide(rejectMemberCommand, {}, 'reject-member'), [decide]);
  const handBack = useCallback(() => decide(memberSubmissionWithdrawnCommand, {}, 'withdraw-member'), [decide]);

  return {
    pending,
    ageFieldId,
    requestInFlight,
    canDecide,
    isHandheldConfirm: mode === 'handheld-confirm',
    confirm,
    reject,
    handBack,
  };
};
