import {ProTable} from '@ant-design/pro-components';
import {Alert, Button, Card, Tag, Typography} from 'antd';
import {
  adminListState,
  testId,
  useAsyncGenerationGuard,
  useDetailDrawer,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useRef, useState} from 'react';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {platformProblemOf, platformRtk, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {usePlatformSessionRefresh} from '../../../app/state/PlatformSession';
import {adminCatalog, platformPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import type {
  PlatformAdminDetail,
  PlatformAdminPage,
  PlatformAdminSortKey,
  SortDirection,
} from '../../../app/api/generated/platform-edge';
import {AdministratorCreateDrawer} from './AdministratorCreateDrawer';
import {AdministratorCredentialDrawer} from './AdministratorCredentialDrawer';
import {AdministratorDetailDrawer} from './AdministratorDetailDrawer';
import {AdministratorEditDrawer} from './AdministratorEditDrawer';
import {AdministratorStatusModal} from './AdministratorStatusModal';
import {PlatformAuditHistoryModal, type PlatformAuditTarget} from '../../audit-history';

type Admin = PlatformAdminPage['items'][number];
type AdminFilters = {userName?: string; loginName?: string; status?: 'ACTIVE' | 'DISABLED'};
const administratorPage = adminCatalog.platformPages.find(
  page => page.pageDesignKey === platformPageDesignKeys.PlatformAdminUsers,
);
if (!administratorPage) throw new Error('Missing generated administrator page');
const administratorPageTitle = administratorPage.title;

/** IA03 platform-admin governance: list -> owner detail -> one independent action surface. */
export function AdministratorsPage() {
  const refreshSession = usePlatformSessionRefresh();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<AdminFilters>({});
  const [sortKey, setSortKey] = useState<PlatformAdminSortKey>('USER_NAME');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ASC');
  const [commandProblem, setProblem] = useState<PlatformApiProblem>();
  const detail = useDetailDrawer<PlatformAdminDetail>();
  const detailGeneration = useAsyncGenerationGuard();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformAdminDetail>();
  const [credentialTarget, setCredentialTarget] = useState<PlatformAdminDetail>();
  const [statusTarget, setStatusTarget] = useState<PlatformAdminDetail>();
  const [auditTarget, setAuditTarget] = useState<PlatformAuditTarget>();
  const [pendingAction, setPendingAction] = useState<{
    kind: 'edit' | 'credential' | 'status';
    admin: PlatformAdminDetail;
  }>();
  const pendingActionRef = useRef<typeof pendingAction>(undefined);
  pendingActionRef.current = pendingAction;
  useOverlayLock(
    detail.isOpen ||
      createOpen ||
      Boolean(editing) ||
      Boolean(credentialTarget) ||
      Boolean(statusTarget) ||
      Boolean(auditTarget),
  );
  const listRequest = useMemo(
    () =>
      platformAdminRtkRequest.getPlatformAdminPage({}, {query: {...filters, page, pageSize, sortKey, sortDirection}}),
    [filters, page, pageSize, sortDirection, sortKey],
  );
  const {data: result, error, isLoading} = platformRtk.useGetPlatformAdminPageQuery(listRequest);
  const [loadDetail] = platformRtk.useLazyGetPlatformAdminDetailQuery();
  const problem = error ? platformProblemOf(error) : commandProblem;

  const openDetail = (row: Admin) => {
    const request = detailGeneration.begin();
    setProblem(undefined);
    detail.openLoading();
    void loadDetail(platformAdminRtkRequest.getPlatformAdminDetail({platformAdminId: row.id}, {}))
      .unwrap()
      .then(next => {
        if (detailGeneration.isCurrent(request)) detail.open(next);
      })
      .catch(next => {
        if (detailGeneration.isCurrent(request)) {
          detail.finishLoading();
          setProblem(platformProblemOf(next));
        }
      });
  };
  const returnToDetail = (admin: PlatformAdminDetail) => {
    setEditing(undefined);
    setCredentialTarget(undefined);
    setStatusTarget(undefined);
    detail.open(admin);
  };
  const openAction = (action: 'edit' | 'credential' | 'status') => {
    if (!detail.target) return;
    const next = {kind: action, admin: detail.target};
    pendingActionRef.current = next;
    setPendingAction(next);
    detail.close();
  };
  const openPendingActionAfterDetailClosed = (open: boolean) => {
    const pending = pendingActionRef.current;
    if (open || !pending) return;
    if (pending.kind === 'edit') setEditing(pending.admin);
    else if (pending.kind === 'credential') setCredentialTarget(pending.admin);
    else setStatusTarget(pending.admin);
    pendingActionRef.current = undefined;
    setPendingAction(undefined);
  };

  const closeDetail = () => {
    detailGeneration.invalidate();
    detail.close();
  };
  const listState = adminListState({
    loading: isLoading && !result && !error,
    failed: Boolean(error),
    emptyText: '暂无管理员',
    testIdPrefix: 'platform-admin-list',
  });
  return (
    <Card
      title={
        <Typography.Paragraph aria-label={administratorPageTitle} type="secondary" style={{margin: 0}}>
          通过管理员详情核对资料后，再进入独立的编辑、凭据或状态确认面；密码不会在后续读取中显示。
        </Typography.Paragraph>
      }
      extra={
        <Button type="primary" onClick={() => setCreateOpen(true)} {...testId('platform-admin-create')}>
          新建管理员
        </Button>
      }
    >
      {problem && (
        <Alert
          type="error"
          showIcon
          title={problem.title}
          description={problem.detail}
          style={{marginBottom: 16}}
          {...testId('platform-admin-list-error')}
        />
      )}
      <div {...testId('platform-admin-table')}>
        <ProTable<Admin>
          size="small"
          rowKey="id"
          loading={listState.loading}
          locale={listState.locale}
          dataSource={result?.items}
          options={false}
          search={{
            labelWidth: 'auto',
            optionRender: searchConfig => [
              <Button
                key="submit"
                type="primary"
                onClick={() => searchConfig.form?.submit()}
                {...testId('platform-admin-filter-submit')}
              >
                查询
              </Button>,
              <Button
                key="reset"
                onClick={() => {
                  searchConfig.form?.resetFields();
                  setPage(1);
                  setFilters({});
                }}
                {...testId('platform-admin-filter-reset')}
              >
                重置
              </Button>,
            ],
          }}
          onSubmit={value => {
            setPage(1);
            setFilters({
              userName: value.userName?.trim() || undefined,
              loginName: value.loginName?.trim() || undefined,
              status: value.status,
            });
          }}
          pagination={result ? {current: result.page, pageSize: result.pageSize, total: result.total} : false}
          columns={[
            {
              key: 'userName',
              title: '姓名',
              dataIndex: 'userName',
              sorter: true,
              fieldProps: {...testId('platform-admin-filter-user-name'), allowClear: true},
              render: (_, row) => (
                <Button type="link" onClick={() => void openDetail(row)} {...testId(`platform-admin-detail-${row.id}`)}>
                  {row.userName}
                </Button>
              ),
            },
            {
              title: '账号类型',
              dataIndex: 'builtIn',
              search: false,
              render: (_, row) => (row.builtIn ? '内置管理员' : '平台管理员'),
            },
            {
              key: 'loginName',
              title: '登录账号',
              dataIndex: 'loginName',
              sorter: true,
              fieldProps: {...testId('platform-admin-filter-login-name'), allowClear: true},
            },
            {
              title: '状态',
              dataIndex: 'status',
              valueType: 'select',
              valueEnum: {ACTIVE: {text: '已启用'}, DISABLED: {text: '已停用'}},
              fieldProps: {...testId('platform-admin-filter-status'), style: {width: 120}},
              render: (_, row) => (
                <Tag color={row.status === 'ACTIVE' ? 'success' : 'default'}>
                  {row.status === 'ACTIVE' ? '已启用' : '已停用'}
                </Tag>
              ),
            },
            {
              key: 'lastLoginAt',
              title: '最近登录',
              dataIndex: 'lastLoginAt',
              valueType: 'dateTime',
              sorter: true,
              search: false,
            },
            {
              key: 'updatedAt',
              title: '更新时间',
              dataIndex: 'updatedAt',
              valueType: 'dateTime',
              sorter: true,
              search: false,
            },
          ]}
          onChange={(pagination, _, sorter, extra) => {
            if (extra.action === 'paginate') {
              setPage(pagination.current ?? page);
              setPageSize(pagination.pageSize ?? pageSize);
              return;
            }
            if (extra.action !== 'sort') return;
            const current = Array.isArray(sorter) ? sorter[0] : sorter;
            if (!current?.order) {
              setSortKey('USER_NAME');
              setSortDirection('ASC');
              return;
            }
            const nextSort =
              current?.columnKey === 'userName'
                ? 'USER_NAME'
                : current?.columnKey === 'loginName'
                  ? 'LOGIN_NAME'
                  : current?.columnKey === 'lastLoginAt'
                    ? 'LAST_LOGIN_AT'
                    : 'UPDATED_AT';
            setSortKey(nextSort);
            setSortDirection(current.order === 'ascend' ? 'ASC' : 'DESC');
            setPage(1);
          }}
        />
      </div>
      <AdministratorDetailDrawer
        open={detail.isOpen}
        loading={detail.loading}
        problem={problem}
        admin={detail.target}
        onClose={closeDetail}
        onAfterOpenChange={openPendingActionAfterDetailClosed}
        onEdit={() => openAction('edit')}
        onCredential={() => openAction('credential')}
        onStatus={() => openAction('status')}
        onAudit={() =>
          detail.target &&
          setAuditTarget({
            entityType: 'PLATFORM_ADMIN',
            entityId: detail.target.id,
            displayName: detail.target.userName,
          })
        }
      />
      <AdministratorCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={admin => {
          setCreateOpen(false);
          detail.open(admin);
        }}
      />
      <AdministratorEditDrawer
        admin={editing}
        onClose={() => setEditing(undefined)}
        onUpdated={admin => {
          returnToDetail(admin);
          void refreshSession();
        }}
      />
      <AdministratorCredentialDrawer
        admin={credentialTarget}
        onClose={() => setCredentialTarget(undefined)}
        onUpdated={returnToDetail}
      />
      <AdministratorStatusModal
        admin={statusTarget}
        onClose={() => setStatusTarget(undefined)}
        onUpdated={returnToDetail}
        onProblem={setProblem}
      />
      <PlatformAuditHistoryModal
        open={Boolean(auditTarget)}
        target={auditTarget}
        onClose={() => setAuditTarget(undefined)}
      />
    </Card>
  );
}
