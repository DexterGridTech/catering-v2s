import {Alert, App, Button, Drawer, Form, Input, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {PLATFORM_ADMIN_OPERATION_IDS, type GroupWorkspaceDetail} from '../../../app/api/generated/platform-edge';
import {platformClient, type PlatformApiProblem} from '../../../app/api/PlatformTransport';

type Fields = {groupCode: string; groupName: string};

export function CommercialGroupInitializationDrawer({workspace, onClose, onInitialized}: {workspace?: GroupWorkspaceDetail; onClose: () => void; onInitialized: (workspace: GroupWorkspaceDetail) => void}) {
  const [form] = Form.useForm<Fields>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const {message} = App.useApp();
  const lifecycle = useDrawerFormLifecycle({open: Boolean(workspace), onOpenChange: (open) => { if (!open) onClose(); }, dirtyMessage: '已填写的商业集团资料不会保存。', idempotencyKey: true, diagnosticOperationId: PLATFORM_ADMIN_OPERATION_IDS.initializeCommercialGroup});
  useOverlayLock(Boolean(workspace));
  useEffect(() => { if (workspace) { form.resetFields(); setProblem(undefined); lifecycle.reset(); } }, [form, lifecycle, workspace]);
  const submit = async (value: Fields) => {
    if (!workspace || lifecycle.submitting) return;
    lifecycle.setSubmitting(true); setProblem(undefined);
    try {
      await platformClient.initializeCommercialGroup({groupWorkspaceKey: workspace.groupWorkspaceKey}, {body: {groupCode: value.groupCode.trim(), groupName: value.groupName.trim(), idempotencyKey: lifecycle.getIdempotencyKey()}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      const detail = await platformClient.getPlatformGroupWorkspaceDetail({groupWorkspaceKey: workspace.groupWorkspaceKey}, {});
      lifecycle.setDirty(false); message.success('初始化成功'); onInitialized(detail);
    } catch (error) { setProblem(error as PlatformApiProblem); } finally { lifecycle.setSubmitting(false); }
  };
  return <Drawer title="初始化商业集团" open={Boolean(workspace)} width={520} destroyOnHidden onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} maskClosable keyboard={!lifecycle.submitting} {...adminDrawerSurfaceProps} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting} {...testId('platform-workspace-initialize-cancel')}>取消</Button><Button type="primary" loading={lifecycle.submitting} onClick={() => form.submit()} {...testId('platform-workspace-initialize-submit')}>初始化</Button></Space>}>
    {problem && <Alert type="error" showIcon message={problem.title} description={problem.detail} style={{marginBottom: 16}}/>}
    <Form form={form} layout="vertical" onFinish={(value) => void submit(value)} onValuesChange={() => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }} disabled={lifecycle.submitting}>
      <Form.Item name="groupCode" label="集团编码" rules={[{required: true, whitespace: true}]}><Input maxLength={64} {...testId('platform-workspace-initialize-code')}/></Form.Item>
      <Form.Item name="groupName" label="集团名称" rules={[{required: true, whitespace: true}]}><Input maxLength={120} {...testId('platform-workspace-initialize-name')}/></Form.Item>
    </Form>
  </Drawer>;
}
