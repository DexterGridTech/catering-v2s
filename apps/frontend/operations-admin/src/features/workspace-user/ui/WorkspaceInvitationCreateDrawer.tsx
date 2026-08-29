import {Alert, Button, Drawer, Form, Input, Select, Space} from 'antd';
import {
  MOBILE_PATTERN,
  adminDrawerSurfaceProps,
  NameCodePathText,
  testId,
  useCursorCandidates,
  useDrawerFormLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import type {WorkspaceInvitation, WorkspaceInvitationCandidatePage} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageProps} from '../../../app/routing/model';
import {useWorkspaceInvitationCandidates} from '../application/useWorkspaceInvitationCandidates';

type TargetType = 'GROUP' | 'REGION' | 'PROJECT' | 'HEAD_COMPANY' | 'STORE';
type InvitationForm = {mobile: string; targetOrganizationRef?: string; roleIds?: string[]};
type CandidateOption = {value: string; label: ReactNode};

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
  return problem?.detail ?? fallback;
}

export function WorkspaceInvitationCreateDrawer({open, targetType, queryContext, onClose, onCreated}: Props) {
  const [form] = Form.useForm<InvitationForm>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: next => {
      if (!next) onClose();
    },
    dirtyMessage: '填写中的邀请资料不会保存。',
    idempotencyKey: true,
  });
  const [organizationQueryText, setOrganizationQueryText] = useState('');
  const [roleQueryText, setRoleQueryText] = useState('');
  const [submitProblem, setSubmitProblem] = useState<string>();
  const selectedOrganizationRef = Form.useWatch('targetOrganizationRef', form);
  const path = useMemo(() => ({groupWorkspaceKey: queryContext.groupWorkspaceKey}), [queryContext.groupWorkspaceKey]);
  const organizationCandidates = useCursorCandidates<CandidateOption>({
    queryText: organizationQueryText,
    resetKey: `${open}|${targetType}|${queryContext.groupWorkspaceKey}|${queryContext.expectedContextVersion}`,
    pageSize: candidatePageSize,
    keyOf: option => option.value,
  });
  const roleCandidates = useCursorCandidates<CandidateOption>({
    queryText: roleQueryText,
    resetKey: [
      open,
      targetType,
      queryContext.groupWorkspaceKey,
      queryContext.expectedContextVersion,
      selectedOrganizationRef ?? '',
    ].join('|'),
    pageSize: candidatePageSize,
    keyOf: option => option.value,
  });
  const {
    acceptPage: acceptOrganizationCandidatePage,
    debouncedQueryText: organizationCandidateQueryText,
    items: organizationCandidateItems,
    onPopupScroll: onOrganizationCandidatePopupScroll,
    page: organizationCandidatePage,
  } = organizationCandidates;
  const {
    acceptPage: acceptRoleCandidatePage,
    debouncedQueryText: roleCandidateQueryText,
    items: roleCandidateItems,
    onPopupScroll: onRoleCandidatePopupScroll,
    page: roleCandidatePage,
  } = roleCandidates;
  const organizationResult = useWorkspaceInvitationCandidates({
    targetType,
    queryContext,
    subjectType: 'ORGANIZATION',
    candidateUsage: 'INVITATION_TARGET',
    queryText: organizationCandidateQueryText,
    page: organizationCandidatePage,
    pageSize: candidatePageSize,
    enabled: open,
  });
  const roleResult = useWorkspaceInvitationCandidates({
    targetType,
    queryContext,
    subjectType: 'ROLE',
    candidateUsage: 'INVITATION_TARGET',
    queryText: roleCandidateQueryText,
    page: roleCandidatePage,
    pageSize: candidatePageSize,
    selectedOrganizationRef,
    enabled: open && Boolean(selectedOrganizationRef),
  });
  const organizationPageResult = organizationResult.currentData as WorkspaceInvitationCandidatePage | undefined;
  const rolePageResult = roleResult.currentData as WorkspaceInvitationCandidatePage | undefined;
  const organizationProblem = organizationResult.error
    ? queryIssue(organizationResult.error, '机构候选读取失败，请重试')
    : undefined;
  const roleProblem =
    selectedOrganizationRef && roleResult.error ? queryIssue(roleResult.error, '角色候选读取失败，请重试') : undefined;
  useEffect(() => {
    if (open) return;
    form.resetFields();
    lifecycle.reset();
    setOrganizationQueryText('');
    setRoleQueryText('');
    setSubmitProblem(undefined);
  }, [form, lifecycle, open]);

  useEffect(() => {
    if (!open || !organizationPageResult) return;
    const nextOptions = organizationPageResult.organizations
      .filter(candidate => candidate.serviceNodeType === targetType)
      .map(candidate => ({
        value: candidate.organizationRef,
        label: <NameCodePathText nodes={candidate.pathNodes} />,
      }));
    acceptOrganizationCandidatePage(nextOptions, organizationPageResult.metadata);
  }, [acceptOrganizationCandidatePage, open, organizationPageResult, targetType]);

  useEffect(() => {
    if (!open || !selectedOrganizationRef || !rolePageResult) return;
    const nextOptions = (rolePageResult?.roles ?? []).map(role => ({value: role.id, label: role.name}));
    acceptRoleCandidatePage(nextOptions, rolePageResult.metadata);
  }, [acceptRoleCandidatePage, open, rolePageResult, selectedOrganizationRef]);

  const create = async (values: InvitationForm) => {
    if (!values.targetOrganizationRef || !values.roleIds || values.roleIds.length === 0 || lifecycle.submitting) return;
    setSubmitProblem(undefined);
    lifecycle.setSubmitting(true);
    const idempotencyKey = lifecycle.getIdempotencyKey();
    const options = {
      body: {
        mobile: values.mobile.trim(),
        scopeRef: wireUuid(values.targetOrganizationRef),
        roleIds: values.roleIds.map(roleId => wireUuid(roleId)),
        expectedContextVersion: queryContext.expectedContextVersion,
        idempotencyKey,
      },
      headers: {'Idempotency-Key': idempotencyKey},
    };
    try {
      const created =
        targetType === 'GROUP'
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
      lifecycle.closeAfterSuccess();
    } catch (error) {
      setSubmitProblem(operationsProblemOf(error).detail || issue());
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  const combinedProblem = organizationProblem ?? roleProblem;

  return (
    <Drawer
      title="发出邀请"
      open={open}
      size={600}
      destroyOnHidden
      maskClosable={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      {...adminDrawerSurfaceProps}
      {...testId('operations-workspace-invitation-create-drawer')}
      footer={
        <Space>
          <Button
            onClick={lifecycle.requestClose}
            disabled={lifecycle.submitting}
            {...testId('operations-workspace-invitation-create-cancel')}
          >
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            onClick={() => form.submit()}
            {...testId('operations-workspace-invitation-create-submit')}
          >
            发出邀请
          </Button>
        </Space>
      }
    >
      {submitProblem && <Alert type="error" showIcon title={submitProblem} style={{marginBottom: 16}} />}
      {combinedProblem && (
        <Alert
          type="error"
          showIcon
          title={combinedProblem}
          action={
            <Button
              type="link"
              onClick={() => void (organizationProblem ? organizationResult.refetch() : roleResult.refetch())}
              {...testId(
                organizationProblem
                  ? 'operations-workspace-invitation-organization-retry'
                  : 'operations-workspace-invitation-role-retry',
              )}
            >
              重试
            </Button>
          }
          style={{marginBottom: 16}}
          {...testId('operations-workspace-invitation-candidate-problem')}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting}
        onFinish={values => void create(values)}
        onValuesChange={changedValues => {
          lifecycle.setDirty(true);
          lifecycle.markBusinessIntentChanged();
          if (submitProblem) setSubmitProblem(undefined);
          if ('targetOrganizationRef' in changedValues) {
            form.setFieldValue('roleIds', []);
            setRoleQueryText('');
          }
        }}
      >
        <Form.Item
          name="mobile"
          label="邀请手机号"
          rules={[
            {required: true, whitespace: true, message: '请输入邀请手机号'},
            {pattern: MOBILE_PATTERN, message: '请输入正确的手机号'},
          ]}
        >
          <Input maxLength={32} autoComplete="tel" {...testId('operations-workspace-invitation-mobile')} />
        </Form.Item>
        <Form.Item name="targetOrganizationRef" label="任职机构" rules={[{required: true, message: '请选择任职机构'}]}>
          <Select
            showSearch
            filterOption={false}
            onSearch={setOrganizationQueryText}
            placeholder="搜索机构名称或路径..."
            options={organizationCandidateItems}
            loading={organizationResult.isFetching && organizationCandidateItems.length === 0}
            notFoundContent={
              organizationResult.isFetching
                ? '加载中...'
                : organizationProblem
                  ? '机构候选读取失败，请重试'
                  : '当前范围内没有可邀请的机构'
            }
            onPopupScroll={event => onOrganizationCandidatePopupScroll(event, organizationResult.isFetching)}
            {...testId('operations-workspace-invitation-organization')}
          />
        </Form.Item>
        <Form.Item name="roleIds" label="业务角色" rules={[{required: true, message: '请选择业务角色'}]}>
          <Select
            mode="multiple"
            showSearch
            filterOption={false}
            onSearch={setRoleQueryText}
            disabled={!selectedOrganizationRef}
            placeholder={selectedOrganizationRef ? '请选择业务角色' : '请先选择任职机构'}
            options={roleCandidateItems}
            loading={roleResult.isFetching && roleCandidateItems.length === 0}
            notFoundContent={
              !selectedOrganizationRef
                ? '请先选择任职机构'
                : roleResult.isFetching
                  ? '加载中...'
                  : roleProblem
                    ? '角色候选读取失败，请重试'
                    : '当前范围内没有可选业务角色'
            }
            onPopupScroll={event => onRoleCandidatePopupScroll(event, roleResult.isFetching)}
            {...testId('operations-workspace-invitation-roles')}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
