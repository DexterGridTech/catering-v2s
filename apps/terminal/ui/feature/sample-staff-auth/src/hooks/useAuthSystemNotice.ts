import {useCallback} from 'react';
import {useDispatchCommand} from '@catering-v2s/ui-base-render';
import {dispatchAuthSystemFailureDismissal} from '../foundations/systemFailureDismissal';

export const useAuthSystemNotice = () => {
  const dispatchCommand = useDispatchCommand();
  const dismiss = useCallback(() => dispatchAuthSystemFailureDismissal(dispatchCommand), [dispatchCommand]);
  return {dismiss};
};
