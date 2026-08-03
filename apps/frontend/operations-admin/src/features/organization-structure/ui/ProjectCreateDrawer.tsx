import {Alert, Button, Drawer, Form, Input, Space, Typography} from 'antd';
import {adminDrawerSurfaceProps, formatNameCode, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {operationsClient} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS, type OrganizationNode} from '../../../app/api/generated/operations-edge';
import type {OperationsPageProps} from '../../../app/routing/model';
import {ProjectPhaseFieldList} from './ProjectPhaseFieldList';
import {issue, organizationProjectCreateLabel, projectPhasePayload, type HierarchyRow} from './organizationStructureShared';
import {OrganizationExtensionFields, serializeOrganizationExtensionValues, type OrganizationExtensionFormValues, useOrganizationExtensionDefinition} from './OrganizationExtensionFields';

type FormValues = {code: string; name: string; notes?: string; phaseDrafts?: Array<{name?: string}>; extensionValues?: OrganizationExtensionFormValues};

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
  const definition = useOrganizationExtensionDefinition({queryContext, entityType: 'PROJECT', enabled: open});

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldValue('extensionValues', {});
    setProblem(undefined);
    lifecycle.reset();
  }, [form, lifecycle, open]);

  const submit = async (values: FormValues) => {
    if (!region || lifecycle.submitting || !definition.data || definition.isFetching) return;
    if (!phasesAreValid(values.phaseDrafts)) {
      form.setFields([{name: 'phaseDrafts', errors: ['项目分期名称不能为空或重复']}]);
      return;
    }
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const created = await operationsClient.createOperationsOrganizationProject(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, regionId: region.id},
        {body: {code: values.code.trim(), name: values.name.trim(), notes: values.notes?.trim() || null, phases: projectPhasePayload(values.phaseDrafts), extensionValues: serializeOrganizationExtensionValues(definition.data, values.extensionValues)}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
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
  return <Drawer title={organizationProjectCreateLabel} open={open} size={620} destroyOnHidden keyboard={!lifecycle.submitting} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} {...adminDrawerSurfaceProps} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>取消</Button><Button type="primary" loading={lifecycle.submitting} disabled={!definitionReady} onClick={() => form.submit()} {...testId('operations-project-create-submit')}>创建</Button></Space>}>
    {displayProblem && <Alert type="error" showIcon title="新建项目未完成" description={displayProblem} style={{marginBottom: 16}}/>}
    <Form form={form} layout="vertical" disabled={lifecycle.submitting || !definitionReady} onFinish={(values) => void submit(values)} onValuesChange={() => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }}>
      <Form.Item label="所属大区"><Typography.Text>{region ? formatNameCode(region.name, region.code) : '—'}</Typography.Text></Form.Item>
      <Form.Item name="name" label="项目名称" rules={[{required: true, whitespace: true, message: '请输入项目名称'}]}><Input maxLength={120}/></Form.Item>
      <Form.Item name="code" label="编码" rules={[{required: true, whitespace: true, message: '请输入编码'}]}><Input maxLength={64}/></Form.Item>
      <ProjectPhaseFieldList/>
      <Form.Item name="notes" label="备注"><Input.TextArea rows={3} maxLength={2000}/></Form.Item>
      <OrganizationExtensionFields definition={definition.data} testIdPrefix="operations-project-create-extension"/>
    </Form>
  </Drawer>;
}
