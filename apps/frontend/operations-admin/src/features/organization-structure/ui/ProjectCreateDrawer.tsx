import {Alert, Button, Drawer, Form, Input, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {operationsClient} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS, type OrganizationNode} from '../../../app/api/generated/operations-edge';
import type {OperationsPageProps} from '../../../app/routing/model';
import {ProjectPhaseFieldList} from './ProjectPhaseFieldList';
import {issue, organizationProjectCreateLabel, projectPhasePayload, type HierarchyRow} from './organizationStructureShared';

type FormValues = {code: string; name: string; notes?: string; phaseDrafts?: Array<{name?: string}>};

function phasesAreValid(values?: Array<{name?: string}>) {
  const names = (values ?? []).map((value) => value.name?.trim() ?? '');
  return names.every(Boolean) && new Set(names).size === names.length;
}

export function ProjectCreateDrawer({open, region, queryContext, onClose, onCreated}: {
  open: boolean;
  region?: HierarchyRow;
  queryContext: OperationsPageProps['queryContext'];
  onClose: () => void;
  onCreated: (node: OrganizationNode) => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const [problem, setProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({open, onOpenChange: (next) => { if (!next) onClose(); }, dirtyMessage: '已修改的新建项目资料不会保存。', idempotencyKey: true, diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.createOperationsOrganizationProject});
  useOverlayLock(open);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setProblem(undefined);
    lifecycle.reset();
  }, [form, lifecycle, open]);

  const submit = async (values: FormValues) => {
    if (!region || lifecycle.submitting) return;
    if (!phasesAreValid(values.phaseDrafts)) {
      form.setFields([{name: 'phaseDrafts', errors: ['项目分期名称不能为空或重复']}]);
      return;
    }
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const created = await operationsClient.createOperationsOrganizationProject(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, regionId: region.id},
        {body: {code: values.code.trim(), name: values.name.trim(), notes: values.notes?.trim() || null, phases: projectPhasePayload(values.phaseDrafts)}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
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

  return <Drawer title={organizationProjectCreateLabel} open={open} width={620} destroyOnHidden maskClosable={false} keyboard={!lifecycle.submitting} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} {...adminDrawerSurfaceProps} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>取消</Button><Button type="primary" loading={lifecycle.submitting} onClick={() => form.submit()} {...testId('operations-project-create-submit')}>创建</Button></Space>}>
    {problem && <Alert type="error" showIcon message="新建项目失败" description={problem} style={{marginBottom: 16}}/>}
    <Form form={form} layout="vertical" disabled={lifecycle.submitting} onFinish={(values) => void submit(values)} onValuesChange={() => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }}>
      <Form.Item label="所属大区"><Input readOnly value={region ? `${region.name}（${region.code}）` : ''}/></Form.Item>
      <Form.Item name="name" label="项目名称" rules={[{required: true, whitespace: true, message: '请输入项目名称'}]}><Input maxLength={120}/></Form.Item>
      <Form.Item name="code" label="编码" rules={[{required: true, whitespace: true, message: '请输入编码'}]}><Input maxLength={64}/></Form.Item>
      <ProjectPhaseFieldList/>
      <Form.Item name="notes" label="备注"><Input.TextArea rows={3} maxLength={2000}/></Form.Item>
    </Form>
  </Drawer>;
}
