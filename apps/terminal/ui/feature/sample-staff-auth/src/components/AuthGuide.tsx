import {PrimitiveContainer, PrimitiveText} from '@catering-v2s/ui-base-primitives';
import {selectHostStaffQualification} from '@catering-v2s/kernel-feature-sample-staff-session';
import {useUiStateSelector} from '@catering-v2s/ui-base-render';
import {sampleStaffAuthTestIds} from './sampleStaffAuthTestIds';

export const AuthGuide = ({instruction}: Readonly<{readonly instruction: string}>) => {
  const qualification = useUiStateSelector(selectHostStaffQualification);
  return (
    <PrimitiveContainer
      testID={sampleStaffAuthTestIds.guide}
      layout="centered"
      style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}
    >
      <PrimitiveText testID={sampleStaffAuthTestIds.guideMessage}>
        {qualification === null || qualification === undefined
          ? '正在等待主机状态'
          : qualification.status === 'authenticated'
            ? '正在打开业务页面'
            : instruction}
      </PrimitiveText>
    </PrimitiveContainer>
  );
};
