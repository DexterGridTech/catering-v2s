import {Alert, Button, Drawer, Form, Input, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {operationsClient} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS, type OrganizationNode} from '../../../app/api/generated/operations-edge';
import type {OperationsPageProps} from '../../../app/routing/model';
import {issue, organizationRegionCreateLabel, type HierarchyRow} from './organizationStructureShared';

type FormValues = {code: string; name: string; notes?: string};

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

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setProblem(undefined);
    lifecycle.reset();
  }, [form, lifecycle, open]);

  const submit = async (values: FormValues) => {
    if (!commercialGroup || lifecycle.submitting) return;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const created = await operationsClient.createOperationsOrganizationRegion(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {body: {code: values.code.trim(), name: values.name.trim(), notes: values.notes?.trim() || null}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
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

  return <Drawer title={organizationRegionCreateLabel} open={open} width={620} destroyOnHidden maskClosable={false} keyboard={!lifecycle.submitting} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} {...adminDrawerSurfaceProps} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>取消</Button><Button type="primary" loading={lifecycle.submitting} onClick={() => form.submit()} {...testId('operations-region-create-submit')}>创建</Button></Space>}>
    {problem && <Alert type="error" showIcon message="新建大区失败" description={problem} style={{marginBottom: 16}}/>}
    <Form form={form} layout="vertical" disabled={lifecycle.submitting} onFinish={(values) => void submit(values)} onValuesChange={() => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }}>
      <Form.Item label="所属集团"><Input readOnly value={commercialGroup ? `${commercialGroup.name}（${commercialGroup.code}）` : ''}/></Form.Item>
      <Form.Item name="name" label="大区名称" rules={[{required: true, whitespace: true, message: '请输入大区名称'}]}><Input maxLength={120}/></Form.Item>
      <Form.Item name="code" label="编码" rules={[{required: true, whitespace: true, message: '请输入编码'}]}><Input maxLength={64}/></Form.Item>
      <Form.Item name="notes" label="备注"><Input.TextArea rows={3} maxLength={2000}/></Form.Item>
    </Form>
  </Drawer>;
}
