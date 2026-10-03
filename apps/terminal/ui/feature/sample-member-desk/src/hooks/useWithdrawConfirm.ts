import {useCallback} from 'react';
import {closeLayerCommand} from '@catering-v2s/kernel-base-ui-state';
import {memberSubmissionWithdrawnCommand} from '../features/commands/commands';
import {selectHostPendingMember} from '@catering-v2s/kernel-feature-sample-member-registry';
import {dispatchWithRequestId, useDispatchCommand, useUiStateSelector} from '@catering-v2s/ui-base-render';

export const useWithdrawConfirm = () => {
  const dispatchCommand = useDispatchCommand();
  const pending = useUiStateSelector(selectHostPendingMember);
  const keepWaiting = useCallback(
    () =>
      dispatchWithRequestId({
        dispatchCommand,
        definition: closeLayerCommand,
        payload: {displayMode: 'PRIMARY', layerId: 'sample.desk.withdraw-confirm'},
      }),
    [dispatchCommand],
  );
  const withdraw = useCallback(
    () => pending === null || pending === undefined
      ? undefined
      : dispatchWithRequestId({
          dispatchCommand,
          definition: memberSubmissionWithdrawnCommand,
          payload: {operationId: pending.operationId},
          target: 'local',
        }),
    [dispatchCommand, pending],
  );
  return {keepWaiting, withdraw};
};
