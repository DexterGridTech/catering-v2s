import {ProTable, type ProColumns, type ProFormInstance} from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  type MenuProps,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  createContentIdempotencyKey,
  MOBILE_PATTERN,
  activeInvitationPageUrl,
  adminDrawerSurfaceProps,
  createPageQueryIdentity,
  NameCodePathText,
  testId,
  useAsyncGenerationGuard,
  useCursorCandidates,
  useDetailDrawer,
  useDrawerFormLifecycle,
  useOverlayLock,
  usePageQuery,
  useRefreshVersion,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
import {platformDetailDrawerTestIds} from '../../../app/automation/platformDetailDrawerTestIds';
import {
  platformClient,
  platformContentTabRefreshSignal,
  platformProblemOf,
  platformRtk,
} from '../../../app/api/PlatformTransport';
import type {
  PlatformWorkspaceInvitation,
  PlatformWorkspaceInvitationPage,
  ServiceNodeType,
  SortDirection,
  WorkspaceInvitationCandidatePage,
  WorkspaceInvitationSortKey,
  WorkspaceInvitationStatus,
} from '../../../app/api/generated/platform-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {PlatformAuditHistoryModal, type PlatformAuditTarget} from '../../audit-history';

type InvitationFilters = {
  mobile?: string;
  targetOrganizationType?: ServiceNodeType;
  targetOrganizationRef?: string;
  roleId?: string;
  status?: WorkspaceInvitationStatus;
};
type InvitationForm = {mobile: string; targetType: ServiceNodeType; targetOrganizationRef?: string; roleIds?: string[]};
type CandidateOption = {value: string; label: ReactNode};

const targetTypes: ServiceNodeType[] = ['GROUP', 'REGION', 'PROJECT', 'HEAD_COMPANY', 'STORE'];
const targetLabels: Record<ServiceNodeType, string> = {
  GROUP: '集团',
  REGION: '大区',
  PROJECT: '项目',
  HEAD_COMPANY: '总公司',
  STORE: '门店',
};
const statusLabels: Record<WorkspaceInvitationStatus, string> = {
  ACTIVE: '有效',
  CANCELLED: '已取消',
  EXPIRED: '已过期',
  COMPLETED: '已完成',
};

const time = (value: number | null | undefined) => (value ? new Date(value).toLocaleString('zh-CN') : '—');
const text = (value?: string) => value?.trim() || undefined;
const candidateOptions = (
  values: WorkspaceInvitationCandidatePage | undefined,
  type: ServiceNodeType,
): CandidateOption[] =>
  (values?.organizations ?? [])
    .filter(candidate => candidate.serviceNodeType === type)
    .map(candidate => ({value: candidate.organizationRef, label: <NameCodePathText nodes={candidate.pathNodes} />}));

function operationsInvitationUrl(invitationPath: string | null | undefined) {
  if (!invitationPath) return undefined;
  const configuredOrigin = import.meta.env.VITE_OPERATIONS_ADMIN_ORIGIN?.replace(/\/$/, '');
  const localHost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  const fallbackOrigin = localHost
    ? `${window.location.protocol}//${window.location.hostname}:5175`
    : window.location.origin;
  return `${configuredOrigin || fallbackOrigin}${invitationPath}`;
}

export function PlatformInvitationPanel({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const [sort, setSort] = useState<WorkspaceInvitationSortKey>('CREATED_AT');
  const [direction, setDirection] = useState<SortDirection>('DESC');
  const [filters, setFilters] = useState<InvitationFilters>({});
  const queryIdentity = useMemo(
    () =>
      createPageQueryIdentity({
        operationId: PLATFORM_ADMIN_OPERATION_IDS.getWorkspaceInvitations,
        scope: {groupWorkspaceKey},
        filters,
        sort: {sort, direction},
      }),
    [direction, filters, groupWorkspaceKey, sort],
  );
  const pagination = usePageQuery({queryIdentity, initialPageSize: 10});
  const {page, pageSize} = pagination;
  const [filterTargetType, setFilterTargetType] = useState<ServiceNodeType>();
  const [filterOrganizationQuery, setFilterOrganizationQuery] = useState('');
  const [filterRoleQuery, setFilterRoleQuery] = useState('');
  const filterFormRef = useRef<ProFormInstance | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [auditTarget, setAuditTarget] = useState<PlatformAuditTarget>();
  const [detailProblem, setDetailProblem] = useState<string>();
  const detail = useDetailDrawer<PlatformWorkspaceInvitation>();
  const detailGeneration = useAsyncGenerationGuard();
  const contentTabRefreshVersion = useRefreshVersion(platformContentTabRefreshSignal);
  useOverlayLock(createOpen || detail.isOpen || Boolean(auditTarget));
  const request = useMemo(() => {
    const {targetOrganizationRef, roleId, ...restFilters} = filters;
    return platformAdminRtkRequest.getWorkspaceInvitations(
      {groupWorkspaceKey},
      {
        query: {
          ...restFilters,
          ...(targetOrganizationRef ? {targetOrganizationRef: wireUuid(targetOrganizationRef)} : {}),
          ...(roleId ? {roleId: wireUuid(roleId)} : {}),
          page,
          pageSize,
          sort,
          direction,
        },
      },
    );
  }, [direction, filters, groupWorkspaceKey, page, pageSize, sort]);
  const invitations = platformRtk.useGetWorkspaceInvitationsQuery(request);
  const result = invitations.data as PlatformWorkspaceInvitationPage | undefined;
  const problem = invitations.error ? platformProblemOf(invitations.error) : undefined;
  const loadDetail = useCallback(
    async (invitationId: string) => {
      const generation = detailGeneration.begin();
      detail.openLoading();
      setDetailProblem(undefined);
      try {
        const next = await platformClient.getWorkspaceInvitation({groupWorkspaceKey, invitationId}, {});
        if (detailGeneration.isCurrent(generation)) detail.open(next);
      } catch (error) {
        if (detailGeneration.isCurrent(generation)) {
          detail.finishLoading();
          setDetailProblem(platformProblemOf(error).detail);
        }
      }
    },
    [detail, detailGeneration, groupWorkspaceKey],
  );
  const closeDetail = useCallback(() => {
    detailGeneration.invalidate();
    detail.close();
  }, [detail, detailGeneration]);
  useEffect(() => {
    if (contentTabRefreshVersion === 0 || !detail.isOpen || !detail.target?.id) return;
    void loadDetail(detail.target.id);
  }, [contentTabRefreshVersion, detail.isOpen, detail.target?.id, loadDetail]);
  const filterOrganizationState = useCursorCandidates<CandidateOption>({
    queryText: filterOrganizationQuery,
    resetKey: `${filterTargetType ?? ''}|${groupWorkspaceKey}|ORGANIZATION`,
    pageSize: 50,
    keyOf: option => option.value,
  });
  const filterRoleState = useCursorCandidates<CandidateOption>({
    queryText: filterRoleQuery,
    resetKey: `${filterTargetType ?? ''}|${groupWorkspaceKey}|ROLE`,
    pageSize: 50,
    keyOf: option => option.value,
  });
  const filterOrganizationRequest = useMemo(
    () =>
      filterTargetType
        ? platformAdminRtkRequest.getWorkspaceInvitationCandidates(
            {groupWorkspaceKey},
            {
              query: {
                targetOrganizationType: filterTargetType,
                subjectType: 'ORGANIZATION',
                candidateUsage: 'LIST_FILTER',
                queryText: filterOrganizationState.debouncedQueryText,
                page: filterOrganizationState.page,
                pageSize: 50,
              },
            },
          )
        : undefined,
    [filterOrganizationState.debouncedQueryText, filterOrganizationState.page, filterTargetType, groupWorkspaceKey],
  );
  const filterRoleRequest = useMemo(
    () =>
      filterTargetType
        ? platformAdminRtkRequest.getWorkspaceInvitationCandidates(
            {groupWorkspaceKey},
            {
              query: {
                targetOrganizationType: filterTargetType,
                subjectType: 'ROLE',
                candidateUsage: 'LIST_FILTER',
                queryText: filterRoleState.debouncedQueryText,
                page: filterRoleState.page,
                pageSize: 50,
              },
            },
          )
        : undefined,
    [filterRoleState.debouncedQueryText, filterRoleState.page, filterTargetType, groupWorkspaceKey],
  );
  const filterOrganizationCandidates = platformRtk.useGetWorkspaceInvitationCandidatesQuery(
    filterOrganizationRequest!,
    {skip: !filterOrganizationRequest},
  );
  const filterRoleCandidates = platformRtk.useGetWorkspaceInvitationCandidatesQuery(filterRoleRequest!, {
    skip: !filterRoleRequest,
  });
  const filterOrganizationPage = filterOrganizationCandidates.data as WorkspaceInvitationCandidatePage | undefined;
  const filterRolePage = filterRoleCandidates.data as WorkspaceInvitationCandidatePage | undefined;
  const filterOrganizationOptions = filterOrganizationState.items;
  const filterRoleOptions = filterRoleState.items;
  const {acceptPage: acceptFilterOrganizationPage} = filterOrganizationState;
  const {acceptPage: acceptFilterRolePage} = filterRoleState;
  const {onPopupScroll: onFilterOrganizationPopupScroll} = filterOrganizationState;
  const {onPopupScroll: onFilterRolePopupScroll} = filterRoleState;
  useEffect(() => {
    if (filterOrganizationPage && filterTargetType)
      acceptFilterOrganizationPage(
        candidateOptions(filterOrganizationPage, filterTargetType),
        filterOrganizationPage.metadata,
      );
  }, [acceptFilterOrganizationPage, filterOrganizationPage, filterTargetType]);
  useEffect(() => {
    if (filterRolePage)
      acceptFilterRolePage(
        (filterRolePage.roles ?? []).map(role => ({value: role.id, label: role.name})),
        filterRolePage.metadata,
      );
  }, [acceptFilterRolePage, filterRolePage]);
  const columns = useMemo<ProColumns<PlatformWorkspaceInvitation>[]>(
    () => [
      {
        title: '邀请手机号',
        dataIndex: 'mobile',
        search: false,
        render: (_, row) => (
          <Button
            type="link"
            onClick={() => void loadDetail(row.id)}
            {...testId(`platform-invitation-detail-${row.id}`)}
          >
            {row.mobile}
          </Button>
        ),
      },
      {
        title: '邀请手机号',
        dataIndex: 'mobile',
        hideInTable: true,
        fieldProps: {...testId('platform-invitation-query-mobile'), placeholder: '请输入邀请手机号', allowClear: true},
      },
      {
        title: '任职机构类型',
        dataIndex: 'targetOrganizationType',
        search: false,
        render: (_, row) => <Tag>{targetLabels[row.targetOrganizationType]}</Tag>,
      },
      {
        title: '任职机构类型',
        dataIndex: 'targetOrganizationType',
        hideInTable: true,
        valueType: 'select',
        valueEnum: Object.fromEntries(targetTypes.map(value => [value, {text: targetLabels[value]}])),
        fieldProps: {
          allowClear: true,
          ...testId('platform-invitation-query-organization-type'),
          onChange: (value: ServiceNodeType | undefined) => {
            setFilterTargetType(value);
            setFilterOrganizationQuery('');
            setFilterRoleQuery('');
            filterFormRef.current?.setFieldValue('targetOrganizationRef', undefined);
            filterFormRef.current?.setFieldValue('roleId', undefined);
          },
        },
      },
      {
        title: '任职机构',
        dataIndex: 'targetOrganizationRef',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          showSearch: {filterOption: false, onSearch: setFilterOrganizationQuery},
          onPopupScroll: (event: Parameters<typeof onFilterOrganizationPopupScroll>[0]) =>
            onFilterOrganizationPopupScroll(event, filterOrganizationCandidates.isFetching),
          disabled: !filterTargetType,
          options: filterOrganizationOptions,
          loading: filterOrganizationCandidates.isFetching,
          placeholder: filterTargetType ? '搜索机构名称或编码' : '请先选择任职机构类型',
          allowClear: true,
          ...testId('platform-invitation-query-organization'),
        },
      },
      {
        title: '业务角色',
        dataIndex: 'roleId',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          showSearch: {filterOption: false, onSearch: setFilterRoleQuery},
          onPopupScroll: (event: Parameters<typeof onFilterRolePopupScroll>[0]) =>
            onFilterRolePopupScroll(event, filterRoleCandidates.isFetching),
          disabled: !filterTargetType,
          options: filterRoleOptions,
          loading: filterRoleCandidates.isFetching,
          placeholder: filterTargetType ? '搜索业务角色' : '请先选择任职机构类型',
          allowClear: true,
          ...testId('platform-invitation-query-role'),
        },
      },
      {
        title: '任职机构',
        dataIndex: 'targetOrganizationPathNodes',
        search: false,
        render: (_, row) => <NameCodePathText nodes={row.targetOrganizationPathNodes} />,
      },
      {
        title: '业务角色',
        dataIndex: 'roleNames',
        search: false,
        render: (_, row) => (
          <Space wrap size={[4, 4]}>
            {row.roleNames.map(role => (
              <Tag key={role}>{role}</Tag>
            ))}
          </Space>
        ),
      },
      {
        title: '邀请链接',
        key: 'invitationRouteFacts',
        search: false,
        render: (_, row) => {
          const href = operationsInvitationUrl(activeInvitationPageUrl(row));
          return href ? (
            <a href={href} target="_blank" rel="noreferrer" {...testId(`platform-invitation-entry-${row.id}`)}>
              打开邀请页
            </a>
          ) : (
            '—'
          );
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: Object.fromEntries(Object.entries(statusLabels).map(([value, label]) => [value, {text: label}])),
        fieldProps: {...testId('platform-invitation-query-status'), allowClear: true},
        render: (_, row) => (
          <Tag color={row.status === 'ACTIVE' ? 'blue' : row.status === 'COMPLETED' ? 'green' : 'default'}>
            {statusLabels[row.status]}
          </Tag>
        ),
      },
      {title: '有效期', dataIndex: 'expiresAt', search: false, sorter: true, render: (_, row) => time(row.expiresAt)},
      {title: '发起时间', dataIndex: 'createdAt', search: false, sorter: true, render: (_, row) => time(row.createdAt)},
    ],
    [
      filterOrganizationCandidates.isFetching,
      filterOrganizationOptions,
      onFilterOrganizationPopupScroll,
      onFilterRolePopupScroll,
      filterRoleCandidates.isFetching,
      filterRoleOptions,
      filterTargetType,
      loadDetail,
    ],
  );
  return (
    <Card
      title={
        <Typography.Paragraph type="secondary" style={{margin: 0}}>
          管理当前集团空间各组织节点的邀请，可发出、取消或重发邀请。
        </Typography.Paragraph>
      }
      extra={
        <Button type="primary" onClick={() => setCreateOpen(true)} {...testId('platform-invitation-create-open')}>
          发出邀请
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
          {...testId('platform-invitation-list-error')}
        />
      )}
      <ProTable<PlatformWorkspaceInvitation>
        size="small"
        formRef={filterFormRef}
        rowKey="id"
        options={false}
        loading={invitations.isLoading && !result}
        dataSource={result?.items ?? []}
        columns={columns}
        search={{
          labelWidth: 'auto',
          optionRender: searchConfig => [
            <Button
              key="submit"
              type="primary"
              onClick={() => searchConfig.form?.submit()}
              {...testId('platform-invitation-query-submit')}
            >
              查询
            </Button>,
            <Button
              key="reset"
              onClick={() => {
                searchConfig.form?.resetFields();
                pagination.setPage(1);
                setFilters({});
                setFilterTargetType(undefined);
                setFilterOrganizationQuery('');
                setFilterRoleQuery('');
              }}
              {...testId('platform-invitation-query-reset')}
            >
              重置
            </Button>,
          ],
        }}
        onSubmit={values => {
          pagination.setPage(1);
          setFilters({
            mobile: text(values.mobile),
            targetOrganizationType: values.targetOrganizationType,
            targetOrganizationRef: values.targetOrganizationRef,
            roleId: typeof values.roleId === 'string' ? values.roleId : undefined,
            status: values.status,
          });
        }}
        onReset={() => {
          pagination.setPage(1);
          setFilters({});
          setFilterTargetType(undefined);
          setFilterOrganizationQuery('');
          setFilterRoleQuery('');
        }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: result?.total ?? 0,
          showSizeChanger: true,
        }}
        onChange={(tablePagination, _, sorterValue, extra) => {
          if (extra.action === 'paginate') {
            if (tablePagination.pageSize !== pageSize) pagination.setPageSize(tablePagination.pageSize ?? pageSize);
            else pagination.setPage(tablePagination.current ?? page);
            return;
          }
          if (extra.action !== 'sort') return;
          const sorter = Array.isArray(sorterValue) ? sorterValue[0] : sorterValue;
          if (!sorter?.order) {
            setSort('CREATED_AT');
            setDirection('DESC');
            return;
          }
          setSort(sorter.columnKey === 'expiresAt' ? 'EXPIRES_AT' : 'CREATED_AT');
          setDirection(sorter.order === 'ascend' ? 'ASC' : 'DESC');
          pagination.setPage(1);
        }}
        locale={{emptyText: '当前集团空间暂无邀请'}}
        {...testId('platform-invitation-table')}
      />
      <PlatformInvitationCreateDrawer
        open={createOpen}
        groupWorkspaceKey={groupWorkspaceKey}
        onClose={() => setCreateOpen(false)}
        onChanged={() => void invitations.refetch()}
      />
      <PlatformInvitationDetailDrawer
        invitation={detail.target}
        loading={detail.loading}
        problem={detailProblem}
        open={detail.isOpen}
        groupWorkspaceKey={groupWorkspaceKey}
        onClose={closeDetail}
        onReadback={detail.open}
        onChanged={() => void invitations.refetch()}
        onAudit={() =>
          detail.target &&
          setAuditTarget({
            entityType: 'WORKSPACE_INVITATION',
            entityId: detail.target.id,
            displayName: detail.target.mobile,
          })
        }
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

function useInvitationCommandItems({
  invitation,
  groupWorkspaceKey,
  onReadback,
  onChanged,
}: {
  invitation?: PlatformWorkspaceInvitation;
  groupWorkspaceKey: string;
  onReadback: (next: PlatformWorkspaceInvitation) => void;
  onChanged: () => void;
}) {
  const {message} = App.useApp();
  const [busy, setBusy] = useState(false);
  const command = async (kind: 'cancel' | 'reissue') => {
    if (!invitation) return;
    setBusy(true);
    try {
      const latest = await platformClient.getWorkspaceInvitation({groupWorkspaceKey, invitationId: invitation.id}, {});
      onReadback(latest);
      const operationId = kind === 'cancel' ? 'cancelWorkspaceInvitation' : 'reissueWorkspaceInvitation';
      const payload = {groupWorkspaceKey, invitationId: invitation.id, expectedVersion: latest.revision};
      const idempotencyKey = await createContentIdempotencyKey(operationId, payload);
      const readback =
        kind === 'cancel'
          ? await platformClient.cancelWorkspaceInvitation(
              {groupWorkspaceKey, invitationId: invitation.id},
              {body: {expectedVersion: latest.revision}, headers: {'Idempotency-Key': idempotencyKey}},
            )
          : await platformClient.reissueWorkspaceInvitation(
              {groupWorkspaceKey, invitationId: invitation.id},
              {body: {expectedVersion: latest.revision}, headers: {'Idempotency-Key': idempotencyKey}},
            );
      onReadback(readback);
      onChanged();
    } catch (error) {
      message.error(platformProblemOf(error).detail);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const items: MenuProps['items'] = [];
  if (invitation && invitation.status !== 'COMPLETED') {
    if (invitation.status === 'ACTIVE') {
      items.push({
        key: 'cancel',
        danger: true,
        disabled: busy,
        label: (
          <Popconfirm title="确认取消该邀请？" onConfirm={() => void command('cancel')}>
            <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.invitation.cancel(invitation.id)}>
              取消
            </AdminDetailActionLabel>
          </Popconfirm>
        ),
      });
    } else {
      items.push({
        key: 'reissue',
        disabled: busy,
        label: (
          <Popconfirm title="确认重发该邀请？" onConfirm={() => void command('reissue')}>
            <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.invitation.reissue(invitation.id)}>
              重发
            </AdminDetailActionLabel>
          </Popconfirm>
        ),
      });
    }
  }
  return {items, busy};
}

function PlatformInvitationDetailDrawer({
  open,
  invitation,
  loading,
  problem,
  groupWorkspaceKey,
  onClose,
  onReadback,
  onChanged,
  onAudit,
}: {
  open: boolean;
  invitation?: PlatformWorkspaceInvitation;
  loading: boolean;
  problem?: string;
  groupWorkspaceKey: string;
  onClose: () => void;
  onReadback: (next: PlatformWorkspaceInvitation) => void;
  onChanged: () => void;
  onAudit: () => void;
}) {
  const invitationCommands = useInvitationCommandItems({
    invitation,
    groupWorkspaceKey,
    onReadback,
    onChanged,
  });
  const actionItems: MenuProps['items'] = invitation
    ? [
        {
          key: 'audit',
          label: (
            <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.invitation.audit}>
              操作历史
            </AdminDetailActionLabel>
          ),
          onClick: onAudit,
        },
        ...invitationCommands.items,
      ]
    : [];
  return (
    <Drawer
      title="邀请详情"
      open={open}
      size={600}
      destroyOnHidden
      maskClosable
      onClose={onClose}
      {...adminDrawerSurfaceProps}
      extra={
        actionItems.length > 0 ? (
          <AdminDetailActionMenu
            items={actionItems}
            triggerTestId={platformDetailDrawerTestIds.invitation.actionMenu}
            disabled={invitationCommands.busy}
            loading={invitationCommands.busy}
          />
        ) : undefined
      }
    >
      {loading && <Skeleton active />}
      {!loading && problem && <Alert type="error" showIcon title="邀请详情暂时无法读取" description={problem} />}
      {!loading && invitation && (
        <Descriptions
          bordered
          size="small"
          column={1}
          items={[
            {key: 'mobile', label: '邀请手机号', children: invitation.mobile},
            {key: 'issuer', label: '发起人', children: invitation.issuerDisplayName},
            {key: 'targetType', label: '任职机构类型', children: targetLabels[invitation.targetOrganizationType]},
            {
              key: 'target',
              label: '任职机构',
              children: <NameCodePathText nodes={invitation.targetOrganizationPathNodes} />,
            },
            {key: 'roles', label: '业务角色', children: invitation.roleNames.join('、')},
            {key: 'status', label: '状态', children: statusLabels[invitation.status]},
            {key: 'expires', label: '有效期', children: time(invitation.expiresAt)},
            {key: 'created', label: '发起时间', children: time(invitation.createdAt)},
          ]}
        />
      )}
    </Drawer>
  );
}

function PlatformInvitationCreateDrawer({
  open,
  groupWorkspaceKey,
  onClose,
  onChanged,
}: {
  open: boolean;
  groupWorkspaceKey: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [form] = Form.useForm<InvitationForm>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: next => {
      if (!next) onClose();
    },
    dirtyMessage: '填写中的邀请资料不会保存。',
    idempotencyKey: true,
  });
  const [organizationQuery, setOrganizationQuery] = useState('');
  const [roleQuery, setRoleQuery] = useState('');
  const [problem, setProblem] = useState<string>();
  const targetType = Form.useWatch('targetType', form);
  const selectedOrganizationRef = Form.useWatch('targetOrganizationRef', form);
  const organizationState = useCursorCandidates<CandidateOption>({
    queryText: organizationQuery,
    resetKey: `${open}|${groupWorkspaceKey}|${targetType ?? ''}|ORGANIZATION`,
    pageSize: 50,
    keyOf: option => option.value,
  });
  const roleState = useCursorCandidates<CandidateOption>({
    queryText: roleQuery,
    resetKey: `${open}|${groupWorkspaceKey}|${targetType ?? ''}|${selectedOrganizationRef ?? ''}|ROLE`,
    pageSize: 50,
    keyOf: option => option.value,
  });
  const organizationRequest = useMemo(
    () =>
      targetType
        ? platformAdminRtkRequest.getWorkspaceInvitationCandidates(
            {groupWorkspaceKey},
            {
              query: {
                targetOrganizationType: targetType,
                subjectType: 'ORGANIZATION',
                candidateUsage: 'INVITATION_TARGET',
                queryText: organizationState.debouncedQueryText,
                page: organizationState.page,
                pageSize: 50,
              },
            },
          )
        : undefined,
    [groupWorkspaceKey, organizationState.debouncedQueryText, organizationState.page, targetType],
  );
  const roleRequest = useMemo(
    () =>
      targetType && selectedOrganizationRef
        ? platformAdminRtkRequest.getWorkspaceInvitationCandidates(
            {groupWorkspaceKey},
            {
              query: {
                targetOrganizationType: targetType,
                subjectType: 'ROLE',
                candidateUsage: 'INVITATION_TARGET',
                queryText: roleState.debouncedQueryText,
                page: roleState.page,
                pageSize: 50,
                selectedOrganizationRef: wireUuid(selectedOrganizationRef),
              },
            },
          )
        : undefined,
    [groupWorkspaceKey, roleState.debouncedQueryText, roleState.page, selectedOrganizationRef, targetType],
  );
  const organizationQueryResult = platformRtk.useGetWorkspaceInvitationCandidatesQuery(organizationRequest!, {
    skip: !open || !organizationRequest,
  });
  const roleQueryResult = platformRtk.useGetWorkspaceInvitationCandidatesQuery(roleRequest!, {
    skip: !open || !roleRequest,
  });
  useEffect(() => {
    if (!open) {
      form.resetFields();
      lifecycle.reset();
      setOrganizationQuery('');
      setRoleQuery('');
      setProblem(undefined);
    }
  }, [form, lifecycle, open]);
  const organizationPage = organizationQueryResult.data as WorkspaceInvitationCandidatePage | undefined;
  const rolePage = roleQueryResult.data as WorkspaceInvitationCandidatePage | undefined;
  const {acceptPage: acceptOrganizationPage} = organizationState;
  const {acceptPage: acceptRolePage} = roleState;
  useEffect(() => {
    if (organizationPage && targetType)
      acceptOrganizationPage(candidateOptions(organizationPage, targetType), organizationPage.metadata);
  }, [acceptOrganizationPage, organizationPage, targetType]);
  useEffect(() => {
    if (rolePage)
      acceptRolePage(
        (rolePage.roles ?? []).map(role => ({value: role.id, label: role.name})),
        rolePage.metadata,
      );
  }, [acceptRolePage, rolePage]);
  const create = async (value: InvitationForm) => {
    if (!value.targetType || !value.targetOrganizationRef || !value.roleIds?.length || lifecycle.submitting) return;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      await platformClient.createWorkspaceInvitation(
        {groupWorkspaceKey},
        {
          body: {
            mobile: value.mobile.trim(),
            targetOrganizationType: value.targetType,
            targetOrganizationRef: wireUuid(value.targetOrganizationRef),
            roleIds: value.roleIds.map(roleId => wireUuid(roleId)),
          },
          headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
        },
      );
      lifecycle.setDirty(false);
      onChanged();
      onClose();
    } catch (error) {
      setProblem(platformProblemOf(error).detail);
    } finally {
      lifecycle.setSubmitting(false);
    }
  };
  const organizations = organizationState.items;
  const roles = roleState.items;
  return (
    <Drawer
      title="发出邀请"
      open={open}
      size={600}
      destroyOnHidden
      maskClosable={!lifecycle.submitting}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      {...adminDrawerSurfaceProps}
      footer={
        <Space>
          <Button onClick={lifecycle.requestClose}>取消</Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            onClick={() => form.submit()}
            {...testId('platform-invitation-create-submit')}
          >
            发出邀请
          </Button>
        </Space>
      }
    >
      {problem && <Alert type="error" showIcon title="邀请暂未发出" description={problem} style={{marginBottom: 16}} />}
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting}
        onFinish={value => void create(value)}
        onValuesChange={changed => {
          lifecycle.setDirty(true);
          lifecycle.markBusinessIntentChanged();
          if ('targetType' in changed) {
            form.setFieldValue('targetOrganizationRef', undefined);
            form.setFieldValue('roleIds', []);
          }
          if ('targetOrganizationRef' in changed) form.setFieldValue('roleIds', []);
        }}
      >
        <Form.Item
          name="mobile"
          label="邀请手机号"
          rules={[
            {required: true, message: '请输入邀请手机号'},
            {pattern: MOBILE_PATTERN, message: '请输入正确的手机号'},
          ]}
        >
          <Input autoComplete="tel" {...testId('platform-invitation-mobile')} />
        </Form.Item>
        <Form.Item name="targetType" label="任职机构类型" rules={[{required: true, message: '请选择任职机构类型'}]}>
          <Select
            options={targetTypes.map(value => ({value, label: targetLabels[value]}))}
            {...testId('platform-invitation-target-type')}
          />
        </Form.Item>
        <Form.Item name="targetOrganizationRef" label="任职机构" rules={[{required: true, message: '请选择任职机构'}]}>
          <Select
            showSearch={{filterOption: false, onSearch: setOrganizationQuery}}
            onPopupScroll={event => organizationState.onPopupScroll(event, organizationQueryResult.isFetching)}
            disabled={!targetType}
            options={organizations}
            loading={organizationQueryResult.isFetching && organizations.length === 0}
            placeholder={targetType ? '搜索机构名称或编码' : '请先选择任职机构类型'}
            {...testId('platform-invitation-target')}
          />
        </Form.Item>
        <Form.Item name="roleIds" label="业务角色" rules={[{required: true, message: '请选择业务角色'}]}>
          <Select
            mode="multiple"
            showSearch={{filterOption: false, onSearch: setRoleQuery}}
            onPopupScroll={event => roleState.onPopupScroll(event, roleQueryResult.isFetching)}
            disabled={!selectedOrganizationRef}
            options={roles}
            loading={roleQueryResult.isFetching && roles.length === 0}
            placeholder={selectedOrganizationRef ? '请选择业务角色' : '请先选择任职机构'}
            {...testId('platform-invitation-roles')}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
