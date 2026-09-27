import type {FormInstance} from 'antd';
import type {StoreTerminalEditFormValues, StoreTerminalFormValues} from '../model/storeTerminalModel';
import {StoreTerminalFormDrawer, type StoreTerminalFormDrawerProps} from './StoreTerminalFormDrawer';

type TerminalEditDrawerProps = Omit<
  StoreTerminalFormDrawerProps<StoreTerminalEditFormValues>,
  'mode' | 'deviceType' | 'form'
> & {form: FormInstance<StoreTerminalEditFormValues>};

/** Edit surface starts at the complete-rule step and never exposes activation-code input. */
export function TerminalEditDrawer(props: TerminalEditDrawerProps) {
  const editor = props.editor?.mode === 'edit' ? props.editor : undefined;
  return (
    <StoreTerminalFormDrawer
      {...props}
      form={props.form as unknown as FormInstance<StoreTerminalFormValues>}
      mode="edit"
      deviceType={editor?.terminal.deviceType ?? ''}
      editor={editor}
    />
  );
}
