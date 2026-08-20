import {ReloadOutlined} from '@ant-design/icons';
import {Alert, Button, Card, Descriptions, Divider, Modal, Space, Table, Tag, Typography} from 'antd';
import {testId, useRefreshVersion, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import type {ExternalSystemView} from '../../../app/api/generated/platform-edge';
import {
  platformClient,
  platformContentTabRefreshSignal,
  platformProblemOf,
  platformRtk,
  type PlatformApiProblem,
} from '../../../app/api/PlatformTransport';

/**
 * The OpenAPI additionalProperties=true generator shape is not stable across
 * generator versions (Record<string, JsonValue> versus {}). Keep that wire
 * detail at the edge and expose only the renderer's unknown value contract.
 */
function attributeValueOf(attributeValues: unknown, fieldKey: string): unknown {
  if (!attributeValues || typeof attributeValues !== 'object' || Array.isArray(attributeValues)) return undefined;
  return Object.prototype.hasOwnProperty.call(attributeValues, fieldKey)
    ? (attributeValues as Record<string, unknown>)[fieldKey]
    : undefined;
}

function attributeLabelOf(
  capability: ExternalSystemView['capabilities'][number],
  fieldKey: string,
): string | undefined {
  return attributeValueOf(capability.attributeValues, fieldKey) === undefined
    ? undefined
    : capability.attributeValueLabels?.[fieldKey];
}

function hasAttribute(capability: ExternalSystemView['capabilities'][number], fieldKey: string): boolean {
  const attributeValues = capability.attributeValues;
  return Boolean(
    attributeValues &&
    typeof attributeValues === 'object' &&
    !Array.isArray(attributeValues) &&
    Object.prototype.hasOwnProperty.call(attributeValues, fieldKey),
  );
}

type CapabilityAttributeRow = {
  key: string;
  label: string;
  value: string;
  helpText: string;
};

function CapabilityAttributes({system}: {system: ExternalSystemView}) {
  const descriptors = system.attributeDictionary ?? [];
  if (!descriptors.length) return <Typography.Text type="secondary">暂无能力属性</Typography.Text>;
  return (
    <Space direction="vertical" size={14} style={{display: 'flex'}}>
      {system.capabilities.map(capability => (
        <Card key={capability.capabilityClass} size="small" title={capability.displayName}>
          {(() => {
            const capabilityDescriptors = descriptors.filter(descriptor =>
              hasAttribute(capability, descriptor.fieldKey),
            );
            if (!capabilityDescriptors.length) return <Typography.Text type="secondary">暂无能力属性</Typography.Text>;
            return (
              <Table<CapabilityAttributeRow>
                size="small"
                bordered
                pagination={false}
                rowKey="key"
                dataSource={capabilityDescriptors.map<CapabilityAttributeRow>(descriptor => ({
                  key: `${capability.capabilityClass}:${descriptor.fieldKey}`,
                  label: descriptor.label,
                  value: attributeLabelOf(capability, descriptor.fieldKey) ?? '—',
                  helpText: descriptor.helpText,
                }))}
                columns={[
                  {title: '属性', dataIndex: 'label', width: '28%'},
                  {title: '当前值', dataIndex: 'value', width: '24%'},
                  {title: '说明', dataIndex: 'helpText'},
                ]}
              />
            );
          })()}
        </Card>
      ))}
    </Space>
  );
}

export function ExternalSystemDetail({
  groupWorkspaceKey,
  externalSystemCode,
}: {
  groupWorkspaceKey: string;
  externalSystemCode: string;
}) {
  const [pendingStatus, setPendingStatus] = useState<ExternalSystemView['enablementStatus']>();
  const [retryStatus, setRetryStatus] = useState<ExternalSystemView['enablementStatus']>();
  const [readbackProblem, setReadbackProblem] = useState<PlatformApiProblem>();
  const submission = useSubmissionLifecycle();
  const request = useMemo(
    () => platformAdminRtkRequest.getPlatformExternalSystemDetail({groupWorkspaceKey, externalSystemCode}, {}),
    [externalSystemCode, groupWorkspaceKey],
  );
  const query = platformRtk.useGetPlatformExternalSystemDetailQuery(request);
  const system = query.currentData;
  const contentTabRefreshVersion = useRefreshVersion(platformContentTabRefreshSignal);
  const {refetch} = query;
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const queryProblem = query.error ? platformProblemOf(query.error) : undefined;
  const readProblem = readbackProblem ?? queryProblem;
  useEffect(() => {
    if (contentTabRefreshVersion > 0) void refetch();
  }, [contentTabRefreshVersion, refetch]);
  const refreshReadback = async () => {
    setReadbackProblem(undefined);
    try {
      const result = await query.refetch();
      if ('error' in result && result.error) setReadbackProblem(platformProblemOf(result.error));
    } catch (error) {
      setReadbackProblem(platformProblemOf(error));
    }
  };
  const saveStatus = async (status: ExternalSystemView['enablementStatus']) => {
    if (!system || pendingStatus) return;
    setPendingStatus(status);
    setProblem(undefined);
    setRetryStatus(undefined);
    setReadbackProblem(undefined);
    try {
      await platformClient.transitionPlatformExternalSystemStatus(
        {groupWorkspaceKey, externalSystemCode},
        {
          body: {status, expectedVersion: system.version},
          headers: {'Idempotency-Key': submission.getIdempotencyKey()},
        },
      );
      submission.reset();
      await refreshReadback();
    } catch (error) {
      // Keep the last owner readback visible while exposing the typed command problem.
      setProblem(platformProblemOf(error));
      setRetryStatus(status);
    } finally {
      setPendingStatus(undefined);
    }
  };
  if (!system) {
    return (
      <Card
        className="platform-master-detail-detail-content"
        title="外部系统详情"
        {...testId('platform-external-system-detail')}
      >
        {readProblem ? (
          <Alert
            type="error"
            showIcon
            title={readProblem.title}
            description={readProblem.detail}
            action={
              <Button icon={<ReloadOutlined />} onClick={() => void refreshReadback()}>
                重试
              </Button>
            }
            {...testId('platform-external-system-detail-error')}
          />
        ) : (
          <Card loading={query.isFetching} bordered={false} />
        )}
      </Card>
    );
  }
  return (
    <Card
      className="platform-master-detail-detail-content"
      title="外部系统详情"
      extra={
        <Space>
          <Button
            type={system.enablementStatus === 'ENABLED' ? 'primary' : 'default'}
            loading={pendingStatus === 'ENABLED'}
            disabled={system.enablementStatus === 'ENABLED' || Boolean(pendingStatus)}
            onClick={() =>
              Modal.confirm({
                title: '启用外部系统',
                content: '确认启用当前外部系统吗？',
                okText: '确认启用',
                cancelText: '取消',
                onOk: () => saveStatus('ENABLED'),
              })
            }
            {...testId('platform-external-system-enable')}
          >
            启用
          </Button>
          <Button
            danger
            type={system.enablementStatus === 'DISABLED' ? 'primary' : 'default'}
            loading={pendingStatus === 'DISABLED'}
            disabled={system.enablementStatus === 'DISABLED' || Boolean(pendingStatus)}
            onClick={() =>
              Modal.confirm({
                title: '停用外部系统',
                content: '确认停用当前外部系统吗？',
                okText: '确认停用',
                cancelText: '取消',
                okButtonProps: {danger: true},
                onOk: () => saveStatus('DISABLED'),
              })
            }
            {...testId('platform-external-system-disable')}
          >
            停用
          </Button>
          <Button onClick={() => void refreshReadback()} disabled={Boolean(pendingStatus)}>
            刷新
          </Button>
        </Space>
      }
      {...testId('platform-external-system-detail')}
    >
      {(readProblem || problem) && (
        <Alert
          type="error"
          showIcon
          title={(problem || readProblem)?.title}
          description={(problem || readProblem)?.detail}
          action={
            problem && retryStatus ? (
              <Button icon={<ReloadOutlined />} onClick={() => void saveStatus(retryStatus)}>
                重试
              </Button>
            ) : (
              <Button icon={<ReloadOutlined />} onClick={() => void refreshReadback()}>
                重试
              </Button>
            )
          }
          style={{marginBottom: 16}}
          {...testId('platform-external-system-detail-error')}
        />
      )}
      <Descriptions
        bordered
        size="small"
        column={1}
        items={[
          {key: 'name', label: '系统名称', children: system.displayName},
          {key: 'code', label: '系统编码', children: system.externalSystemCode},
          {key: 'catalog', label: '目录标记', children: system.catalogStatusDisplayName || '—'},
          {
            key: 'status',
            label: '当前空间状态',
            children: <Tag>{system.enablementStatus === 'ENABLED' ? '已启用' : '已停用'}</Tag>,
          },
        ]}
      />
      <Divider />
      <Typography.Title level={5}>能力属性</Typography.Title>
      <CapabilityAttributes system={system} />
    </Card>
  );
}
