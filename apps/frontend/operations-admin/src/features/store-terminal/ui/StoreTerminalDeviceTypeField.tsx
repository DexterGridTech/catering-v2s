import {Form, Radio, Typography} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {STORE_TERMINAL_DEVICE_TYPES, storeTerminalDeviceTypeLabels} from '../model/storeTerminalModel';
import {storeTerminalTestIds} from '../storeTerminalTestIds';

type StoreTerminalDeviceTypeFieldProps = {mode: 'create'} | {mode: 'edit'; deviceType: string};

export function StoreTerminalDeviceTypeField(props: StoreTerminalDeviceTypeFieldProps) {
  if (props.mode === 'edit') {
    return (
      <Form.Item label="设备类型">
        <Typography.Text {...testId(storeTerminalTestIds.deviceTypeReadonly)}>
          {storeTerminalDeviceTypeLabels[props.deviceType] ?? props.deviceType}
        </Typography.Text>
      </Form.Item>
    );
  }

  return (
    <Form.Item name="deviceType" label="设备类型" rules={[{required: true, message: '请选择设备类型'}]}>
      <Radio.Group {...testId(storeTerminalTestIds.deviceType)}>
        {STORE_TERMINAL_DEVICE_TYPES.map(value => (
          <Radio key={value.key} value={value.key} {...testId(storeTerminalTestIds.deviceTypeOption(value.key))}>
            {value.label}
            <Typography.Text type="secondary" style={{marginInlineStart: 8}}>
              {value.description}
            </Typography.Text>
          </Radio>
        ))}
      </Radio.Group>
    </Form.Item>
  );
}
