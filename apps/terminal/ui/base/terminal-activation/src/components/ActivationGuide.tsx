import {useUiStateSelector} from '@catering-v2s/ui-base-render';
import {PrimitiveCenter, PrimitiveHeading, PrimitiveStatus} from '@catering-v2s/ui-base-primitives';
import {selectActivationStatusView} from '../selectors/selectActivationStatusView';

export const ActivationGuide = ({message}: Readonly<{readonly message: string}>) => {
  const statusView = useUiStateSelector(selectActivationStatusView);
  const activeForCurrentHost = statusView?.activation?.status === 'active' && statusView.currentPeerValue;
  return (
    <PrimitiveCenter testID="terminal.activation.guide:screen">
      <PrimitiveHeading testID="terminal.activation.guide:title">设备激活</PrimitiveHeading>
      <PrimitiveStatus testID="terminal.activation.guide" appearance="login">
        {activeForCurrentHost ? '设备已激活成功' : message}
      </PrimitiveStatus>
    </PrimitiveCenter>
  );
};
