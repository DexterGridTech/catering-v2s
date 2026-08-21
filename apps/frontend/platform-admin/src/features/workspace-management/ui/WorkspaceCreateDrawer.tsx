import {Alert, Button, Drawer, Form, Image, Input, Space, Upload} from 'antd';
import {
  adminDrawerSurfaceProps,
  createContentIdempotencyKey,
  digestFileContent,
  testId,
  useDrawerFormLifecycle,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useRef, useState} from 'react';
import {
  PLATFORM_ADMIN_OPERATION_IDS,
  type GroupWorkspaceCreateRequest,
  type PlatformAssetStagingResult,
} from '../../../app/api/generated/platform-edge';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';

type Fields = Omit<GroupWorkspaceCreateRequest, 'idempotencyKey' | 'logoAssetRef' | 'logoBindGrant'>;

export function WorkspaceCreateDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form] = Form.useForm<Fields>();
  const [stagedLogo, setStagedLogo] = useState<PlatformAssetStagingResult>();
  const [stagedLogoPreview, setStagedLogoPreview] = useState<string>();
  const stagedLogoPreviewRef = useRef<string | undefined>(undefined);
  const stagedLogoRef = useRef<PlatformAssetStagingResult | undefined>(undefined);
  const releasingRef = useRef(false);
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: next => {
      if (!next) void closeAfterRelease();
    },
    dirtyMessage: '已填写的集团空间资料不会保存。',
    diagnosticOperationId: PLATFORM_ADMIN_OPERATION_IDS.createPlatformGroupWorkspace,
  });
  useOverlayLock(open);
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
    releasingRef.current = true;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      await platformClient.releasePlatformStagedAsset(
        {assetRef: staged.assetRef},
        {headers: {'X-Asset-Bind-Grant': staged.bindGrant}},
      );
      clearStagedLogo();
      return true;
    } catch (error) {
      setProblem(platformProblemOf(error));
      return false;
    } finally {
      releasingRef.current = false;
      lifecycle.setSubmitting(false);
    }
  };
  const closeAfterRelease = async () => {
    if (await releaseStagedLogo()) onClose();
  };
  useEffect(() => {
    if (open) {
      form.resetFields();
      clearStagedLogo();
      setProblem(undefined);
      lifecycle.reset();
    }
  }, [form, lifecycle, open]);
  useEffect(
    () => () => {
      if (stagedLogoPreviewRef.current) URL.revokeObjectURL(stagedLogoPreviewRef.current);
    },
    [],
  );
  const stageLogo = async (file: File) => {
    if (!(await releaseStagedLogo())) return Upload.LIST_IGNORE;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const mediaType = file.type || 'application/octet-stream';
      const digest = await digestFileContent(file);
      const idempotencyKey = await createContentIdempotencyKey(PLATFORM_ADMIN_OPERATION_IDS.stagePlatformAsset, {
        usage: 'GROUP_WORKSPACE_LOGO',
        fileName: file.name,
        mediaType,
        size: file.size,
        contentDigest: digest,
      });
      const value = await platformClient.stagePlatformAsset(
        {},
        {body: {usage: 'GROUP_WORKSPACE_LOGO', file}, headers: {'Idempotency-Key': idempotencyKey}},
      );
      const preview = URL.createObjectURL(file);
      stagedLogoRef.current = value;
      setStagedLogo(value);
      stagedLogoPreviewRef.current = preview;
      setStagedLogoPreview(preview);
      lifecycle.setDirty(true);
      lifecycle.markBusinessIntentChanged();
    } catch (error) {
      setProblem(platformProblemOf(error));
    } finally {
      lifecycle.setSubmitting(false);
    }
    return false;
  };
  const submit = async (value: Fields) => {
    if (!stagedLogo || lifecycle.submitting) return;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const body = {
        groupWorkspaceKey: value.groupWorkspaceKey.trim(),
        name: value.name.trim(),
        operationsTitle: value.operationsTitle.trim(),
        notes: value.notes?.trim() || undefined,
        logoAssetRef: stagedLogo.assetRef,
        logoBindGrant: stagedLogo.bindGrant,
      };
      const idempotencyKey = await createContentIdempotencyKey(
        PLATFORM_ADMIN_OPERATION_IDS.createPlatformGroupWorkspace,
        body,
      );
      await platformClient.createPlatformGroupWorkspace(
        {},
        {body: {...body, idempotencyKey}, headers: {'Idempotency-Key': idempotencyKey}},
      );
      clearStagedLogo();
      lifecycle.setDirty(false);
      onCreated();
    } catch (error) {
      setProblem(platformProblemOf(error));
    } finally {
      lifecycle.setSubmitting(false);
    }
  };
  return (
    <Drawer
      title="新建集团空间"
      open={open}
      size={560}
      destroyOnHidden
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      {...adminDrawerSurfaceProps}
      footer={
        <Space>
          <Button
            onClick={lifecycle.requestClose}
            disabled={lifecycle.submitting}
            {...testId('platform-workspace-create-cancel')}
          >
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            disabled={!stagedLogo}
            onClick={() => form.submit()}
            {...testId('platform-workspace-create-submit')}
          >
            创建
          </Button>
        </Space>
      }
    >
      {problem && (
        <Alert
          type="error"
          showIcon
          title={problem.title}
          description={problem.detail}
          style={{marginBottom: 16}}
          {...testId('platform-workspace-create-error')}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={value => void submit(value)}
        onValuesChange={() => {
          lifecycle.setDirty(true);
          lifecycle.markBusinessIntentChanged();
        }}
        disabled={lifecycle.submitting}
      >
        <Form.Item name="groupWorkspaceKey" label="集团空间编码" rules={[{required: true, whitespace: true}]}>
          <Input maxLength={64} {...testId('platform-workspace-create-key')} />
        </Form.Item>
        <Form.Item name="name" label="集团空间名称" rules={[{required: true, whitespace: true}]}>
          <Input maxLength={120} {...testId('platform-workspace-create-name')} />
        </Form.Item>
        <Form.Item name="operationsTitle" label="运营管理后台标题名称" rules={[{required: true, whitespace: true}]}>
          <Input maxLength={120} {...testId('platform-workspace-create-operations-title')} />
        </Form.Item>
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={3} maxLength={500} {...testId('platform-workspace-create-notes')} />
        </Form.Item>
        <Form.Item
          label="Logo"
          required
          extra={stagedLogo ? 'Logo 已暂存，创建时将由所有者一次性绑定。' : '请上传 PNG、JPEG 或 WEBP 格式图片。'}
        >
          <Space orientation="vertical">
            <Upload
              accept="image/png,image/jpeg,image/webp"
              maxCount={1}
              beforeUpload={stageLogo}
              showUploadList={false}
              disabled={lifecycle.submitting}
            >
              <Button disabled={lifecycle.submitting} {...testId('platform-workspace-create-logo')}>
                选择文件
              </Button>
            </Upload>
            {stagedLogoPreview && (
              <Image
                width={96}
                height={96}
                src={stagedLogoPreview}
                alt="已选择的 Logo"
                preview
                {...testId('platform-workspace-create-staged-logo')}
              />
            )}
          </Space>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
