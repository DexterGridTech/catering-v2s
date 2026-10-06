import {SystemFailureNotice} from '@catering-v2s/ui-base-render';
import type {WallpaperSystemNoticeProps} from '../../types/wallpaperSystemNotice';
import {useWallpaperSystemNotice} from '../../hooks/useWallpaperSystemNotice';
import {wallpaperSystemMessage} from '../../foundations/wallpaperSystemCopy';
import {wallpaperContentTestIds} from '../../foundations/wallpaperPickerTestIds';

export const WallpaperSystemNotice = ({operation, phase}: WallpaperSystemNoticeProps) => {
  const notice = useWallpaperSystemNotice();
  return (
    <SystemFailureNotice
      testIDPrefix={wallpaperContentTestIds.systemNotice}
      onDismiss={notice.dismiss}
      message={wallpaperSystemMessage(operation, phase)}
      presentation={{
        rootStyle: {flex: 1, minHeight: 0, padding: 16, alignItems: 'stretch'},
        cardStyle: {width: '100%'},
        actionsOrientation: 'column',
        dismissButtonStyle: {width: '100%'},
      }}
    />
  );
};
