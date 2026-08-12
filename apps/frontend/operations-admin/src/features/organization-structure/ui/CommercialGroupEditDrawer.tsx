import {Alert, Button, Drawer, Form, Input, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {operationsClient} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS, type CommercialGroupRoot} from '../../../app/api/generated/operations-edge';
import type {OperationsPageProps} from '../../../app/routing/model';
import {issue, organizationGroupEditLabel, type HierarchyRow} from './organizationStructureShared';
import {hydrateOrganizationExtensionValues, OrganizationExtensionFields, serializeOrganizationExtensionValues, type OrganizationExtensionFormValues, useOrganizationExtensionDefinition} from './OrganizationExtensionFields';

type FormValues = {code: string; name: string; extensionValues?: OrganizationExtensionFormValues};

export function CommercialGroupEditDrawer({group, queryContext, onClose, onUpdated}: {
  group?: HierarchyRow;
  queryContext: OperationsPageProps['queryContext'];
  onClose: () => void;
  onUpdated: (group: CommercialGroupRoot) => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const [problem, setProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({open: Boolean(group), onOpenChange: (next) => { if (!next) onClose(); }, dirtyMessage: '已修改的集团资料不会保存。', idempotencyKey: true, diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsCommercialGroup});
  useOverlayLock(Boolean(group));
  const definition = useOrganizationExtensionDefinition({queryContext, entityType: 'COMMERCIAL_GROUP', enabled: Boolean(group)});

  useEffect(() => {
    if (!group) return;
    form.setFieldsValue({code: group.code, name: group.name, extensionValues: hydrateOrganizationExtensionValues(definition.data, group.extensionValues)});
    setProblem(undefined);
    lifecycle.reset();
  }, [definition.data, form, group, lifecycle]);

  const submit = async (values: FormValues) => {
    if (!group || group.revision === undefined || lifecycle.submitting || !definition.data || definition.isFetching) return;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const updated = await operationsClient.updateOperationsCommercialGroup(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {body: {groupCode: values.code.trim(), groupName: values.name.trim(), extensionValues: serializeOrganizationExtensionValues(definition.data, values.extensionValues, group.extensionValues), expectedVersion: group.revision}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
      );
      lifecycle.setDirty(false);
      onUpdated(updated);
      lifecycle.closeAfterSuccess();
    } catch (error) {
      setProblem(issue(error));
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  const definitionReady = Boolean(definition.data) && !definition.isFetching;
  const displayProblem = problem ?? (definition.error ? '扩展字段加载失败，请关闭后重新进入。' : undefined);
  return <Drawer title={organizationGroupEditLabel} open={Boolean(group)} size={620} destroyOnHidden maskClosable={!lifecycle.submitting} closable={!lifecycle.submitting} keyboard={!lifecycle.submitting} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} {...adminDrawerSurfaceProps} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>取消</Button><Button type="primary" loading={lifecycle.submitting} disabled={!definitionReady} onClick={() => form.submit()} {...testId('operations-commercial-group-edit-submit')}>保存</Button></Space>}>
    {displayProblem && <Alert type="error" showIcon title="集团资料保存未完成" description={displayProblem} style={{marginBottom: 16}}/>}
    <Form form={form} layout="vertical" disabled={lifecycle.submitting || !definitionReady} onFinish={(values) => void submit(values)} onValuesChange={() => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }}>
      <Form.Item name="name" label="集团名称" rules={[{required: true, whitespace: true, message: '请输入集团名称'}]}><Input maxLength={120}/></Form.Item>
      <Form.Item name="code" label="编码" rules={[{required: true, whitespace: true, message: '请输入编码'}]}><Input maxLength={64}/></Form.Item>
      <OrganizationExtensionFields definition={definition.data} testIdPrefix="operations-commercial-group-edit-extension"/>
    </Form>
  </Drawer>;
}
