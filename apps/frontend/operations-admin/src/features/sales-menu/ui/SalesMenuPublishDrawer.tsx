import {Alert, Button, Drawer, Space, Spin} from 'antd';
import {adminDrawerSurfaceProps, testId} from '@catering-v2s/admin-ui-foundation';
import {salesMenuTestIds} from '../salesMenuTestIds';
import {blockerLabel, type SalesMenuReadModel} from './salesMenuUiShared';

export function SalesMenuPublishDrawer({
  open,
  read,
  onClose,
  onPublish,
  canEdit,
}: {
  open: boolean;
  read: SalesMenuReadModel;
  onClose: () => void;
  onPublish: () => void;
  canEdit: boolean;
}) {
  const preview = read.publicationPreview.page;
  return (
    <Drawer
      open={open}
      title="更新到前台"
      onClose={onClose}
      maskClosable
      width="min(620px, calc(100vw - 48px))"
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button
            type="primary"
            onClick={onPublish}
            disabled={!canEdit || !preview || !preview.hasChanges || preview.violations.length > 0}
            {...testId(salesMenuTestIds.publishSubmit)}
          >
            更新到前台
          </Button>
        </Space>
      }
      {...adminDrawerSurfaceProps}
      {...testId(salesMenuTestIds.publishDrawer)}
    >
      {read.publicationPreview.query.isFetching && <Spin />}
      {read.publicationPreview.query.error && (
        <Alert
          type="error"
          showIcon
          title="发布预检暂时无法获取，请重试。"
          action={<Button onClick={() => void read.publicationPreview.query.refetch()}>重试</Button>}
        />
      )}
      {preview && (
        <Space direction="vertical" size={12} style={{display: 'flex'}}>
          {!preview.hasChanges && <Alert type="info" showIcon title="当前没有未发布修改。" />}
          {preview.violations.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title="菜单还有内容未满足更新到前台的条件。"
              description={
                <Space direction="vertical" size={4}>
                  {preview.violations.map((violation, index) => (
                    <span key={`${violation.kind}-${violation.salesItemRef ?? index}`}>
                      {blockerLabel(violation.kind)}
                    </span>
                  ))}
                </Space>
              }
            />
          )}
          {preview.hasChanges && preview.violations.length === 0 && (
            <Alert type="success" showIcon title="当前草稿可以更新到前台。" />
          )}
        </Space>
      )}
    </Drawer>
  );
}
