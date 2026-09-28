import {useCallback} from 'react';
import {selectMembers as selectMemberRecords} from '@catering-v2s/kernel-feature-sample-member-registry';
import {logoutCommand} from '@catering-v2s/kernel-feature-sample-staff-session';
import {deskSystemFailureObservedCommand, memberFormOpenedCommand} from '../features/commands/commands';
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useTrackedCommand,
  useUiStateSelector,
} from '@catering-v2s/ui-base-render';

export const useMemberList = () => {
  const dispatchCommand = useDispatchCommand();
  const members = useUiStateSelector(selectMemberRecords) ?? [];
  const trackedCommand = useTrackedCommand();
  const requestInFlight = trackedCommand.requestInFlight;

  const openForm = useCallback(
    () =>
      dispatchWithRequestId({
        dispatchCommand,
        definition: memberFormOpenedCommand,
        payload: {},
      }),
    [dispatchCommand],
  );

  const observeSystemFailure = useCallback(async (): Promise<void> => {
    try {
      await dispatchWithRequestId({
        dispatchCommand,
        definition: deskSystemFailureObservedCommand,
        payload: {operation: 'logout'},
      });
    } catch (_error) {
      // useDispatchCommand has already emitted the structured rejection diagnostic.
    }
  }, [dispatchCommand]);

  const logout = useCallback(async () => {
    if (requestInFlight) return;
    return trackedCommand.run({
      definition: logoutCommand,
      payload: {},
      rejectionPolicy: 'RETHROW',
      onOutcome: (_result, outcome) => (outcome === 'system-failure' ? observeSystemFailure() : undefined),
      onRejected: () => observeSystemFailure(),
    });
  }, [observeSystemFailure, requestInFlight, trackedCommand]);

  return {members, requestInFlight, openForm, logout};
};
