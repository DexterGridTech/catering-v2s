import {Alert, Button, Drawer, Form, Image, Input, Space, Typography, Upload} from 'antd';
import {adminDrawerSurfaceProps, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useRef, useState} from 'react';
import {PLATFORM_ADMIN_OPERATION_IDS, type GroupWorkspaceDetail, type PlatformAssetStagingResult} from '../../../app/api/generated/platform-edge';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';

type LogoIntent = 'KEEP' | 'REPLACE';
type Fields = {name: string; operationsTitle: string; notes?: string};

export function WorkspaceEditDrawer({workspace, onClose, onUpdated, onConflict}: {workspace?: GroupWorkspaceDetail; onClose: () => void; onUpdated: (workspace: GroupWorkspaceDetail) => void; onConflict: (groupWorkspaceKey: string) => void}) {
  const [form] = Form.useForm<Fields>();
  const [stagedLogo, setStagedLogo] = useState<PlatformAssetStagingResult>();
  const [stagedLogoPreview, setStagedLogoPreview] = useState<string>();
  const [logoIntent, setLogoIntent] = useState<LogoIntent>('KEEP');
  const stagedLogoPreviewRef = useRef<string | undefined>(undefined);
  const stagedLogoRef = useRef<PlatformAssetStagingResult | undefined>(undefined);
  const releasingRef = useRef(false);
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const clearStagedLogo = () => {
    stagedLogoRef.current = undefined;
    setStagedLogo(undefined);
    if (stagedLogoPreviewRef.current) URL.revokeObjectURL(stagedLogoPreviewRef.current);
    stagedLogoPreviewRef.current = undefined;
    setStagedLogoPreview(undefined);
  };
  const releaseStagedLogo = async () => {
    const staged = stagedLogoRef.current;
    if (!staged) return true;
    if (releasingRef.current) return false;
    releasingRef.current = true; lifecycle.setSubmitting(true); setProblem(undefined);
    try {
      await platformClient.releasePlatformStagedAsset({assetRef: staged.assetRef}, {headers: {'X-Asset-Bind-Grant': staged.bindGrant}});
      clearStagedLogo();
      return true;
    } catch (error) { setProblem(platformProblemOf(error)); return false; }
    finally { releasingRef.current = false; lifecycle.setSubmitting(false); }
  };
  const closeAfterRelease = async () => { if (await releaseStagedLogo()) onClose(); };
  const lifecycle = useDrawerFormLifecycle({open: Boolean(workspace), onOpenChange: (next) => { if (!next) void closeAfterRelease(); }, dirtyMessage: '已填写的集团空间资料不会保存。', idempotencyKey: true, diagnosticOperationId: PLATFORM_ADMIN_OPERATION_IDS.updatePlatformGroupWorkspaceDisplay});
  useOverlayLock(Boolean(workspace));
  useEffect(() => {
    if (!workspace) return;
    form.setFieldsValue({name: workspace.name, operationsTitle: workspace.operationsTitle, notes: workspace.notes ?? undefined});
    setLogoIntent('KEEP');
    clearStagedLogo(); setProblem(undefined); lifecycle.reset();
  }, [form, lifecycle, workspace]);
  useEffect(() => () => {
    if (stagedLogoPreviewRef.current) URL.revokeObjectURL(stagedLogoPreviewRef.current);
  }, []);
  const stageLogo = async (file: File) => {
    if (!(await releaseStagedLogo())) return Upload.LIST_IGNORE;
    lifecycle.setSubmitting(true); setProblem(undefined);
    try {
      const value = await platformClient.stagePlatformAsset({},{body: {usage: 'GROUP_WORKSPACE_LOGO', groupWorkspaceKey: workspace?.groupWorkspaceKey, file}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      const preview = URL.createObjectURL(file);
      setLogoIntent('REPLACE');
      stagedLogoRef.current = value; setStagedLogo(value); stagedLogoPreviewRef.current = preview; setStagedLogoPreview(preview); lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged();
    } catch (error) { setProblem(platformProblemOf(error)); } finally { lifecycle.setSubmitting(false); }
    return false;
  };
  const submit = async (value: Fields) => {
    if (!workspace || lifecycle.submitting || (logoIntent === 'REPLACE' && !stagedLogo)) return;
    lifecycle.setSubmitting(true); setProblem(undefined);
    try {
      const updated = await platformClient.updatePlatformGroupWorkspaceDisplay({groupWorkspaceKey: workspace.groupWorkspaceKey}, {body: {name: value.name.trim(), operationsTitle: value.operationsTitle.trim(), notes: value.notes?.trim() || null, logoIntent, logoAssetRef: logoIntent === 'REPLACE' ? stagedLogo?.assetRef : null, logoBindGrant: logoIntent === 'REPLACE' ? stagedLogo?.bindGrant : null, expectedVersion: workspace.version, idempotencyKey: lifecycle.getIdempotencyKey()}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      clearStagedLogo(); lifecycle.setDirty(false); onUpdated(updated);
    } catch (error) {
      const currentProblem = platformProblemOf(error);
      if (currentProblem.errorCode !== 'PLATFORM_COMMON_VERSION_CONFLICT') setProblem(currentProblem);
      else if (await releaseStagedLogo()) { lifecycle.setDirty(false); onClose(); onConflict(workspace.groupWorkspaceKey); }
    } finally { lifecycle.setSubmitting(false); }
  };
  return <Drawer title="编辑集团空间资料" open={Boolean(workspace)} size={560} destroyOnHidden onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} mask={{closable: true}} keyboard={!lifecycle.submitting} {...adminDrawerSurfaceProps} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting} {...testId('platform-workspace-edit-cancel')}>取消</Button><Button type="primary" loading={lifecycle.submitting} disabled={logoIntent === 'REPLACE' && !stagedLogo} onClick={() => form.submit()} {...testId('platform-workspace-edit-submit')}>保存</Button></Space>}>
    {problem && <Alert type="error" showIcon title={problem.title} description={problem.detail} style={{marginBottom: 16}} {...testId('platform-workspace-edit-error')}/>}
    <Form form={form} layout="vertical" onFinish={(value) => void submit(value)} onValuesChange={() => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }} disabled={lifecycle.submitting}>
      <Form.Item label="集团空间编码"><Input value={workspace?.groupWorkspaceKey} disabled {...testId('platform-workspace-edit-key')}/></Form.Item>
      <Form.Item name="name" label="集团空间名称" rules={[{required: true, whitespace: true}]}><Input maxLength={120} {...testId('platform-workspace-edit-name')}/></Form.Item>
      <Form.Item name="operationsTitle" label="运营管理后台标题名称" rules={[{required: true, whitespace: true}]}><Input maxLength={120} {...testId('platform-workspace-edit-operations-title')}/></Form.Item>
      <Form.Item name="notes" label="备注"><Input.TextArea rows={3} maxLength={500} {...testId('platform-workspace-edit-notes')}/></Form.Item>
      <Form.Item label="Logo">
        <Space orientation="vertical">
          {logoIntent === 'KEEP' && workspace?.logoUrl ? <Image width={96} height={96} src={workspace.logoUrl} alt={`${workspace.name} Logo`} preview {...testId('platform-workspace-edit-current-logo')}/> : null}
          {logoIntent === 'KEEP' && !workspace?.logoUrl ? <Typography.Text type="secondary">未配置</Typography.Text> : null}
          {stagedLogoPreview ? <Image width={96} height={96} src={stagedLogoPreview} alt="已选择的新 Logo" preview {...testId('platform-workspace-edit-staged-logo')}/> : null}
          <Upload accept="image/png,image/jpeg,image/webp" maxCount={1} beforeUpload={stageLogo} showUploadList={false} disabled={lifecycle.submitting}><Button disabled={lifecycle.submitting} {...testId('platform-workspace-edit-logo')}>{workspace?.logoUrl ? '更换 Logo' : '上传 Logo'}</Button></Upload>
          <Typography.Text type="secondary">支持 PNG、JPEG、WebP，文件不超过 5 MB；保存后生效。</Typography.Text>
        </Space>
      </Form.Item>
    </Form>
  </Drawer>;
}
