import {useCallback} from 'react';
import {closeLayerCommand} from '@catering-v2s/kernel-base-ui-state';
import {memberDraftDiscardedCommand, type DraftDiscardIntent} from '../features/commands/commands';
import {dispatchWithRequestId, useDispatchCommand} from '@catering-v2s/ui-base-render';

export const useDiscardConfirm = (intent: DraftDiscardIntent) => {
  const dispatchCommand = useDispatchCommand();
  const keep = useCallback(
    () =>
      dispatchWithRequestId({
        dispatchCommand,
        definition: closeLayerCommand,
        payload: {displayMode: 'PRIMARY', layerId: 'sample.desk.discard-confirm'},
      }),
    [dispatchCommand],
  );
  const discard = useCallback(
    () =>
      dispatchWithRequestId({
        dispatchCommand,
        definition: memberDraftDiscardedCommand,
        payload: {intent},
      }),
    [dispatchCommand, intent],
  );
  return {message: intent === 'logout' ? '退出登记工作台？' : '放弃本次录入？', keep, discard};
};
