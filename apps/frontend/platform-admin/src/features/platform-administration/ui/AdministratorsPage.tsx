import {ProTable} from '@ant-design/pro-components';
import {Alert, Button, Card, Form, Input, Select, Space, Tag, Typography} from 'antd';
import {testId, useDetailDrawer, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useRef, useState} from 'react';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {platformProblemOf, platformRtk, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {adminCatalog, platformPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import type {PlatformAdminDetail, PlatformAdminPage} from '../../../app/api/generated/platform-edge';
import {AdministratorCreateDrawer} from './AdministratorCreateDrawer';
import {AdministratorCredentialDrawer} from './AdministratorCredentialDrawer';
import {AdministratorDetailDrawer} from './AdministratorDetailDrawer';
import {AdministratorEditDrawer} from './AdministratorEditDrawer';
import {AdministratorStatusModal} from './AdministratorStatusModal';
import {PlatformAuditHistoryModal, type PlatformAuditTarget} from '../../audit-history';

type Admin = PlatformAdminPage['items'][number];
type AdminFilters = {userName?: string; loginName?: string; status?: 'ACTIVE' | 'DISABLED'};
const administratorPage = adminCatalog.platformPages.find((page) => page.pageDesignKey === platformPageDesignKeys.PlatformAdminUsers);
if (!administratorPage) throw new Error('Missing generated administrator page');
const administratorPageTitle = administratorPage.title;

/** IA03 platform-admin governance: list -> owner detail -> one independent action surface. */
export function AdministratorsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<AdminFilters>({});
  const [filterForm] = Form.useForm<AdminFilters>();
  const [commandProblem, setProblem] = useState<PlatformApiProblem>();
  const detail = useDetailDrawer<PlatformAdminDetail>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformAdminDetail>();
  const [credentialTarget, setCredentialTarget] = useState<PlatformAdminDetail>();
  const [statusTarget, setStatusTarget] = useState<PlatformAdminDetail>();
  const [auditTarget, setAuditTarget] = useState<PlatformAuditTarget>();
  const [pendingAction, setPendingAction] = useState<{kind: 'edit' | 'credential' | 'status'; admin: PlatformAdminDetail}>();
  const pendingActionRef = useRef<typeof pendingAction>(undefined);
  pendingActionRef.current = pendingAction;
  useOverlayLock(detail.isOpen || createOpen || Boolean(editing) || Boolean(credentialTarget) || Boolean(statusTarget) || Boolean(auditTarget));
  const listRequest = useMemo(() => platformAdminRtkRequest.getPlatformAdminPage({}, {query: {...filters, page, pageSize}}), [filters, page, pageSize]);
  const {data: result, error, isLoading} = platformRtk.useGetPlatformAdminPageQuery(listRequest);
  const [loadDetail] = platformRtk.useLazyGetPlatformAdminDetailQuery();
  const problem = error ? platformProblemOf(error) : commandProblem;

  const openDetail = async (row: Admin) => {
    try { setProblem(undefined); detail.open(await loadDetail(platformAdminRtkRequest.getPlatformAdminDetail({platformAdminId: row.id}, {})).unwrap()); }
    catch (next) { setProblem(next as PlatformApiProblem); }
  };
  const returnToDetail = (admin: PlatformAdminDetail) => {
    setEditing(undefined); setCredentialTarget(undefined); setStatusTarget(undefined); detail.open(admin);
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

  return <Card title={administratorPageTitle} extra={<Button type="primary" onClick={() => setCreateOpen(true)} {...testId('platform-admin-create')}>新建管理员</Button>}>
    <Typography.Paragraph>通过管理员详情核对资料后，再进入独立的编辑、凭据或状态确认面；密码不会在后续读取中显示。</Typography.Paragraph>
    {problem && <Alert type="error" showIcon message={problem.title} description={problem.detail} style={{marginBottom: 16}}/>}
    <Form form={filterForm} layout="inline" onFinish={(value) => { setPage(1); setFilters({userName: value.userName?.trim() || undefined, loginName: value.loginName?.trim() || undefined, status: value.status}); }} style={{marginBottom: 16}}>
      <Form.Item name="userName" label="姓名"><Input allowClear {...testId('platform-admin-filter-user-name')}/></Form.Item>
      <Form.Item name="loginName" label="登录账号"><Input allowClear {...testId('platform-admin-filter-login-name')}/></Form.Item>
      <Form.Item name="status" label="状态"><Select allowClear style={{width: 120}} options={[{value: 'ACTIVE', label: '已启用'}, {value: 'DISABLED', label: '已停用'}]} {...testId('platform-admin-filter-status')}/></Form.Item>
      <Space><Button htmlType="submit" type="primary" {...testId('platform-admin-filter-submit')}>查询</Button><Button onClick={() => { filterForm.resetFields(); setPage(1); setFilters({}); }} {...testId('platform-admin-filter-reset')}>重置</Button></Space>
    </Form>
    <div {...testId('platform-admin-table')}><ProTable<Admin>
      rowKey="id" loading={isLoading && !result && !problem} dataSource={result?.items} search={false} options={false}
      pagination={result ? {current: result.page, pageSize: result.pageSize, total: result.total, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); }} : false}
      columns={[
        {title: '姓名', dataIndex: 'userName', render: (_, row) => <Button type="link" onClick={() => void openDetail(row)} {...testId(`platform-admin-detail-${row.id}`)}>{row.userName}</Button>},
        {title: '账号类型', dataIndex: 'builtIn', render: (_, row) => row.builtIn ? '内置管理员' : '平台管理员'},
        {title: '登录账号', dataIndex: 'loginName'},
        {title: '状态', dataIndex: 'status', render: (_, row) => <Tag color={row.status === 'ACTIVE' ? 'success' : 'default'}>{row.status === 'ACTIVE' ? '已启用' : '已停用'}</Tag>},
        {title: '最近登录', dataIndex: 'lastLoginAt', valueType: 'dateTime'},
        {title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime'},
      ]}
    /></div>
    <AdministratorDetailDrawer admin={detail.target} onClose={detail.close} onAfterOpenChange={openPendingActionAfterDetailClosed} onEdit={() => openAction('edit')} onCredential={() => openAction('credential')} onStatus={() => openAction('status')} onAudit={() => detail.target && setAuditTarget({entityType: 'PLATFORM_ADMIN', entityId: detail.target.id, displayName: detail.target.userName})}/>
    <AdministratorCreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(admin) => { setCreateOpen(false); detail.open(admin); }}/>
    <AdministratorEditDrawer admin={editing} onClose={() => setEditing(undefined)} onUpdated={returnToDetail}/>
    <AdministratorCredentialDrawer admin={credentialTarget} onClose={() => setCredentialTarget(undefined)} onUpdated={returnToDetail}/>
    <AdministratorStatusModal admin={statusTarget} onClose={() => setStatusTarget(undefined)} onUpdated={returnToDetail} onProblem={setProblem}/>
    <PlatformAuditHistoryModal open={Boolean(auditTarget)} target={auditTarget} onClose={() => setAuditTarget(undefined)}/>
  </Card>;
}
