import {Alert, Button, Drawer, Form, Input, Select, Space} from 'antd';
import {adminDrawerSurfaceProps, NameCodeText, testId, useDrawerFormLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {
  PLATFORM_ADMIN_OPERATION_IDS,
  type OwnerBindingCreateRequest,
  type OwnerBindingView,
  type OrganizationCandidateQuerySubjectType,
  type ProviderProfileView,
} from '../../../app/api/generated/platform-edge';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {usePlatformOrganizationCandidates} from '../../../app/queries/usePlatformOrganizationCandidates';

type Values = {
  nodeType?: OwnerBindingCreateRequest['nodeType'];
  nodeRef?: OwnerBindingCreateRequest['nodeRef'];
  bindingDisplayName?: string;
  externalOwnerId?: string;
};
const nodeLabels: Record<string, string> = {
  COMMERCIAL_GROUP: '集团',
  REGION: '大区',
  PROJECT: '项目',
  HEAD_COMPANY: '总公司',
  STORE: '门店',
};
type CandidateSubjectType = Extract<
  OrganizationCandidateQuerySubjectType,
  'COMMERCIAL_GROUP' | 'REGION' | 'PROJECT' | 'HEAD_COMPANY' | 'STORE'
>;
const isCandidateSubjectType = (value: string | undefined): value is CandidateSubjectType =>
  value === 'COMMERCIAL_GROUP' ||
  value === 'REGION' ||
  value === 'PROJECT' ||
  value === 'HEAD_COMPANY' ||
  value === 'STORE';
const canEdit = (authenticationKind: ProviderProfileView['authenticationKind']) =>
  authenticationKind === 'INTERNAL_MAPPING' || authenticationKind === 'NO_MAPPING';

export function OwnerBindingFormDrawer({
  open,
  groupWorkspaceKey,
  profile,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  groupWorkspaceKey: string;
  profile: ProviderProfileView;
  editing?: OwnerBindingView;
  onClose: () => void;
  onSaved: (binding: OwnerBindingView) => void;
}) {
  const [form] = Form.useForm<Values>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: value => {
      if (!value) onClose();
    },
    dirtyMessage: '已填写的绑定资料不会保存。',
    idempotencyKey: true,
    diagnosticOperationId: editing
      ? PLATFORM_ADMIN_OPERATION_IDS.updatePlatformOwnerBinding
      : PLATFORM_ADMIN_OPERATION_IDS.createPlatformOwnerBinding,
  });
  const submissionMode = editing ? 'edit' : 'create';
  const nodeType = Form.useWatch('nodeType', form);
  const candidateSubjectType = isCandidateSubjectType(nodeType) ? nodeType : undefined;
  const candidate = usePlatformOrganizationCandidates({
    open: open && !editing && Boolean(candidateSubjectType),
    groupWorkspaceKey,
    subjectType: candidateSubjectType ?? 'PROJECT',
    queryText: undefined,
  });
  const nodeOptions = useMemo(
    () => candidate.items.map(item => ({value: item.id, label: <NameCodeText name={item.name} code={item.code} />})),
    [candidate.items],
  );
  const bindableNodeTypes = Array.isArray(profile.bindableNodeTypes) ? profile.bindableNodeTypes : [];

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setProblem(undefined);
    lifecycle.reset();
    if (editing) {
      form.setFieldsValue({
        nodeType: editing.nodeType,
        nodeRef: editing.nodeRef,
        bindingDisplayName: editing.bindingDisplayName ?? undefined,
        externalOwnerId: editing.externalOwnerId ?? undefined,
      });
    }
  }, [editing, form, lifecycle, open]);

  const save = async (values: Values) => {
    if (lifecycle.submitting) return;
    if (editing && !canEdit(profile.authenticationKind)) return;
    if (!editing && (!values.nodeType || !values.nodeRef)) return;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const saved = editing
        ? await platformClient.updatePlatformOwnerBinding(
            {groupWorkspaceKey, bindingRef: editing.bindingRef},
            {
              body: {
                bindingDisplayName: values.bindingDisplayName?.trim() || null,
                externalOwnerId:
                  profile.authenticationKind === 'INTERNAL_MAPPING' ? values.externalOwnerId?.trim() || null : null,
                expectedVersion: editing.version,
              },
              headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
            },
          )
        : await platformClient.createPlatformOwnerBinding(
            {groupWorkspaceKey},
            {
              body: {
                providerCode: profile.providerCode,
                nodeType: values.nodeType!,
                nodeRef: values.nodeRef!,
                bindingDisplayName: values.bindingDisplayName?.trim() || null,
                externalOwnerId:
                  profile.authenticationKind === 'INTERNAL_MAPPING' ? values.externalOwnerId?.trim() || null : null,
              },
              headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
            },
          );
      lifecycle.setDirty(false);
      lifecycle.closeAfterSuccess();
      onSaved(saved);
    } catch (error) {
      setProblem(platformProblemOf(error));
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      title={submissionMode === 'edit' ? '编辑绑定' : '新建绑定'}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      destroyOnHidden
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      {...adminDrawerSurfaceProps}
      footer={
        <Space>
          <Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            onClick={() => form.submit()}
            {...testId('platform-owner-binding-submit')}
          >
            保存
          </Button>
        </Space>
      }
      {...testId('platform-owner-binding-form-drawer')}
    >
      {problem && (
        <Alert
          type="error"
          showIcon
          title="绑定保存失败"
          description={problem.detail}
          style={{marginBottom: 16}}
          {...testId('platform-owner-binding-form-error')}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={values => void save(values)}
        onValuesChange={() => {
          lifecycle.setDirty(true);
          lifecycle.markBusinessIntentChanged();
        }}
        disabled={lifecycle.submitting}
      >
        <Form.Item label="绑定名称" name="bindingDisplayName">
          <Input {...testId('platform-owner-binding-name')} />
        </Form.Item>
        {editing ? (
          <>
            <Form.Item label="绑定节点类型">
              <Input value={nodeLabels[editing.nodeType] ?? '业务节点'} disabled />
            </Form.Item>
            <Form.Item label="绑定节点">
              <Input value={editing.nodeDisplayPath || '业务节点名称暂不可用'} disabled />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item label="绑定节点类型" name="nodeType" rules={[{required: true, message: '请选择绑定节点类型'}]}>
              <Select
                options={bindableNodeTypes
                  .filter(value => isCandidateSubjectType(value))
                  .map(value => ({value, label: nodeLabels[value] ?? '业务节点'}))}
                onChange={() => form.setFieldValue('nodeRef', undefined)}
                {...testId('platform-owner-binding-node-type')}
              />
            </Form.Item>
            {bindableNodeTypes.some(value => !isCandidateSubjectType(value)) && (
              <Alert type="info" showIcon message="当前档案允许的节点类型将通过组织任务候选查询展示。" />
            )}
            <Form.Item label="绑定节点" name="nodeRef" rules={[{required: true, message: '请选择绑定节点'}]}>
              <Select
                showSearch
                loading={candidate.isFetching}
                options={nodeOptions}
                disabled={!nodeType}
                {...testId('platform-owner-binding-node')}
              />
            </Form.Item>
          </>
        )}
        {profile.authenticationKind === 'INTERNAL_MAPPING' && (
          <Form.Item label="外部主体编号" name="externalOwnerId">
            <Input {...testId('platform-owner-binding-external-owner')} />
          </Form.Item>
        )}
        {profile.authenticationKind === 'EXTERNAL_GRANT' && (
          <Alert type="info" showIcon message="需要外部授权的绑定，外部主体编号将在授权完成后回填。" />
        )}
        {profile.authenticationKind === 'NO_MAPPING' && (
          <Alert type="info" showIcon message="此接入档案无需外部主体映射。" />
        )}
      </Form>
    </Drawer>
  );
}
