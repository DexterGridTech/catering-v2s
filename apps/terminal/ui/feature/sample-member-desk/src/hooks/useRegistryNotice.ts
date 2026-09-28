import {useCallback} from 'react';
import {
  memberRegistrationAbandonedCommand,
  memberRegistrationRetryRequestedCommand,
  type RegistryNoticeReason,
} from '../features/commands/commands';
import {dispatchWithRequestId, useDispatchCommand} from '@catering-v2s/ui-base-render';
import {registryNoticeMessage} from '../foundations/registryNoticeCopy';

export const useRegistryNotice = (reasonCode: RegistryNoticeReason) => {
  const dispatchCommand = useDispatchCommand();
  const retry = useCallback(
    () =>
      dispatchWithRequestId({
        dispatchCommand,
        definition: memberRegistrationRetryRequestedCommand,
        payload: {reasonCode},
      }),
    [dispatchCommand, reasonCode],
  );
  const abandon = useCallback(
    () =>
      dispatchWithRequestId({
        dispatchCommand,
        definition: memberRegistrationAbandonedCommand,
        payload: {},
      }),
    [dispatchCommand],
  );
  return {message: registryNoticeMessage(reasonCode), retry, abandon};
};
