import {ReloadOutlined} from '@ant-design/icons';
import {Alert, Button, Descriptions, Drawer, Spin, Tag} from 'antd';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  formatCanonicalDateTime,
  isKnownClosedCode,
  NameCodePathText,
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
import {useCallback, useEffect, useState} from 'react';
import {
  ownerBindingBusinessDisplay,
  ownerBindingExternalOwnerDisplay,
  ownerBindingNodeTypeDisplay,
  ownerBindingStatusDisplay,
} from './ownerBindingPresentation';
import {
  authenticationKindLabels,
  collaborationBindingStatusLabels,
  unbindKindLabels,
} from '../model/collaborationCodeLabels';
import {platformDetailDrawerTestIds} from '../../../app/automation/platformDetailDrawerTestIds';

type DetailDrawerState = {target?: OwnerBindingView; isOpen: boolean; close: () => void};

export function formatOwnerBindingTimestamp(value: number): string {
  return formatCanonicalDateTime(value);
}

export function retainOwnerBindingOnRefresh(
  current: OwnerBindingView | undefined,
  bindingRef: string | undefined,
): OwnerBindingView | undefined {
  return current?.bindingRef === bindingRef ? current : undefined;
}

export function canEditOwnerBinding(
  profile: Pick<ProviderProfileView, 'authenticationKind' | 'enablementStatus'>,
  status: OwnerBindingView['status'],
) {
  return (
    profile.enablementStatus === 'ENABLED' &&
    Object.hasOwn(authenticationKindLabels, profile.authenticationKind) &&
    Object.hasOwn(collaborationBindingStatusLabels, status) &&
    status !== 'DELETED' &&
    ['INTERNAL_MAPPING', 'NO_MAPPING'].includes(profile.authenticationKind)
  );
}

export function canDeleteOwnerBinding(
  profile: Pick<ProviderProfileView, 'unbindKind'>,
  status: OwnerBindingView['status'],
): boolean {
  return (
    isKnownClosedCode(unbindKindLabels, profile.unbindKind) &&
    isKnownClosedCode(collaborationBindingStatusLabels, status) &&
    status !== 'DELETED'
  );
}

export function ownerBindingAuthorizationExplanation(
  authenticationKind: ProviderProfileView['authenticationKind'],
): string {
  if (authenticationKind === 'EXTERNAL_GRANT') {
    return '外部授权状态由回调管理，当前状态由 owner 回读；本地不可编辑。';
  }
  if (authenticationKind === 'INTERNAL_MAPPING') return '当前绑定由平台管理员维护外部主体映射。';
  if (!isKnownClosedCode(authenticationKindLabels, authenticationKind)) return '当前认证方式无法识别。';
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

  const loadBinding = useCallback(() => {
    if (!detail.isOpen || !bindingRef) return;
    const requestGeneration = generation.begin();
    // A refresh of the same detail keeps the last authoritative readback
    // visible. Switching to another binding clears the old surface before the
    // new request resolves, so stale facts never appear under a new identity.
    setBinding(current => retainOwnerBindingOnRefresh(current, bindingRef));
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
  }, [bindingRef, detail.isOpen, generation, groupWorkspaceKey]);

  useEffect(() => {
    if (!detail.isOpen || !bindingRef) {
      generation.invalidate();
      setBinding(undefined);
      setLoading(false);
      setProblem(undefined);
      return;
    }
    loadBinding();
  }, [bindingRef, contentTabRefreshVersion, detail.isOpen, generation, loadBinding]);

  const remove = async () => {
    if (!binding || removing) return;
    setRemoving(true);
    setProblem(undefined);
    try {
      await platformClient.deletePlatformOwnerBinding(
        {groupWorkspaceKey, bindingRef: binding.bindingRef},
        {
          body: {
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
  const actionItems = current
    ? [
        canEditOwnerBinding(profile, current.status)
          ? {
              key: 'edit',
              label: (
                <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.ownerBinding.edit}>
                  编辑绑定
                </AdminDetailActionLabel>
              ),
              onClick: () => onEdit(current),
            }
          : null,
        {
          key: 'remove',
          danger: true,
          disabled: !canDeleteOwnerBinding(profile, current.status) || removing,
          label: (
            <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.ownerBinding.remove}>
              {!isKnownClosedCode(unbindKindLabels, profile.unbindKind)
                ? '当前状态无法识别'
                : profile.unbindKind === 'REQUIRES_ADAPTER_UNBIND'
                  ? '申请解除授权'
                  : '删除绑定'}
            </AdminDetailActionLabel>
          ),
          onClick: () => void remove(),
        },
      ].filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];
  return (
    <Drawer
      open={detail.isOpen}
      title="绑定详情"
      onClose={detail.close}
      maskClosable
      extra={
        actionItems.length > 0 ? (
          <AdminDetailActionMenu
            items={actionItems}
            triggerTestId={platformDetailDrawerTestIds.ownerBinding.actionMenu}
            disabled={removing}
            loading={removing}
          />
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
          action={
            <Button icon={<ReloadOutlined />} onClick={loadBinding} disabled={loading}>
              重试
            </Button>
          }
          style={{marginBottom: 16}}
          {...testId('platform-owner-binding-detail-error')}
        />
      )}
      {current && !isKnownClosedCode(unbindKindLabels, profile.unbindKind) && (
        <Alert
          type="error"
          showIcon
          title="当前解绑方式无法识别，已停止解除绑定操作。"
          style={{marginBottom: 16}}
          {...testId('platform-owner-binding-unknown-unbind-kind')}
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
                children: ownerBindingNodeTypeDisplay(current),
              },
              {
                key: 'node',
                label: '绑定节点',
                children:
                  current.nodePath.length > 0 ? <NameCodePathText nodes={current.nodePath} /> : '未绑定组织节点',
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
              {key: 'status', label: '状态', children: <Tag>{ownerBindingStatusDisplay(current)}</Tag>},
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
