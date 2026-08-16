import {Alert, App, Button, DatePicker, Drawer, Form, Input, InputNumber, Select, Space, Switch} from 'antd';
import {
  adminDrawerSurfaceProps,
  testId,
  useDrawerFormLifecycle,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import dayjs, {type Dayjs} from 'dayjs';
import {useEffect, useMemo, useState} from 'react';
import {
  PLATFORM_ADMIN_OPERATION_IDS,
  type ExtensionDefinition,
  type GroupWorkspaceDetail,
  type JsonValue,
} from '../../../app/api/generated/platform-edge';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {
  platformClient,
  platformProblemOf,
  platformRtk,
  type PlatformApiProblem,
} from '../../../app/api/PlatformTransport';

type Fields = {groupCode: string; groupName: string; extensionValues?: Record<string, JsonValue | Dayjs>};

function extensionValues(
  definition: ExtensionDefinition | undefined,
  values?: Fields['extensionValues'],
): Record<string, JsonValue> {
  const dateKeys = new Set(
    (definition?.definitions ?? []).filter(field => field.type === 'DATE').map(field => field.key),
  );
  return Object.fromEntries(
    Object.entries(values ?? {}).map(([key, value]) => [
      key,
      dateKeys.has(key) && dayjs.isDayjs(value) ? value.format('YYYY-MM-DD') : value,
    ]),
  ) as Record<string, JsonValue>;
}

function extensionFields(definition?: ExtensionDefinition) {
  return (definition?.definitions ?? [])
    .filter(field => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
    .map(field => {
      const control =
        field.type === 'NUMBER' ? (
          <InputNumber style={{width: '100%'}} {...testId(`platform-workspace-initialize-extension-${field.key}`)} />
        ) : field.type === 'BOOLEAN' ? (
          <Switch {...testId(`platform-workspace-initialize-extension-${field.key}`)} />
        ) : field.type === 'DATE' ? (
          <DatePicker style={{width: '100%'}} {...testId(`platform-workspace-initialize-extension-${field.key}`)} />
        ) : field.type === 'SELECT' ? (
          <Select
            options={field.options.map(option => ({value: option, label: option}))}
            {...testId(`platform-workspace-initialize-extension-${field.key}`)}
          />
        ) : (
          <Input {...testId(`platform-workspace-initialize-extension-${field.key}`)} />
        );
      return (
        <Form.Item
          key={field.key}
          name={['extensionValues', field.key]}
          label={field.label}
          rules={field.required ? [{required: true, message: `请输入${field.label}`}] : []}
          valuePropName={field.type === 'BOOLEAN' ? 'checked' : undefined}
        >
          {control}
        </Form.Item>
      );
    });
}

export function CommercialGroupInitializationDrawer({
  workspace,
  onClose,
  onInitialized,
}: {
  workspace?: GroupWorkspaceDetail;
  onClose: () => void;
  onInitialized: (workspace: GroupWorkspaceDetail) => void;
}) {
  const [form] = Form.useForm<Fields>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const {message} = App.useApp();
  const lifecycle = useDrawerFormLifecycle({
    open: Boolean(workspace),
    onOpenChange: open => {
      if (!open) onClose();
    },
    dirtyMessage: '已填写的商业集团资料不会保存。',
    idempotencyKey: true,
    diagnosticOperationId: PLATFORM_ADMIN_OPERATION_IDS.initializeCommercialGroup,
  });
  useOverlayLock(Boolean(workspace));
  const definitionRequest = useMemo(
    () =>
      platformAdminRtkRequest.getExtensionDefinition(
        {groupWorkspaceKey: workspace?.groupWorkspaceKey ?? '', entityType: 'COMMERCIAL_GROUP'},
        {},
      ),
    [workspace?.groupWorkspaceKey],
  );
  const definition = platformRtk.useGetExtensionDefinitionQuery(definitionRequest, {skip: !workspace});
  useEffect(() => {
    if (workspace) {
      form.resetFields();
      form.setFieldValue('extensionValues', {});
      setProblem(undefined);
      lifecycle.reset();
    }
  }, [form, lifecycle, workspace]);
  const submit = async (value: Fields) => {
    if (!workspace || lifecycle.submitting || !definition.data || definition.isFetching) return;
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      await platformClient.initializeCommercialGroup(
        {groupWorkspaceKey: workspace.groupWorkspaceKey},
        {
          body: {
            groupCode: value.groupCode.trim(),
            groupName: value.groupName.trim(),
            extensionValues: extensionValues(definition.data, value.extensionValues),
            idempotencyKey: lifecycle.getIdempotencyKey(),
          },
          headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
        },
      );
      const detail = await platformClient.getPlatformGroupWorkspaceDetail(
        {groupWorkspaceKey: workspace.groupWorkspaceKey},
        {},
      );
      lifecycle.setDirty(false);
      message.success('初始化成功');
      onInitialized(detail);
    } catch (error) {
      setProblem(platformProblemOf(error));
    } finally {
      lifecycle.setSubmitting(false);
    }
  };
  const definitionProblem = definition.error ? platformProblemOf(definition.error) : undefined;
  const ready = Boolean(definition.data) && !definition.isFetching;
  return (
    <Drawer
      title="初始化商业集团"
      open={Boolean(workspace)}
      size={520}
      destroyOnHidden
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      mask={{closable: true}}
      keyboard={!lifecycle.submitting}
      {...adminDrawerSurfaceProps}
      footer={
        <Space>
          <Button
            onClick={lifecycle.requestClose}
            disabled={lifecycle.submitting}
            {...testId('platform-workspace-initialize-cancel')}
          >
            取消
          </Button>
          <Button
            type="primary"
            disabled={!ready}
            loading={lifecycle.submitting}
            onClick={() => form.submit()}
            {...testId('platform-workspace-initialize-submit')}
          >
            初始化
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
          {...testId('platform-workspace-initialize-error')}
        />
      )}
      {definitionProblem && (
        <Alert
          type="error"
          showIcon
          title={definitionProblem.title}
          description={definitionProblem.detail}
          style={{marginBottom: 16}}
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
        disabled={lifecycle.submitting || !ready}
      >
        <Form.Item name="groupCode" label="集团编码" rules={[{required: true, whitespace: true}]}>
          <Input maxLength={64} {...testId('platform-workspace-initialize-code')} />
        </Form.Item>
        <Form.Item name="groupName" label="集团名称" rules={[{required: true, whitespace: true}]}>
          <Input maxLength={120} {...testId('platform-workspace-initialize-name')} />
        </Form.Item>
        {extensionFields(definition.data)}
      </Form>
    </Drawer>
  );
}
