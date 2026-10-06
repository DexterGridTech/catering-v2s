import {useUiStateSelector} from '@catering-v2s/ui-base-render';
import {PrimitiveCenter, PrimitiveHeading, PrimitiveStatus} from '@catering-v2s/ui-base-primitives';
import {terminalActivationTestIds} from '../foundations/terminalActivationTestIds';
import {selectActivationStatusView} from '../selectors/selectActivationStatusView';

export const ActivationGuide = ({message}: Readonly<{readonly message: string}>) => {
  const statusView = useUiStateSelector(selectActivationStatusView);
  const activeForCurrentHost = statusView?.activation?.status === 'active' && statusView.currentPeerValue;
  return (
    <PrimitiveCenter testID={terminalActivationTestIds.guideScreen}>
      <PrimitiveHeading testID={terminalActivationTestIds.guideTitle}>设备激活</PrimitiveHeading>
      <PrimitiveStatus testID={terminalActivationTestIds.guideMessage} appearance="login">
        {activeForCurrentHost ? '设备已激活成功' : message}
      </PrimitiveStatus>
    </PrimitiveCenter>
  );
};
