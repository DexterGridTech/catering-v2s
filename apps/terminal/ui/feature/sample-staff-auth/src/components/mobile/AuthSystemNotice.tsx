import {SystemFailureNotice} from '@catering-v2s/ui-base-render';
import {useAuthSystemNotice} from '../../hooks/useAuthSystemNotice';
import type {AuthSystemNoticeProps} from '../../types/authSystemNotice';
import {sampleStaffAuthTestIds} from '../sampleStaffAuthTestIds';

export const AuthSystemNotice = ({operation: _operation}: AuthSystemNoticeProps) => {
  const notice = useAuthSystemNotice();
  return (
    <SystemFailureNotice
      testIDPrefix={sampleStaffAuthTestIds.systemNotice}
      onDismiss={notice.dismiss}
      presentation={{
        rootStyle: {flex: 1, minHeight: 0, padding: 16, alignItems: 'stretch'},
        cardStyle: {width: '100%'},
        actionsOrientation: 'column',
        dismissButtonStyle: {width: '100%'},
      }}
    />
  );
};
