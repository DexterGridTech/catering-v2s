import {Button, Space, Typography, Upload} from 'antd';
import type {ReactNode} from 'react';
import {testId} from '../automation/testId';

export type AdminImageCollectionStatus = 'READY' | 'UPLOADING' | 'FAILED';

export type AdminImageCollectionItem = {
  id: string;
  /** Stable business identity used for row and action locators. */
  identity: string;
  fileName: string;
  status: AdminImageCollectionStatus;
  file?: File;
  hasPreview: boolean;
};

export type AdminImageCollectionLimits = {
  maxImageCount: number;
  maxImageBytes: number;
};

export type AdminImageCollectionAction =
  'row' | 'preview' | 'status' | 'replace' | 'retry' | 'move-up' | 'move-down' | 'set-primary' | 'remove';

export type AdminImageCollectionLabels<Item extends AdminImageCollectionItem> = {
  title: ReactNode;
  formatLimits: (count: number, limits: AdminImageCollectionLimits) => ReactNode;
  loading: ReactNode;
  atLimit: ReactNode;
  upload: ReactNode;
  empty: ReactNode;
  pendingPreview: (item: Item, index: number) => ReactNode;
  renderPreview: (item: Item, index: number, previewTestId?: string) => ReactNode;
  renderStatus: (item: Item, index: number) => ReactNode;
  positionLabel: (index: number) => ReactNode;
  replace: ReactNode;
  retry: ReactNode;
  moveUp: ReactNode;
  moveDown: ReactNode;
  setPrimary: ReactNode;
  remove: ReactNode;
};

export type AdminImageCollectionTestIds = {
  root?: string;
  upload?: string;
  list?: string;
  item?: (identity: string, action: AdminImageCollectionAction) => string | undefined;
};

export type AdminImageCollectionEditorProps<Item extends AdminImageCollectionItem> = {
  items: readonly Item[];
  limits?: AdminImageCollectionLimits;
  labels: AdminImageCollectionLabels<Item>;
  testIds?: AdminImageCollectionTestIds;
  onStageMedia: (file: File, existingId?: string) => void | Promise<void>;
  onRemoveMedia: (id: string, index: number) => void | Promise<void>;
  onMoveMedia: (id: string, offset: -1 | 1) => void;
  onSetPrimaryMedia: (id: string) => void;
};

/**
 * Shared ordered image interaction surface. Business adapters own the asset
 * model, preview resolution, labels, locators, and stage/release semantics.
 */
export function AdminImageCollectionEditor<Item extends AdminImageCollectionItem>({
  items,
  limits,
  labels,
  testIds,
  onStageMedia,
  onRemoveMedia,
  onMoveMedia,
  onSetPrimaryMedia,
}: AdminImageCollectionEditorProps<Item>) {
  const uploadDisabled = !limits || items.length >= limits.maxImageCount;
  const locator = (identity: string, action: AdminImageCollectionAction) => {
    const value = testIds?.item?.(identity, action);
    return value ? testId(value) : {};
  };

  return (
    <Space direction="vertical" size={8} style={{display: 'flex'}} {...(testIds?.root ? testId(testIds.root) : {})}>
      <Space style={{width: '100%', justifyContent: 'space-between'}}>
        <Typography.Text strong>{labels.title}</Typography.Text>
        <Typography.Text type="secondary">
          {limits ? labels.formatLimits(items.length, limits) : labels.loading}
        </Typography.Text>
      </Space>
      <Upload
        accept="image/*"
        showUploadList={false}
        beforeUpload={file => {
          void onStageMedia(file as File);
          return Upload.LIST_IGNORE;
        }}
        disabled={uploadDisabled}
        {...(testIds?.upload ? testId(testIds.upload) : {})}
      >
        <Button disabled={uploadDisabled}>
          {!limits ? labels.loading : uploadDisabled ? labels.atLimit : labels.upload}
        </Button>
      </Upload>
      <Space direction="vertical" size={8} style={{display: 'flex'}} {...(testIds?.list ? testId(testIds.list) : {})}>
        {items.length === 0 && <Typography.Text type="secondary">{labels.empty}</Typography.Text>}
        {items.map((item, index) => (
          <Space
            key={item.id}
            align="start"
            style={{display: 'flex', border: '1px solid #f0f0f0', padding: 8, borderRadius: 6}}
            {...locator(item.identity, 'row')}
          >
            {item.hasPreview
              ? labels.renderPreview(item, index, testIds?.item?.(item.identity, 'preview'))
              : labels.pendingPreview(item, index)}
            <Space direction="vertical" size={2} style={{minWidth: 220}}>
              <Typography.Text strong>{labels.positionLabel(index)}</Typography.Text>
              <Typography.Text ellipsis={{tooltip: item.fileName}}>{item.fileName}</Typography.Text>
              <Typography.Text
                type={item.status === 'FAILED' ? 'danger' : item.status === 'UPLOADING' ? 'warning' : 'secondary'}
                aria-live="polite"
                {...locator(item.identity, 'status')}
              >
                {labels.renderStatus(item, index)}
              </Typography.Text>
            </Space>
            <Space wrap>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={file => {
                  void onStageMedia(file as File, item.id);
                  return Upload.LIST_IGNORE;
                }}
                disabled={item.status === 'UPLOADING'}
              >
                <Button size="small" disabled={item.status === 'UPLOADING'} {...locator(item.identity, 'replace')}>
                  {labels.replace}
                </Button>
              </Upload>
              {item.status === 'FAILED' && item.file && (
                <Button
                  size="small"
                  onClick={() => void onStageMedia(item.file as File, item.id)}
                  {...locator(item.identity, 'retry')}
                >
                  {labels.retry}
                </Button>
              )}
              {index > 0 && (
                <Button size="small" onClick={() => onMoveMedia(item.id, -1)} {...locator(item.identity, 'move-up')}>
                  {labels.moveUp}
                </Button>
              )}
              {index < items.length - 1 && (
                <Button size="small" onClick={() => onMoveMedia(item.id, 1)} {...locator(item.identity, 'move-down')}>
                  {labels.moveDown}
                </Button>
              )}
              {index > 0 && (
                <Button
                  size="small"
                  onClick={() => onSetPrimaryMedia(item.id)}
                  {...locator(item.identity, 'set-primary')}
                >
                  {labels.setPrimary}
                </Button>
              )}
              <Button
                size="small"
                danger
                disabled={index === 0 && items.length > 1}
                onClick={() => void onRemoveMedia(item.id, index)}
                {...locator(item.identity, 'remove')}
              >
                {labels.remove}
              </Button>
            </Space>
          </Space>
        ))}
      </Space>
    </Space>
  );
}
