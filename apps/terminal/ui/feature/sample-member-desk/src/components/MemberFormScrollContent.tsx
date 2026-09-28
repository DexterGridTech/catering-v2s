import {useInputField} from '@catering-v2s/ui-base-input';
import {PrimitiveInput, PrimitiveLabel, PrimitiveStatus} from '@catering-v2s/ui-base-primitives';

export const MemberFormScrollContent = ({
  initialName,
  initialPhone,
  editable,
}: Readonly<{readonly initialName: string; readonly initialPhone: string; readonly editable: boolean}>) => {
  const name = useInputField({
    fieldId: 'sample.desk.member-form:name',
    testID: 'sample.desk.member-form:name',
    accessibilityLabel: '姓名',
    initialValue: initialName,
    keyboardKind: 'virtual',
    layout: 'full',
  });
  const phone = useInputField({
    fieldId: 'sample.desk.member-form:phone',
    testID: 'sample.desk.member-form:phone',
    accessibilityLabel: '电话',
    initialValue: initialPhone,
    keyboardKind: 'virtual',
    layout: 'numeric',
  });
  const alphaProbe = useInputField({
    fieldId: 'sample.desk.member-form:keyboard-alpha-probe',
    testID: 'sample.desk.member-form:keyboard-alpha-probe',
    accessibilityLabel: '英文字符测试（仅 sample）',
    keyboardKind: 'virtual',
    layout: 'alpha',
  });
  const financialProbe = useInputField({
    fieldId: 'sample.desk.member-form:keyboard-financial-probe',
    testID: 'sample.desk.member-form:keyboard-financial-probe',
    accessibilityLabel: '金额格式测试（仅 sample）',
    keyboardKind: 'virtual',
    layout: 'financial',
  });

  return (
    <>
      <PrimitiveLabel testID="sample.desk.member-form:name-label" nativeID="sample.desk.member-form:name">
        姓名
      </PrimitiveLabel>
      <PrimitiveInput {...name.inputProps} editable={editable} />
      <PrimitiveLabel testID="sample.desk.member-form:phone-label" nativeID="sample.desk.member-form:phone">
        电话
      </PrimitiveLabel>
      <PrimitiveInput {...phone.inputProps} editable={editable} />
      <PrimitiveLabel
        testID="sample.desk.member-form:keyboard-alpha-probe-label"
        nativeID="sample.desk.member-form:keyboard-alpha-probe"
      >
        英文字符测试（仅 sample）
      </PrimitiveLabel>
      <PrimitiveInput {...alphaProbe.inputProps} editable={editable} />
      <PrimitiveStatus testID="sample.desk.member-form:keyboard-alpha-probe-notice">不保存到会员资料</PrimitiveStatus>
      <PrimitiveLabel
        testID="sample.desk.member-form:keyboard-financial-probe-label"
        nativeID="sample.desk.member-form:keyboard-financial-probe"
      >
        金额格式测试（仅 sample）
      </PrimitiveLabel>
      <PrimitiveInput {...financialProbe.inputProps} editable={editable} />
      <PrimitiveStatus testID="sample.desk.member-form:keyboard-financial-probe-notice">
        不保存到会员资料
      </PrimitiveStatus>
    </>
  );
};
