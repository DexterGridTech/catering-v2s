import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveStatus,
} from '@catering-v2s/ui-base-primitives';
import {InputScrollArea} from '@catering-v2s/ui-base-input';
import {MemberFormScrollContent} from '../MemberFormScrollContent';
import {useMemberForm} from '../../hooks/useMemberForm';

const mobileRootStyle = Object.freeze({width: '100%', paddingHorizontal: 8, gap: 3});

export const MemberForm = ({prefix = 'sample.desk.member-form'}: Readonly<{readonly prefix?: string}>) => {
  const form = useMemberForm(prefix);
  return (
    <PrimitiveContainer testID={prefix} style={mobileRootStyle}>
      <PrimitiveHeading testID={`${prefix}:title`}>新增会员</PrimitiveHeading>
      <InputScrollArea testID={`${prefix}:scroll`}>
        <MemberFormScrollContent
          initialName={form.nameInitialValue}
          initialPhone={form.phoneInitialValue}
          editable={!form.requestInFlight}
          prefix={prefix}
        />
      </InputScrollArea>
      <PrimitiveActions testID={`${prefix}:actions`} orientation="column">
        <PrimitiveButton
          testID={`${prefix}:submit`}
          accessibilityLabel="提交"
          disabled={form.requestInFlight}
          onPress={form.submit}
          style={{width: '100%'}}
        >
          {form.requestInFlight ? '提交中' : '提交'}
        </PrimitiveButton>
        <PrimitiveButton
          testID={`${prefix}:cancel`}
          accessibilityLabel="取消录入"
          disabled={form.requestInFlight}
          onPress={form.cancel}
          style={{width: '100%'}}
        >
          取消
        </PrimitiveButton>
      </PrimitiveActions>
      {form.requestInFlight ? <PrimitiveStatus testID={`${prefix}:loading`}>提交中</PrimitiveStatus> : null}
    </PrimitiveContainer>
  );
};
