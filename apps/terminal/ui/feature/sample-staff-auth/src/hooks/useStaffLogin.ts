import {useCallback, useState} from 'react';
import {dispatchWithRequestId, useDispatchCommand, useTrackedCommand} from '@catering-v2s/ui-base-render';
import {useInputSnapshot} from '@catering-v2s/ui-base-input';
import {loginCommand} from '@catering-v2s/kernel-feature-sample-staff-session';
import {authSystemFailureObservedCommand} from '../features/commands/commands';

export const operatorNameFieldId = 'sample.auth.login:operator-name';
export const passcodeFieldId = 'sample.auth.login:passcode';

export const useStaffLogin = () => {
  const dispatchCommand = useDispatchCommand();
  const captureInputSnapshot = useInputSnapshot();
  const [passcodeResetKey, setPasscodeResetKey] = useState(0);
  const trackedCommand = useTrackedCommand();
  const requestInFlight = trackedCommand.requestInFlight;
  const observeSystemFailure = useCallback(async (): Promise<void> => {
    try {
      await dispatchWithRequestId({
        dispatchCommand,
        definition: authSystemFailureObservedCommand,
        payload: {operation: 'login'},
      });
    } catch {
      // useDispatchCommand has already emitted the structured rejection diagnostic.
    }
  }, [dispatchCommand]);

  const submit = useCallback(() => {
    if (requestInFlight) return;
    const snapshot = captureInputSnapshot();
    const operatorNameValue = snapshot.fields[operatorNameFieldId]?.value ?? '';
    const passcodeValue = snapshot.fields[passcodeFieldId]?.value ?? '';
    return trackedCommand.run({
      definition: loginCommand,
      payload: {operatorName: operatorNameValue, passcode: passcodeValue},
      rejectionPolicy: 'RETHROW',
      onOutcome: (_result, outcome) => {
        if (outcome === 'business-failure') setPasscodeResetKey(value => value + 1);
        return outcome === 'system-failure' ? observeSystemFailure() : undefined;
      },
      onRejected: () => observeSystemFailure(),
    });
  }, [captureInputSnapshot, observeSystemFailure, requestInFlight, trackedCommand]);

  return {
    passcodeResetKey,
    requestInFlight,
    submit,
  };
};
