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

const laptopRootStyle = Object.freeze({width: '100%', maxWidth: 960, alignSelf: 'center' as const});

export const MemberForm = ({prefix = 'sample.desk.member-form'}: Readonly<{readonly prefix?: string}>) => {
  const form = useMemberForm(prefix);
  return (
    <PrimitiveContainer testID={prefix} style={laptopRootStyle}>
      <PrimitiveHeading testID={`${prefix}:title`}>新增会员</PrimitiveHeading>
      <InputScrollArea testID={`${prefix}:scroll`}>
        <MemberFormScrollContent
          initialName={form.nameInitialValue}
          initialPhone={form.phoneInitialValue}
          editable={!form.requestInFlight}
          prefix={prefix}
        />
      </InputScrollArea>
      <PrimitiveActions testID={`${prefix}:actions`}>
        <PrimitiveButton
          testID={`${prefix}:submit`}
          accessibilityLabel="提交"
          disabled={form.requestInFlight}
          onPress={form.submit}
        >
          {form.requestInFlight ? '提交中' : '提交'}
        </PrimitiveButton>
        <PrimitiveButton
          testID={`${prefix}:cancel`}
          accessibilityLabel="取消录入"
          disabled={form.requestInFlight}
          onPress={form.cancel}
        >
          取消
        </PrimitiveButton>
      </PrimitiveActions>
      {form.requestInFlight ? <PrimitiveStatus testID={`${prefix}:loading`}>提交中</PrimitiveStatus> : null}
    </PrimitiveContainer>
  );
};
