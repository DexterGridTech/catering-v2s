import {Alert, Button, Drawer, Form, Input, Select, Space} from 'antd';
import {adminDrawerSurfaceProps, contextScopedQueryArgs, testId, useDrawerFormLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsClient, operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import type {WorkspaceInvitation, WorkspaceInvitationCandidatePage} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageProps} from '../../../app/routing/model';

type TargetType = 'GROUP' | 'REGION' | 'PROJECT' | 'HEAD_COMPANY' | 'STORE';
type InvitationForm = {mobile: string; targetOrganizationRef?: string; roleIds?: string[]};
type CandidateOption = {value: string; label: string};

type Props = {
  open: boolean;
  targetType: TargetType;
  queryContext: OperationsPageProps['queryContext'];
  onClose: () => void;
  onCreated: (invitation: WorkspaceInvitation) => void;
};

const candidatePageSize = 50;

function issue() {
  return '邀请暂未发出，请检查后重试';
}

function queryIssue(error: unknown, fallback: string) {
  const problem = operationsProblemOf(error);
  return problem ? `${problem.errorCode}：${problem.detail}` : fallback;
}

function appendUnique(current: CandidateOption[], incoming: CandidateOption[]) {
  const seen = new Set(current.map((option) => option.value));
  return [...current, ...incoming.filter((option) => !seen.has(option.value))];
}

export function WorkspaceInvitationCreateDrawer({open, targetType, queryContext, onClose, onCreated}: Props) {
  const [form] = Form.useForm<InvitationForm>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: (next) => { if (!next) onClose(); },
    dirtyMessage: '填写中的邀请资料不会保存。',
    idempotencyKey: true,
  });
  const [organizationQueryText, setOrganizationQueryText] = useState('');
  const [organizationPage, setOrganizationPage] = useState(1);
  const [organizationOptions, setOrganizationOptions] = useState<CandidateOption[]>([]);
  const [roleQueryText, setRoleQueryText] = useState('');
  const [rolePage, setRolePage] = useState(1);
  const [roleOptions, setRoleOptions] = useState<CandidateOption[]>([]);
  const [submitProblem, setSubmitProblem] = useState<string>();
  const selectedOrganizationRef = Form.useWatch('targetOrganizationRef', form);
  const path = useMemo(() => ({groupWorkspaceKey: queryContext.groupWorkspaceKey}), [queryContext.groupWorkspaceKey]);
  const organizationCandidateOptions = useMemo(() => ({
    query: contextScopedQueryArgs({
      scopeRef: queryContext.scopeRef,
      subjectType: 'ORGANIZATION' as const,
      queryText: organizationQueryText || undefined,
      page: organizationPage,
      pageSize: candidatePageSize,
    }, {
      groupWorkspaceKey: queryContext.groupWorkspaceKey,
      expectedContextVersion: queryContext.expectedContextVersion,
    }),
  }), [organizationPage, organizationQueryText, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, queryContext.scopeRef]);
  const roleCandidateOptions = useMemo(() => ({
    query: contextScopedQueryArgs({
      scopeRef: queryContext.scopeRef,
      subjectType: 'ROLE' as const,
      queryText: roleQueryText || undefined,
      page: rolePage,
      pageSize: candidatePageSize,
      selectedOrganizationRef: selectedOrganizationRef || undefined,
    }, {
      groupWorkspaceKey: queryContext.groupWorkspaceKey,
      expectedContextVersion: queryContext.expectedContextVersion,
    }),
  }), [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, queryContext.scopeRef, rolePage, roleQueryText, selectedOrganizationRef]);

  const groupOrganizationCandidates = operationsRtk.useGetOperationsWorkspaceGroupInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceGroupInvitationCandidates(path, organizationCandidateOptions), {skip: !open || targetType !== 'GROUP'});
  const regionOrganizationCandidates = operationsRtk.useGetOperationsWorkspaceRegionInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceRegionInvitationCandidates(path, organizationCandidateOptions), {skip: !open || targetType !== 'REGION'});
  const projectOrganizationCandidates = operationsRtk.useGetOperationsWorkspaceProjectInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceProjectInvitationCandidates(path, organizationCandidateOptions), {skip: !open || targetType !== 'PROJECT'});
  const headCompanyOrganizationCandidates = operationsRtk.useGetOperationsWorkspaceHeadCompanyInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceHeadCompanyInvitationCandidates(path, organizationCandidateOptions), {skip: !open || targetType !== 'HEAD_COMPANY'});
  const storeOrganizationCandidates = operationsRtk.useGetOperationsWorkspaceStoreInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceStoreInvitationCandidates(path, organizationCandidateOptions), {skip: !open || targetType !== 'STORE'});
  const groupRoleCandidates = operationsRtk.useGetOperationsWorkspaceGroupInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceGroupInvitationCandidates(path, roleCandidateOptions), {skip: !open || targetType !== 'GROUP' || !selectedOrganizationRef});
  const regionRoleCandidates = operationsRtk.useGetOperationsWorkspaceRegionInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceRegionInvitationCandidates(path, roleCandidateOptions), {skip: !open || targetType !== 'REGION' || !selectedOrganizationRef});
  const projectRoleCandidates = operationsRtk.useGetOperationsWorkspaceProjectInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceProjectInvitationCandidates(path, roleCandidateOptions), {skip: !open || targetType !== 'PROJECT' || !selectedOrganizationRef});
  const headCompanyRoleCandidates = operationsRtk.useGetOperationsWorkspaceHeadCompanyInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceHeadCompanyInvitationCandidates(path, roleCandidateOptions), {skip: !open || targetType !== 'HEAD_COMPANY' || !selectedOrganizationRef});
  const storeRoleCandidates = operationsRtk.useGetOperationsWorkspaceStoreInvitationCandidatesQuery(operationsAdminRtkRequest.getOperationsWorkspaceStoreInvitationCandidates(path, roleCandidateOptions), {skip: !open || targetType !== 'STORE' || !selectedOrganizationRef});
  const organizationResult = targetType === 'GROUP' ? groupOrganizationCandidates : targetType === 'REGION' ? regionOrganizationCandidates : targetType === 'PROJECT' ? projectOrganizationCandidates : targetType === 'HEAD_COMPANY' ? headCompanyOrganizationCandidates : storeOrganizationCandidates;
  const roleResult = targetType === 'GROUP' ? groupRoleCandidates : targetType === 'REGION' ? regionRoleCandidates : targetType === 'PROJECT' ? projectRoleCandidates : targetType === 'HEAD_COMPANY' ? headCompanyRoleCandidates : storeRoleCandidates;
  const organizationPageResult = organizationResult.data as WorkspaceInvitationCandidatePage | undefined;
  const rolePageResult = roleResult.data as WorkspaceInvitationCandidatePage | undefined;
  const organizationProblem = organizationResult.error ? queryIssue(organizationResult.error, '机构候选读取失败，请重试') : undefined;
  const roleProblem = selectedOrganizationRef && roleResult.error ? queryIssue(roleResult.error, '角色候选读取失败，请重试') : undefined;

  useEffect(() => {
    if (open) return;
    form.resetFields();
    lifecycle.reset();
    setOrganizationQueryText('');
    setOrganizationPage(1);
    setOrganizationOptions([]);
    setRoleQueryText('');
    setRolePage(1);
    setRoleOptions([]);
    setSubmitProblem(undefined);
  }, [form, lifecycle, open]);

  useEffect(() => {
    if (!open) return;
    const nextOptions = (organizationPageResult?.organizations ?? [])
      .filter((candidate) => candidate.serviceNodeType === targetType)
      .map((candidate) => ({value: candidate.organizationRef, label: candidate.path}));
    setOrganizationOptions((current) => organizationPage === 1 ? nextOptions : appendUnique(current, nextOptions));
  }, [open, organizationPage, organizationPageResult?.organizations, targetType]);

  useEffect(() => {
    if (!open || !selectedOrganizationRef) {
      setRoleOptions([]);
      return;
    }
    const nextOptions = (rolePageResult?.roles ?? []).map((role) => ({value: role.id, label: role.name}));
    setRoleOptions((current) => rolePage === 1 ? nextOptions : appendUnique(current, nextOptions));
  }, [open, rolePage, rolePageResult?.roles, selectedOrganizationRef]);

  const create = async (values: InvitationForm) => {
    if (!values.targetOrganizationRef || !values.roleIds || values.roleIds.length === 0 || lifecycle.submitting) return;
    setSubmitProblem(undefined);
    lifecycle.setSubmitting(true);
    const idempotencyKey = lifecycle.getIdempotencyKey();
    const options = {body: {
      mobile: values.mobile.trim(),
      scopeRef: values.targetOrganizationRef,
      roleIds: values.roleIds,
      expectedContextVersion: queryContext.expectedContextVersion,
      idempotencyKey,
    }, headers: {'Idempotency-Key': idempotencyKey}};
    try {
      const created = targetType === 'GROUP'
        ? await operationsClient.createOperationsWorkspaceGroupInvitation(path, options)
        : targetType === 'REGION'
          ? await operationsClient.createOperationsWorkspaceRegionInvitation(path, options)
          : targetType === 'PROJECT'
            ? await operationsClient.createOperationsWorkspaceProjectInvitation(path, options)
            : targetType === 'HEAD_COMPANY'
              ? await operationsClient.createOperationsWorkspaceHeadCompanyInvitation(path, options)
              : await operationsClient.createOperationsWorkspaceStoreInvitation(path, options);
      lifecycle.setDirty(false);
      onCreated(created);
    } catch (error) {
      void error;
      setSubmitProblem(issue());
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  const organizationTotal = organizationPageResult?.metadata?.total ?? 0;
  const roleTotal = rolePageResult?.metadata?.total ?? 0;
  const combinedProblem = organizationProblem ?? roleProblem;

  return <Drawer
    title="发出邀请"
    open={open}
    width={600}
    destroyOnHidden
    onClose={lifecycle.requestClose}
    afterOpenChange={lifecycle.afterOpenChange}
    {...adminDrawerSurfaceProps}
    {...testId('operations-workspace-invitation-create-drawer')}
    footer={<Space>
      <Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting} {...testId('operations-workspace-invitation-create-cancel')}>取消</Button>
      <Button type="primary" loading={lifecycle.submitting} onClick={() => form.submit()} {...testId('operations-workspace-invitation-create-submit')}>发出邀请</Button>
    </Space>}
  >
    {submitProblem && <Alert type="error" showIcon message={submitProblem} style={{marginBottom: 16}}/>}
    {combinedProblem && <Alert type="warning" showIcon message="候选读取受限" description={combinedProblem} style={{marginBottom: 16}}/>}
    <Form
      form={form}
      layout="vertical"
      disabled={lifecycle.submitting}
      onFinish={(values) => void create(values)}
      onValuesChange={(changedValues) => {
        lifecycle.setDirty(true);
        lifecycle.markBusinessIntentChanged();
        if (submitProblem) setSubmitProblem(undefined);
        if ('targetOrganizationRef' in changedValues) {
          form.setFieldValue('roleIds', []);
          setRoleQueryText('');
          setRolePage(1);
          setRoleOptions([]);
        }
      }}
    >
      <Form.Item name="mobile" label="邀请手机号" rules={[{required: true, whitespace: true, message: '请输入邀请手机号'}, {pattern: /^1\\d{10}$/, message: '请输入正确的手机号'}]}>
        <Input maxLength={32} autoComplete="tel" {...testId('operations-workspace-invitation-mobile')}/>
      </Form.Item>
      <Form.Item name="targetOrganizationRef" label="任职机构" rules={[{required: true, message: '请选择任职机构'}]}>
        <Select
          showSearch
          filterOption={false}
          placeholder="搜索机构名称或路径..."
          options={organizationOptions}
          loading={organizationResult.isFetching && organizationOptions.length === 0}
          notFoundContent={organizationResult.isFetching ? '加载中...' : organizationProblem ? '机构候选读取失败，请重试' : '当前范围内没有可邀请的机构'}
          onSearch={(value) => { setOrganizationQueryText(value); setOrganizationPage(1); }}
          onPopupScroll={(event) => {
            const target = event.target as HTMLElement;
            if (!organizationResult.isFetching && organizationOptions.length < organizationTotal && target.scrollTop + target.clientHeight >= target.scrollHeight - 24) {
              setOrganizationPage((current) => current + 1);
            }
          }}
          {...testId('operations-workspace-invitation-organization')}
        />
      </Form.Item>
      <Form.Item name="roleIds" label="业务角色" rules={[{required: true, message: '请选择业务角色'}]}>
        <Select
          mode="multiple"
          showSearch
          filterOption={false}
          disabled={!selectedOrganizationRef}
          placeholder={selectedOrganizationRef ? '请选择业务角色' : '请先选择任职机构'}
          options={roleOptions}
          loading={roleResult.isFetching && roleOptions.length === 0}
          notFoundContent={!selectedOrganizationRef ? '请先选择任职机构' : roleResult.isFetching ? '加载中...' : roleProblem ? '角色候选读取失败，请重试' : '当前范围内没有可选业务角色'}
          onSearch={(value) => { setRoleQueryText(value); setRolePage(1); }}
          onPopupScroll={(event) => {
            const target = event.target as HTMLElement;
            if (!roleResult.isFetching && roleOptions.length < roleTotal && target.scrollTop + target.clientHeight >= target.scrollHeight - 24) {
              setRolePage((current) => current + 1);
            }
          }}
          {...testId('operations-workspace-invitation-roles')}
        />
      </Form.Item>
    </Form>
  </Drawer>;
}
