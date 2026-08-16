import {Alert, Button, Drawer, Form, Input, Space, Typography} from 'antd';
import {
  adminDrawerSurfaceProps,
  testId,
  useDrawerFormLifecycle,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {operationsClient} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';
import type {OperationsPageProps} from '../../../app/routing/model';
import {ProjectPhaseFieldList} from './ProjectPhaseFieldList';
import {
  issue,
  organizationProjectEditLabel,
  organizationRegionEditLabel,
  projectPhaseDrafts,
  projectPhasePayload,
  type HierarchyRow,
} from './organizationStructureShared';
import {
  extensionValuesForGeneratedRequest,
  hydrateOrganizationExtensionValues,
  OrganizationExtensionFields,
  serializeOrganizationExtensionValues,
  type OrganizationExtensionFormValues,
  useOrganizationExtensionDefinition,
} from './OrganizationExtensionFields';

type FormValues = {
  code: string;
  name: string;
  notes?: string;
  phaseDrafts?: Array<{name?: string}>;
  extensionValues?: OrganizationExtensionFormValues;
};

export function OrganizationEditDrawer({
  node,
  parentName,
  queryContext,
  onClose,
  onUpdated,
}: {
  node?: HierarchyRow;
  parentName?: string;
  queryContext: OperationsPageProps['queryContext'];
  onClose: () => void;
  onUpdated: (node: HierarchyRow) => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const [problem, setProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({
    open: Boolean(node),
    onOpenChange: next => {
      if (!next) onClose();
    },
    dirtyMessage: '已修改的组织资料不会保存。',
    idempotencyKey: true,
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsOrganizationNode,
  });
  useOverlayLock(Boolean(node));
  const definition = useOrganizationExtensionDefinition({
    queryContext,
    entityType: node?.nodeType === 'PROJECT' ? 'PROJECT' : 'REGION',
    enabled: Boolean(node),
  });

  useEffect(() => {
    if (!node) return;
    form.setFieldsValue({
      code: node.code,
      name: node.name,
      notes: node.notes ?? undefined,
      phaseDrafts: projectPhaseDrafts(node.phases),
      extensionValues: hydrateOrganizationExtensionValues(definition.data, node.extensionValues),
    });
    setProblem(undefined);
    lifecycle.reset();
  }, [definition.data, form, lifecycle, node]);

  const submit = async (values: FormValues) => {
    if (!node || lifecycle.submitting || node.revision === undefined || !definition.data || definition.isFetching)
      return;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const updated = await operationsClient.updateOperationsOrganizationNode(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, nodeId: node.id},
        {
          body: {
            code: values.code.trim(),
            name: values.name.trim(),
            parentId: node.parentId,
            phases: node.nodeType === 'PROJECT' ? projectPhasePayload(values.phaseDrafts) : [],
            notes: values.notes?.trim() || null,
            extensionValues: extensionValuesForGeneratedRequest(
              serializeOrganizationExtensionValues(definition.data, values.extensionValues, node.extensionValues),
            ),
            expectedVersion: node.revision,
          },
          headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
        },
      );
      lifecycle.setDirty(false);
      onUpdated({
        id: updated.id,
        nodeType: updated.nodeType,
        parentId: updated.parentId,
        code: updated.code,
        name: updated.name,
        notes: updated.notes,
        extensionValues: updated.extensionValues,
        status: updated.status,
        phases: updated.phases.map(phase => phase.name),
        revision: updated.revision,
      });
      lifecycle.closeAfterSuccess();
    } catch (error) {
      setProblem(issue(error));
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  const title = node?.nodeType === 'REGION' ? organizationRegionEditLabel : organizationProjectEditLabel;
  const definitionReady = Boolean(definition.data) && !definition.isFetching;
  const displayProblem = problem ?? (definition.error ? '扩展字段加载失败，请关闭后重新进入。' : undefined);
  return (
    <Drawer
      title={title}
      open={Boolean(node)}
      size={620}
      destroyOnHidden
      maskClosable={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      {...adminDrawerSurfaceProps}
      footer={
        <Space>
          <Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            disabled={!definitionReady}
            onClick={() => form.submit()}
            {...testId('operations-organization-edit-submit')}
          >
            保存
          </Button>
        </Space>
      }
    >
      {displayProblem && (
        <Alert
          type="error"
          showIcon
          title="组织资料保存未完成"
          description={displayProblem}
          style={{marginBottom: 16}}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting || !definitionReady}
        onFinish={values => void submit(values)}
        onValuesChange={() => {
          lifecycle.setDirty(true);
          lifecycle.markBusinessIntentChanged();
        }}
      >
        <Form.Item label={node?.nodeType === 'PROJECT' ? '所属大区' : '所属集团'}>
          <Typography.Text>{parentName ?? '—'}</Typography.Text>
        </Form.Item>
        <Form.Item name="name" label="名称" rules={[{required: true, whitespace: true, message: '请输入名称'}]}>
          <Input maxLength={120} />
        </Form.Item>
        <Form.Item name="code" label="编码" rules={[{required: true, whitespace: true, message: '请输入编码'}]}>
          <Input maxLength={64} />
        </Form.Item>
        {node?.nodeType === 'PROJECT' && <ProjectPhaseFieldList />}
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={3} maxLength={2000} />
        </Form.Item>
        <OrganizationExtensionFields
          definition={definition.data}
          testIdPrefix="operations-organization-edit-extension"
        />
      </Form>
    </Drawer>
  );
}
