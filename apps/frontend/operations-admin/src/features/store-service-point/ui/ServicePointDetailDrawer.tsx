import {Alert, Button, Card, Descriptions, Drawer, Space, Spin, Tag} from 'antd';
import {
  adminDrawerSurfaceProps,
  adminDetailDescriptionsProps,
  displayFieldValue,
  lifecycleColor,
  NameCodeText,
  testId,
} from '@catering-v2s/admin-ui-foundation';
import type {
  ExtensionDefinition,
  StoreServicePoint,
  StoreServicePointDetail,
  StoreServicePointStatus,
} from '../../../app/api/generated/operations-edge';
import {operationsProblemOf} from '../../../app/api/OperationsTransport';
import {AssetPreview} from '../../../app/components/AssetPreview';
import {
  areaTypeForPointType,
  displayExtensionValue,
  enabledStoreServicePointExtensionFields,
  storeServicePointShapeLabels,
  storeServicePointStatusLabels,
  titleForArea,
  type QrDisplayConfiguration,
  type QrReadState,
} from '../model/storeServicePointModel';
import {storeServicePointTestIds} from '../storeServicePointTestIds';
import {qrDisplayValue} from './ServicePointQrDisplay';

type DetailQueryState = {
  isFetching: boolean;
  error?: unknown;
};

export function ServicePointDetailDrawer({
  open,
  value,
  canEdit,
  extensionDefinition,
  qrConfiguration,
  qrReadState,
  detailQuery,
  onClose,
  onRetry,
  onEdit,
}: {
  open: boolean;
  value?: StoreServicePointDetail | StoreServicePoint;
  canEdit: boolean;
  extensionDefinition?: ExtensionDefinition;
  qrConfiguration?: QrDisplayConfiguration;
  qrReadState: QrReadState;
  detailQuery: DetailQueryState;
  onClose: () => void;
  onRetry: () => void;
  onEdit: (value: StoreServicePointDetail | StoreServicePoint) => void;
}) {
  const statusTag = (status: StoreServicePointStatus) => (
    <Tag color={lifecycleColor(status)}>{storeServicePointStatusLabels[status]}</Tag>
  );
  return (
    <Drawer
      open={open}
      title={value ? `${titleForArea(areaTypeForPointType(value.pointType))}详情：${value.name}` : '详情'}
      onClose={onClose}
      {...adminDrawerSurfaceProps}
      {...testId(storeServicePointTestIds.detailDrawer)}
      extra={
        value && canEdit ? (
          <Button onClick={() => onEdit(value)} {...testId(storeServicePointTestIds.detailAction)}>
            编辑
          </Button>
        ) : undefined
      }
    >
      {detailQuery.isFetching && !value ? <Spin tip="详情加载中…" /> : null}
      {detailQuery.error ? (
        <Alert
          type="error"
          showIcon
          title="详情读取失败"
          description={operationsProblemOf(detailQuery.error).detail || '请重试或稍后再试。'}
          action={<Button onClick={onRetry}>重试</Button>}
        />
      ) : null}
      {value && (
        <Space direction="vertical" size={16} style={{display: 'flex'}}>
          <Descriptions {...adminDetailDescriptionsProps} column={1}>
            <Descriptions.Item label="名称">
              <NameCodeText name={value.name} />
            </Descriptions.Item>
            <Descriptions.Item label="编码">
              <NameCodeText code={value.code} />
            </Descriptions.Item>
            <Descriptions.Item label="状态">{statusTag(value.status)}</Descriptions.Item>
            {value.pointType === 'TABLE' && (
              <Descriptions.Item label="容纳人数">{displayFieldValue(value.seatCapacity)}</Descriptions.Item>
            )}
            {value.pointType === 'TABLE' && (
              <Descriptions.Item label="形态">
                {displayFieldValue(value.tableShape ? storeServicePointShapeLabels[value.tableShape] : undefined)}
              </Descriptions.Item>
            )}
            {value.pointType === 'TABLE' && (
              <Descriptions.Item label="是否可预约">
                {displayFieldValue(
                  value.reservable === null || value.reservable === undefined
                    ? undefined
                    : value.reservable
                      ? '是'
                      : '否',
                )}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="是否可用">{value.effectiveAvailable ? '是' : '否'}</Descriptions.Item>
          </Descriptions>
          {value.imageAssetRef && (
            <AssetPreview assetRef={String(value.imageAssetRef)} alt={`${value.name}图片`} width={160} height={120} />
          )}
          {extensionDefinition && (
            <Descriptions {...adminDetailDescriptionsProps} column={1}>
              {enabledStoreServicePointExtensionFields(extensionDefinition).map(field => (
                <Descriptions.Item key={field.key} label={field.label}>
                  {displayExtensionValue(value.extensionValues[field.key])}
                </Descriptions.Item>
              ))}
            </Descriptions>
          )}
          <Card size="small" title="二维码结果" {...testId(storeServicePointTestIds.qrResult)}>
            {qrDisplayValue(
              value.qrUrl,
              qrConfiguration,
              value.effectiveAvailable,
              qrReadState,
              176,
              storeServicePointTestIds.qrResultImage(value.pointRef),
            )}
          </Card>
        </Space>
      )}
    </Drawer>
  );
}
