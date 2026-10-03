import {PrimitiveContainer, PrimitiveText} from '@catering-v2s/ui-base-primitives';
import {selectHostStaffQualification} from '@catering-v2s/kernel-feature-sample-staff-session';
import {useUiStateSelector} from '@catering-v2s/ui-base-render';

export const AuthGuide = ({
  testID = 'sample.auth.guide',
  instruction,
}: Readonly<{readonly testID?: string; readonly instruction: string}>) => {
  const qualification = useUiStateSelector(selectHostStaffQualification);
  return (
    <PrimitiveContainer testID={testID} layout="centered" style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
      <PrimitiveText testID={`${testID}:message`}>
        {qualification === null || qualification === undefined
          ? '正在等待主机状态'
          : qualification.status === 'authenticated'
            ? '正在打开业务页面'
            : instruction}
      </PrimitiveText>
    </PrimitiveContainer>
  );
};
