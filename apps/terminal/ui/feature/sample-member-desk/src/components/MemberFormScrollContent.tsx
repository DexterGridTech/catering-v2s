import {useInputField} from '@catering-v2s/ui-base-input';
import {PrimitiveInput, PrimitiveLabel, PrimitiveStatus} from '@catering-v2s/ui-base-primitives';

export const MemberFormScrollContent = ({
  initialName,
  initialPhone,
  editable,
  prefix = 'sample.desk.member-form',
}: Readonly<{readonly initialName: string; readonly initialPhone: string; readonly editable: boolean; readonly prefix?: string}>) => {
  const name = useInputField({
    fieldId: `${prefix}:name`,
    testID: `${prefix}:name`,
    accessibilityLabel: '姓名',
    initialValue: initialName,
    keyboardKind: 'virtual',
    layout: 'full',
  });
  const phone = useInputField({
    fieldId: `${prefix}:phone`,
    testID: `${prefix}:phone`,
    accessibilityLabel: '电话',
    initialValue: initialPhone,
    keyboardKind: 'virtual',
    layout: 'numeric',
  });
  const alphaProbe = useInputField({
    fieldId: `${prefix}:keyboard-alpha-probe`,
    testID: `${prefix}:keyboard-alpha-probe`,
    accessibilityLabel: '英文字符测试（仅 sample）',
    keyboardKind: 'virtual',
    layout: 'alpha',
  });
  const financialProbe = useInputField({
    fieldId: `${prefix}:keyboard-financial-probe`,
    testID: `${prefix}:keyboard-financial-probe`,
    accessibilityLabel: '金额格式测试（仅 sample）',
    keyboardKind: 'virtual',
    layout: 'financial',
  });

  return (
    <>
      <PrimitiveLabel testID={`${prefix}:name-label`} nativeID={`${prefix}:name`}>
        姓名
      </PrimitiveLabel>
      <PrimitiveInput {...name.inputProps} editable={editable} />
      <PrimitiveLabel testID={`${prefix}:phone-label`} nativeID={`${prefix}:phone`}>
        电话
      </PrimitiveLabel>
      <PrimitiveInput {...phone.inputProps} editable={editable} />
      <PrimitiveLabel
        testID={`${prefix}:keyboard-alpha-probe-label`}
        nativeID={`${prefix}:keyboard-alpha-probe`}
      >
        英文字符测试（仅 sample）
      </PrimitiveLabel>
      <PrimitiveInput {...alphaProbe.inputProps} editable={editable} />
      <PrimitiveStatus testID={`${prefix}:keyboard-alpha-probe-notice`}>不保存到会员资料</PrimitiveStatus>
      <PrimitiveLabel
        testID={`${prefix}:keyboard-financial-probe-label`}
        nativeID={`${prefix}:keyboard-financial-probe`}
      >
        金额格式测试（仅 sample）
      </PrimitiveLabel>
      <PrimitiveInput {...financialProbe.inputProps} editable={editable} />
      <PrimitiveStatus testID={`${prefix}:keyboard-financial-probe-notice`}>
        不保存到会员资料
      </PrimitiveStatus>
    </>
  );
};
