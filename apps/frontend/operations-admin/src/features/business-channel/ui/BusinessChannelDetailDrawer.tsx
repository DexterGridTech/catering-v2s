import {Alert, Button, Descriptions, Drawer, Space, Tag} from 'antd';
import {
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  testId,
  useDetailDrawer,
  useOverlayLock,
  useRefreshVersion,
  useSubmissionLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import type {
  BusinessChannelTemplateView,
  BusinessChannelView,
  OwnerBindingView,
  ProviderProfileView,
} from '../../../app/api/generated/operations-edge';
import type {OperationsPageContext} from '../../../app/routing/model';
import {useEffect, useState} from 'react';
import {
  operationsClient,
  operationsContentTabRefreshSignal,
  operationsProblemOf,
} from '../../../app/api/OperationsTransport';
import {readBusinessChannelTemplates, readExternalProviderCandidates} from '../application/queries';
import {BusinessChannelBindingDrawer} from './BusinessChannelBindingDrawer';
import {ownerBindingBusinessDisplay, ownerBindingExternalOwnerDisplay} from './ownerBindingPresentation';

export function BusinessChannelDetailDrawer({
  open,
  queryContext,
  selected,
  onClose,
  onEdit,
  onSaved,
}: {
  open: boolean;
  queryContext: OperationsPageContext;
  selected?: BusinessChannelView;
  onClose: () => void;
  onEdit?: (channel: BusinessChannelView) => void;
  onSaved: () => void;
}) {
  const detail = useDetailDrawer<BusinessChannelView>();
  const [template, setTemplate] = useState<BusinessChannelTemplateView>();
  const [provider, setProvider] = useState<ProviderProfileView>();
  const [binding, setBinding] = useState<OwnerBindingView>();
  const [problem, setProblem] = useState<string>();
  const [bindingOpen, setBindingOpen] = useState(false);
  const submission = useSubmissionLifecycle();
  useOverlayLock(open);
  const {openLoading, open: openDetail, close: closeDetail, loading, target} = detail;
  const selectedChannelRef = selected?.channelRef;
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  useEffect(() => {
    if (!open || !selectedChannelRef || bindingOpen) return;
    openLoading();
    setProblem(undefined);
    setBinding(undefined);
    const bindingRequest = selected?.bindingRef
      ? operationsClient.getOperationsOwnerBindingDetail(
          {groupWorkspaceKey: queryContext.groupWorkspaceKey, channelRef: selected.channelRef},
          {},
        )
      : Promise.resolve(undefined);
    void Promise.all([
      operationsClient.getOperationsBusinessChannelDetail(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, channelRef: selectedChannelRef},
        {},
      ),
      readBusinessChannelTemplates(queryContext),
      readExternalProviderCandidates(queryContext),
      bindingRequest,
    ])
      .then(([channel, templates, providers, nextBinding]) => {
        openDetail(channel);
        const nextTemplate = templates.items.find(item => item.templateRef === channel.templateRef);
        setTemplate(nextTemplate);
        setProvider(providers.find(item => item.providerCode === nextTemplate?.providerCode));
        setBinding(nextBinding);
      })
      .catch(error => {
        closeDetail();
        setProblem(operationsProblemOf(error).detail);
      });
  }, [
    bindingOpen,
    closeDetail,
    contentTabRefreshVersion,
    open,
    openDetail,
    openLoading,
    queryContext,
    selected,
    selectedChannelRef,
  ]);

  const channel = target;
  const closeThen = (next: () => void) => {
    if (!channel) return;
    closeDetail();
    onClose();
    next();
  };
  const transition = async (status: BusinessChannelView['status']) => {
    if (!channel) return;
    try {
      await operationsClient.transitionOperationsBusinessChannelStatus(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, channelRef: channel.channelRef},
        {
          body: {status, expectedVersion: channel.version},
          headers: {'Idempotency-Key': submission.getIdempotencyKey()},
        },
      );
      submission.reset();
      onSaved();
      onClose();
    } catch (error) {
      setProblem(operationsProblemOf(error).detail);
    }
  };
  return (
    <>
      <Drawer
        open={open}
        title="经营渠道详情"
        loading={loading}
        destroyOnHidden
        maskClosable
        onClose={() => {
          detail.close();
          onClose();
        }}
        {...adminDrawerSurfaceProps}
        {...testId('business-channel-detail')}
        extra={
          channel && (
            <Space>
              {onEdit && channel.status !== 'DISABLED' && (
                <Button onClick={() => closeThen(() => onEdit(channel))} {...testId('business-channel-edit-open')}>
                  编辑
                </Button>
              )}
              <Button
                disabled={channel.status === 'DISABLED'}
                title={channel.status === 'DISABLED' ? '已停用渠道不可维护绑定' : undefined}
                onClick={() => setBindingOpen(true)}
                {...testId('business-channel-binding')}
              >
                维护绑定
              </Button>
              {channel.status !== 'DISABLED' && (
                <Button danger onClick={() => void transition('DISABLED')} {...testId('business-channel-status')}>
                  停用
                </Button>
              )}
              {channel.status === 'DISABLED' && (
                <Button
                  disabled={(channel.stopReasons?.length ?? 0) > 0}
                  title={channel.stopReasons?.length ? '停用原因未清除，暂不可恢复草稿' : undefined}
                  onClick={() => void transition('DRAFT')}
                  {...testId('business-channel-status')}
                >
                  恢复草稿
                </Button>
              )}
            </Space>
          )
        }
      >
        {problem && <Alert type="error" showIcon title="读取失败" description={problem} />}
        {channel && (
          <>
            <Descriptions
              {...adminDetailDescriptionsProps}
              items={[
                {key: 'code', label: '渠道编码', children: channel.channelCode || '—'},
                {key: 'name', label: '渠道名称', children: channel.channelName},
                {key: 'template', label: '来源模板', children: template?.templateName || '—'},
                {key: 'operator', label: '经营主体', children: channel.ownerNodeTypeDisplayName || '—'},
                {key: 'order', label: '订单类型', children: template?.orderKindDisplayName || '—'},
                {key: 'access', label: '接入类型', children: template?.accessKindDisplayName || '—'},
                {key: 'dineInForm', label: '到店点餐形式', children: template?.dineInFormDisplayName || '—'},
                {
                  key: 'business',
                  label: '绑定业务',
                  children: ownerBindingBusinessDisplay(binding),
                },
                {
                  key: 'externalOwner',
                  label: '外部主体编号',
                  children:
                    template?.accessKind !== 'EXTERNAL'
                      ? '—'
                      : ownerBindingExternalOwnerDisplay(binding, provider?.authenticationKind),
                },
                {key: 'status', label: '状态', children: <Tag>{channel.statusDisplayName || '—'}</Tag>},
                {
                  key: 'stop',
                  label: '停用原因',
                  children: channel.stopReasonDisplayNames?.join('、') || '—',
                },
                {
                  key: 'binding',
                  label: '绑定状态',
                  children: binding?.statusDisplayName || (channel.bindingRef ? '已关联绑定' : '未关联绑定'),
                },
              ]}
            />
          </>
        )}
      </Drawer>
      {channel && (
        <BusinessChannelBindingDrawer
          open={bindingOpen}
          queryContext={queryContext}
          channel={channel}
          providerCode={provider?.providerCode}
          authenticationKind={provider?.authenticationKind}
          onClose={() => setBindingOpen(false)}
          onSaved={() => {
            setBindingOpen(false);
            onSaved();
          }}
        />
      )}
    </>
  );
}
