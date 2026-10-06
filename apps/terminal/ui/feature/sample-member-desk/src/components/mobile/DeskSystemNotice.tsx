import {SystemFailureNotice} from '@catering-v2s/ui-base-render';
import {useDeskSystemNotice} from '../../hooks/useDeskSystemNotice';
import type {DeskSystemNoticeProps} from '../../types/memberNotices';
import {sampleMemberDeskTestId} from '../../foundations/sampleMemberDeskTestIds';

export const DeskSystemNotice = ({operation: _operation}: DeskSystemNoticeProps) => {
  const notice = useDeskSystemNotice();
  return (
    <SystemFailureNotice
      testIDPrefix={sampleMemberDeskTestId('sample.desk.system-notice')}
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
