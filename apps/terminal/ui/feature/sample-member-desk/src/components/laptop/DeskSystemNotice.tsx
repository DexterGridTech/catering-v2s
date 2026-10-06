import {SystemFailureNotice} from '@catering-v2s/ui-base-render';
import type {DeskSystemNoticeProps} from '../../types/memberNotices';
import {useDeskSystemNotice} from '../../hooks/useDeskSystemNotice';
import {sampleMemberDeskTestId} from '../../foundations/sampleMemberDeskTestIds';

export const DeskSystemNotice = ({operation: _operation}: DeskSystemNoticeProps) => {
  const notice = useDeskSystemNotice();
  return (
    <SystemFailureNotice
      testIDPrefix={sampleMemberDeskTestId('sample.desk.system-notice')}
      onDismiss={notice.dismiss}
      presentation={{
        rootStyle: {flex: 1, minHeight: 0, padding: 24},
        cardStyle: {width: '100%', maxWidth: 720},
        actionsOrientation: 'row',
      }}
    />
  );
};
