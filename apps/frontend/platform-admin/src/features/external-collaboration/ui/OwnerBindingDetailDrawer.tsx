import {Alert, Button, Descriptions, Drawer, Spin, Space, Tag} from 'antd';
import {
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  testId,
  useAsyncGenerationGuard,
  useOverlayLock,
  useRefreshVersion,
  useSubmissionLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import type {OwnerBindingView, ProviderProfileView} from '../../../app/api/generated/platform-edge';
import {
  platformClient,
  platformContentTabRefreshSignal,
  platformProblemOf,
  type PlatformApiProblem,
} from '../../../app/api/PlatformTransport';
import {useEffect, useState} from 'react';
import {ownerBindingBusinessDisplay, ownerBindingExternalOwnerDisplay} from './ownerBindingPresentation';

type DetailDrawerState = {target?: OwnerBindingView; isOpen: boolean; close: () => void};

export function formatOwnerBindingTimestamp(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', {dateStyle: 'medium', timeStyle: 'medium'}).format(value);
}

export function canEditOwnerBinding(
  profile: Pick<ProviderProfileView, 'authenticationKind' | 'enablementStatus'>,
  status: OwnerBindingView['status'],
) {
  return (
    profile.enablementStatus === 'ENABLED' &&
    status !== 'DELETED' &&
    ['INTERNAL_MAPPING', 'NO_MAPPING'].includes(profile.authenticationKind)
  );
}

export function ownerBindingAuthorizationExplanation(
  authenticationKind: ProviderProfileView['authenticationKind'],
): string {
  if (authenticationKind === 'EXTERNAL_GRANT') {
    return '外部授权状态由回调管理，当前状态由 owner 回读；本地不可编辑。';
  }
  if (authenticationKind === 'INTERNAL_MAPPING') return '当前绑定由平台管理员维护外部主体映射。';
  return '此接入档案无需外部主体映射。';
}

export function OwnerBindingDetailDrawer({
  detail,
  groupWorkspaceKey,
  profile,
  onChanged,
  onEdit,
}: {
  detail: DetailDrawerState;
  groupWorkspaceKey: string;
  profile: ProviderProfileView;
  onChanged: () => void;
  onEdit: (binding: OwnerBindingView) => void;
}) {
  const submission = useSubmissionLifecycle();
  const row = detail.target;
  const bindingRef = row?.bindingRef;
  const [binding, setBinding] = useState<OwnerBindingView>();
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const generation = useAsyncGenerationGuard();
  const contentTabRefreshVersion = useRefreshVersion(platformContentTabRefreshSignal);
  useOverlayLock(detail.isOpen);

  useEffect(() => {
    if (!detail.isOpen || !bindingRef) {
      generation.invalidate();
      setBinding(undefined);
      setLoading(false);
      setProblem(undefined);
      return;
    }
    const requestGeneration = generation.begin();
    setBinding(undefined);
    setLoading(true);
    setProblem(undefined);
    void platformClient
      .getPlatformOwnerBindingDetail({groupWorkspaceKey, bindingRef}, {})
      .then(value => {
        if (generation.isCurrent(requestGeneration)) setBinding(value);
      })
      .catch(error => {
        if (generation.isCurrent(requestGeneration)) setProblem(platformProblemOf(error));
      })
      .finally(() => {
        if (generation.isCurrent(requestGeneration)) setLoading(false);
      });
  }, [bindingRef, contentTabRefreshVersion, detail.isOpen, generation, groupWorkspaceKey]);

  const remove = async () => {
    if (!binding || removing) return;
    setRemoving(true);
    setProblem(undefined);
    try {
      await platformClient.deletePlatformOwnerBinding(
        {groupWorkspaceKey, bindingRef: binding.bindingRef},
        {
          body: {
            bindingDisplayName: binding.bindingDisplayName ?? null,
            externalOwnerId: binding.externalOwnerId,
            expectedVersion: binding.version,
          },
          headers: {'Idempotency-Key': submission.getIdempotencyKey()},
        },
      );
      submission.reset();
      detail.close();
      onChanged();
    } catch (error) {
      setProblem(platformProblemOf(error));
    } finally {
      setRemoving(false);
    }
  };

  const current = binding;
  return (
    <Drawer
      open={detail.isOpen}
      title="绑定详情"
      onClose={detail.close}
      extra={
        current ? (
          <Space>
            {canEditOwnerBinding(profile, current.status) && (
              <Button onClick={() => onEdit(current)} {...testId('platform-owner-binding-edit')}>
                编辑绑定
              </Button>
            )}
            <Button
              danger
              loading={removing}
              disabled={current.status === 'DELETED'}
              onClick={() => void remove()}
              {...testId('platform-owner-binding-delete')}
            >
              {profile.unbindKind === 'REQUIRES_ADAPTER_UNBIND' ? '申请解除授权' : '删除绑定'}
            </Button>
          </Space>
        ) : undefined
      }
      {...adminDrawerSurfaceProps}
      {...testId('platform-owner-binding-detail-drawer')}
    >
      {loading && !current && <Spin {...testId('platform-owner-binding-detail-loading')} />}
      {problem && (
        <Alert
          type="error"
          showIcon
          title="绑定详情操作失败"
          description={problem.detail}
          style={{marginBottom: 16}}
          {...testId('platform-owner-binding-detail-error')}
        />
      )}
      {current && (
        <>
          <Descriptions
            {...adminDetailDescriptionsProps}
            items={[
              {key: 'name', label: '绑定名称', children: current.bindingDisplayName || '未命名绑定'},
              {
                key: 'nodeType',
                label: '绑定节点类型',
                children: current.nodeTypeDisplayName,
              },
              {
                key: 'node',
                label: '绑定节点',
                children: current.nodeDisplayPath || '业务节点名称暂不可用',
              },
              {key: 'business', label: '业务', children: ownerBindingBusinessDisplay(current)},
              {
                key: 'owner',
                label: '外部主体编号',
                children: ownerBindingExternalOwnerDisplay(current, profile.authenticationKind),
              },
              {key: 'boundAt', label: '绑定时间', children: formatOwnerBindingTimestamp(current.boundAt)},
              {
                key: 'statusChangedAt',
                label: '状态更新时间',
                children: formatOwnerBindingTimestamp(current.statusChangedAt),
              },
              {key: 'status', label: '状态', children: <Tag>{current.statusDisplayName}</Tag>},
              {
                key: 'auth',
                label: '授权状态说明',
                children: ownerBindingAuthorizationExplanation(profile.authenticationKind),
              },
            ]}
          />
        </>
      )}
    </Drawer>
  );
}
