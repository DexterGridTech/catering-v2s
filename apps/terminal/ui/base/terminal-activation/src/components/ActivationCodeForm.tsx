import {useState} from 'react';
import type {CommandDispatchResult} from '@catering-v2s/kernel-base-runtime';
import {activateTerminalCommand, selectActivationState} from '@catering-v2s/kernel-base-terminal-data-client';
import {selectServerConfiguration} from '@catering-v2s/kernel-base-server-config';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {InputScrollArea, useInputField} from '@catering-v2s/ui-base-input';
import {useTrackedCommand, useUiStateSelector} from '@catering-v2s/ui-base-render';
import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveInput,
  PrimitiveLabel,
  PrimitiveStatus,
} from '@catering-v2s/ui-base-primitives';

const fieldId = 'terminal.activation.code';
const errors: Readonly<Record<string, string>> = Object.freeze({
  TERMINAL_BINDING_ALREADY_BOUND: '此设备已绑定，请联系管理员处理。',
  TERMINAL_BINDING_ACTIVATION_EXPIRED: '激活码已过期，请联系管理员获取新激活码。',
  STORE_TERMINAL_DISABLED: '终端已停用，暂时无法激活。',
  STORE_TERMINAL_DEVICE_TYPE_MISMATCH: '此设备不适用于当前终端类型。',
  PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED: '服务空间当前不可用，请联系管理员。',
  PLATFORM_COMMON_ACCESS_DENIED: '当前服务空间拒绝了激活请求。',
  PLATFORM_COMMON_VALIDATION_FAILED: '激活信息未通过校验，请检查后重试。',
});

type Props = Readonly<{readonly defaults: TransportServerConfig}>;

type ActivationCodeFieldProps = Readonly<{
  readonly onValueChange: (value: string) => void;
}>;

const ActivationCodeField = ({onValueChange}: ActivationCodeFieldProps) => {
  const field = useInputField({
    fieldId,
    testID: fieldId,
    accessibilityLabel: '8位激活码',
    keyboardKind: 'virtual',
    layout: 'numeric',
    maxLength: 8,
    onValueChange,
  });

  return (
    <>
      <PrimitiveLabel testID="terminal.activation:code-label" nativeID={fieldId}>
        8位激活码
      </PrimitiveLabel>
      <PrimitiveInput
        {...field.inputProps}
        onChangeText={text => field.inputProps.onChangeText?.(text.replace(/[^0-9]/g, '').slice(0, 8))}
      />
    </>
  );
};

const actorResultCode = (result: CommandDispatchResult | undefined): string | null => {
  if (result === undefined) return null;
  const values = result.actorResults;
  const payload = values?.find(value => typeof value.result === 'object' && value.result !== null)?.result;
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Readonly<Record<string, unknown>>;
  if (record.status === 'rejected' && typeof record.reason === 'string') return record.reason;
  if (typeof record.errorCode === 'string') return record.errorCode;
  if (typeof record.code === 'string') return record.code;
  if (typeof record.category === 'string') return record.category;
  return null;
};

export const ActivationCodeForm = ({defaults}: Props) => {
  const activation = useUiStateSelector(selectActivationState);
  const config = useUiStateSelector(state => selectServerConfiguration(state, defaults));
  const tracked = useTrackedCommand();
  const [value, setValue] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const submit = async (): Promise<void> => {
    if (!/^\d{8}$/.test(value) || tracked.requestInFlight) return;
    setResultMessage('');
    const result = await tracked.run({
      definition: activateTerminalCommand,
      payload: Object.freeze({activationCode: value}),
      rejectionPolicy: 'CONSUME',
      onRejected: () => setResultMessage('激活请求未完成，请检查网络后重试。'),
      onOutcome: execution => {
        const code = actorResultCode(execution);
        if (execution.status !== 'completed') {
          setResultMessage(
            code === null ? '激活请求未完成，请检查网络后重试。' : (errors[code] ?? '激活请求被服务空间拒绝。'),
          );
        }
      },
    });
    if (result === undefined) return;
    const code = actorResultCode(result);
    if (activation?.status !== 'active' && code !== null) {
      setResultMessage(errors[code] ?? '激活未完成，请检查激活码或服务空间。');
    }
  };

  if (activation?.status === 'active') {
    return (
      <PrimitiveStatus testID="terminal.activation.result" appearance="login">
        设备已激活成功
      </PrimitiveStatus>
    );
  }

  return (
    <PrimitiveContainer testID="terminal.activation.screen">
      <InputScrollArea testID="terminal.activation:scroll">
        <PrimitiveHeading testID="terminal.activation:title">设备激活</PrimitiveHeading>
        <PrimitiveStatus testID="terminal.activation:service-space">
          服务空间：{config?.selectedSpace ?? '正在读取'}
        </PrimitiveStatus>
        <ActivationCodeField onValueChange={setValue} />
      </InputScrollArea>
      <PrimitiveActions testID="terminal.activation:actions">
        <PrimitiveButton
          testID="terminal.activation.submit"
          accessibilityLabel="激活设备"
          disabled={value.length !== 8 || tracked.requestInFlight || activation?.status === 'cancelling'}
          busy={tracked.requestInFlight}
          onPress={() => void submit()}
        >
          {tracked.requestInFlight ? '正在激活' : '激活设备'}
        </PrimitiveButton>
      </PrimitiveActions>
      {resultMessage.length > 0 ? (
        <PrimitiveStatus testID="terminal.activation.result" tone="error">
          {resultMessage}
        </PrimitiveStatus>
      ) : null}
    </PrimitiveContainer>
  );
};
