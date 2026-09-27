import {Form} from 'antd';
import type {FormInstance} from 'antd';
import type {StoreTerminalCreateFormValues, StoreTerminalFormValues} from '../model/storeTerminalModel';
import {StoreTerminalFormDrawer, type StoreTerminalFormDrawerProps} from './StoreTerminalFormDrawer';

type TerminalCreateDrawerProps = Omit<
  StoreTerminalFormDrawerProps<StoreTerminalCreateFormValues>,
  'mode' | 'deviceType' | 'form'
> & {form: FormInstance<StoreTerminalCreateFormValues>};

/** Creation surface owns the first device-type step; shared form mechanics stay in the lifecycle-backed drawer. */
export function TerminalCreateDrawer(props: TerminalCreateDrawerProps) {
  const deviceType = Form.useWatch('deviceType', props.form) ?? '';
  return (
    <StoreTerminalFormDrawer
      {...props}
      form={props.form as unknown as FormInstance<StoreTerminalFormValues>}
      mode="create"
      deviceType={deviceType}
      editor={props.editor?.mode === 'create' ? props.editor : undefined}
    />
  );
}
