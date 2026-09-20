import {QRCode, Typography} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import type {QrDisplayConfiguration, QrReadState} from '../model/storeServicePointModel';

export function qrDisplayValue(
  value: string | null | undefined,
  configuration: QrDisplayConfiguration | undefined,
  effectiveAvailable: boolean,
  readState: QrReadState,
  size: number,
  imageTestId?: string,
) {
  if (!effectiveAvailable) return <Typography.Text type="secondary">不可用</Typography.Text>;
  if (readState.loading && !configuration) return <Typography.Text type="secondary">二维码配置加载中…</Typography.Text>;
  if (readState.failed && !configuration) return <Typography.Text type="secondary">二维码配置读取失败</Typography.Text>;
  if (!configuration) return '暂未生成二维码';
  if (!configuration.enabled) return '不显示生成结果';
  if (!configuration.channelRef) return '未选择门店渠道';
  if (!value) return '暂未生成二维码';
  return (
    <QRCode
      value={value}
      type="svg"
      size={size}
      bordered={false}
      aria-label="二维码"
      {...(imageTestId ? testId(imageTestId) : {})}
    />
  );
}
