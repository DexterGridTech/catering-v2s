import {ReloadOutlined} from '@ant-design/icons';
import {Alert, Button, Card, Descriptions, Modal, Space, Tabs, Tag} from 'antd';
import {testId, useRefreshVersion, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {
  platformClient,
  platformContentTabRefreshSignal,
  platformProblemOf,
  platformRtk,
  type PlatformApiProblem,
} from '../../../app/api/PlatformTransport';
import {OwnerBindingList} from './OwnerBindingList';

export function ProviderProfileDetail({
  groupWorkspaceKey,
  providerCode,
}: {
  groupWorkspaceKey: string;
  providerCode: string;
}) {
  const request = useMemo(
    () => platformAdminRtkRequest.getPlatformProviderProfileDetail({groupWorkspaceKey, providerCode}, {}),
    [groupWorkspaceKey, providerCode],
  );
  const query = platformRtk.useGetPlatformProviderProfileDetailQuery(request);
  const profile = query.currentData;
  const contentTabRefreshVersion = useRefreshVersion(platformContentTabRefreshSignal);
  const {refetch} = query;
  const [pendingStatus, setPendingStatus] = useState<NonNullable<typeof profile>['enablementStatus']>();
  const [retryStatus, setRetryStatus] = useState<NonNullable<typeof profile>['enablementStatus']>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const [readbackProblem, setReadbackProblem] = useState<PlatformApiProblem>();
  const submission = useSubmissionLifecycle();
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

  const saveStatus = async (status: NonNullable<typeof profile>['enablementStatus']) => {
    if (!profile || pendingStatus) return;
    setPendingStatus(status);
    setProblem(undefined);
    setRetryStatus(undefined);
    setReadbackProblem(undefined);
    try {
      await platformClient.transitionPlatformProviderProfileStatus(
        {groupWorkspaceKey, providerCode},
        {
          body: {status, expectedVersion: profile.version},
          headers: {'Idempotency-Key': submission.getIdempotencyKey()},
        },
      );
      submission.reset();
      await refreshReadback();
    } catch (error) {
      setProblem(platformProblemOf(error));
      setRetryStatus(status);
    } finally {
      setPendingStatus(undefined);
    }
  };

  if (!profile) {
    return readProblem ? (
      <Alert
        className="platform-master-detail-detail-content"
        type="error"
        showIcon
        title={readProblem.title}
        description={readProblem.detail}
        action={
          <Button icon={<ReloadOutlined />} onClick={() => void refreshReadback()}>
            重试
          </Button>
        }
        {...testId('platform-provider-profile-detail-error')}
      />
    ) : (
      <div className="platform-master-detail-detail-content" {...testId('platform-provider-profile-detail-loading')}>
        加载接入档案…
      </div>
    );
  }
  return (
    <div className="platform-master-detail-detail-content" {...testId('platform-provider-profile-detail')}>
      {(problem || readProblem) && (
        <Alert
          type="error"
          showIcon
          title={(problem ?? readProblem)?.title}
          description={(problem ?? readProblem)?.detail}
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
          {...testId('platform-provider-profile-detail-error')}
        />
      )}
      <Card
        className="platform-master-detail-detail-card"
        title="接入档案详情"
        extra={
          <Space>
            <Button
              type={profile.enablementStatus === 'ENABLED' ? 'primary' : 'default'}
              loading={pendingStatus === 'ENABLED'}
              disabled={profile.enablementStatus === 'ENABLED' || Boolean(pendingStatus)}
              onClick={() =>
                Modal.confirm({
                  title: '启用接入档案',
                  content: '确认启用当前接入档案吗？',
                  okText: '确认启用',
                  cancelText: '取消',
                  onOk: () => saveStatus('ENABLED'),
                })
              }
              {...testId('platform-provider-profile-enable')}
            >
              启用
            </Button>
            <Button
              danger
              type={profile.enablementStatus === 'DISABLED' ? 'primary' : 'default'}
              loading={pendingStatus === 'DISABLED'}
              disabled={profile.enablementStatus === 'DISABLED' || Boolean(pendingStatus)}
              onClick={() =>
                Modal.confirm({
                  title: '停用接入档案',
                  content: '确认停用当前接入档案吗？',
                  okText: '确认停用',
                  cancelText: '取消',
                  okButtonProps: {danger: true},
                  onOk: () => saveStatus('DISABLED'),
                })
              }
              {...testId('platform-provider-profile-disable')}
            >
              停用
            </Button>
            <Button onClick={() => void refreshReadback()} disabled={Boolean(pendingStatus)}>
              刷新
            </Button>
          </Space>
        }
      >
        <Tabs
          items={[
            {
              key: 'detail',
              label: '详情',
              children: (
                <Space direction="vertical" size={16} style={{display: 'flex'}}>
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      {key: 'name', label: '档案名称', children: profile.displayName},
                      {key: 'code', label: '档案编码', children: profile.providerCode},
                      {key: 'system', label: '所属外部系统', children: profile.externalSystemDisplayName || '—'},
                      {
                        key: 'scope',
                        label: '支持的业务',
                        children: profile.businessScopeDisplayNames?.join('、') || '—',
                      },
                      {
                        key: 'nodes',
                        label: '可绑定的业务节点',
                        children: profile.bindableNodeTypeDisplayNames?.join('、') || '—',
                      },
                      {key: 'auth', label: '认证方式', children: profile.authenticationKindDisplayName || '—'},
                      {key: 'unbind', label: '解绑方式', children: profile.unbindKindDisplayName || '—'},
                      {key: 'catalog', label: '目录标记', children: profile.catalogStatusDisplayName || '—'},
                      {
                        key: 'status',
                        label: '当前空间状态',
                        children: <Tag>{profile.enablementStatus === 'ENABLED' ? '已启用' : '已停用'}</Tag>,
                      },
                    ]}
                  />
                </Space>
              ),
            },
            {
              key: 'bindings',
              label: '绑定关系',
              children: <OwnerBindingList groupWorkspaceKey={groupWorkspaceKey} profile={profile} />,
            },
          ]}
          {...testId('platform-provider-profile-tabs')}
        />
      </Card>
    </div>
  );
}
