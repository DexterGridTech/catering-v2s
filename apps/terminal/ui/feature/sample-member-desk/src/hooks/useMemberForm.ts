import {useCallback} from 'react';
import {selectPendingMember, submitMemberCommand} from '@catering-v2s/kernel-feature-sample-member-registry';
import {deskSystemFailureObservedCommand, memberFormCancelledCommand} from '../features/commands/commands';
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useTrackedCommand,
  useUiStateSelector,
} from '@catering-v2s/ui-base-render';
import {useInputSnapshot} from '@catering-v2s/ui-base-input';

export const useMemberForm = (inputPrefix = 'sample.desk.member-form') => {
  const dispatchCommand = useDispatchCommand();
  const pending = useUiStateSelector(selectPendingMember);
  const captureInputSnapshot = useInputSnapshot();
  const trackedCommand = useTrackedCommand();
  const requestInFlight = trackedCommand.requestInFlight;

  const observeSystemFailure = useCallback(async (): Promise<void> => {
    try {
      await dispatchWithRequestId({
        dispatchCommand,
        definition: deskSystemFailureObservedCommand,
        payload: {operation: 'submit-member'},
      });
    } catch {
      // useDispatchCommand has already emitted the structured rejection diagnostic.
    }
  }, [dispatchCommand]);

  const submit = useCallback(async () => {
    if (requestInFlight) return;
    const snapshot = captureInputSnapshot();
    const name = snapshot.fields[`${inputPrefix}:name`]?.value ?? '';
    const phone = snapshot.fields[`${inputPrefix}:phone`]?.value ?? '';
    return trackedCommand.run({
      definition: submitMemberCommand,
      payload: {name, phone},
      rejectionPolicy: 'RETHROW',
      onOutcome: (_result, outcome) => (outcome === 'system-failure' ? observeSystemFailure() : undefined),
      onRejected: () => observeSystemFailure(),
    });
  }, [captureInputSnapshot, inputPrefix, observeSystemFailure, requestInFlight, trackedCommand]);

  const cancel = useCallback(() => {
    const snapshot = captureInputSnapshot();
    const name = snapshot.fields[`${inputPrefix}:name`]?.value ?? '';
    const phone = snapshot.fields[`${inputPrefix}:phone`]?.value ?? '';
    return dispatchWithRequestId({
      dispatchCommand,
      definition: memberFormCancelledCommand,
      payload: {dirty: name.trim().length > 0 || phone.trim().length > 0},
    });
  }, [captureInputSnapshot, dispatchCommand, inputPrefix]);

  return {
    nameInitialValue: pending?.name ?? '',
    phoneInitialValue: pending?.phone ?? '',
    requestInFlight,
    submit,
    cancel,
  };
};
