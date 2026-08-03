import {Alert, Button, Drawer, Form, Input, Space, Typography} from 'antd';
import {adminDrawerSurfaceProps, formatNameCode, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {operationsClient} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS, type OrganizationNode} from '../../../app/api/generated/operations-edge';
import type {OperationsPageProps} from '../../../app/routing/model';
import {issue, organizationRegionCreateLabel, type HierarchyRow} from './organizationStructureShared';
import {OrganizationExtensionFields, serializeOrganizationExtensionValues, type OrganizationExtensionFormValues, useOrganizationExtensionDefinition} from './OrganizationExtensionFields';

type FormValues = {code: string; name: string; notes?: string; extensionValues?: OrganizationExtensionFormValues};

export function RegionCreateDrawer({open, commercialGroup, queryContext, onClose, onCreated}: {
  open: boolean;
  commercialGroup?: HierarchyRow;
  queryContext: OperationsPageProps['queryContext'];
  onClose: () => void;
  onCreated: (node: OrganizationNode) => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const [problem, setProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({open, onOpenChange: (next) => { if (!next) onClose(); }, dirtyMessage: '已修改的新建大区资料不会保存。', idempotencyKey: true, diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.createOperationsOrganizationRegion});
  useOverlayLock(open);
  const definition = useOrganizationExtensionDefinition({queryContext, entityType: 'REGION', enabled: open});

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldValue('extensionValues', {});
    setProblem(undefined);
    lifecycle.reset();
  }, [form, lifecycle, open]);

  const submit = async (values: FormValues) => {
    if (!commercialGroup || lifecycle.submitting || !definition.data || definition.isFetching) return;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const created = await operationsClient.createOperationsOrganizationRegion(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {body: {code: values.code.trim(), name: values.name.trim(), notes: values.notes?.trim() || null, extensionValues: serializeOrganizationExtensionValues(definition.data, values.extensionValues)}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
      );
      lifecycle.setDirty(false);
      onCreated(created);
      lifecycle.closeAfterSuccess();
    } catch (error) {
      setProblem(issue(error));
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  const definitionReady = Boolean(definition.data) && !definition.isFetching;
  const displayProblem = problem ?? (definition.error ? '扩展字段加载失败，请关闭后重新进入。' : undefined);
  return <Drawer title={organizationRegionCreateLabel} open={open} size={620} destroyOnHidden keyboard={!lifecycle.submitting} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} {...adminDrawerSurfaceProps} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>取消</Button><Button type="primary" loading={lifecycle.submitting} disabled={!definitionReady} onClick={() => form.submit()} {...testId('operations-region-create-submit')}>创建</Button></Space>}>
    {displayProblem && <Alert type="error" showIcon title="新建大区未完成" description={displayProblem} style={{marginBottom: 16}}/>}
    <Form form={form} layout="vertical" disabled={lifecycle.submitting || !definitionReady} onFinish={(values) => void submit(values)} onValuesChange={() => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }}>
      <Form.Item label="所属集团"><Typography.Text>{commercialGroup ? formatNameCode(commercialGroup.name, commercialGroup.code) : '—'}</Typography.Text></Form.Item>
      <Form.Item name="name" label="大区名称" rules={[{required: true, whitespace: true, message: '请输入大区名称'}]}><Input maxLength={120}/></Form.Item>
      <Form.Item name="code" label="编码" rules={[{required: true, whitespace: true, message: '请输入编码'}]}><Input maxLength={64}/></Form.Item>
      <Form.Item name="notes" label="备注"><Input.TextArea rows={3} maxLength={2000}/></Form.Item>
      <OrganizationExtensionFields definition={definition.data} testIdPrefix="operations-region-create-extension"/>
    </Form>
  </Drawer>;
}
