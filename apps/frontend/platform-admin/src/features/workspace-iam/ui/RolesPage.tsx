import {ProTable} from '@ant-design/pro-components';
import {Alert, Button, Card, Tag, Typography} from 'antd';
import {
  adminListState,
  testId,
  useAsyncGenerationGuard,
  useDetailDrawer,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useMemo, useRef, useState} from 'react';
import {WorkspaceScope} from '../../../app/state/WorkspaceScope';
import {
  type SortDirection,
  type WorkspaceRole,
  type WorkspaceRoleSortKey,
} from '../../../app/api/generated/platform-edge';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {
  platformClient,
  platformProblemOf,
  platformRtk,
  type PlatformApiProblem,
} from '../../../app/api/PlatformTransport';
import {adminCatalog, platformPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import {RoleCreateDrawer} from './RoleCreateDrawer';
import {RoleDetailDrawer} from './RoleDetailDrawer';
import {RoleEditDrawer} from './RoleEditDrawer';
import {RoleStatusModal} from './RoleStatusModal';
import {serviceNodeTypeLabel} from './RolePermissionFields';
import {PlatformAuditHistoryModal, type PlatformAuditTarget} from '../../audit-history';
const rolesPage = adminCatalog.platformPages.find(page => page.pageDesignKey === platformPageDesignKeys.PlatformRoles);
if (!rolesPage) throw new Error('Missing generated roles page');
const rolesPageTitle = rolesPage.title;

export function RolesPage() {
  return <WorkspaceScope>{key => <RolesForWorkspace groupWorkspaceKey={key} />}</WorkspaceScope>;
}

function RolesForWorkspace({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<WorkspaceRoleSortKey>('NAME');
  const [direction, setDirection] = useState<SortDirection>('ASC');
  const [filters, setFilters] = useState<{
    name?: string;
    organizationType?: WorkspaceRole['serviceNodeType'];
    status?: WorkspaceRole['status'];
  }>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceRole>();
  const [statusRole, setStatusRole] = useState<WorkspaceRole>();
  const [auditTarget, setAuditTarget] = useState<PlatformAuditTarget>();
  const [pendingAction, setPendingAction] = useState<{kind: 'edit' | 'status'; role: WorkspaceRole}>();
  const [commandProblem, setProblem] = useState<PlatformApiProblem>();
  const [busy, setBusy] = useState(false);
  const detail = useDetailDrawer<WorkspaceRole>();
  const pendingActionRef = useRef<typeof pendingAction>(undefined);
  pendingActionRef.current = pendingAction;
  const detailGeneration = useAsyncGenerationGuard();
  useOverlayLock(detail.isOpen || createOpen || Boolean(editing) || Boolean(statusRole) || Boolean(auditTarget));
  const listRequest = useMemo(
    () =>
      platformAdminRtkRequest.getWorkspaceRoles(
        {groupWorkspaceKey},
        {query: {...filters, page, pageSize, sort, direction}},
      ),
    [direction, filters, groupWorkspaceKey, page, pageSize, sort],
  );
  const {data: result, error, isLoading} = platformRtk.useGetWorkspaceRolesQuery(listRequest);
  const problem = error ? platformProblemOf(error) : commandProblem;
  const loadDetail = useCallback(
    async (roleId: string, options: {preserveProblem?: boolean} = {}) => {
      const request = detailGeneration.begin();
      detail.openLoading();
      if (!options.preserveProblem) setProblem(undefined);
      try {
        const next = await platformClient.getWorkspaceRole({groupWorkspaceKey, roleId}, {});
        if (detailGeneration.isCurrent(request)) detail.open(next);
      } catch (nextError) {
        if (detailGeneration.isCurrent(request)) {
          detail.finishLoading();
          setProblem(platformProblemOf(nextError));
        }
      }
    },
    [detail, detailGeneration, groupWorkspaceKey],
  );
  const closeDetail = useCallback(() => {
    detailGeneration.invalidate();
    detail.close();
  }, [detail, detailGeneration]);
  const submitStatus = async (idempotencyKey: string) => {
    if (!statusRole) return;
    const role = statusRole;
    setBusy(true);
    setProblem(undefined);
    try {
      await platformClient.transitionWorkspaceRoleStatus(
        {groupWorkspaceKey, roleId: role.id},
        {
          body: {targetStatus: role.status === 'ENABLED' ? 'DISABLED' : 'ENABLED', expectedVersion: role.revision},
          headers: {'Idempotency-Key': idempotencyKey},
        },
      );
    } catch (nextError) {
      setProblem(platformProblemOf(nextError));
    } finally {
      setBusy(false);
      setStatusRole(undefined);
      await loadDetail(role.id, {preserveProblem: true});
    }
  };
  const requestDetailAction = (kind: 'edit' | 'status') => {
    if (!detail.target) return;
    const next = {kind, role: detail.target};
    pendingActionRef.current = next;
    setPendingAction(next);
    closeDetail();
  };
  const openPendingActionAfterDetailClosed = (open: boolean) => {
    const pending = pendingActionRef.current;
    if (open || !pending) return;
    if (pending.kind === 'edit') setEditing(pending.role);
    else setStatusRole(pending.role);
    pendingActionRef.current = undefined;
    setPendingAction(undefined);
  };
  const listState = adminListState({
    loading: isLoading && !result && !error,
    failed: Boolean(error),
    emptyText: '暂无业务角色',
    testIdPrefix: 'workspace-role-list',
  });
  return (
    <Card
      title={
        <Typography.Paragraph aria-label={rolesPageTitle} type="secondary" style={{margin: 0}}>
          为不同任职机构类型配置可使用的功能菜单和可执行的操作；保存与状态变更均由集团空间 owner 最终校验。
        </Typography.Paragraph>
      }
      extra={
        <Button type="primary" onClick={() => setCreateOpen(true)} {...testId('workspace-role-create')}>
          新建业务角色
        </Button>
      }
    >
      {problem && (
        <Alert
          type="error"
          showIcon
          title={problem.title}
          description={problem.detail}
          {...testId('workspace-role-list-error')}
        />
      )}
      <div {...testId('workspace-role-table')}>
        <ProTable<WorkspaceRole>
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
                {...testId('workspace-role-filter-submit')}
              >
                查询
              </Button>,
              <Button
                key="reset"
                onClick={() => {
                  searchConfig.form?.resetFields();
                  setFilters({});
                  setPage(1);
                }}
                {...testId('workspace-role-filter-reset')}
              >
                重置
              </Button>,
            ],
          }}
          onSubmit={value => {
            setPage(1);
            setFilters({
              name: value.name?.trim() || undefined,
              organizationType: value.organizationType,
              status: value.status,
            });
          }}
          pagination={result ? {current: result.page, pageSize: result.pageSize, total: result.total} : false}
          columns={[
            {
              key: 'name',
              title: '名称',
              dataIndex: 'name',
              sorter: true,
              fieldProps: {...testId('workspace-role-filter-name'), allowClear: true},
              render: (_, row) => (
                <Button
                  type="link"
                  onClick={() => void loadDetail(row.id)}
                  {...testId(`workspace-role-detail-${row.id}`)}
                >
                  {row.name}
                </Button>
              ),
            },
            {
              title: '任职机构类型',
              dataIndex: 'serviceNodeType',
              valueType: 'select',
              valueEnum: {
                GROUP: {text: '集团'},
                REGION: {text: '大区'},
                PROJECT: {text: '项目'},
                HEAD_COMPANY: {text: '总公司'},
                STORE: {text: '门店'},
              },
              fieldProps: {...testId('workspace-role-filter-service-node-type'), allowClear: true},
              render: (_, row) => serviceNodeTypeLabel(row.serviceNodeType),
            },
            {
              title: '状态',
              dataIndex: 'status',
              valueType: 'select',
              valueEnum: {ENABLED: {text: '启用'}, DISABLED: {text: '停用'}},
              fieldProps: {...testId('workspace-role-filter-status'), allowClear: true},
              render: (_, row) => <Tag>{row.status === 'ENABLED' ? '启用' : '停用'}</Tag>,
            },
            {title: '说明', dataIndex: 'description', search: false, render: value => value || '—'},
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
              setSort('NAME');
              setDirection('ASC');
              return;
            }
            setSort(current?.columnKey === 'name' ? 'NAME' : 'UPDATED_AT');
            setDirection(current.order === 'ascend' ? 'ASC' : 'DESC');
            setPage(1);
          }}
        />
      </div>
      <RoleCreateDrawer
        open={createOpen}
        groupWorkspaceKey={groupWorkspaceKey}
        catalog={result}
        onClose={() => setCreateOpen(false)}
        onCreated={role => void loadDetail(role.id)}
      />
      <RoleDetailDrawer
        open={detail.isOpen}
        loading={detail.loading}
        role={detail.target}
        catalog={result}
        onClose={closeDetail}
        onAfterOpenChange={openPendingActionAfterDetailClosed}
        onEdit={() => requestDetailAction('edit')}
        onChangeStatus={() => requestDetailAction('status')}
        onAudit={() =>
          detail.target &&
          setAuditTarget({entityType: 'WORKSPACE_ROLE', entityId: detail.target.id, displayName: detail.target.name})
        }
      />
      <RoleEditDrawer
        role={editing}
        groupWorkspaceKey={groupWorkspaceKey}
        catalog={result}
        onClose={() => setEditing(undefined)}
        onUpdated={role => void loadDetail(role.id)}
      />
      <RoleStatusModal
        key={statusRole ? `${statusRole.id}:${statusRole.status}` : 'closed'}
        role={statusRole}
        busy={busy}
        onClose={() => setStatusRole(undefined)}
        onConfirm={submitStatus}
      />
      <PlatformAuditHistoryModal
        open={Boolean(auditTarget)}
        target={auditTarget}
        groupWorkspaceKey={groupWorkspaceKey}
        onClose={() => setAuditTarget(undefined)}
      />
    </Card>
  );
}
