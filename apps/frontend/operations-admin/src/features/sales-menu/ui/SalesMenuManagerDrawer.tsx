import {MoreOutlined} from '@ant-design/icons';
import {Alert, Button, Drawer, Dropdown, Input, Space, Table} from 'antd';
import {CursorPagination, adminListState, adminWideDrawerSurfaceProps, testId} from '@catering-v2s/admin-ui-foundation';
import {type SalesMenuDetail, type SalesMenuSummary} from '../../../app/api/generated/operations-edge';
import {salesMenuChannelStatusLabel} from '../model/salesMenuModel';
import {salesMenuTestIds} from '../salesMenuTestIds';
import {menuStateLabel, problemMessage, type SalesMenuReadModel} from './salesMenuUiShared';

export function SalesMenuManagerDrawer({
  open,
  read,
  onClose,
  onSelect,
  onToggle,
  onRename,
  onCopy,
  onArchive,
  canEdit,
}: {
  open: boolean;
  read: SalesMenuReadModel;
  onClose: () => void;
  onSelect: (menu: SalesMenuDetail | SalesMenuSummary) => void;
  onToggle: (menu: SalesMenuSummary) => void;
  onRename: (menu: SalesMenuSummary) => void;
  onCopy: (menu: SalesMenuSummary) => void;
  onArchive: (menu: SalesMenuSummary) => void;
  canEdit: boolean;
}) {
  const page = read.manager.page;
  const rows = page?.items ?? [];
  const error = problemMessage(read.manager.query.error, '菜单列表暂时无法获取，请重试。');
  const managerReadModelReady = !read.manager.query.isFetching && !read.manager.query.isError;
  return (
    <Drawer
      open={open}
      title="管理菜单"
      onClose={onClose}
      maskClosable
      {...adminWideDrawerSurfaceProps}
      width="min(880px, calc(100vw - 48px))"
      {...testId(salesMenuTestIds.menuManager)}
    >
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        <Input.Search
          value={read.managerQuery}
          allowClear
          placeholder="搜索菜单名称"
          onChange={event => {
            read.setManagerQuery(event.target.value);
            read.manager.cursor.reset();
          }}
          onSearch={() => read.manager.cursor.reset()}
          {...testId(salesMenuTestIds.managerSearch)}
        />
        {error && (
          <Alert
            type="error"
            showIcon
            title={error}
            action={<Button onClick={() => void read.manager.query.refetch()}>重试</Button>}
          />
        )}
        <Table<SalesMenuSummary>
          size="small"
          rowKey="salesMenuRef"
          {...adminListState({
            loading: read.manager.query.isFetching,
            failed: Boolean(error),
            emptyText: '暂无菜单',
            testIdPrefix: salesMenuTestIds.managerList,
          })}
          dataSource={rows}
          pagination={false}
          columns={[
            {
              title: '菜单名称',
              key: 'name',
              render: (_, row) => (
                <Button
                  type="link"
                  onClick={() => onSelect(row)}
                  style={{padding: 0}}
                  {...testId(salesMenuTestIds.managerAction(row.salesMenuRef, 'select'))}
                >
                  {row.name}
                </Button>
              ),
            },
            {title: '菜单状态', key: 'state', render: (_, row) => menuStateLabel(row)},
            {
              title: '经营入口',
              key: 'activation',
              render: (_, row) => salesMenuChannelStatusLabel(row.activation?.status ?? 'DISABLED'),
            },
            {
              title: '启停',
              key: 'toggle',
              render: (_, row) => (
                <Button
                  type="link"
                  disabled={!canEdit || row.archived || !managerReadModelReady}
                  onClick={() => onToggle(row)}
                  {...testId(salesMenuTestIds.managerAction(row.salesMenuRef, 'toggle'))}
                >
                  {row.activation?.status === 'ENABLED' ? '停用' : '启用'}
                </Button>
              ),
            },
            {
              key: 'actions',
              render: (_, row) => (
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'rename',
                        label: '重命名',
                        disabled: !canEdit || row.archived || !managerReadModelReady,
                        ...testId(salesMenuTestIds.managerAction(row.salesMenuRef, 'rename')),
                      },
                      {
                        key: 'copy',
                        label: '复制',
                        disabled: !canEdit || !managerReadModelReady,
                        ...testId(salesMenuTestIds.managerAction(row.salesMenuRef, 'copy')),
                      },
                      {
                        key: 'archive',
                        label: '归档',
                        danger: true,
                        disabled: !canEdit || row.archived || !managerReadModelReady,
                        ...testId(salesMenuTestIds.managerAction(row.salesMenuRef, 'archive')),
                      },
                    ],
                    onClick: event => {
                      if (event.key === 'rename') onRename(row);
                      if (event.key === 'copy') onCopy(row);
                      if (event.key === 'archive') onArchive(row);
                    },
                  }}
                >
                  <Button
                    type="text"
                    icon={<MoreOutlined />}
                    aria-label="更多菜单操作"
                    disabled={!managerReadModelReady}
                    {...testId(salesMenuTestIds.managerAction(row.salesMenuRef, 'menu'))}
                  />
                </Dropdown>
              ),
            },
          ]}
        />
        <CursorPagination
          state={read.manager.cursor}
          nextCursor={page?.nextCursor ?? undefined}
          testIdPrefix={salesMenuTestIds.managerCursor}
        />
      </Space>
    </Drawer>
  );
}
